import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readDocument, encodeDocument, safeChild, hash } from '../io.js';
import { detectIstramEnvironment, readIfcMappings } from '../config.js';
import { parseAliContent, parseRasContent } from '../parsers.js';
import { inspectProjectDirectory, ProjectStore } from '../projects.js';
import { Jobs } from '../jobs.js';

function fixture(t:TestContext){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'istram-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;
}
test('preserves cp1252, CRLF and UTF8 BOM roundtrip',t=>{
  const root=fixture(t),file=path.join(root,'text.cfg');
  for(const bytes of [Buffer.from([35,32,233,13,10]),Buffer.concat([Buffer.from([239,187,191]),Buffer.from('é\r\n')])]){
    fs.writeFileSync(file,bytes);const doc=readDocument(file);
    assert.deepEqual(encodeDocument(doc.text,doc),bytes);
  }
});
test('invalid numbers never become zero and origin needs a scalar row',()=>{
  assert.throws(()=>parseAliContent('0\n1 BAD 2 3 4 5 6 7'),/numeric/);
  const result=parseAliContent('# test\n12.5\n1 10 1 2 3 4 5 6\nnot implemented');
  assert.equal(result.header.originStationPk,12.5);assert.equal(result.elements.length,1);assert.equal(result.unknown.length,1);
  assert.throws(()=>parseAliContent('1 10 1 2 3 4 5 6'),/origin/);
  assert.throws(()=>parseRasContent('VER 1107\n0 1 0 NaN 20 30 2 100'),/numeric/);
});
test('version is evidence from latest observed run, never a constant or license claim',t=>{
  const root=fixture(t);fs.writeFileSync(path.join(root,'Istram.exe'),'fake');
  assert.equal(detectIstramEnvironment(root).version,null);
  fs.writeFileSync(path.join(root,'IstramActivity.log'),'2026/01/01 00:00:00 versión= 25.01.02.03 64 bits\n2026/02/01 00:00:00 versión= 26.02.03.04 64 bits\n');
  const env=detectIstramEnvironment(root);
  assert.equal(env.version,'26.02.03.04 (64-bit)');
  assert.equal(env.versionEvidence?.currentBinaryVerified,false);
  assert.equal(env.licensedModules.status,'unknown');
});
test('IFC mapping reads all rows and reports entities without treating data as headers',t=>{
  const root=fixture(t);fs.mkdirSync(path.join(root,'lib'));
  fs.writeFileSync(path.join(root,'lib','istram2ifc4x3.csv'),'VIGA;IfcBeam\nPILAR;IfcColumn\n');
  fs.writeFileSync(path.join(root,'lib','tiposEntidadesIFC.csv'),'IfcRoad;IfcAlignment\nIfcCourse\n');
  const result=readIfcMappings(root);assert.equal(result.mappings.length,2);assert.equal(result.classes.length,5);
});
test('project resolves axes through .pol rather than counting temporary ALI files',t=>{
  const root=fixture(t);
  fs.writeFileSync(path.join(root,'road.pol'),'r 1034\nTP Synthetic road\nCEJ 10 road.cej\nVOL 1 missing.vol\n');
  fs.writeFileSync(path.join(root,'road.cej'),'EJE 1 0 2 Main Road\nEJE 2 100 1 Ramp\n');
  const result=inspectProjectDirectory(root);
  assert.equal(result.projects[0]?.axes.length,2);assert.equal(result.warnings.length,1);
});
test('path escapes and symbolic links are refused',t=>{
  const root=fixture(t);
  assert.throws(()=>safeChild(root,'../outside'),/leaves/);
  assert.throws(()=>safeChild(root,path.resolve(root,'abs')),/relative/);
  if(process.platform!=='win32'){
    fs.symlinkSync(os.tmpdir(),path.join(root,'linked'));
    assert.throws(()=>safeChild(root,'linked/test'),/symbolic/);
  }
});
test('copy edit verify idempotency restore and original hashes',async t=>{
  const base=fixture(t),source=path.join(base,'source'),workspace=path.join(base,'work');
  fs.mkdirSync(source);fs.writeFileSync(path.join(source,'road.cfg'),'width 7\r\n# é\r\n');
  const original=hash(fs.readFileSync(path.join(source,'road.cfg')));
  const store=new ProjectStore(workspace,async()=>{});
  const copy=store.copy(source),change={file:'road.cfg',line:1,expected:'width 7',replacement:'width 8'};
  const first=store.prepare(copy.projectId,'request',[change]);
  assert.equal(store.prepare(copy.projectId,'request',[change]).id,first.id);
  assert.throws(()=>store.prepare(copy.projectId,'request',[{...change,replacement:'width 9'}]),/different/);
  assert.equal((await store.apply(copy.projectId,'request')).status,'applied');
  assert.equal((await store.apply(copy.projectId,'request')).status,'applied');
  assert.equal(fs.readFileSync(path.join(copy.projectPath,'road.cfg'),'utf8'),'width 8\r\n# é\r\n');
  assert.equal((await store.restore(copy.projectId,'request')).status,'restored');
  assert.equal(hash(fs.readFileSync(path.join(source,'road.cfg'))),original);
  assert.equal(store.verifySource(copy.projectId),true);
});
test('concurrent edits and stale expected content fail without changing files',async t=>{
  const base=fixture(t),source=path.join(base,'source');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'road.cfg'),'width 7\n');
  const store=new ProjectStore(path.join(base,'work'),async()=>{}),copy=store.copy(source);
  assert.throws(()=>store.prepare(copy.projectId,'bad',[{file:'road.cfg',line:1,expected:'width 6',replacement:'width 8'}]),/differs/);
  store.prepare(copy.projectId,'a',[{file:'road.cfg',line:1,expected:'width 7',replacement:'width 8'}]);
  fs.writeFileSync(path.join(copy.projectPath,'road.cfg'),'width 9\n');
  await assert.rejects(()=>store.apply(copy.projectId,'a'),/changed/);
  assert.equal(fs.readFileSync(path.join(copy.projectPath,'road.cfg'),'utf8'),'width 9\n');
});
test('unverified adapter prevents actual writes',async t=>{
  const base=fixture(t),source=path.join(base,'source');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'road.cfg'),'width 7');
  const store=new ProjectStore(path.join(base,'work')),copy=store.copy(source);
  store.prepare(copy.projectId,'request',[{file:'road.cfg',line:1,expected:'width 7',replacement:'width 8'}]);
  await assert.rejects(()=>store.apply(copy.projectId,'request'),/verified/);
});
test('durable jobs deduplicate requests, serialize and preserve uncertain outcomes',async t=>{
  const jobs=new Jobs(path.join(fixture(t),'jobs'));
  let calls=0;
  const job=jobs.start('req',{a:1},'session',async()=>{calls++;return 'ok';});
  assert.equal(jobs.start('req',{a:1},'session',async()=>{calls++;}).id,job.id);
  assert.throws(()=>jobs.start('other',{},'session',async()=>{}),/running/);
  assert.throws(()=>jobs.start('req',{a:2},'session',async()=>{}),/different/);
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(jobs.get(job.id).state,'completed');assert.equal(calls,1);
});
