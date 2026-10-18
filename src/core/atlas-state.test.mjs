import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AtlasDataError,
  createLocalRepository,
  normalizeGraph,
  parseSnapshot,
  validateDriveLink,
  classifyMediaUrl,
  drivePreviewUrl,
  validateMediaAsset,
} from './atlas-state.mjs';

const graph = {
  data: [
    {
      id: 'a',
      title: 'A',
      type: 'Proceso',
      desc: '',
      owner: '',
      status: '',
      notes: '',
      x: 0,
      y: 0,
      links: [],
      shape: 'rectangle',
      color: 'fuchsia',
      media: [],
    },
    {
      id: 'b',
      title: 'B',
      type: 'Cliente',
      desc: '',
      owner: '',
      status: '',
      notes: '',
      x: 100,
      y: 100,
      links: [['Drive', 'https://drive.google.com/file/d/example/view']],
      shape: 'hexagon',
      color: 'blue',
      media: [],
    },
  ],
  lines: [['a', 'b']],
};

test('normalizes the legacy graph shape without mutation', () => {
  const input = structuredClone(graph);
  const normalized = normalizeGraph(input);
  assert.deepEqual(normalized, input);
  assert.notStrictEqual(normalized, input);
});

test('accepts version 1 exports', () => {
  const output = parseSnapshot(JSON.stringify({
    schemaVersion: 1,
    exportedAt: '2026-10-18T00:00:00.000Z',
    nodes: graph.data,
    edges: graph.lines,
    source: 'test',
  }));
  assert.deepEqual(output, graph);
});

test('adds safe defaults to legacy nodes and classifies media', () => {
  const legacy = structuredClone(graph);
  delete legacy.data[0].shape;
  delete legacy.data[0].color;
  delete legacy.data[0].media;
  const normalized = normalizeGraph(legacy);
  assert.equal(normalized.data[0].shape, 'rectangle');
  assert.equal(normalized.data[0].color, 'fuchsia');
  assert.deepEqual(normalized.data[0].media, []);
  assert.equal(classifyMediaUrl('https://cdn.example.com/photo.webp'), 'image');
  assert.equal(classifyMediaUrl('https://cdn.example.com/report.pdf'), 'pdf');
  assert.equal(drivePreviewUrl('https://drive.google.com/file/d/abc123/view'), 'https://drive.google.com/file/d/abc123/preview');
});

test('validates multimedia assets without allowing unsafe URLs', () => {
  const asset = validateMediaAsset({ id: 'm1', label: 'Demo', url: 'https://cdn.example.com/demo.mp4', kind: 'auto' });
  assert.equal(asset.kind, 'video');
  assert.throws(() => validateMediaAsset({ id: 'm2', label: 'Unsafe', url: 'javascript:alert(1)', kind: 'auto' }), AtlasDataError);
  assert.throws(() => validateMediaAsset({ id: 'm3', label: 'Creds', url: 'https://user:pass@example.com/file.pdf', kind: 'auto' }), AtlasDataError);
});

test('rejects unsafe Drive hosts and credentials', () => {
  assert.throws(() => validateDriveLink(['bad', 'https://evil.example/file']), AtlasDataError);
  assert.throws(() => validateDriveLink(['bad', 'https://drive.google.com:8443/file']), AtlasDataError);
  assert.throws(() => validateDriveLink(['bad', 'https://user:pass@drive.google.com/file']), AtlasDataError);
});

test('rejects duplicate nodes, dangling edges and self edges', () => {
  assert.throws(() => normalizeGraph({ ...graph, data: [graph.data[0], graph.data[0]] }), AtlasDataError);
  assert.throws(() => normalizeGraph({ ...graph, lines: [['a', 'missing']] }), AtlasDataError);
  assert.throws(() => normalizeGraph({ ...graph, lines: [['a', 'a']] }), AtlasDataError);
});

test('preserves the unsaved graph when storage write fails', () => {
  const storage = {
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
  };
  const repository = createLocalRepository(storage);
  assert.throws(() => repository.save(graph), (error) => error.code === 'STORAGE_WRITE_FAILED');
});

test('loads and saves through the storage adapter', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const repository = createLocalRepository(storage);
  repository.save(graph);
  assert.deepEqual(repository.load(), graph);
  repository.addLink('a', ['Docs', 'https://docs.google.com/document/d/example/edit']);
  assert.equal(repository.load().data[0].links.length, 1);
  repository.removeLink('a', 0);
  assert.equal(repository.load().data[0].links.length, 0);
});
