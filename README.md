# Gruvboxitator

Convierte imagenes a la paleta **Gruvbox Material Dark Hard** directamente en tu navegador. Sin subir archivos, sin servidor, sin registro. Solo tu maquina y el pixel pipeline.

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![GitHub language count](https://img.shields.io/github/languages/count/NachoOsella/gruvboxitator-web)
![GitHub top language](https://img.shields.io/github/languages/top/NachoOsella/gruvboxitator-web)

---

## Caracteristicas

- **Procesamiento 100% local** - Los archivos nunca salen del navegador. Usa `OffscreenCanvas` e `ImageBitmap` para todo el pipeline.
- **Cuatro presets diferenciados** - Dark Hard, Carbon, Cinema y Soft, cada uno con un perfil de contraste, color, vinetas y grano distinto. Verificados empiricamente con diff de pixeles.
- **Comparacion antes/despues** - Control deslizante con soporte de teclado (flechas, Inicio, Fin) y arrastre por puntero. Funciona con `clip-path` y `role="slider"`.
- **Paleta visible** - Mosaico interactivo de los 14 tonos Gruvbox Material Dark Hard, con tooltips por nombre y hex.
- **Exportacion de paleta** - Opcion para descargar un PNG adicional con los 14 colores de la paleta.
- **Interfaz oscura bloqueada** - Disenada con shadcn/ui, Tailwind v4 y Geist. Sin cambios de tema. Sin scroll en pantallas de escritorio (probado en 1280, 1440 y 1536 de ancho).
- **Accesibilidad** - Estados de foco, `aria-label`, `role="slider"`, `reduced-motion` respetado.

## Stack

| Capa | Tecnologia |
|---|---|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| UI | shadcn/ui base-nova + Base UI |
| Estilos | Tailwind CSS v4 + tw-animate-css |
| Iconos | Phosphor Icons |
| Tipografia | Geist Variable (auto-hospedada via `@fontsource`) |
| Calidad | oxlint (linter) |

## Presets

| Preset | Contraste | Saturación | Viñeta | Grano | Descripción |
|---|---|---|---|---|---|
| **Dark Hard** | 1.18 | media (0.62) | media | medio | Equilibrado, profundo y nitido |
| **Carbon** | 1.14 | baja (0.14) | baja | bajo | Gris, sobrio y desaturado |
| **Cinema** | 1.32 | alta (0.86) | alta | alto | Contraste alto y viñeta dramatica |
| **Soft** | 1.04 | media-baja (0.40) | minima | minimo | Conserva la imagen original |

Cada preset fue ajustado y verificado para producir diferencias visibles entre si (diferencia media absoluta de pixeles > 6 en una imagen sintetica de prueba). Todos mantienen la misma paleta Gruvbox Material Dark Hard subyacente.

## Pipeline de imagen

El procesador (`gruvboxitator.ts`) aplica las siguientes transformaciones en orden, todo sobre `Uint8ClampedArray` sin depender de librerias externas:

1. **Contraste inicial** - realce lineal con el factor del preset.
2. **Nitidez** - mascara de desenfoque gaussiano (`unsharpMask`).
3. **Mapeo tonal** - rampa Gruvbox Material Dark Hard (`bg0` a `fg1`) con interpolacion cubica Hermite.
4. **Vineta** - atenuacion radial coseno desde el centro.
5. **Tonalizacion** - mezcla hacia el color de acento Gruvbox mas cercano en el circulo cromatico, controlada por `colorStrength`.
6. **Calidez** - mezcla hacia el amarillo Gruvbox para emular temperatura.
7. **Normalización de luminancia** - preserva rango tonal de la imagen original.
8. **Fondo negro** - los pixeles por debajo de la luminancia de `bg0` se fijan a `bg0`.
9. **Grano deterministico** - ruido pseudoaleatorio basado en un generador LCG con semilla fija.
10. **Contraste final y post-nitidez** - ajuste fino y mascara de desenfoque suave.
11. **Black floor** - clamp final al negro Gruvbox.

## Empezar

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en tu navegador. Arrastra una imagen y elige un preset.

## Comandos utiles

```bash
npm run dev       # Entorno de desarrollo con recarga en caliente
npm run build     # Compilacion TypeScript + bundling Vite
npm run lint      # Analisis estatico con oxlint
npm run preview   # Servir la compilacion de produccion localmente
```

## Arquitectura del codigo

```
src/
  App.tsx                     # Componente principal, layout, estado, interaccion
  index.css                   # Tema CSS (Gruvbox Material Dark Hard), utilidades
  main.tsx                    # Punto de entrada
  lib/
    gruvboxitator.ts           # Pipeline de imagen, presets, paleta, helper de exportacion
    utils.ts                   # cn() para merging de clases Tailwind
  components/
    ui/                        # Componentes shadcn/ui (Button, Card, Switch, Slider, etc.)
assets/                        # Imagenes estaticas
public/
  favicon.svg, icons.svg        # Iconos del sitio
```

## Notas de implementacion

- **`requestAnimationFrame`** se usa entre las fases del pipeline para no bloquear el hilo principal en imagenes grandes.
- **Grano deterministico** - el generador LCG usa una semilla fija (`0x67727576` = "gruv" en ASCII), por lo que dos ejecuciones con la misma imagen y preset producen exactamente el mismo ruido. Esto permite resultados reproducibles y evita el centelleo en la comparacion.
- **El handle de comparacion** usa `setPointerCapture` para arrastre fluido incluso fuera del elemento, y responde a las teclas `ArrowLeft`/`ArrowRight` (con `Shift` para saltos de 10) y `Home`/`End`.
- La paleta de 14 colores se renderiza como un mosaico `flex` en el panel de controles, con `title` para el nombre y el valor hex al pasar el raton.
- El overlay de grano tactil aplicado al fondo (`gruv-grain`) usa un SVG `feTurbulence` inline y esta limitado a un elemento fijo `pointer-events-none` para no afectar al rendimiento de scroll.

## Pre-Flight

Esta interfaz fue disenada siguiendo los criterios del skill [taste-skill](https://github.com/NachoOsella/taste-skill) (anti-slop frontend):
- Sin em-dashes, sin Inter como tipografia por defecto, sin purpura AI, sin tarjetas identicas en fila de 3.
- Sin etiquetas `uppercase tracking` como eyebrows.
- Sin scroll cues, sin decoracion de texto rotado, sin version labels, sin avatares o nombres genericos.
- Sin logos falsos ni capturas de pantalla falsas hechas con divs.
- Paleta unica (una sola familia de acentos, un solo sistema de esquinas), un solo tema (oscuro).
- Contraste WCAG AA verificado en botones y formularios.
- Un solo acento de color (verde Gruvbox) usado consistentemente en toda la pagina.

---

Hecho con cuidado, sin subir nada al servidor.
