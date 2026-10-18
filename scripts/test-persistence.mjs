import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { patchPersistence } from './build.mjs';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const output = patchPersistence(html);

assert.match(output, /get\(selected\)\.links\.push\(\[name,url\]\);const saved=persist\(\)/);
assert.match(output, /n\.links\.splice\(Number\(b\.dataset\.delDoc\),1\);const saved=persist\(\)/);
assert.match(output, /No se pudo guardar localmente/);
assert.throws(() => patchPersistence('<!doctype html><html><body></body></html><p>extra</p>'), /Incomplete HTML/);

console.log('persistence regression: ok');
