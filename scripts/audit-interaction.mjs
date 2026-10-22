import { mkdir, writeFile } from 'node:fs/promises';

const playwright = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { chromium } = playwright.default ?? playwright;
const BASE = process.env.ATLAS_AUDIT_URL || 'http://127.0.0.1:4174/';
const OUT = process.env.ATLAS_AUDIT_OUT || '/tmp/atlas-interaction';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  try { localStorage.setItem('rr-atlas-tour-v1', '1'); } catch { /* medición sin recorrido */ }
});
let acceptNext = false;
const dialogs = [];
page.on('dialog', async (dialog) => {
  dialogs.push(dialog.message());
  if (acceptNext) {
    acceptNext = false;
    await dialog.accept();
  } else {
    await dialog.dismiss();
  }
});
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.atlas-card');

const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? '' });
  } catch (error) {
    results.push({ name, ok: false, detail: String(error).split('\n').slice(0, 4).join(' ').slice(0, 400) });
  }
}

await check('cabecera compacta', async () => {
  const box = await page.locator('.atlas-header').boundingBox();
  if (!box || box.height > 96) throw new Error(`alto ${Math.round(box?.height || 0)}`);
  return `alto ${Math.round(box.height)}`;
});
await check('tocar tarjeta abre ficha', async () => {
  await page.locator('.atlas-card').first().click();
  await page.waitForTimeout(250);
  const open = await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-detail-open'));
  if (!open) throw new Error('la ficha no se abrió');
  return 'ficha abierta';
});
await check('Escape cierra la ficha', async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const open = await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-detail-open'));
  if (open) throw new Error('la ficha sigue abierta');
  return 'cerrada';
});
await check('botón Cerrar ficha', async () => {
  await page.locator('.atlas-card').first().click();
  await page.locator('[data-action="close-detail"]').click();
  const open = await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-detail-open'));
  if (open) throw new Error('sigue abierta');
  return 'cerrada';
});
await check('alejar cambia el zoom', async () => {
  const before = await page.locator('[data-atlas-world]').evaluate((el) => el.style.transform);
  await page.locator('[data-action="zoom-out"]').click();
  await page.waitForTimeout(80);
  const after = await page.locator('[data-atlas-world]').evaluate((el) => el.style.transform);
  if (before === after) throw new Error('el transform no cambió');
  return 'zoom cambió';
});
await check('Reencuadrar responde', async () => {
  await page.locator('[data-action="center"]').click();
  await page.waitForTimeout(80);
  const text = await page.locator('[data-atlas-status]').innerText();
  if (!text.trim()) throw new Error('sin estado');
  return text.trim().slice(0, 60);
});
await check('Acciones abre la hoja', async () => {
  await page.locator('[data-action="toggle-tools"]').click();
  const open = await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-tools-open'));
  if (!open) throw new Error('hoja cerrada');
  await page.locator('[data-action="toggle-tools"]').click();
  return 'abierta y cerrada';
});
await check('Configuración abre y cierra', async () => {
  await page.locator('[data-action="toggle-settings"]').click();
  const visible = await page.locator('[data-atlas-settings]').isVisible();
  if (!visible) throw new Error('panel oculto');
  await page.locator('[data-action="toggle-settings"]').click();
  return 'panel visible';
});
await check('Buscar filtra el mapa', async () => {
  const before = await page.locator('.atlas-card').count();
  await page.locator('[data-atlas-search]').fill('zzzz-sin-resultado');
  await page.waitForTimeout(150);
  const after = await page.locator('.atlas-card').count();
  if (after !== 0) throw new Error(`siguen ${after} tarjetas`);
  await page.locator('[data-atlas-search]').fill('');
  return `${before} → 0`;
});
await check('pestaña Procesos abre la lista', async () => {
  await page.locator('.atlas-tabbar [data-atlas-section-target="procesos"]').click();
  await page.waitForSelector('[data-process-id]');
  const list = await page.locator('[data-process-id]').count();
  if (list < 16) throw new Error(`lista ${list}`);
  return `${list} procesos`;
});
await check('abrir un proceso muestra el paso', async () => {
  await page.locator('[data-process-id="alianzas_como_nace_una_alianza"]').click();
  await page.waitForFunction(() => (document.querySelector('[data-atlas-step]')?.textContent || '').includes('de'));
  return (await page.locator('[data-atlas-step]').innerText()).trim();
});
await check('Siguiente avanza el paso', async () => {
  const before = await page.locator('[data-atlas-step]').innerText();
  await page.locator('[data-action="bpmn-next"]').click();
  await page.waitForTimeout(200);
  const after = await page.locator('[data-atlas-step]').innerText();
  if (before === after) throw new Error(`${before} = ${after}`);
  return `${before.trim()} → ${after.trim()}`;
});
await check('Validación abre la hoja', async () => {
  await page.locator('[data-action="bpmn-meta"]').click();
  const open = await page.locator('[data-atlas-process]').evaluate((el) => el.classList.contains('is-meta-open'));
  if (!open) throw new Error('validación cerrada');
  return 'abierta';
});
await check('Nuevo proceso abre el diálogo', async () => {
  await page.locator('[data-action="bpmn-back"]').click();
  await page.locator('[data-action="new-process"]').click();
  const open = await page.locator('[data-atlas-new-process]').evaluate((el) => el.open);
  if (!open) throw new Error('diálogo cerrado');
  await page.keyboard.press('Escape');
  return 'diálogo abierto';
});
await check('Menú abre el explorador', async () => {
  await page.locator('.atlas-tabbar [data-atlas-section-target="menu"]').click();
  const open = await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-menu-open'));
  if (!open) throw new Error('menú cerrado');
  await page.keyboard.press('Escape');
  return 'abierto';
});
await check('Buscar de la barra enfoca el campo', async () => {
  await page.locator('.atlas-tabbar [data-atlas-section-target="buscar"]').click();
  const active = await page.evaluate(() => document.activeElement?.matches('[data-atlas-search]'));
  if (!active) throw new Error('el campo no tiene el foco');
  return 'foco en buscar';
});
await check('tema claro', async () => {
  await page.locator('[data-action="toggle-settings"]').click();
  await page.locator('[data-action="toggle-theme"]').click();
  const light = await page.evaluate(() => document.body.classList.contains('atlas-theme-light'));
  if (!light) throw new Error('sigue oscuro');
  await page.locator('[data-action="toggle-theme"]').click();
  await page.locator('[data-action="toggle-settings"]').click();
  return 'claro y de vuelta';
});
await check('sin scroll horizontal', async () => {
  const box = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  if (box.sw > box.cw) throw new Error(`${box.sw}/${box.cw}`);
  return `${box.sw}/${box.cw}`;
});
await check('controles de al menos 44 px', async () => {
  const bad = await page.evaluate(() => {
    const hits = [];
    for (const el of document.querySelectorAll('button, input, select, textarea')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || el.closest('[hidden]')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.height < 44) hits.push(`${Math.round(rect.height)} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 32)}`);
    }
    return hits.slice(0, 6);
  });
  if (bad.length) throw new Error(bad.join(' | '));
  return 'ok';
});
async function toastText() {
  const toast = page.locator('[data-atlas-toast]');
  await toast.waitFor({ state: 'visible', timeout: 4000 });
  return (await toast.innerText()).replace(/\s+/g, ' ').trim();
}

await check('acercar cambia el zoom', async () => {
  await page.locator('.atlas-tabbar [data-atlas-section-target="mapa"]').click();
  const before = await page.locator('[data-atlas-world]').evaluate((el) => el.style.transform);
  await page.locator('[data-action="zoom-in"]').click();
  const after = await page.locator('[data-atlas-world]').evaluate((el) => el.style.transform);
  if (before === after) throw new Error('el transform no cambió');
  return 'zoom cambió';
});
await check('Volver al nodo centra la selección', async () => {
  const before = await page.locator('[data-atlas-world]').evaluate((el) => el.style.transform);
  await page.locator('[data-action="zoom-out"]').click();
  await page.locator('[data-action="locate"]').click();
  const message = await toastText();
  if (!message.includes('Nodo seleccionado')) throw new Error(message);
  await page.waitForTimeout(280);
  const after = await page.locator('[data-atlas-world]').evaluate((el) => el.style.transform);
  if (before === after && !message) throw new Error('sin movimiento');
  const place = await page.locator('[data-atlas-where]').innerText();
  return `${message} · ${place.trim()}`;
});
await check('doble toque acerca el mapa', async () => {
  const before = await page.locator('[data-atlas-world]').evaluate((el) => el.style.transform);
  const box = await page.locator('[data-atlas-work]').boundingBox();
  const x = box.x + 24;
  const y = box.y + 24;
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
  await page.waitForTimeout(280);
  const after = await page.locator('[data-atlas-world]').evaluate((el) => el.style.transform);
  if (before === after) throw new Error('el doble toque no acercó');
  return 'zoom cambió';
});
await check('arrastre de la ficha la cierra', async () => {
  await page.mouse.up();
  await page.locator('.atlas-card').first().click();
  await page.waitForTimeout(500);
  const opened = await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-detail-open'));
  if (!opened) throw new Error('el toque no abrió la ficha');
  await page.evaluate(() => {
    const side = document.querySelector('.atlas-sidebar');
    window.__sheet = { down: 0, move: 0, up: 0 };
    side.addEventListener('pointerdown', () => { window.__sheet.down += 1; });
    side.addEventListener('pointermove', () => { window.__sheet.move += 1; });
    side.addEventListener('pointerup', () => { window.__sheet.up += 1; });
  });
  const probe = await page.evaluate(() => {
    const handle = document.querySelector('.atlas-sheet-handle');
    const side = handle.parentElement;
    const rect = handle.getBoundingClientRect();
    let point = null;
    const samples = [];
    for (let y = rect.top + 4; y < rect.bottom - 2; y += 6) {
      const x = rect.left + rect.width / 2;
      const top = document.elementFromPoint(x, y);
      const name = (top?.className || '').toString().slice(0, 28);
      samples.push(`${Math.round(y)}:${name}`);
      if (!point && top && (top === handle || handle.contains(top))) point = { x, y };
    }
    const style = getComputedStyle(side);
    const x = rect.left + rect.width / 2;
    const y = rect.top + 12;
    const chain = [];
    let node = side;
    while (node && node !== document.documentElement) {
      const computed = getComputedStyle(node);
      chain.push(`${(node.className || node.tagName).toString().slice(0, 18)} z=${computed.zIndex} pe=${computed.pointerEvents} p=${computed.position}`);
      node = node.parentElement;
    }
    return {
      point,
      samples,
      pos: style.position,
      z: style.zIndex,
      pe: style.pointerEvents,
      canvasZ: getComputedStyle(document.querySelector('.atlas-canvas')).zIndex,
      stack: document.elementsFromPoint(x, y).slice(0, 6).map((el) => (el.className || el.tagName).toString().slice(0, 28)),
      chain,
    };
  });
  if (!probe.point) throw new Error(`el asa no recibe el toque ${JSON.stringify(probe)}`);
  const x = probe.point.x;
  const y = probe.point.y;
  const top = 'atlas-sheet-handle';
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, Math.min(y + 460, 820), { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const open = await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-detail-open'));
  if (open) {
    const debug = await page.evaluate(() => ({
      sheet: window.__sheet,
      transform: document.querySelector('.atlas-sidebar').style.transform,
      cls: document.querySelector('.atlas-sidebar').className,
    }));
    throw new Error(`sigue abierta ${top} ${JSON.stringify(debug)}`);
  }
  return 'cerrada con el gesto';
});
await check('teclado activa Acercar', async () => {
  const before = await page.locator('[data-atlas-world]').evaluate((el) => el.style.transform);
  await page.locator('[data-action="zoom-in"]').focus();
  await page.keyboard.press('Enter');
  const after = await page.locator('[data-atlas-world]').evaluate((el) => el.style.transform);
  if (before === after) throw new Error('Enter no acercó');
  return 'Enter acercó';
});
await check('Nuevo nodo agrega una tarjeta', async () => {
  await page.keyboard.press('Escape');
  await page.locator('[data-action="toggle-tools"]').click();
  const before = await page.locator('.atlas-card').count();
  await page.locator('[data-action="add"]').click();
  await page.waitForTimeout(150);
  const after = await page.locator('.atlas-card').count();
  if (after !== before + 1) throw new Error(`${before} → ${after}`);
  return `${before} → ${after}`;
});
await check('Deshacer y Rehacer el nodo', async () => {
  const before = await page.locator('.atlas-card').count();
  await page.locator('[data-action="undo"]').click();
  await page.waitForTimeout(120);
  const undone = await page.locator('.atlas-card').count();
  if (undone !== before - 1) throw new Error(`deshacer ${before} → ${undone}`);
  const tools = page.locator('[data-atlas-tools]');
  await tools.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const redoInfo = await page.evaluate(() => {
    const el = document.querySelector('[data-action="redo"]');
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + Math.min(20, rect.height / 2);
    const top = document.elementFromPoint(x, y);
    return {
      open: document.querySelector('#atlas-app').classList.contains('is-tools-open'),
      y: Math.round(rect.top),
      h: Math.round(rect.height),
      top: top?.getAttribute('data-action') || top?.className || '',
      x, y,
    };
  });
  if (redoInfo.top !== 'redo' && !String(redoInfo.top).includes('rr-press')) {
    throw new Error(`rehacer no recibe el toque ${JSON.stringify(redoInfo)}`);
  }
  await page.mouse.click(redoInfo.x, redoInfo.y);
  await page.waitForTimeout(120);
  const redone = await page.locator('.atlas-card').count();
  if (redone !== before) throw new Error(`rehacer ${redone}`);
  await page.locator('[data-action="undo"]').click();
  return `${before} → ${undone} → ${redone}`;
});
await check('Dibujar abre el menú y prepara el lienzo', async () => {
  await page.locator('[data-action="draw"]').click();
  const open = await page.locator('[data-atlas-draw-menu]').isVisible();
  if (!open) throw new Error('menú cerrado');
  await page.locator('[data-draw-shape="rectangle"]').click();
  const drawing = await page.locator('[data-atlas-work]').evaluate((el) => el.classList.contains('is-drawing'));
  if (!drawing) throw new Error('el lienzo no quedó en modo dibujo');
  await page.locator('[data-atlas-work]').click({ position: { x: 30, y: 30 } });
  const message = await toastText();
  if (!message.toLowerCase().includes('rectángulo') && !message.toLowerCase().includes('creado')) throw new Error(message);
  await page.locator('[data-action="undo"]').click();
  return message;
});
await check('Conectar pide un segundo nodo', async () => {
  await page.locator('.atlas-card').first().click();
  await page.keyboard.press('Escape');
  if (!(await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-tools-open')))) {
    await page.locator('[data-action="toggle-tools"]').click();
  }
  await page.locator('[data-action="connect"]').click();
  const message = await toastText();
  if (!message.includes('segundo nodo')) throw new Error(message);
  return message;
});
await check('Ir a un proceso centra un proceso', async () => {
  await page.locator('[data-action="flow"]').click();
  const message = await toastText();
  if (!message.includes('Proceso')) throw new Error(message);
  return message;
});
await check('figuras del menú Dibujar', async () => {
  if (!(await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-tools-open')))) {
    await page.locator('[data-action="toggle-tools"]').click();
  }
  const shapes = ['rounded', 'circle', 'diamond', 'hexagon', 'note'];
  for (const shape of shapes) {
    await page.locator('[data-action="draw"]').click();
    await page.locator(`[data-draw-shape="${shape}"]`).click();
    const drawing = await page.locator('[data-atlas-work]').evaluate((el) => el.classList.contains('is-drawing'));
    if (!drawing) throw new Error(shape);
  }
  return shapes.join(', ');
});
await check('Exportar mapa descarga JSON', async () => {
  await page.keyboard.press('Escape');
  await page.locator('[data-action="toggle-settings"]').click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    page.locator('[data-action="export"]').click(),
  ]);
  const name = download.suggestedFilename();
  await download.cancel();
  if (!name.endsWith('.json')) throw new Error(name);
  return name;
});
await check('Importar mapa abre el archivo', async () => {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 8000 }),
    page.locator('[data-action="import"]').click(),
  ]);
  await chooser.setFiles([]);
  return 'selector de archivo';
});
await check('Restaurar base pide confirmación', async () => {
  dialogs.length = 0;
  await page.locator('[data-action="reset"]').click();
  if (!dialogs.some((message) => message.includes('Restaurar'))) throw new Error(dialogs.join(' | ') || 'sin diálogo');
  return 'diálogo y cancelado';
});
await check('Minimapa se oculta y vuelve', async () => {
  await page.locator('[data-action="toggle-minimap"]').click();
  const hidden = await page.locator('.atlas-minimap').evaluate((el) => el.hidden);
  if (!hidden) throw new Error('sigue visible');
  const message = await toastText();
  await page.locator('[data-action="toggle-minimap"]').click();
  return message;
});
await check('Conexiones se ocultan', async () => {
  await page.locator('[data-action="toggle-wires"]').click();
  const message = await toastText();
  if (!message.includes('Conexiones')) throw new Error(message);
  await page.locator('[data-action="toggle-wires"]').click();
  await page.locator('[data-action="toggle-settings"]').click();
  return message;
});
await check('Menú filtra por tipo y vuelve', async () => {
  await page.locator('.atlas-tabbar [data-atlas-section-target="menu"]').click();
  const all = await page.locator('.atlas-card').count();
  await page.locator('[data-atlas-filter="Gobierno"]').click();
  await page.waitForTimeout(150);
  const filtered = await page.locator('.atlas-card').count();
  if (filtered >= all || filtered < 1) throw new Error(`${all} → ${filtered}`);
  await page.locator('.atlas-tabbar [data-atlas-section-target="menu"]').click();
  await page.locator('[data-atlas-filter="Todo"]').click();
  await page.waitForTimeout(150);
  const restored = await page.locator('.atlas-card').count();
  if (restored < all) throw new Error(`restaurado ${restored}`);
  return `${all} → ${filtered} → ${restored}`;
});
async function clickVisibleCard() {
  await page.keyboard.press('Escape');
  await page.locator('[data-action="locate"]').click();
  await page.waitForTimeout(500);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const point = await page.evaluate(() => {
      const stage = document.querySelector('[data-atlas-work]').getBoundingClientRect();
      for (const el of document.querySelectorAll('.atlas-card')) {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        if (x < stage.left || x > stage.right || y < stage.top || y > stage.bottom) continue;
        const top = document.elementFromPoint(x, y);
        if (top && (top === el || el.contains(top))) return { x, y };
      }
      return null;
    });
    if (!point) throw new Error('ninguna tarjeta visible');
    await page.mouse.up();
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(350);
    const open = await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-detail-open'));
    if (open) return;
  }
  throw new Error('la ficha no se abrió');
}

await check('Aplicar, descartar y eliminar con deshacer', async () => {
  await clickVisibleCard();
  const title = page.locator('.atlas-sidebar label', { hasText: 'Título' }).locator('input');
  await title.waitFor({ state: 'visible', timeout: 4000 });
  await page.locator('.atlas-sidebar').evaluate((el) => { el.scrollTop = 0; });
  const box = await title.boundingBox();
  if (!box) throw new Error('el título no está en pantalla');
  await page.mouse.click(box.x + Math.min(24, box.width / 2), box.y + box.height / 2);
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Nodo de prueba');
  await page.getByRole('button', { name: 'Aplicar cambios' }).click();
  const applied = await toastText();
  if (!applied.startsWith('Aplicado')) throw new Error(applied);
  await page.locator('.atlas-color-swatch').nth(1).click();
  const active = await page.locator('.atlas-color-swatch.is-active').count();
  if (active !== 1) throw new Error('paleta');
  await page.getByRole('button', { name: 'Descartar cambios' }).click();
  const discarded = await toastText();
  if (!discarded.includes('descartados')) throw new Error(discarded);
  acceptNext = true;
  await page.getByRole('button', { name: 'Eliminar' }).click();
  const removed = await toastText();
  if (!removed.includes('eliminado')) throw new Error(removed);
  const undo = page.locator('[data-atlas-toast] button');
  const undoBox = await undo.boundingBox();
  if (!undoBox) throw new Error('el deshacer no está a la vista');
  await page.mouse.click(undoBox.x + undoBox.width / 2, undoBox.y + undoBox.height / 2);
  await page.waitForTimeout(200);
  const back = await page.locator('.atlas-card', { hasText: 'Nodo de prueba' }).count();
  if (!back) throw new Error('el deshacer no restauró el nodo');
  return 'aplicado, descartado, eliminado, deshecho';
});
await check('Agregar recurso abre y cancela', async () => {
  await clickVisibleCard();
  await page.getByRole('button', { name: 'Agregar foto, video o archivo' }).click();
  const open = await page.locator('[data-atlas-dialog]').evaluate((el) => el.open);
  if (!open) throw new Error('diálogo cerrado');
  const choice = page.locator('[data-atlas-choices] button');
  if (await choice.count()) await choice.first().click();
  await page.locator('[data-action="cancel-link"]').click();
  const still = await page.locator('[data-atlas-dialog]').evaluate((el) => el.open);
  if (still) throw new Error('sigue abierto');
  return 'diálogo cerrado';
});
await check('Cerrar visor', async () => {
  await page.locator('[data-atlas-viewer-dialog]').evaluate((el) => el.showModal());
  await page.locator('[data-action="close-viewer"]').click();
  const open = await page.locator('[data-atlas-viewer-dialog]').evaluate((el) => el.open);
  if (open) throw new Error('el visor sigue abierto');
  await page.keyboard.press('Escape');
  return 'visor cerrado';
});
await check('Anterior retrocede el paso', async () => {
  await page.locator('.atlas-tabbar [data-atlas-section-target="procesos"]').click();
  await page.locator('[data-process-id="alianzas_como_nace_una_alianza"]').click();
  await page.waitForFunction(() => (document.querySelector('[data-atlas-step]')?.textContent || '').includes('de'));
  await page.locator('[data-action="bpmn-next"]').click();
  const mid = (await page.locator('[data-atlas-step]').innerText()).trim();
  await page.locator('[data-action="bpmn-prev"]').click();
  await page.waitForTimeout(150);
  const back = (await page.locator('[data-atlas-step]').innerText()).trim();
  if (mid === back) throw new Error(`${mid} = ${back}`);
  return `${mid} → ${back}`;
});
await check('Reencuadrar diagrama responde', async () => {
  await page.locator('[data-action="bpmn-fit"]').click();
  await page.waitForTimeout(120);
  const step = (await page.locator('[data-atlas-step]').innerText()).trim();
  if (!step.includes('de')) throw new Error(step);
  return step;
});
await check('Más abre recorrer, zoom y exportar', async () => {
  await page.locator('[data-action="bpmn-more"]').click();
  const open = await page.locator('#atlas-app').evaluate((el) => el.classList.contains('is-bpmn-more'));
  if (!open) throw new Error('panel cerrado');
  await page.locator('[data-action="bpmn-play"]').click();
  const pressed = await page.locator('[data-action="bpmn-play"]').getAttribute('aria-pressed');
  if (pressed !== 'true') throw new Error(pressed || 'sin estado');
  await page.locator('[data-action="bpmn-play"]').click();
  const stopped = await page.locator('[data-action="bpmn-play"]').getAttribute('aria-pressed');
  if (stopped !== 'false') throw new Error('sigue recorriendo');
  const before = await page.locator('.djs-container .viewport').first().getAttribute('transform');
  await page.locator('[data-action="bpmn-zoom-in"]').click();
  await page.waitForTimeout(80);
  const closer = await page.locator('.djs-container .viewport').first().getAttribute('transform');
  if (closer === before) throw new Error('el zoom del diagrama no cambió');
  await page.locator('[data-action="bpmn-zoom-out"]').click();
  const [bpmn] = await Promise.all([
    page.waitForEvent('download', { timeout: 12000 }),
    page.locator('[data-action="bpmn-export"]').click(),
  ]);
  const bpmnName = bpmn.suggestedFilename();
  await bpmn.cancel();
  const [svg] = await Promise.all([
    page.waitForEvent('download', { timeout: 12000 }),
    page.locator('[data-action="bpmn-svg"]').click(),
  ]);
  const svgName = svg.suggestedFilename();
  await svg.cancel();
  const [png] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('[data-action="bpmn-png"]').click(),
  ]);
  const pngName = png.suggestedFilename();
  await png.cancel();
  return `${bpmnName}, ${svgName}, ${pngName}`;
});
await check('Editar copia abre el editor', async () => {
  await page.locator('[data-action="bpmn-edit"]').click();
  await page.waitForFunction(() => (document.querySelector('[data-action="bpmn-edit"] .rr-press-face, [data-action="bpmn-edit"]')?.textContent || '').includes('Ver'), null, { timeout: 20000 });
  const label = (await page.locator('[data-action="bpmn-edit"]').innerText()).trim();
  if (!label.includes('Ver')) throw new Error(label);
  await page.locator('[data-action="bpmn-edit"]').click();
  await page.waitForTimeout(400);
  return label;
});
await check('Lista vuelve al índice', async () => {
  await page.locator('[data-action="bpmn-back"]').click();
  const diagram = await page.locator('[data-atlas-process]').evaluate((el) => el.classList.contains('is-diagram'));
  if (diagram) throw new Error('sigue en el diagrama');
  return 'lista';
});
await check('Buscar proceso vacía la lista', async () => {
  await page.locator('[data-atlas-process-search]').fill('zzzz-sin-resultado');
  await page.waitForTimeout(100);
  const empty = await page.locator('[data-atlas-process-list]').innerText();
  if (!empty.includes('Ningún proceso')) throw new Error(empty.slice(0, 80));
  await page.locator('[data-atlas-process-search]').fill('');
  const count = await page.locator('[data-process-id]').count();
  if (count < 16) throw new Error(String(count));
  return `vacío y ${count}`;
});
await check('Importar .bpmn abre el archivo', async () => {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 8000 }),
    page.locator('[data-action="import-bpmn"]').click(),
  ]);
  await chooser.setFiles([]);
  return 'selector de archivo';
});
await check('Crear proceso abre el editor', async () => {
  await page.locator('[data-action="new-process"]').click();
  await page.locator('[data-atlas-new-name]').fill('Proceso de prueba');
  await page.locator('[data-action="create-process"]').click();
  await page.waitForFunction(() => (document.querySelector('[data-action="bpmn-edit"]')?.textContent || '').includes('Ver'), null, { timeout: 20000 });
  const status = (await page.locator('[data-atlas-bpmn-status]').innerText()).trim();
  await page.locator('[data-action="bpmn-back"]').click();
  return status.slice(0, 80);
});
await check('recorrido de primer uso se puede omitir', async () => {
  const tourContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tour = await tourContext.newPage();
  tour.on('dialog', (dialog) => dialog.dismiss());
  tour.on('pageerror', (error) => errors.push(String(error)));
  await tour.goto(BASE, { waitUntil: 'networkidle' });
  await tour.waitForSelector('[data-atlas-tour]:not([hidden])');
  const title = (await tour.locator('[data-atlas-tour-title]').innerText()).trim();
  if (title !== 'El mapa') throw new Error(title);
  await tour.locator('[data-atlas-tour-next]').click();
  const second = (await tour.locator('[data-atlas-tour-title]').innerText()).trim();
  if (second !== 'Los procesos') throw new Error(second);
  await tour.locator('[data-atlas-tour-skip]').click();
  const hidden = await tour.locator('[data-atlas-tour]').evaluate((el) => el.hidden);
  if (!hidden) throw new Error('sigue visible');
  await tourContext.close();
  return `${title} → ${second} → omitido`;
});
await check('reduced-motion conserva la ficha', async () => {
  const calmContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const calm = await calmContext.newPage();
  await calm.emulateMedia({ reducedMotion: 'reduce' });
  calm.on('pageerror', (error) => errors.push(String(error)));
  await calm.addInitScript(() => { try { localStorage.setItem('rr-atlas-tour-v1', '1'); } catch { /* medición */ } });
  await calm.goto(BASE, { waitUntil: 'networkidle' });
  await calm.waitForSelector('.atlas-card');
  await calm.locator('.atlas-card').first().click();
  const open = await calm.locator('#atlas-app').evaluate((el) => el.classList.contains('is-detail-open'));
  if (!open) throw new Error('la ficha no se abrió');
  const motion = await calm.locator('.atlas-sidebar').evaluate((el) => getComputedStyle(el).animationName);
  await calm.keyboard.press('Escape');
  await calmContext.close();
  return `abierta, animación ${motion}`;
});
await check('controles de procesos de al menos 44 px', async () => {
  await page.locator('.atlas-tabbar [data-atlas-section-target="procesos"]').click();
  await page.locator('[data-process-id]').first().click();
  await page.waitForSelector('[data-action="bpmn-next"]');
  await page.locator('[data-action="bpmn-more"]').click();
  const bad = await page.evaluate(() => {
    const hits = [];
    for (const el of document.querySelectorAll('button, input, select, textarea')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || el.closest('[hidden]')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.height < 44 || rect.width < 44) hits.push(`${Math.round(rect.width)}x${Math.round(rect.height)} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 32)}`);
    }
    return hits.slice(0, 8);
  });
  if (bad.length) throw new Error(bad.join(' | '));
  return 'ok';
});
await check('cero errores de página', async () => {
  if (errors.length) throw new Error(errors.join(' | '));
  return '0';
});

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/report.json`, JSON.stringify({ errors, results }, null, 2));
const passed = results.filter((item) => item.ok).length;
console.log(`INTERACCION ${passed}/${results.length}`);
for (const item of results) console.log(`${item.ok ? 'ok' : 'FALLA'} ${item.name}: ${item.detail}`);
await browser.close();
if (passed !== results.length || errors.length) process.exit(1);
