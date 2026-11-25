import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicJson, DomainError, encodeDocument, hash, readDocument, safeChild, walk, within } from './io.js';
import { parseNativeContent } from './parsers.js';

type InspectionOptions = {projectFile?: string; summary?: boolean; includeTemporary?: boolean; offset?: number; limit?: number};
const isTemporaryProjectFile = (file: string) => file.split(path.sep).slice(0,-1)
  .some(directory => ['tmp', 'res'].includes(directory.toLowerCase()));

export function inspectProjectDirectory(projectPath:string, options: InspectionOptions = {}) {
  const root=fs.realpathSync(projectPath), files=walk(root);
  const ext=(suffix:string)=>files.filter(f=>f.toLowerCase().endsWith(suffix));
  const selected = options.projectFile === undefined ? undefined : path.relative(root, safeChild(root, options.projectFile));
  const keyFor = (file: string) => process.platform === 'win32' ? file.toLowerCase() : file;
  const knownFiles = new Set(files.map(keyFor));
  const allPols = ext('.pol');
  const pols = allPols.filter(file => selected !== undefined ? keyFor(file) === keyFor(selected) :
    (options.includeTemporary ?? !options.summary) || !isTemporaryProjectFile(file));
  if (selected !== undefined && !pols.length) throw new DomainError('POL_NOT_FOUND', 'Select an existing .pol under projectPath');
  const persistedBim = files.flatMap(file => {
    const match = /^ISPOL(\d+)\.b1m$/i.exec(path.basename(file));
    if (!match || isTemporaryProjectFile(file)) return [];
    return [{axisId: Number(match[1]), file, bytes: fs.statSync(path.join(root, file)).size}];
  });
  const terrainCandidates = files.filter(file => !isTemporaryProjectFile(file) && /\.(edm|edb|sup|ttp|ttg)$/i.test(file));
  const offset = options.offset ?? 0, limit = options.limit ?? 10;
  const projects=(options.summary ? pols.slice(offset, offset + limit) : pols).map(file=>{
    const doc=readDocument(path.join(root,file)),records=parseNativeContent(doc.text);
    const projectFolder = path.dirname(path.join(root, file));
    const resolveReference = (tag: string, name: string, directory: string, source: string, line: number) => {
      const absolute = path.resolve(directory, name);
      const external = !within(root, absolute);
      const exists = external ? fs.existsSync(absolute) : knownFiles.has(keyFor(path.relative(root, absolute)));
      const candidates = [path.resolve(root, name)];
      if (['DAR','DAF'].includes(tag)) candidates.unshift(path.resolve(projectFolder, 'lib', name));
      if (['DAR','DAF'].includes(tag)) candidates.push(path.resolve(root, 'lib', name));
      const match = !exists && !external ? candidates.find(candidate =>
        within(root, candidate) && knownFiles.has(keyFor(path.relative(root, candidate)))) : undefined;
      return {tag, file:name, exists, external, candidate: match && path.relative(root, match), source, line};
    };
    const refs=records.flatMap(record=>{
      if(!['CEJ','VOL','VOLV','PER','PERV','DT','TOP','EDM','DAR','DAF'].includes(record.tag))return[];
      const names=record.tag === 'EDM' && /\.(edm|edb)$/i.test(record.values.join(' '))
        ? [record.values.join(' ')]
        : record.values.filter(v=>/\.(cej|vol|per|edm|edb|top|ttp|toc|dtv|dof|dar)$/i.test(v));
      return names.map(name=>resolveReference(record.tag,name,projectFolder,file,record.line));
    });
    const volumeFiles = new Set(refs.filter(ref=>['VOL','VOLV'].includes(ref.tag) && !ref.external)
      .flatMap(ref=>ref.exists ? [path.resolve(projectFolder,ref.file)] : ref.candidate ? [path.join(root,ref.candidate)] : []));
    const missingOrUnreadableVolumeFiles: string[] = [];
    for (const volume of volumeFiles) {
      const relative = path.relative(root, volume);
      try {
        for (const record of parseNativeContent(readDocument(volume).text)) {
          const name = record.values[2];
          if (record.tag === 'L' && name && /\.lon$/i.test(name)) {
            refs.push(resolveReference('LON', name, path.dirname(volume), relative, record.line));
          }
        }
      } catch (error) {
        if (!(error instanceof DomainError) || !['BINARY_FILE','FILE_TOO_LARGE'].includes(error.code)) throw error;
        missingOrUnreadableVolumeFiles.push(relative);
      }
    }
    const axisFiles=refs.filter(r=>r.tag==='CEJ'&&r.exists&&!r.external).map(r=>path.resolve(path.dirname(path.join(root,file)),r.file));
    const axes=axisFiles.flatMap(f=>parseNativeContent(readDocument(f).text).filter(r=>r.tag==='EJE').map(r=>({
      id:r.values[0],initialStation:r.values[1],title:r.values.slice(3).join(' '),source:path.relative(root,f)})));
    const axisIds = new Set(axes.map(axis => Number(axis.id)));
    const alzadoAxisIds = [...new Set(records.filter(record => record.tag === 'ALZ')
      .map(record => Number(record.values[1])).filter(id => axisIds.has(id)))].sort((a,b)=>a-b);
    const bim = persistedBim.filter(item =>
      [path.dirname(file), '.'].includes(path.dirname(item.file)) && axisIds.has(item.axisId));
    const cachedAxisIds = new Set(bim.filter(item => item.bytes > 0).map(item => item.axisId));
    const modelLoadEvidence = {
      alzadoAxisIds, persistedBim: bim, terrainCandidates, unreadableVolumeFiles: missingOrUnreadableVolumeFiles,
      alzadoAxisIdsWithoutNonemptyBim: alzadoAxisIds.filter(id => !cachedAxisIds.has(id)),
      liveTreeVerified: false
    };
    return {file,projectDirectory:projectFolder,title:records.find(r=>r.tag==='TP')?.values.join(' ')??'',references:refs,axes,modelLoadEvidence,sha256:doc.sha256};
  });
  const grouped=new Map<string,{file:string;missing:boolean;external:boolean;candidate?:string;occurrences:{project:string;tag:string;source:string;line:number}[]}>();
  for(const p of projects)for(const r of p.references.filter(r=>!r.exists||r.external)){
    const absolute=path.resolve(root,path.dirname(r.source),r.file),key=keyFor(absolute);
    const warning=grouped.get(key)??{file:r.file,missing:!r.exists&&!r.candidate,external:r.external,candidate:r.candidate,occurrences:[]};
    warning.occurrences.push({project:p.file,tag:r.tag,source:r.source,line:r.line});grouped.set(key,warning);
  }
  const dependencyWarnings=[...grouped.values()];
  const persistentPolCount = allPols.filter(file => !isTemporaryProjectFile(file)).length;
  const projectStatus = persistentPolCount > 0 ? 'project_found' : allPols.length > 0 ? 'temporary_only' : 'no_project';
  const inspectionWarnings = projectStatus === 'no_project'
    ? ['NO_PROJECT_POL: No .pol project exists under projectPath. Verify the selected folder and finish copying/downloading the project before native generation or IFC export.']
    : projectStatus === 'temporary_only'
      ? ['TEMPORARY_POL_ONLY: Only temporary .pol files were found. Select the saved project before native generation or IFC export.'] : [];
  return {projectDir:root,filesCount:files.length,alignmentsCount:ext('.ali').length,profilesCount:ext('.ras').length,
    projectStatus, persistentPolCount, inspectionWarnings,
    temporaryPolCount: allPols.filter(isTemporaryProjectFile).length, polCount: pols.length,
    hasIfc:ext('.ifc').length>0,projects,nativeFiles:{cej:ext('.cej'),vol:ext('.vol'),per:ext('.per')},
    dependencyWarnings,warnings:[...inspectionWarnings,...dependencyWarnings.map(r=>(r.external?'External reference: ':r.candidate?'Unverified project-root match: ':'Missing reference: ')+r.file+' ('+r.occurrences.length+' occurrences)')]};
}

export function inspectProjectSummary(projectPath: string, options: InspectionOptions) {
  const result = inspectProjectDirectory(projectPath, {...options, summary: true});
  const offset = options.offset ?? 0, limit = options.limit ?? 10;
  return {
    projectDir: result.projectDir, filesCount: result.filesCount, aliFileCount: result.alignmentsCount,
    projectStatus: result.projectStatus, persistentPolCount: result.persistentPolCount,
    inspectionWarnings: result.inspectionWarnings,
    rasFileCount: result.profilesCount, hasIfc: result.hasIfc, temporaryPolCount: result.temporaryPolCount,
    total: result.polCount, offset, limit, nextOffset: offset + limit < result.polCount ? offset + limit : null,
    projects: result.projects.map(project => ({
      file: project.file, title: project.title.slice(0, 256),
      projectDirectory: project.projectDirectory,
      temporary: isTemporaryProjectFile(project.file),
      axisRecordCount: project.axes.length, referenceCount: project.references.length, sha256: project.sha256,
      modelLoadEvidence: {
        alzadoAxisCount: project.modelLoadEvidence.alzadoAxisIds.length,
        persistedBimAxisCount: new Set(project.modelLoadEvidence.persistedBim.filter(item => item.bytes > 0).map(item => item.axisId)).size,
        alzadoAxisIdsWithoutNonemptyBim: project.modelLoadEvidence.alzadoAxisIdsWithoutNonemptyBim,
        terrainCandidateCount: project.modelLoadEvidence.terrainCandidates.length,
        unreadableVolumeFileCount: project.modelLoadEvidence.unreadableVolumeFiles.length,
        liveTreeVerified: project.modelLoadEvidence.liveTreeVerified
      }
    })),
    dependencyWarningCount: result.dependencyWarnings.length,
    dependencyWarningScope: 'returned_projects_only',
    dependencyWarnings: result.dependencyWarnings.slice(0, 10).map(({occurrences, ...warning}) => ({
      ...warning, occurrenceCount: occurrences.length
    }))
  };
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
