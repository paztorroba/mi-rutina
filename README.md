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
├─ Imagenes/           Fotos de los ejercicios (44, una por ejercicio con imagen)
└─ apps-script.gs      Código para pegar en Google Apps Script
```

## Cómo abrirlo en VS Code

1. Abrí la carpeta del proyecto (Archivo → Abrir carpeta).
2. Instalá la extensión **Live Server**, clic derecho en `index.html` → *Open with Live Server*.
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

`icons/icon-source.png` es el original (1080×1080). De ahí salen los demás tamaños:

```
sips -Z 512 icons/icon-source.png --out icons/icon-512.png
sips -Z 192 icons/icon-source.png --out icons/icon-192.png
sips -Z 180 icons/icon-source.png --out icons/apple-touch-icon.png
sips -Z 32  icons/icon-source.png --out icons/favicon-32.png
```

Si cambiás el original, regenerá los cuatro y revisá que el dibujo quede dentro del
80% central: iOS y Android recortan los bordes al aplicar su máscara.


## Cosas que se pueden ajustar rápido

- Paso del botón + / − del peso: `WEIGHT_STEP` en `js/logic.js` (hoy 1 kg).
- Series y repeticiones de un ejercicio: `R` en `js/data.js`.
- Colores: `css/tokens.css`. Nada más tiene colores sueltos.
