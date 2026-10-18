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
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`Missing shell marker: ${marker}`);
  }
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
  console.log('Atlas shell build: modular frontend validated; output dist/index.html');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
