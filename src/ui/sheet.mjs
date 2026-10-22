/**
 * Hoja inferior del detalle.
 * Patrón interior.dev `useDrawer` (components/interior/drawer.tsx, commit 3148008):
 * el arrastre se cancela en pointercancel, blur y visibilitychange;
 * pasar ~38% de la altura o una velocidad clara cierra;
 * reduced-motion conserva abierto/cerrado sin deslizamiento.
 */

export function bindBottomSheet(panel, { app, onClose }) {
  const narrow = () => window.matchMedia('(max-width: 760px)').matches;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pointer = null;
  let startY = 0;
  let lastY = 0;
  let lastT = 0;
  let dy = 0;

  const reset = () => {
    pointer = null;
    dy = 0;
    panel.style.transform = '';
    panel.classList.remove('is-dragging');
  };

  const close = () => {
    reset();
    onClose();
  };

  const reveal = () => {
    if (app.classList.contains('is-detail-open')) panel.classList.add('is-shown');
  };
  panel.addEventListener('animationend', reveal);
  const marker = document.createComment('atlas-sheet-origin');
  const park = () => {
    const open = narrow() && app.classList.contains('is-detail-open');
    if (open) {
      if (!marker.parentNode) panel.parentNode.insertBefore(marker, panel);
      if (panel.parentElement !== app) app.append(panel);
      return;
    }
    if (marker.parentNode) marker.parentNode.insertBefore(panel, marker);
    panel.classList.remove('is-shown');
  };
  const watch = new MutationObserver(park);
  watch.observe(app, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', park);

  panel.addEventListener('pointerdown', (event) => {
    if (!narrow() || !app.classList.contains('is-detail-open')) return;
    if (!event.target.closest('.atlas-sheet-handle')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointer = event.pointerId;
    startY = lastY = event.clientY;
    lastT = performance.now();
    dy = 0;
    panel.classList.add('is-dragging');
    panel.setPointerCapture?.(event.pointerId);
  });

  panel.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    lastY = event.clientY;
    lastT = performance.now();
    dy = Math.max(0, event.clientY - startY);
    if (!reduced()) panel.style.transform = `translateY(${dy}px)`;
  });

  const finish = (event) => {
    if (event.pointerId !== pointer) return;
    const dt = Math.max(1, performance.now() - lastT);
    const velocity = (event.clientY - lastY) / dt;
    const height = panel.getBoundingClientRect().height || 1;
    if (dy > height * 0.38 || velocity > 0.65) close();
    else reset();
  };

  panel.addEventListener('pointerup', finish);
  panel.addEventListener('pointercancel', (event) => {
    if (event.pointerId !== pointer) return;
    reset();
  });
  window.addEventListener('blur', () => {
    if (pointer !== null) reset();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && pointer !== null) reset();
  });
}
