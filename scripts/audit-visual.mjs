import { mkdir, writeFile } from 'node:fs/promises';
import { findLabelHits, findOverlaps, findOverflows, findPressMisalignments, findWordBreaks } from '../src/ui/overlap.mjs';

const playwright = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { chromium } = playwright.default ?? playwright;
const BASE = process.env.ATLAS_AUDIT_URL || 'http://127.0.0.1:4174/';
const OUT = process.env.ATLAS_AUDIT_OUT || '/tmp/atlas-audit';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '1440x900', width: 1440, height: 900 },
];

function collectScript() {
  const selectors = [
    '.atlas-header',
    '.atlas-toolbar',
    '.atlas-toolbar-bar',
    '.atlas-toolbar-extra',
    '.atlas-tabbar',
    '.atlas-status',
    '.atlas-sidebar',
    '.atlas-settings-panel',
    '.atlas-rail',
    '.atlas-card',
    '.atlas-process-toolbar',
    '.atlas-process-meta',
    '.atlas-process-list',
    '.atlas-bpmn-status',
    '.atlas-lane-legend',
    '.atlas-minimap',
    '.bjs-powered-by',
    'dialog[open]',
    '.atlas-toolbar button',
    '.atlas-process-toolbar button',
    '.atlas-header button',
    '.atlas-sidebar button',
    '.atlas-settings-panel button',
    '.atlas-rail button',
    '.atlas-search input',
    '.atlas-process-search input',
  ].join(',');
  const textSelectors = 'h1,h2,h3,p,button,label,a,dt,dd,li,span';
  const root = document.documentElement;
  const view = { w: root.clientWidth, h: root.clientHeight };
  let serial = 0;
  const nodes = [];
  const roleOf = (el) => {
    if (el.matches('.atlas-backdrop')) return 'skip';
    if (el.matches('.atlas-header, .atlas-tabbar')) return 'bar';
    if (el.matches('.atlas-card')) return 'canvas';
    if (el.matches('dialog')) return 'modal';
    const sheet = el.matches('.atlas-toolbar-extra') ? el : el.closest('.atlas-toolbar-extra');
    if (sheet && getComputedStyle(sheet).position === 'fixed') return 'overlay';
    if (el.matches('.atlas-sidebar, .atlas-settings-panel, .atlas-rail, .atlas-process-meta')) return 'overlay';
    if (el.closest('.atlas-sidebar, .atlas-settings-panel, .atlas-rail, dialog, .atlas-process-meta')) return 'overlay';
    return 'chrome';
  };
  const clip = (el, rect) => {
    let x = rect.left;
    let y = rect.top;
    let r = rect.right;
    let b = rect.bottom;
    let node = el.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      const ox = style.overflowX;
      const oy = style.overflowY;
      if (['hidden', 'clip', 'auto', 'scroll'].includes(ox) || ['hidden', 'clip', 'auto', 'scroll'].includes(oy)) {
        const box = node.getBoundingClientRect();
        x = Math.max(x, box.left);
        y = Math.max(y, box.top);
        r = Math.min(r, box.right);
        b = Math.min(b, box.bottom);
      }
      node = node.parentElement;
    }
    if (r - x < 2 || b - y < 2) return null;
    return { x, y, w: r - x, h: b - y };
  };
  const remember = (el, kind) => {
    if (!(el instanceof Element) || el.closest('[hidden]')) return null;
    const role = roleOf(el);
    if (role === 'skip') return null;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    const rect = clip(el, el.getBoundingClientRect());
    if (!rect) return null;
    if (rect.y + rect.h < 0 || rect.y > view.h || rect.x + rect.w < 0 || rect.x > view.w) return null;
    if (!el.dataset.auditId) {
      serial += 1;
      el.dataset.auditId = `a${serial}`;
    }
    const ancestors = [];
    let parent = el.parentElement;
    while (parent) {
      if (parent.dataset.auditId) ancestors.push(parent.dataset.auditId);
      parent = parent.parentElement;
    }
    const item = {
      id: el.dataset.auditId,
      name: `${kind} ${(el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 70)}`,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      ancestors,
      kind,
      role,
    };
    nodes.push(item);
    return item;
  };
  document.querySelectorAll(selectors).forEach((el) => remember(el, 'chrome'));
  const overflows = [];
  document.querySelectorAll(textSelectors).forEach((el) => {
    if (el.closest('[hidden], .djs-label, .sr-only')) return;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.bottom < 0 || rect.top > view.h) return;
    const scrolling = style.overflowX === 'auto' || style.overflowX === 'scroll';
    if (!scrolling && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      overflows.push({
        name: (el.getAttribute('aria-label') || el.textContent || el.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 70),
        overflow: true,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      });
    }
  });
  const labels = [];
  const shapes = [];
  document.querySelectorAll('.djs-label').forEach((el) => {
    const item = remember(el, 'etiqueta');
    if (item) labels.push(item);
  });
  document.querySelectorAll('.djs-element').forEach((el) => {
    if (el.querySelector('.djs-label')) return;
    const visual = el.querySelector('.djs-visual');
    if (!visual || !visual.querySelector('rect,circle,polygon,ellipse')) return;
    const type = el.dataset.elementId || '';
    const item = remember(visual, 'forma');
    if (!item) return;
    item.name = `forma ${type || visual.textContent || ''}`.trim().slice(0, 70);
    shapes.push(item);
  });
  const brokenWords = (el) => {
    const words = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest('svg, .sr-only, [hidden]')) return NodeFilter.FILTER_REJECT;
        if (!el.contains(parent)) return NodeFilter.FILTER_REJECT;
        if (el.matches('button') && parent.closest('button') !== el) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue || '';
      const pattern = /\S+/g;
      let match = pattern.exec(value);
      while (match) {
        const word = match[0];
        if (word.length > 1) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + word.length);
          const lines = [];
          for (const rect of range.getClientRects()) {
            if (rect.width < 0.5 || rect.height < 0.5) continue;
            const line = lines.find((item) => Math.abs(item - rect.top) < 2);
            if (line == null) lines.push(rect.top);
          }
          if (lines.length > 1) words.push(word);
        }
        match = pattern.exec(value);
      }
      node = walker.nextNode();
    }
    return words;
  };
  const wordBreaks = [];
  document.querySelectorAll('button, .atlas-brand strong').forEach((el) => {
    if (el.closest('[hidden], .djs-container')) return;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const words = brokenWords(el);
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (words.length) wordBreaks.push({ name: label, words });
  });
  const presses = [];
  document.querySelectorAll('.rr-press').forEach((button) => {
    if (button.closest('[hidden]')) return;
    const face = button.querySelector(':scope > .rr-press-face');
    const shadow = button.querySelector(':scope > .rr-press-shadow');
    if (!face || !shadow) return;
    if (getComputedStyle(face).display === 'none' || getComputedStyle(shadow).display === 'none') return;
    const faceBox = face.getBoundingClientRect();
    const shadowBox = shadow.getBoundingClientRect();
    if (faceBox.width < 2 || shadowBox.width < 2) return;
    presses.push({
      name: (button.getAttribute('aria-label') || face.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
      face: { x: faceBox.x, y: faceBox.y, w: faceBox.width, h: faceBox.height },
      shadow: { x: shadowBox.x, y: shadowBox.y, w: shadowBox.width, h: shadowBox.height },
    });
  });
  return {
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth,
    nodes: nodes.filter((item) => item.kind === 'chrome'),
    labels,
    shapes,
    overflows,
    wordBreaks,
    presses,
  };
}

async function record(page, report, name) {
  await page.waitForTimeout(240);
  const row = await measure(page, name);
  report.push(row);
  console.log(`${row.name}: solapes ${row.overlaps}, etiquetas ${row.labelHits}, textos ${row.overflows}, partidas ${row.wordBreaks}, presión ${row.presses}, scroll ${row.scroll}`);
  for (const sample of row.sample) console.log(`  - ${sample.a || sample.name} | ${sample.b || ''} ${sample.area || sample.scrollWidth || ''}`);
  await shot(page, name.replaceAll(' ', '-'));
  return row;
}

async function setTheme(page, mode) {
  const light = await page.evaluate(() => document.body.classList.contains('atlas-theme-light'));
  if ((mode === 'light') === light) return;
  const settings = page.locator('[data-atlas-settings]');
  if (await settings.getAttribute('hidden') !== null) await page.locator('[data-action="toggle-settings"]').click();
  await page.locator('[data-action="toggle-theme"]').click();
  if (await page.locator('[data-atlas-settings]').isVisible()) await page.locator('[data-action="toggle-settings"]').click();
}

async function shot(page, name) {
  if (process.env.ATLAS_AUDIT_SHOTS === '0') return;
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function measure(page, name) {
  const raw = await page.evaluate(collectScript);
  const overlaps = findOverlaps(raw.nodes);
  const labelHits = findLabelHits(raw.labels, raw.shapes);
  const overflows = findOverflows(raw.overflows);
  const wordBreaks = findWordBreaks(raw.wordBreaks || []);
  const presses = findPressMisalignments(raw.presses || []);
  return {
    name,
    scroll: `${raw.scrollWidth}/${raw.clientWidth}`,
    scrollOk: raw.scrollWidth <= raw.clientWidth,
    overlaps: overlaps.length,
    labelHits: labelHits.length,
    overflows: overflows.length,
    wordBreaks: wordBreaks.length,
    presses: presses.length,
    sample: [
      ...overlaps.slice(0, 4),
      ...labelHits.slice(0, 3),
      ...overflows.slice(0, 3),
      ...wordBreaks.slice(0, 4).map((item) => ({ name: `partida ${item.name}: ${item.words.join(', ')}` })),
      ...presses.slice(0, 4).map((item) => ({ name: `presión ${item.name}` })),
    ],
  };
}

async function goMapa(page) {
  const tab = page.locator('.atlas-tabbar [data-atlas-section-target="mapa"]');
  if (await tab.isVisible()) {
    await tab.click();
    return;
  }
  await page.locator('[data-atlas-filter="Todo"]').click();
}

async function openProcesos(page) {
  const mobile = page.viewportSize().width < 760;
  const selector = mobile
    ? '.atlas-tabbar [data-atlas-section-target="procesos"]'
    : '.atlas-rail [data-atlas-section-target="procesos"]';
  await page.locator(selector).click();
  await page.waitForSelector('[data-process-id]', { state: 'attached', timeout: 20000 });
  const status = await page.locator('[data-atlas-bpmn-status]').innerText();
  if (!status.includes('Validación')) {
    await page.locator('[data-process-id]').first().click();
  }
  await page.waitForFunction(() => (document.querySelector('[data-atlas-bpmn-status]')?.textContent || '').includes('Validación'), null, { timeout: 20000 });
}

async function openProcess(page, id) {
  await page.locator(`[data-process-id="${id}"]`).evaluate((el) => el.click());
  await page.waitForFunction((processId) => {
    const pressed = document.querySelector(`[data-process-id="${processId}"]`)?.getAttribute('aria-pressed') === 'true';
    const status = document.querySelector('[data-atlas-bpmn-status]')?.textContent || '';
    return pressed && status.includes('Validación');
  }, id, { timeout: 15000 });
  await page.waitForTimeout(250);
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext();
await context.addInitScript(() => {
  try { localStorage.setItem('rr-atlas-tour-v1', '1'); } catch { /* el recorrido no entra en la medición */ }
});
await mkdir(OUT, { recursive: true });
const page = await context.newPage();
const report = [];

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.atlas-card');
  await setTheme(page, 'dark');
  const mobile = vp.width < 760;
  await record(page, report, `${vp.name} mapa`);

  if (mobile) {
    const tools = page.locator('[data-action="toggle-tools"]');
    if (await tools.isVisible()) {
      await tools.click();
      await page.waitForTimeout(150);
      await record(page, report, `${vp.name} acciones`);
    }
    const detail = page.locator('[data-action="toggle-detail"]');
    if (await detail.count()) {
      await detail.click();
      await page.evaluate(() => {
        document.querySelector('#atlas-app')?.classList.remove('is-tools-open');
        document.querySelector('[data-action="toggle-tools"]')?.setAttribute('aria-expanded', 'false');
      });
      await page.waitForTimeout(200);
      await record(page, report, `${vp.name} detalle`);
      const close = page.locator('[data-action="close-detail"]');
      if (await close.isVisible()) await close.click();
    }
    await page.locator('.atlas-tabbar [data-atlas-section-target="menu"]').click();
    await page.waitForTimeout(200);
    await record(page, report, `${vp.name} menu`);
    await page.keyboard.press('Escape');
  }

  await page.locator('[data-action="toggle-settings"]').click();
  await page.waitForTimeout(150);
  await record(page, report, `${vp.name} configuracion`);
  await page.locator('[data-action="toggle-settings"]').click();

  const search = page.locator('[data-atlas-search]');
  await search.fill('ejemplo');
  await page.waitForTimeout(200);
  await record(page, report, `${vp.name} busqueda`);
  await search.fill('');

  if (mobile) await page.locator('.atlas-tabbar [data-atlas-section-target="procesos"]').click();
  else await page.locator('.atlas-rail [data-atlas-section-target="procesos"]').click();
  await openProcesos(page);
  const back = page.locator('[data-action="bpmn-back"]');
  if (await back.isVisible()) await back.click();
  await record(page, report, `${vp.name} procesos-lista`);

  await openProcess(page, 'alianzas_como_nace_una_alianza');
  await record(page, report, `${vp.name} bpmn-alianzas`);

  await openProcess(page, 'gobierno_como_se_gobierna_la_documentacion');
  await record(page, report, `${vp.name} bpmn-grande`);

  const metaButton = page.locator('[data-action="bpmn-meta"]');
  if (mobile && await metaButton.count() && await metaButton.isVisible()) {
    await metaButton.click();
    await page.waitForTimeout(150);
  }
  await record(page, report, `${vp.name} validacion`);

  const backToList = page.locator('[data-action="bpmn-back"]');
  if (await backToList.isVisible()) await backToList.click();
  const create = page.locator('[data-action="new-process"]');
  if (await create.isVisible()) {
    await create.click();
    await page.waitForTimeout(150);
    await record(page, report, `${vp.name} nuevo-proceso`);
    await page.keyboard.press('Escape');
  }

  await setTheme(page, 'light');
  await goMapa(page);
  await page.waitForSelector('.atlas-card');
  await record(page, report, `${vp.name} tema-claro-mapa`);
  if (mobile) await page.locator('.atlas-tabbar [data-atlas-section-target="procesos"]').click();
  else await page.locator('.atlas-rail [data-atlas-section-target="procesos"]').click();
  await page.waitForSelector('[data-process-id]', { state: 'attached' });
  await openProcess(page, 'alianzas_como_nace_una_alianza');
  await record(page, report, `${vp.name} tema-claro-bpmn`);
}

const tourContext = await browser.newContext();
const tourPage = await tourContext.newPage();
for (const vp of VIEWPORTS.filter((item) => item.width < 760)) {
  await tourPage.setViewportSize({ width: vp.width, height: vp.height });
  await tourPage.goto(BASE, { waitUntil: 'networkidle' });
  await tourPage.evaluate(() => localStorage.removeItem('rr-atlas-tour-v1'));
  await tourPage.reload({ waitUntil: 'networkidle' });
  await tourPage.waitForSelector('.atlas-card');
  await tourPage.waitForSelector('[data-atlas-tour]:not([hidden])');
  await tourPage.waitForTimeout(240);
  await shot(tourPage, `${vp.name}-mapa-recorrido`);
  await tourPage.locator('[data-atlas-tour-skip]').click();
  await tourPage.waitForTimeout(200);
  await shot(tourPage, `${vp.name}-mapa-sin-recorrido`);
  await tourPage.locator('.atlas-tabbar [data-atlas-section-target="procesos"]').click();
  await tourPage.waitForSelector('[data-process-id]', { state: 'attached' });
  await tourPage.waitForTimeout(240);
  await shot(tourPage, `${vp.name}-procesos`);
}
await tourContext.close();

await context.close();
await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
let overlaps = 0;
let labels = 0;
let overflows = 0;
let wordBreaks = 0;
let presses = 0;
for (const row of report) {
  overlaps += row.overlaps;
  labels += row.labelHits;
  overflows += row.overflows;
  wordBreaks += row.wordBreaks;
  presses += row.presses;
  console.log(`${row.name}: solapes ${row.overlaps}, etiquetas ${row.labelHits}, textos ${row.overflows}, partidas ${row.wordBreaks}, presión ${row.presses}, scroll ${row.scroll}`);
  for (const sample of row.sample) console.log(`  - ${sample.a || sample.name} ${sample.b || ''} ${sample.area || sample.scrollWidth || ''}`);
}
console.log(`TOTAL solapes ${overlaps} etiquetas ${labels} textos ${overflows} partidas ${wordBreaks} presión ${presses}`);
if (wordBreaks || presses) process.exitCode = 1;
