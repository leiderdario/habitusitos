# Investigación técnica y de contexto — Habitusitos

| Campo | Detalle |
|---|---|
| Documento | Informe de investigación previo a la construcción del prototipo |
| Fecha de verificación | **31 de julio de 2026** |
| Método | Búsqueda web abierta + verificación cruzada contra registries (npm, PyPI), APIs de GitHub y documentación oficial. Lo marcado **[CONFIRMADO]** se comprobó con petición real en esta sesión. |
| Estado | Insumo de decisión. Los hallazgos marcados ⚠️ **cambiaron decisiones de diseño** del prototipo |
| Relacionado | [PROMPT_MAESTRO_HABITUSITOS.md](../PROMPT_MAESTRO_HABITUSITOS.md) · [ARQUITECTURA.md](ARQUITECTURA.md) · [DE_MOCK_A_REAL.md](DE_MOCK_A_REAL.md) |

> **Cómo leer este documento.** No es un resumen de noticias. Cada hallazgo termina en una **acción concreta** sobre el producto. La sección 1 es lo único que hay que leer si solo se tienen cinco minutos: son las contradicciones entre el prompt maestro y la realidad de julio de 2026.

---

## 0. Resumen ejecutivo

1. **El pin `mediapipe==0.10.21` del proyecto original es un techo permanente, no una preferencia.** La API `mediapipe.solutions` fue eliminada de los wheels de Python a partir de 0.10.31. Migrar a la Tasks API es obligatorio, no opcional.
2. **El repositorio base fue renombrado y su historial borrado tres días antes de esta investigación.** Cualquier análisis anterior al 2026-07-28 describe un árbol que ya no existe.
3. **La calibración de 6 segundos guarda datos que el motor de puntaje no usa.** Es una brecha real del proyecto original y refuerza la justificación del aporte 1 de tesis.
4. **`winotify` está muerto** (sin publicación desde febrero de 2022). Hay que usar `windows-toasts`.
5. **No existe hook de PyInstaller para MediaPipe.** Verificado sobre los 682 hooks de `pyinstaller-hooks-contrib`. El `.spec` hay que escribirlo a mano y es el mayor riesgo técnico del empaquetado.
6. **APCA está fuera de WCAG 3 desde 2023.** WCAG 2.2 AA es el único criterio de contraste citable hoy.

---

## 1. Contradicciones con el prompt maestro ⚠️

Estas seis cambian decisiones. Están ordenadas por gravedad.

### 1.1 🔴 `mediapipe.solutions` fue ELIMINADO de los wheels de Python

**Qué dice el prompt maestro** (§4.1): *"MediaPipe Pose (API 'Solutions', versión fijada en `pyproject.toml`)"*.

**Qué encontré.** Google terminó el soporte de las *Legacy Solutions* el 1 de marzo de 2023 y migró Pose el 10 de mayo de 2023; se mantenían *"on an as-is basis"*. Pero a partir de la versión **0.10.31** el código dejó de distribuirse: el wheel pasó de **35,6 MB a 10,3 MB**. El issue que lo reporta ([google-ai-edge/mediapipe#6192](https://github.com/google-ai-edge/mediapipe/issues/6192)) sigue sin respuesta oficial.

**Consecuencia.** El proyecto original solo puede funcionar con `mediapipe<=0.10.21`. No es una elección conservadora: es un **techo permanente**. Cualquier actualización de MediaPipe rompe el código heredado de golpe.

**Acción tomada.** El prototipo usa `@mediapipe/tasks-vision` (equivalente en navegador de la Tasks API) y el README le indica al desarrollador que migre `mediapipe.solutions.pose.Pose` → `mediapipe.tasks.python.vision.PoseLandmarker`. Ventaja adicional: la Tasks API usa un único archivo `.task`, mucho más fácil de empaquetar que el laberinto de `modules/` de la API antigua.

> Un jurado puede preguntar por qué se usó una API sin soporte desde hace tres años. Con este hallazgo la respuesta está documentada.

Fuentes: <https://ai.google.dev/edge/mediapipe/solutions/guide> · <https://github.com/google-ai-edge/mediapipe/releases>

---

### 1.2 🔴 El repositorio base fue renombrado y su historial borrado

**Qué encontré.** El repositorio `wtbates99/batesposture` fue **renombrado desde `opencv2-posture-corrector`** y su historial **reescrito el 2026-07-28**. Hoy conserva **3 commits** y **cero releases**.

**Consecuencia.** La Fase 1 del prompt maestro (§14) pide confirmar el análisis contra el fork real. Ese análisis hay que rehacerlo entero: cualquier referencia a commits, ramas o etiquetas anteriores al 28 de julio apunta a algo que ya no existe. La **estructura de directorios** descrita en §4.2 sí sigue siendo válida.

**Acción tomada.** El README advierte de esto antes de que alguien pierda una tarde buscando un commit que se borró.

---

### 1.3 🟡 La calibración de 6 segundos se guarda y no se usa

**Qué dice el prompt maestro** (§4.5): *"El resultado de la calibración de 6 segundos determina el punto de partida contra el cual se mide la desviación durante el uso normal."*

**Qué encontré.** `ui/onboarding.py` guarda `baseline_posture_score`, `baseline_neck_angle` y `baseline_shoulder_level`, pero `ml/pose_detector.py` sigue calculando contra los vectores ideales fijos `[0,-1,0]`. **La calibración no alimenta el scoring.** Es una brecha real del proyecto original.

**Consecuencia.** El RF-6 ("calibración personalizada inicial") está marcado como **[Heredado]** en §7, pero en la práctica está incompleto. El aporte 1 de tesis no solo *mejora* la calibración: **la conecta por primera vez**.

**Acción tomada.** Es un argumento fuerte para la sustentación y está recogido en la pantalla "Mi referencia" del prototipo y en [MAPA_PROMPT_MAESTRO.md](MAPA_PROMPT_MAESTRO.md).

---

### 1.4 🟡 El puntaje no se calcula donde el documento sugiere

**Qué dice el prompt maestro** (§4.6): la sección sobre `services/score_service.py` da a entender que ahí vive el cálculo.

**Qué encontré.** `score_service.py` solo promedia, lleva rachas y calcula estadísticas de sesión. **La fórmula de las siete métricas vive en `ml/pose_detector.py`**, como sí dice correctamente §4.4.

**Acción tomada.** Corregido en el mapa de trazabilidad. El prototipo replica la fórmula en [`app/src/dominio/puntaje.ts`](../app/src/dominio/puntaje.ts) con la procedencia declarada en la cabecera.

---

### 1.5 🟠 `winotify` está muerto

| Librería | Versión | Último release | Último commit | Veredicto |
|---|---|---|---|---|
| **`windows-toasts`** | 1.3.1 | 2025-05-06 | 2025-11-24 | ✅ **Recomendada.** Bindings del SDK de Windows, sin `pywin32` ni PowerShell. Documentación formal. |
| `win11toast` | 0.36.3 | 2026-01-17 | 2026-01-17 | ✅ Viva. Alternativa válida si hace falta sonido desde URL. |
| `plyer` | 2.1.0 | 2022-11-12 | 2026-06-02 | 🟡 Repo vivo, PyPI congelado. En Windows su API de notificación es mínima. |
| **`winotify`** | 1.1.0 | **2022-02-07** | 2023-09-05 | 🔴 **MUERTA.** 19 issues abiertos. |
| `win10toast` | — | — | — | 🔴 **MUERTA.** Su propio README lo admite. |

⚠️ **Gotcha de empaquetado.** Para que Windows muestre el toast con el nombre y el icono de la aplicación (y no como "Python"), el ejecutable necesita un **AppUserModelID (AUMID) registrado**. Sin eso, el aviso sale anónimo o directamente no aparece en aplicaciones empaquetadas. Hay que registrarlo en el script de Inno Setup.

**[CONFIRMADO]** — PyPI JSON API y GitHub API, 2026-07-31.

---

### 1.6 🟠 APCA está fuera de WCAG 3

**Qué encontré.** El algoritmo APCA fue **retirado del borrador de WCAG 3 en 2023**; el Editor's Draft de abril de 2026 declara el algoritmo de contraste como *"por determinarse"*.

**Consecuencia.** Cualquier decisión de contraste que se justifique con APCA es indefendible ante un jurado hoy. **WCAG 2.2 AA (ratio 4.5:1 en texto normal, 3:1 en texto grande y elementos gráficos) es el único criterio citable.**

**Acción tomada.** Todo el sistema de diseño se construyó contra WCAG 2.2 AA, verificando el tema claro y el oscuro por separado. Detalle en [SISTEMA_DISENO.md](SISTEMA_DISENO.md).

---

## 2. Fundamento académico de los tres aportes

### 2.1 Baseline adaptativo — dónde está el hueco

| Trabajo | Referencia | Por qué importa |
|---|---|---|
| **A Smart System for Continuous Sitting Posture Monitoring** | Odesola et al., *Sensors* 2025, 25(18), 5610 · [PMC12473441](https://pmc.ncbi.nlm.nih.gov/articles/PMC12473441/) | **[CONFIRMADO — texto completo]** Es la mejor cita de hueco: usan metodología "user-tailored" con un solo individuo, **NO implementan calibración activa en tiempo real** y lo declaran trabajo futuro textualmente. No usan medias móviles ni umbrales adaptativos. CNN al 98,29 % de exactitud. |
| **PostureSense** | *Actuators* 2026, 15(2), 125 · [doi:10.3390/act15020125](https://doi.org/10.3390/act15020125) | Filtro EMA en firmware + auto-zeroing con 200 muestras. **[INCIERTO]** — MDPI devolvió 403; el dato viene del índice, no del PDF. |
| **Real-Time Automated Ergonomic Monitoring** | *Biomimetics* 2026, 11(2), 88 | MediaPipe Holistic, 33 landmarks, latencia 50–150 ms. Justifica por qué un sistema continuo supera a una evaluación RULA periódica. |
| **Metodología AI para evaluación ergonómica** | [IJARSCT Paper34367](https://www.ijarsct.co.in/Paper34367.pdf) | El único que combina las tres piezas: calibración dinámica + EMA + máquina de estados. **[INCIERTO]** — PDF no extraíble. Vale la pena abrirlo a mano: es casi el trabajo relacionado ideal. |

**El hallazgo que sostiene el aporte:** no encontré ningún trabajo que trate explícitamente *"el baseline con EMA se adapta hacia la mala postura"* en sistemas posturales. **Ese es el hueco.** Lo que sí existe es la literatura de **cartas de control EWMA**, de donde se toma el marco formal, y **patentes que describen el fenómeno**:

- **US RE47882 — "Adaptive alarm system"**: describe explícitamente que *"adaptive thresholds can become less responsive to baseline drift as the baseline approaches predefined parameter limits"*. Es prior art directo del problema y de la mitigación por límites duros.
- **US 9566441 — "Detecting posture sensor signal shift or drift in medical devices"**.
- **Adaptive Robust EWMA Control Chart**: usa *bounded robust score functions* — literalmente el mecanismo de acotar cuánto puede mover una observación al estimador.

### 2.2 La relación α ↔ τ, y por qué importa

```
ema_t = α · x_t + (1 − α) · ema_{t−1}

α = 1 − exp(−dt / τ)      ← forma preferible: fija τ en SEGUNDOS
τ = −dt / ln(1 − α)
```

**Punto crítico de diseño.** Si α se fija por *frame*, el comportamiento cambia con el FPS de la cámara: un portátil a 12 FPS se adapta **2,5 veces más lento** que uno a 30. En una prueba con 15–70 participantes en equipos que nadie controla, eso significa que **el mismo software se comporta distinto en cada equipo y los resultados no son comparables entre sí**.

| Propósito | τ objetivo | α @30 FPS | α @15 FPS |
|---|---|---|---|
| Suavizado del temblor del landmark | 0,2–0,5 s | ≈ 0,10–0,15 | ≈ 0,20–0,28 |
| Baseline postural adaptativo | 5–15 min | ≈ 1e−3 – 4e−4 | ≈ 2e−3 – 8e−4 |

**[INCIERTO]** — esta tabla es derivación matemática propia, no valores publicados. No citarla como "según X"; presentarla como diseño propio justificado por la relación τ↔α.

**Acción tomada.** [`baseline-adaptativo.ts`](../app/src/dominio/baseline-adaptativo.ts) deriva α de τ y del intervalo real de muestreo, con un test que lo demuestra: simula 10 segundos a 30 FPS y a 12 FPS y comprueba que el baseline llega prácticamente al mismo sitio.

### 2.3 Catálogo de mitigaciones de deriva

Presentar como **contribución de ingeniería**, no como cita:

1. **Anclaje anatómico (límite duro).** El baseline solo se mueve dentro de una banda alrededor de un óptimo ergonómico absoluto. Elimina la deriva por construcción. → **implementada (salvaguarda 3)**
2. **Actualización con compuerta.** Solo entran muestras que ya superan un piso de calidad. → **implementada (salvaguarda 1)**
3. **Congelar durante la alerta.** Si la máquina de estados está en `alerta`, el baseline no se actualiza. → **implementada (salvaguarda 2)**
4. **Recalibración explícita.** Es literalmente lo que Odesola et al. proponen como trabajo futuro y no implementan. → **implementada (reseteo manual)**
5. Score robusto acotado (Huber/winsorizing) — evaluada, no implementada.
6. Doble EMA (rápida + lenta) con histéresis como detector de deriva — evaluada, no implementada.
7. **Zona muerta + tiempo de permanencia.** → **implementada en la máquina de estados** (RF-3).

**Hallazgo propio durante la construcción.** Hay una **cuarta vía de deriva que la literatura no menciona**: no por cómo se *aprende* la referencia, sino por cómo se *usa*. Normalizar dividiendo (`métrica / referencia`) hace que, con la referencia relajada, **todo puntúe alto** — una postura mediocre de 0,82 contra una referencia de 0,72 da 100. La aplicación empieza a decir "excelente" todo el día y deja de servir. La mitigación implementada es **compensación parcial aditiva**: se acredita una fracción de la diferencia entre la referencia y el óptimo, nunca toda. Está cubierta por el test `NO convierte una mala postura en aceptable`.

### 2.4 Métricas de evaluación y referencias ergonómicas

- **Detección:** matriz de confusión → exactitud, precisión, exhaustividad, F1. Es el estándar de facto **[CONFIRMADO]**.
- **Tasa de falsos positivos:** `FPR = FP/(FP+TN)`. La literatura señala que la usabilidad de estas aplicaciones *"could be improved by accounting for false-positive cases"*.
- **Latencia extremo a extremo:** 50–150 ms como objetivo.
- **RULA** (McAtamney & Corlett, 1993) y **REBA** (Hignett & McAtamney, 2000) como referencia ergonómica. **[INCIERTO — de memoria, sin verificar con fetch]**.
- **Ángulo craneovertebral (CVA)**: métrica clínica estándar del *forward head posture*. Si la aplicación lo aproxima desde landmarks 2D, hay puente directo con la literatura clínica — argumento fuerte para la sustentación.
- **OSHA Computer Workstations eTool** **[CONFIRMADO]**: umbrales citables — codos entre 90° y 120°, borde superior de la pantalla a la altura de los ojos o por debajo, monitor a ≥ 51 cm. *"A monitor positioned too high can cause you to tilt your head back, which fatigues the neck and shoulder muscles."*
- **ISO 9241-5:2024** — filosofía explícita: **el diseño debe fomentar el movimiento del usuario**. Argumento directo a favor de los recordatorios de pausa.

Métricas de adherencia que conviene instrumentar (hay poca evidencia dura publicada, y eso también es un hueco): tasa de descarte de avisos, tiempo hasta corrección tras alerta, sesiones por día, días activos, tiempo en buena postura sobre tiempo total.

### 2.5 Metodología de benchmark con `psutil`

**Versión actual: `psutil 7.2.2`, publicada 2026-01-28** **[CONFIRMADO — PyPI]**.

⚠️ **Trampa detectada.** La documentación de <https://psutil.io/api/> es la de **desarrollo (8.0.0)** y menciona que `memory_full_info()` está deprecado a favor de `memory_footprint()`. Pero **8.0.0 no está publicado en PyPI**. **Escribir la tesis contra `memory_full_info()`** y mencionar `memory_footprint()` solo como nota al pie.

**Errores que invalidan una medición — checklist para el capítulo de metodología:**

1. **Reportar la primera lectura.** Devuelve `0.0` sin significado. Descartarla siempre.
2. **`interval=None` con llamadas demasiado juntas.** Los docs piden ≥ 0,1 s entre invocaciones.
3. **No normalizar por núcleos.** Un proceso multihilo puede dar 380 % en una máquina de 4 núcleos. Sin dividir por `cpu_count()`, las cifras no son comparables entre equipos — fatal en una tesis que mide en varias máquinas.
4. **Confundir `psutil.cpu_percent()` (sistema) con `Process.cpu_percent()` (proceso).**
5. **Olvidar los procesos hijos.** OpenCV y MediaPipe generan workers. Sumar `p.children(recursive=True)`.
6. **Sin calentamiento.** Los primeros segundos incluyen el import de numpy/OpenCV, la carga del modelo y la inicialización de la cámara. Descartar 10–30 s.
7. **Usar RSS como si fuera consumo real.** RSS incluye memoria compartida y sobrecuenta. **USS** es lo que realmente se liberaría. Contrapartida documentada: recorrer el espacio de direcciones es *considerablemente más lento* → RSS a alta frecuencia, USS cada 5–10 s.
8. **No fijar la carga.** Reportar CPU % **junto con FPS efectivo**, o normalizar a ms de CPU por frame.
9. **Medir con el intérprete y no con el `.exe` empaquetado.** Medir ambos y reportarlos por separado.
10. **Medir en portátil con batería.** Windows hace throttling. Fijar plan de energía "Alto rendimiento" y **declararlo en la metodología**.

Este checklist está implementado como texto visible en la pantalla de benchmark del prototipo, y las corridas de ejemplo respetan el calentamiento descartado.

---

## 3. Empaquetado para Windows

### 3.1 Versiones actuales **[CONFIRMADO — PyPI/GitHub API, 2026-07-31]**

| Paquete | Versión | Publicada | Nota |
|---|---|---|---|
| PyInstaller | **6.21.0** | 2026-06-13 | `requires_python >=3.8,<3.16` |
| pyinstaller-hooks-contrib | 2026.6 | — | 682 hooks estándar |
| MediaPipe | **1.0.0** | 2026-07-27 | ⚠️ salió cuatro días antes de esta investigación |
| opencv-python | 5.0.0.93 | 2026-07-02 | ⚠️ salto de major |
| PyQt6 | 6.11.0 | 2026-03-30 | `requires_python >=3.10` |
| Inno Setup | **7.0.2** | 2026-07-13 | Proyecto muy vivo |

**Recomendación:** fijar `mediapipe==0.10.35` (28-abr-2026) o inferior para la tesis. Un salto de major el mes de la entrega es riesgo puro. Igual con `opencv-python`: fijar la última 4.x salvo que el código esté probado contra 5.x.

### 3.2 🔴 No existe hook de PyInstaller para MediaPipe

Recorrí el árbol completo de `pyinstaller-hooks-contrib@master` vía la GitHub Trees API. De **682 hooks**:

```
✅ stdhooks/hook-cv2.py           ← existe
✅ stdhooks/hook-tensorflow.py    ← existe
❌ hook-mediapipe.py              ← NO EXISTE
```

**Consecuencia.** OpenCV se empaqueta solo; **MediaPipe no**. Los `.tflite` y `.binarypb` hay que declararlos a mano.

**El error exacto** — issue [google-ai-edge/mediapipe#5238](https://github.com/google-ai-edge/mediapipe/issues/5238), abierto el 19-mar-2024 y **aún sin resolver**, reportado por alguien con exactamente este stack (PyQt6 + MediaPipe + PyInstaller en Windows):

```
FileNotFoundError: The path does not exist.
  File "mediapipe\python\solution_base.py", line 264
```

**Solución recomendada** (en el `.spec`, que es reproducible y documentable como anexo de tesis):

```python
# Habitusitos.spec
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs

mp_datas = collect_data_files('mediapipe', includes=['**/*.tflite', '**/*.binarypb', '**/*.txt'])
mp_bins  = collect_dynamic_libs('mediapipe')

a = Analysis(
    ['main.py'],
    datas=mp_datas + [('assets', 'assets')],
    binaries=mp_bins,
    hiddenimports=['mediapipe'],
    excludes=['tkinter', 'matplotlib', 'PySide6', 'PyQt5', 'PySide2'],
)
```

⚠️ **Un solo binding de Qt.** PyInstaller **aborta la compilación** si detecta hooks de más de un binding Qt en el mismo build. De ahí el `excludes`.

### 3.3 Tamaño y antivirus

Tamaños reales de wheel en Windows **[CONFIRMADO — PyPI]**: `mediapipe` 16,1 MB · `opencv-python` 44,0 MB · `pyqt6` 6,8 MB. **[ESTIMADO]** con numpy, runtime de Python y DLLs de Qt: carpeta `--onedir` de **300–450 MB**, instalador Inno Setup con LZMA2 de **110–180 MB**.

**Falsos positivos de antivirus — mitigaciones en orden de efectividad:**

1. **Usar `--onedir`, no `--onefile`.** `--onefile` genera un ejecutable autoextraíble que descomprime a `%TEMP%` y ejecuta el intérprete extraído — *"the textbook definition of a malware dropper"*. Es la mitigación número uno y es gratis. Con Inno Setup el usuario final no nota la diferencia.
2. **Firmar el código.** Reduce drásticamente los falsos positivos. Un certificado EV da reputación SmartScreen inmediata. Coste real, probablemente fuera del presupuesto de un trabajo de grado — **decirlo así en el capítulo de limitaciones**.
3. **Recompilar el bootloader de PyInstaller desde fuente.** Cambia el hash y suele limpiar la detección.
4. **Reportar el falso positivo** a los fabricantes.
5. **Verificar en VirusTotal antes de entregar** y adjuntar el reporte como anexo. Excelente detalle metodológico.
6. **No usar UPX** (`--noupx`). Dispara heurísticas y rompe algunas DLL de Qt.

### 3.4 Instalador: veredicto

| Opción | Veredicto |
|---|---|
| **Inno Setup 7.0.2** | ✅ **Recomendado.** Gratis, `.iss` declarativo y legible (perfecto como anexo), LZMA2, accesos directos, desinstalador, asistente familiar. ⚠️ 7.x **falla con error** si el `.iss` tiene bytes inválidos para su code page — relevante con acentos en español. |
| NSIS | Igual de capaz, más verboso. Sin ventaja aquí. |
| MSIX | ❌ Exige firma de código obligatoria y corre en contenedor con virtualización de sistema de archivos — fricción real con el acceso a webcam. Descartar. |
| `briefcase` (BeeWare) | ❌ Genera MSI vía WiX y no tiene soporte probado para los data files de MediaPipe. Añade una variable desconocida sin resolver ningún problema. |

**Veredicto: PyInstaller `--onedir` → Inno Setup 7.0.2.**

---

## 4. Stack del prototipo — versiones verificadas

**[CONFIRMADO — `npm view <pkg> version`, 2026-07-31]**

| Paquete | Versión | | Paquete | Versión |
|---|---|---|---|---|
| react / react-dom | 19.2.8 | | tailwindcss | 4.3.3 |
| vite | 8.2.0 | | @tailwindcss/vite | 4.3.3 |
| typescript | 7.0.2 | | shadcn (CLI) | 4.16.1 |
| zustand | 5.0.14 | | recharts | 3.10.1 |
| react-router | 8.3.0 | | lucide-react | 1.28.0 |
| @mediapipe/tasks-vision | 1.0.0 | | date-fns | 4.4.0 |

### Gotchas que hay que conocer antes de escribir una línea

1. **`react-router-dom` está muerto en la práctica.** `react-router` va en 8.3.0 mientras `react-router-dom` sigue clavado en 7.18.2. Desde v7 todo se importa desde `react-router` a secas. El 90 % de los tutoriales están desactualizados en esto.
2. **`@tailwindcss/vite` ≠ PostCSS.** No instalar `postcss`, `autoprefixer` ni `@tailwindcss/postcss` a la vez.
3. **`@tailwind base/components/utilities` ya no existe.** Es una sola línea: `@import "tailwindcss";`. Cualquier tutorial con las tres directivas es de v3.
4. **`tailwind.config.js` se ignora por defecto** en v4. Los tokens van en `@theme` dentro del CSS.
5. **`tailwindcss` y `@tailwindcss/vite` deben ir en lockstep.** Si divergen, fallos raros de build.
6. **`lucide-react` llegó a 1.x** (antes iba en 0.5xx) y **eliminó los iconos de marca**: `Github` ya no existe. Cualquier guía que diga `lucide-react@^0.4xx` es vieja.
7. **TypeScript 7 es la reescritura en Go.** Es el `latest`, pero si algún plugin revienta, bajar a `^5` sin dramas.
8. **`data-horizontal:` no es lo mismo que `data-[orientation=horizontal]:`** en las primitivas de Base UI. Las clases que shadcn genera para Tabs asumen lo primero y en la práctica hace falta lo segundo. *(Encontrado durante la construcción — las pestañas salían en vertical.)*

### Arquitectura frontend citable

- **[bulletproof-react](https://github.com/alan2207/bulletproof-react)** (35.625 ★). Regla unidireccional `shared → features → app`, **verificable automáticamente** con `import/no-restricted-paths` de ESLint. Es la decisión de implementación de este proyecto.
- **[Feature-Sliced Design](https://feature-sliced.design/)**. Más riguroso, pero su vocabulario (layers/slices/segments, `entities` vs `features`) cuesta media hora de sustentación explicarlo. ⚠️ La capa `processes` está **deprecada** en FSD 2.x: no citarla.
- **Screaming Architecture** (Robert C. Martin, 2011). *"Your architectures should tell readers about the system, not about the frameworks you used."* Un `src/` con `components/ hooks/ utils/` grita "app de React"; uno con `dominio/ camara/ funcionalidades/` grita lo que el negocio hace.

**Recomendación para la tesis:** citar FSD y Screaming Architecture como **marco teórico**, y bulletproof-react como **decisión de implementación**. Eso demuestra que se evaluaron alternativas.

---

## 5. APIs públicas sin registro — verificación real

Todas probadas con petición real el **2026-07-31**.

### ✅ Vivas y sin clave

| API | Resultado |
|---|---|
| **Nager.Date — festivos Colombia** | HTTP 200 · `[{"date":"2026-01-01","localName":"Año Nuevo",...}]` |
| Nager.Date — puentes | HTTP 200 · devuelve `needBridgeDay` y `bridgeDays` 🎯 |
| Lorem Picsum (con seed) | HTTP 200 · imagen determinista por seed |
| DiceBear 9.x y 10.x | HTTP 200 · SVG y PNG |
| placehold.co | HTTP 200 |
| Open-Meteo (forecast y archive) | HTTP 200 |
| Iconify (SVG, search, collections) | HTTP 200 · Lucide: 1.756 iconos, licencia ISC |
| QRServer | HTTP 200 |
| ZenQuotes · DummyJSON Quotes · Advice Slip | HTTP 200 |

### 🔴 Muertas

| API | Resultado |
|---|---|
| `api.quotable.io` | **HTTP 000** (fallo de DNS/conexión). **MUERTA.** |
| `api.realinspire.live` | **HTTP 000**. **MUERTA.** |
| QuoteSlate | HTTP 429 · devuelve el checkpoint de seguridad de Vercel, no JSON. |

### 🟡 Con limitación crítica

**Frankfurter** vive en `api.frankfurter.app`, pero **el peso colombiano (COP) NO está** en su lista de divisas (usa el set del BCE). Y `api.frankfurter.dev`, el dominio que circula en tutoriales, **devuelve 404**.

**Decisión tomada.** El prototipo usa **una sola API**: Nager.Date para marcar festivos colombianos en el calendario de constancia, **con tabla de respaldo local**. Lo que le pasó a `quotable.io` es exactamente lo que no puede pasar el día de la sustentación.

> ⚠️ **Esto es exclusivo del prototipo.** El software real **no hace ninguna llamada de red**: es una promesa de producto del §8.4 hacia los participantes, no una preferencia técnica.

---

## 6. Hallazgos encontrados durante la construcción

No venían de la búsqueda web sino de construir y probar el prototipo. Se registran porque afectan al software real.

| # | Hallazgo | Acción |
|---|---|---|
| 1 | **La dirección de los vectores del §4.4 está invertida.** El texto describe el ángulo entre *(orejas → hombros)* y `[0,-1,0]`; esos vectores apuntan hacia abajo en una persona sentada derecha, así que el ángulo daría 180° justo cuando la postura es perfecta. La dirección correcta es *hombros → orejas* y *caderas → hombros*. | Implementada la versión correcta, con la discrepancia documentada en el código. **Verificar contra `pose_detector.py` en la Fase 1.** |
| 2 | **Usar `\|dx\|` como ancho de hombros acopla dos métricas.** El desnivel de hombros contamina la métrica de giro de cabeza. La distancia 2D es invariante ante rotación y aísla correctamente. | Corregido, con test que lo blinda (`aisla cada desviacion en su propia metrica`). |
| 3 | **Mostrar el puntaje crudo incumple el criterio de aceptación del RF-3.** A 5 muestras/s el número salta varios puntos por tick. El propio prompt maestro exige *"un score estable, sin saltos erráticos frame a frame"*. | Suavizado exponencial (τ = 4 s) sobre las métricas, no sobre el puntaje, para que el desglose siga sumando exactamente el total. Medido: salto máximo entre ticks = 1 punto. |
| 4 | **La normalización por división reintroduce la deriva.** Ver §2.3. | Compensación parcial aditiva + test. |

---

## Fuentes

- [MediaPipe Solutions guide (deprecación legacy)](https://ai.google.dev/edge/mediapipe/solutions/guide) · [Issue #5238 PyInstaller](https://github.com/google-ai-edge/mediapipe/issues/5238) · [Issue #6192 wheels](https://github.com/google-ai-edge/mediapipe/issues/6192)
- [Sensors 2025, 25(18), 5610 — Odesola et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC12473441/) · [Actuators 2026, 15(2), 125](https://doi.org/10.3390/act15020125) · [Biomimetics 2026, 11(2), 88](https://www.mdpi.com/2313-7673/11/2/88)
- [US Patent RE47882](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/RE47882) · [US Patent 9566441](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9566441)
- [psutil docs](https://psutil.io/) · [psutil API](https://psutil.io/api/) · [changelog](https://psutil.io/changelog/)
- [OSHA Computer Workstations — Good Working Positions](https://www.osha.gov/etools/computer-workstations/positions) · [Monitors](https://www.osha.gov/etools/computer-workstations/components/monitors) · [ISO 9241-5:2024](https://www.iso.org/obp/ui/en/#!iso:std:86222:en)
- [PyInstaller changelog](https://pyinstaller.org/en/latest/CHANGES.html) · [Antivirus false positives](https://www.pythonguis.com/faq/problems-with-antivirus-software-and-pyinstaller/) · [Inno Setup 7 revision history](https://jrsoftware.org/files/is7-whatsnew.htm)
- [Windows-Toasts](https://github.com/DatGuy1/Windows-Toasts) · [documentación](https://windows-toasts.readthedocs.io/)
- [Tailwind CSS con Vite](https://tailwindcss.com/docs/installation/using-vite) · [shadcn/ui Vite](https://ui.shadcn.com/docs/installation/vite) · [Vite 8](https://vite.dev/blog/announcing-vite8)
- [bulletproof-react — estructura](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) · [Feature-Sliced Design](https://feature-sliced.design/docs/get-started/overview) · [Screaming Architecture en React](https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25)
