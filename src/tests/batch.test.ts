import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ProjectStore} from '../projects.js';
import {DomainError,hash} from '../io.js';

function fixture(t:TestContext,text:string){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'istram-batch-'));
  t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  const source=path.join(base,'source');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'config.cfg'),text);
  const store=new ProjectStore(path.join(base,'copies'),async()=>{}),copy=store.copy(source);
  return {store,copy,source};
}
test('a 350-element batch previews, applies and restores while preserving the original',async t=>{
  const original=Array.from({length:350},(_,i)=>`item ${i+1} old`).join('\r\n');
  const {store,copy,source}=fixture(t,original),sourceHash=hash(fs.readFileSync(path.join(source,'config.cfg')));
  const elements=Array.from({length:350},(_,i)=>({elementId:String(i+1),changes:[{file:'config.cfg',line:i+1,expected:`item ${i+1} old`,replacement:`item ${i+1} new`}]}));
  const plan=store.prepareBatch(copy.projectId,'batch-350',elements);
  assert.equal(plan.batch!.elements.length,350);
  assert.equal(plan.batch!.uniqueChanges,350);
  assert.equal(fs.readFileSync(path.join(copy.projectPath,'config.cfg'),'utf8'),original);
  assert.equal(store.prepareBatch(copy.projectId,'batch-350',elements).id,plan.id);
  await store.apply(copy.projectId,'batch-350');
  assert.equal(fs.readFileSync(path.join(copy.projectPath,'config.cfg'),'utf8'),original.replace(/ old/g,' new'));
  await store.restore(copy.projectId,'batch-350');
  assert.equal(fs.readFileSync(path.join(copy.projectPath,'config.cfg'),'utf8'),original);
  assert.equal(hash(fs.readFileSync(path.join(source,'config.cfg'))),sourceHash);
});
test('shared-file aliases coalesce identical edits and reject conflicting element requests',async t=>{
  const {store,copy}=fixture(t,'width 7');
  const change={file:'config.cfg',line:1,expected:'width 7',replacement:'width 8'};
  const plan=store.prepareBatch(copy.projectId,'shared',[
    {elementId:'a',changes:[change]},{elementId:'b',changes:[{...change,file:'./config.cfg'}]}
  ]);
  assert.equal(plan.batch!.inputChanges,2);assert.equal(plan.changes.length,1);
  assert.equal(plan.batch!.elements.length,2);
  assert.throws(()=>store.prepareBatch(copy.projectId,'conflict',[
    {elementId:'a',changes:[change]},{elementId:'b',changes:[{...change,replacement:'width 9'}]}
  ]),e=>e instanceof DomainError && e.code==='BATCH_CONFLICT');
  assert.equal(fs.readFileSync(path.join(copy.projectPath,'config.cfg'),'utf8'),'width 7');
  await assert.rejects(()=>store.apply(copy.projectId,'conflict'),e=>e instanceof DomainError && e.code==='PLAN_NOT_FOUND');
});
test('batch preflight rejects stale edits, escapes, binary records and duplicate element IDs',t=>{
  const {store,copy}=fixture(t,'width 7');
  const change={file:'config.cfg',line:1,expected:'width 7',replacement:'width 8'};
  assert.throws(()=>store.prepareBatch(copy.projectId,'stale',[{elementId:'a',changes:[{...change,expected:'width 6'}]}]),/differs/);
  assert.throws(()=>store.prepareBatch(copy.projectId,'escape',[{elementId:'a',changes:[{...change,file:'../config.cfg'}]}]),/leaves/);
  assert.throws(()=>store.prepareBatch(copy.projectId,'duplicate',[{elementId:'a',changes:[change]},{elementId:'a',changes:[change]}]),/unique/);
  fs.writeFileSync(path.join(copy.projectPath,'profiles.per'),Buffer.from([0,1,2,3]));
  assert.throws(()=>store.prepareBatch(copy.projectId,'binary',[{elementId:'a',changes:[{...change,file:'profiles.per'}]}]),/text/);
  assert.equal(fs.readFileSync(path.join(copy.projectPath,'config.cfg'),'utf8'),'width 7');
});
