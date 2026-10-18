/**
 * RR ALIADOS | Atlas 4.0 - data foundation.
 * Single-client compatibility adapter. Not cloud storage or collaboration.
 * Nothing runs on import; index.html is intentionally not wired to this yet.
 */
export const STORAGE_KEY = 'rr-atlas-v3';
export const LIMITS = Object.freeze({ nodes: 600, edges: 6000, links: 200, jsonBytes: 5_000_000 });
export class AtlasDataError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AtlasDataError';
    this.code = code;
  }
}
function requireValue(condition, message) {
  if (!condition) throw new AtlasDataError('INVALID_DATA', message);
}
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function string(value, field, max = 20000) {
  requireValue(typeof value === 'string' && value.length <= max, `Invalid ${field}`);
  return value;
}
function keys(value, allowed, field) {
  requireValue(Object.keys(value).every(key => allowed.includes(key)), `Unknown fields in ${field}; migration required`);
}
export function validateDriveLink(link) {
  requireValue(Array.isArray(link) && link.length === 2, 'A Drive link needs a label and URL');
  const label = string(link[0], 'link label', 500);
  const rawUrl = string(link[1], 'link URL', 4096);
  let url;
  try { url = new URL(rawUrl); } catch { throw new AtlasDataError('INVALID_DATA', 'Invalid Drive URL'); }
  requireValue(url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname)
    && !url.username && !url.password && !url.port, 'Only HTTPS Google Drive/Docs links are allowed');
  // A reference is not proof that the current user has permission to read the file.
  return [label, rawUrl];
}
/** Accept the current browser format or its version-1 export. Never mutate input. */
export function normalizeGraph(input) {
  requireValue(record(input), 'Expected an Atlas graph');
  let data, lines;
  if (Object.hasOwn(input, 'schemaVersion')) {
    requireValue(input.schemaVersion === 1, 'Unsupported schema version; migration required');
    keys(input, ['schemaVersion', 'exportedAt', 'nodes', 'edges', 'source'], 'export');
    ({ nodes: data, edges: lines } = input);
  } else {
    keys(input, ['data', 'lines'], 'graph');
    ({ data, lines } = input);
  }
  requireValue(Array.isArray(data) && data.length <= LIMITS.nodes, 'Invalid node list');
  requireValue(Array.isArray(lines) && lines.length <= LIMITS.edges, 'Invalid connection list');
  const ids = new Set();
  const nodes = data.map((node, index) => {
    requireValue(record(node), `Invalid node ${index}`);
    keys(node, ['id', 'title', 'type', 'desc', 'owner', 'status', 'notes', 'x', 'y', 'links'], `node ${index}`);
    const id = string(node.id, 'node id', 200);
    requireValue(id.trim().length > 0 && !ids.has(id), 'Empty or duplicate node id');
    ids.add(id);
    const title = string(node.title, 'node title', 1000);
    requireValue(title.trim().length > 0, 'Empty node title');
    requireValue(Number.isFinite(node.x) && Number.isFinite(node.y), 'Node coordinates must be finite numbers');
    requireValue(Math.abs(node.x) <= 1_000_000 && Math.abs(node.y) <= 1_000_000, 'Node coordinates out of range');
    requireValue(Array.isArray(node.links) && node.links.length <= LIMITS.links, 'Invalid node links');
    const result = { id, title, x: node.x, y: node.y, links: node.links.map(validateDriveLink) };
    for (const key of ['type', 'desc', 'owner', 'status', 'notes']) {
      if (Object.hasOwn(node, key)) result[key] = string(node[key], key);
    }
    return result;
  });
  const connections = new Set();
  const edges = lines.map(edge => {
    requireValue(Array.isArray(edge) && edge.length === 2, 'Invalid connection');
    const [source, target] = edge;
    requireValue(typeof source === 'string' && typeof target === 'string' && ids.has(source) && ids.has(target), 'Connection points to a missing node');
    requireValue(source !== target, 'Self-connections are not supported');
    const identity = JSON.stringify(edge);
    requireValue(!connections.has(identity), 'Duplicate connection');
    connections.add(identity);
    return [source, target];
  });
  return { data: nodes, lines: edges };
}
export function parseSnapshot(text) {
  requireValue(typeof text === 'string' && new TextEncoder().encode(text).length <= LIMITS.jsonBytes, 'Snapshot is too large or is not text');
  let parsed;
  try { parsed = JSON.parse(text); } catch (cause) { throw new AtlasDataError('INVALID_JSON', 'Invalid JSON; the existing snapshot must be preserved', cause); }
  return normalizeGraph(parsed);
}
/** Inject a Storage-compatible object. No automatic fallback, reset, or cloud claim. */
export function createLocalRepository(storage, key = STORAGE_KEY) {
  requireValue(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function', 'Storage adapter required');
  const load = () => {
    let value;
    try { value = storage.getItem(key); } catch (cause) { throw new AtlasDataError('STORAGE_READ_FAILED', 'Local storage could not be read', cause); }
    return value === null ? null : parseSnapshot(value);
  };
  const save = input => {
    const graph = normalizeGraph(input);
    const serialized = JSON.stringify(graph);
    requireValue(new TextEncoder().encode(serialized).length <= LIMITS.jsonBytes, 'Snapshot exceeds the storage limit');
    try { storage.setItem(key, serialized); } catch (cause) { throw new AtlasDataError('STORAGE_WRITE_FAILED', 'Changes were not saved; keep the unsaved state and offer export', cause); }
    return graph;
  };
  const changeNode = (nodeId, mutate) => {
    const graph = load();
    requireValue(graph !== null, 'No saved graph');
    const node = graph.data.find(item => item.id === nodeId);
    requireValue(Boolean(node), 'Node not found');
    mutate(node);
    return save(graph);
  };
  return Object.freeze({
    load, save,
    addLink: (nodeId, link) => changeNode(nodeId, node => { node.links.push(validateDriveLink(link)); }),
    removeLink: (nodeId, index) => changeNode(nodeId, node => {
      requireValue(Number.isInteger(index) && index >= 0 && index < node.links.length, 'Invalid link index');
      node.links.splice(index, 1);
    }),
  });
}
