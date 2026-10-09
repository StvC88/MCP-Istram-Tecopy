import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const input=process.argv[2];
if(!input)throw new Error('Usage: npm run test:acceptance -- local-scenario.json. See docs/ACCEPTANCE.md.');
const scenario=JSON.parse(fs.readFileSync(input,'utf8'));
if(!scenario.sourceReviewComplete||!scenario.nativeGeometryReviewComplete)throw new Error('Source review and geometry review must be completed first');
if(!Array.isArray(scenario.steps)||!scenario.steps.length)throw new Error('Scenario must contain verified model changes and native operation steps');
const reportDir=path.resolve('artifacts/acceptance');fs.mkdirSync(reportDir,{recursive:true});
async function call(client,name,args){
  const result=await client.callTool({name,arguments:args});
  const block=result.content.find(c=>c.type==='text');
  const parsed=block?JSON.parse(block.text):{};
  if(result.isError||!parsed.ok)throw new Error(JSON.stringify(parsed));
  return parsed.data;
}
function expand(value,vars){
  if(typeof value==='string')return value.replace(/\{(\w+)\}/g,(_,key)=>{
    if(!(key in vars))throw new Error('Unknown scenario variable '+key);
    return String(vars[key]);
  });
  if(Array.isArray(value))return value.map(v=>expand(v,vars));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,expand(v,vars)]));
  return value;
}
for(let session=1;session<=2;session++){
  const client=new Client({name:'istram-acceptance',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[path.resolve('dist/index.js')],
    env:{...process.env,ISTRAM_ACCEPTANCE_MODE:'1'}});
  await client.connect(transport);
  try{
    for(let n=1;n<=10;n++){
      const runId=crypto.randomUUID(),report={runId,session:'session-'+session,startedAt:new Date().toISOString(),success:false,steps:[]};
      try{
        const copy=await call(client,'project_copy',{sourcePath:scenario.sourcePath});
        const vars={runId,projectId:copy.projectId,projectPath:copy.projectPath};
        for(const step of scenario.steps){
          const args=expand(step.arguments,vars);
          const data=await call(client,step.tool,args);
          if(step.tool==='operation_start'){
            let result=data;
            const deadline=Date.now()+30*60*1000;
            do{
              await new Promise(resolve=>setTimeout(resolve,1000));
              result=await call(client,'operation_status',{operationId:data.id});
            }while(['pending','running'].includes(result.state)&&Date.now()<deadline);
            if(result.state!=='completed')throw new Error('Native operation did not complete: '+JSON.stringify(result));
            report.steps.push({tool:step.tool,result});
          }else report.steps.push({tool:step.tool,result:data});
          if(step.tool==='ifc_validate'&&!data.valid)throw new Error('IFC validation failed');
        }
        // An external ISTRAM session is not force-closed by the evaluator.
        // Supply a reviewed close-session step in the recipe or close it normally between runs.
        report.success=true;
      }catch(error){report.error=String(error);}
      report.finishedAt=new Date().toISOString();
      fs.writeFileSync(path.join(reportDir,runId+'.json'),JSON.stringify(report,null,2));
      if(!report.success)throw new Error('Acceptance failed; inspect '+runId);
    }
  }finally{await client.close();}
}
console.log('20 scenario executions recorded. Geometry, quantities and persistence evidence still require review before certification.');
