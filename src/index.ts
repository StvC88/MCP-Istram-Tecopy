#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';

void serveStdio(createServer).catch(error=>{
  console.error('[istram-mcp]',error instanceof Error?error.message:String(error));
  process.exitCode=1;
});
