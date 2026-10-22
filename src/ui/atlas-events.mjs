export function bindAtlasEvents({ root, store, view, knownLinks = [], onToast, applyTheme }) {
  const toast = (message) => onToast?.(message);

  root.railButtons.forEach((button) => {
    button.addEventListener('click', () => {
      store.setFilter(button.dataset.atlasFilter);
      view.focusVisible();
    });
  });
  root.search.addEventListener('input', () => {
    store.setQuery(root.search.value);
    if (root.search.value.trim().length >= 2 || root.search.value.trim().length === 0) view.focusVisible();
  });
  root.actions.toggleSettings.addEventListener('click', () => {
    const open = root.settings.hidden;
    root.settings.hidden = !open;
    root.actions.toggleSettings.setAttribute('aria-expanded', String(open));
  });
  root.actions.add.addEventListener('click', () => {
    const id = `node_${Date.now()}`;
    store.addNode({ id, title: 'Nuevo nodo', type: 'Otro', desc: 'Describe su función en RR Aliados.', x: 420, y: 160 });
  });
  root.actions.draw.addEventListener('click', () => {
    const open = root.drawMenu.hidden;
    root.drawMenu.hidden = !open;
    root.actions.draw.setAttribute('aria-expanded', String(open));
  });
  root.drawMenu.querySelectorAll('[data-draw-shape]').forEach((shapeButton) => {
    shapeButton.addEventListener('click', () => {
      root.drawMenu.hidden = true;
      root.actions.draw.setAttribute('aria-expanded', 'false');
      view.startDrawing(shapeButton.dataset.drawShape);
    });
  });
  root.actions.connect.addEventListener('click', () => view.startConnecting());
  root.actions.zoomIn.addEventListener('click', () => view.zoomIn());
  root.actions.zoomOut.addEventListener('click', () => view.zoomOut());
  root.actions.center.addEventListener('click', () => view.center());
  root.actions.locate?.addEventListener('click', () => {
    view.center();
    toast('Nodo seleccionado en el centro');
  });
  const app = root.layout.closest('#atlas-app');
  root.actions.toggleTools?.addEventListener('click', () => {
    const open = !app?.classList.contains('is-tools-open');
    app?.classList.toggle('is-tools-open', open);
    root.actions.toggleTools.setAttribute('aria-expanded', String(open));
  });
  root.actions.flow.addEventListener('click', () => {
    store.setFilter('Todo');
    store.setQuery('');
    if (root.search) root.search.value = '';
    const snapshot = store.getSnapshot();
    const node = snapshot.state.data.find((item) => item.type === 'Proceso');
    if (node && store.select(node.id)) {
      view.frameNode(node.id);
      toast('Proceso en el centro del mapa');
    } else {
      toast('No hay un proceso de ejemplo en este mapa');
    }
    app?.classList.remove('is-tools-open');
  });
  root.actions.undo.addEventListener('click', () => store.undo());
  root.actions.redo.addEventListener('click', () => store.redo());
  root.actions.reset.addEventListener('click', () => {
    if (window.confirm('¿Restaurar el mapa inicial? Exporta tu JSON antes si quieres conservar los cambios.')) store.reset();
  });
  root.actions.export.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.exportPayload(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'rr-atlas-datos.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  root.actions.import.addEventListener('click', () => root.fileInput.click());
  root.actions.toggleMinimap.addEventListener('click', () => {
    root.minimap.hidden = !root.minimap.hidden;
    toast(root.minimap.hidden ? 'Minimapa oculto' : 'Minimapa visible');
  });
  root.actions.toggleWires.addEventListener('click', () => {
    const visible = view.toggleWires();
    toast(visible ? 'Conexiones visibles' : 'Conexiones ocultas');
  });
  root.fileInput.addEventListener('change', async () => {
    const file = root.fileInput.files?.[0];
    if (!file) return;
    try {
      store.importSnapshot(await file.text());
      toast('Mapa importado correctamente');
    } catch {
      toast('JSON inválido o incompatible; no se reemplazó el mapa');
    } finally {
      root.fileInput.value = '';
    }
  });

  root.modal.cancel.addEventListener('click', () => root.modal.dialog.close());
  root.modal.attach.addEventListener('click', (event) => {
    event.preventDefault();
    const nodeId = root.modal.nodeId;
    const label = root.modal.name.value.trim() || (root.modal.mode === 'media' ? 'Recurso multimedia' : 'Documento Drive');
    const url = root.modal.url.value.trim();
    try {
      if (root.modal.mode === 'media') {
        store.addMedia(nodeId, {
          id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          label,
          url,
          kind: root.modal.kind.value,
        });
        toast('Recurso multimedia montado y guardado');
      } else {
        store.addLink(nodeId, [label, url]);
        toast('Enlace Drive asociado y guardado');
      }
      root.modal.dialog.close();
    } catch {
      toast(root.modal.mode === 'media'
        ? 'Recurso inválido: usa una URL HTTPS sin credenciales ni puertos personalizados'
        : 'Introduce un enlace válido de Google Drive o Docs');
    }
  });
  root.modal.choices.replaceChildren();
  for (const known of knownLinks) {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'atlas-button';
    choice.textContent = known.name;
    choice.addEventListener('click', () => {
      root.modal.name.value = known.name;
      root.modal.url.value = known.url;
    });
    root.modal.choices.appendChild(choice);
  }

  root.viewer.close.addEventListener('click', () => root.viewer.dialog.close());
  root.viewer.dialog.addEventListener('click', (event) => {
    if (event.target === root.viewer.dialog) root.viewer.dialog.close();
  });

  root.theme.toggle.addEventListener('click', () => {
    const next = document.body.classList.contains('atlas-theme-light') ? 'dark' : 'light';
    window.localStorage.setItem('rr-atlas-theme', next);
    applyTheme(next);
  });

  document.addEventListener('keydown', (event) => {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? store.redo() : store.undo();
    } else if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      store.redo();
    } else if (event.key === 'Escape') {
      if (root.viewer.dialog.open) root.viewer.dialog.close();
      if (root.modal.dialog.open) root.modal.dialog.close();
      root.settings.hidden = true;
      root.drawMenu.hidden = true;
      root.actions.toggleSettings.setAttribute('aria-expanded', 'false');
      root.actions.draw.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.matches('input[type="file"]')) return;
    if (!root.settings.hidden && !root.settings.contains(event.target) && !root.actions.toggleSettings.contains(event.target)) {
      root.settings.hidden = true;
      root.actions.toggleSettings.setAttribute('aria-expanded', 'false');
    }
    if (!root.drawMenu.hidden && !root.drawMenu.contains(event.target) && !root.actions.draw.contains(event.target)) {
      root.drawMenu.hidden = true;
      root.actions.draw.setAttribute('aria-expanded', 'false');
    }
  });
}
