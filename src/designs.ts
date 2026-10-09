import fs from 'node:fs';
import path from 'node:path';
import * as z from 'zod/v4';
import {atomicJson,DomainError,hash,safeChild} from './io.js';

const coordinate=z.number().finite().min(-1e9).max(1e9);
const id=z.string().min(1).max(128);
const point2=z.tuple([coordinate,coordinate]);
const context={units:z.literal('m'),crs:z.string().min(1).max(256)};
export const alignmentSchema=z.object({kind:z.literal('alignment'),...context,originStation:coordinate.default(0),points:z.array(point2).min(2).max(1000)});
export const drainageSchema=z.object({kind:z.literal('drainage'),...context,gravity:z.boolean().default(true),minCoverM:z.number().finite().nonnegative().optional(),
  nodes:z.array(z.object({id,x:coordinate,y:coordinate,invertZ:coordinate,groundZ:coordinate.optional()})).min(2).max(1000),
  links:z.array(z.object({id,from:id,to:id,diameterM:z.number().finite().positive().max(100),fromInvertZ:coordinate.optional(),toInvertZ:coordinate.optional()})).min(1).max(2000)});
export const sectionSchema=z.object({kind:z.literal('section'),sectionType:z.enum(['ditch','box_culvert','wall','tunnel','detail']),
  units:z.literal('m'),coordinateFrame:z.literal('local_section'),referenceCode:z.string().min(1).max(128).optional(),
  vertices:z.array(point2).min(2).max(500),closed:z.boolean().default(false)});
export const designSchema=z.discriminatedUnion('kind',[alignmentSchema,drainageSchema,sectionSchema]);
type Point=[number,number,number];
type Drawing={id:string;layer:string;points:Point[];closed:boolean};
type Issue={code:string;message:string;entityId?:string};
const issue=(code:string,message:string,entityId?:string):Issue=>({code,message,...(entityId?{entityId}:{})});
const horizontal=(a:Point,b:Point)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function orientation(a:number[],b:number[],c:number[]){return (b[0]!-a[0]!)*(c[1]!-a[1]!)-(b[1]!-a[1]!)*(c[0]!-a[0]!);}
function intersects(a:number[],b:number[],c:number[],d:number[]){
  const o=[orientation(a,b,c),orientation(a,b,d),orientation(c,d,a),orientation(c,d,b)];
  const inside=(p:number[],u:number[],v:number[])=>p[0]!>=Math.min(u[0]!,v[0]!)&&p[0]!<=Math.max(u[0]!,v[0]!)&&p[1]!>=Math.min(u[1]!,v[1]!)&&p[1]!<=Math.max(u[1]!,v[1]!);
  return (o[0]!*o[1]!<0&&o[2]!*o[3]!<0)||(o[0]===0&&inside(c,a,b))||(o[1]===0&&inside(d,a,b))||(o[2]===0&&inside(a,c,d))||(o[3]===0&&inside(b,c,d));
}
export function designPreview(input:z.input<typeof designSchema>){
  const design=designSchema.parse(input),issues:Issue[]=[],warnings:Issue[]=[],drawing:Drawing[]=[];
  let metrics:Record<string,unknown>={};
  if(design.kind==='alignment'){
    const points:Point[]=design.points.map(([x,y])=>[x,y,0]);
    let station=design.originStation;
    const segments=points.slice(1).map((p,i)=>{
      const from=points[i]!,lengthM=horizontal(from,p),azimuthDegrees=(Math.atan2(p[0]-from[0],p[1]-from[1])*180/Math.PI+360)%360;
      if(lengthM<=1e-9)issues.push(issue('ZERO_LENGTH','Consecutive alignment points coincide',String(i+1)));
      const startStation=station;station+=lengthM;
      return {index:i+1,startStation,endStation:station,lengthM,azimuthDegrees,azimuthGon:azimuthDegrees*10/9};
    });
    metrics={lengthM:station-design.originStation,startStation:design.originStation,endStation:station,segments};
    drawing.push({id:'axis',layer:'MCP_AXIS',points,closed:false});
    if(points.length>2)warnings.push(issue('POLYLINE_ONLY','Corners are not designed circular curves or clothoids'));
  }else if(design.kind==='drainage'){
    const nodes=new Map<string,typeof design.nodes[number]>(),ids=new Set<string>(),out=new Map<string,string[]>(),incoming=new Map<string,number>();
    for(const node of design.nodes){
      if(nodes.has(node.id))issues.push(issue('DUPLICATE_NODE','Node identifiers must be unique',node.id));
      nodes.set(node.id,node);incoming.set(node.id,0);
      if(node.groundZ!==undefined&&node.groundZ<node.invertZ)issues.push(issue('INVERT_ABOVE_GROUND','Node invert is above ground',node.id));
    }
    const used=new Set<string>();
    const links=design.links.flatMap(link=>{
      if(ids.has(link.id))issues.push(issue('DUPLICATE_LINK','Link identifiers must be unique',link.id));ids.add(link.id);
      const from=nodes.get(link.from),to=nodes.get(link.to);
      if(!from||!to){issues.push(issue('UNKNOWN_NODE','Link endpoint does not exist',link.id));return [];}
      const a:Point=[from.x,from.y,link.fromInvertZ??from.invertZ],b:Point=[to.x,to.y,link.toInvertZ??to.invertZ];
      const lengthM=horizontal(a,b),dropM=a[2]-b[2],slope=lengthM>1e-9?dropM/lengthM:null;
      if(lengthM<=1e-9)issues.push(issue('ZERO_LENGTH','Pipe requires distinct XY endpoints; model vertical drops at nodes',link.id));
      if(design.gravity&&slope!==null&&slope<=0)issues.push(issue('ADVERSE_SLOPE','Gravity link must fall in its flow direction',link.id));
      const cover=(n:typeof from,invert:number)=>n.groundZ===undefined?null:n.groundZ-invert-link.diameterM;
      const covers=[cover(from,a[2]),cover(to,b[2])];
      if(covers.some(c=>c!==null&&c<0))issues.push(issue('PIPE_ABOVE_GROUND','Pipe crown is above ground at an endpoint',link.id));
      if(design.minCoverM!==undefined){
        if(covers.some(c=>c===null))issues.push(issue('GROUND_REQUIRED','Minimum cover needs ground elevations at both endpoints',link.id));
        else if(covers.some(c=>c!<design.minCoverM!))issues.push(issue('INSUFFICIENT_COVER','Endpoint cover is below the requested minimum',link.id));
      }
      used.add(from.id);used.add(to.id);out.set(from.id,[...(out.get(from.id)??[]),to.id]);incoming.set(to.id,(incoming.get(to.id)??0)+1);
      drawing.push({id:link.id,layer:'MCP_PIPE',points:[[a[0],a[1],a[2]+link.diameterM/2],[b[0],b[1],b[2]+link.diameterM/2]],closed:false});
      return [{id:link.id,from:link.from,to:link.to,lengthM,length3dM:Math.hypot(lengthM,dropM),dropM,slopePercent:slope===null?null:slope*100,diameterM:link.diameterM,endpointCoverM:covers}];
    });
    if(design.gravity){
      const queue=[...incoming].filter(([,n])=>n===0).map(([k])=>k);let visited=0;
      for(let i=0;i<queue.length;i++){visited++;for(const next of out.get(queue[i]!)??[]){incoming.set(next,incoming.get(next)!-1);if(incoming.get(next)===0)queue.push(next);}}
      if(visited<nodes.size)issues.push(issue('GRAVITY_CYCLE','Gravity network contains a directed cycle'));
    }
    for(const node of nodes.values())if(!used.has(node.id))warnings.push(issue('UNUSED_NODE','Node is not connected to a link',node.id));
    metrics={nodes:nodes.size,links,totalLengthM:links.reduce((n,l)=>n+l.lengthM,0),outlets:[...nodes.keys()].filter(k=>used.has(k)&&!(out.get(k)?.length)),
      coverCheckedAt:'endpoints_only',hydraulicsValidated:false,terrainAlongLinksValidated:false};
    warnings.push(issue('GEOMETRY_ONLY','Flow capacity, junction losses, intermediate terrain, manholes and trench design require separate verification'));
  }else{
    const points:Point[]=design.vertices.map(([x,y])=>[x,y,0]);
    if(design.closed&&points.length>2&&horizontal(points[0]!,points.at(-1)!)===0)points.pop();
    const requireClosed=['box_culvert','wall','tunnel'].includes(design.sectionType);
    if(requireClosed&&!design.closed)issues.push(issue('CLOSED_SECTION_REQUIRED','This outline requires a closed section'));
    if(design.closed&&points.length<3)issues.push(issue('DEGENERATE_SECTION','Closed section needs three distinct vertices'));
    const edges=points.slice(1).map((p,i)=>[points[i]!,p] as const);
    if(design.closed)edges.push([points.at(-1)!,points[0]!]);
    for(const [a,b] of edges)if(horizontal(a,b)<=1e-9)issues.push(issue('ZERO_LENGTH','Section contains a repeated consecutive vertex'));
    for(let i=0;i<(design.closed?edges.length:edges.length-1);i++){
      const [a,b]=edges[i]!,[,c]=edges[(i+1)%edges.length]!;
      if(orientation(a,b,c)===0&&(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1])<0)
        issues.push(issue('BACKTRACKING_EDGE','Consecutive section edges overlap in reverse direction'));
    }
    for(let i=0;i<edges.length;i++)for(let j=i+2;j<edges.length;j++){
      if(design.closed&&i===0&&j===edges.length-1)continue;
      if(intersects(...edges[i]!,...edges[j]!))issues.push(issue('SELF_INTERSECTION','Nonadjacent section edges intersect'));
    }
    // Translate before shoelace summation to avoid cancellation at large coordinates.
    const first=points[0]!,signed=points.reduce((n,p,i)=>{const q=points[(i+1)%points.length]!;return n+(p[0]-first[0])*(q[1]-first[1])-(q[0]-first[0])*(p[1]-first[1]);},0)/2;
    if(design.closed&&Math.abs(signed)<=1e-12)issues.push(issue('ZERO_AREA','Closed section has zero area'));
    metrics={sectionType:design.sectionType,vertices:points.length,perimeterM:edges.reduce((n,[a,b])=>n+horizontal(a,b),0),
      areaM2:design.closed?Math.abs(signed):null,winding:design.closed?(signed>0?'counterclockwise':'clockwise'):null,
      referenceCode:design.referenceCode??null,structuralDesignValidated:false,hydraulicsValidated:false};
    drawing.push({id:design.sectionType,layer:'MCP_SECTION',points,closed:design.closed});
    warnings.push(issue('OUTLINE_ONLY','Outline does not define materials, reinforcement, wall thicknesses, geotechnical design or a certified native section'));
  }
  return {kind:design.kind,valid:issues.length===0,issues,warnings,metrics,drawing,units:'m' as const,
    coordinateContext:'crs' in design?{crs:design.crs,source:'user_declared'}:{frame:design.coordinateFrame,source:'user_declared'},
    nativeExecutionVerified:false,engineeringDesignCertified:false};
}

export function drawingDxf(drawing:Drawing[]){
  const rows:(string|number)[]=[0,'SECTION',2,'HEADER',9,'$ACADVER',1,'AC1015',9,'$INSUNITS',70,6,0,'ENDSEC',0,'SECTION',2,'ENTITIES'];
  for(const line of drawing){
    rows.push(0,'POLYLINE',8,line.layer,66,1,70,line.closed?9:8,10,0,20,0,30,0);
    for(const p of line.points)rows.push(0,'VERTEX',8,line.layer,10,p[0],20,p[1],30,p[2],70,32);
    rows.push(0,'SEQEND',8,line.layer);
  }
  rows.push(0,'ENDSEC',0,'EOF');return rows.join('\r\n')+'\r\n';
}
export function prepareDesignPackage(root:string,requestId:string,input:z.input<typeof designSchema>){
  const parsed=designSchema.parse(input),preview=designPreview(parsed);
  if(!preview.valid)throw new DomainError('INVALID_DESIGN','Geometry preflight failed',{issues:preview.issues});
  const fingerprint=hash(JSON.stringify(parsed)),dir=safeChild(root,path.join('.istram-mcp','deliverables',hash(requestId))),file=path.join(dir,'manifest.json');
  if(fs.existsSync(file)){
    const existing=JSON.parse(fs.readFileSync(file,'utf8'));
    if(existing.fingerprint!==fingerprint)throw new DomainError('IDEMPOTENCY_CONFLICT','Design request ID has different inputs');
    if(!Array.isArray(existing.artifacts)||existing.artifacts.length!==2)throw new DomainError('OUTCOME_CHANGED','Prepared design manifest has changed');
    for(const [i,a] of existing.artifacts.entries()){
      const expected=safeChild(dir,i===0?'preview.dxf':'design.json');
      if(a.path!==expected||!fs.existsSync(expected)||hash(fs.readFileSync(expected))!==a.sha256)throw new DomainError('OUTCOME_CHANGED','Prepared design artifacts have changed');
    }
    return existing;
  }
  fs.mkdirSync(dir,{recursive:true});
  const dxf=drawingDxf(preview.drawing),dxfPath=path.join(dir,'preview.dxf'),jsonPath=path.join(dir,'design.json');
  // Never replace an existing partial package or write ISTRAM design/recovery files.
  try{
    fs.writeFileSync(dxfPath,dxf,{flag:'wx'});fs.writeFileSync(jsonPath,JSON.stringify({input:parsed,preview},null,2)+'\n',{flag:'wx'});
    const manifest={requestId,fingerprint,status:'prepared',kind:parsed.kind,nativeImported:false,
      artifacts:[dxfPath,jsonPath].map(p=>({path:p,sha256:hash(fs.readFileSync(p))})),
      warning:'Interchange geometry and input record only. ISTRAM import, native calculation and engineering acceptance remain required.'};
    atomicJson(file,manifest);return manifest;
  }catch(e){throw new DomainError('PACKAGE_INCOMPLETE','Partial package retained; inspect before retry',{cause:e instanceof DomainError?e.code:'FILE_WRITE_FAILED'});}
}
