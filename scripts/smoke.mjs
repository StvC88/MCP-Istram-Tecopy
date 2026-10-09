import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {connect,call,repo} from './client.mjs';
const runId=randomUUID(),root=path.join(repo,'.local','smoke',runId),source=path.join(root,'source');fs.mkdirSync(source,{recursive:true});
fs.writeFileSync(path.join(source,'test.pol'),'CEJ 1 test.cej\nVOL 1 absent.vol\nVOLV 1 absent.vol\n');
fs.writeFileSync(path.join(source,'test.cej'),'EJE 1 0 1 Synthetic only\n');
for(let i=0;i<350;i++)fs.writeFileSync(path.join(source,`item-${i}.cfg`),'width 7\r\n');
const checksum=()=>createHash('sha256').update(fs.readdirSync(source).sort().map(f=>f+':'+createHash('sha256').update(fs.readFileSync(path.join(source,f))).digest('hex')).join('\n')).digest('hex');
const original=checksum(),client=await connect({ISTRAM_WORKSPACE:path.join(root,'copies'),ISTRAM_ADAPTER_PROFILE:'',ISTRAM_ACCEPTANCE_MODE:''});
const report={runId,startedAt:new Date().toISOString(),success:false,checks:[],nativeExecutionVerified:false,engineeringDesignCertified:false};
async function check(name,run){await run();report.checks.push({name,passed:true});}
try{
  await check('25 stdio tools',async()=>assert.equal((await client.listTools()).tools.length,25));
  const copy=await call(client,'project_copy',{sourcePath:source});report.projectPath=copy.projectPath;
  await check('grouped missing dependencies',async()=>assert.equal((await call(client,'project_inspect',{projectPath:copy.projectPath})).dependencyWarnings.length,1));
  const axis={kind:'alignment',units:'m',crs:'local synthetic',points:[[0,0],[100,0]]};
  await check('100 metre axis',async()=>assert.equal((await call(client,'alignment_design_preview',axis)).metrics.lengthM,100));
  const drainage={kind:'drainage',units:'m',crs:'local synthetic',minCoverM:1,nodes:[{id:'a',x:0,y:0,invertZ:10,groundZ:12},{id:'b',x:100,y:0,invertZ:9,groundZ:12}],links:[{id:'pipe',from:'a',to:'b',diameterM:.5}]};
  await check('pipe slope and cover',async()=>{const d=await call(client,'drainage_design_preview',drainage);assert.equal(d.valid,true);assert.equal(d.metrics.links[0].slopePercent,1);assert.deepEqual(d.metrics.links[0].endpointCoverM,[1.5,2.5]);});
  await check('adverse slope rejected',async()=>assert.equal((await call(client,'drainage_design_preview',{...drainage,links:[{...drainage.links[0],from:'b',to:'a'}]})).valid,false));
  const designs=[axis,drainage];
  for(const sectionType of ['ditch','box_culvert','wall','tunnel','detail']){
    const d={kind:'section',sectionType,units:'m',coordinateFrame:'local_section',closed:sectionType!=='ditch',vertices:sectionType==='ditch'?[[0,0],[1,-1],[2,0]]:[[0,0],[4,0],[4,2],[0,2]]};
    await check(sectionType+' outline',async()=>{const p=await call(client,'section_design_preview',d);assert.equal(p.valid,true);if(d.closed)assert.equal(p.metrics.areaM2,8);});designs.push(d);
  }
  report.packages=[];
  for(const [i,design] of designs.entries())await check('DXF/JSON package '+i,async()=>{
    const args={projectId:copy.projectId,requestId:'design-'+i,design},pkg=await call(client,'design_package_prepare',args);
    assert.equal(pkg.nativeImported,false);assert.equal((await call(client,'design_package_prepare',args)).fingerprint,pkg.fingerprint);report.packages.push(pkg);
  });
  await check('24 workflows have explicit blockers',async()=>{const c=await call(client,'usage_capabilities',{limit:50});assert.equal(c.total,24);for(const cap of c.capabilities){const p=await call(client,'usage_workflow_plan',{capabilityId:cap.id});assert.ok(p.inputs.length&&p.acceptance.length&&p.blockers.length);assert.equal(p.nativeExecutionVerified,false);}});
  const batch={projectId:copy.projectId,requestId:'batch350',summaryOnly:true,elements:Array.from({length:350},(_,i)=>({elementId:String(i),changes:[{file:`item-${i}.cfg`,line:1,expected:'width 7',replacement:'width 8'}]}))};
  await check('350 element batch preparation and pagination',async()=>{const summary=await call(client,'project_prepare_batch',batch);assert.equal(summary.changes.length,20);assert.equal(summary.totalFiles,350);assert.equal(summary.files.length,20);const p=await call(client,'project_changes_preview',{projectId:copy.projectId,requestId:'batch350',offset:340,limit:10});assert.equal(p.totalChanges,350);assert.equal(p.changes.length,10);assert.equal(p.files.length,10);assert.equal(p.nativeRecalculated,false);});
  await check('native writes refuse absent adapter',async()=>{await assert.rejects(()=>call(client,'project_apply_changes',{projectId:copy.projectId,requestId:'batch350'}),e=>e.code==='ADAPTER_REQUIRED');});
  await check('native queue preserves failure code without UI mutation',async()=>{const j=await call(client,'operation_start',{projectId:copy.projectId,requestId:'guard',action:'recalculate'});let status;for(let i=0;i<100;i++){status=await call(client,'operation_status',{operationId:j.id});if(!['pending','running'].includes(status.state))break;await new Promise(r=>setTimeout(r,100));}assert.equal(status.state,'failed');assert.equal(status.error.code,'ADAPTER_REQUIRED');});
  await check('original and copied native files preserved',async()=>{assert.equal(checksum(),original);for(let i=0;i<350;i++)assert.equal(fs.readFileSync(path.join(copy.projectPath,`item-${i}.cfg`),'utf8'),'width 7\r\n');});
  report.success=true;
}catch(error){report.error={message:String(error),code:error.code};process.exitCode=1;}
finally{await client.close();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,report:path.join(root,'report.json'),error:report.error},null,2));}
