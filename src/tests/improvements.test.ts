import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {designPreview,prepareDesignPackage} from '../designs.js';
import {DomainError,hash} from '../io.js';
import {Jobs} from '../jobs.js';
import {ProjectStore,inspectProjectDirectory} from '../projects.js';
import {readUsageCatalogue,workflowPlan} from '../capabilities.js';
import {validateScenario,checkAssertions} from '../acceptance.js';
function base(t:TestContext){const p=fs.mkdtempSync(path.join(os.tmpdir(),'istram-improved-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
function hasCode(code:string){return (e:unknown)=>e instanceof DomainError&&e.code===code;}

test('explicit metre alignment computes stationing and north-clockwise angles without native certification',()=>{
  const p=designPreview({kind:'alignment',units:'m',crs:'local engineering',originStation:500,points:[[0,0],[100,0],[100,50]]});
  assert.equal(p.valid,true);assert.equal(p.metrics.lengthM,150);assert.equal(p.metrics.endStation,650);
  const segments=p.metrics.segments as {azimuthDegrees:number;azimuthGon:number}[];
  assert.equal(segments[0]!.azimuthDegrees,90);assert.equal(segments[0]!.azimuthGon,100);assert.equal(segments[1]!.azimuthDegrees,0);
  assert.equal(p.nativeExecutionVerified,false);
  assert.equal(designPreview({kind:'alignment',units:'m',crs:'local',points:[[0,0],[0,0]]}).valid,false);
});
const drainage={kind:'drainage' as const,units:'m' as const,crs:'local',minCoverM:1,
  nodes:[{id:'a',x:0,y:0,invertZ:10,groundZ:12},{id:'b',x:100,y:0,invertZ:9,groundZ:12}],
  links:[{id:'pipe',from:'a',to:'b',diameterM:.5}]};
test('drainage uses invert-to-crown cover and slope; node drops remain separate from pipe segments',()=>{
  const p=designPreview(drainage);assert.equal(p.valid,true);
  const links=p.metrics.links as {slopePercent:number;endpointCoverM:number[]}[];
  assert.equal(links[0]!.slopePercent,1);assert.deepEqual(links[0]!.endpointCoverM,[1.5,2.5]);
  assert.equal(p.drawing[0]!.points[0]![2],10.25);
  const drop=designPreview({...drainage,links:[{...drainage.links[0]!,toInvertZ:8}]});
  assert.equal((drop.metrics.links as {slopePercent:number}[])[0]!.slopePercent,2);
  assert.equal(p.metrics.hydraulicsValidated,false);
});
test('bad drainage topology, reverse slopes and unknown cover cannot pass geometry preflight',()=>{
  for(const fixture of [
    {...drainage,links:[{...drainage.links[0]!,to:'absent'}]},
    {...drainage,nodes:[drainage.nodes[0]!,{...drainage.nodes[1]!,invertZ:11}]},
    {...drainage,minCoverM:2},
    {...drainage,nodes:drainage.nodes.map(n=>({...n,groundZ:undefined}))},
    {...drainage,links:[...drainage.links,{id:'cycle',from:'b',to:'a',diameterM:.5}]},
    {...drainage,nodes:[drainage.nodes[0]!,{...drainage.nodes[1]!,id:'a'}]}
  ])assert.equal(designPreview(fixture).valid,false);
});
test('closed outlines preserve winding and reject crossings, zero areas and missing closure',()=>{
  const input={kind:'section' as const,sectionType:'box_culvert' as const,units:'m' as const,coordinateFrame:'local_section' as const,closed:true,vertices:[[0,0],[4,0],[4,2],[0,2]] as [number,number][]};
  const p=designPreview(input);assert.equal(p.valid,true);assert.equal(p.metrics.areaM2,8);assert.equal(p.metrics.perimeterM,12);
  assert.equal(designPreview({...input,vertices:[[0,0],[4,2],[0,2],[4,0]]}).valid,false);
  assert.equal(designPreview({...input,closed:false}).valid,false);
  assert.equal(designPreview({...input,vertices:[[0,0],[1,0],[2,0]]}).valid,false);
  const open=designPreview({...input,sectionType:'ditch',closed:false,vertices:[[0,0],[1,-1],[2,0]]});
  assert.equal(open.valid,true);assert.equal(open.metrics.areaM2,null);
  const reversed=designPreview({...input,sectionType:'detail',closed:false,vertices:[[0,0],[1,0],[0,0]]});
  assert.equal(reversed.valid,false);assert.equal(reversed.metrics.vertices,3);
});
test('design packages are idempotent, detect later edits and preserve managed design files',t=>{
  const root=base(t),source=path.join(root,'source');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'a.cej'),'EJE 1 0 1 Existing');
  const store=new ProjectStore(path.join(root,'copies')),copy=store.copy(source),before=hash(fs.readFileSync(path.join(copy.projectPath,'a.cej')));
  const input={kind:'alignment' as const,units:'m' as const,crs:'local',points:[[0,0],[100,0]] as [number,number][]};
  const pkg=prepareDesignPackage(copy.projectPath,'design',input);
  assert.equal(pkg.nativeImported,false);assert.equal(prepareDesignPackage(copy.projectPath,'design',input).fingerprint,pkg.fingerprint);
  assert.throws(()=>prepareDesignPackage(copy.projectPath,'design',{...input,points:[[0,0],[200,0]]}),hasCode('IDEMPOTENCY_CONFLICT'));
  assert.equal(hash(fs.readFileSync(path.join(copy.projectPath,'a.cej'))),before);assert.equal(store.verifySource(copy.projectId),true);
  fs.appendFileSync(pkg.artifacts[0]!.path,'tamper');
  assert.throws(()=>prepareDesignPackage(copy.projectPath,'design',input),hasCode('OUTCOME_CHANGED'));
  assert.throws(()=>prepareDesignPackage(copy.projectPath,'bad',{...input,points:[[0,0],[0,0]]}),hasCode('INVALID_DESIGN'));
});
test('excluded directories are never traversed even when their contents are inaccessible',t=>{
  const root=base(t),source=path.join(root,'source'),blocked=path.join(source,'tmp');fs.mkdirSync(blocked,{recursive:true});fs.writeFileSync(path.join(source,'ok.cfg'),'ok');
  const original=fs.readdirSync;
  fs.readdirSync=((...args:Parameters<typeof fs.readdirSync>)=>{
    if(String(args[0])===blocked)throw Object.assign(new Error('excluded EACCES'),{code:'EACCES'});
    return original(...args);
  }) as typeof fs.readdirSync;
  try{const c=new ProjectStore(path.join(root,'copies')).copy(source,['tmp']);assert.equal(c.filesCount,1);assert.deepEqual(c.excludedDirectoriesPresent,['tmp']);}
  finally{fs.readdirSync=original;}
});
test('dependency warnings group occurrences and preserve their project/tag context',t=>{
  const root=base(t);
  for(const name of ['a.pol','b.pol'])fs.writeFileSync(path.join(root,name),'VOL 1 missing.vol\nVOLV 1 missing.vol\n');
  const p=inspectProjectDirectory(root);assert.equal(p.warnings.length,1);assert.equal(p.dependencyWarnings[0]!.occurrences.length,4);
  assert.deepEqual(new Set(p.dependencyWarnings[0]!.occurrences.map(o=>o.project)),new Set(['a.pol','b.pol']));
});
test('jobs preserve domain errors, accept legacy journals and reject unknown IDs with a stable code',async t=>{
  const dir=base(t),jobs=new Jobs(dir);
  const j=jobs.start('failed',{},'r',async()=>{throw new DomainError('ADAPTER_REQUIRED','Missing verified profile',{reason:'profile'});});
  for(let n=0;n<50&&['pending','running'].includes(jobs.get(j.id).state);n++)await new Promise(r=>setTimeout(r,10));
  assert.deepEqual(jobs.get(j.id).error,{code:'ADAPTER_REQUIRED',message:'Missing verified profile',details:{reason:'profile'}});
  assert.equal(jobs.cancel(j.id).state,'failed');assert.throws(()=>jobs.get(randomUUID()),hasCode('OPERATION_NOT_FOUND'));
  const id=randomUUID();fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify({id,state:'failed',error:'Old failure'}));
  assert.deepEqual(jobs.get(id).error,{code:'LEGACY_ERROR',message:'Old failure'});
});
test('all tutorial capability workflows expose inputs, acceptance and honest native blockers',()=>{
  for(const c of readUsageCatalogue().capabilities){
    const p=workflowPlan(c.id);assert.ok(p.inputs.length&&p.acceptance.length);assert.equal(p.nativeExecutionVerified,false);assert.ok(p.blockers.length);
    assert.equal(p.engineeringDesignCertified,false);
  }
  assert.ok(workflowPlan('drainage').currentTools.includes('drainage_design_preview'));
  assert.ok(workflowPlan('structures').currentTools.includes('section_design_preview'));
});

test('failed running-journal write prevents execution and releases the resource after recording failure',async t=>{
  const dir=base(t),jobs=new Jobs(dir),rename=fs.renameSync;let rejected=false,calls=0;
  fs.renameSync=((from:fs.PathLike,to:fs.PathLike)=>{
    if(!rejected&&String(to).endsWith('.json')&&JSON.parse(fs.readFileSync(from,'utf8')).state==='running'){rejected=true;throw new Error('journal unavailable');}
    return rename(from,to);
  }) as typeof fs.renameSync;
  let id:string;
  try{const j=jobs.start('journal',{},'session',async()=>{calls++;});id=j.id;
    for(let i=0;i<50&&jobs.get(id).state==='pending';i++)await new Promise(r=>setTimeout(r,10));
    assert.equal(jobs.get(id).state,'failed');assert.equal((jobs.get(id).error as {code:string}).code,'JOURNAL_WRITE_FAILED');assert.equal(calls,0);
  }finally{fs.renameSync=rename;}
  const next=jobs.start('next',{},'session',async()=>{calls++;});
  for(let i=0;i<50&&['pending','running'].includes(jobs.get(next.id).state);i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(jobs.get(next.id).state,'completed');assert.equal(calls,1);
});

test('partial multi-file writes remain uncertain and can be recovered without changing the source',async t=>{
  const root=base(t),source=path.join(root,'source');fs.mkdirSync(source);
  for(const f of ['a.cfg','b.cfg'])fs.writeFileSync(path.join(source,f),'width 7\n');
  const store=new ProjectStore(path.join(root,'copies'),async()=>{}),copy=store.copy(source);
  store.prepare(copy.projectId,'crash',['a.cfg','b.cfg'].map(file=>({file,line:1,expected:'width 7',replacement:'width 8'})));
  const rename=fs.renameSync;
  fs.renameSync=((from:fs.PathLike,to:fs.PathLike)=>{if(String(to)===path.join(copy.projectPath,'b.cfg'))throw new Error('simulated interrupted second write');return rename(from,to);}) as typeof fs.renameSync;
  try{await assert.rejects(()=>store.apply(copy.projectId,'crash'),/interrupted/);}finally{fs.renameSync=rename;}
  assert.equal(store.preview(copy.projectId,'crash').status,'uncertain');
  await assert.rejects(()=>store.apply(copy.projectId,'crash'),hasCode('RECOVERY_REQUIRED'));
  assert.equal((await store.restore(copy.projectId,'crash')).status,'restored');
  for(const f of ['a.cfg','b.cfg'])assert.equal(fs.readFileSync(path.join(copy.projectPath,f),'utf8'),'width 7\n');
  assert.equal(store.verifySource(copy.projectId),true);
});

function acceptanceFixture(){
  const native=['open_project','recalculate','save','close_project','open_project','bim_configure','bim_generate','bim_export','close_project'].map((action,i)=>({tool:'operation_start',arguments:{action,requestId:'{runId}-'+i,projectId:'{projectId}',...(action==='bim_export'?{outputFile:'test.ifc'}:{})},assertions:[] as {path:string;equals?:unknown;min?:number;closeTo?:number;tolerance?:number}[]}));
  return {sourcePath:'local-source',sourceReviewComplete:true,nativeGeometryReviewComplete:true,steps:[
    {tool:'project_prepare_changes',arguments:{requestId:'{runId}-edit',projectId:'{projectId}'},assertions:[]},
    {tool:'project_apply_changes',arguments:{requestId:'{runId}-edit',projectId:'{projectId}'},assertions:[]},...native.slice(0,5),
    {tool:'alignment_read',arguments:{filePath:'{projectPath}/test.ALI'},assertions:[{path:'elements.0.length',closeTo:100,tolerance:.001}]},...native.slice(5),
    {tool:'ifc_validate',arguments:{filePath:'{projectPath}/test.ifc',geometry:true,expectedSchema:'IFC4X3',requiredPsets:['RCE_clas']},assertions:[{path:'valid',equals:true},{path:'geometry.length',min:1}]}
  ]};
}
test('native acceptance rejects skipped reopen, stale IFC and assertions without engineering evidence',()=>{
  const good=acceptanceFixture();assert.equal(validateScenario(good).steps.length,13);
  assert.throws(()=>validateScenario({...good,steps:good.steps.filter(s=>!('action' in s.arguments)||s.arguments.action!=='close_project')}),hasCode('ACCEPTANCE_SCENARIO_INCOMPLETE'));
  const before=acceptanceFixture();before.steps.unshift(before.steps.pop()!);assert.throws(()=>validateScenario(before),hasCode('ENGINEERING_ASSERTIONS_REQUIRED'));
  const empty=acceptanceFixture();empty.steps.at(-1)!.assertions=[{path:'valid',equals:true}];assert.throws(()=>validateScenario(empty),hasCode('ENGINEERING_ASSERTIONS_REQUIRED'));
  const ids=acceptanceFixture();ids.steps[2]!.arguments.requestId='constant';assert.throws(()=>validateScenario(ids),hasCode('ACCEPTANCE_REQUEST_ID'));
  checkAssertions({length:100,geometry:[{}]},[{path:'length',closeTo:100,tolerance:.001},{path:'geometry.length',min:1}]);
  assert.throws(()=>checkAssertions({length:101},[{path:'length',closeTo:100,tolerance:.001}]),hasCode('ASSERTION_FAILED'));
  assert.throws(()=>checkAssertions({},[{path:'missing',equals:1}]),hasCode('ASSERTION_FAILED'));
});
