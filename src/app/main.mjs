import { STORAGE_KEY, createLocalRepository, PALETTE_COLORS } from '../core/atlas-state.mjs?v=bpmn-3';
import { DEFAULT_GRAPH } from '../data/default-graph.mjs?v=bpmn-3';
import { KNOWN_LINKS } from '../data/known-links.mjs?v=bpmn-3';
import { createAtlasStore, DEFAULT_TYPES } from './atlas-store.mjs?v=bpmn-3';
import { NODE_SHAPES, MEDIA_KINDS } from '../core/atlas-state.mjs?v=bpmn-3';
import { createAtlasShell } from '../ui/atlas-shell.mjs?v=bpmn-3';
import { createAtlasView } from '../ui/atlas-view.mjs?v=bpmn-3';
import { createMediaFrame } from '../ui/atlas-media.mjs?v=bpmn-3';
import { bindAtlasEvents } from '../ui/atlas-events.mjs?v=bpmn-3';
import { createProcessView } from '../ui/atlas-process-view.mjs?v=bpmn-3';
import { bindAtlasNavigation } from '../ui/atlas-nav.mjs?v=bpmn-3';
import { bindPressables } from '../ui/pressable.mjs?v=bpmn-3';
import { bindBottomSheet } from '../ui/sheet.mjs?v=bpmn-3';
import { bindTour } from '../ui/tour.mjs?v=bpmn-4';

const rootElement = document.querySelector('#atlas-app');
document.body.append(rootElement.querySelector('[data-atlas-toast]'));
const layout = rootElement.querySelector('[data-atlas-layout]');
const repository = createLocalRepository(window.localStorage, STORAGE_KEY);
const shell = createAtlasShell({ root: rootElement });
const root = {
  layout,
  shell,
  world: rootElement.querySelector('[data-atlas-world]'),
  work: rootElement.querySelector('[data-atlas-work]'),
  cards: rootElement.querySelector('[data-atlas-cards]'),
  wires: rootElement.querySelector('[data-atlas-wires]'),
  editor: rootElement.querySelector('[data-atlas-editor]'),
  count: rootElement.querySelector('[data-atlas-count]'),
  status: rootElement.querySelector('[data-atlas-status]'),
  search: rootElement.querySelector('[data-atlas-search]'),
  fileInput: rootElement.querySelector('[data-atlas-file]'),
  minimap: rootElement.querySelector('.atlas-minimap'),
  settings: rootElement.querySelector('[data-atlas-settings]'),
  drawMenu: rootElement.querySelector('[data-atlas-draw-menu]'),
  minimapCanvas: rootElement.querySelector('[data-atlas-minimap-canvas]'),
  minimapCount: rootElement.querySelector('[data-atlas-minimap-count]'),
  types: DEFAULT_TYPES,
  shapes: NODE_SHAPES,
  shapeLabels: {
    rectangle: 'Rectángulo',
    rounded: 'Redondeada',
    pill: 'Píldora',
    circle: 'Círculo',
    diamond: 'Rombo',
    hexagon: 'Hexágono',
    note: 'Nota',
  },
  colors: PALETTE_COLORS,
  colorLabels: {
    fuchsia: 'Fucsia',
    mustard: 'Mostaza',
    orchid: 'Orquídea',
    ink: 'Negro',
    paper: 'Blanco',
    moss: 'Orquídea',
    blue: 'Blanco',
    flag: 'Fucsia',
  },
  mediaKinds: MEDIA_KINDS,
  railButtons: [...rootElement.querySelectorAll('[data-atlas-filter]')],
  actions: {
    toggleRail: rootElement.querySelector('[data-action="toggle-rail"]'),
    toggleSettings: rootElement.querySelector('[data-action="toggle-settings"]'),
    add: rootElement.querySelector('[data-action="add"]'),
    draw: rootElement.querySelector('[data-action="draw"]'),
    connect: rootElement.querySelector('[data-action="connect"]'),
    zoomIn: rootElement.querySelector('[data-action="zoom-in"]'),
    zoomOut: rootElement.querySelector('[data-action="zoom-out"]'),
    center: rootElement.querySelector('[data-action="center"]'),
    locate: rootElement.querySelector('[data-action="locate"]'),
    toggleTools: rootElement.querySelector('[data-action="toggle-tools"]'),
    flow: rootElement.querySelector('[data-action="flow"]'),
    undo: rootElement.querySelector('[data-action="undo"]'),
    redo: rootElement.querySelector('[data-action="redo"]'),
    reset: rootElement.querySelector('[data-action="reset"]'),
    export: rootElement.querySelector('[data-action="export"]'),
    import: rootElement.querySelector('[data-action="import"]'),
    toggleMinimap: rootElement.querySelector('[data-action="toggle-minimap"]'),
    toggleWires: rootElement.querySelector('[data-action="toggle-wires"]'),
  },
  modal: {
    dialog: rootElement.querySelector('[data-atlas-dialog]'),
    title: rootElement.querySelector('[data-atlas-dialog-title]'),
    help: rootElement.querySelector('[data-atlas-dialog-help]'),
    choices: rootElement.querySelector('[data-atlas-choices]'),
    name: rootElement.querySelector('[data-atlas-link-name]'),
    url: rootElement.querySelector('[data-atlas-link-url]'),
    kindRow: rootElement.querySelector('[data-atlas-kind-row]'),
    kind: rootElement.querySelector('[data-atlas-asset-kind]'),
    attach: rootElement.querySelector('[data-atlas-attach]'),
    cancel: rootElement.querySelector('[data-action="cancel-link"]'),
    nodeId: null,
    mode: 'media',
  },
  viewer: {
    dialog: rootElement.querySelector('[data-atlas-viewer-dialog]'),
    title: rootElement.querySelector('[data-atlas-viewer-title]'),
    body: rootElement.querySelector('[data-atlas-viewer-body]'),
    link: rootElement.querySelector('[data-atlas-viewer-link]'),
    close: rootElement.querySelector('[data-action="close-viewer"]'),
  },
  theme: {
    toggle: rootElement.querySelector('[data-action="toggle-theme"]'),
    label: rootElement.querySelector('[data-atlas-theme-label]'),
  },
};

let undoLast = () => false;
let toastTimer = 0;
const toast = (message, options = {}) => {
  const el = document.querySelector('[data-atlas-toast]');
  el.replaceChildren();
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  if (options.undo) {
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'atlas-button';
    undo.textContent = 'Deshacer';
    undo.addEventListener('click', () => {
      undoLast();
      el.hidden = true;
    });
    el.append(undo);
  }
  el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, 3200);
};

const applyTheme = (mode) => {
  const light = mode === 'light';
  document.body.classList.toggle('atlas-theme-light', light);
  root.theme.label.textContent = light ? 'Tema RR claro' : 'Tema RR oscuro';
  root.theme.toggle.setAttribute('aria-pressed', String(light));
  root.theme.toggle.title = light ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
  document.dispatchEvent(new CustomEvent('atlas-theme', { detail: { mode } }));
};

const savedTheme = window.localStorage.getItem('rr-atlas-theme') === 'light' ? 'light' : 'dark';
applyTheme(savedTheme);

const openAssetDialog = (nodeId, mode) => {
  root.modal.nodeId = nodeId;
  root.modal.mode = mode;
  root.modal.name.value = '';
  root.modal.url.value = '';
  root.modal.kind.value = 'auto';
  const media = mode === 'media';
  root.modal.title.textContent = media ? 'Agregar recurso multimedia' : 'Asociar enlace de Drive';
  root.modal.help.textContent = media
    ? 'Agrega una URL HTTPS. Drive, Docs, imágenes, videos, audio y PDF se intentan montar de forma segura.'
    : 'El enlace queda como referencia del nodo; no se copian archivos ni se guardan tokens.';
  root.modal.kindRow.hidden = !media;
  const attachFace = root.modal.attach.querySelector(':scope > .rr-press-face');
  if (attachFace) attachFace.textContent = media ? 'Montar recurso' : 'Asociar enlace';
  else root.modal.attach.textContent = media ? 'Montar recurso' : 'Asociar enlace';
  root.modal.dialog.showModal();
};

const openViewer = (asset) => {
  root.viewer.title.textContent = asset.label;
  root.viewer.body.replaceChildren(createMediaFrame(asset));
  root.viewer.link.href = asset.url;
  root.viewer.dialog.showModal();
};

const store = createAtlasStore({ repository, initialGraph: DEFAULT_GRAPH });
undoLast = () => store.undo();
const view = createAtlasView({
  root,
  store,
  onToast: toast,
  onInspect(id) {
    rootElement.classList.add('is-detail-open');
    rootElement.querySelector('.atlas-sidebar')?.classList.remove('is-shown');
    requestAnimationFrame(() => view.frameNode(id));
  },
  onLinkRequest(nodeId) { openAssetDialog(nodeId, 'link'); },
  onMediaRequest(nodeId) { openAssetDialog(nodeId, 'media'); },
  onMediaOpen: openViewer,
});

bindAtlasEvents({ root, store, view, knownLinks: KNOWN_LINKS, onToast: toast, applyTheme });
const processView = createProcessView({ app: rootElement, onToast: toast });
bindAtlasNavigation({ app: rootElement, search: root.search, processView });
bindPressables(rootElement);
bindBottomSheet(rootElement.querySelector('.atlas-sidebar'), {
  app: rootElement,
  onClose: () => rootElement.classList.remove('is-detail-open'),
});
bindTour({ app: rootElement });
store.subscribe((snapshot) => view.render(snapshot));
