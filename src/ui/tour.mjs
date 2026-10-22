/**
 * Recorrido opcional de primer uso.
 * Patrón interior.dev `wizard-steps` (components/interior/wizard-steps.tsx, commit 3148008):
 * un paso a la vez, se puede omitir, y reduced-motion no esconde el contenido.
 */

const KEY = 'rr-atlas-tour-v1';

const STEPS = [
  {
    tab: 'mapa',
    title: 'El mapa',
    copy: 'Toca un nodo para ver su ficha. Arrastra el fondo, pellizca o toca dos veces para acercar.',
  },
  {
    tab: 'procesos',
    title: 'Los procesos',
    copy: 'Aquí está cada flujo. Ábrelo y avanza con Anterior y Siguiente.',
  },
  {
    tab: 'buscar',
    title: 'La búsqueda',
    copy: 'Buscar filtra el mapa. El resultado queda en el centro de la pantalla.',
  },
];

export function bindTour({ app }) {
  const root = app.querySelector('[data-atlas-tour]');
  if (!root) return;
  const title = root.querySelector('[data-atlas-tour-title]');
  const copy = root.querySelector('[data-atlas-tour-copy]');
  const next = root.querySelector('[data-atlas-tour-next]');
  const skip = root.querySelector('[data-atlas-tour-skip]');
  let index = 0;

  const paint = () => {
    const step = STEPS[index];
    title.textContent = step.title;
    copy.textContent = step.copy;
    next.textContent = index === STEPS.length - 1 ? 'Listo' : 'Siguiente';
    app.querySelectorAll('.atlas-tabbar button').forEach((button) => {
      button.classList.toggle('is-tour-target', button.dataset.atlasSectionTarget === step.tab);
    });
  };

  const close = () => {
    root.hidden = true;
    app.querySelectorAll('.is-tour-target').forEach((button) => button.classList.remove('is-tour-target'));
    try { window.localStorage.setItem(KEY, '1'); } catch { /* el recorrido no bloquea el mapa */ }
  };

  skip.addEventListener('click', close);
  next.addEventListener('click', () => {
    if (index >= STEPS.length - 1) {
      close();
      return;
    }
    index += 1;
    paint();
  });

  let seen = '1';
  try { seen = window.localStorage.getItem(KEY) || ''; } catch { seen = '1'; }
  if (seen === '1') return;
  if (!window.matchMedia('(max-width: 760px)').matches) return;
  root.hidden = false;
  paint();
}
