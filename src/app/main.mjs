import { STORAGE_KEY, createLocalRepository } from '../core/atlas-state.mjs?v=media-7';
import { DEFAULT_GRAPH } from '../data/default-graph.mjs?v=media-7';
import { KNOWN_LINKS } from '../data/known-links.mjs?v=media-7';
import { createAtlasStore, DEFAULT_TYPES } from './atlas-store.mjs?v=media-7';
import { NODE_COLORS, NODE_SHAPES, MEDIA_KINDS } from '../core/atlas-state.mjs?v=media-7';
import { createAtlasShell } from '../ui/atlas-shell.mjs?v=media-7';
import { createAtlasView } from '../ui/atlas-view.mjs?v=media-7';
import { createMediaFrame } from '../ui/atlas-media.mjs?v=media-7';
import { bindAtlasEvents } from '../ui/atlas-events.mjs?v=media-7';

const rootElement = document.querySelector('#atlas-app');
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
  colors: Object.keys(NODE_COLORS),
  colorLabels: {
    fuchsia: 'Fucsia',
    mustard: 'Mostaza',
    orchid: 'Orquídea',
    ink: 'Negro',
    moss: 'Verde',
    blue: 'Azul',
    flag: 'Rojo bandera',
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

const toast = (message) => {
  rootElement.querySelector('[data-atlas-toast]').textContent = message;
  rootElement.querySelector('[data-atlas-toast]').hidden = false;
  window.setTimeout(() => { rootElement.querySelector('[data-atlas-toast]').hidden = true; }, 2800);
};

const applyTheme = (mode) => {
  const light = mode === 'light';
  document.body.classList.toggle('atlas-theme-light', light);
  root.theme.label.textContent = light ? 'Tema RR claro' : 'Tema RR oscuro';
  root.theme.toggle.setAttribute('aria-pressed', String(light));
  root.theme.toggle.title = light ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
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
  root.modal.attach.textContent = media ? 'Montar recurso' : 'Asociar enlace';
  root.modal.dialog.showModal();
};

const openViewer = (asset) => {
  root.viewer.title.textContent = asset.label;
  root.viewer.body.replaceChildren(createMediaFrame(asset));
  root.viewer.link.href = asset.url;
  root.viewer.dialog.showModal();
};

const store = createAtlasStore({ repository, initialGraph: DEFAULT_GRAPH });
const view = createAtlasView({
  root,
  store,
  onToast: toast,
  onLinkRequest(nodeId) { openAssetDialog(nodeId, 'link'); },
  onMediaRequest(nodeId) { openAssetDialog(nodeId, 'media'); },
  onMediaOpen: openViewer,
});

bindAtlasEvents({ root, store, view, knownLinks: KNOWN_LINKS, onToast: toast, applyTheme });
store.subscribe((snapshot) => view.render(snapshot));
