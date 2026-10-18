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

  const initialCollapsed = window.matchMedia?.('(max-width: 720px)').matches ?? false;
  setCollapsed(initialCollapsed);
  const mediaQuery = window.matchMedia?.('(max-width: 720px)');
  mediaQuery?.addEventListener?.('change', (event) => setCollapsed(event.matches));

  return Object.freeze({
    collapse: setCollapsed,
  });
}
