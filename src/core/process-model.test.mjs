import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROCESS_STORAGE_KEY,
  UNKNOWN,
  areaFromFile,
  createLocalProcessRepository,
  createNewProcessXml,
  describeSeed,
  findSensitive,
  parseProcessMeta,
  presentSource,
  presentValue,
  purposeFromDocumentation,
  listLanes,
} from './process-model.mjs';
import { rrModdle } from '../bpmn/rr-moddle.mjs';
import { NODE_COLORS, PALETTE_COLORS } from './atlas-state.mjs';

test('lee dueño y KPI desde documentation y marca DESCONOCIDO', () => {
  const xml = `<bpmn:process id="p" name="CÓMO SE CIERRA">
    <bpmn:documentation>CÓMO SE CIERRA
Dueno del proceso: DESCONOCIDO (el spec no lo declara)
KPI: DESCONOCIDO (el spec no lo declara)
Fuente: ejemplo.json
corte 2026-09-26</bpmn:documentation>
  </bpmn:process>`;
  const meta = parseProcessMeta(xml);
  assert.equal(meta.title, 'CÓMO SE CIERRA');
  assert.equal(meta.owner, UNKNOWN);
  assert.equal(meta.kpi, UNKNOWN);
  assert.equal(meta.fuente, 'ejemplo.json');
  assert.equal(meta.fechaCorte, '2026-09-26');
  assert.equal(presentValue(''), UNKNOWN);
});

test('lee rr:meta cuando existe', () => {
  const xml = `<bpmn:process id="p" name="Nuevo">
    <bpmn:extensionElements><rr:meta owner="Dirección" kpi="tiempo de ciclo" lineaBase="DESCONOCIDO" estado="borrador"/></bpmn:extensionElements>
    <bpmn:documentation>Nuevo
Dueno del proceso: Dirección
KPI: tiempo de ciclo</bpmn:documentation>
  </bpmn:process>`;
  const meta = parseProcessMeta(xml);
  assert.equal(meta.owner, 'Dirección');
  assert.equal(meta.kpi, 'tiempo de ciclo');
  assert.equal(meta.estado, 'borrador');
});

test('la plantilla nueva trae dos carriles y meta desconocida', () => {
  const xml = createNewProcessXml({ name: 'Proceso de prueba', owner: '', kpi: 'casos cerrados' });
  assert.match(xml, /name="Comercial"/);
  assert.match(xml, /name="Dirección"/);
  assert.match(xml, /owner="DESCONOCIDO"/);
  assert.match(xml, /kpi="casos cerrados"/);
  assert.match(xml, /estado="borrador"/);
  const described = describeSeed('finanzas_la_quincena.bpmn', xml);
  assert.equal(described.area, 'Finanzas');
  assert.equal(areaFromFile('ia_como.bpmn').label, 'IA');
});

test('el repositorio de procesos no toca la clave del mapa', () => {
  const bag = new Map();
  const storage = {
    getItem: (key) => bag.get(key) ?? null,
    setItem: (key, value) => bag.set(key, value),
  };
  storage.setItem('rr-atlas-v3', '{"data":[]}');
  const repository = createLocalProcessRepository(storage, PROCESS_STORAGE_KEY);
  assert.deepEqual(repository.load().processes, []);
  repository.save({ processes: [{ id: 'local_1', title: 'Nuevo', xml: '<xml/>', estado: 'raro' }] });
  assert.equal(storage.getItem('rr-atlas-v3'), '{"data":[]}');
  const loaded = repository.load();
  assert.equal(loaded.processes[0].estado, 'borrador');
  assert.equal(loaded.processes[0].meta.owner, UNKNOWN);
  assert.equal(PROCESS_STORAGE_KEY, 'rr-atlas-processes-v1');
});

test('el detector deja pasar las semillas anonimizadas y marca un monto', () => {
  assert.deepEqual(findSensitive('CLIENTE_X debe [CIFRA] el 15/10'), []);
  assert.deepEqual(findSensitive('PERSONA_X y EQUIPO_X'), []);
  assert.ok(findSensitive('pago de $1500').includes('monto'));
  assert.ok(findSensitive('token ghp_abcd1234').includes('token'));
});

test('el descriptor rr del runtime coincide con el json', async () => {
  const json = JSON.parse(await readFile(new URL('../bpmn/rr-moddle.json', import.meta.url), 'utf8'));
  assert.equal(json.uri, rrModdle.uri);
  assert.equal(json.prefix, rrModdle.prefix);
  assert.deepEqual(json.types.map((type) => type.name), rrModdle.types.map((type) => type.name));
});

test('la fuente técnica se muestra como ejemplo y el propósito queda legible', () => {
  const text = `CÓMO NACE UNA ALIANZA
Prospectos que entran por confianza de terceros, sin costo de adquisición. · corte 2026-09-26
Dueno del proceso: DESCONOCIDO (el spec no lo declara)
Fuente: _herramientas/esquemas_bpmn/alianzas.json`;
  assert.equal(purposeFromDocumentation(text), 'Prospectos que entran por confianza de terceros, sin costo de adquisición.');
  assert.equal(presentSource('_herramientas/esquemas_bpmn/alianzas.json'), 'Ejemplo anonimizado');
  assert.equal(presentSource('DESCONOCIDO'), 'Ejemplo anonimizado');
  const xml = `<bpmn:lane id="a" name="1 · Comercial"></bpmn:lane><bpmn:lane id="b" name="2 · Dirección"></bpmn:lane>`;
  assert.deepEqual(listLanes(xml), ['1 · Comercial', '2 · Dirección']);
});

test('los colores de nodo quedan dentro de la paleta oficial', () => {
  const official = new Set(['#be076d', '#ded116', '#973d8f', '#070001', '#fffff3']);
  for (const hex of Object.values(NODE_COLORS)) assert.ok(official.has(hex), hex);
  assert.deepEqual(PALETTE_COLORS, ['fuchsia', 'mustard', 'orchid', 'ink', 'paper']);
});
