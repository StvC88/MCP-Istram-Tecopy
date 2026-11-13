import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectIstramEnvironment, readIfcMappings } from './config.js';
import { parseAliFile, parseRasFile, parseComandosCfg, parseNativeContent } from './parsers.js';
import { DomainError, readDocument, safeChild } from './io.js';
import { inspectProjectDirectory, inspectProjectSummary, ProjectStore } from './projects.js';
import { Jobs } from './jobs.js';
import { worker } from './bridge.js';
import { readUsageCatalogue, usageCapabilities, workflowPlan } from './capabilities.js';
import {alignmentSchema,drainageSchema,sectionSchema,designSchema,designPreview,prepareDesignPackage} from './designs.js';

const textPath=z.string().min(1).max(4096);
const requestId=z.string().min(1).max(128);
const rceTables = ['01','02','03','04','05','06','07'] as const;
const rceAuditOptions = z.object({
  catalogDirectory: textPath,
  requiredTables: z.array(z.enum(rceTables)).min(1).max(7).default(['01','02','05']),
  sampleLimit: z.number().int().min(0).max(100).default(20)
});
const dgcLocationOptions = z.object({
  expectedProjectedCrs: z.string().regex(/^EPSG:\d+$/),
  expectedVerticalDatum: z.string().min(1).max(200).optional(),
  surveyControl: z.object({
    guid: z.string().length(22), easting: z.number().finite(), northing: z.number().finite(),
    elevation: z.number().finite(), toleranceMetres: z.number().finite().positive()
  }).optional(),
  requiredMarkerPks: z.array(z.number().finite()).max(1000).default([]),
  sampleLimit: z.number().int().min(0).max(100).default(20)
});
export function createServer(){
  const server=new McpServer({name:'istram-mcp',version:'0.3.0-rc.1'}, {
    instructions: 'Start with project_inspect summary=true and the known POL. Before a whole-project BIM export, compare the axis and terrain inventory with the live BIM tree. Verify geometry for the intended road groups, railings and terrain in Virtual 3D. For RCEclass, check the FCV with rceclass_profile_inspect before export and the IFC with ifc_rceclass_audit afterwards. Use ifc_validate for geometry, schema and the project-specific DGC location checks. Command catalog entries are documentation. Use verified recipes for automated native actions.'
  });
  const workspace=process.env.ISTRAM_WORKSPACE ?? fileURLToPath(new URL('../.local/projects',import.meta.url));
  const projects=new ProjectStore(workspace,async(changes,root)=>{await worker('idle',{changes,projectPath:root});});
  const jobs=new Jobs(path.join(workspace,'..','jobs'));
  register('alignment_design_preview','Validate an explicit metre-based XY polyline and compute stations/azimuths. Does not create native curves or write CEJ.',alignmentSchema,true,a=>designPreview(a));
  register('drainage_design_preview','Check pipe topology, invert gradients, vertical drops at nodes and endpoint cover. Does not certify hydraulics or create native pipes/manholes.',drainageSchema,true,a=>designPreview(a));
  register('section_design_preview','Check ordered local section outlines for ditches, boxes, walls, tunnels and details. Reports intersections, area and perimeter; no structural/hydraulic certification.',sectionSchema,true,a=>designPreview(a));
  register('design_package_prepare','Write new DXF interchange geometry and a JSON design record in managed-copy metadata only. No native project files are replaced; import and calculation remain required.',z.object({projectId:z.string().uuid(),requestId,design:designSchema}),false,a=>prepareDesignPackage(projects.path(a.projectId),a.requestId,a.design));
  register('usage_workflow_plan','Read available preparation tools, source evidence, inputs and native acceptance blockers for each ISTRAM capability.',z.object({capabilityId:z.string().min(1).max(100)}),true,a=>workflowPlan(a.capabilityId));
  register('project_changes_preview','Read a paginated prepared/applied change plan, hashes and batch summary without returning all element details.',z.object({projectId:z.string().uuid(),requestId,offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(500).default(100)}),true,a=>projects.preview(a.projectId,a.requestId,a.offset,a.limit));
  register('project_prepare_batch','Prepare explicit reviewed text changes for up to 1000 listed elements on a managed copy. Shared-file conflicts are rejected; no design files are changed. Apply still requires a verified format profile.',z.object({
    projectId:z.string().uuid(),requestId,summaryOnly:z.boolean().default(false),elements:z.array(z.object({elementId:z.string().min(1).max(256),changes:z.array(z.object({
      file:textPath,line:z.number().int().positive(),expected:z.string(),replacement:z.string()
    })).min(1).max(100)})).min(1).max(1000)
  }),false,a=>{const plan=projects.prepareBatch(a.projectId,a.requestId,a.elements);return a.summaryOnly?projects.preview(a.projectId,a.requestId,0,20):plan;});
  register('usage_capabilities','Read evidence-backed ISTRAM usage requirements, current coverage and acceptance criteria. Proposed tools are not executable recipes.',z.object({
    query:z.string().max(500).optional(),capabilityId:z.string().max(100).optional(),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(10)
  }),true,a=>usageCapabilities(a));
  function register<S extends z.ZodObject>(name:string,description:string,schema:S,readOnly:boolean,run:(args:z.infer<S>)=>unknown|Promise<unknown>){
    const inputSchema: z.ZodObject = schema;
    server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:readOnly,destructiveHint:!readOnly,idempotentHint:readOnly,openWorldHint:false}},
      async (args):Promise<CallToolResult>=>{
        try{
          const data=await run(schema.parse(args));
          const result={ok:true,data};
          return {content:[{type:'text' as const,text:JSON.stringify(result)}],structuredContent:JSON.parse(JSON.stringify(result))};
        }catch(e){
          const result={ok:false,error:{code:e instanceof DomainError?e.code:'EXECUTION_FAILED',message:e instanceof Error?e.message:String(e),details:e instanceof DomainError?e.details:undefined}};
          return {isError:true,content:[{type:'text' as const,text:JSON.stringify(result)}],structuredContent:result};
        }
      });
  }
  register('istram_detect','Installed components and historical version evidence; licensed modules remain unknown until checked.',z.object({customPath:textPath.optional()}),true,a=>detectIstramEnvironment(a.customPath));
  register('istram_command_catalog','Keyboard dictionary; entries are documented shortcuts, not verified execution recipes.',z.object({query:z.string().optional(),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(250).default(100)}),true,a=>{
    let commands=parseComandosCfg(path.join(detectIstramEnvironment().basePath,'lib','comandos.cfg'));
    if(a.query)commands=commands.filter(c=>JSON.stringify(c).toLowerCase().includes(a.query!.toLowerCase()));
    return {total:commands.length,commands:commands.slice(a.offset,a.offset+a.limit)};
  });
  register('project_inspect','Inventory POL and CEJ axes, saved B1M geometry, terrain candidates and auxiliary LON references. Use summary=true for counts or a relative projectFile for detail. Disk evidence requires confirmation in the live BIM tree.',z.object({
    projectPath:textPath, projectFile:textPath.optional(), summary:z.boolean().default(false),
    includeTemporary:z.boolean().optional(), offset:z.number().int().min(0).default(0), limit:z.number().int().min(1).max(100).default(10)
  }),true,a=>a.summary ? inspectProjectSummary(a.projectPath,a) : inspectProjectDirectory(a.projectPath,a));
  register('ifc_rceclass_audit','Check RCE_CLA codes and descriptions, IFC classification associations and membership in the seven approved FCT tables. Reports coverage and bounded samples; use ifc_validate for schema and geometry.',
    rceAuditOptions.extend({filePath:textPath}),true,a=>worker('ifc_rceclass_audit',a,30*60*1000));
  register('rceclass_profile_inspect','Preflight an ISTRAM RCEclass FCV profile against the approved FCT tables before export. Pass exact ISTRAM class names to focus on the current model.',
    rceAuditOptions.extend({profilePath:textPath, classes:z.array(z.string().min(1).max(256)).max(1000).default([])}),
    true,a=>worker('rceclass_profile_inspect',a));
  register('ifc_istram_alignment_prepare','Build a derivative IFC with DGC_LOC chainages and raised station markers from matching, verified straight-segment ALI and RAS reports. Use only for an empty ISTRAM alignment. Verify schema, geometry and survey control after processing.',z.object({
    filePath:textPath,outputPath:textPath,aliPath:textPath,rasPath:textPath,
    roadId:z.string().min(1).max(100),intervalMetres:z.number().finite().min(1).default(1000),
    markerHeightMetres:z.number().finite().positive().max(5).default(1)
  }),false,a=>{
    if (!/\.ifc$/i.test(a.outputPath) || !/\.ifc$/i.test(a.filePath) ||
        !/\.ali$/i.test(a.aliPath) || !/\.ras$/i.test(a.rasPath)) {
      throw new DomainError('INVALID_ALIGNMENT_FILES','Expected IFC, ALI and RAS file extensions');
    }
    return worker('ifc_istram_alignment_prepare',a,5*60*1000);
  });
  register('alignment_read','Read .ALI numeric rows, preserving unknown records; geometry interpretation is not certified for writes.',z.object({filePath:textPath}),true,a=>parseAliFile(a.filePath));
  register('profile_read','Read .ras numeric profile rows with strict number validation.',z.object({filePath:textPath}),true,a=>parseRasFile(a.filePath));
  register('ifc_entity_types','Read all available IFC mapping rows and entity names; does not imply licensed export.',z.object({}),true,()=>readIfcMappings(detectIstramEnvironment().basePath));
  register('native_records_read','Inspect paginated raw native text records without guessing geometry semantics.',z.object({filePath:textPath,offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(1000).default(200)}),true,a=>{
    if(!/\.(cej|vol|pol|per|beg|atf|act|cfg)$/i.test(a.filePath))throw new DomainError('UNSUPPORTED_FORMAT','Unsupported native text format');
    const doc=readDocument(a.filePath),records=parseNativeContent(doc.text);return {sha256:doc.sha256,encoding:doc.encoding,total:records.length,offset:a.offset,limit:a.limit,records:records.slice(a.offset,a.offset+a.limit),writeValidated:false};
  });
  register('project_copy','Copy project files into the managed workspace and verify copied-file hashes. Optional explicit top-level directory exclusions are recorded; unsaved session data is not captured.',z.object({sourcePath:textPath,excludeDirectories:z.array(z.string().min(1).max(255)).max(10).default([])}),false,a=>projects.copy(a.sourcePath,a.excludeDirectories));
  register('project_prepare_changes','Prepare exact line changes on a managed copy; no native model is changed. Review unknown format semantics before applying.',z.object({projectId:z.string().uuid(),requestId,changes:z.array(z.object({file:textPath,line:z.number().int().positive(),expected:z.string(),replacement:z.string()})).min(1).max(100)}),false,a=>projects.prepare(a.projectId,a.requestId,a.changes));
  register('project_apply_changes','Apply prepared changes with journal and backup. Requires verified binary-matched adapter and idle ISTRAM.',z.object({projectId:z.string().uuid(),requestId}),false,a=>projects.apply(a.projectId,a.requestId));
  register('project_restore_changes','Restore a managed copy if no subsequent edits conflict; never overwrite original projects.',z.object({projectId:z.string().uuid(),requestId}),false,a=>projects.restore(a.projectId,a.requestId));
  register('worker_health','Check Python and optional Windows/IFC dependencies.',z.object({}),true,()=>worker('health'));
  register('session_snapshot','Inspect live ISTRAM windows and control identifiers without changing the model.',z.object({}),true,()=>worker('snapshot'));
  register('operation_start','Start a verified Windows recipe on a managed copy. Unknown versions or unverified recipes are refused.',z.object({
    projectId:z.string().uuid(),requestId,action:z.enum(['open_project','close_project','save','recalculate','bim_configure','bim_generate','bim_export']),projectFile:z.string().optional(),outputFile:z.string().optional(),
    rceclassAudit:rceAuditOptions.optional()
  }),false,a=>{
    const root=projects.path(a.projectId);
    const params:Record<string,unknown>={action:a.action,projectPath:root};
    if(a.projectFile)params.projectFile=safeChild(root,a.projectFile);
    if(a.outputFile)params.outputPath=safeChild(root,a.outputFile);
    if (a.rceclassAudit && (a.action !== 'bim_export' || !a.outputFile || !/\.ifc$/i.test(a.outputFile))) {
      throw new DomainError('INVALID_RCECLASS_EXPORT', 'RCEclass audit requires bim_export with an IFC outputFile');
    }
    return jobs.start(a.requestId,a,'istram-session',async()=>{
      if(!projects.verifySource(a.projectId))throw new DomainError('SOURCE_CHANGED','Original copied files differ from their inventory; inspect before native execution');
      try{
        if (a.rceclassAudit) {
          await worker('rceclass_catalog_check', {catalogDirectory:a.rceclassAudit.catalogDirectory});
        }
        const result = await worker('action',params,30*60*1000);
        if (!a.rceclassAudit) return result;
        try {
          const filePath = safeChild(root,a.outputFile!);
          const artifacts = result.artifacts as Record<string,string>;
          const expected = Object.entries(artifacts).find(([relative]) => safeChild(root,relative) === filePath)?.[1];
          if (!expected) throw new DomainError('OUTPUT_NOT_VERIFIED', 'The recipe did not verify the requested IFC as an artifact');
          const audit = await worker('ifc_rceclass_audit',{...a.rceclassAudit,filePath},30*60*1000);
          if (audit.sha256 !== expected) throw new DomainError('OUTPUT_CHANGED', 'The IFC changed after export');
          return {...result, rceclassAudit:{status:'completed', ...audit}};
        } catch (error) {
          // The native export already ran; report the audit failure without retrying the export.
          return {...result, rceclassAudit:{status:'failed',
            code:error instanceof DomainError ? error.code : 'RCECLASS_AUDIT_FAILED',
            message:error instanceof Error ? error.message : String(error)}};
        }
      }
      finally{if(!projects.verifySource(a.projectId))throw new DomainError('OUTCOME_UNCERTAIN','Original copied files changed during the native operation; inspect before recovery');}
    });
  });
  register('operation_status','Inspect durable operation status, including uncertain outcomes after crashes.',z.object({operationId:z.string().uuid()}),true,a=>jobs.get(a.operationId));
  register('operation_cancel','Cancel only before native execution begins; never kill ISTRAM to cancel.',z.object({operationId:z.string().uuid()}),false,a=>jobs.cancel(a.operationId));
  register('ifc_validate','Validate IFC schema, geometry and optional project-specific expectations for product counts, metre scale, projected CRS and property values. Does not prove native export or engineering quantities.',z.object({filePath:textPath,expectedSchema:z.string().optional(),requiredPsets:z.array(z.string()).default([]),geometry:z.boolean().default(false),
    minGeometryProducts:z.number().int().min(1).optional(),minProducts:z.number().int().min(1).optional(),minAlignments:z.number().int().min(1).optional(),expectedLengthUnitToMetres:z.number().finite().positive().optional(),expectedProjectedCrs:z.string().min(1).optional(),
    requiredProperties:z.array(z.object({entityType:z.string().min(1).default('IfcElement'),pset:z.string().min(1),property:z.string().min(1),expectedValue:z.union([z.string(),z.number().finite(),z.boolean()]).optional()})).max(100).default([]),
    dgcLocation: dgcLocationOptions.optional()
  }),true,a=>worker('ifc_validate',a,30*60*1000));
  for(const [name,uri,read] of [
    ['system_status','istram://system/status',()=>detectIstramEnvironment()],
    ['ifc_classes','istram://ifc/classes',()=>readIfcMappings(detectIstramEnvironment().basePath)],
    ['usage_capabilities','istram://usage/capabilities',()=>readUsageCatalogue()],
    ['coverage','istram://system/coverage',()=>({status:'release_candidate',officialScopeUrl:'https://istram.net/istram/caracteristicas/soluciones/',priority:'model_configuration_and_bim',nativeRecipesVerified:false,stableAcceptancePassed:false,sourceReviewComplete:false})],
  ] as const){
    server.registerResource(name,uri,{mimeType:'application/json'},async url=>({contents:[{uri:url.href,mimeType:'application/json',text:JSON.stringify(read())}]}));
  }
  return server;
}
