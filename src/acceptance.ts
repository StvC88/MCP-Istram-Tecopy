import * as z from 'zod/v4';
import {DomainError} from './io.js';
const assertion=z.object({path:z.string().regex(/^[A-Za-z][A-Za-z0-9_]*(\.(\d+|[A-Za-z][A-Za-z0-9_]*))*$/),
  equals:z.unknown().optional(),closeTo:z.number().finite().optional(),tolerance:z.number().finite().positive().optional(),min:z.number().finite().optional()});
export const scenarioSchema=z.object({sourcePath:z.string().min(1),sourceReviewComplete:z.literal(true),nativeGeometryReviewComplete:z.literal(true),
  excludeDirectories:z.array(z.string()).max(10).default([]),
  steps:z.array(z.object({tool:z.string(),arguments:z.record(z.string(),z.unknown()),assertions:z.array(assertion).default([])})).min(1).max(100)});
export function validateScenario(input:unknown){
  const scenario=scenarioSchema.parse(input),steps=scenario.steps;
  const actions=steps.filter(s=>s.tool==='operation_start').map(s=>s.arguments.action);
  const required=['open_project','recalculate','save','close_project','open_project','bim_configure','bim_generate','bim_export','close_project'];
  let found=0;for(const action of actions)if(action===required[found])found++;
  if(found!==required.length)throw new DomainError('ACCEPTANCE_SCENARIO_INCOMPLETE','Scenario must open, calculate, save, close, reopen, generate/export BIM and close normally');
  const apply=steps.findIndex(s=>s.tool==='project_apply_changes'),prepare=steps.findIndex(s=>['project_prepare_changes','project_prepare_batch'].includes(s.tool));
  const open=steps.findIndex(s=>s.tool==='operation_start'&&s.arguments.action==='open_project');
  if(prepare<0||apply<=prepare||apply>=open)throw new DomainError('ACCEPTANCE_SCENARIO_INCOMPLETE','Reviewed file changes must be prepared and applied before opening the managed copy');
  const reopen=steps.findIndex((s,i)=>i>open&&s.tool==='operation_start'&&s.arguments.action==='open_project');
  const measured=steps.find((s,i)=>i>reopen&&s.tool==='alignment_read'&&typeof s.arguments.filePath==='string'&&s.arguments.filePath.startsWith('{projectPath}')&&s.assertions.some(a=>/^elements\.\d+\.length$/.test(a.path)&&a.closeTo!==undefined&&a.tolerance!==undefined));
  if(!measured)
    throw new DomainError('ENGINEERING_ASSERTIONS_REQUIRED','Reopened alignment needs explicit measured geometry assertions');
  const exported=steps.findIndex(s=>s.tool==='operation_start'&&s.arguments.action==='bim_export');
  const ifcIndex=steps.findIndex((s,i)=>i>exported&&s.tool==='ifc_validate');
  const ifc=steps[ifcIndex];
  if(!ifc||ifc.arguments.geometry!==true||!String(ifc.arguments.expectedSchema??'').startsWith('IFC4X3')||!Array.isArray(ifc.arguments.requiredPsets)||!ifc.arguments.requiredPsets.length||!ifc.assertions.length)
    throw new DomainError('ENGINEERING_ASSERTIONS_REQUIRED','IFC4X3 geometry and required PSETs need explicit engineering assertions');
  if(!ifc.assertions.some(a=>a.path==='valid'&&a.equals===true)||!ifc.assertions.some(a=>a.path==='geometry.length'&&a.min!==undefined&&a.min>=1))
    throw new DomainError('ENGINEERING_ASSERTIONS_REQUIRED','Exported IFC must be valid and contain measured nonempty geometry');
  const output=steps[exported]!.arguments.outputFile;
  if(typeof output!=='string'||typeof ifc.arguments.filePath!=='string'||ifc.arguments.filePath.replaceAll('\\','/')!=='{projectPath}/'+output.replaceAll('\\','/'))
    throw new DomainError('ENGINEERING_ASSERTIONS_REQUIRED','Validate the IFC output of this managed-copy export');
  const mutations=new Set(['project_prepare_changes','project_prepare_batch','project_apply_changes','project_restore_changes','operation_start']);
  const requestIds=new Set<string>();
  for(const step of steps){
    if(mutations.has(step.tool)){
      if(step.arguments.projectId!=='{projectId}')throw new DomainError('ACCEPTANCE_PROJECT','Mutations must use this run\'s managed-copy project ID');
      const request=step.arguments.requestId;
      if(typeof request!=='string'||!request.includes('{runId}'))throw new DomainError('ACCEPTANCE_REQUEST_ID','Each mutating request ID must contain {runId}');
      // Prepare/apply deliberately share their plan request ID. Native jobs must be distinct.
      if(step.tool==='operation_start'){
        if(requestIds.has(request))throw new DomainError('ACCEPTANCE_REQUEST_ID','Native actions need distinct request IDs');
        requestIds.add(request);
      }
    }
    for(const a of step.assertions){
      if(a.equals===undefined&&a.closeTo===undefined&&a.min===undefined)throw new DomainError('INVALID_ASSERTION','Expected value or minimum is required');
      if(a.closeTo!==undefined&&a.tolerance===undefined)throw new DomainError('INVALID_ASSERTION','Numeric comparison needs an explicit tolerance');
      if(a.path.split('.').some(p=>['constructor','prototype','__proto__'].includes(p)))throw new DomainError('INVALID_ASSERTION','Reserved property in assertion');
    }
  }
  return scenario;
}
export function checkAssertions(data:unknown,assertions:z.infer<typeof assertion>[]){
  for(const assertion of assertions){
    let actual:unknown=data;
    for(const key of assertion.path.split('.')){
      if(actual===null||typeof actual!=='object'||!Object.hasOwn(actual,key))throw new DomainError('ASSERTION_FAILED','Missing property: '+assertion.path);
      actual=(actual as Record<string,unknown>)[key];
    }
    if(assertion.equals!==undefined&&JSON.stringify(actual)!==JSON.stringify(assertion.equals))throw new DomainError('ASSERTION_FAILED','Value differs: '+assertion.path);
    if(assertion.closeTo!==undefined&&(typeof actual!=='number'||!Number.isFinite(actual)||Math.abs(actual-assertion.closeTo)>assertion.tolerance!))throw new DomainError('ASSERTION_FAILED','Outside engineering tolerance: '+assertion.path);
    if(assertion.min!==undefined&&(typeof actual!=='number'||!Number.isFinite(actual)||actual<assertion.min))throw new DomainError('ASSERTION_FAILED','Below minimum: '+assertion.path);
  }
}
