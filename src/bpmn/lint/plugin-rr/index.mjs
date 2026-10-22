import { findSensitive, RR_SYMBOLS } from '../../../core/process-model.mjs';

function is(element, type) {
  return Boolean(element && typeof element.$instanceOf === 'function' && element.$instanceOf(type));
}

function documentation(element) {
  return (element?.documentation || []).map((item) => item.text || '').join('\n');
}

function elementText(element) {
  return [element?.name, element?.text, documentation(element)].filter(Boolean).join('\n');
}

const STAGE_RE = /^(?:\d+\s*[·.\-–])|\betapa\b|\bfase\b|\bpaso\s+\d|\bpersona\b|\bsr\.?\b|\bsra\.?\b/i;
const INFINITIVE_RE = /(ar|er|ir)$/i;

function taskWords(name) {
  return String(name || '').replace(/^\d+\.\s*/, '').trim().split(/\s+/).filter(Boolean);
}

function collectProcess(process, bag) {
  for (const element of process.flowElements || []) {
    bag.push(element);
    if (element.flowElements) collectProcess(element, bag);
  }
  for (const set of process.laneSets || []) {
    for (const lane of set.lanes || []) bag.push(lane);
  }
  for (const artifact of process.artifacts || []) bag.push(artifact);
}

export function laneEsRol() {
  return {
    check(node, reporter) {
      if (!is(node, 'bpmn:Lane') || !node.name) return;
      if (STAGE_RE.test(node.name)) {
        reporter.report(node.id, `El carril «${node.name}» parece una etapa o una persona. En RR un carril es un rol.`);
      }
    },
  };
}

export function tareaInfinitivo() {
  return {
    check(node, reporter) {
      if (!is(node, 'bpmn:Task') && !is(node, 'bpmn:UserTask') && !is(node, 'bpmn:ServiceTask') && !is(node, 'bpmn:ManualTask')) return;
      if (!node.name) return;
      const words = taskWords(node.name);
      const verb = words[0] || '';
      if (words.length < 2 || words.length > 6 || !INFINITIVE_RE.test(verb)) {
        reporter.report(node.id, `«${node.name}» debería ser un infinitivo corto, de 2 a 6 palabras.`);
      }
    },
  };
}

export function gatewayPregunta() {
  return {
    check(node, reporter) {
      if (!is(node, 'bpmn:ExclusiveGateway')) return;
      const outgoing = node.outgoing || [];
      if (outgoing.length < 2) return;
      if (!/[?¿]/.test(node.name || '')) {
        reporter.report(node.id, 'La compuerta exclusiva necesita una pregunta en el nombre.');
      }
      for (const flow of outgoing) {
        if (!String(flow.name || '').trim()) {
          reporter.report(node.id, `La salida ${flow.id || ''} no tiene nombre (Si o No).`);
        }
      }
    },
  };
}

export function ownerKpi() {
  return {
    check(node, reporter) {
      if (!is(node, 'bpmn:Process')) return;
      const text = documentation(node);
      const meta = (node.extensionElements?.values || []).find((value) => is(value, 'rr:Meta') || value.$type === 'rr:Meta');
      const owner = meta?.owner || /due[nñ]o del proceso\s*:/i.test(text);
      const kpi = meta?.kpi || /(?:^|\n)\s*kpi\s*:/i.test(text);
      if (!owner || !kpi) {
        reporter.report(node.id, 'Faltan el dueño y el KPI. Si no constan, el valor es DESCONOCIDO.');
      }
    },
  };
}

export function sinDatosSensibles() {
  return {
    check(node, reporter) {
      if (!node?.id || is(node, 'bpmn:Definitions')) return;
      const hits = findSensitive(elementText(node));
      if (hits.length) {
        reporter.report(node.id, `Hay un dato sensible (${hits.join(', ')}). Usa [CIFRA], CLIENTE_X o PERSONA_X.`);
      }
    },
  };
}

export function simboloValido() {
  return {
    check(node, reporter) {
      const symbol = node?.sim || node?.$attrs?.['rr:sim'];
      if (!symbol) return;
      if (!RR_SYMBOLS.includes(symbol)) {
        reporter.report(node.id, `El símbolo «${symbol}» no es sobre, reloj, rayo, lista ni candado.`);
      }
    },
  };
}

function processOf(node) {
  let current = node;
  while (current && !is(current, 'bpmn:Process')) current = current.$parent;
  return current;
}

export function messageflowEntrePools() {
  return {
    check(node, reporter) {
      if (!is(node, 'bpmn:MessageFlow')) return;
      const left = processOf(node.sourceRef);
      const right = processOf(node.targetRef);
      if (left && right && left === right) {
        reporter.report(node.id, 'El flujo de mensaje une dos elementos del mismo pool.');
      }
    },
  };
}

export function diCompleto() {
  return {
    check(node, reporter) {
      if (!is(node, 'bpmn:Definitions')) return;
      const diagrams = node.diagrams || [];
      const items = diagrams.flatMap((diagram) => diagram.plane?.planeElement || []);
      const shapes = new Set();
      const edges = new Set();
      const boxes = [];
      for (const item of items) {
        const id = item.bpmnElement?.id;
        if (!id) continue;
        if (is(item, 'bpmndi:BPMNShape')) {
          shapes.add(id);
          const bounds = item.bounds;
          const semantic = item.bpmnElement;
          const structural = is(semantic, 'bpmn:Lane') || is(semantic, 'bpmn:Participant');
          if (bounds && semantic && !structural) {
            boxes.push({ id, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
          }
        }
        if (is(item, 'bpmndi:BPMNEdge')) edges.add(id);
      }
      const elements = [];
      for (const root of node.rootElements || []) {
        if (is(root, 'bpmn:Process')) collectProcess(root, elements);
        if (is(root, 'bpmn:Collaboration')) {
          for (const participant of root.participants || []) elements.push(participant);
          for (const flow of root.messageFlows || []) elements.push(flow);
        }
      }
      for (const element of elements) {
        if (!element.id) continue;
        const needsShape = is(element, 'bpmn:FlowNode') || is(element, 'bpmn:Lane') || is(element, 'bpmn:Participant') || is(element, 'bpmn:DataObjectReference') || is(element, 'bpmn:DataStoreReference') || is(element, 'bpmn:TextAnnotation');
        const needsEdge = is(element, 'bpmn:SequenceFlow') || is(element, 'bpmn:MessageFlow') || is(element, 'bpmn:Association');
        if (needsShape && !shapes.has(element.id)) reporter.report(element.id, 'Falta la forma BPMNShape.');
        if (needsEdge && !edges.has(element.id)) reporter.report(element.id, 'Falta la arista BPMNEdge.');
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const overlapW = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapH = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          if (overlapW > 12 && overlapH > 12) reporter.report(a.id, `Se solapa con ${b.id}.`);
        }
      }
    },
  };
}

export const rrRules = Object.freeze({
  'lane-es-rol': laneEsRol,
  'tarea-infinitivo': tareaInfinitivo,
  'gateway-pregunta': gatewayPregunta,
  'owner-kpi': ownerKpi,
  'sin-datos-sensibles': sinDatosSensibles,
  'simbolo-valido': simboloValido,
  'messageflow-entre-pools': messageflowEntrePools,
  'di-completo': diCompleto,
});

export const rrRecommended = Object.freeze({
  rules: {
    'lane-es-rol': 'warn',
    'tarea-infinitivo': 'warn',
    'gateway-pregunta': 'error',
    'owner-kpi': 'error',
    'sin-datos-sensibles': 'error',
    'simbolo-valido': 'warn',
    'messageflow-entre-pools': 'error',
    'di-completo': 'error',
  },
});
