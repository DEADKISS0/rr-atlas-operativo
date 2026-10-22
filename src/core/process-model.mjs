/**
 * Dominio de procesos BPMN. No importa bpmn-js: el XML se trata como texto
 * y la persistencia usa una clave distinta a la del mapa.
 */
export const PROCESS_STORAGE_KEY = 'rr-atlas-processes-v1';
export const UNKNOWN = 'DESCONOCIDO';
export const PROCESS_STATES = Object.freeze(['borrador', 'por_validar', 'validado', 'obsoleto']);
export const RR_SYMBOLS = Object.freeze(['sobre', 'reloj', 'rayo', 'lista', 'candado']);

const AREAS = Object.freeze({
  ventas: 'Ventas',
  alianzas: 'Alianzas',
  clientes: 'Clientes',
  finanzas: 'Finanzas',
  ia: 'IA',
  produccion: 'Producción',
  legal: 'Legal',
  desarrollo: 'Desarrollo',
  soporte: 'Soporte',
  gobierno: 'Gobierno',
  informacion: 'Información',
});

const SENSITIVE = Object.freeze([
  { re: /\$\s*\d/, kind: 'monto' },
  { re: /\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/, kind: 'monto' },
  { re: /\b\d+\s*(?:cop|usd|pesos)\b/i, kind: 'monto' },
  { re: /\b(?:c[eé]dula|nit|cuenta(?:\s+bancaria)?)\b[^.\n]{0,24}\d{5,}/i, kind: 'documento o cuenta' },
  { re: /\b(?:sk-|sk_live|ghp_|xox[baprs]-|AKIA)[A-Za-z0-9]/, kind: 'token' },
]);

export function decodeXml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function presentValue(value) {
  const clean = String(value ?? '').trim();
  if (!clean || /^desconocido\b/i.test(clean)) return UNKNOWN;
  return clean;
}

export function areaFromFile(file) {
  const key = String(file).split('_')[0].replace(/\.bpmn$/, '');
  return { key, label: AREAS[key] || key };
}

function field(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${label}\\s*:\\s*([^\\n]+)`, 'i'));
    if (match) return decodeXml(match[1].trim());
  }
  return '';
}

function attr(source, name) {
  if (!source) return '';
  const match = source.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decodeXml(match[1]) : '';
}

export function parseProcessMeta(xml) {
  const source = String(xml ?? '');
  const open = source.match(/<bpmn:process\b([^>]*)>/);
  const block = source.match(/<bpmn:process\b[^>]*>([\s\S]*?)<\/bpmn:process>/);
  const body = block?.[1] ?? '';
  const documentation = decodeXml((body.match(/<bpmn:documentation>([\s\S]*?)<\/bpmn:documentation>/) ?? [])[1] ?? '').trim();
  const metaTag = (body.match(/<rr:meta\b([^>]*)\/?>/) ?? [])[1] ?? '';
  const corte = (documentation.match(/corte\s+(\d{4}-\d{2}-\d{2})/i) ?? [])[1] ?? '';
  const owner = attr(metaTag, 'owner') || field(documentation, ['Dueño del proceso', 'Dueno del proceso', 'Owner']);
  const kpi = attr(metaTag, 'kpi') || field(documentation, ['KPI']);
  const estado = attr(metaTag, 'estado');
  return {
    title: attr(open?.[1], 'name') || '',
    documentation,
    owner: presentValue(owner),
    ownerDetail: owner.trim(),
    kpi: presentValue(kpi),
    kpiDetail: kpi.trim(),
    lineaBase: presentValue(attr(metaTag, 'lineaBase') || field(documentation, ['Linea base', 'Línea base'])),
    estado: PROCESS_STATES.includes(estado) ? estado : '',
    revisadoPor: presentValue(attr(metaTag, 'revisadoPor')),
    fechaCorte: presentValue(attr(metaTag, 'fechaCorte') || corte),
    fuente: presentValue(field(documentation, ['Fuente'])),
  };
}

export function describeSeed(file, xml) {
  const meta = parseProcessMeta(xml);
  const area = areaFromFile(file);
  return {
    id: file.replace(/\.bpmn$/, ''),
    file,
    title: meta.title || file,
    area: area.label,
    areaKey: area.key,
    estado: meta.estado || 'por_validar',
    meta,
    source: 'semilla',
    revision: 1,
  };
}

export function listSteps(xml) {
  const steps = [];
  const re = /<bpmn:(startEvent|endEvent|task|userTask|serviceTask|manualTask|scriptTask|businessRuleTask|sendTask|receiveTask|exclusiveGateway|parallelGateway|inclusiveGateway|intermediateCatchEvent|intermediateThrowEvent)\b([^>]*?)(?:\/>|>)/g;
  for (const match of String(xml ?? '').matchAll(re)) {
    const name = attr(match[2], 'name');
    if (name) steps.push({ type: match[1], name });
  }
  return steps;
}

export function findSensitive(text) {
  const hits = [];
  const source = String(text ?? '');
  for (const pattern of SENSITIVE) {
    if (pattern.re.test(source)) hits.push(pattern.kind);
  }
  return hits;
}

export function createNewProcessXml({ name = 'Nuevo proceso', owner = UNKNOWN, kpi = UNKNOWN } = {}) {
  const title = escapeXml((name || 'Nuevo proceso').trim() || 'Nuevo proceso');
  const ownerValue = escapeXml(presentValue(owner));
  const kpiValue = escapeXml(presentValue(kpi));
  const id = `proc_${Date.now().toString(36)}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:rr="http://rraliados.com/schema/bpmn/rr" id="def_${id}" targetNamespace="https://rraliados.co/bpmn" exporter="RR Aliados · Atlas operativo" exporterVersion="4.1">
  <bpmn:collaboration id="collab_${id}">
    <bpmn:participant id="part_${id}" name="${title}" processRef="${id}"/>
  </bpmn:collaboration>
  <bpmn:process id="${id}" name="${title}" isExecutable="false">
    <bpmn:extensionElements>
      <rr:meta owner="${ownerValue}" kpi="${kpiValue}" lineaBase="DESCONOCIDO" estado="borrador" revisadoPor="DESCONOCIDO" fechaCorte="DESCONOCIDO"/>
    </bpmn:extensionElements>
    <bpmn:documentation>${title}
Dueno del proceso: ${ownerValue}
KPI: ${kpiValue}
Fuente: plantilla Nuevo proceso</bpmn:documentation>
    <bpmn:laneSet id="lanes_${id}">
      <bpmn:lane id="lane_a_${id}" name="Comercial">
        <bpmn:flowNodeRef>start_${id}</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="lane_b_${id}" name="Dirección">
        <bpmn:flowNodeRef>end_${id}</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="start_${id}" name="entra">
      <bpmn:outgoing>flow_${id}</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow_${id}" sourceRef="start_${id}" targetRef="end_${id}"/>
    <bpmn:endEvent id="end_${id}" name="cierra">
      <bpmn:incoming>flow_${id}</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diag_${id}">
    <bpmndi:BPMNPlane id="plane_${id}" bpmnElement="collab_${id}">
      <bpmndi:BPMNShape id="part_${id}_di" bpmnElement="part_${id}" isHorizontal="true">
        <dc:Bounds x="120" y="80" width="640" height="320"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="lane_a_${id}_di" bpmnElement="lane_a_${id}" isHorizontal="true">
        <dc:Bounds x="150" y="80" width="610" height="160"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="lane_b_${id}_di" bpmnElement="lane_b_${id}" isHorizontal="true">
        <dc:Bounds x="150" y="240" width="610" height="160"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="start_${id}_di" bpmnElement="start_${id}">
        <dc:Bounds x="232" y="142" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="230" y="185" width="40" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_${id}_di" bpmnElement="end_${id}">
        <dc:Bounds x="612" y="302" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="608" y="345" width="44" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow_${id}_di" bpmnElement="flow_${id}">
        <di:waypoint x="268" y="160"/>
        <di:waypoint x="430" y="160"/>
        <di:waypoint x="430" y="320"/>
        <di:waypoint x="612" y="320"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}

export function normalizeStoredProcess(input) {
  const source = input && typeof input === 'object' ? input : {};
  const estado = PROCESS_STATES.includes(source.estado) ? source.estado : 'borrador';
  const meta = source.meta && typeof source.meta === 'object' ? source.meta : {};
  return {
    id: String(source.id || `local_${Date.now().toString(36)}`),
    title: String(source.title || 'Nuevo proceso'),
    area: String(source.area || 'Local'),
    areaKey: String(source.areaKey || 'local'),
    xml: String(source.xml || ''),
    estado,
    source: source.source === 'semilla' ? 'semilla' : 'local',
    revision: Number.isFinite(source.revision) ? source.revision : 1,
    file: source.file ? String(source.file) : '',
    meta: {
      title: String(meta.title || source.title || ''),
      documentation: String(meta.documentation || ''),
      owner: presentValue(meta.owner),
      ownerDetail: String(meta.ownerDetail || ''),
      kpi: presentValue(meta.kpi),
      kpiDetail: String(meta.kpiDetail || ''),
      lineaBase: presentValue(meta.lineaBase),
      estado,
      revisadoPor: presentValue(meta.revisadoPor),
      fechaCorte: presentValue(meta.fechaCorte),
      fuente: presentValue(meta.fuente),
    },
  };
}

export function createLocalProcessRepository(storage, key = PROCESS_STORAGE_KEY) {
  return {
    load() {
      try {
        const raw = storage.getItem(key);
        if (!raw) return { schemaVersion: 1, processes: [] };
        const parsed = JSON.parse(raw);
        const processes = Array.isArray(parsed?.processes) ? parsed.processes.map(normalizeStoredProcess) : [];
        return { schemaVersion: 1, processes };
      } catch {
        return { schemaVersion: 1, processes: [] };
      }
    },
    save(document) {
      const processes = Array.isArray(document?.processes) ? document.processes.map(normalizeStoredProcess) : [];
      storage.setItem(key, JSON.stringify({ schemaVersion: 1, processes }));
    },
  };
}
