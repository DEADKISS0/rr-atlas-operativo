import { normalizeGraph, parseSnapshot } from '../core/atlas-state.mjs?v=bpmn-3';

const clone = (value) => JSON.parse(JSON.stringify(value));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const graphOf = (state) => ({ data: state.data, lines: state.lines });

export const DEFAULT_TYPES = Object.freeze([
  'Gobierno',
  'Proceso',
  'Cliente',
  'Prospecto',
  'Producto reutilizable',
  'Producto propio',
  'Experimento comercial',
  'Area',
  'Talento',
  'Herramienta interna',
  'Control',
  'Otro',
]);

export function createAtlasStore({ repository, initialGraph, historyLimit = 20 }) {
  const listeners = new Set();
  const history = [];
  const future = [];
  let state = normalizeGraph(initialGraph);
  let selectedId = state.data[0]?.id ?? null;
  let filter = 'Todo';
  let query = '';

  try {
    const saved = repository.load();
    if (saved) state = saved;
  } catch {
    // The view reports storage errors; the validated base graph remains usable.
  }

  const emit = (reason) => {
    for (const listener of listeners) listener({ state: clone(state), selectedId, filter, query, reason });
  };

  const commit = (next, reason) => {
    const normalized = normalizeGraph(next);
    if (same(normalized, graphOf(state))) return false;
    history.push(clone(state));
    if (history.length > historyLimit) history.shift();
    future.length = 0;
    state = normalized;
    repository.save(state);
    emit(reason);
    return true;
  };

  const getNode = (id) => state.data.find((node) => node.id === id) ?? null;

  return Object.freeze({
    subscribe(listener) {
      listeners.add(listener);
      listener({ state: clone(state), selectedId, filter, query, reason: 'init' });
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return { state: clone(state), selectedId, filter, query };
    },
    select(id) {
      if (!getNode(id)) return false;
      selectedId = id;
      emit('select');
      return true;
    },
    setFilter(nextFilter) {
      filter = nextFilter;
      emit('filter');
    },
    setQuery(nextQuery) {
      query = nextQuery;
      emit('query');
    },
    updateNode(id, patch) {
      const current = getNode(id);
      if (!current) return false;
      const next = clone(state);
      Object.assign(next.data.find((node) => node.id === id), patch);
      return commit(next, 'update-node');
    },
    moveNode(id, x, y) {
      const current = getNode(id);
      if (!current) return false;
      const next = clone(state);
      const node = next.data.find((item) => item.id === id);
      node.x = x;
      node.y = y;
      return commit(next, 'move-node');
    },
    addNode(node) {
      const next = clone(state);
      next.data.push({ links: [], media: [], shape: 'rectangle', color: 'fuchsia', owner: '', status: 'Por definir', notes: '', ...node });
      selectedId = node.id;
      return commit(next, 'add-node');
    },
    deleteNode(id) {
      const next = clone(state);
      next.data = next.data.filter((node) => node.id !== id);
      next.lines = next.lines.filter(([source, target]) => source !== id && target !== id);
      const changed = commit(next, 'delete-node');
      if (changed && selectedId === id) selectedId = next.data[0]?.id ?? null;
      return changed;
    },
    connect(source, target) {
      const next = clone(state);
      if (source === target || next.lines.some(([a, b]) => a === source && b === target)) return false;
      next.lines.push([source, target]);
      return commit(next, 'connect');
    },
    addLink(id, link) {
      const next = clone(state);
      const node = next.data.find((item) => item.id === id);
      if (!node) return false;
      node.links.push(link);
      return commit(next, 'add-link');
    },
    addMedia(id, asset) {
      const next = clone(state);
      const node = next.data.find((item) => item.id === id);
      if (!node) return false;
      node.media ??= [];
      node.media.push(asset);
      return commit(next, 'add-media');
    },
    removeMedia(id, mediaId) {
      const next = clone(state);
      const node = next.data.find((item) => item.id === id);
      if (!node) return false;
      node.media = (node.media ?? []).filter((asset) => asset.id !== mediaId);
      return commit(next, 'remove-media');
    },
    removeLink(id, index) {
      const next = clone(state);
      const node = next.data.find((item) => item.id === id);
      if (!node || index < 0 || index >= node.links.length) return false;
      node.links.splice(index, 1);
      return commit(next, 'remove-link');
    },
    importSnapshot(text) {
      return commit(parseSnapshot(text), 'import');
    },
    reset() {
      const changed = commit(clone(initialGraph), 'reset');
      selectedId = state.data[0]?.id ?? null;
      return changed;
    },
    undo() {
      const previous = history.pop();
      if (!previous) return false;
      future.push(clone(state));
      state = previous;
      repository.save(state);
      emit('undo');
      return true;
    },
    redo() {
      const next = future.pop();
      if (!next) return false;
      history.push(clone(state));
      state = next;
      repository.save(state);
      emit('redo');
      return true;
    },
    exportPayload() {
      return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        nodes: clone(state.data),
        edges: clone(state.lines),
        source: 'RR Atlas · local export',
      };
    },
  });
}
