import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectIstramEnvironment, readIfcMappings } from './config.js';
import { parseAliFile, parseRasFile, parseComandosCfg, parseNativeContent } from './parsers.js';
import { DomainError, readDocument, safeChild } from './io.js';
import { inspectProjectDirectory, ProjectStore } from './projects.js';
import { Jobs } from './jobs.js';
import { worker } from './bridge.js';

const textPath=z.string().min(1).max(4096);
const requestId=z.string().min(1).max(128);
export function createServer(){
  const server=new McpServer({name:'istram-mcp',version:'0.2.0-rc.1'});
  const workspace=process.env.ISTRAM_WORKSPACE ?? fileURLToPath(new URL('../.local/projects',import.meta.url));
  const projects=new ProjectStore(workspace,async(changes,root)=>{await worker('idle',{changes,projectPath:root});});
  const jobs=new Jobs(path.join(workspace,'..','jobs'));
  function register<S extends z.ZodObject>(name:string,description:string,schema:S,readOnly:boolean,run:(args:z.infer<S>)=>unknown|Promise<unknown>){
    server.registerTool(name,{description,inputSchema:schema,annotations:{readOnlyHint:readOnly,destructiveHint:!readOnly,idempotentHint:readOnly,openWorldHint:false}},
      async args=>{
        try{
          const data=await run(schema.parse(args));
          const result={ok:true,data};
          return {content:[{type:'text' as const,text:JSON.stringify(result)}],structuredContent:result};
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
  register('project_inspect','Inspect .pol references and .cej axis records; report missing or external dependencies.',z.object({projectPath:textPath}),true,a=>inspectProjectDirectory(a.projectPath));
  register('alignment_read','Read .ALI numeric rows, preserving unknown records; geometry interpretation is not certified for writes.',z.object({filePath:textPath}),true,a=>parseAliFile(a.filePath));
  register('profile_read','Read .ras numeric profile rows with strict number validation.',z.object({filePath:textPath}),true,a=>parseRasFile(a.filePath));
  register('ifc_entity_types','Read all available IFC mapping rows and entity names; does not imply licensed export.',z.object({}),true,()=>readIfcMappings(detectIstramEnvironment().basePath));
  register('native_records_read','Inspect raw .cej/.vol/.pol/.per/.beg/.atf records without guessing their geometry semantics.',z.object({filePath:textPath}),true,a=>{
    if(!/\.(cej|vol|pol|per|beg|atf|act|cfg)$/i.test(a.filePath))throw new DomainError('UNSUPPORTED_FORMAT','Unsupported native text format');
    const doc=readDocument(a.filePath);return {sha256:doc.sha256,encoding:doc.encoding,records:parseNativeContent(doc.text),writeValidated:false};
  });
  register('project_copy','Copy a project into the managed workspace and verify source/copy hashes.',z.object({sourcePath:textPath}),false,a=>projects.copy(a.sourcePath));
  register('project_prepare_changes','Prepare exact line changes on a managed copy; no native model is changed. Review unknown format semantics before applying.',z.object({projectId:z.string().uuid(),requestId,changes:z.array(z.object({file:textPath,line:z.number().int().positive(),expected:z.string(),replacement:z.string()})).min(1).max(100)}),false,a=>projects.prepare(a.projectId,a.requestId,a.changes));
  register('project_apply_changes','Apply prepared changes with journal and backup. Requires verified binary-matched adapter and idle ISTRAM.',z.object({projectId:z.string().uuid(),requestId}),false,a=>projects.apply(a.projectId,a.requestId));
  register('project_restore_changes','Restore a managed copy if no subsequent edits conflict; never overwrite original projects.',z.object({projectId:z.string().uuid(),requestId}),false,a=>projects.restore(a.projectId,a.requestId));
  register('worker_health','Check Python and optional Windows/IFC dependencies.',z.object({}),true,()=>worker('health'));
  register('session_snapshot','Inspect live ISTRAM windows and control identifiers without changing the model.',z.object({}),true,()=>worker('snapshot'));
  register('operation_start','Start a verified Windows recipe on a managed copy. Unknown versions or unverified recipes are refused.',z.object({
    projectId:z.string().uuid(),requestId,action:z.enum(['open_project','save','recalculate','bim_configure','bim_generate','bim_export']),projectFile:z.string().optional(),outputFile:z.string().optional()
  }),false,a=>{
    const root=projects.path(a.projectId);
    const params:Record<string,unknown>={action:a.action,projectPath:root};
    if(a.projectFile)params.projectFile=safeChild(root,a.projectFile);
    if(a.outputFile)params.outputPath=safeChild(root,a.outputFile);
    return jobs.start(a.requestId,a,'istram-session',()=>worker('action',params,30*60*1000));
  });
  register('operation_status','Inspect durable operation status, including uncertain outcomes after crashes.',z.object({operationId:z.string().uuid()}),true,a=>jobs.get(a.operationId));
  register('operation_cancel','Cancel only before native execution begins; never kill ISTRAM to cancel.',z.object({operationId:z.string().uuid()}),false,a=>jobs.cancel(a.operationId));
  register('ifc_validate','Validate IFC schema/WHERE rules, project units, required PSETs and optional geometry using IfcOpenShell.',z.object({filePath:textPath,expectedSchema:z.string().optional(),requiredPsets:z.array(z.string()).default([]),geometry:z.boolean().default(false)}),true,a=>worker('ifc_validate',a,30*60*1000));
  for(const [name,uri,read] of [
    ['system_status','istram://system/status',()=>detectIstramEnvironment()],
    ['ifc_classes','istram://ifc/classes',()=>readIfcMappings(detectIstramEnvironment().basePath)],
    ['coverage','istram://system/coverage',()=>({status:'release_candidate',nativeRecipesVerified:false,stableAcceptancePassed:false,sourceReviewComplete:false})],
  ] as const){
    server.registerResource(name,uri,{mimeType:'application/json'},async url=>({contents:[{uri:url.href,mimeType:'application/json',text:JSON.stringify(read())}]}));
  }
  return server;
}
