Crítica degradada: la evaluación B (`impeccable detect`) se ejecutó en el mismo agente que redactó este documento, no en un subagente separado. Las puntuaciones heurísticas son las de la evaluación A, tomadas antes del rediseño.

Questions skipped: no structured question tool; the brief already specified Operate and the change list.

# Auditoría UX, ronda 3

Modo Impeccable: Operate. El repositorio no tiene `PRODUCT.md` ni `DESIGN.md`. La autoridad visual es el sistema ya publicado y el Brand Kit RR (fucsia `#be076d`, mostaza `#ded116`, orquídea `#973d8f`, blanco `#fffff3`, negro `#070001`). No se reescribió la marca.

La medición usa el mapa de ejemplo del repositorio. No hay datos de clientes, personas ni cifras de negocio.

## Puntuación heurística (antes del rediseño)

Escala 0–4. Total **21/40**. El celular se sentía como el escritorio encogido: la cabecera medía 180 px (cerca de un cuarto de 844 px) y el lienzo empezaba tarde.

| Heurística | Nota | Lectura |
| --- | --- | --- |
| Visibilidad del estado | 2 | El estado existía, pero no decía dónde estabas ni confirmaba el gesto |
| Correspondencia con el mundo | 2 | Textos de sistema mezclados con el mapa |
| Control y libertad | 3 | Había deshacer del mapa; borrar no ofrecía deshacer en el aviso |
| Consistencia | 2 | Controles de mapa y de diagrama no se comportaban igual |
| Prevención de errores | 3 | Restaurar y borrar piden confirmación |
| Reconocer antes que recordar | 2 | La ficha no se abría al tocar la tarjeta |
| Flexibilidad | 2 | Poco atajo táctil; el teclado no era un camino completo en todos los controles |
| Estética y minimalismo | 1 | Buscador y Configuración comían el lienzo |
| Recuperación | 2 | El aviso de borrado no traía deshacer |
| Ayuda | 2 | No había recorrido de primer uso |

Contraste que se mantiene: mostaza sobre negro y blanco sobre fucsia superan AA en los pares medidos antes (13.1 y 6.1).

## Ritmo y márgenes (layout)

Antes, en 390 px, la cabecera ocupaba 180 px y el mapa empezaba alrededor de y = 241. Después, la cabecera es una fila de 66 px: marca, buscador y engranaje. El cuerpo en móvil es 16 px. La escala de espacio sigue los tokens de 4 y 8 px. Los controles visibles miden al menos 44 px en mapa y en el visor de procesos.

El escritorio de 1440 px conserva el riel y la ficha lateral. La hoja inferior solo existe por debajo de 761 px.

## Inventario de controles

Probado en Chrome a 390×844 con `scripts/audit-interaction.mjs` (51 comprobaciones, 0 errores de página). El tamaño táctil de los controles visibles es ≥ 44 px. Estados: hover de color, presión con cara y sombra (interior.dev `usePressDepth`), foco visible, deshabilitado por opacidad y carga del diagrama en el estado del visor. Veredicto: funciona si el gesto produce el efecto de la tabla.

### Mapa

| Control | Qué hace | Veredicto |
| --- | --- | --- |
| Buscar nodos | Filtra tarjetas. Vacío: «Ningún nodo coincide con la búsqueda.» | Funciona (55 → 0) |
| Configuración | Abre y cierra el panel | Funciona |
| Alejar / Acercar | Cambia el zoom. Enter también acerca | Funciona |
| Reencuadrar | Centra el nodo elegido | Funciona |
| Volver al nodo | Centra la selección y avisa | Funciona |
| Acciones | Abre y cierra la hoja de herramientas | Funciona |
| Tarjeta | Abre la ficha. Arrastrar mueve el nodo | Funciona |
| Fondo | Arrastre con inercia, pellizco y doble toque para acercar | Doble toque funciona |
| Asa de la ficha | Arrastrar hacia abajo cierra | Funciona |
| Cerrar ficha / Escape | Cierran la ficha | Funciona |

### Acciones del mapa

| Control | Qué hace | Veredicto |
| --- | --- | --- |
| Nuevo nodo | Agrega una tarjeta | Funciona (55 → 56) |
| Deshacer / Rehacer | Revierte y repite | Funciona |
| Dibujar y las seis figuras | Prepara el lienzo y crea la figura al tocar | Funciona |
| Conectar | Pide un segundo nodo | Funciona |
| Detalle | Abre o cierra la ficha | Funciona |
| Ir a un proceso | Centra el primer proceso | Funciona |

### Ficha

| Control | Qué hace | Veredicto |
| --- | --- | --- |
| Aplicar cambios | Guarda título, tipo, texto, figura y color | Funciona, con aviso |
| Descartar cambios | Quita la vista previa | Funciona |
| Eliminar | Pide confirmación, borra y ofrece Deshacer | Funciona |
| Muestras de color | Marcan la vista previa | Funciona |
| Agregar foto, video o archivo | Abre el diálogo | Funciona |
| Sugerencia de enlace | Rellena el formulario | Funciona |
| Cancelar / Montar recurso | Cierra o adjunta | Cancelar funciona |
| Cerrar visor | Cierra el diálogo del recurso | Funciona |

### Menú, configuración, tema

| Control | Qué hace | Veredicto |
| --- | --- | --- |
| Menú | Abre el explorador. Escape lo cierra | Funciona |
| Filtros del riel | Dejan solo un tipo y Toda la empresa restaura | Funciona (55 → 2 → 55) |
| Exportar mapa | Descarga JSON | Funciona |
| Importar mapa | Abre el selector de archivo | Funciona |
| Restaurar base | Pide confirmación. Cancelar no borra | Funciona |
| Cambiar tema | Alterna claro y oscuro | Funciona |
| Minimapa | Oculta y muestra, con aviso | Funciona |
| Conexiones | Oculta y muestra, con aviso | Funciona |

### Procesos BPMN

| Control | Qué hace | Veredicto |
| --- | --- | --- |
| Pestaña Procesos | En el celular abre la lista, no el primer diagrama | Funciona (16 procesos) |
| Buscar proceso | Vacía la lista si no hay coincidencia | Funciona |
| Tarjeta de proceso | Abre el visor en el paso 1 | Funciona |
| Anterior / Siguiente | Cambian el paso. El rótulo es «N de M» | Funciona (1 de 10 → 2 de 10 y de vuelta) |
| Reencuadrar diagrama | Reencuadra sin perder el paso | Funciona |
| Validación | Abre la hoja de dueño, KPI y avisos | Funciona |
| Más | Muestra recorrer, zoom y exportar | Funciona |
| Recorrer / Detener | Avanza solo y se puede parar | Funciona |
| Alejar / Acercar diagrama | Cambia el encuadre | Funciona |
| Editar copia / Ver | Copia la semilla y vuelve al visor | Funciona |
| Exportar .bpmn, SVG, PNG | Descargan el archivo | Funciona |
| Lista | Vuelve al índice y detiene el recorrido | Funciona |
| Nuevo proceso / Crear | Abre el diálogo y el editor | Funciona |
| Importar .bpmn | Abre el selector | Funciona |
| Cancelar del diálogo | Cierra sin crear | Funciona |

### Recorrido y movimiento reducido

| Control | Qué hace | Veredicto |
| --- | --- | --- |
| Siguiente del recorrido | Pasa de «El mapa» a «Los procesos» | Funciona |
| Omitir | Cierra y no vuelve a salir en ese navegador | Funciona |
| Ficha con `prefers-reduced-motion` | Se abre igual, sin animación | Funciona |

La barra inferior (Mapa, Procesos, Buscar, Menú) cambia de sección con una entrada de 200 ms. Buscar enfoca el campo. En escritorio el recorrido no se muestra.

## Interacción

| Batería | Antes | Después |
| --- | --- | --- |
| 20 comprobaciones de la ronda (cabecera, ficha, zoom, procesos, tema, scroll, 44 px) | 14/20 | 20/20 |
| Inventario ampliado, mismas 20 más el resto de controles | — | 51/51 |
| Errores de página | 2 (`setPointerCapture`) | 0 |

Lo que fallaba al empezar: la cabecera medía 180 px, tocar una tarjeta no abría la ficha, el botón de cerrar no estaba, la pestaña Procesos no dejaba la lista a la vista en el celular y el mapa lanzaba `InvalidStateError` al capturar el puntero.

## Detector de solapes

`npm run audit:visual` en 360×800, 390×844, 430×932 y 1440×900. Cada celda es solapes / textos desbordados. Choques de etiqueta BPMN: 0.

La ronda 2 cerró en 0/0/0. Esta ronda vuelve a cerrar en **0 solapes, 0 etiquetas, 0 textos**, sin scroll horizontal. Una pasada intermedia marcó 3 solapes en el mapa de tema claro móvil: eran el estado y la barra inferior a media animación de entrada (200 ms). Medido en reposo, quedan en 0.

## Patrones traducidos

Sin React. Cada componente cita el patrón de interior.dev (commit `3148008`):

- `src/ui/pressable.mjs`: `usePressDepth`. Cara y sombra separadas, el texto no cambia el tamaño, el gesto se suelta en `pointercancel`, desenfoque y `visibilitychange`, y Enter/Espacio es un camino completo.
- `src/ui/sheet.mjs`: `useDrawer`. Cierra al pasar ~38 % de la altura o con velocidad clara. Se cancela en `pointercancel`, desenfoque y cambio de visibilidad.
- `src/ui/tour.mjs`: `wizard-steps`. Un paso, se puede omitir, y reduced-motion no esconde el contenido.

La curva es `cubic-bezier(.2, .9, .2, 1)` a 200 ms, dentro de 150–300 ms. `prefers-reduced-motion` apaga el desplazamiento y conserva el estado abierto o cerrado.
