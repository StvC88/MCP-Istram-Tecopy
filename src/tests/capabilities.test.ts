import test from 'node:test';
import assert from 'node:assert/strict';
import { readUsageCatalogue, usageCapabilities } from '../capabilities.js';
import { DomainError } from '../io.js';

test('usage evidence keeps inventory, transcript review and native acceptance separate',()=>{
  const c=readUsageCatalogue();
  assert.equal(c.nativeAcceptancePassed,false);
  assert.equal(c.fullVideoReviewComplete,false);
  assert.equal(new Set(c.videos.map(v=>v.video_id)).size,c.videos.length);
  assert.equal(c.inventoryVideoCount,c.videos.length);
  assert.equal(c.reviewedTranscriptCount,c.videos.filter(v=>v.reviewLevel==='transcript_reviewed').length);
  const ids=new Set(c.capabilities.map(x=>x.id));
  assert.equal(ids.size,c.capabilities.length);
  for(const video of c.videos){
    assert.ok(video.capabilityIds.length>0);
    assert.ok(video.capabilityIds.every(id=>ids.has(id)));
  }
  for(const capability of c.capabilities){
    assert.equal(capability.nativeExecutionVerified,false);
    assert.ok(capability.inputs.length && capability.acceptance.length);
    for(const source of capability.sources){
      if(source.kind==='youtube'){
        const v=c.videos.find(v=>v.index===source.videoIndex);
        assert.ok(v);
        assert.equal(source.url,v.url);
        assert.equal(source.level,v.reviewLevel);
      }
    }
  }
});
test('catalogue searches accents, paginates and refuses unknown capability IDs',()=>{
  const a=usageCapabilities({query:'tuneles'}),b=usageCapabilities({query:'túneles'});
  assert.ok(a.total>0);assert.deepEqual(a.capabilities,b.capabilities);
  const full=usageCapabilities({limit:50});
  assert.deepEqual(usageCapabilities({offset:1,limit:2}).capabilities,full.capabilities.slice(1,3));
  const exact=usageCapabilities({capabilityId:'slopes'});
  assert.equal(exact.total,1);
  assert.ok(exact.sourceVideos.every(v=>v.capabilityIds.includes('slopes')));
  assert.throws(()=>usageCapabilities({capabilityId:'nonexistent'}),e=>e instanceof DomainError && e.code==='UNKNOWN_CAPABILITY');
});
