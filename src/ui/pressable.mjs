/**
 * Presión táctil con cara y sombra separadas.
 * Patrón interior.dev `usePressDepth` / `PressDepth`
 * (components/interior/press-depth.tsx, commit 3148008):
 * el hueco de la sombra está reservado, el texto no cambia el tamaño del control,
 * y pointercancel, blur y visibilitychange sueltan el gesto.
 * El teclado (Entrar y Espacio) es un camino completo, no un atajo visual.
 */

const SKIP = '.atlas-card, .atlas-backdrop, .atlas-minimap-node, .atlas-rail-toggle, .atlas-color-swatch, .atlas-sheet-handle, [data-press-skip]';

export function setPressLabel(button, text) {
  const face = button.querySelector(':scope > .rr-press-face');
  if (face) face.textContent = text;
  else button.textContent = text;
}

function release(button) {
  button.removeAttribute('data-pressed');
}

function bind(button) {
  if (button.dataset.pressReady || button.matches(SKIP)) return;
  if (button.closest('.djs-container, .bjs-powered-by')) return;
  button.dataset.pressReady = '1';
  button.classList.add('rr-press');
  const face = document.createElement('span');
  face.className = 'rr-press-face';
  while (button.firstChild) face.append(button.firstChild);
  const shadow = document.createElement('span');
  shadow.className = 'rr-press-shadow';
  shadow.setAttribute('aria-hidden', 'true');
  button.append(shadow, face);

  let pointer = null;
  const stop = () => {
    pointer = null;
    release(button);
  };
  const inside = (event) => {
    const rect = button.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  };
  button.addEventListener('pointerdown', (event) => {
    if (button.disabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointer = event.pointerId;
    button.setAttribute('data-pressed', '');
  });
  button.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    if (inside(event)) button.setAttribute('data-pressed', '');
    else release(button);
  });
  button.addEventListener('pointerup', (event) => {
    if (event.pointerId !== pointer) return;
    stop();
  });
  button.addEventListener('pointercancel', stop);
  button.addEventListener('blur', stop);
  button.addEventListener('keydown', (event) => {
    if (button.disabled || event.repeat) return;
    if (event.key === 'Enter' || event.key === ' ') button.setAttribute('data-pressed', '');
  });
  button.addEventListener('keyup', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') release(button);
  });
}

export function bindPressables(root) {
  root.querySelectorAll('button').forEach(bind);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.('button')) bind(node);
        node.querySelectorAll?.('button').forEach(bind);
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  const bail = () => root.querySelectorAll('button[data-pressed]').forEach(release);
  window.addEventListener('blur', bail);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) bail();
  });
  window.addEventListener('pointercancel', bail);
}
