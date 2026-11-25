# VIDABANDIDA Command Center

PWA personal para ejecutar **30 Days of Presence** (90 publicaciones en 30 días).
HTML, CSS y JS sin dependencias ni build.

## Estructura
- `js/plan.js`: el plan de 30 días, semanas, reglas, carpetas del Content Bank y métricas. **Para cambiar el contenido del plan, edita este archivo.**
- `js/store.js`: guardado en `localStorage` (clave `vbcc:data`), fechas, día actual y racha.
- `js/app.js`: vistas (Home, 30 días, Día, Bank, Métricas, Ajustes) y eventos.
- `css/app.css`: estilos.
- `sw.js`: uso sin conexión. **Sube `VERSION` cada vez que publiques cambios.**

## Probar en la Mac
```bash
python3 -m http.server 5178
```
Abre http://localhost:5178

## Publicar
Sube la carpeta a cualquier hosting estático con HTTPS (GitHub Pages, Netlify, Vercel).
En el iPhone: Safari → Compartir → **Añadir a pantalla de inicio**.

## Datos
El progreso vive solo en el teléfono. En Ajustes → **Exportar JSON** sacas un respaldo; con **Importar** lo restauras.
Actualizar la app no borra datos: el progreso se guarda por día y tarea (`"8:product"`), separado del texto del plan.
