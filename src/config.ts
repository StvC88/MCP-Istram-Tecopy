import fs from 'node:fs';
import path from 'node:path';
import { readDocument } from './io.js';

export function detectIstramEnvironment(customPath?: string) {
  const basePath=path.resolve(customPath ?? process.env.ISTRAM_PATH ?? 'C:\\Ispol');
  const executablePath=path.join(basePath,'Istram.exe'), visorPath=path.join(basePath,'Visor_Istram.exe');
  const log=path.join(basePath,'IstramActivity.log');
  let version:string|null=null, observedAt:string|null=null;
  if(fs.existsSync(log)){
    const bytes=fs.readFileSync(log);
    const tail=bytes.subarray(Math.max(0,bytes.length-65536));
    const text=new TextDecoder('windows-1252').decode(tail);
    for(const line of text.split(/\r?\n/)){
      const match=line.match(/versi\S*n=\s*(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s*bits/i);
      if(match){ version=match[1]+' ('+match[2]+'-bit)'; observedAt=line.slice(0,19); }
    }
  }
  const components=[
    ['launcher',path.join(basePath,'util','Arranque.exe')],
    ['command_dictionary',path.join(basePath,'lib','comandos.cfg')],
    ['ifc_mapping',path.join(basePath,'lib','istram2ifc4x3.csv')],
    ['ifc_types',path.join(basePath,'lib','tiposEntidadesIFC.csv')],
    ['viewer',visorPath],
  ].filter(([,file])=>fs.existsSync(file!)).map(([name,file])=>({name,path:file}));
  return {isInstalled:fs.existsSync(executablePath),basePath,executablePath,visorPath,
    utilPath:path.join(basePath,'util'),helpPath:path.join(basePath,'util','Ayuda'),
    version,versionEvidence:version?{source:'activity_log',path:log,observedAt,currentBinaryVerified:false}:null,
    installedComponents:components,detectedModules:[],licensedModules:{status:'unknown',modules:[]},
    warnings:['Presence of files does not prove licensed modules.','Activity log describes a historical run, not the current executable.']};
}
export function readIfcMappings(basePath: string) {
  const mappingPath=path.join(basePath,'lib','istram2ifc4x3.csv');
  const typesPath=path.join(basePath,'lib','tiposEntidadesIFC.csv');
  const mappings=fs.existsSync(mappingPath)?readDocument(mappingPath).text.split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('#')).map(line=>{
    const [istramClass,ifcType,...extra]=line.split(';').map(x=>x.trim());
    return {istramClass,ifcType,extra};
  }):[];
  const tokens=fs.existsSync(typesPath)?readDocument(typesPath).text.split(/[;\r\n,]/):[];
  const classes=[...new Set([...mappings.map(x=>x.ifcType),...tokens].filter((x):x is string=>!!x && /^Ifc[A-Za-z0-9_]+$/.test(x.trim())).map(x=>x.trim()))].sort();
  return {classes,mappings,sources:[mappingPath,typesPath].filter(fs.existsSync),licensedExportVerified:false};
}
