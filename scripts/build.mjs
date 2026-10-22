/**
 * Build del frontend modular.
 * El resto de la app sigue en módulos ES sin bundler.
 * Solo el visor BPMN se empaqueta con esbuild (devDependency) porque
 * bpmn-js, diagram-js y bpmnlint no se pueden cargar como ESM sueltos
 * desde el navegador. Salida: dist/src/bpmn/bpmn-bundle.mjs.
 * Los CSS de bpmn-js se copian a dist/src/bpmn/vendor.
 * La licencia de bpmn.io exige que el aviso "Powered by bpmn.io" siga visible.
 */
import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function validateShell(html) {
  if (typeof html !== 'string' || !/^<!doctype html>/i.test(html.trim())) throw new Error('Invalid HTML shell');
  const required = [
    'src/app/main.mjs',
    'src/styles/tokens.css',
    'src/styles/layout.css',
    'src/styles/components.css',
    'data-atlas-layout',
    'data-atlas-editor',
    'data-atlas-cards',
    'data-atlas-process',
    'src/styles/bpmn.css',
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`Missing shell marker: ${marker}`);
  }
  if (html.includes('<bpmn:definitions')) throw new Error('BPMN XML leaked into index.html');
  if (html.includes('const DEFAULT=') || html.includes('localStorage.setItem')) {
    throw new Error('Application logic leaked into index.html');
  }
  return html;
}

export async function build(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const input = await readFile(resolve(root, 'index.html'), 'utf8');
  const output = validateShell(input);
  const dist = resolve(root, 'dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await writeFile(resolve(dist, 'index.html'), output, 'utf8');
  await cp(resolve(root, 'src'), resolve(dist, 'src'), { recursive: true });
  await cp(resolve(root, 'rr-logo-mark.png'), resolve(dist, 'rr-logo-mark.png'));
  await esbuild.build({
    entryPoints: [resolve(root, 'src/bpmn/entry.mjs')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    outfile: resolve(dist, 'src/bpmn/bpmn-bundle.mjs'),
    legalComments: 'inline',
    minify: true,
    banner: {
      js: '/* Visor BPMN de RR Atlas. bpmn-js se usa bajo la licencia de bpmn.io: el aviso Powered by bpmn.io permanece visible. */',
    },
  });
  await cp(resolve(root, 'node_modules/bpmn-js/dist/assets'), resolve(dist, 'src/bpmn/vendor'), { recursive: true });
  console.log('Atlas shell build: modular frontend validated; BPMN bundle in dist/src/bpmn/bpmn-bundle.mjs');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
