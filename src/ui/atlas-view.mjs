import { NODE_COLORS } from '../core/atlas-state.mjs?v=media-7';
import { createMediaTile, isDirectMedia } from './atlas-media.mjs?v=media-7';

const SVG_NS = 'http://www.w3.org/2000/svg';

const clone = (value) => JSON.parse(JSON.stringify(value));

function button(label, className = 'atlas-button') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}

function field(labelText, control) {
  const wrapper = document.createElement('label');
  wrapper.textContent = labelText;
  wrapper.append(control);
  return wrapper;
}

function sectionHeading(text) {
  const heading = document.createElement('h3');
  heading.className = 'atlas-editor-section-title';
  heading.textContent = text;
  return heading;
}

export function createAtlasView({ root, store, onLinkRequest, onMediaRequest, onMediaOpen, onToast }) {
  const viewport = { x: 60, y: 50, z: 0.72 };
  let moving = null;
  let connecting = null;
  let drawingShape = null;
  let appearancePreview = null;
  let wiresVisible = true;
  let currentSnapshot = store.getSnapshot();

  const toast = (message) => onToast?.(message);
  const getNode = (id) => currentSnapshot.state.data.find((node) => node.id === id) ?? null;
  const effectiveNode = (node) => {
    if (!node || !appearancePreview || appearancePreview.id !== node.id) return node;
    return { ...node, shape: appearancePreview.shape, color: appearancePreview.color };
  };
  const visibleNodes = () => {
    const filter = currentSnapshot.filter || 'Todo';
    const query = currentSnapshot.query.trim().toLocaleLowerCase();
    return currentSnapshot.state.data.filter((node) => {
      const matchesFilter = filter === 'Todo' || node.type.toLowerCase().includes(filter.toLowerCase());
      const haystack = [
        node.title,
        node.desc,
        node.owner,
        node.type,
        node.status,
        node.notes,
        ...(node.links ?? []).flat(),
        ...(node.media ?? []).flatMap((asset) => [asset.label, asset.url, asset.kind]),
      ].join(' ').toLocaleLowerCase();
      return matchesFilter && haystack.includes(query);
    });
  };

  const setWorldTransform = () => {
    root.world.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.z})`;
  };

  const renderWires = (visible) => {
    const valid = new Set(visible.map((node) => node.id));
    root.wires.replaceChildren();
    root.wires.hidden = !wiresVisible;
    if (!wiresVisible) return;
    for (const [sourceId, targetId] of currentSnapshot.state.lines) {
      const source = getNode(sourceId);
      const target = getNode(targetId);
      if (!source || !target || !valid.has(sourceId) || !valid.has(targetId)) continue;
      const path = document.createElementNS(SVG_NS, 'path');
      const context = sourceId === currentSnapshot.selectedId || targetId === currentSnapshot.selectedId;
      const ax = source.x + 119;
      const ay = source.y + 118;
      const bx = target.x + 119;
      const by = target.y;
      path.setAttribute('class', context ? 'context' : 'dim');
      path.dataset.source = sourceId;
      path.dataset.target = targetId;
      path.setAttribute('d', `M${ax},${ay} C${ax},${(ay + by) / 2} ${bx},${(ay + by) / 2} ${bx},${by - 5}`);
      root.wires.appendChild(path);
    }
  };

  const renderMinimap = (visible) => {
    root.minimapCanvas.replaceChildren();
    root.minimapCount.textContent = String(visible.length);
    for (const rawNode of visible) {
      const node = effectiveNode(rawNode);
      const marker = button('', 'atlas-minimap-node');
      marker.classList.toggle('is-active', node.id === currentSnapshot.selectedId);
      marker.style.background = NODE_COLORS[node.color] ?? NODE_COLORS.fuchsia;
      marker.title = node.title;
      marker.setAttribute('aria-label', `Seleccionar ${node.title}`);
      marker.style.left = `${Math.min(98, Math.max(2, (node.x / 4200) * 100))}%`;
      marker.style.top = `${Math.min(98, Math.max(2, (node.y / 3200) * 100))}%`;
      marker.addEventListener('click', () => store.select(node.id));
      root.minimapCanvas.appendChild(marker);
    }
  };

  const renderCards = (visible) => {
    root.cards.replaceChildren();
    for (const rawNode of visible) {
      const node = effectiveNode(rawNode);
      const shape = node.shape || 'rectangle';
      const color = node.color || 'fuchsia';
      const card = button('', `atlas-card shape-${shape} tone-${color}${node.id === currentSnapshot.selectedId ? ' is-active' : ''}`);
      card.dataset.id = node.id;
      card.dataset.shape = shape;
      card.dataset.color = color;
      card.style.left = `${Number(node.x) || 0}px`;
      card.style.top = `${Number(node.y) || 0}px`;
      card.style.setProperty('--node-color', NODE_COLORS[color] ?? NODE_COLORS.fuchsia);
      card.setAttribute('aria-label', `${node.title}, ${node.type}`);

      const marker = document.createElement('span');
      marker.className = 'atlas-card-marker';
      marker.setAttribute('aria-hidden', 'true');
      const kind = document.createElement('span');
      kind.className = 'kind';
      kind.textContent = node.type;
      marker.appendChild(kind);
      if (node.media?.length) {
        const mediaBadge = document.createElement('span');
        mediaBadge.className = 'atlas-media-badge';
        mediaBadge.textContent = `▧ ${node.media.length}`;
        mediaBadge.title = `${node.media.length} recursos multimedia`;
        marker.appendChild(mediaBadge);
      }
      const title = document.createElement('h3');
      title.textContent = node.title;
      const description = document.createElement('p');
      description.textContent = node.desc;
      const previewAsset = node.media?.[0];
      if (previewAsset) {
        const preview = document.createElement('div');
        preview.className = 'atlas-card-media-preview';
        if (previewAsset.kind === 'image' && isDirectMedia(previewAsset)) {
          const image = document.createElement('img');
          image.src = previewAsset.url;
          image.alt = '';
          image.loading = 'lazy';
          image.decoding = 'async';
          preview.appendChild(image);
        } else {
          const icon = document.createElement('span');
          icon.textContent = previewAsset.kind === 'video' ? '▶' : previewAsset.kind === 'audio' ? '♪' : '↗';
          preview.appendChild(icon);
        }
        card.append(marker, title, description, preview);
      } else {
        card.append(marker, title, description);
      }

      card.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        if (connecting) {
          if (connecting !== node.id && store.connect(connecting, node.id)) toast('Conexión creada');
          connecting = null;
          return;
        }
        store.select(node.id);
        moving = { id: node.id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y };
        card.setPointerCapture(event.pointerId);
      });
      card.addEventListener('pointermove', (event) => {
        if (!moving || moving.id !== node.id) return;
        const x = Math.round(moving.originX + (event.clientX - moving.startX) / viewport.z);
        const y = Math.round(moving.originY + (event.clientY - moving.startY) / viewport.z);
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
      });
      card.addEventListener('pointerup', () => {
        if (!moving || moving.id !== node.id) return;
        const x = Number.parseFloat(card.style.left);
        const y = Number.parseFloat(card.style.top);
        moving = null;
        if (Number.isFinite(x) && Number.isFinite(y)) store.moveNode(node.id, x, y);
      });
      card.addEventListener('pointercancel', () => { moving = null; });
      card.addEventListener('click', () => { if (!moving) store.select(node.id); });
      root.cards.appendChild(card);
    }
  };

  const renderEditor = () => {
    root.editor.replaceChildren();
    const node = getNode(currentSnapshot.selectedId);
    if (!node) {
      const empty = document.createElement('p');
      empty.className = 'atlas-empty';
      empty.textContent = 'Selecciona un nodo o crea uno nuevo.';
      root.editor.appendChild(empty);
      return;
    }

    const kind = document.createElement('span');
    kind.className = 'kind';
    kind.textContent = `Editar nodo · ${node.id}`;
    const heading = document.createElement('h2');
    heading.textContent = node.title;
    root.editor.append(kind, heading);

    const title = document.createElement('input');
    title.value = node.title;
    root.editor.appendChild(field('Título', title));

    const type = document.createElement('select');
    for (const optionValue of root.types) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      option.selected = optionValue === node.type;
      type.appendChild(option);
    }
    root.editor.appendChild(field('Tipo', type));

    const description = document.createElement('textarea');
    description.value = node.desc;
    root.editor.appendChild(field('Descripción / alcance', description));

    const owner = document.createElement('input');
    owner.value = node.owner || '';
    root.editor.appendChild(field('Responsable', owner));

    const status = document.createElement('input');
    status.value = node.status || '';
    root.editor.appendChild(field('Estado', status));

    const notes = document.createElement('textarea');
    notes.value = node.notes || '';
    root.editor.appendChild(field('Notas y próximos pasos', notes));

    const appearance = document.createElement('section');
    appearance.className = 'atlas-editor-section';
    appearance.appendChild(sectionHeading('Apariencia del marcador'));
    const shape = document.createElement('select');
    for (const optionValue of root.shapes) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = root.shapeLabels[optionValue] ?? optionValue;
      option.selected = optionValue === (node.shape || 'rectangle');
      shape.appendChild(option);
    }
    appearance.appendChild(field('Figura', shape));

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    const palette = document.createElement('div');
    palette.className = 'atlas-palette';
    let selectedColor = node.color || 'fuchsia';
    for (const colorName of root.colors) {
      const swatch = button('', 'atlas-color-swatch');
      swatch.dataset.color = colorName;
      swatch.title = colorName;
      swatch.setAttribute('aria-label', `Usar color ${colorName}`);
      swatch.style.background = NODE_COLORS[colorName];
      swatch.classList.toggle('is-active', colorName === selectedColor);
      swatch.addEventListener('click', () => {
        selectedColor = colorName;
        palette.querySelectorAll('.atlas-color-swatch').forEach((item) => item.classList.toggle('is-active', item.dataset.color === colorName));
        updateAppearancePreview();
      });
      palette.appendChild(swatch);
    }
    colorLabel.appendChild(palette);
    appearance.appendChild(colorLabel);

    const previewFeedback = document.createElement('p');
    previewFeedback.className = 'atlas-editor-feedback';
    previewFeedback.setAttribute('role', 'status');
    const updateAppearancePreview = () => {
      const nextShape = shape.value;
      const dirty = nextShape !== (node.shape || 'rectangle') || selectedColor !== (node.color || 'fuchsia');
      appearancePreview = { id: node.id, shape: nextShape, color: selectedColor };
      refreshMap();
      previewFeedback.textContent = dirty
        ? `Vista previa aplicada al nodo: ${root.shapeLabels[nextShape] ?? nextShape} · ${root.colorLabels[selectedColor] ?? selectedColor}. Todavía no está guardado.`
        : 'Elige una figura o color para previsualizarlo directamente sobre el nodo seleccionado.';
    };
    shape.addEventListener('change', updateAppearancePreview);
    updateAppearancePreview();
    appearance.append(previewFeedback);
    root.editor.appendChild(appearance);

    const actions = document.createElement('div');
    actions.className = 'row';
    const save = button('Aplicar cambios', 'atlas-button atlas-button--primary');
    const discard = button('Descartar cambios');
    const remove = button('Eliminar', 'atlas-button atlas-button--danger');
    save.addEventListener('click', () => {
      appearancePreview = null;
      refreshMap();
      store.updateNode(node.id, {
        title: title.value.trim() || 'Sin título',
        type: type.value,
        desc: description.value,
        owner: owner.value,
        status: status.value,
        notes: notes.value,
        shape: shape.value,
        color: selectedColor,
      });
      toast(`Aplicado: ${root.shapeLabels[shape.value] ?? shape.value} · ${selectedColor}`);
    });
    discard.addEventListener('click', () => {
      appearancePreview = null;
      refreshMap();
      store.select(node.id);
      toast('Cambios descartados');
    });
    remove.addEventListener('click', () => {
      if (window.confirm('¿Eliminar este nodo y sus conexiones?')) {
        store.deleteNode(node.id);
        toast('Nodo eliminado');
      }
    });
    actions.append(save, discard, remove);
    root.editor.appendChild(actions);

    const mediaSection = document.createElement('section');
    mediaSection.className = 'atlas-editor-section';
    mediaSection.appendChild(sectionHeading(`Multimedia · ${(node.media ?? []).length}`));
    const mediaHelp = document.createElement('p');
    mediaHelp.className = 'atlas-muted';
    mediaHelp.textContent = 'Fotos, videos, audio, PDF y documentos. Drive se abre en vista previa cuando el navegador lo permite.';
    mediaSection.appendChild(mediaHelp);
    const mediaGrid = document.createElement('div');
    mediaGrid.className = 'atlas-media-grid';
    for (const asset of node.media ?? []) {
      mediaGrid.appendChild(createMediaTile({
        asset,
        onOpen: onMediaOpen,
        onRemove: (selected) => {
          if (window.confirm(`¿Quitar ${selected.label}?`)) {
            store.removeMedia(node.id, selected.id);
            toast('Recurso multimedia quitado');
          }
        },
      }));
    }
    if (!(node.media ?? []).length) {
      const emptyMedia = document.createElement('p');
      emptyMedia.className = 'atlas-muted';
      emptyMedia.textContent = 'Todavía no hay fotos ni archivos montados.';
      mediaGrid.appendChild(emptyMedia);
    }
    mediaSection.appendChild(mediaGrid);
    const addMedia = button('＋ Agregar foto, video o archivo', 'atlas-button atlas-button--primary');
    addMedia.addEventListener('click', () => onMediaRequest?.(node.id));
    mediaSection.appendChild(addMedia);
    root.editor.appendChild(mediaSection);

    const docsSection = document.createElement('section');
    docsSection.className = 'atlas-editor-section';
    docsSection.appendChild(sectionHeading(`Enlaces de Drive · ${node.links.length}`));
    const help = document.createElement('p');
    help.className = 'atlas-muted';
    help.textContent = 'Referencias simples para documentos y carpetas. No copia archivos ni guarda tokens.';
    docsSection.appendChild(help);
    const list = document.createElement('div');
    for (const [index, [name, url]] of node.links.entries()) {
      const row = document.createElement('div');
      row.className = 'atlas-doc';
      const removeLink = button('×', 'atlas-button atlas-button--icon');
      removeLink.setAttribute('aria-label', `Quitar ${name}`);
      removeLink.addEventListener('click', () => { store.removeLink(node.id, index); toast('Enlace quitado'); });
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = `${name} ↗`;
      row.append(removeLink, anchor);
      list.appendChild(row);
    }
    if (!node.links.length) {
      const emptyLinks = document.createElement('p');
      emptyLinks.className = 'atlas-muted';
      emptyLinks.textContent = 'Sin documentos vinculados.';
      list.appendChild(emptyLinks);
    }
    docsSection.appendChild(list);
    const linkButton = button('＋ Asociar enlace de Drive');
    linkButton.addEventListener('click', () => onLinkRequest?.(node.id));
    docsSection.appendChild(linkButton);
    root.editor.appendChild(docsSection);

    const notice = document.createElement('p');
    notice.className = 'atlas-notice';
    notice.textContent = 'Persistencia local validada. La conexión remota queda para una fase posterior.';
    root.editor.appendChild(notice);
  };

  const render = (snapshot) => {
    if (appearancePreview && (appearancePreview.id !== snapshot.selectedId || snapshot.reason === 'update-node')) appearancePreview = null;
    currentSnapshot = snapshot;
    const visible = visibleNodes();
    const mediaCount = snapshot.state.data.reduce((total, node) => total + (node.media?.length ?? 0), 0);
    root.count.textContent = `${visible.length} de ${snapshot.state.data.length} nodos · ${snapshot.state.lines.length} conexiones · ${mediaCount} recursos`;
    root.status.textContent = snapshot.reason === 'init' ? 'Selecciona un nodo para editarlo · Desplazar: fondo · Zoom: rueda' : 'Cambios guardados localmente';
    root.railButtons.forEach((buttonElement) => {
      buttonElement.setAttribute('aria-pressed', String(buttonElement.dataset.atlasFilter === snapshot.filter));
    });
    renderCards(visible);
    renderWires(visible);
    renderMinimap(visible);
    renderEditor();
    setWorldTransform();
  };

  const pan = (event) => {
    if (event.target.closest('button, input, textarea, select, a')) return;
    if (drawingShape) {
      const rect = root.work.getBoundingClientRect();
      const x = Math.round((event.clientX - rect.left - viewport.x) / viewport.z - 119);
      const y = Math.round((event.clientY - rect.top - viewport.y) / viewport.z - 70);
      const labels = { rectangle: 'Rectángulo', rounded: 'Marcador redondeado', circle: 'Círculo', diamond: 'Rombo', hexagon: 'Hexágono', note: 'Nota' };
      const shape = drawingShape;
      drawingShape = null;
      root.work.classList.remove('is-drawing');
      store.addNode({
        id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: labels[shape] ?? 'Elemento dibujado',
        type: 'Otro',
        desc: 'Elemento creado desde la herramienta Dibujar.',
        x: Math.max(20, x),
        y: Math.max(20, y),
        shape,
        color: 'orchid',
      });
      toast(`${labels[shape] ?? 'Elemento'} creado en el lienzo`);
      return;
    }
    const start = { x: event.clientX, y: event.clientY, ox: viewport.x, oy: viewport.y };
    const move = (next) => { viewport.x = start.ox + next.clientX - start.x; viewport.y = start.oy + next.clientY - start.y; setWorldTransform(); };
    const end = () => {
      root.work.removeEventListener('pointermove', move);
      root.work.removeEventListener('pointerup', end);
      root.work.removeEventListener('pointercancel', end);
    };
    root.work.addEventListener('pointermove', move);
    root.work.addEventListener('pointerup', end);
    root.work.addEventListener('pointercancel', end);
  };
  root.work.addEventListener('pointerdown', pan);
  root.work.addEventListener('wheel', (event) => {
    event.preventDefault();
    viewport.z = Math.max(.25, Math.min(2, viewport.z * (event.deltaY < 0 ? 1.1 : .9)));
    setWorldTransform();
  }, { passive: false });

  const refreshMap = () => {
    const visible = visibleNodes();
    renderCards(visible);
    renderWires(visible);
    renderMinimap(visible);
    setWorldTransform();
  };

  const focusVisible = () => {
    const visible = visibleNodes();
    if (!visible.length) return;
    const minX = Math.min(...visible.map((node) => node.x));
    const maxX = Math.max(...visible.map((node) => node.x + 238));
    const minY = Math.min(...visible.map((node) => node.y));
    const maxY = Math.max(...visible.map((node) => node.y + 150));
    const width = Math.max(320, root.work.clientWidth - 80);
    const height = Math.max(260, root.work.clientHeight - 120);
    viewport.z = Math.max(.28, Math.min(1.05, Math.min(width / Math.max(420, maxX - minX), height / Math.max(260, maxY - minY))));
    viewport.x = root.work.clientWidth / 2 - ((minX + maxX) / 2) * viewport.z;
    viewport.y = root.work.clientHeight / 2 - ((minY + maxY) / 2) * viewport.z;
    setWorldTransform();
  };

  return Object.freeze({
    render,
    startConnecting() {
      if (!currentSnapshot.selectedId) { toast('Selecciona un nodo primero'); return; }
      connecting = currentSnapshot.selectedId;
      toast('Selecciona un segundo nodo para crear la conexión');
    },
    startDrawing(shape) {
      drawingShape = shape;
      root.work.classList.add('is-drawing');
      toast(`Dibujar ${shape}: haz clic en el lienzo`);
    },
    previewAppearance(id, shape, color) {
      appearancePreview = { id, shape, color };
      refreshMap();
    },
    clearAppearancePreview() {
      appearancePreview = null;
      refreshMap();
    },
    focusVisible,
    toggleWires() {
      wiresVisible = !wiresVisible;
      refreshMap();
      return wiresVisible;
    },
    center() { viewport.x = 38; viewport.y = 30; viewport.z = .65; setWorldTransform(); },
    zoomIn() { viewport.z = Math.min(2, viewport.z * 1.2); setWorldTransform(); },
    zoomOut() { viewport.z = Math.max(.25, viewport.z / 1.2); setWorldTransform(); },
    getSnapshot: () => clone(currentSnapshot),
  });
}
