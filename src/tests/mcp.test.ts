import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('stdio protocol lists tools and resources, validates arguments, exposes honest diagnostics',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'istram-mcp-'));
  const transport=new StdioClientTransport({command:process.execPath,
    args:[fileURLToPath(new URL('../index.js',import.meta.url))],
    env:{...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined)),
      ISTRAM_PATH:path.join(dir,'absent'),ISTRAM_WORKSPACE:path.join(dir,'work')}});
  const client=new Client({name:'integration-test',version:'1.0.0'});
  try{
    await client.connect(transport);
    const tools=await client.listTools();assert.ok(tools.tools.length>=17);
    const status=await client.callTool({name:'istram_detect',arguments:{}});
    assert.equal(status.isError,undefined);
    const data=JSON.parse(status.content.find(c=>c.type==='text')!.text);
    assert.equal(data.data.isInstalled,false);assert.equal(data.data.version,null);
    const bad=await client.callTool({name:'alignment_read',arguments:{filePath:7}});
    assert.equal(bad.isError,true);
    const missing=await client.callTool({name:'profile_read',arguments:{filePath:path.join(dir,'missing.ras')}});
    assert.equal(missing.isError,true);
    const resources=await client.listResources();assert.ok(resources.resources.some(r=>r.uri==='istram://system/status'));
    const coverage=await client.readResource({uri:'istram://system/coverage'});
    assert.equal(JSON.parse(coverage.contents[0]!.text as string).stableAcceptancePassed,false);
  }finally{await client.close();fs.rmSync(dir,{recursive:true,force:true});}
});
