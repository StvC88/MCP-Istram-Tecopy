import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicJson, DomainError, hash } from './io.js';
type State='pending'|'running'|'completed'|'failed'|'uncertain'|'cancelled';
export type Job={id:string;requestKey:string;fingerprint:string;state:State;createdAt:string;ownerPid?:number;finishedAt?:string;result?:unknown;error?:string};
export class Jobs{
  private running=new Set<string>();
  constructor(private dir:string){
    fs.mkdirSync(dir,{recursive:true});
    for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.json'))){
      const file=path.join(dir,name),job=JSON.parse(fs.readFileSync(file,'utf8')) as Job;
      let alive=false;try{if(job.ownerPid){process.kill(job.ownerPid,0);alive=true;}}catch{}
      if(alive)continue;
      if(job.state==='running'){job.state='uncertain';job.error='Server restarted during execution; verify before retry';atomicJson(file,job);}
      else if(job.state==='pending'){job.state='cancelled';job.error='Server restarted before execution';atomicJson(file,job);}
    }
  }
  private file(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new DomainError('INVALID_JOB_ID','Invalid job ID');return path.join(this.dir,id+'.json');}
  get(id:string):Job{return JSON.parse(fs.readFileSync(this.file(id),'utf8'));}
  start(requestKey:string,input:unknown,resource:string,run:()=>Promise<unknown>){
    const fingerprint=hash(JSON.stringify(input));
    for(const name of fs.readdirSync(this.dir).filter(n=>n.endsWith('.json'))){
      const job=JSON.parse(fs.readFileSync(path.join(this.dir,name),'utf8')) as Job;
      if(job.requestKey===requestKey){
        if(job.fingerprint!==fingerprint)throw new DomainError('IDEMPOTENCY_CONFLICT','Request ID reused for a different operation');
        return job;
      }
    }
    if(this.running.has(resource))throw new DomainError('SESSION_BUSY','Another operation is running');
    const lock=path.join(this.dir,hash(resource)+'.lock');
    try{fs.writeFileSync(lock,JSON.stringify({pid:process.pid,resource}),{flag:'wx'});}
    catch{throw new DomainError('SESSION_BUSY','Session lock exists; verify native outcome before recovery');}
    const job:Job={id:randomUUID(),requestKey,fingerprint,state:'pending',createdAt:new Date().toISOString(),ownerPid:process.pid};
    atomicJson(this.file(job.id),job);this.running.add(resource);
    setImmediate(async()=>{
      const current=this.get(job.id);
      if(current.state==='cancelled'){this.running.delete(resource);fs.unlinkSync(lock);return;}
      job.state='running';atomicJson(this.file(job.id),job);
      try{job.result=await run();job.state='completed';}
      catch(e){job.state=e instanceof DomainError&&e.code==='OUTCOME_UNCERTAIN'?'uncertain':'failed';job.error=String(e);}
      finally{job.finishedAt=new Date().toISOString();atomicJson(this.file(job.id),job);this.running.delete(resource);fs.unlinkSync(lock);}
    });
    return job;
  }
  cancel(id:string){
    const job=this.get(id);
    if(job.state==='pending'){job.state='cancelled';atomicJson(this.file(id),job);}
    else if(job.state==='running')throw new DomainError('UNSAFE_CANCEL','Running native operation cannot be force-stopped; inspect and wait');
    return job;
  }
}
