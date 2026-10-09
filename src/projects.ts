import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicJson, DomainError, encodeDocument, hash, readDocument, safeChild, walk, within } from './io.js';
import { parseNativeContent } from './parsers.js';

export function inspectProjectDirectory(projectPath:string) {
  const root=fs.realpathSync(projectPath), files=walk(root);
  const ext=(suffix:string)=>files.filter(f=>f.toLowerCase().endsWith(suffix));
  const projects=ext('.pol').map(file=>{
    const doc=readDocument(path.join(root,file)),records=parseNativeContent(doc.text);
    const refs=records.flatMap(record=>{
      if(!['CEJ','VOL','VOLV','PER','PERV','DT','TOP','EDM'].includes(record.tag))return[];
      const names=record.values.filter(v=>/\.(cej|vol|per|edm|top|ttp|toc|dtv|dof)$/i.test(v));
      return names.map(name=>{
        const absolute=path.resolve(path.dirname(path.join(root,file)),name);
        return {tag:record.tag,file:name,exists:fs.existsSync(absolute),external:!within(root,absolute)};
      });
    });
    const axisFiles=refs.filter(r=>r.tag==='CEJ'&&r.exists&&!r.external).map(r=>path.resolve(path.dirname(path.join(root,file)),r.file));
    const axes=axisFiles.flatMap(f=>parseNativeContent(readDocument(f).text).filter(r=>r.tag==='EJE').map(r=>({
      id:r.values[0],initialStation:r.values[1],title:r.values.slice(3).join(' '),source:path.relative(root,f)})));
    return {file,title:records.find(r=>r.tag==='TP')?.values.join(' ')??'',references:refs,axes,sha256:doc.sha256};
  });
  const grouped=new Map<string,{file:string;missing:boolean;external:boolean;occurrences:{project:string;tag:string}[]}>();
  for(const p of projects)for(const r of p.references.filter(r=>!r.exists||r.external)){
    const absolute=path.resolve(root,path.dirname(p.file),r.file),key=process.platform==='win32'?absolute.toLowerCase():absolute;
    const warning=grouped.get(key)??{file:r.file,missing:!r.exists,external:r.external,occurrences:[]};
    warning.occurrences.push({project:p.file,tag:r.tag});grouped.set(key,warning);
  }
  const dependencyWarnings=[...grouped.values()];
  return {projectDir:root,filesCount:files.length,alignmentsCount:ext('.ali').length,profilesCount:ext('.ras').length,
    hasIfc:ext('.ifc').length>0,projects,nativeFiles:{cej:ext('.cej'),vol:ext('.vol'),per:ext('.per')},
    dependencyWarnings,warnings:dependencyWarnings.map(r=>(r.missing?'Missing reference: ':'External reference: ')+r.file+' ('+r.occurrences.length+' occurrences)')};
}
export type Change={file:string;line:number;expected:string;replacement:string};
export type BatchElement={elementId:string;changes:Change[]};
type BatchSummary={elements:{elementId:string;targets:{file:string;line:number}[]}[];inputChanges:number;uniqueChanges:number;filesCount:number};
type Plan={id:string;requestId:string;fingerprint:string;status:'prepared'|'applied'|'restored'|'uncertain';changes:Change[];
  before:Record<string,string>;after:Record<string,string>;createdAt:string;batch?:BatchSummary};
export class ProjectStore {
  constructor(public workspace:string,private assertIdle:(changes?:Change[],root?:string)=>Promise<void>=async()=>{throw new DomainError('ADAPTER_REQUIRED','Native writes require a verified Windows adapter');}) {
    fs.mkdirSync(workspace,{recursive:true});this.workspace=fs.realpathSync(workspace);
  }
  private project(id:string){
    if(!/^[a-f0-9-]{36}$/.test(id))throw new DomainError('INVALID_PROJECT_ID','Invalid project ID');
    const root=safeChild(this.workspace,id);
    if(!fs.existsSync(path.join(root,'.istram-mcp','copy.json')))throw new DomainError('NOT_MANAGED_COPY','Expected a managed copy');
    return root;
  }
  copy(source:string,excludeDirectories:string[]=[]){
    if(excludeDirectories.length>10 || excludeDirectories.some(d=>!d || d==='.' || d==='..' || /[\\/:]/.test(d)))
      throw new DomainError('INVALID_EXCLUSION','Expected at most 10 top-level directory names');
    const original=fs.realpathSync(source);
    if(within(original,this.workspace)||within(this.workspace,original))throw new DomainError('OVERLAPPING_PATHS','Source and workspace must be disjoint');
    const excluded=new Set(excludeDirectories.map(d=>process.platform==='win32'?d.toLowerCase():d));
    const excludedEntries=fs.readdirSync(original,{withFileTypes:true}).filter(e=>excluded.has(process.platform==='win32'?e.name.toLowerCase():e.name));
    if(excludedEntries.some(e=>e.isFile()))throw new DomainError('INVALID_EXCLUSION','Only top-level directories can be excluded');
    const excludedDirectoriesPresent=excludedEntries.map(e=>e.name);
    const list=walk(original,25000,excluded),id=randomUUID(),root=path.join(this.workspace,id);
    fs.mkdirSync(root,{recursive:false});
    const inventory:Record<string,string>={};
    try{
      for(const file of list){
        const from=safeChild(original,file),to=safeChild(root,file);
        fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
        const bytes=fs.readFileSync(from);inventory[file]=hash(bytes);
        if(hash(fs.readFileSync(to))!==inventory[file])throw new DomainError('COPY_MISMATCH','Source changed during copy');
      }
      atomicJson(path.join(root,'.istram-mcp','copy.json'),{id,source:original,createdAt:new Date().toISOString(),inventory,excludeDirectories,excludedDirectoriesPresent,excludedFilesCount:excludedDirectoriesPresent.length?null:0});
      return {projectId:id,projectPath:root,filesCount:list.length,excludeDirectories,excludedDirectoriesPresent,excludedFilesCount:excludedDirectoriesPresent.length?null:0,
        verificationScope:'copied_files_only',sourceUnchangedVerified:this.verifySource(id),
        warning:'Disk snapshot only; unsaved session data and explicitly excluded directories are not copied.'};
    }catch(e){throw new DomainError('COPY_FAILED','Partial copy retained for inspection; it is not a managed copy',{projectId:id,root,cause:String(e)});}
  }
  path(id:string){return this.project(id);}
  verifySource(id:string){
    const meta=JSON.parse(fs.readFileSync(path.join(this.project(id),'.istram-mcp','copy.json'),'utf8'));
    return Object.entries(meta.inventory as Record<string,string>).every(([f,h])=>{
      const file=safeChild(meta.source,f);return fs.existsSync(file)&&hash(fs.readFileSync(file))===h;
    });
  }
  prepareBatch(id:string,requestId:string,elements:BatchElement[]){
    if(!elements.length || elements.length>1000)throw new DomainError('BATCH_LIMIT','Expected 1 to 1000 elements');
    const count=elements.reduce((n,e)=>n+e.changes.length,0);
    if(count>10000)throw new DomainError('BATCH_LIMIT','Batch exceeds 10000 input changes');
    const root=this.project(id),seenIds=new Set<string>();
    const unique=new Map<string,Change>();
    const manifest:BatchSummary['elements']=[];
    for(const element of elements){
      if(!element.elementId || seenIds.has(element.elementId))throw new DomainError('DUPLICATE_ELEMENT','Element IDs must be nonempty and unique');
      if(!element.changes.length)throw new DomainError('EMPTY_ELEMENT','Each element needs an explicit reviewed change');
      seenIds.add(element.elementId);
      const targets:{file:string;line:number}[]=[];
      for(const input of element.changes){
        const absolute=fs.realpathSync(safeChild(root,input.file));
        const file=path.relative(root,absolute),canonical=process.platform==='win32'?absolute.toLowerCase():absolute;
        const key=canonical+':'+input.line,change={...input,file};
        const previous=unique.get(key);
        if(previous && (previous.expected!==change.expected || previous.replacement!==change.replacement))
          throw new DomainError('BATCH_CONFLICT','Elements request incompatible changes to a shared file',{file,line:input.line,elementId:element.elementId});
        if(!previous)unique.set(key,change);
        targets.push({file:previous?.file??file,line:input.line});
      }
      manifest.push({elementId:element.elementId,targets});
    }
    const changes=[...unique.values()];
    return this.prepare(id,requestId,changes,{elements:manifest,inputChanges:count,uniqueChanges:changes.length,filesCount:new Set(changes.map(c=>c.file)).size});
  }
  prepare(id:string,requestId:string,changes:Change[],batch?:BatchSummary){
    const root=this.project(id),dir=path.join(root,'.istram-mcp','plans');
    const fingerprint=hash(JSON.stringify(batch?{changes,batch}:changes)),key=hash(requestId),file=path.join(dir,key+'.json');
    if(fs.existsSync(file)){
      const existing=JSON.parse(fs.readFileSync(file,'utf8')) as Plan;
      if(existing.fingerprint!==fingerprint)throw new DomainError('IDEMPOTENCY_CONFLICT','Request ID already has different changes');
      return existing;
    }
    const seen=new Set<string>(),before:Record<string,string>={},after:Record<string,string>={};
    for(const change of changes){
      if(!/\.(cfg|csv|ali|ras|cej|vol|per|pol|beg|atf|act)$/i.test(change.file))
        throw new DomainError('UNSUPPORTED_FORMAT','Unsupported writable file extension');
      if(/[\r\n]/.test(change.replacement))throw new DomainError('MULTILINE_PATCH','A change must replace exactly one line');
      if(!Number.isInteger(change.line)||change.line<1)throw new DomainError('INVALID_LINE','Expected one-based line number');
      const k=change.file+':'+change.line;
      if(seen.has(k))throw new DomainError('DUPLICATE_CHANGE','Multiple changes target the same line');seen.add(k);
    }
    for(const relative of [...new Set(changes.map(c=>c.file))]){
      const doc=readDocument(safeChild(root,relative)),lines=doc.text.split(/(\r\n|\n|\r)/);
      before[relative]=doc.sha256;
      for(const change of changes.filter(c=>c.file===relative)){
        const position=(change.line-1)*2;
        if(lines[position]!==change.expected)throw new DomainError('STALE_EDIT','Expected line differs',{file:relative,line:change.line});
        lines[position]=change.replacement;
      }
      after[relative]=hash(encodeDocument(lines.join(''),doc));
    }
    const plan:Plan={id:key,requestId,fingerprint,status:'prepared',changes,before,after,createdAt:new Date().toISOString(),...(batch?{batch}:{})};
    atomicJson(file,plan);return {...plan,warning:'Prepared changes are not geometry-validated or recalculated. Apply requires verified adapter.'};
  }
  private plan(id:string,requestId:string){
    const root=this.project(id),file=path.join(root,'.istram-mcp','plans',hash(requestId)+'.json');
    if(!fs.existsSync(file))throw new DomainError('PLAN_NOT_FOUND','No prepared changes for request ID');
    return {root,file,plan:JSON.parse(fs.readFileSync(file,'utf8')) as Plan};
  }
  preview(id:string,requestId:string,offset=0,limit=100){
    const {plan}=this.plan(id,requestId);
    return {id:plan.id,requestId:plan.requestId,fingerprint:plan.fingerprint,status:plan.status,
      totalChanges:plan.changes.length,offset,limit,changes:plan.changes.slice(offset,offset+limit),
      totalFiles:Object.keys(plan.before).length,files:Object.keys(plan.before).slice(offset,offset+limit).map(file=>({file,beforeSha256:plan.before[file],afterSha256:plan.after[file]})),
      batch:plan.batch?{elementsCount:plan.batch.elements.length,inputChanges:plan.batch.inputChanges,uniqueChanges:plan.batch.uniqueChanges,filesCount:plan.batch.filesCount}:undefined,
      nativeRecalculated:false};
  }
  private lock(root:string){
    const file=path.join(root,'.istram-mcp','write.lock');
    try{const fd=fs.openSync(file,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid,time:new Date().toISOString()}));fs.closeSync(fd);}
    catch{throw new DomainError('PROJECT_LOCKED','Project locked; inspect journal before recovery');}
    return ()=>fs.unlinkSync(file);
  }
  async apply(id:string,requestId:string){
    const {root,file,plan}=this.plan(id,requestId);
    const release=this.lock(root);
    try{
      if(plan.status==='applied'){
        if(!Object.entries(plan.after).every(([f,h])=>hash(fs.readFileSync(safeChild(root,f)))===h))throw new DomainError('OUTCOME_CHANGED','Previously applied files have changed');
        return plan;
      }
      if(plan.status!=='prepared')throw new DomainError('RECOVERY_REQUIRED','Inspect outcome before retry');
      await this.assertIdle(plan.changes,root);
      for(const [relative,expectedHash] of Object.entries(plan.before)){
        if(hash(fs.readFileSync(safeChild(root,relative)))!==expectedHash)throw new DomainError('STALE_EDIT','File changed after preparation');
      }
      plan.status='uncertain';atomicJson(file,plan);
      const stage:{target:string;temp:string;backup:string;bytes:Buffer}[]=[];
      for(const relative of Object.keys(plan.before)){
        const target=safeChild(root,relative),doc=readDocument(target);
        if(doc.sha256!==plan.before[relative])throw new DomainError('STALE_EDIT','File changed after preparation');
        const backup=path.join(root,'.istram-mcp','backups',plan.id,relative);
        fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,doc.bytes,{flag:'wx'});
        const lines=doc.text.split(/(\r\n|\n|\r)/);
        for(const c of plan.changes.filter(c=>c.file===relative))lines[(c.line-1)*2]=c.replacement;
        const bytes=encodeDocument(lines.join(''),doc),temp=target+'.'+plan.id+'.tmp';
        fs.writeFileSync(temp,bytes,{flag:'wx'});stage.push({target,temp,backup,bytes});
      }
      for(const item of stage)fs.renameSync(item.temp,item.target);
      if(!Object.entries(plan.after).every(([f,h])=>hash(fs.readFileSync(safeChild(root,f)))===h))
        throw new DomainError('VERIFY_FAILED','Write hash verification failed');
      plan.status='applied';atomicJson(file,plan);return plan;
    }finally{release();}
  }
  async restore(id:string,requestId:string){
    const {root,file,plan}=this.plan(id,requestId),release=this.lock(root);
    try{
      if(plan.status==='restored')return plan;
      if(!['uncertain','applied'].includes(plan.status))throw new DomainError('NO_BACKUP','No applied change to restore');
      await this.assertIdle(plan.changes,root);
      const entries=Object.entries(plan.before);
      for(const [relative,beforeHash] of entries){
        const target=safeChild(root,relative),current=hash(fs.readFileSync(target));
        if(current!==beforeHash&&current!==plan.after[relative])throw new DomainError('RESTORE_CONFLICT','Copy has newer edits; restore refused');
        const backup=path.join(root,'.istram-mcp','backups',plan.id,relative);
        if(!fs.existsSync(backup)&&current===beforeHash)continue;
        if(hash(fs.readFileSync(backup))!==beforeHash)throw new DomainError('CORRUPT_BACKUP','Backup hash mismatch');
      }
      plan.status='uncertain';atomicJson(file,plan);
      for(const [relative,beforeHash] of entries){
        const target=safeChild(root,relative),temp=target+'.'+randomUUID()+'.restore.tmp';
        if(hash(fs.readFileSync(target))===beforeHash)continue;
        fs.copyFileSync(path.join(root,'.istram-mcp','backups',plan.id,relative),temp,fs.constants.COPYFILE_EXCL);fs.renameSync(temp,target);
      }
      if(!entries.every(([relative,beforeHash])=>hash(fs.readFileSync(safeChild(root,relative)))===beforeHash))
        throw new DomainError('VERIFY_FAILED','Restored file hashes differ from the original plan');
      plan.status='restored';atomicJson(file,plan);return plan;
    }finally{release();}
  }
}
