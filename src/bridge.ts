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
      try{
        const response=JSON.parse(output);
        if(!response.ok)reject(new DomainError(response.error.code,response.error.message,response.error.details));
        else if(code!==0)reject(new DomainError('WORKER_FAILED','Worker exit '+code));
        else resolve(response.result);
      }catch(e){reject(new DomainError(method==='action'?'OUTCOME_UNCERTAIN':'WORKER_PROTOCOL','Invalid worker response',{exitCode:code,stderr:errors}));}
    });
    child.stdin.end(JSON.stringify({id:crypto.randomUUID(),method,params})+'\n');
  });
}
