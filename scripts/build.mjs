import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Script } from 'node:vm';

// Transitional build for the v3 single-file prototype. Only these two handlers
// change; the original HTML, logo, data and localStorage key remain untouched.
export function patchPersistence(html) {
  if (typeof html !== 'string' || !/<\/html>\s*$/i.test(html)) {
    throw new Error('Incomplete HTML: build aborted');
  }
  const changes = [
    [
      "get(selected).links.push([name,url]);$('modal').classList.remove('open');",
      "get(selected).links.push([name,url]);const saved=persist();$('modal').classList.remove('open');renderEditor();toast(saved?'Documento asociado y guardado':'Documento asociado en memoria; exporta el mapa')"
    ],
    [
      'n.links.splice(Number(b.dataset.delDoc),1);renderEditor()',
      'n.links.splice(Number(b.dataset.delDoc),1);const saved=persist();renderEditor();toast(saved?\'Enlace quitado y guardado\':\'Enlace quitado en memoria; exporta el mapa\')'
    ]
  ];
  let output = html;
  for (const [before, after] of changes) {
    const oldCount = output.split(before).length - 1;
    const newCount = output.split(after).length - 1;
    if (oldCount === 1 && newCount === 0) {
      output = output.replace(before, after);
    } else if (!(oldCount === 0 && newCount === 1)) {
      throw new Error('Unexpected or ambiguous document handler: build aborted');
    }
  }
  const scripts = [...output.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  if (scripts.length !== 1) throw new Error('Expected one inline application script');
  new Script(scripts[0][1], { filename: 'atlas-inline.js' });
  return output;
}

export async function build(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const input = await readFile(resolve(root, 'index.html'), 'utf8');
  const output = patchPersistence(input);
  await mkdir(resolve(root, 'dist'), { recursive: true });
  await writeFile(resolve(root, 'dist/index.html'), output, 'utf8');
  console.log('Atlas build: both document-link actions persist; output dist/index.html');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await build();
}
