import inherits from 'inherits-browser';
import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { readRrTheme } from './rr-theme.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';

function docs(business) {
  return (business?.documentation || []).map((item) => item.text || '').join(' ');
}

function kindOf(element) {
  const business = element.businessObject || {};
  const explicit = business.semantica || business.$attrs?.['rr:semantica'] || '';
  const blob = `${business.name || ''} ${docs(business)}`.toLowerCase();
  if (explicit === 'traba' || /se traba|control rojo|se pierde/.test(blob)) return 'traba';
  if (explicit === 'dato' || element.type === 'bpmn:DataObjectReference' || element.type === 'bpmn:DataStoreReference' || element.type === 'bpmn:DataObject') return 'dato';
  if (explicit === 'atencion' || element.type === 'bpmn:ExclusiveGateway' || element.type === 'bpmn:InclusiveGateway' || element.type === 'bpmn:ParallelGateway') return 'atencion';
  if (element.type === 'bpmn:StartEvent' || explicit === 'ok') return 'entra';
  if (element.type === 'bpmn:EndEvent') return 'fin';
  if (element.type === 'bpmn:Lane' || element.type === 'bpmn:Participant') return 'lane';
  return 'base';
}

function strokeFor(kind, theme) {
  if (kind === 'traba') return theme.alarm;
  if (kind === 'atencion') return theme.attention;
  if (kind === 'dato') return theme.muted;
  if (kind === 'lane') return theme.lane;
  if (kind === 'fin') return theme.end;
  return theme.stroke;
}

function addWord(parent, word, color, x, y) {
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('class', 'rr-sem-word');
  text.setAttribute('x', String(x));
  text.setAttribute('y', String(y));
  text.setAttribute('fill', color);
  text.setAttribute('font-size', '12');
  text.textContent = word;
  parent.appendChild(text);
}

function quarterTurn(transform) {
  if (!transform) return false;
  if (/rotate\(\s*(?:-?90|270|-270)\b/.test(transform)) return true;
  const match = /matrix\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)[\s,]+([-\d.eE+]+)[\s,]+([-\d.eE+]+)/.exec(transform);
  if (!match) return false;
  const [a, b, c, d] = match.slice(1).map(Number);
  return Math.abs(a) < 0.02 && Math.abs(d) < 0.02 && Math.abs(Math.abs(b) - 1) < 0.02 && Math.abs(Math.abs(c) - 1) < 0.02;
}

function unrotateLaneLabel(parent, x, y) {
  parent.querySelectorAll('text').forEach((text) => {
    if (!quarterTurn(text.getAttribute('transform') || '')) return;
    text.removeAttribute('transform');
    if (text.transform?.baseVal) text.transform.baseVal.clear();
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y));
    text.querySelectorAll('tspan').forEach((span) => {
      span.setAttribute('x', String(x));
      span.setAttribute('y', String(y));
    });
  });
}

function paint(parent, element) {
  const theme = readRrTheme();
  const kind = kindOf(element);
  const stroke = strokeFor(kind, theme);
  parent.querySelectorAll('rect, circle, polygon, path, ellipse, polyline').forEach((node) => {
    if (node.getAttribute('stroke') && node.getAttribute('stroke') !== 'none') node.setAttribute('stroke', stroke);
    const fill = node.getAttribute('fill');
    if (fill && fill !== 'none') node.setAttribute('fill', theme.fill);
    if (node.localName === 'rect' && Number(node.getAttribute('rx') || 0) > 3) {
      node.setAttribute('rx', '3');
      node.setAttribute('ry', '3');
    }
  });
  if (kind === 'fin') {
    const circles = [...parent.querySelectorAll('circle')];
    circles.forEach((circle, index) => {
      circle.setAttribute('stroke', theme.end);
      circle.setAttribute('stroke-width', index === 0 ? '4' : '1.5');
      const throws = (element.businessObject?.eventDefinitions || []).length > 0;
      if (throws && index === 0) circle.setAttribute('fill', theme.end);
    });
  }
  if (kind === 'atencion') {
    parent.querySelectorAll('path, polygon').forEach((node) => {
      node.setAttribute('stroke', theme.attention);
      node.setAttribute('stroke-width', '2.4');
    });
  }
  if (kind === 'traba') {
    parent.querySelectorAll('rect').forEach((node) => node.setAttribute('stroke-width', '3'));
    addWord(parent, 'se traba', theme.alarm, 8, 16);
  }
  if (kind === 'entra') addWord(parent, 'entra', theme.stroke, 0, -6);
  if (kind === 'dato') addWord(parent, 'dato', theme.muted, 4, Math.max(16, (element.height || 50) - 6));
  if (kind === 'lane') {
    const pool = element.type === 'bpmn:Participant';
    unrotateLaneLabel(parent, pool ? 8 : 12, pool ? 16 : 18);
    parent.querySelectorAll('text').forEach((text) => text.classList.add('rr-lane-label'));
  }
  parent.querySelectorAll('text').forEach((text) => {
    if (!text.classList.contains('rr-sem-word')) text.setAttribute('fill', theme.text);
  });
  parent.dataset.rrKind = kind;
}

function paintConnection(parent) {
  const theme = readRrTheme();
  parent.querySelectorAll('path, polyline, polygon').forEach((node) => {
    if (node.getAttribute('stroke') && node.getAttribute('stroke') !== 'none') node.setAttribute('stroke', theme.muted);
    const fill = node.getAttribute('fill');
    if (fill && fill !== 'none') node.setAttribute('fill', theme.muted);
  });
}

export default function RrRenderer(eventBus, bpmnRenderer) {
  BaseRenderer.call(this, eventBus, 1500);
  this.bpmnRenderer = bpmnRenderer;
}

inherits(RrRenderer, BaseRenderer);

RrRenderer.$inject = ['eventBus', 'bpmnRenderer'];

RrRenderer.prototype.canRender = function canRender(element) {
  return Boolean(element?.type?.startsWith('bpmn:') && !element.labelTarget);
};

RrRenderer.prototype.drawShape = function drawShape(parent, element) {
  const shape = this.bpmnRenderer.drawShape(parent, element);
  paint(parent, element);
  return shape;
};

RrRenderer.prototype.drawConnection = function drawConnection(parent, element) {
  const connection = this.bpmnRenderer.drawConnection(parent, element);
  paintConnection(parent, element);
  return connection;
};

RrRenderer.prototype.getShapePath = function getShapePath(shape) {
  return this.bpmnRenderer.getShapePath(shape);
};

RrRenderer.prototype.getConnectionPath = function getConnectionPath(connection) {
  return this.bpmnRenderer.getConnectionPath(connection);
};

export const rrRendererModule = {
  __init__: ['rrRenderer'],
  rrRenderer: ['type', RrRenderer],
};
