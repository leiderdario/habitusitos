# Habitusitos

**Habitusitos** usa la webcam para monitorear la postura corporal en segundo plano y solo interviene cuando detecta mala postura sostenida.

Es un trabajo de grado de Ingeniería de Software de la Universidad de Cartagena, derivado de [BatesPosture](https://github.com/wtbates99/batesposture) bajo licencia **AGPL-3.0**.

> ### Dos piezas reales, no un prototipo descartable
>
> **`app/`** es la aplicación web (Vite + React) con la lógica de dominio implementada de verdad: la fórmula de puntuación de siete métricas, la máquina de estados de alertas, el baseline adaptativo (aporte principal de la tesis) y detección de pose por webcam con `@mediapipe/tasks-vision`.
>
> **`vision-node/`** es un nodo de visión en Python (YOLO-pose) para el modo multi-persona de oficina: detecta varias personas por escritorio y transmite por WebSocket hacia `app/`.
>
> El plan original (destino final = Python + PyQt6 en Windows) **quedó en pausa** — ver [docs/prompt_maestro_multipersona_oficina.md](docs/prompt_maestro_multipersona_oficina.md) §0. Lo que sigue simulado (datos históricos, cifras de consumo de recursos) lo declara la propia pantalla.

---

## Arrancar

### `app/` — la aplicación web

```bash
cd app
npm install
npm run dev          # → http://localhost:5173
```

Requiere **Node 20.19+ o 22.12+**. No hace falta nada más.

### `vision-node/` — modo cámara de oficina (opcional, multi-persona)

```bash
cd vision-node
python3 -m venv .venv
.venv/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch   # instalar torch CPU-only primero
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m vision_node.main --source 0 --no-gui   # segundo plano, sin ventana de depuración
.venv/bin/python -m vision_node.main --source 0            # con ventana de depuración
```

En Windows (PowerShell), sustituir `.venv/bin/` por `.venv\Scripts\`.

> Instalar `torch` desde el índice CPU antes de `requirements.txt` evita que `ultralytics` se traiga las ruedas CUDA (varios GB de más) en una máquina sin GPU.

Requiere **Python 3.10+**. Sin `vision-node/` corriendo, `app/` sigue funcionando con la webcam personal del navegador.

### Opcional: modo cámara sin internet

```bash
npm run preparar-camara
```

Descarga localmente el modelo y el runtime de MediaPipe (~50 MB). Sin esto el modo cámara funciona igual, pero pidiéndolos a un CDN. **Ejecútalo antes de una presentación**: no conviene que una demostración dependa de la conexión de la sala.

### Documentos de la prueba con usuarios

```bash
python documentos/generar_documentos.py
```

Genera cuatro PDF y dos CSV en `app/public/documentos/`. Solo necesita **Python 3.10+**, sin dependencias. Catálogo completo en [docs/DOCUMENTOS_PRUEBA.md](docs/DOCUMENTOS_PRUEBA.md).

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | 65 tests: dominio + reglas de arquitectura |
| `npm run build` | Verificación de tipos + build de producción |
| `npm run lint` | oxlint |
| `npm run verificar` | Los tres anteriores seguidos |
| `npm run preparar-camara` | Copia local de los recursos de MediaPipe |

---

## Las pantallas

| Ruta | Qué es |
|---|---|
| `/ingresar` | Login (correo+contraseña, o código de acceso de organización) y registro, con elección de modo de uso |
| `/bienvenida` | Onboarding: permiso de cámara y calibración inicial |
| `/` | **Según el modo de la cuenta** (`Usuario.modo_uso`, no un flag visual): `panel-personal/` para cuentas personales — cámara, estado cualitativo (sin puntaje numérico), desglose de métricas, sparkline, estadísticas de sesión; `panel-oficina/` para cuentas de oficina — video protagonista, círculo de promedio del equipo (ventana de 5 min), alerta si más de la mitad está en mala postura. Nunca muestra puntaje individual |
| `/historial` | Calendario de constancia, comparación por día de la semana, tendencia semanal, exportación |
| `/antecedentes` | Formulario de antecedentes de salud, editable, con historial de cambios. No diagnostica |
| `/ajustes` | Seis secciones que espejan las del `SettingsService` real |
| `/ayuda` | Los nueve escenarios de error, limitaciones conocidas y documentos de la prueba |

La pantalla de "Recursos" (`/benchmark`, aporte 2 de tesis) se eliminó por completo — ver
`MEMORY.md` 2026-10-02.

---

## Estructura

```
habitusitos/
├─ README.md · CLAUDE.md · MEMORY.md
├─ docs/                            Documentación técnica (ver índice abajo)
├─ documentos/generar_documentos.py Generador de los documentos de la prueba
├─ vision-node/                     Nodo de visión Python (YOLO-pose), multi-persona por escritorio
│  └─ vision_node/                  camera, detector, mapper, state_machine, websocket_server...
└─ app/                             La aplicación web
   ├─ scripts/preparar-camara.mjs
   ├─ public/                       WASM, modelo y documentos generados (no versionados)
   └─ src/
      ├─ config/        Fuente única de umbrales, límites y semilla
      ├─ dominio/       Lógica pura, sin imports. CON TESTS.
      ├─ datos/         El "backend" simulado. La frontera.
      │  ├─ api/        Lo único que las pantallas pueden llamar
      │  └─ fixtures/   Datos de ejemplo, deterministas
      ├─ camara/        Modo cámara real (webcam local o `vision-node/` por WebSocket), aislado
      ├─ componentes/   Piezas propias (comunes/, layout/)
      ├─ components/ui/ Primitivas shadcn/ui (terceros)
      ├─ funcionalidades/ Una carpeta por pantalla
      ├─ estado/        Zustand: interfaz y motor en vivo
      └─ utils/         Formato con Intl
```

**La regla:** `config → dominio → datos → camara → componentes → funcionalidades`. Una capa solo importa de capas anteriores.

No es una convención de buenas intenciones: está **verificada por test** en `src/arquitectura.test.ts`, junto con "ningún componente escribe un hex crudo" y "nada usa `Math.random()`". Durante la construcción ya cazó dos violaciones reales.

---

## Documentación

| Documento | Para qué |
|---|---|
| [MEMORY.md](MEMORY.md) | **Léelo primero.** Estado vivo: qué está construido, qué falta, decisiones recientes |
| [docs/prompt_maestro_multipersona_oficina.md](docs/prompt_maestro_multipersona_oficina.md) | El plan vigente: multi-persona, panel de oficina, auth/multi-tenencia, wearable |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Capas de `app/`, reglas verificadas, SOLID aplicado, deuda declarada |
| [docs/plan_implementacion_postura_3d_v2.md](docs/plan_implementacion_postura_3d_v2.md) | Detección 3D de postura (ya implementada) |
| [docs/SISTEMA_DISENO.md](docs/SISTEMA_DISENO.md) | Tokens, tipografía, accesibilidad WCAG 2.2 AA, voz y copy |
| [docs/GUIA_DEMO.md](docs/GUIA_DEMO.md) | Guion de 12 minutos + preguntas probables |
| [docs/DOCUMENTOS_PRUEBA.md](docs/DOCUMENTOS_PRUEBA.md) | Los documentos de la prueba: quién los usa, cuándo y para qué |

---

## Qué falta para el plan multi-persona de oficina

El plan vigente está en [docs/prompt_maestro_multipersona_oficina.md](docs/prompt_maestro_multipersona_oficina.md); el detalle de qué ya está hecho y qué no, en la sección "Pendiente" de [MEMORY.md](MEMORY.md). Resumen:

- **Hecho:** `vision-node/` detecta y rastrea varias personas por escritorio (YOLO-pose) y transmite por WebSocket; `app/` ya muestra el estado de esa conexión y degrada con gracia si falta una métrica.
- **Falta en el frontend:** tipos multi-persona en `dominio/` (`FrameMultiPersona`, `idSeguimiento`), el panel de oficina agregado y anónimo, autenticación/multi-tenencia por organización.
- **Pendiente de decidir, no de código:** qué promesa de privacidad y red reemplaza a la original ("cero llamadas de red"), ahora que `vision-node/` sí las hace — ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) §8.

**`dominio/` no importa nada** — ni React, ni la configuración, ni el store. Está escrita así a propósito: es lógica pura, fácil de probar y de llevar a cualquier otro lugar si hiciera falta, y sus tests son el contrato de que se comporta como dice.

---

## Convenciones

- **Español** en todo: identificadores, comentarios, textos. Excepción deliberada: los campos que espejan columnas de la base de datos van en `snake_case` inglés, porque **ya existen** en `data/database.py` y traducirlos crearía un sitio donde el prototipo y la base de datos podrían divergir en silencio.
- **Alias `@/`** obligatorio. Nunca rutas relativas que suban más de un nivel.
- **Ningún color en crudo.** Todo sale de un token de `index.css`. Hay un test que lo verifica.
- **Nada de `Math.random()` ni `new Date()` sin argumentos.** El azar sale de `datos/semilla.ts` y el tiempo de `config.ANCLA_UTC`. Dos demostraciones consecutivas deben verse idénticas.
- **Comentarios solo del porqué no obvio**, nunca del qué.
- **Sin jerga técnica en la interfaz.** "landmark", "CLAHE", "EMA" y "baseline" son válidos en el código y prohibidos en pantalla. Hay un test que lo comprueba en la frase del panel.

---

## Licencia

**AGPL-3.0-only**, heredada de [BatesPosture](https://github.com/wtbates99/batesposture) (wtbates99).

La AGPL es hereditaria: Espinker debe distribuirse también bajo AGPL-3.0, **con el código fuente disponible para cualquiera que reciba el programa**. Al entregar el instalador a los participantes de la prueba hay que incluir un enlace al repositorio — no es una recomendación, es lo que exige la licencia.

### Modelo 3D de la columna

`app/public/3d/columna.glb` no es código: es una obra derivada de **Z-Anatomy** (CC BY-SA 4.0) y
**BodyParts3D** (The Database Center for Life Science, CC BY-SA 2.1 Japón), y se distribuye bajo
**CC BY-SA 4.0**. La atribución completa y la lista de cambios están en
[`app/public/3d/LICENCIA.md`](app/public/3d/LICENCIA.md); la pantalla de acceso la muestra al pie del
panel. Se regenera con [`herramientas/3d/exportar_columna.py`](herramientas/3d/exportar_columna.py).

---

**Autor del trabajo de grado:** Leider Darío Bolaño Agámez · Universidad de Cartagena, Ingeniería de Software
