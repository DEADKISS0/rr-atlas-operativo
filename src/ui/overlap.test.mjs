import assert from 'node:assert/strict';
import test from 'node:test';
import { findLabelHits, findOverlaps, findOverflows, findPressMisalignments, findWordBreaks, intersectionArea } from './overlap.mjs';

test('dos cajas separadas no se pisan', () => {
  assert.equal(intersectionArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }), 0);
});

test('un padre y su hijo no cuentan como solape', () => {
  const hits = findOverlaps([
    { id: 'bar', name: 'barra', x: 0, y: 0, w: 100, h: 40, ancestors: [] },
    { id: 'btn', name: 'botón', x: 8, y: 4, w: 40, h: 32, ancestors: ['bar'] },
  ]);
  assert.equal(hits.length, 0);
});

test('una barra sobre una tarjeta sí cuenta', () => {
  const hits = findOverlaps([
    { id: 'tools', name: 'herramientas', role: 'chrome', x: 0, y: 0, w: 200, h: 80, ancestors: [] },
    { id: 'card', name: 'tarjeta', role: 'canvas', x: 20, y: 20, w: 100, h: 80, ancestors: [] },
  ]);
  assert.equal(hits.length, 1);
  assert.ok(hits[0].area > 64);
});

test('una hoja puede cubrir el lienzo y no la barra inferior', () => {
  const sheet = { id: 'sheet', name: 'detalle', role: 'overlay', x: 0, y: 400, w: 360, h: 260, ancestors: [] };
  const card = { id: 'card', name: 'tarjeta', role: 'canvas', x: 10, y: 420, w: 200, h: 80, ancestors: [] };
  const tab = { id: 'tab', name: 'barra', role: 'bar', x: 0, y: 680, w: 360, h: 64, ancestors: [] };
  assert.equal(findOverlaps([sheet, card, tab]).length, 0);
  const hits = findOverlaps([{ ...sheet, h: 320 }, tab]);
  assert.equal(hits.length, 1);
});

test('una etiqueta BPMN encima de una forma cuenta si cubre una parte', () => {
  const hits = findLabelHits(
    [{ id: 'lab', name: 'etiqueta entra', x: 10, y: 10, w: 40, h: 16, ancestors: [] }],
    [{ id: 'task', name: 'tarea', x: 0, y: 0, w: 80, h: 50, ancestors: [] }],
  );
  assert.equal(hits.length, 1);
});

test('un roce mínimo de etiqueta no cuenta', () => {
  const hits = findLabelHits(
    [{ id: 'lab', name: 'sí', x: 0, y: 0, w: 30, h: 14, ancestors: [] }],
    [{ id: 'task', name: 'tarea', x: 28, y: 0, w: 80, h: 40, ancestors: [] }],
  );
  assert.equal(hits.length, 0);
});

test('el texto desbordado se detecta y el que cabe no', () => {
  const hits = findOverflows([
    { name: 'título', overflow: true, scrollWidth: 420, clientWidth: 300 },
    { name: 'párrafo', overflow: true, scrollWidth: 200, clientWidth: 200 },
    { name: 'lista', overflow: false, scrollWidth: 800, clientWidth: 300 },
  ]);
  assert.deepEqual(hits.map((item) => item.name), ['título']);
});

test('una palabra en dos líneas cuenta como partida', () => {
  const hits = findWordBreaks([
    { name: 'Procesos', words: ['Procesos'] },
    { name: 'Mapa', words: [] },
  ]);
  assert.deepEqual(hits.map((item) => item.name), ['Procesos']);
});

test('la cara y la sombra descuadradas cuentan y un subpíxel no', () => {
  const hits = findPressMisalignments([
    { name: 'Mapa', face: { x: 8, y: 10, w: 70, h: 44 }, shadow: { x: 0, y: 14, w: 86, h: 48 } },
    { name: 'Menú', face: { x: 1, y: 1, w: 40, h: 44 }, shadow: { x: 1.4, y: 1.2, w: 40.5, h: 44.2 } },
  ]);
  assert.deepEqual(hits.map((item) => item.name), ['Mapa']);
});
