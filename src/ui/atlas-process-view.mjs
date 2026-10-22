import {
  PROCESS_STORAGE_KEY,
  UNKNOWN,
  createLocalProcessRepository,
  createNewProcessXml,
  describeSeed,
  listLanes,
  listSteps,
  normalizeStoredProcess,
  parseProcessMeta,
  presentSource,
  purposeFromDocumentation,
} from '../core/process-model.mjs?v=bpmn-3';
import { issueLabel } from '../bpmn/lint/messages.mjs?v=bpmn-3';

const ESTADO = {
  borrador: 'Borrador',
  por_validar: 'Por validar',
  validado: 'Validado',
  obsoleto: 'Obsoleto',
};

function button(label, className, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  if (action) element.dataset.action = action;
  return element;
}

function slug(value) {
  return String(value || 'proceso').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proceso';
}

export function createProcessView({ app, onToast }) {
  const section = app.querySelector('[data-atlas-process]');
  const list = section.querySelector('[data-atlas-process-list]');
  const search = section.querySelector('[data-atlas-process-search]');
  const canvas = section.querySelector('[data-atlas-bpmn-canvas]');
  const meta = section.querySelector('[data-atlas-process-meta]');
  const status = section.querySelector('[data-atlas-bpmn-status]');
  const fileInput = app.querySelector('[data-atlas-bpmn-file]');
  const dialog = app.querySelector('[data-atlas-new-process]');
  const repository = createLocalProcessRepository(window.localStorage, PROCESS_STORAGE_KEY);
  let workspace = null;
  let seeds = [];
  let locals = repository.load().processes;
  let current = null;
  let editing = false;
  let query = '';
  let ready = null;
  let debt = null;

  const records = () => [...locals, ...seeds];

  const saveLocals = () => repository.save({ processes: locals });

  const setStatus = (message) => { status.textContent = message; };
  const stepLabel = section.querySelector('[data-atlas-step]');
  const laneLegend = section.querySelector('[data-atlas-lanes]');

  const renderStep = (step) => {
    if (!stepLabel) return;
    if (!step?.total) {
      stepLabel.textContent = 'Inicio';
      return;
    }
    stepLabel.textContent = `${step.index + 1} de ${step.total}`;
    stepLabel.title = [step.name, step.lane].filter(Boolean).join(' · ');
  };

  const renderLanes = (xml) => {
    if (!laneLegend) return;
    laneLegend.replaceChildren();
    const lanes = listLanes(xml);
    if (!lanes.length) {
      laneLegend.hidden = true;
      return;
    }
    laneLegend.hidden = false;
    for (const name of lanes) {
      const chip = document.createElement('span');
      chip.textContent = name;
      laneLegend.append(chip);
    }
  };

  const ensureWorkspace = async () => {
    if (workspace) return workspace;
    if (!ready) {
      setStatus('Cargando el visor BPMN…');
      ready = import('/src/bpmn/bpmn-bundle.mjs?v=bpmn-3')
        .then((module) => {
          workspace = module.createBpmnWorkspace({
            container: canvas,
            onReport: (report) => {
              renderReport(report);
              if (editing && current?.source === 'local') persistCurrent();
            },
          });
          workspace.setDebt(debt);
          return workspace;
        })
        .catch((error) => {
          ready = null;
          setStatus('No se pudo cargar el visor BPMN.');
          throw error;
        });
    }
    return ready;
  };

  const persistCurrent = async () => {
    if (!current || current.source !== 'local' || !workspace) return;
    current.xml = await workspace.xml();
    current.meta = { ...current.meta, ...parseProcessMeta(current.xml), owner: current.meta.owner, kpi: current.meta.kpi };
    const fresh = parseProcessMeta(current.xml);
    current.meta = fresh;
    current.title = fresh.title || current.title;
    locals = locals.map((item) => item.id === current.id ? current : item);
    saveLocals();
  };

  const renderReport = (report) => {
    if (!current) return;
    const errors = report.errors?.length || 0;
    const warnings = report.warnings?.length || 0;
    const known = report.debt?.length || 0;
    if (report.importError) {
      setStatus(`Error de importación: ${report.importError}`);
    } else {
      setStatus(`Validación en vivo: ${errors} errores, ${warnings} avisos${known ? `, ${known} de deuda de modelado` : ''}.`);
    }
    renderMeta(report);
  };

  const renderMeta = (report) => {
    meta.replaceChildren();
    const metaData = current.meta || {};
    const head = document.createElement('div');
    head.className = 'atlas-process-head';
    const badge = document.createElement('span');
    badge.className = `atlas-state atlas-state--${current.estado}`;
    badge.textContent = ESTADO[current.estado] || current.estado;
    const title = document.createElement('h2');
    title.textContent = current.title;
    head.append(badge, title);
    meta.append(head);

    const fields = document.createElement('dl');
    fields.className = 'atlas-process-fields';
    for (const [label, value] of [
      ['Dueño', metaData.owner || UNKNOWN],
      ['KPI', metaData.kpi || UNKNOWN],
      ['Línea base', metaData.lineaBase || UNKNOWN],
      ['Fecha de corte', metaData.fechaCorte || UNKNOWN],
      ['Fuente', presentSource(metaData.fuente)],
      ['Área', current.area || UNKNOWN],
    ]) {
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      fields.append(term, detail);
    }
    meta.append(fields);

    const purpose = purposeFromDocumentation(metaData.documentation);
    const note = document.createElement('p');
    note.className = 'atlas-muted';
    note.textContent = purpose || (current.source === 'semilla'
      ? 'Proceso de referencia. Lo que no está declarado queda en DESCONOCIDO.'
      : 'Borrador local. Lo que no se conoce queda en DESCONOCIDO.');
    meta.append(note);

    const lintTitle = document.createElement('h3');
    lintTitle.textContent = 'Validación';
    meta.append(lintTitle);
    const lint = document.createElement('ul');
    lint.className = 'atlas-lint';
    lint.dataset.atlasLint = 'true';
    const items = [
      ...(report?.errors || []).map((issue) => ({ ...issue, tone: 'error' })),
      ...(report?.debt || []).map((issue) => ({ ...issue, tone: 'debt' })),
      ...(report?.warnings || []).map((issue) => ({ ...issue, tone: 'warn' })),
    ];
    if (report?.importError) {
      const item = document.createElement('li');
      item.className = 'atlas-lint-item is-error';
      item.textContent = report.importError;
      lint.append(item);
    }
    if (!items.length && !report?.importError) {
      const empty = document.createElement('li');
      empty.className = 'atlas-lint-item';
      empty.textContent = 'Sin hallazgos.';
      lint.append(empty);
    }
    for (const issue of items) {
      const item = document.createElement('li');
      const control = button(
        `${issue.tone === 'error' ? 'Error' : issue.tone === 'debt' ? 'Deuda de modelado' : 'Aviso'} · ${issue.id || 'proceso'} · ${issueLabel(issue)}`,
        `atlas-lint-item is-${issue.tone === 'debt' ? 'debt' : issue.tone}`,
      );
      control.addEventListener('click', () => workspace?.focus(issue.id));
      item.append(control);
      lint.append(item);
    }
    meta.append(lint);

    const steps = listSteps(current.xml);
    if (steps.length) {
      const stepsTitle = document.createElement('h3');
      stepsTitle.textContent = 'Pasos';
      const stepsList = document.createElement('ol');
      stepsList.className = 'atlas-steps';
      for (const step of steps) {
        const item = document.createElement('li');
        item.textContent = step.name;
        stepsList.append(item);
      }
      meta.append(stepsTitle, stepsList);
    }
  };

  const renderList = () => {
    const needle = query.trim().toLowerCase();
    list.replaceChildren();
    for (const record of records()) {
      const haystack = `${record.title} ${record.area}`.toLowerCase();
      if (needle && !haystack.includes(needle)) continue;
      const item = document.createElement('li');
      const control = button(`${record.area} · ${record.title}`, 'atlas-process-card');
      control.dataset.processId = record.id;
      control.setAttribute('aria-pressed', String(current?.id === record.id));
      if ((record.meta?.owner || UNKNOWN) === UNKNOWN) control.title = 'Dueño DESCONOCIDO';
      control.addEventListener('click', () => openRecord(record, { editable: record.source === 'local' && editing && current?.id === record.id }));
      item.append(control);
      list.append(item);
    }
    if (!list.children.length) {
      const empty = document.createElement('li');
      empty.className = 'atlas-muted';
      empty.textContent = 'Ningún proceso coincide con la búsqueda.';
      list.append(empty);
    }
  };

  const openRecord = async (record, { editable = false } = {}) => {
    current = record;
    editing = editable;
    section.classList.add('is-diagram');
    renderList();
    const tool = section.querySelector('[data-action="bpmn-edit"]');
    const face = tool.querySelector(':scope > .rr-press-face');
    const editLabel = editable ? 'Ver' : (record.source === 'semilla' ? 'Editar copia' : 'Editar');
    if (face) face.textContent = editLabel;
    else tool.textContent = editLabel;
    try {
      const board = await ensureWorkspace();
      const report = await board.open(record.xml, { editable, fileName: record.file || '' });
      renderLanes(record.xml);
      renderStep(report.step);
      requestAnimationFrame(() => {
        if (workspace) renderStep(workspace.recenter());
      });
      if (report.importError) onToast?.('El diagrama no se pudo importar');
      else onToast?.(editable ? 'Editor BPMN listo' : 'Diagrama cargado');
    } catch (error) {
      setStatus(error.message || 'No se pudo abrir el proceso');
    }
  };

  const loadSeeds = async () => {
    const index = await fetch('/src/bpmn/seeds/index.json').then((response) => response.json());
    debt = await fetch('/src/bpmn/seeds/deuda-modelado.json').then((response) => response.json());
    seeds = await Promise.all(index.files.map(async (file) => {
      const response = await fetch(`/src/bpmn/seeds/${file}`);
      if (!response.ok) throw new Error(`No se encontró ${file}`);
      const xml = await response.text();
      return { ...describeSeed(file, xml), xml, file };
    }));
    if (seeds.length !== 16) throw new Error(`Se esperaban 16 semillas y llegaron ${seeds.length}`);
  };

  let loaded = null;
  const activate = () => {
    if (!loaded) {
      loaded = loadSeeds().then(() => {
        renderList();
        const narrow = window.matchMedia('(max-width: 760px)').matches;
        if (!narrow && !current && seeds[0]) return openRecord(seeds[0]);
        if (current) return workspace?.fit();
        return undefined;
      }).catch((error) => {
        loaded = null;
        setStatus(error.message || 'No se pudieron leer las semillas');
      });
    } else {
      workspace?.fit();
    }
    return loaded;
  };

  search.addEventListener('input', () => {
    query = search.value;
    renderList();
  });

  section.querySelector('[data-action="bpmn-fit"]').addEventListener('click', () => renderStep(workspace?.fit()));
  section.querySelector('[data-action="bpmn-prev"]')?.addEventListener('click', () => renderStep(workspace?.step(-1)));
  section.querySelector('[data-action="bpmn-next"]')?.addEventListener('click', () => renderStep(workspace?.step(1)));
  section.querySelectorAll('[data-action="bpmn-meta"]').forEach((button) => {
    button.addEventListener('click', () => {
      section.classList.toggle('is-meta-open');
      app?.classList.remove('is-bpmn-more');
      section.querySelector('[data-action="bpmn-more"]')?.setAttribute('aria-expanded', 'false');
    });
  });
  section.querySelector('[data-action="bpmn-more"]')?.addEventListener('click', (event) => {
    const open = !app.classList.contains('is-bpmn-more');
    app.classList.toggle('is-bpmn-more', open);
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  section.querySelector('[data-action="bpmn-zoom-in"]').addEventListener('click', () => workspace?.zoom(1.2));
  section.querySelector('[data-action="bpmn-zoom-out"]').addEventListener('click', () => workspace?.zoom(1 / 1.2));
  let playing = null;
  const playButton = section.querySelector('[data-action="bpmn-play"]');
  const setPlayLabel = (text) => {
    const face = playButton?.querySelector(':scope > .rr-press-face');
    if (face) face.textContent = text;
    else if (playButton) playButton.textContent = text;
  };
  const stopPlay = () => {
    if (playing) window.clearInterval(playing);
    playing = null;
    playButton?.setAttribute('aria-pressed', 'false');
    setPlayLabel('Recorrer');
  };
  playButton?.addEventListener('click', () => {
    if (playing) {
      stopPlay();
      return;
    }
    playButton.setAttribute('aria-pressed', 'true');
    setPlayLabel('Detener');
    playing = window.setInterval(() => {
      const step = workspace?.step(1);
      renderStep(step);
      if (step && step.index >= step.total - 1) stopPlay();
    }, 900);
  });
  section.querySelector('[data-action="bpmn-back"]').addEventListener('click', () => {
    stopPlay();
    section.classList.remove('is-diagram');
  });
  section.querySelector('[data-action="new-process"]').addEventListener('click', () => dialog.showModal());
  section.querySelector('[data-action="import-bpmn"]').addEventListener('click', () => fileInput.click());
  section.querySelector('[data-action="bpmn-edit"]').addEventListener('click', async () => {
    if (!current) return;
    if (editing) {
      await persistCurrent();
      await openRecord(current, { editable: false });
      return;
    }
    if (current.source === 'semilla') {
      const copy = normalizeStoredProcess({
        ...current,
        id: `local_${Date.now().toString(36)}`,
        source: 'local',
        estado: 'borrador',
        file: '',
        title: `${current.title} (copia)`,
        xml: current.xml,
      });
      locals = [copy, ...locals];
      saveLocals();
      await openRecord(copy, { editable: true });
      return;
    }
    await openRecord(current, { editable: true });
  });

  const exportName = (extension) => `${slug(current?.title)}.${extension}`;
  section.querySelector('[data-action="bpmn-export"]').addEventListener('click', async () => {
    if (!workspace || !current) return;
    try {
      await workspace.exportXml(exportName('bpmn'));
      onToast?.('BPMN exportado');
    } catch (error) {
      onToast?.(error.message || 'No se pudo exportar');
    }
  });
  section.querySelector('[data-action="bpmn-svg"]').addEventListener('click', async () => {
    if (!workspace || !current) return;
    await workspace.exportSvg(exportName('svg'));
    onToast?.('SVG exportado');
  });
  section.querySelector('[data-action="bpmn-png"]').addEventListener('click', async () => {
    if (!workspace || !current) return;
    const light = document.body.classList.contains('atlas-theme-light');
    const corte = current.meta?.fechaCorte && current.meta.fechaCorte !== UNKNOWN
      ? current.meta.fechaCorte
      : new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short' }).format(new Date());
    await workspace.exportPng(exportName('png'), {
      logoUrl: light ? '/src/brand/simbolo_negro_on_blanco.png' : '/src/brand/simbolo_mostaza_on_negro.png',
      footer: `RR ALIADOS · ${presentSource(current.meta?.fuente)} · corte: ${corte} · bpmn.io`,
    });
    onToast?.('PNG exportado');
  });

  dialog.querySelector('[data-action="create-process"]').addEventListener('click', async (event) => {
    event.preventDefault();
    const name = dialog.querySelector('[data-atlas-new-name]').value.trim() || 'Nuevo proceso';
    const owner = dialog.querySelector('[data-atlas-new-owner]').value.trim();
    const kpi = dialog.querySelector('[data-atlas-new-kpi]').value.trim();
    const xml = createNewProcessXml({ name, owner, kpi });
    const meta = parseProcessMeta(xml);
    const record = normalizeStoredProcess({
      id: `local_${Date.now().toString(36)}`,
      title: meta.title || name,
      area: 'Local',
      areaKey: 'local',
      xml,
      estado: 'borrador',
      source: 'local',
      meta,
    });
    locals = [record, ...locals];
    saveLocals();
    dialog.close();
    dialog.querySelector('form').reset();
    await activate();
    await openRecord(record, { editable: true });
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const xml = await file.text();
    const board = await ensureWorkspace();
    const report = await board.open(xml, { editable: false, fileName: file.name });
    if (report.importError) {
      onToast?.('El archivo no es un BPMN válido');
      return;
    }
    const meta = parseProcessMeta(xml);
    const record = normalizeStoredProcess({
      id: `local_${Date.now().toString(36)}`,
      title: meta.title || file.name.replace(/\.bpmn$/i, ''),
      area: 'Local',
      xml,
      estado: 'borrador',
      source: 'local',
      file: file.name,
      meta,
    });
    locals = [record, ...locals];
    saveLocals();
    current = record;
    editing = false;
    renderList();
    renderReport(report);
    onToast?.('Proceso importado como borrador');
  });

  document.addEventListener('atlas-theme', () => workspace?.restyle());
  window.addEventListener('resize', () => {
    if (!section.hidden && workspace) renderStep(workspace.recenter());
  });

  return { activate, fit: () => workspace?.fit() };
}
