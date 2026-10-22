import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import Modeler from 'bpmn-js/lib/Modeler';
import { rrModdle } from './rr-moddle.mjs';
import { rrRendererModule } from './rr-renderer.mjs';
import { readRrTheme } from './rr-theme.mjs';
import { validateXml } from './lint/run.mjs';
import { findSensitive } from '../core/process-model.mjs';

function bindPinch(container, getCanvas) {
  const points = new Map();
  let start = null;
  const position = (event) => {
    const rect = container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  container.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    points.set(event.pointerId, position(event));
  });
  container.addEventListener('pointermove', (event) => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, position(event));
    if (points.size < 2) return;
    event.preventDefault();
    const [a, b] = [...points.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const canvas = getCanvas();
    if (!canvas) return;
    if (!start) start = { distance, zoom: canvas.zoom() };
    const next = Math.max(0.2, Math.min(4, start.zoom * (distance / start.distance)));
    canvas.zoom(next, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }, { passive: false });
  const end = (event) => {
    points.delete(event.pointerId);
    if (points.size < 2) start = null;
  };
  container.addEventListener('pointerup', end);
  container.addEventListener('pointercancel', end);
}

async function rasterize(svg, { logoUrl, footer, background }) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const logo = logoUrl ? await loadImage(logoUrl).catch(() => null) : null;
    const width = image.naturalWidth || 1200;
    const height = (image.naturalHeight || 800) + 72;
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height - 72);
    if (logo) context.drawImage(logo, 16, height - 60, 48, 36);
    context.fillStyle = background === '#070001' ? '#fffff3' : '#070001';
    context.font = '14px Arial, sans-serif';
    context.fillText(footer, 76, height - 36);
    return await new Promise((resolveBlob) => canvas.toBlob(resolveBlob, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolveImage, reject) => {
    const image = new Image();
    image.onload = () => resolveImage(image);
    image.onerror = () => reject(new Error('No se pudo leer la imagen'));
    image.src = url;
  });
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createBpmnWorkspace({ container, onReport }) {
  let viewer = null;
  let mode = 'view';
  let currentXml = '';
  let debt = null;
  let fileName = '';
  let pinchBound = false;

  async function ensure(nextMode) {
    if (viewer && mode === nextMode) return;
    viewer?.destroy();
    const theme = readRrTheme();
    const Ctor = nextMode === 'edit' ? Modeler : NavigatedViewer;
    viewer = new Ctor({
      container,
      additionalModules: [rrRendererModule],
      moddleExtensions: { rr: rrModdle },
      bpmnRenderer: {
        defaultFillColor: theme.fill,
        defaultStrokeColor: theme.stroke,
      },
    });
    mode = nextMode;
    if (!pinchBound) {
      bindPinch(container, () => viewer?.get('canvas'));
      pinchBound = true;
    }
    if (nextMode === 'edit') {
      viewer.on('commandStack.changed', async () => {
        try {
          const saved = await viewer.saveXML({ format: true });
          currentXml = saved.xml;
          onReport?.(await validateXml(currentXml, { fileName, debt }));
        } catch {
          onReport?.({ ok: false, importError: 'No se pudo guardar el diagrama', moddleWarnings: [], issues: [], errors: [], warnings: [], debt: [] });
        }
      });
    }
  }

  function restyle() {
    if (!viewer) return;
    const registry = viewer.get('elementRegistry');
    const graphics = viewer.get('graphicsFactory');
    registry.forEach((element) => {
      const gfx = registry.getGraphics(element);
      if (!gfx) return;
      graphics.update(element.waypoints ? 'connection' : 'shape', element, gfx);
    });
  }

  return {
    setDebt(value) { debt = value; },
    async open(xml, options = {}) {
      fileName = options.fileName || '';
      await ensure(options.editable ? 'edit' : 'view');
      currentXml = xml;
      const report = await validateXml(xml, { fileName, debt });
      if (report.importError) {
        onReport?.(report);
        return report;
      }
      await viewer.importXML(xml);
      viewer.get('canvas').zoom('fit-viewport', 'auto');
      onReport?.(report);
      return report;
    },
    fit() { viewer?.get('canvas').zoom('fit-viewport', 'auto'); },
    zoom(factor) {
      const canvas = viewer?.get('canvas');
      if (!canvas) return;
      canvas.zoom(Math.max(0.2, Math.min(4, canvas.zoom() * factor)));
    },
    focus(id) {
      if (!viewer || !id) return;
      const element = viewer.get('elementRegistry').get(id);
      if (!element) return;
      viewer.get('canvas').scrollToElement(element, { top: 24, right: 24, bottom: 24, left: 24 });
      try { viewer.get('selection').select(element); } catch { /* el visor no selecciona */ }
    },
    restyle,
    async xml() {
      if (viewer && mode === 'edit') {
        const saved = await viewer.saveXML({ format: true });
        currentXml = saved.xml;
      }
      return currentXml;
    },
    async exportXml(filename) {
      const xml = await this.xml();
      const hits = findSensitive(xml);
      if (hits.length) throw new Error(`Exportación detenida: hay ${hits.join(', ')}.`);
      download(new Blob([xml], { type: 'application/bpmn+xml' }), filename);
    },
    async exportSvg(filename) {
      const { svg } = await viewer.saveSVG();
      download(new Blob([svg], { type: 'image/svg+xml' }), filename);
    },
    async exportPng(filename, { logoUrl, footer }) {
      const { svg } = await viewer.saveSVG();
      const light = document.body.classList.contains('atlas-theme-light');
      const blob = await rasterize(svg, {
        logoUrl,
        footer,
        background: light ? '#fffff3' : '#070001',
      });
      if (!blob) throw new Error('No se pudo crear el PNG');
      download(blob, filename);
    },
    destroy() {
      viewer?.destroy();
      viewer = null;
    },
  };
}
