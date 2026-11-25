# VIDABANDIDA Command Center

PWA personal para ejecutar **30 Days of Presence** (90 publicaciones en 30 días).
HTML, CSS y JS sin dependencias ni build.

## Estructura
- `plan.enc.json`: el plan de 30 días **cifrado** con tu contraseña (AES-GCM + PBKDF2). Sin la contraseña no se puede leer.
- `private/plan.json`: el plan sin cifrar. Vive solo en la Mac y nunca se sube (`.gitignore`).
- `js/lock.js` + `js/plan.js`: pantalla de contraseña y descifrado. El teléfono recuerda una clave derivada, nunca la contraseña.
- `js/store.js`: guardado en `localStorage` (clave `vbcc:data`), fechas, día actual y racha.
- `js/app.js`: vistas (Home, 30 días, Día, Bank, Métricas, Ajustes) y eventos.
- `css/app.css`: estilos.
- `sw.js`: uso sin conexión. **Sube `VERSION` cada vez que publiques cambios.**

## Cambiar el plan o la contraseña
Edita `private/plan.json` y corre:
```bash
node tools/encrypt-plan.mjs
```
Te pide la contraseña (puede ser la misma o una nueva); después publica `plan.enc.json`. Si cambias la contraseña, el iPhone la vuelve a pedir una vez.

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
