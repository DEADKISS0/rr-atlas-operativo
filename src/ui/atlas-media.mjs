import { drivePreviewUrl } from '../core/atlas-state.mjs?v=bpmn-2';

const iconFor = Object.freeze({
  image: '▧',
  video: '▶',
  audio: '♪',
  pdf: 'PDF',
  embed: '↗',
  link: '↗',
});

const labelFor = Object.freeze({
  image: 'Imagen',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  embed: 'Vista previa',
  link: 'Enlace',
});

function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function extension(url) {
  const parsed = safeUrl(url);
  return parsed?.pathname.toLowerCase().split('.').pop() ?? '';
}

export function isDirectMedia(asset) {
  return ['image', 'video', 'audio', 'pdf'].includes(asset.kind) && Boolean(extension(asset.url));
}

export function previewUrl(asset) {
  return drivePreviewUrl(asset.url);
}

function assetIsDirect(asset, kind) {
  const ext = extension(asset.url);
  const groups = {
    image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'],
    video: ['mp4', 'webm', 'mov', 'm4v', 'ogv'],
    audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
    pdf: ['pdf'],
  };
  return groups[kind]?.includes(ext) ?? false;
}

function button(text, className = 'atlas-button') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = text;
  return element;
}

export function createMediaTile({ asset, onOpen, onRemove }) {
  const tile = document.createElement('article');
  tile.className = 'atlas-media-tile mat-panel';
  tile.dataset.mediaId = asset.id;

  const thumb = document.createElement('div');
  thumb.className = 'atlas-media-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  if (asset.kind === 'image' && assetIsDirect(asset, 'image')) {
    const image = document.createElement('img');
    image.src = asset.url;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('load', () => image.classList.add('is-ready'), { once: true });
    image.addEventListener('error', () => image.classList.add('is-error'), { once: true });
    thumb.appendChild(image);
  } else {
    const icon = document.createElement('span');
    icon.className = 'atlas-media-icon';
    icon.textContent = iconFor[asset.kind] ?? '↗';
    thumb.appendChild(icon);
  }

  const body = document.createElement('div');
  body.className = 'atlas-media-tile-body';
  const title = document.createElement('strong');
  title.textContent = asset.label;
  const meta = document.createElement('span');
  meta.textContent = `${labelFor[asset.kind] ?? 'Recurso'} · ${asset.url}`;
  meta.title = asset.url;
  body.append(title, meta);

  const actions = document.createElement('div');
  actions.className = 'atlas-media-tile-actions';
  const open = button('Abrir', 'atlas-button atlas-button--primary');
  open.addEventListener('click', () => onOpen(asset));
  const remove = button('×', 'atlas-button atlas-button--icon atlas-button--danger');
  remove.setAttribute('aria-label', `Quitar ${asset.label}`);
  remove.addEventListener('click', () => onRemove(asset));
  actions.append(open, remove);

  tile.append(thumb, body, actions);
  return tile;
}

export function createMediaFrame(asset) {
  const kind = asset.kind;
  const source = previewUrl(asset);
  let frame;

  if (kind === 'image' && assetIsDirect(asset, 'image')) {
    frame = document.createElement('img');
    frame.src = source;
    frame.alt = asset.label;
    frame.decoding = 'async';
    frame.className = 'atlas-viewer-image';
  } else if (kind === 'video' && assetIsDirect(asset, 'video')) {
    frame = document.createElement('video');
    frame.src = source;
    frame.controls = true;
    frame.playsInline = true;
    frame.className = 'atlas-viewer-video';
  } else if (kind === 'audio' && assetIsDirect(asset, 'audio')) {
    frame = document.createElement('audio');
    frame.src = source;
    frame.controls = true;
    frame.className = 'atlas-viewer-audio';
  } else {
    frame = document.createElement('iframe');
    frame.src = source;
    frame.title = asset.label;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.allow = 'autoplay; fullscreen; picture-in-picture; clipboard-read; clipboard-write';
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('sandbox', 'allow-forms allow-modals allow-popups allow-presentation allow-scripts allow-same-origin');
    frame.className = 'atlas-viewer-iframe';
  }
  return frame;
}

export function createExternalAssetLink(asset) {
  const link = document.createElement('a');
  link.href = asset.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'atlas-button';
  link.textContent = 'Abrir fuente ↗';
  return link;
}
