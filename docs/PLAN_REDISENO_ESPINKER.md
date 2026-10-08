# Plan de mejora UX/UI — Espinker

> Estado: **plan, sin implementar.** Fecha: 2026-10-08.
> Alcance: pantalla de acceso (`/ingresar`), pantalla principal con cámara (`/`, panel personal) y
> lo que ambas comparten (tema, paleta, nombre, avisos). El panel de oficina se toca solo donde
> comparte componentes con el panel personal.

---

## 0. Pedido del usuario (resumen)

1. Cambiar el nombre visible **Habitusitos → Espinker** en toda la interfaz.
2. **Modo claro y modo oscuro** bien resueltos en todas las pantallas, incluido el acceso.
3. **Login con fondo:** formulario en el **45 % derecho** y, en el **55 % izquierdo**, un fondo
   **animado de forma continua e interactivo con el mouse**.
4. **Paleta nueva, más intuitiva**, en el acceso y en la pantalla principal.
5. **Cámara al centro**, como protagonista: más grande y con bordes redondeados.
6. **Reorganizar la información que rodea la cámara** y llevar los controles a sitios fáciles de
   alcanzar con el mouse.
7. **Quitar los avisos de DEMOSTRACIÓN**: esto es un prototipo funcional.

---

## 1. Conflictos con reglas vigentes (hay que resolverlos antes de tocar código)

Tres pedidos contradicen reglas escritas en `CLAUDE.md` y `docs/SISTEMA_DISENO.md`. No se pueden
implementar en silencio: hay que **cambiar la regla de forma explícita**, con fecha y motivo.

| Pedido | Regla que choca | Propuesta |
|---|---|---|
| Quitar avisos de DEMOSTRACIÓN | `CLAUDE.md` §5 y §10: "El aviso de demostración no se cierra ni se atenúa" / "Quitar el aviso de demostración de ninguna pantalla" | Retirar el **aviso global**, pero mantener el **principio de honestidad**: si algo concreto es simulado (la vista sin cámara, por ejemplo), se marca **en ese lugar**, no con un banner en toda la app. Ver §6 |
| Fondo animado continuo en el login | `CLAUDE.md` §6 y `SISTEMA_DISENO.md` §5: "Cero animación decorativa" | Excepción **acotada a la pantalla de acceso**: ahí nadie está midiendo su postura y el movimiento no compite con información de estado. Dentro de la app la regla sigue igual. Con `prefers-reduced-motion` el fondo queda quieto |
| Paleta nueva | `SISTEMA_DISENO.md` §2 justifica el teal actual | Se reescribe la §2 con la paleta nueva y su verificación de contraste AA |

Además, `CLAUDE.md` §6 exige **presentar referencias visuales** cuando una decisión de diseño tiene
varias opciones viables. La paleta y el tipo de fondo animado lo son. Por eso existe la **Fase 0**.

---

## 2. Diagnóstico del estado actual

Leído del código, no de memoria.

### Pantalla de acceso — `app/src/funcionalidades/autenticacion/pantalla.tsx`
- Columna única de `max-w-sm` centrada sobre fondo liso: mucho vacío en pantallas anchas.
- Dos niveles de pestañas seguidos (Iniciar sesión / Crear cuenta, y luego Correo / Código de
  oficina) con estilos muy parecidos: cuesta saber cuál manda.
- No hay selector de tema: quien entra no puede cambiar a claro u oscuro hasta iniciar sesión.
- Muestra `AVISO_DEMO` al pie.
- Textos sin tildes ("Iniciar sesion", "Contrasena", "Codigo"): la regla ñ solo prohíbe tildes en
  identificadores, **no en la interfaz**.

### Pantalla principal — `app/src/funcionalidades/panel-personal/pantalla.tsx`
- La cámara vive **a la izquierda**, dentro de una tarjeta y compartiendo fila con el icono de
  estado (`grid sm:grid-cols-[1fr_auto]`). En la práctica ocupa menos de la mitad del ancho.
- `AvisoDemo` arriba a la derecha.
- El desglose del puntaje es una columna fija de 22 rem; las 4 cifras y la tendencia van debajo.

### Vista de cámara — `app/src/componentes/comunes/vista-camara.tsx` (615 líneas, supera el límite de 500)
- El selector de **ángulo** está **encima del video**, en botones de texto de 11 px: difíciles de
  acertar con el mouse y tapan la imagen.
- Los controles (activar cámara, fuente, dispositivo, calibración) quedan **en filas distintas
  debajo del video**, cada uno con su propio estilo: hay que buscarlos.
- Usa `<select>` nativos con clases propias en vez de `CampoSelect`.
- Se reutiliza en el panel de oficina, así que cualquier cambio lo afecta.

### Paleta — `app/src/index.css`
- El **color principal (botones, navegación activa) es teal**, y el **estado "buena postura" también
  es teal**. Un botón y un "vas bien" se ven iguales: es la principal causa de que la paleta no sea
  intuitiva.
- El modo oscuro es un azul petróleo casi negro y poco contrastado entre fondo y tarjetas
  (`0.185` frente a `0.235` de luminancia).
- Los tokens `--demo` / `--demo-suave` se usan también para **notas que no son de demostración**
  (antecedentes, equipo, consentimiento, festivos del mapa de calor).

### Tema
- Ya existe `claro / oscuro / sistema` (`estado/interfaz.ts`, `componentes/layout/selector-tema.tsx`).
  Funciona, pero solo se ve dentro de la barra lateral y no en el acceso.

### Nombre
- `APP.nombre` y `APP.nombreLargo` en `config/app.config.ts` alimentan la mayor parte de la UI, pero
  hay **textos con "Habitusitos" escritos a mano**: ver la lista de la Fase 1.

---

## 3. Fases

Cada fase termina con `cd app && npm run verificar` en verde y una revisión visual de las rutas que
toca, en los dos temas. Ninguna fase mezcla cambios funcionales con cambios visuales.

### Fase 0 — Referencias visuales y modelo 3D (sin código de la app)

**Fase completada el 2026-10-08.**

- ✅ **Paleta aprobada por el usuario (2026-10-08)**, sin cambios, tras revisar la página de prueba
  (<https://claude.ai/artifact/LsWEb1tDbznFLucsuD4nuT>). Aprobados también el marco de madera
  alrededor de la cámara (con anillo interior del color del estado) y las cifras del día sobre salvia.
  Todos los pares pasan AA. Valores finales, que la Fase 2 copia tal cual a `index.css`:

  | Token | Claro | Oscuro | Contraste (claro / oscuro) |
  |---|---|---|---|
  | fondo | `oklch(0.975 0.012 85)` | `oklch(0.21 0.045 258)` | — |
  | tarjeta | `oklch(0.995 0.005 85)` | `oklch(0.265 0.05 258)` | — |
  | texto | `oklch(0.25 0.05 255)` | `oklch(0.955 0.012 85)` | 14,9 / 15,6 sobre fondo |
  | texto-suave | `oklch(0.47 0.035 250)` | `oklch(0.76 0.03 240)` | 6,7 / 7,2 sobre tarjeta |
  | azul (primary) | `oklch(0.34 0.085 258)` | `oklch(0.78 0.085 245)` | — |
  | sobre-azul | `oklch(0.97 0.012 85)` | `oklch(0.21 0.045 258)` | 10,8 / 8,9 sobre azul |
  | panel (login) | `oklch(0.34 0.085 258)` | `oklch(0.17 0.045 258)` | — |
  | sobre-panel | `oklch(0.97 0.012 85)` | `oklch(0.955 0.012 85)` | ≥ 10 |
  | panel-suave | `oklch(0.8 0.04 250)` | `oklch(0.8 0.04 250)` | 6,4 / ≥ 9 sobre panel |
  | salvia | `oklch(0.92 0.035 145)` | `oklch(0.34 0.04 150)` | — |
  | salvia-texto | `oklch(0.36 0.06 150)` | `oklch(0.88 0.05 145)` | 8,4 / 8,2 sobre salvia |
  | madera | `oklch(0.52 0.075 58)` | `oklch(0.72 0.08 62)` | 5,2 / 7,0 sobre fondo |
  | madera-suave | `oklch(0.86 0.04 65)` | `oklch(0.38 0.045 60)` | — |
  | borde | `oklch(0.88 0.015 85)` | `oklch(0.37 0.035 255)` | decorativo |
  | borde-control | `oklch(0.6 0.03 250)` | `oklch(0.58 0.04 250)` | ≥ 3 sobre tarjeta |
  | estado-buena | `oklch(0.5 0.13 150)` | `oklch(0.8 0.15 150)` | 5,6 / 8,7 |
  | estado-regular | `oklch(0.54 0.115 72)` | `oklch(0.83 0.13 80)` | 5,1 / 9,0 |
  | estado-corrige | `oklch(0.53 0.16 18)` | `oklch(0.76 0.13 18)` | 5,7 / 6,8 |
  | estado-pausa | `oklch(0.5 0.02 250)` | `oklch(0.73 0.02 250)` | 5,9 / 6,4 |
  | columna (3D) | `oklch(0.88 0.03 80)` | `oklch(0.9 0.03 80)` | decorativo |
  | video (fondo cámara) | `oklch(0.3 0.03 250)` | `oklch(0.16 0.03 258)` | — |

  Derivados en la Fase 2 con el mismo criterio y verificados por `contraste.test.ts`: variantes
  `*-suave` de los estados, gráficas, mapa de calor, `--ring`, `--destructive` y `--nota`. Único
  ajuste sobre lo aprobado: `--input` en oscuro sube de `0.58` a `0.6` de luminancia para dejar margen
  sobre el mínimo de 3:1.
- ✅ **Modelo 3D de la columna preparado (2026-10-08).** `app/public/3d/columna.glb`: 25 mallas
  (`C1`…`L5`, `Sacro`), ~71 800 triángulos, **258 KB** con Draco, comprobado al reimportarlo y con un
  render de frente y de lado. Lo genera `herramientas/3d/exportar_columna.py` con Blender 5.2 (sin
  interfaz, vía `flatpak-spawn --host` desde el entorno del agente). Atribución en
  `app/public/3d/LICENCIA.md`. No hizo falta reducir polígonos: las mallas de Z-Anatomy ya son ligeras.
  La plantilla descargada (no versionada) queda en `~/.cache/espinker-3d/`.

### Fase 1 — Rebranding a Espinker (solo texto visible) ✅ (2026-10-08)

Archivos con el nombre en la interfaz:

| Archivo | Qué cambia |
|---|---|
| `app/src/config/app.config.ts:131-132` | `APP.nombre = "Espinker"`, `nombreLargo = "Espinker · Monitor de postura"` |
| `app/index.html:11,14` | `<title>` y `meta description` (quitar también "Prototipo visual" y "para Windows") |
| `app/src/componentes/layout/franja-bandeja.tsx:45` | Título del icono de bandeja → usar `APP.nombre` |
| `app/src/estado/simulacion.ts:758` | Título de la notificación del sistema → `APP.nombre` |
| `app/src/datos/cliente.ts:78,120,182` | Mensajes de error |
| `app/src/funcionalidades/historial/pantalla.tsx:90` | "Usaste Habitusitos…" |
| `app/src/dominio/consentimientos.ts:35,49` | Textos del consentimiento (dominio no importa config: el nombre va literal) |
| `app/src/datos/api/historial.api.ts:164`, `funcionalidades/ayuda/pantalla.tsx:76` | Nombres de archivos exportados (`espinker_historial_…`) |
| `app/src/datos/fixtures/ajustes.ts:101` | Ruta de ejemplo mostrada en Ajustes |
| Icono de marca en `marco.tsx` | Hoy es `Sparkles` genérico: sustituir por un logotipo propio en SVG (ver Fase 2) |

**Fuera de esta fase, a propósito:**
- Claves de `localStorage` (`habitusitos_interfaz_v1`, `habitusitos_demo_v1`): cambiarlas borra el
  tema y los datos locales de quien ya usa la app. Se quedan como identificadores internos.
- Nombre de carpetas del repositorio y documentación: pasada aparte, ya prevista en `MEMORY.md`.

**Dentro de esta fase (decisión §7.6):** las cabeceras de autoría pasan a "aporte propio de
Espinker" en `app/src/` y `vision-node/` (incluidas las pruebas). Es un cambio solo de comentarios:
se hace con un reemplazo revisado archivo por archivo, no a ciegas, porque "Habitusitos" también
aparece en las claves de almacenamiento que **no** se tocan. `CLAUDE.md` §4 se actualiza igual.

Se añade un test sencillo que falle si aparece "Habitusitos" en texto de interfaz (mismo patrón que
el test de jerga prohibida).

### Fase 2 — Paleta y tokens ✅ (2026-10-08)

Solo `app/src/index.css` y `docs/SISTEMA_DISENO.md`; ningún componente cambia de clases todavía.

1. Reescribir `:root` y `.dark` con la paleta elegida (§7.1), con estos papeles:

   | Familia | Modo claro | Modo oscuro | Uso |
   |---|---|---|---|
   | **Azul profundo** | Bloques de contraste: barra lateral, panel izquierdo del login, botón principal | Fondo principal | Marca y estructura |
   | **Verde salvia** | Fondos de sección suaves, tarjetas secundarias | Superficies elevadas, tono apagado | Calma, agrupación |
   | **Madera / café cálido** | Bordes gruesos de contenedores destacados, separadores, logotipo, foco del marco de la cámara | Igual, con más luminancia | Calidez, detalles |
   | **Neutro cálido (crema)** | Fondo principal y tarjetas | Texto | Lectura |

   **Los estados posturales no reutilizan esas familias**, para que no se confundan con la decoración:
   - *Buena*: verde **más saturado** que la salvia (la salvia es apagada; el estado debe saltar a la vista).
   - *Regular*: ámbar dorado, alejado del café por saturación y luminancia.
   - *Corrige*: coral rosado (tono ~15°), alejado de la madera (~60°) y del ladrillo actual.
   - *Pausa*: gris azulado.
   - La madera **nunca** se usa para un estado ni para un control interactivo: un botón café se lee
     como "deshabilitado" o como advertencia.
2. **Separar marca y estado:** `--primary` (azul profundo) deja de ser el mismo tono que `--estado-buena`.
3. Modo oscuro con **más separación entre fondo, tarjeta y borde** (escalones de luminancia visibles).
4. Renombrar `--demo` / `--demo-suave` a `--nota` / `--nota-suave` (siguen haciendo falta para las
   notas informativas) y `.franja-demo` a `.franja-festivo`.
5. Nuevos tokens para el login: `--columna-hueso`, `--columna-resalte`, `--columna-luz` (materiales
   y luz del modelo 3D) y `--superficie-vidrio` (panel del formulario sobre el fondo).
6. Verificar **AA (≥ 4,5:1 texto, ≥ 3:1 iconos y bordes de controles)** de cada par en ambos temas y
   anotar las cifras en `SISTEMA_DISENO.md` §2.
7. Logotipo de Espinker en SVG con `currentColor` (sin hex crudo).

Se mantienen: los tres canales de estado (color + forma + texto), el mapa de calor monocromo y la
regla de no usar rojo/verde como único par en gráficas.

### Fase 3 — Pantalla de acceso nueva ✅ (2026-10-08)

> **Cómo quedó, y en qué se apartó de lo escrito abajo:**
> - Sin `@react-three/drei`: el modelo se carga con `useLoader` + `GLTFLoader` de three. Una librería menos.
> - El decodificador Draco no se copia a `public/`: three r186 lo referencia con `new URL(..., import.meta.url)`
>   y Vite lo empaqueta (`DRACO_GLTF_CONFIG`, 192 kB). Sigue sin depender de una CDN.
> - El resaltado cambia el color de la vértebra a madera además del brillo: solo con `emissive` no se notaba.
> - El botón sol/luna de dos estados (previsto en la Fase 4) se adelantó aquí, porque el login lo necesita.
> - `AVISO_DEMO` sigue en el login hasta la Fase 5, junto con el resto de avisos y el cambio de regla.
> - Verificado en Chromium por el protocolo DevTools: carga, tooltip ("Vértebra torácica 12 · T12"),
>   resaltado, parallax, ambos temas; a 390 px no se descarga ningún recurso 3D.

**Distribución (≥ 1024 px):**

```
┌──────────────────────────────────────────┬────────────────────────────────┐
│                                          │                 [☀/☾]          │
│                                          │   [logo] Espinker              │
│       FONDO ANIMADO INTERACTIVO          │   Cuida tu postura mientras    │
│       (55 %, lienzo a pantalla           │   trabajas                     │
│        completa de alto)                 │                                │
│                                          │   [ Iniciar sesión | Crear ]   │
│       Frase corta de valor abajo         │   ( Correo  ·  Código oficina )│
│       a la izquierda                     │   Correo      [            ]   │
│                                          │   Contraseña  [         👁 ]   │
│                                          │   [     Iniciar sesión     ]   │
└──────────────────────────────────────────┴────────────────────────────────┘
                    55 %                                  45 %
```

- `grid-cols-[55fr_45fr]` en `lg`. **Por debajo de 1024 px el fondo se oculta** (y el modelo 3D
  **no se descarga**) y el formulario ocupa todo el ancho.
- Formulario con ancho máximo legible (~400 px) centrado dentro de su 45 %.
- **Selector de tema** (sol/luna) visible arriba a la derecha.
- Jerarquía de pestañas clara: la primera como control segmentado; el método de acceso como
  segundo nivel visualmente más ligero, o como enlace "Entrar con código de oficina".
- Botón para mostrar u ocultar la contraseña.
- Textos con tildes correctas ("Iniciar sesión", "Contraseña", "Código").
- Sin `AVISO_DEMO`.

**Fondo 3D — columna vertebral interactiva (decisión §7.2)**

Escena con **Three.js + React Three Fiber** que muestra un modelo de la columna con una malla por
vértebra (`C1`…`C7`, `T1`…`T12`, `L1`…`L5`, `Sacro`).

*Dependencias nuevas:* `three`, `@react-three/fiber`, `@react-three/drei` (para `useGLTF`).
Pesan ~600 kB: se cargan con **`React.lazy` solo en `/ingresar` y solo en pantallas ≥ 1024 px**,
para no inflar el resto de la app. Mientras cargan se muestra el panel azul liso.

*Modelo (decisión §7.7): Z-Anatomy*, plantilla de Blender con licencia **CC BY-SA 4.0**, derivada
de BodyParts3D (<https://github.com/Z-Anatomy/The-blend>).

Preparación, una sola vez, con un script de Python para Blender guardado en
`herramientas/3d/exportar_columna.py`. Así el proceso es repetible y se puede defender ante el jurado:
1. Abrir la plantilla de Z-Anatomy y quedarse solo con las mallas de la columna: 7 cervicales,
   12 torácicas, 5 lumbares y sacro (cóccix opcional). Se quitan discos, costillas y ligamentos.
2. **Renombrar** cada malla a su código: `C1`…`C7`, `T1`…`T12`, `L1`…`L5`, `Sacro`. La lógica de
   interacción depende solo de esos nombres.
3. Centrar el conjunto en el origen, columna vertical, escala ~1 unidad = 10 cm.
4. Reducir polígonos (`Decimate`) hasta ~150–250 mil triángulos en total.
5. Exportar a glTF binario con compresión **Draco** y sin texturas (el color lo pone la app según el
   tema). Meta: **< 1,5 MB**. Si no se llega, `gltf-transform` con `meshopt`.
6. Guardar en `app/public/3d/columna.glb` (versionado, no en `public/modelos/`, que git ignora), junto a
   `app/public/3d/LICENCIA.md` con la atribución y la licencia.

*Licencia:* el modelo derivado **también queda bajo CC BY-SA 4.0** (es "compartir igual"). Va en un
archivo aparte, así que el código sigue bajo AGPL-3.0. La atribución es obligatoria y visible: una
línea pequeña al pie del panel 3D ("Modelo 3D: Z-Anatomy, CC BY-SA 4.0") y una sección en `README.md`.

*Contrato con el código:* un test comprueba que el `.glb` contiene exactamente las 25 mallas con los
nombres esperados, para que un reexporte con un nombre mal puesto se detecte antes de llegar a la
pantalla.

*Carga:* Draco necesita su decodificador. Se sirve desde `public/` (como los `.wasm` de MediaPipe), no
desde una CDN externa, para que el login no dependa de un tercero.

*Archivos:*
- `componentes/comunes/fondo-columna-3d/escena.tsx`: `<Canvas>`, luces, cámara, carga perezosa.
- `componentes/comunes/fondo-columna-3d/use-interaccion-columna.ts`: toda la lógica pedida.
- `componentes/comunes/fondo-columna-3d/vertebras.ts`: tabla código → nombre legible
  ("T3" → "Vértebra torácica 3"), sin jerga en pantalla.

*Interacción (lo que pide el usuario):*
1. **Raycasting** sobre las mallas individuales usando los eventos de puntero de R3F
   (`onPointerOver`/`onPointerOut`, que ya hacen el raycast), con `e.stopPropagation()` para que
   solo responda la vértebra más cercana.
2. **Hover:** se resalta con `emissive` + `emissiveIntensity` (sin reemplazar el material, para no
   crear materiales nuevos en cada evento). Cada vértebra recibe **su propio clon del material** al
   cargar; si no, resaltar una ilumina todas las que comparten material. Se dispara
   `onVerticeSeleccionada(codigo)` y la interfaz muestra un **tooltip** junto al cursor con el nombre
   legible. Cursor de mano mientras hay hover.
3. **MouseOut:** restaura `emissive` e intensidad guardados al cargar.
4. **Parallax:** el grupo contenedor rota en X e Y hacia las coordenadas normalizadas del puntero
   (`state.pointer`), con `lerp` por cuadro (factor ~0,05 ajustado con `delta` para que no dependa de
   los fps), limitado a ±8–12°.
5. **Animación continua** (pedido original: "animado continuo"): una oscilación lenta en Y y una
   "respiración" muy leve, para que la escena se mueva aunque el mouse esté quieto.

*Reglas del proyecto que se respetan:*
- **Sin hex crudo:** los colores de los materiales y la luz se leen de los tokens CSS
  (`getComputedStyle`) y se recalculan al cambiar de tema.
- **Sin `Math.random()`:** la escena no lo necesita; si hiciera falta, generador con semilla fija.
- **`prefers-reduced-motion`:** sin parallax ni animación continua; la columna queda quieta, el hover
  sigue funcionando (es respuesta directa al usuario, no decoración).
- **Rendimiento:** `frameloop="always"` solo mientras la pestaña está visible; `dpr={[1, 1.5]}`;
  se libera la escena (`dispose`) al salir del login.
- **Accesibilidad:** el lienzo es `aria-hidden` y el tooltip no recibe foco: la columna es un
  complemento visual, nada del acceso depende de ella.
- **Respaldo:** si el navegador no tiene WebGL, se muestra el panel azul liso con la frase de valor.

### Fase 4 — Pantalla principal: la cámara al centro

**Distribución (≥ 1280 px):**

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Panel de hoy · "Tu cabeza se adelanta un poco"            [Estado: Bien ●]│
├──────────────┬─────────────────────────────────────────┬──────────────────┤
│ ESTADO       │                                         │ DE QUÉ SE        │
│  ● forma 72  │                                         │ COMPONE TU       │
│  Bien · 82   │         CÁMARA (protagonista)           │ PUNTAJE          │
│              │      rounded-3xl, ~60 % del ancho       │  cuello  ▮▮▮▯    │
│ Tiempo activo│      chip "Webcam en vivo" arriba-izq.  │  hombros ▮▮▯▯    │
│ Racha        │                                         │  …               │
│ Buena postura│                                         │                  │
│ Últ. 15 min  ├─────────────────────────────────────────┤                  │
│              │ [● Cámara] [Fuente ▾] [Disp. ▾]          │                  │
│              │ [Ángulo: Frente|Lado|Arriba] [Calibrar] │                  │
├──────────────┴─────────────────────────────────────────┴──────────────────┤
│ Tendencia de la sesión  ──────────────────────────────────────────────    │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Cámara:** columna central `minmax(0, 1fr)` con rieles laterales de ~16 rem y ~20 rem; video con
  `rounded-3xl`, sombra suave y un borde de 2 px del **color de estado** (tercer canal discreto que no
  tapa la imagen). Relación de aspecto conservada (4:3 hoy; evaluar 16:9 si la webcam la entrega).
- **Barra de controles ("dock") pegada bajo el video y centrada:** activar cámara, fuente, dispositivo,
  ángulo y calibración en **una sola fila**, con objetivos de **al menos 40 × 40 px** (WCAG 2.5.8 pide
  24; se busca comodidad). El selector de ángulo **sale del video** y pasa aquí.
- Sobre el video solo queda el chip de estado de la fuente y el aviso de conexión de oficina.
- **Riel izquierdo:** forma de estado grande + insignia + frase; debajo, las 4 cifras apiladas.
- **Riel derecho:** desglose del puntaje (fijo al hacer scroll, como hoy).
- **Abajo, ancho completo:** tendencia de la sesión.
- **1024–1279 px:** cámara a todo el ancho arriba, dock debajo, y los dos rieles en dos columnas.
- **< 1024 px:** todo en una columna, cámara primero.
- La nota de privacidad ("el video nunca se guarda…") va bajo el dock, en una línea.
- **Accesibilidad con mouse y teclado:** los controles mantienen siempre la misma posición (no se
  mueven cuando aparece un selector), el orden de tabulación sigue el orden visual (cámara → dock →
  rieles), foco visible en todo.

**Refactor de `vista-camara.tsx`** (615 líneas → piezas < 300, y el panel de oficina las reutiliza):
- `vista-camara.tsx`: video, lienzo del esqueleto, chip y banners superpuestos.
- `barra-controles-camara.tsx` (nuevo): el dock; los `<select>` nativos pasan a `CampoSelect`.
- `tarjeta-calibracion.tsx` (nuevo): bloque de "tu postura de referencia".
- Solo se mueve JSX y props: **ninguna lógica de cámara, puntaje ni calibración cambia.**

**Tema (decisión §7.3):** `SelectorTema` pasa a ser **un botón sol/luna de dos estados** (claro/oscuro),
visible en el login y en la franja superior de la app. Se elimina la opción "Sistema" del selector,
pero la **primera visita** arranca según la preferencia del sistema operativo. El tipo `Tema` en
`estado/interfaz.ts` pasa a `"claro" | "oscuro"`; quien tenga guardado `"sistema"` se migra una vez
al valor que corresponda (versión del `persist` de Zustand), sin cambiar la clave de almacenamiento.

### Fase 5 — Retirar los avisos de demostración

| Dónde | Acción |
|---|---|
| `config/app.config.ts:145` `AVISO_DEMO` | Eliminar |
| `componentes/comunes/avisos.tsx` `AvisoDemo` | Eliminar el componente |
| Panel personal, panel de oficina, ayuda, onboarding, ajustes, autenticación | Quitar el uso |
| Notas de antecedentes, equipo y consentimiento | **Se conservan**: no son avisos de demo, son información real (qué no se diagnostica, umbral de anonimato, borrador pendiente del comité de ética). Pasan al token `--nota` |
| Botón "Reiniciar demostración" en Ajustes | Renombrar a "Borrar datos locales de este equipo" (misma función) |
| `CLAUDE.md` §5, §6, §10 y `SISTEMA_DISENO.md` §5 | Actualizar las reglas, con fecha y motivo (ver §1) |

**Honestidad que se mantiene:** cuando la cámara está apagada el panel sigue mostrando datos
simulados. Ahí, y solo ahí, se etiqueta: el chip "Vista simulada" ya existe sobre el video, y se
añade "Datos de ejemplo" junto a las cifras mientras la cámara esté apagada.

### Fase 6 — Verificación final

- `npm run verificar` en verde (lint + tests + build), incluidos los tests de arquitectura (sin hex
  crudo, sin `Math.random()`, capas).
- Revisión visual con Playwright de `/ingresar` y `/` en **claro y oscuro**, a 1440, 1280, 1024 y
  390 px de ancho; capturas guardadas para comparar antes y después.
- Contraste AA comprobado en los pares nuevos.
- `prefers-reduced-motion` activado: el fondo queda quieto.
- Panel de oficina revisado (comparte la vista de cámara).
- Actualizar `MEMORY.md` (bitácora) y `docs/SISTEMA_DISENO.md`.

---

## 4. Archivos afectados (resumen)

| Capa | Archivos |
|---|---|
| Raíz `app/` | `index.html`, `package.json` (`three`, `@react-three/fiber`, `@react-three/drei`); `public/3d/columna.glb` + `LICENCIA.md` + decodificador Draco; `herramientas/3d/exportar_columna.py` (script de Blender) |
| `config/` | `app.config.ts` |
| `dominio/` | `consentimientos.ts` (solo texto) |
| `datos/` | `cliente.ts`, `api/historial.api.ts`, `fixtures/ajustes.ts` (solo texto) |
| `estado/` | `simulacion.ts` (título de notificación), `interfaz.ts` (tema de dos estados) |
| `componentes/comunes/` | `vista-camara.tsx` (dividido), **nuevos** `barra-controles-camara.tsx`, `tarjeta-calibracion.tsx`, `fondo-columna-3d/` (escena, interacción, tabla de vértebras), `logo-espinker.tsx`; `avisos.tsx`; `mapa-calor.tsx` (clase renombrada) |
| `componentes/layout/` | `marco.tsx`, `franja-bandeja.tsx`, `selector-tema.tsx` |
| `funcionalidades/` | `autenticacion`, `panel-personal`, `panel-oficina`, `ayuda`, `onboarding`, `ajustes`, `antecedentes`, `equipo`, `consentimiento`, `historial` |
| Estilos | `index.css` |
| Documentación | `CLAUDE.md`, `docs/SISTEMA_DISENO.md`, `MEMORY.md` |

Ninguna función de `dominio/`, `camara/` ni de cálculo de puntaje cambia de comportamiento.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| El refactor de la vista de cámara rompe el panel de oficina | Mover JSX sin tocar lógica; revisar ambos paneles en la Fase 6 |
| El fondo animado consume CPU mientras la persona escribe su contraseña | Pausa en pestaña oculta, presupuesto por cuadro medido, cuadro quieto con movimiento reducido |
| La paleta nueva baja el contraste en algún par | Tabla de contraste por par antes de aplicar (Fase 2) |
| Quitar el aviso global hace pasar datos simulados por reales | Etiqueta local "Datos de ejemplo" / "Vista simulada" (Fase 5) |
| Cambiar claves de almacenamiento borra preferencias | No se cambian (Fase 1) |

## 6. Orden y tamaño estimado

| Fase | Depende de | Tamaño |
|---|---|---|
| 0 Prueba de paleta y modelo 3D ✅ | — | Hecho |
| 1 Rebranding | — | Pequeño |
| 2 Paleta y tokens | 0 | Medio |
| 3 Login nuevo + columna 3D | 0, 2 | Grande |
| 4 Cámara al centro | 2 | Grande |
| 5 Quitar avisos de demo | — | Pequeño |
| 6 Verificación | Todas | Medio |

Las fases 1 y 5 pueden ir en paralelo con la 0.

## 7. Decisiones

Respondidas el 2026-10-08:

1. ✅ **Paleta:** Azul profundo (fondo principal o bloques de contraste) + Verde salvia (fondos
   secundarios, secciones suaves) + Madera/café cálido (bordes gruesos y detalles). Reparto de papeles
   y colores de estado en la Fase 2.
2. ✅ **Fondo del login:** columna vertebral 3D (Three.js / React Three Fiber) con raycasting por
   vértebra, resaltado y tooltip al pasar el mouse, y parallax suavizado. Detalle en la Fase 3.
3. ✅ **Tema:** botón sol/luna de dos estados; la primera visita sigue al sistema operativo.
4. ✅ **Reglas de `CLAUDE.md`:** se reescriben §5/§10 (aviso de demostración) y §6 (animación
   decorativa, con excepción en el login), como propone §1. Cada regla cambia junto con el código que
   la necesita: §6 en la Fase 3 (hecho), §5/§10 en la Fase 5.
5. ✅ **Fondo en móvil:** se oculta.
6. ✅ **Cabeceras de autoría:** se renombran a Espinker en esta pasada (Fase 1).

7. ✅ **Modelo de la columna:** opción (a), modelo anatómico de Z-Anatomy (CC BY-SA 4.0) preparado
   en Blender con un script versionado. Detalle en la Fase 3.

8. ✅ **Blender:** instalado en el sistema por el usuario; el agente lo ejecuta sin interfaz.
