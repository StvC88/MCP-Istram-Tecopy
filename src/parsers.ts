import { DomainError, numberToken, readDocument } from './io.js';

const types=['last_point','straight','circular_right','circular_left','clothoid_straight_to_left','clothoid_left_to_straight','clothoid_right_to_straight','clothoid_straight_to_right'];
export function parseAliContent(content: string) {
  let originStationPk:number|null=null;
  const elements:Record<string,unknown>[]=[];
  const unknown:{line:number;raw:string}[]=[],comments:string[]=[];
  content.split(/\r?\n/).forEach((raw,i)=>{
    const text=raw.trim(); if(!text)return;
    if(text.startsWith('#')){comments.push(raw);return;}
    const tokens=text.split(/\s+/);
    if(originStationPk===null && tokens.length===1){originStationPk=numberToken(tokens[0],i+1);return;}
    if(tokens.length<8 || !/^[+-]?\d+$/.test(tokens[0]!)){unknown.push({line:i+1,raw});return;}
    const n=tokens.map(t=>numberToken(t,i+1)),type=n[0]!;
    elements.push({line:i+1,type,typeName:types[type]??'unknown_'+type,length:n[1],tangentX:n[2],tangentY:n[3],
      centerInfX:n[4],centerInfY:n[5],azimuth:n[6],radiusOrParam:n[7],extraParam:n[8]??null,rawLine:raw});
  });
  if(originStationPk===null) throw new DomainError('INVALID_ALI','Missing station origin');
  if(!elements.length) throw new DomainError('INVALID_ALI','No geometry rows found');
  return {header:{originStationPk,comments},elements,unknown,units:'unspecified',writeValidated:false};
}
export function parseRasContent(content:string){
  let versionHeader='',section='MAIN_PROFILE';
  const sections:{name:string;points:Record<string,unknown>[]}[]=[{name:section,points:[]}];
  const unknown:{line:number;raw:string}[]=[];
  content.split(/\r?\n/).forEach((raw,i)=>{
    const text=raw.trim();if(!text)return;
    if(text.startsWith('#')){
      if(/^#\s*Longitudinal\b/i.test(text)){section=text.replace(/^#\s*Longitudinal\s*/i,'');sections.push({name:section,points:[]});}
      return;
    }
    if(/^VER\s/.test(text)){versionHeader=text;return;}
    const tokens=text.split(/\s+/);
    if(tokens.length!==8 || !/^[+-]?\d+$/.test(tokens[0]!) || !/^[+-]?\d+$/.test(tokens[1]!)){
      unknown.push({line:i+1,raw});return;
    }
    const n=tokens.map(t=>numberToken(t,i+1));
    sections.at(-1)!.points.push({line:i+1,mode:n[0],vertex:n[1],pk1:n[2],z1:n[3],pk2:n[4],z2:n[5],slopePercent:n[6],param:n[7],rawLine:raw});
  });
  if(!versionHeader || !sections.some(x=>x.points.length))throw new DomainError('INVALID_RAS','Missing VER header or profile rows');
  return {versionHeader,sections,unknown,writeValidated:false};
}
export const parseAliFile=(file:string)=>{const d=readDocument(file);return {...parseAliContent(d.text),encoding:d.encoding,sha256:d.sha256};};
export const parseRasFile=(file:string)=>{const d=readDocument(file);return {...parseRasContent(d.text),encoding:d.encoding,sha256:d.sha256};};
export function parseComandosCfg(file:string){
  return readDocument(file).text.split(/\r?\n/).flatMap((raw,i)=>{
    const tokens=raw.trim().split(/\s+/);if(tokens.length<3 || raw.trim().startsWith('#'))return[];
    return [{code:tokens[0],command:tokens[1],description:tokens.slice(2).join(' '),sourceLine:i+1,executionVerified:false}];
  });
}
export function parseNativeContent(text:string){
  return text.split(/\r?\n/).flatMap((raw,i)=>{
    if(!raw.trim() || raw.trim().startsWith('#'))return[];
    const tokens=raw.trim().split(/\s+/);
    return [{line:i+1,tag:tokens[0]!,values:tokens.slice(1),raw}];
  });
}
