export function bindAtlasNavigation({ app, search, processView }) {
  const backdrop = app.querySelector('[data-atlas-backdrop]');
  const menuButtons = [...app.querySelectorAll('[data-atlas-section-target="menu"]')];

  const closeMenu = () => {
    app.classList.remove('is-menu-open');
    backdrop.hidden = true;
    menuButtons.forEach((button) => button.setAttribute('aria-expanded', 'false'));
  };

  const openMenu = () => {
    app.classList.add('is-menu-open');
    backdrop.hidden = false;
    menuButtons.forEach((button) => button.setAttribute('aria-expanded', 'true'));
  };

  const setSection = (section) => {
    app.dataset.atlasSection = section;
    const processes = app.querySelector('[data-atlas-process]');
    processes.hidden = section !== 'procesos';
    app.querySelectorAll('[data-atlas-section-target]').forEach((button) => {
      if (button.dataset.atlasSectionTarget === 'menu' || button.dataset.atlasSectionTarget === 'buscar') return;
      button.setAttribute('aria-pressed', String(button.dataset.atlasSectionTarget === section));
    });
    closeMenu();
    if (section === 'procesos') processView.activate();
  };

  app.querySelectorAll('[data-atlas-section-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.atlasSectionTarget;
      if (target === 'menu') {
        if (app.classList.contains('is-menu-open')) closeMenu();
        else openMenu();
        return;
      }
      if (target === 'buscar') {
        setSection('mapa');
        search.focus();
        return;
      }
      setSection(target);
    });
  });

  app.querySelectorAll('[data-atlas-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      setSection('mapa');
    });
  });

  backdrop.addEventListener('click', closeMenu);
  app.querySelector('[data-action="close-detail"]')?.addEventListener('click', () => {
    app.classList.remove('is-detail-open');
  });
  app.querySelector('[data-action="toggle-detail"]')?.addEventListener('click', () => {
    app.classList.toggle('is-detail-open');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      app.classList.remove('is-detail-open');
    }
  });

  setSection('mapa');
  return { setSection, closeMenu };
}
