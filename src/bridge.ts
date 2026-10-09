import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DomainError } from './io.js';

export async function worker(method:string,params:Record<string,unknown>={},timeoutMs=30000):Promise<Record<string,unknown>>{
  const python=process.env.ISTRAM_PYTHON ?? (process.platform==='win32'?'python':'python3');
  const file=fileURLToPath(new URL('../python/worker.py',import.meta.url));
  return new Promise((resolve,reject)=>{
    const child=spawn(python,['-u',file],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:process.env});
    let output='',errors='',done=false;
    const fail=(error:unknown)=>{if(done)return;done=true;clearTimeout(timer);reject(error);};
    const timer=setTimeout(()=>{
      child.kill();fail(new DomainError(method==='action'?'OUTCOME_UNCERTAIN':'WORKER_TIMEOUT','Worker timeout; ISTRAM itself was not terminated'));
    },timeoutMs);
    child.on('error',fail);
    child.stdout.on('data',data=>{output+=String(data);if(output.length>4*1024*1024){child.kill();fail(new DomainError('OUTPUT_LIMIT','Worker output too large'));}});
    child.stderr.on('data',data=>{if(errors.length<4096)errors+=String(data);});
    child.on('close',code=>{
      if(done)return;done=true;clearTimeout(timer);
      try{resolve(decodeWorkerResponse(method,output,code,errors));}
      catch(e){reject(e);}
    });
    child.stdin.end(JSON.stringify({id:crypto.randomUUID(),method,params})+'\n');
  });
}

// Keep an explicit worker rejection distinct from malformed output. Native UI
// failures after a mutation are already reported as OUTCOME_UNCERTAIN by Python.
export function decodeWorkerResponse(method:string,output:string,code:number|null,stderr:string):Record<string,unknown>{
  let response:unknown;
  try{response=JSON.parse(output);}catch{
    throw new DomainError(method==='action'?'OUTCOME_UNCERTAIN':'WORKER_PROTOCOL','Invalid worker response',{exitCode:code,stderr});
  }
  if(!response || typeof response!=='object' || !('ok' in response) || typeof response.ok!=='boolean')
    throw new DomainError(method==='action'?'OUTCOME_UNCERTAIN':'WORKER_PROTOCOL','Invalid worker response envelope',{exitCode:code,stderr});
  if(!response.ok){
    if(!('error' in response) || !response.error || typeof response.error!=='object' ||
      !('code' in response.error) || typeof response.error.code!=='string' ||
      !('message' in response.error) || typeof response.error.message!=='string')
      throw new DomainError(method==='action'?'OUTCOME_UNCERTAIN':'WORKER_PROTOCOL','Invalid worker error envelope',{exitCode:code,stderr});
    throw new DomainError(response.error.code,response.error.message,'details' in response.error?response.error.details:undefined);
  }
  if(code!==0)throw new DomainError(method==='action'?'OUTCOME_UNCERTAIN':'WORKER_FAILED','Worker exit '+code);
  if(!('result' in response) || !response.result || typeof response.result!=='object' || Array.isArray(response.result))
    throw new DomainError(method==='action'?'OUTCOME_UNCERTAIN':'WORKER_PROTOCOL','Invalid worker result envelope',{exitCode:code,stderr});
  return response.result as Record<string,unknown>;
}
