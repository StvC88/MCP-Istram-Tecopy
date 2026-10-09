#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

const server=createServer();
server.connect(new StdioServerTransport()).catch((error:unknown)=>{
  console.error('[istram-mcp]',error instanceof Error?error.message:String(error));
  process.exitCode=1;
});
