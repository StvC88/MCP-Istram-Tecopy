import fs from 'node:fs';
import { DomainError } from './io.js';

type Evidence={kind:string;videoIndex?:number;url?:string;level:string;title?:string};
export type UsageCapability={
  id:string;title:string;priority:string;nativeExecutionVerified:boolean;currentSupport:string;
  existingTools:string[];proposedTools:string[];inputs:string[];steps:string[];acceptance:string[];risks:string[];sources:Evidence[];
};
type Video={index:number;video_id:string;title:string;url:string;reviewLevel:string;capabilityIds:string[]};
export type UsageCatalogue={
  schemaVersion:number;reviewedAt:string;reviewedCommit:string;channelUrl:string;notebookUrl:string;notebookTitle:string;
  notebookSourceInventoryVerified:boolean;inventoryVideoCount:number;reviewedTranscriptCount:number;
  fullVideoReviewComplete:boolean;nativeAcceptancePassed:boolean;officialAutomationApiVerified:boolean;evidencePolicy:string;
  capabilities:UsageCapability[];videos:Video[];
};

export function readUsageCatalogue():UsageCatalogue{
  // Resolve shipped research relative to this module, never to the user's project.
  return JSON.parse(fs.readFileSync(new URL('../docs/research/usage-capabilities.json',import.meta.url),'utf8'));
}
const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
export function usageCapabilities(args:{query?:string;capabilityId?:string;offset?:number;limit?:number}={}){
  const {capabilities,videos,...review}=readUsageCatalogue();
  let matched=capabilities;
  if(args.capabilityId){
    const found=capabilities.find(c=>c.id===args.capabilityId);
    if(!found)throw new DomainError('UNKNOWN_CAPABILITY','Unknown usage capability: '+args.capabilityId);
    matched=[found];
  }
  if(args.query){const query=normalize(args.query);matched=matched.filter(c=>normalize(JSON.stringify(c)).includes(query));}
  const offset=args.offset??0,limit=args.limit??10;
  const page=matched.slice(offset,offset+limit),ids=new Set(page.map(c=>c.id));
  return {review,total:matched.length,offset,limit,capabilities:page,
    sourceVideos:videos.filter(v=>v.capabilityIds.some(id=>ids.has(id)))};
}
