import {connect,call} from './client.mjs';
const client=await connect();
try{
  const tools=await client.listTools(),health=await call(client,'worker_health'),usage=await call(client,'usage_capabilities',{limit:50}),install=await call(client,'istram_detect');
  const required=['open_project','close_project','save','recalculate','bim_configure','bim_generate','bim_export'];
  console.log(JSON.stringify({serverVersion:client.getServerVersion(),tools:tools.tools.length,platform:health.platform,
    pythonAvailable:true,dependencies:health.dependencies,istramInstalled:install.isInstalled,versionEvidence:install.version,
    adapter:health.adapter,capabilities:usage.total,nativeCertified:usage.capabilities.filter(c=>c.nativeExecutionVerified).length,
    readyForGeometryPreparation:tools.tools.some(t=>t.name==='design_package_prepare'),
    readyForNativeExecution:health.adapter?.verified===true&&health.adapter.workingDirectoryGuardConfigured&&health.adapter.projectGuardConfigured&&required.every(a=>health.adapter.actions.includes(a))},null,2));
}finally{await client.close();}
