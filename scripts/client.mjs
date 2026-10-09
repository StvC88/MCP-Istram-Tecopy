import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
export const repo=fileURLToPath(new URL('../',import.meta.url));
export async function connect(env={}){
  const client=new Client({name:'istram-check',version:'0.3.0-rc.1'});
  const transport=new StdioClientTransport({command:process.execPath,args:[path.join(repo,'dist/index.js')],env:{...process.env,...env}});
  await client.connect(transport);return client;
}
export async function call(client,name,args={}){
  const result=await client.callTool({name,arguments:args});
  const payload=JSON.parse(result.content.find(c=>c.type==='text').text);
  if(result.isError||!payload.ok){const error=new Error(payload.error?.message??'MCP call failed');error.code=payload.error?.code;throw error;}
  return payload.data;
}
