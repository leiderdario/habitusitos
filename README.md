# Habitusitos — prototipo navegable

Prototipo visual y semifuncional de **Habitusitos**, una aplicación de escritorio para Windows que usa la webcam para monitorear la postura corporal en segundo plano y solo interviene cuando detecta mala postura sostenida.

Es un trabajo de grado de Ingeniería de Software de la Universidad de Cartagena, derivado de [BatesPosture](https://github.com/wtbates99/batesposture) bajo licencia **AGPL-3.0**.

> ### ⚠️ Esto no es el producto
>
> Es el prototipo que se enseña **antes** de que exista el software. El producto final es una aplicación de escritorio en **Python + PyQt6 + MediaPipe**.
>
> Lo que sí es real aquí: la fórmula de puntuación de siete métricas, la máquina de estados de alertas, el baseline adaptativo (el aporte principal de la tesis) y la detección de pose por webcam. Lo simulado son los datos históricos y las cifras de consumo de recursos — y donde algo es simulado, **la propia pantalla lo declara**.

---

## Arrancar

```bash
cd app
npm install
npm run dev          # → http://localhost:5173
```
cd "vision-node"
.\.venv\Scripts\python.exe -m vision_node.main --source 1 --no-gui

Venatana
cd "vision-node"
.\.venv\Scripts\python.exe -m vision_node.main --source 1


Requiere **Node 20.19+ o 22.12+**. No hace falta nada más.

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
| `/` | **Panel de hoy** — cámara, puntaje, desglose de las siete métricas, sparkline, estadísticas de sesión |
| `/historial` | Calendario de constancia, comparación por día de la semana, tendencia semanal, exportación |
| `/baseline` | **Aporte 1 de tesis** — referencia personal adaptativa y sus tres salvaguardas anti-deriva |
| `/benchmark` | **Aporte 2 de tesis** — comparación de consumo antes/después y metodología |
| `/ajustes` | Seis secciones que espejan las del `SettingsService` real |
| `/ayuda` | Los nueve escenarios de error, limitaciones conocidas y documentos de la prueba |
| `/demo` | **Guion de presentación** — seis escenarios con qué decir y qué observar |
| `/acerca-de` | Licencia AGPL, acceso al código, qué es heredado y qué es aporte propio |
| `/bienvenida` | Primera ejecución en cinco pasos |

**Empieza por `/demo`.** Trae el recorrido guionado.

---

## Estructura

```
MSTR/
├─ PROMPT_MAESTRO_HABITUSITOS.md   Especificación del trabajo de grado
├─ README.md · CLAUDE.md · MEMORY.md
├─ docs/                            Documentación técnica (ver índice abajo)
├─ documentos/generar_documentos.py Generador de los documentos de la prueba
└─ app/                             El prototipo
   ├─ scripts/preparar-camara.mjs
   ├─ public/                       WASM, modelo y documentos generados (no versionados)
   └─ src/
      ├─ config/        Fuente única de umbrales, límites y semilla
      ├─ dominio/       Lógica pura, sin imports. CON TESTS. ← lo que se traduce a Python
      ├─ datos/         El "backend" simulado. La frontera.
      │  ├─ api/        Lo único que las pantallas pueden llamar
      │  └─ fixtures/   Datos de ejemplo, deterministas
      ├─ camara/        Modo cámara real, aislado
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
| [docs/INVESTIGACION_2026.md](docs/INVESTIGACION_2026.md) | **Léelo primero.** Investigación verificada el 2026-07-31 y **seis contradicciones** entre el prompt maestro y la realidad de hoy |
| [docs/DE_MOCK_A_REAL.md](docs/DE_MOCK_A_REAL.md) | **Para quien construya el producto.** Qué se traduce, qué se tira, en qué orden, y las trampas del empaquetado |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Capas, reglas verificadas, SOLID aplicado, deuda declarada |
| [docs/MAPA_PROMPT_MAESTRO.md](docs/MAPA_PROMPT_MAESTRO.md) | Cada RF/RNF → pantalla → archivo → estado. Cobertura sin releer 54 KB |
| [docs/SISTEMA_DISENO.md](docs/SISTEMA_DISENO.md) | Tokens, tipografía, accesibilidad WCAG 2.2 AA, voz y copy |
| [docs/GUIA_DEMO.md](docs/GUIA_DEMO.md) | Guion de 12 minutos + preguntas probables |
| [docs/DOCUMENTOS_PRUEBA.md](docs/DOCUMENTOS_PRUEBA.md) | Los documentos de la prueba: quién los usa, cuándo y para qué |

---

## Cuatro cosas que hay que saber antes de tocar el producto real

Verificadas el 31 de julio de 2026. Detalle completo en [docs/INVESTIGACION_2026.md](docs/INVESTIGACION_2026.md).

1. **`mediapipe.solutions` fue eliminado de los wheels de Python ≥ 0.10.31.** El pin `0.10.21` del proyecto original es un techo permanente. Migrar a `mediapipe.tasks.python.vision.PoseLandmarker` es obligatorio, no opcional.
2. **El repositorio base fue renombrado y su historial borrado el 2026-07-28.** Conserva 3 commits y cero releases. Cualquier análisis anterior a esa fecha describe un árbol que ya no existe.
3. **No existe hook de PyInstaller para MediaPipe** (verificado sobre los 682 hooks disponibles). El `.spec` se escribe a mano. Es el mayor riesgo del empaquetado.
4. **`winotify` está muerto** desde febrero de 2022. Usar `windows-toasts` y registrar un AUMID, o los avisos salen como "Python".

Además, la calibración de 6 segundos del proyecto original **guarda datos que el motor de puntaje no usa**. No es un detalle: refuerza la justificación del aporte 1.

---

## Cómo pasar de prototipo a producto real

Resumen. El detalle está en [docs/DE_MOCK_A_REAL.md](docs/DE_MOCK_A_REAL.md).

| Del prototipo | Destino |
|---|---|
| `dominio/puntaje.ts` | → `ml/pose_detector.py` (ya existe, verificar) |
| `dominio/baseline-adaptativo.ts` | → **`services/adaptive_baseline_service.py`** (módulo nuevo) |
| `dominio/maquina-estado.ts` | → `services/notification_service.py` |
| `dominio/estadisticas.ts` | → `services/score_service.py` (ya existe) |
| `dominio/tipos.ts` | → esquema SQLite |
| `datos/api/*.ts` | → consultas a SQLite. Cada función lleva su consulta en la cabecera |
| `funcionalidades/*/pantalla.tsx` | → widgets PyQt6. Se reutiliza el diseño y el copy, no el código |
| `datos/fixtures/`, `almacen.ts`, `estado/` | Se tiran |

**`dominio/` no importa nada** — ni React, ni la configuración, ni el store. Está escrita así a propósito: es la parte de este repositorio que se traduce línea por línea, y sus tests son el contrato de que la traducción es correcta.

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

La AGPL es hereditaria: Habitusitos debe distribuirse también bajo AGPL-3.0, **con el código fuente disponible para cualquiera que reciba el programa**. Al entregar el instalador a los participantes de la prueba hay que incluir un enlace al repositorio — no es una recomendación, es lo que exige la licencia.

---

**Autor del trabajo de grado:** Leider Darío Bolaño Agámez · Universidad de Cartagena, Ingeniería de Software
