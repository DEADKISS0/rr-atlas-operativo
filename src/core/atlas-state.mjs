/**
 * RR Aliados | Atlas 4.0 - data foundation.
 * Local repository today; API/Supabase adapter can implement the same contract later.
 */
export const STORAGE_KEY = 'rr-atlas-v3';
export const LIMITS = Object.freeze({
  nodes: 600,
  edges: 6000,
  links: 200,
  media: 400,
  jsonBytes: 5_000_000,
});

export const NODE_SHAPES = Object.freeze([
  'rectangle',
  'rounded',
  'pill',
  'circle',
  'diamond',
  'hexagon',
  'note',
]);

export const NODE_COLORS = Object.freeze({
  fuchsia: '#be076d',
  mustard: '#ded116',
  orchid: '#973d8f',
  ink: '#070001',
  paper: '#fffff3',
  // Claves heredadas: el dato guardado se conserva y el hex entra a la paleta.
  moss: '#973d8f',
  blue: '#fffff3',
  flag: '#be076d',
});

export const PALETTE_COLORS = Object.freeze(['fuchsia', 'mustard', 'orchid', 'ink', 'paper']);

export const MEDIA_KINDS = Object.freeze([
  'auto',
  'image',
  'video',
  'audio',
  'pdf',
  'embed',
  'link',
]);

export class AtlasDataError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AtlasDataError';
    this.code = code;
  }
}

function requireValue(condition, message, code = 'INVALID_DATA') {
  if (!condition) throw new AtlasDataError(code, message);
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function string(value, field, max = 20_000) {
  requireValue(typeof value === 'string' && value.length <= max, `Invalid ${field}`);
  return value;
}

function keys(value, allowed, field) {
  requireValue(
    Object.keys(value).every((key) => allowed.includes(key)),
    `Unknown fields in ${field}; migration required`,
  );
}

function safeUrl(rawUrl, field = 'URL') {
  const value = string(rawUrl, field, 4_096);
  let url;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new AtlasDataError('INVALID_DATA', `Invalid ${field}`, cause);
  }
  requireValue(
    url.protocol === 'https:' && !url.username && !url.password && !url.port,
    `Only HTTPS ${field} without credentials or custom ports are allowed`,
  );
  return [url, value];
}

export function validateDriveLink(link) {
  requireValue(Array.isArray(link) && link.length === 2, 'A Drive link needs a label and URL');
  const label = string(link[0], 'link label', 500);
  const [url, rawUrl] = safeUrl(link[1], 'Drive URL');
  requireValue(
    ['drive.google.com', 'docs.google.com'].includes(url.hostname),
    'Only HTTPS Google Drive/Docs links are allowed',
  );
  return [label, rawUrl];
}

export function classifyMediaUrl(rawUrl, requestedKind = 'auto') {
  const [url] = safeUrl(rawUrl, 'media URL');
  const requested = MEDIA_KINDS.includes(requestedKind) ? requestedKind : 'auto';
  if (requested !== 'auto') return requested;

  if (['drive.google.com', 'docs.google.com', 'drive.usercontent.google.com'].includes(url.hostname)) return 'embed';
  if (['youtube.com', 'www.youtube.com', 'youtu.be', 'player.vimeo.com', 'vimeo.com'].includes(url.hostname)) return 'video';

  const path = url.pathname.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg)(?:$|\?)/.test(path)) return 'image';
  if (/\.(mp4|webm|mov|m4v|ogv)(?:$|\?)/.test(path)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(?:$|\?)/.test(path)) return 'audio';
  if (/\.pdf(?:$|\?)/.test(path)) return 'pdf';
  return 'embed';
}

export function validateMediaAsset(asset) {
  requireValue(record(asset), 'Invalid media asset');
  keys(asset, ['id', 'label', 'url', 'kind'], 'media asset');
  const id = string(asset.id, 'media id', 200);
  const label = string(asset.label, 'media label', 500);
  const [, rawUrl] = safeUrl(asset.url, 'media URL');
  const kind = classifyMediaUrl(rawUrl, asset.kind || 'auto');
  requireValue(id.trim().length > 0, 'Empty media id');
  requireValue(label.trim().length > 0, 'Empty media label');
  return { id, label, url: rawUrl, kind };
}

export function drivePreviewUrl(rawUrl) {
  const [url, value] = safeUrl(rawUrl, 'media URL');
  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) return `https://drive.google.com/file/d/${encodeURIComponent(fileMatch[1])}/preview`;
  if (['drive.google.com', 'docs.google.com'].includes(url.hostname) && url.searchParams.get('id')) {
    return `https://drive.google.com/file/d/${encodeURIComponent(url.searchParams.get('id'))}/preview`;
  }

  const documentMatch = url.pathname.match(/\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
  if (documentMatch) {
    const type = documentMatch[1];
    return `https://docs.google.com/${type}/d/${encodeURIComponent(documentMatch[2])}/preview`;
  }

  if (url.hostname === 'youtu.be') return `https://www.youtube.com/embed${url.pathname}`;
  if (url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com') {
    const id = url.searchParams.get('v');
    if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  }
  if (url.hostname === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).at(-1);
    if (id) return `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
  }
  return value;
}

/** Accept the current browser format or its version-1 export. Never mutate input. */
export function normalizeGraph(input) {
  requireValue(record(input), 'Expected an Atlas graph');
  let data;
  let lines;

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
    keys(
      node,
      ['id', 'title', 'type', 'desc', 'owner', 'status', 'notes', 'x', 'y', 'links', 'shape', 'color', 'media'],
      `node ${index}`,
    );
    const id = string(node.id, 'node id', 200);
    requireValue(id.trim().length > 0 && !ids.has(id), 'Empty or duplicate node id');
    ids.add(id);
    const title = string(node.title, 'node title', 1_000);
    requireValue(title.trim().length > 0, 'Empty node title');
    requireValue(Number.isFinite(node.x) && Number.isFinite(node.y), 'Node coordinates must be finite numbers');
    requireValue(Math.abs(node.x) <= 1_000_000 && Math.abs(node.y) <= 1_000_000, 'Node coordinates out of range');
    requireValue(Array.isArray(node.links) && node.links.length <= LIMITS.links, 'Invalid node links');

    const rawMedia = node.media ?? [];
    requireValue(Array.isArray(rawMedia) && rawMedia.length <= LIMITS.media, 'Invalid media list');
    const mediaIds = new Set();
    const media = rawMedia.map((asset, assetIndex) => {
      const normalized = validateMediaAsset(asset);
      requireValue(!mediaIds.has(normalized.id), `Duplicate media id in node ${index} at ${assetIndex}`);
      mediaIds.add(normalized.id);
      return normalized;
    });

    const result = {
      id,
      title,
      x: node.x,
      y: node.y,
      links: node.links.map(validateDriveLink),
      shape: NODE_SHAPES.includes(node.shape) ? node.shape : 'rectangle',
      color: Object.hasOwn(NODE_COLORS, node.color) ? node.color : 'fuchsia',
      media,
    };
    for (const field of ['type', 'desc', 'owner', 'status', 'notes']) {
      if (Object.hasOwn(node, field)) result[field] = string(node[field], field);
    }
    return result;
  });

  const connections = new Set();
  const edges = lines.map((edge) => {
    requireValue(Array.isArray(edge) && edge.length === 2, 'Invalid connection');
    const [source, target] = edge;
    requireValue(
      typeof source === 'string' &&
        typeof target === 'string' &&
        ids.has(source) &&
        ids.has(target),
      'Connection points to a missing node',
    );
    requireValue(source !== target, 'Self-connections are not supported');
    const identity = JSON.stringify(edge);
    requireValue(!connections.has(identity), 'Duplicate connection');
    connections.add(identity);
    return [source, target];
  });

  return { data: nodes, lines: edges };
}

export function parseSnapshot(text) {
  requireValue(
    typeof text === 'string' && new TextEncoder().encode(text).length <= LIMITS.jsonBytes,
    'Snapshot is too large or is not text',
  );
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new AtlasDataError(
      'INVALID_JSON',
      'Invalid JSON; the existing snapshot must be preserved',
      cause,
    );
  }
  return normalizeGraph(parsed);
}

/** Inject a Storage-compatible object. No automatic reset or cloud claim. */
export function createLocalRepository(storage, key = STORAGE_KEY) {
  requireValue(
    storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function',
    'Storage adapter required',
  );

  const load = () => {
    let value;
    try {
      value = storage.getItem(key);
    } catch (cause) {
      throw new AtlasDataError('STORAGE_READ_FAILED', 'Local storage could not be read', cause);
    }
    return value === null ? null : parseSnapshot(value);
  };

  const save = (input) => {
    const graph = normalizeGraph(input);
    const serialized = JSON.stringify(graph);
    requireValue(
      new TextEncoder().encode(serialized).length <= LIMITS.jsonBytes,
      'Snapshot exceeds the storage limit',
    );
    try {
      storage.setItem(key, serialized);
    } catch (cause) {
      throw new AtlasDataError(
        'STORAGE_WRITE_FAILED',
        'Changes were not saved; keep the unsaved state and offer export',
        cause,
      );
    }
    return graph;
  };

  const changeNode = (nodeId, mutate) => {
    const graph = load();
    requireValue(graph !== null, 'No saved graph');
    const node = graph.data.find((item) => item.id === nodeId);
    requireValue(Boolean(node), 'Node not found');
    mutate(node);
    return save(graph);
  };

  return Object.freeze({
    load,
    save,
    addLink: (nodeId, link) => changeNode(nodeId, (node) => node.links.push(validateDriveLink(link))),
    removeLink: (nodeId, index) =>
      changeNode(nodeId, (node) => {
        requireValue(
          Number.isInteger(index) && index >= 0 && index < node.links.length,
          'Invalid link index',
        );
        node.links.splice(index, 1);
      }),
  });
}
