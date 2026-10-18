# RR Atlas · Diseño

## Identidad B.U.C.M. 2026

| Token | Valor | Uso |
|---|---|---|
| `rr-ink` | `#070001` | Fondo base oscuro |
| `rr-paper` | `#fffff3` | Texto principal |
| `rr-fuchsia` | `#be076d` | Acción, selección y foco de marca |
| `rr-mustard` | `#ded116` | Acción primaria y validación |
| `rr-orchid` | `#973d8f` | Borde, divisor y región |

## Dirección visual

- Estética editorial y brutalista.
- Radios de 2–3 px en controles estructurales.
- Sombras duras desplazadas para acciones primarias.
- Tipografía mínima de 12 px.
- El tipo de nodo se comunica con color, ícono y forma; nunca solo con color.
- Tema oscuro y claro con contraste WCAG 2.2 AA.
- Movimiento corto y desactivable con `prefers-reduced-motion`.

## Primitivas Rust previstas

- Modal.
- Popover.
- Dropdown.
- Command Palette.
- Filter Grid.
- Tree View.
- Accordion.
- Collapsible Banner.
- Live Activity.
- Loading Button.
- Press Depth.

Las primitivas se implementarán en `atlas-ui` sin instalar componentes React.
