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

export function workflowPlan(capabilityId:string){
  const result=usageCapabilities({capabilityId,limit:1}),capability=result.capabilities[0]!;
  const preparation:Record<string,string[]>={horizontal_alignment:['alignment_design_preview','design_package_prepare'],
    drainage:['drainage_design_preview','section_design_preview','design_package_prepare'],
    pipelines:['drainage_design_preview','design_package_prepare'],structures:['section_design_preview','design_package_prepare'],
    tunnels:['section_design_preview','design_package_prepare'],sections:['section_design_preview','design_package_prepare'],
    drawings:['section_design_preview','design_package_prepare'],files_batch:['project_prepare_batch','project_changes_preview']};
  return {capabilityId,title:capability.title,inputs:capability.inputs,
    currentTools:[...new Set([...capability.existingTools,...(preparation[capabilityId]??[])])],
    preparationSupport:preparation[capabilityId]?'geometry_or_text_preflight':'read_and_requirements_only',
    steps:capability.steps,acceptance:capability.acceptance,sources:capability.sources,
    nativeExecutionVerified:capability.nativeExecutionVerified,
    blockers:capability.nativeExecutionVerified?[]:['Local native recipe and geometry/persistence acceptance not certified'],
    sourceReviewComplete:result.review.fullVideoReviewComplete,
    engineeringDesignCertified:false,proposedTools:capability.proposedTools};
}
