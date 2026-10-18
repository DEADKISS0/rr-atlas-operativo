# RR Atlas Operativo - Auditoria publica anonimizada

Fecha de referencia: 18 de octubre de 2026
Proyecto: rr-atlas-operativo
Estado: base local en reconstruccion

## Nota de seguridad

La auditoria integral contiene nombres, cifras y referencias documentales reales. La copia integra se conserva fuera del repositorio en el archivo entregado por Direccion y no se publica ni se versiona.

Este documento es la version publica anonimizada. No contiene prospectos, personas, cifras, correos, secretos ni identificadores de Drive.

## Hallazgos principales

- SEC-01: riesgo de datos sensibles en el cliente y en el historial del repositorio.
- SEC-02: las URLs importadas deben validarse contra una allowlist segura.
- SEC-03: faltan cabeceras de seguridad y una politica CSP consistente.
- BUG-01: el codigo desplegado y la fuente historica no estaban alineados.
- BUG-02: los filtros no reencuadraban el lienzo de forma consistente.
- BUG-03: el centrado y el zoom necesitaban una camara unica.
- DAT-04: existen nodos sin responsable.
- DAT-05: existen nodos aislados.
- OPS-04: la persistencia local no debe confundirse con persistencia multiusuario.
- ENG-02: faltaban estructura de workspace, CI, auditoria de dependencias y documentacion minima.

## Direccion tecnica

- El dominio se implementa en Rust.
- La UI objetivo usa Leptos y WASM.
- La API futura usa Axum.
- La persistencia futura usa PostgreSQL.
- Google SSO y Drive quedan fuera de la Fase 1.
- La colaboracion en tiempo real queda fuera de la Fase 1.
- El Atlas es una capa de gobierno y comprension, no un sistema transaccional.

## Fases

### Fase 0 - Contencion

Privacidad del repositorio, proteccion del despliegue, permisos documentales, respaldo y revision legal. Requiere acciones explicitas de Direccion.

### Fase 1 - Cimientos

Workspace Rust, modelo tipado, ResourceUrl, validacion, historial, importador JSON v1, fixtures anonimizados, CI, cargo deny, cargo audit y documentacion de producto y diseno.

### Fase 2 - Paridad

Camara, filtros, conexiones editables, minimapa, command palette, deshacer y rehacer, regiones, auto-layout, importacion y exportacion robusta y accesibilidad.

### Fases 3 a 5

Backend, autenticacion, Drive, persistencia compartida, colaboracion e integraciones, solo despues de aprobar el cierre de Fase 2.

## Criterio de privacidad

Los fixtures y datos de prueba deben usar entidades ficticias. Los datos reales se mantienen fuera del repositorio y fuera de los artefactos publicos.
