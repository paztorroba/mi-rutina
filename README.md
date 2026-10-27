# Dale Paz

App de rutinas del gym (rediseño). HTML + CSS + JS puros, sin build ni dependencias.

## Estructura

```
dale-paz/
├─ index.html          Estructura: contenedores de pantallas, navegación y sprite de íconos
├─ css/
│  ├─ tokens.css       Color, tipografía, radios y espaciado (claro y oscuro). Acá se cambia el look
│  └─ app.css          Estilos de componentes (solo usan variables de tokens.css)
├─ js/
│  ├─ data.js          Plan (R), etiquetas, imágenes y textos de fases. Acá se cambian ejercicios
│  ├─ storage.js       Guardado: localStorage + Google Sheets (verificado, gana lo más nuevo)
│  ├─ logic.js         Series, orden, historial, ciclo y cronómetros (no toca el DOM)
│  ├─ views.js         Arma el HTML de Rutina, Progreso, Historial y Ciclo
│  ├─ sheets.js        Modales: fase, primer ingreso, agregar ejercicio, técnica
│  └─ main.js          Eventos, arrastrar para reordenar, aviso de guardado e inicio
├─ icons/              Favicon (emoji 💪 sobre fondo oscuro) y generar-iconos.html
├─ Imagenes/           ← copiá acá tu carpeta de imágenes (no está incluida)
└─ apps-script.gs      Código para pegar en Google Apps Script
```

## Cómo abrirlo en VS Code

1. Abrí la carpeta `dale-paz` (Archivo → Abrir carpeta).
2. Copiá tu carpeta `Imagenes/` adentro, al lado de `index.html`.
3. Instalá la extensión **Live Server**, clic derecho en `index.html` → *Open with Live Server*.
   (También funciona abriendo `index.html` directo en el navegador.)

## Google Sheets (para que el progreso se guarde bien)

1. En tu proyecto de Apps Script, reemplazá el código por el de `apps-script.gs`.
2. **Implementar → Administrar implementaciones → editar (lápiz) → Versión: Nueva versión → Implementar.**
   Así la URL no cambia. Acceso: "Cualquier persona". Ejecutar como: "Yo".
3. Si la URL cambia, pegala en `SHEETS_URL` (arriba de `js/storage.js`).

El aviso "✓ Guardado" aparece solo cuando la subida se verificó leyendo de vuelta.
Si no hay conexión, el cambio queda en el teléfono y se sube solo cuando vuelva.

## Tema claro / oscuro

Por defecto sigue el modo del teléfono. Cada pantalla tiene un botón arriba a la derecha para cambiarlo; la elección queda guardada.
Para volver al modo automático: `localStorage.removeItem('gym_theme')` en la consola del navegador.

## Favicon

`icons/favicon.svg` usa el emoji 💪 como texto, así que cada dispositivo lo dibuja con su propio diseño (en iPhone/Mac, el de Apple).
Los PNG (`favicon-32.png`, `apple-touch-icon.png`) son el respaldo para Safari y la pantalla de inicio del iPhone.
Los que vienen incluidos se dibujaron con el emoji de Google; para tener el de Apple, abrí `icons/generar-iconos.html` en tu iPhone o Mac,
tocá "Descargar íconos" y guardá los dos archivos en `icons/` reemplazando los actuales.

## Cosas que se pueden ajustar rápido

- Paso del botón + / − del peso: `WEIGHT_STEP` en `js/logic.js` (hoy 1 kg).
- Series y repeticiones de un ejercicio: `R` en `js/data.js`.
- Colores: `css/tokens.css`. Nada más tiene colores sueltos.
