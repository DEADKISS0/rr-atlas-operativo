const STYLE_ID = 'atlas-shell-enhancements';

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #atlas-rail-toggle { margin-right: 2px; padding-inline: 10px; }
    #app .body.atlas-rail-collapsed { grid-template-columns: 0 minmax(0, 1fr) 340px; }
    #app .body.atlas-rail-collapsed .rail { width: 0; padding-inline: 0; overflow: hidden; border-right: 0; }
    .atlas-minimap { position: absolute; right: 16px; bottom: 16px; width: 190px; height: 126px; z-index: 3; padding: 8px; background: #150612e8; border: 1px solid #973d8f; border-radius: 3px; box-shadow: 6px 6px 0 #070001; }
    .atlas-minimap-title { display: flex; justify-content: space-between; color: #ded116; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
    .atlas-minimap-canvas { position: relative; height: 94px; overflow: hidden; background: #0e030b; border: 1px solid #41102c; }
    .atlas-minimap-node { position: absolute; width: 7px; height: 7px; padding: 0; border: 0; border-radius: 1px; background: #be076d; transform: translate(-50%, -50%); }
    .atlas-minimap-node.active { background: #ded116; box-shadow: 0 0 0 2px #ded11655; }
    @media (max-width: 900px) {
      #app .body.atlas-rail-collapsed { grid-template-columns: 0 minmax(0, 1fr) 260px; }
      .atlas-minimap { right: 8px; bottom: 8px; transform: scale(.85); transform-origin: bottom right; }
    }
  `;
  document.head.appendChild(style);
}

function initAtlasShell() {
  if (document.getElementById('atlas-rail-toggle')) return;
  installStyles();
  const top = document.querySelector('.top');
  const body = document.querySelector('.body');
  const rail = document.querySelector('.rail');
  const work = document.querySelector('.work');
  const cards = document.querySelector('#cards');
  if (!top || !body || !rail || !work || !cards) return;

  const toggle = document.createElement('button');
  toggle.id = 'atlas-rail-toggle';
  toggle.type = 'button';
  toggle.textContent = '☰';
  toggle.title = 'Contraer navegación';
  toggle.setAttribute('aria-label', 'Contraer navegación');
  toggle.setAttribute('aria-pressed', 'false');
  toggle.addEventListener('click', () => {
    const collapsed = body.classList.toggle('atlas-rail-collapsed');
    toggle.setAttribute('aria-pressed', String(collapsed));
    toggle.title = collapsed ? 'Mostrar navegación' : 'Contraer navegación';
    toggle.setAttribute('aria-label', collapsed ? 'Mostrar navegación' : 'Contraer navegación');
  });
  top.insertBefore(toggle, top.firstChild);

  const minimap = document.createElement('aside');
  minimap.className = 'atlas-minimap';
  minimap.setAttribute('aria-label', 'Minimapa del Atlas');
  const title = document.createElement('div');
  title.className = 'atlas-minimap-title';
  const titleLabel = document.createElement('span');
  titleLabel.textContent = 'Minimapa';
  const count = document.createElement('span');
  count.id = 'atlas-minimap-count';
  title.append(titleLabel, count);
  const canvas = document.createElement('div');
  canvas.className = 'atlas-minimap-canvas';
  canvas.id = 'atlas-minimap-canvas';
  minimap.append(title, canvas);
  work.appendChild(minimap);

  const sync = () => {
    canvas.replaceChildren();
    const items = [...cards.querySelectorAll('.card')];
    count.textContent = String(items.length);
    const activeId = cards.querySelector('.card.active')?.dataset.id;
    for (const card of items) {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `atlas-minimap-node${card.dataset.id === activeId ? ' active' : ''}`;
      node.title = card.querySelector('h3')?.textContent || card.dataset.id;
      node.setAttribute('aria-label', `Seleccionar ${node.title}`);
      const x = Number.parseFloat(card.style.left) || 0;
      const y = Number.parseFloat(card.style.top) || 0;
      node.style.left = `${Math.min(98, Math.max(2, (x / 4200) * 100))}%`;
      node.style.top = `${Math.min(98, Math.max(2, (y / 3200) * 100))}%`;
      node.addEventListener('click', () => {
        card.click();
        sync();
      });
      canvas.appendChild(node);
    }
  };

  new MutationObserver(sync).observe(cards, { childList: true });
  sync();
}

export { initAtlasShell };
