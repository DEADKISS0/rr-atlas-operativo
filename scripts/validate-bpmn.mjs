import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateXml } from '../src/bpmn/lint/run.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = resolve(root, 'src/bpmn/seeds');

const debt = JSON.parse(await readFile(resolve(seedDir, 'deuda-modelado.json'), 'utf8'));
const files = (await readdir(seedDir)).filter((name) => name.endsWith('.bpmn')).sort();

if (files.length !== 16) {
  console.error(`Se esperaban 16 semillas y hay ${files.length}.`);
  process.exit(1);
}

let failed = false;
const seenDebt = new Set();

for (const file of files) {
  const xml = await readFile(resolve(seedDir, file), 'utf8');
  const report = await validateXml(xml, { fileName: file, debt });
  if (report.importError) {
    failed = true;
    console.error(`ERROR moddle ${file}: ${report.importError}`);
    continue;
  }
  if (report.moddleWarnings.length) {
    failed = true;
    console.error(`ERROR moddle ${file}: ${report.moddleWarnings.length} avisos`);
    for (const warning of report.moddleWarnings) console.error(`  - ${warning.message}`);
  }
  for (const issue of report.debt) {
    seenDebt.add(`${file}:${issue.id}`);
    console.log(`AVISO CONOCIDO ${file} ${issue.id} ${issue.rule}: ${issue.message}`);
  }
  for (const issue of report.errors) {
    failed = true;
    console.error(`ERROR ${file} ${issue.id} ${issue.rule}: ${issue.message}`);
  }
  if (report.warnings.length) {
    console.log(`avisos ${file}: ${report.warnings.length}`);
  }
}

for (const item of debt.casos) {
  const key = `${item.archivo}:${item.id}`;
  if (!seenDebt.has(key)) {
    failed = true;
    console.error(`La deuda documentada no apareció: ${key}. Revisa deuda-modelado.json.`);
  }
}

if (seenDebt.size !== debt.casos.length) {
  failed = true;
  console.error(`La deuda visible (${seenDebt.size}) no coincide con los ${debt.casos.length} casos documentados.`);
}

if (failed) {
  console.error('Validación BPMN fallida.');
  process.exit(1);
}

console.log(`BPMN: ${files.length} semillas, moddle sin avisos, 0 errores fuera de la deuda documentada (${debt.casos.length} compuertas no-gateway-join-fork).`);
