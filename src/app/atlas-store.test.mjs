import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtlasStore } from './atlas-store.mjs';

const base = {
  data: [
    { id: 'a', title: 'A', type: 'Proceso', desc: '', owner: '', status: '', notes: '', x: 0, y: 0, links: [] },
    { id: 'b', title: 'B', type: 'Cliente', desc: '', owner: '', status: '', notes: '', x: 100, y: 100, links: [] },
  ],
  lines: [],
};

function memoryRepository() {
  let saved = null;
  return {
    load: () => saved && structuredClone(saved),
    save: (value) => { saved = structuredClone(value); return value; },
  };
}

test('store publishes normalized state and keeps selection', () => {
  const store = createAtlasStore({ repository: memoryRepository(), initialGraph: base });
  const snapshots = [];
  store.subscribe((snapshot) => snapshots.push(snapshot));
  assert.equal(snapshots.at(-1).state.data.length, 2);
  store.select('b');
  store.updateNode('b', { title: 'Cliente B' });
  assert.equal(store.getSnapshot().state.data[1].title, 'Cliente B');
  assert.equal(store.getSnapshot().selectedId, 'b');
});

test('store supports connect, undo and redo without DOM', () => {
  const store = createAtlasStore({ repository: memoryRepository(), initialGraph: base });
  store.connect('a', 'b');
  assert.deepEqual(store.getSnapshot().state.lines, [['a', 'b']]);
  assert.equal(store.undo(), true);
  assert.deepEqual(store.getSnapshot().state.lines, []);
  assert.equal(store.redo(), true);
  assert.deepEqual(store.getSnapshot().state.lines, [['a', 'b']]);
});

test('store exports version 1 payload and imports it', () => {
  const store = createAtlasStore({ repository: memoryRepository(), initialGraph: base });
  const payload = store.exportPayload();
  assert.equal(payload.schemaVersion, 1);
  store.addNode({ id: 'c', title: 'C', type: 'Otro', x: 5, y: 5 });
  store.importSnapshot(JSON.stringify(payload));
  assert.equal(store.getSnapshot().state.data.length, 2);
});

test('store persists marker appearance and multimedia assets', () => {
  const store = createAtlasStore({ repository: memoryRepository(), initialGraph: base });
  store.updateNode('a', { shape: 'diamond', color: 'mustard' });
  store.addMedia('a', { id: 'm1', label: 'Manual PDF', url: 'https://cdn.example.com/manual.pdf', kind: 'auto' });
  const node = store.getSnapshot().state.data.find((item) => item.id === 'a');
  assert.equal(node.shape, 'diamond');
  assert.equal(node.color, 'mustard');
  assert.equal(node.media[0].kind, 'pdf');
  assert.equal(store.removeMedia('a', 'm1'), true);
  assert.equal(store.getSnapshot().state.data[0].media.length, 0);
});
