import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeWorkerResponse } from '../bridge.js';
import { DomainError } from '../io.js';

test('worker rejections preserve actionable codes and details',()=>{
  for(const method of ['action','idle']){
    assert.throws(()=>decodeWorkerResponse(method,JSON.stringify({ok:false,error:{code:'ADAPTER_REQUIRED',message:'Configure profile',details:{action:'save'}}}),0,''),
      e=>e instanceof DomainError && e.code==='ADAPTER_REQUIRED' && (e.details as {action:string}).action==='save');
  }
});
test('unreadable native outcomes stay uncertain while query protocol errors stay distinct',()=>{
  for(const output of ['not JSON','{}','{"ok":false}','{"ok":true,"result":null}']){
    assert.throws(()=>decodeWorkerResponse('action',output,0,''),e=>e instanceof DomainError && e.code==='OUTCOME_UNCERTAIN');
    assert.throws(()=>decodeWorkerResponse('health',output,0,''),e=>e instanceof DomainError && e.code==='WORKER_PROTOCOL');
  }
  assert.throws(()=>decodeWorkerResponse('action','{"ok":true,"result":{}}',1,''),e=>e instanceof DomainError && e.code==='OUTCOME_UNCERTAIN');
});
