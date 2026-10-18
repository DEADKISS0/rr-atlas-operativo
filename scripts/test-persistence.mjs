import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateShell } from './build.mjs';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
validateShell(html);
assert.match(html, /src\/app\/main\.mjs/);
assert.match(html, /src\/styles\/tokens\.css/);
assert.doesNotMatch(html, /const DEFAULT=/);
assert.doesNotMatch(html, /localStorage\.setItem/);
assert.throws(() => validateShell('<!doctype html><html><body></body></html>'), /Missing shell marker/);
assert.throws(() => validateShell('<!doctype html>src/app/main.mjs src/styles/tokens.css src/styles/layout.css src/styles/components.css data-atlas-layout data-atlas-editor data-atlas-cards const DEFAULT=1'), /Application logic leaked/);

console.log('frontend shell regression: ok');
