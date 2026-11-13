import fs from 'node:fs';
import path from 'node:path';
import { connect, call } from './client.mjs';

const [ifc, catalog, report, requirements] = process.argv.slice(2);
if (!ifc || !catalog || !report) {
  console.error('Usage: node scripts/check-rceclass-ifc.mjs <model.ifc> <FCT directory> <report.json> [IFC validation options.json]');
  process.exit(2);
}
const filePath = path.resolve(ifc);
const options = requirements ? JSON.parse(fs.readFileSync(requirements, 'utf8')) : {};
const client = await connect();
const check = (name, args) => call(client, name, args, {timeout: 30 * 60 * 1000});
try {
  const classification = await check('ifc_rceclass_audit', {
    filePath, catalogDirectory: path.resolve(catalog), sampleLimit: 100
  });
  const validation = await check('ifc_validate', {
    expectedSchema: 'IFC4X3_ADD2', expectedLengthUnitToMetres: 1,
    minProducts: 1, geometry: true, minGeometryProducts: 1, ...options, filePath
  });
  if (classification.sha256 !== validation.sha256) throw new Error('IFC changed between checks');
  fs.writeFileSync(report, JSON.stringify({classification, validation}, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({
    schema: validation.schema, elements: classification.elements, products: validation.products,
    alignments: validation.alignments, geometryProducts: validation.geometry.length, crs: validation.projectedCrsNames,
    rceclassValid: classification.valid, issueCounts: classification.issueCounts,
    ifcValid: validation.valid, ifcIssues: validation.issues.length, dgcLocation: validation.dgcLocation
  }));
  if (!classification.valid || !validation.valid || validation.dgcLocation?.valid === false) process.exitCode = 1;
} finally {
  await client.close();
}
