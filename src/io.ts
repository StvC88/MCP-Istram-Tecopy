import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export class DomainError extends Error {
  constructor(public code: string, message: string, public details?: unknown) { super(message); }
}
export const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export function readDocument(file: string) {
  const bytes = fs.readFileSync(file);
  if (bytes.length > 32 * 1024 * 1024) throw new DomainError('FILE_TOO_LARGE', 'Text file exceeds 32 MiB');
  if (bytes.includes(0)) throw new DomainError('BINARY_FILE', 'Expected a text file');
  const bom = bytes.subarray(0,3).equals(Buffer.from([239,187,191]));
  const body = bom ? bytes.subarray(3) : bytes;
  let encoding: 'utf8' | 'windows-1252' = 'utf8';
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(body); }
  catch { encoding = 'windows-1252'; text = new TextDecoder('windows-1252').decode(body); }
  return { text, encoding, bom, sha256: hash(bytes), bytes };
}
export type Document = ReturnType<typeof readDocument>;
export function encodeDocument(text: string, doc: Document): Buffer {
  let body: Buffer;
  if (doc.encoding === 'utf8') body = Buffer.from(text, 'utf8');
  else {
    const decoder = new TextDecoder('windows-1252');
    const table = new Map<string, number>();
    for(let n=0;n<256;n++) table.set(decoder.decode(Uint8Array.of(n)), n);
    const codes = Array.from(text).map(c => {
      const value = table.get(c);
      if(value === undefined) throw new DomainError('ENCODING_LOSS', 'Character cannot be represented in Windows-1252');
      return value;
    });
    body = Buffer.from(codes);
  }
  return doc.bom ? Buffer.concat([Buffer.from([239,187,191]),body]) : body;
}
export function numberToken(token: string | undefined, line: number): number {
  if(!token || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(token))
    throw new DomainError('INVALID_NUMBER', 'Invalid numeric field at line '+line, {line, token});
  const n=Number(token);
  if(!Number.isFinite(n)) throw new DomainError('INVALID_NUMBER','Non-finite numeric value',{line});
  return n;
}
export function within(root: string, target: string): boolean {
  const relative=path.relative(root,target);
  return relative === '' || (!relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
export function safeChild(root: string, relative: string): string {
  if(path.isAbsolute(relative)) throw new DomainError('PATH_ESCAPE','Expected relative path');
  const base=fs.realpathSync(root), target=path.resolve(base,relative);
  if(!within(base,target)) throw new DomainError('PATH_ESCAPE','Path leaves project');
  let cursor=base;
  for(const part of path.relative(base,target).split(path.sep).filter(Boolean)){
    cursor=path.join(cursor,part);
    if(fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink())
      throw new DomainError('SYMLINK','Project paths cannot traverse symbolic links');
  }
  return target;
}
export function atomicJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=file+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  fs.renameSync(temp,file);
}
export function walk(root: string, limit=25000, excludedTopLevel:ReadonlySet<string>=new Set()): string[] {
  const found:string[]=[];
  const visit=(dir:string)=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      if(entry.name === '.git' || entry.name === '.istram-mcp') continue;
      // Do not enumerate, inspect links or read content inside an explicitly excluded directory.
      const key=process.platform==='win32'?entry.name.toLowerCase():entry.name;
      if(dir===root && excludedTopLevel.has(key))continue;
      const full=path.join(dir,entry.name);
      if(entry.isSymbolicLink()) throw new DomainError('SYMLINK','Cannot copy or inspect linked project content');
      if(entry.isDirectory()) visit(full);
      else if(entry.isFile()) found.push(path.relative(root,full));
      if(found.length>limit) throw new DomainError('PROJECT_TOO_LARGE','File count exceeds '+limit);
    }
  };
  visit(root); return found.sort();
}
