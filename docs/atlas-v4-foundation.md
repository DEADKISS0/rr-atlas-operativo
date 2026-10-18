# Atlas 4.0: estado de la fundación

Fecha: 18 de octubre de 2026
Rama: `fix/document-link-persistence`

## Implementado

- El HTML usa un módulo de datos compartido en `src/core/atlas-state.mjs`.
- Los snapshots locales se validan antes de leerlos o escribirlos.
- Se rechazan nodos duplicados, conexiones huérfanas, auto-conexiones y enlaces Drive fuera de `drive.google.com` / `docs.google.com`.
- La escritura fallida conserva el estado en memoria y muestra una salida para exportar.
- La importación JSON usa el mismo validador que la persistencia.
- Se mantienen los enlaces de Drive como referencias; no se copian archivos ni se almacenan tokens.
- Se mantiene un historial local acotado con deshacer/rehacer y atajos Ctrl/Cmd+Z, Ctrl/Cmd+Y.
- La interfaz añade navegación contraíble, minimapa, selección desde minimapa y conexiones contextuales alrededor del nodo activo.
- Se agregaron pruebas unitarias y CI básica.
- Se agregó la migración SQL genérica para workspace, membresías, entidades, relaciones, vistas, documentos referenciados y auditoría.

## No aplicado todavía

- La migración SQL no se ha ejecutado en Supabase.
- No hay proyecto Supabase de staging vinculado a este repositorio.
- No hay OAuth real de Google Drive.
- No hay autenticación multiusuario ni colaboración en tiempo real.
- No se cargó estructura definitiva de RR Aliados.

## Regla de despliegue

La rama se verifica en Preview. `main` y `rr-atlas-operativo.vercel.app` no se modifican hasta completar pruebas de staging, permisos cruzados y aprobación de Dirección.
