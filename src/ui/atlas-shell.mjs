export function createAtlasShell({ root }) {
  const layout = root.querySelector('[data-atlas-layout]');
  const toggle = root.querySelector('[data-action="toggle-rail"]');
  if (!layout || !toggle) return { collapse: () => {} };

  const setCollapsed = (collapsed) => {
    layout.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-pressed', String(collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Mostrar navegación' : 'Contraer navegación');
    toggle.title = collapsed ? 'Mostrar navegación' : 'Contraer navegación';
  };

  toggle.addEventListener('click', () => {
    setCollapsed(!layout.classList.contains('is-collapsed'));
  });

  setCollapsed(false);
  const desktopQuery = window.matchMedia?.('(min-width: 761px)');
  desktopQuery?.addEventListener?.('change', (event) => {
    if (!event.matches) setCollapsed(false);
  });

  return Object.freeze({
    collapse: setCollapsed,
  });
}
