import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicJson, DomainError, hash } from './io.js';
type State='pending'|'running'|'completed'|'failed'|'uncertain'|'cancelled';
export type JobError={code:string;message:string;details?:unknown};
export type Job={id:string;requestKey:string;fingerprint:string;state:State;createdAt:string;ownerPid?:number;finishedAt?:string;result?:unknown;error?:JobError|string};
export class Jobs{
  private running=new Set<string>();
  constructor(private dir:string){
    fs.mkdirSync(dir,{recursive:true});
    for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.json'))){
      const file=path.join(dir,name),job=JSON.parse(fs.readFileSync(file,'utf8')) as Job;
      let alive=false;try{if(job.ownerPid){process.kill(job.ownerPid,0);alive=true;}}catch{}
      if(alive)continue;
      if(job.state==='running'){job.state='uncertain';job.error={code:'OUTCOME_UNCERTAIN',message:'Server restarted during execution; verify before retry'};atomicJson(file,job);}
      else if(job.state==='pending'){job.state='cancelled';job.error={code:'CANCELLED_BEFORE_START',message:'Server restarted before execution'};atomicJson(file,job);}
    }
  }
  private file(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new DomainError('INVALID_JOB_ID','Invalid job ID');return path.join(this.dir,id+'.json');}
  get(id:string):Job{
    let job:Job;
    try{job=JSON.parse(fs.readFileSync(this.file(id),'utf8'));}
    catch(e){
      if((e as NodeJS.ErrnoException).code==='ENOENT')throw new DomainError('OPERATION_NOT_FOUND','No operation exists for this identifier',{operationId:id});
      throw e;
    }
    // Old journals remain readable without presenting a text error as structured evidence.
    if(typeof job.error==='string')job.error={code:'LEGACY_ERROR',message:job.error};
    return job;
  }
  start(requestKey:string,input:unknown,resource:string,run:()=>Promise<unknown>){
    const fingerprint=hash(JSON.stringify(input));
    for(const name of fs.readdirSync(this.dir).filter(n=>n.endsWith('.json'))){
      const job=JSON.parse(fs.readFileSync(path.join(this.dir,name),'utf8')) as Job;
      if(job.requestKey===requestKey){
        if(job.fingerprint!==fingerprint)throw new DomainError('IDEMPOTENCY_CONFLICT','Request ID reused for a different operation');
        return this.get(job.id);
      }
    }
    if(this.running.has(resource))throw new DomainError('SESSION_BUSY','Another operation is running');
    const lock=path.join(this.dir,hash(resource)+'.lock');
    try{fs.writeFileSync(lock,JSON.stringify({pid:process.pid,resource}),{flag:'wx'});}
    catch{throw new DomainError('SESSION_BUSY','Session lock exists; verify native outcome before recovery');}
    const job:Job={id:randomUUID(),requestKey,fingerprint,state:'pending',createdAt:new Date().toISOString(),ownerPid:process.pid};
    try{atomicJson(this.file(job.id),job);}catch(e){fs.unlinkSync(lock);throw e;}this.running.add(resource);
    setImmediate(async()=>{
      let nativeStarted=false,journalPersisted=false;
      try{
        if(this.get(job.id).state==='cancelled'){journalPersisted=true;return;}
        job.state='running';atomicJson(this.file(job.id),job);
        nativeStarted=true;
        try{job.result=await run();job.state='completed';}
        catch(e){job.state=e instanceof DomainError&&e.code==='OUTCOME_UNCERTAIN'?'uncertain':'failed';job.error={code:e instanceof DomainError?e.code:'EXECUTION_FAILED',message:e instanceof Error?e.message:String(e),...(e instanceof DomainError&&e.details!==undefined?{details:e.details}:{})};}
        job.finishedAt=new Date().toISOString();atomicJson(this.file(job.id),job);journalPersisted=true;
      }catch(e){
        job.state=nativeStarted?'uncertain':'failed';job.finishedAt=new Date().toISOString();
        job.error={code:nativeStarted?'OUTCOME_UNCERTAIN':'JOURNAL_WRITE_FAILED',message:'Operation journal failed; inspect before retry'};
        try{atomicJson(this.file(job.id),job);journalPersisted=true;}catch{console.error('Operation journal unavailable; native session lock retained');}
      }finally{
        if(journalPersisted){this.running.delete(resource);try{fs.unlinkSync(lock);}catch{console.error('Native session lock could not be released');}}
      }
    });
    return job;
  }
  cancel(id:string){
    const job=this.get(id);
    if(job.state==='pending'){job.state='cancelled';job.finishedAt=new Date().toISOString();atomicJson(this.file(id),job);}
    else if(job.state==='running')throw new DomainError('UNSAFE_CANCEL','Running native operation cannot be force-stopped; inspect and wait');
    return job;
  }
}
