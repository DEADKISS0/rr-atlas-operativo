# RR Atlas media and visual tools

## Objetivo
Agregar multimedia, formas, colores y una superficie visual inspirada en Interior sin romper la arquitectura vanilla existente ni tocar producción.

## Decisiones
- El estado sigue siendo independiente del DOM y la persistencia sigue pasando por `atlas-state` y `atlas-store`.
- Cada nodo tendrá `shape`, `color` y `media` como datos normalizados.
- Los enlaces remotos solo aceptan HTTPS y hosts de previsualización permitidos; el navegador decide si un formato puede incrustarse.
- La UI usará un visor modal accesible para imágenes, videos, audio, PDF y vistas previas de Drive; si el formato no puede incrustarse, mostrará una salida segura al enlace.
- Interior se adapta como lenguaje visual: materiales bezel/panel/well/cap, profundidad de presión, filtros compactos, modal, lightbox y carga progresiva. No se añade React ni se reemplaza el front existente.

## Entregables
- Modelo de datos compatible con exportaciones anteriores.
- Utilidades de normalización y clasificación de medios.
- Editor de color, forma y multimedia.
- Galería en tarjeta y visor modal.
- Figuras: rectángulo, redondeada, píldora, círculo, rombo, hexágono y nota.
- Pie de página con logo, versión, tema y `Developed by RR Aliados`.
- Pruebas de datos, seguridad de enlaces y montaje real en navegador.

## Fuera de alcance
- OAuth de Drive y lectura de archivos privados.
- Subida binaria a Drive.
- Edición colaborativa en tiempo real.
- Publicación en producción.
