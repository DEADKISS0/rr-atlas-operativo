# RR Atlas 4.0 Foundation Implementation Plan

> Ejecucion autorizada por Direccion sobre la rama `fix/document-link-persistence`; `main` y produccion quedan fuera.

**Goal:** Convertir el prototipo editable en una base segura y verificable para la plataforma Atlas, sin inventar la estructura definitiva de RR.

**Architecture:** Mantener la interfaz single-file desplegable en Vercel, extraer la validacion y persistencia a un modulo reutilizable, y dejar una frontera de datos preparada para una futura API/Supabase. Las migraciones se documentan, pero no se aplican a ningun proyecto remoto sin staging y credenciales aprobadas.

**Tech Stack:** HTML/CSS/JavaScript modular, Node test runner, PostgreSQL/Supabase como contrato futuro, GitHub + Vercel Preview.

**Spec:** `RR_Atlas_Registro_Decisiones_2026.docx` y `RR_Atlas_4_0_Brief_Tecnico_Equipo.docx` en `/home/deadkiss/Descargas/`.

## Global Constraints

- No cargar ahora la estructura definitiva de RR Aliados.
- No tocar `main` ni produccion durante esta entrega.
- No exponer documentos privados ni tokens de Drive.
- La persistencia local debe fallar de forma visible y conservar opcion de exportacion.
- Las referencias de Drive no prueban permisos de lectura.
- Toda integracion cloud debe validarse primero en staging.

## Entregables de esta fase

- Validacion comun de snapshots, nodos, edges y enlaces Drive.
- Persistencia local conectada al adaptador validado.
- Pruebas de datos y regresion de enlaces.
- CI minima para validar el HTML y los modulos.
- Contrato SQL generico para workspace, entidades, relaciones, vistas, documentos y auditoria; no aplicado remotamente.
- Verificacion real en navegador y Preview de Vercel.

## Fuera de esta fase por falta de entorno autorizado

- OAuth de Google Drive real.
- Auth/RLS/Reatime aplicados a un proyecto Supabase.
- Colaboracion multiusuario real.
- Migracion de datos empresariales y definicion de organigramas.
