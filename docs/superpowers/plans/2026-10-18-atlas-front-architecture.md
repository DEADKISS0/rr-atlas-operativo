# Atlas Front Architecture Plan

> Ejecucion autorizada por Direccion sobre `refactor/front-architecture`; no toca `main` ni produccion.

**Goal:** Separar Atlas en una arquitectura frontend mantenible antes de seguir agregando funcionalidades.

**Architecture:** `index.html` queda como shell semantico; `src/app` arranca la aplicacion; `src/core` contiene dominio, validacion y persistencia; `src/data` contiene el mapa base; `src/ui` contiene render, eventos, layout y minimapa; `src/styles` contiene tokens, layout y componentes. La UI no accede directamente a localStorage: usa el repositorio y el estado del dominio.

**Tech Stack:** JavaScript ES modules, HTML semantico, CSS modular, Node test runner, Vercel static preview.

## Reglas de estructura

- No seguir agregando logica a `index.html`.
- Ningun modulo de UI importa directamente `localStorage`.
- El dominio no conoce el DOM.
- Los datos base no se mezclan con los componentes.
- Cada accion de usuario pasa por una funcion de estado comprobable.
- Produccion queda fuera; solo Preview de la rama.

## Entregables

- Shell HTML accesible y sin logica de negocio.
- Mapa base extraido a `src/data/default-graph.mjs`.
- Estado y comandos en `src/app/atlas-store.mjs`.
- Render y eventos separados en `src/ui/atlas-view.mjs` y `src/ui/atlas-events.mjs`.
- Minimapa y navegacion contraible como UI reutilizable.
- CSS separado por tokens, layout y componentes.
- Pruebas de dominio sin navegador y verificacion visual real en Preview.
- Compatibilidad con exportacion/importacion y `rr-atlas-v3`.

## Fuera de esta refactorizacion

- OAuth de Drive.
- Supabase remoto.
- Login multiusuario.
- Colaboracion realtime.
- Nueva taxonomia de RR Aliados.
