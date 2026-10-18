# RR Atlas Rust Foundation Implementation Plan

> Fase 1 autorizada para cambios locales. No hacer commit, push ni tocar main sin aprobación explícita.

**Goal:** Construir los cimientos 100 % Rust del Atlas: workspace, dominio tipado, seguridad de recursos, validación de integridad, historial, importador v1, fixtures anonimizados, CI y documentación de producto/diseño.

**Architecture:** `atlas-core` será puro y no conocerá DOM, red ni base de datos. `atlas-proto` separará el modelo de transporte y versiones de esquema. `atlas-ui` y `atlas-web` serán la frontera Leptos/WASM; `atlas-api`, `atlas-drive` y `atlas-sync` quedarán como límites compilables sin activar backend, auth ni integraciones antes de aprobar Fase 2. `xtask` concentrará tareas verificables.

**Tech Stack:** Rust estable 1.99.1; Leptos estable verificado en docs.rs 0.8.22; Serde 1.0.229; serde_json 1.0.154; URL 2.5.8; thiserror 2.0.21; UUID 1.28.0; time 0.3.55; petgraph 0.8.3; proptest 1.12.0; tracing 0.1.44; tracing-subscriber 0.3.23. Axum/SQLx quedan verificados pero sin runtime activo en esta fase.

**Spec:** `docs/AUDITORIA_RR_ATLAS.md`

## Global Constraints

- Todo el código nuevo de aplicación será Rust; el pegamento WASM lo generará la toolchain.
- No se hace push a `main`.
- No se hace commit en esta fase sin aprobación.
- No se copian datos reales, secretos, nombres de personas, cifras ni IDs de Drive a fixtures.
- El Atlas distingue borrador, por validar, validado y obsoleto.
- No se activa backend, autenticación, PostgreSQL, Drive ni colaboración antes del cierre aprobado de Fase 2.
- Ningún `unwrap()` o `expect()` en rutas que procesen entrada de usuario.
- Presupuesto inicial propuesto para WASM: menos de 700 KB comprimido; se medirá después de tener UI compilable.

## Review Focus

- JSON v1 con campos opcionales, forma legacy `data/lines` y esquema desconocido: importar o rechazar con informe explícito.
- URLs maliciosas, credenciales embebidas, puertos y hosts parecidos: rechazar en deserialización.
- IDs repetidos, aristas colgantes, autoaristas y ciclos: producir incidencias deterministas.
- Datos sin responsable y nodos aislados: emitir DAT-04 y DAT-05 usando solo fixture anonimizado.
- Fechas, estados y tipos desconocidos: no convertir silenciosamente en verdad validada.

## Fases ejecutadas en este turno

- [ ] Workspace y crates Rust.
- [ ] Modelo tipado y validación en `atlas-core`.
- [ ] `ResourceUrl` y recursos seguros.
- [ ] Historial por comandos.
- [ ] Importador JSON v1 y reporte DAT-04/DAT-05.
- [ ] Propiedades con `proptest`.
- [ ] `PRODUCT.md`, `DESIGN.md`, `xtask` y CI base.
- [ ] fmt, clippy, tests, deny, audit y build local.

## Puerta de salida

Fase 1 solo queda cerrada si todas las verificaciones pasan y se entrega un resumen por hallazgo. Después se detiene el trabajo hasta aprobación de Dirección para Fase 2.
