# De prototipo a producto — guía para quien lo va a construir

| Campo | Detalle |
|---|---|
| Destinatario | La persona que implementará Habitusitos en Python + PyQt6 |
| Qué responde | Qué de este repositorio se traduce, qué se tira, y en qué orden atacar |
| Antes de empezar | Leer [INVESTIGACION_2026.md §1](INVESTIGACION_2026.md) — hay cuatro contradicciones con el prompt maestro que cambian decisiones |

---

## 0. Lo primero, porque ahorra días

1. **El repositorio base fue renombrado y su historial borrado el 2026-07-28.** Conserva 3 commits y cero releases. Cualquier referencia a un commit anterior apunta a algo que ya no existe. La estructura de directorios del §4.2 sí sigue siendo válida.
2. **`mediapipe.solutions` no existe en los wheels ≥ 0.10.31.** El pin `0.10.21` del proyecto original es un techo permanente. Hay que migrar a `mediapipe.tasks.python.vision.PoseLandmarker`.
3. **No hay hook de PyInstaller para MediaPipe.** Verificado sobre los 682 hooks existentes. El `.spec` se escribe a mano. Presupuestar tiempo real: es el mayor riesgo del empaquetado.
4. **`winotify` está muerto.** Usar `windows-toasts` y registrar un AUMID, o los avisos salen como "Python".

---

## 1. Qué se traduce y qué se tira

| Del prototipo | Destino en el producto |
|---|---|
| `dominio/puntaje.ts` | → `ml/pose_detector.py` — **ya existe**, verificar contra él |
| `dominio/baseline-adaptativo.ts` | → **`services/adaptive_baseline_service.py`** (módulo nuevo) |
| `dominio/maquina-estado.ts` | → `services/notification_service.py` |
| `dominio/estadisticas.ts` | → `services/score_service.py` — ya existe |
| `dominio/tipos.ts` | → esquema SQLite en `data/database.py` |
| `datos/api/*.ts` | → consultas a SQLite. Cada función lleva su consulta en la cabecera |
| `camara/detector-pose.ts` | → `PoseLandmarker` de la Tasks API |
| `funcionalidades/*/pantalla.tsx` | → widgets de PyQt6. **No se reutiliza el código**, sí el diseño y el copy |
| `datos/fixtures/`, `datos/almacen.ts`, `estado/` | **Se tiran** |

> **La capa `dominio/` no importa nada** — ni React, ni la configuración, ni el store. Está escrita así precisamente para poder traducirse línea por línea. Es la parte más valiosa de este repositorio.

---

## 2. Mapa pantalla → widget

| Ruta del prototipo | Widget del producto | Notas |
|---|---|---|
| `/bienvenida` | `ui/onboarding.py` | Ya existe. ⚠️ Hoy guarda `baseline_*` pero el detector no lo usa: **cerrar esa brecha es parte del aporte 1** |
| `/` Panel de hoy | `ui/dashboard.py` | Ya existe. Añadir el desglose de las siete métricas y la frase en lenguaje natural |
| `/historial` | Pestaña nueva en `dashboard.py` | Aporte 3. Mapa de calor, día de semana, tendencia |
| `/baseline` | Pestaña nueva | Aporte 1. La gráfica de evidencia es lo que se defiende ante el jurado |
| `/benchmark` | **Comando aparte, no en el menú** | El §11.2 lo dice: es herramienta de desarrollo, los participantes no deben verlo |
| `/ajustes` | `ui/settings_dialog.py` | Ya existe. Las seis secciones espejan las del `SettingsService` |
| `/ayuda` | Diálogo de ayuda + `TROUBLESHOOTING.md` | Los 9 errores con su copy ya redactado |
| `/demo` | **No se implementa** | Solo del prototipo |
| `/acerca-de` | Diálogo "Acerca de" | **Obligatorio por AGPL**: es donde se ofrece el acceso al código fuente |
| Franja de bandeja | `ui/tray.py` + `ui/score_icon.py` | Ya existen. ⚠️ El icono debe cambiar **de forma**, no solo de color |

---

## 3. Traducir el dominio: lo que no se puede perder

### 3.1 Puntaje — dos correcciones sobre el documento

**Dirección de los vectores.** El §4.4 describe el ángulo entre *(orejas → hombros)* y `[0,-1,0]`. Esos vectores apuntan hacia abajo en una persona sentada derecha, así que el ángulo daría **180° justo cuando la postura es perfecta**. La dirección correcta es **hombros → orejas** y **caderas → hombros**.

> Verificar contra `pose_detector.py` en la Fase 1: o el documento invirtió la dirección al redactarse, o el código tiene el signo cambiado. Si es lo segundo, es un bug real del proyecto original.

**Escala de referencia.** La distancia entre hombros y entre orejas se calcula como **distancia 2D**, no como extensión horizontal `|dx|`. Una distancia es invariante ante rotación: ladear la cabeza o los hombros no la cambia, y solo la cambia el giro sobre el eje vertical, que es lo que la métrica quiere detectar. Con `|dx|`, el desnivel de hombros contamina la métrica de giro de cabeza. Hay un test que lo blinda.

### 3.2 Baseline adaptativo — el orden importa

```python
# 1. Congelado en alerta. PRIMERO: si el sistema ya está avisando, ninguna
#    muestra debe mover la referencia, ni siquiera una que pase el piso.
if estado_fsm == "alerta":
    return sin_cambio("estado-de-alerta")

# 2. Compuerta de calidad.
if puntaje < piso_calidad:
    return sin_cambio("calidad-insuficiente")

# 3. EMA con alpha derivado de tau en SEGUNDOS.
alpha = 1 - math.exp(-dt / tau_segundos)
propuesto = alpha * muestra + (1 - alpha) * anterior

# 4. Ancla dura alrededor del óptimo ergonómico.
valor = clamp(propuesto, optimo - deriva_max, optimo + deriva_max)
```

**Tres cosas que no se pueden cambiar sin romper el aporte:**

1. **α se deriva de τ en segundos**, nunca al revés. Con α por frame, un portátil a 12 FPS se adapta 2,5 veces más lento que uno a 30 — el mismo software se comportaría distinto en cada equipo de la prueba y los resultados no serían comparables.
2. **El congelado en alerta va antes que la compuerta de calidad.** Es lo que impide que la mala postura sostenida se autonormalice.
3. **Cada muestra se registra con su veredicto** (`accepted` + motivo). Esa serie **es** la evidencia del capítulo de resultados. Sin ella no hay nada que graficar.

### 3.3 La cuarta vía de deriva

No está en el prompt maestro porque se descubrió construyendo esto.

Normalizar dividiendo (`métrica / referencia`) parece lo natural: una postura igual a la referencia puntúa 1,0. **Está mal.** Con la referencia relajada, todo puntúa alto: una postura mediocre de 0,82 contra una referencia de 0,72 da 100, y la aplicación empieza a decir "excelente" todo el día. Y amplifica también la mala postura: 0,50 / 0,72 = 0,69, un encorvamiento claro disfrazado de aceptable.

La solución implementada es **compensación parcial aditiva**:

```python
ajustada = clamp(metrica + factor * max(0, optimo - referencia), 0, 1)
```

Se acredita **una fracción** de la diferencia, nunca toda. Reconoce que no todo el mundo puede sentarse como un maniquí, pero conserva el significado absoluto de la escala. El factor (0,6) es una decisión de diseño que hay que recalibrar con datos reales.

Test que lo blinda: `NO convierte una mala postura en aceptable`.

### 3.4 Suavizado: obligatorio, no cosmético

El criterio de aceptación del RF-1 exige *"un score estable, sin saltos erráticos frame a frame"*. Mostrar el valor crudo lo incumple.

**Suavizar las métricas, no el puntaje.** Suavizar el puntaje por separado desincroniza el desglose: las siete barras dejan de sumar el número grande, que es justo lo que un jurado va a verificar. El valor crudo se conserva aparte para el historial, donde la variabilidad es información.

---

## 4. Orden de ataque sugerido

| # | Qué | Por qué en este orden |
|---|---|---|
| 1 | Confirmar el análisis del código base | El repositorio cambió. Sin esto se trabaja a ciegas |
| 2 | **Migrar a la Tasks API de MediaPipe** | Bloquea todo lo demás y desbloquea el empaquetado |
| 3 | Portar `dominio/` a Python con sus tests | Es traducción directa. Los tests son el contrato: si pasan, la lógica es la misma |
| 4 | Conectar la calibración al scoring | Cierra la brecha del §1.3. Prerrequisito del aporte 1 |
| 5 | `adaptive_baseline_service.py` + tablas nuevas | Aporte 1 |
| 6 | `benchmark_service.py` con psutil | Aporte 2. **Medir de verdad**, respetando el checklist |
| 7 | Vistas de analítica sobre el dashboard | Aporte 3. El diseño y el copy ya están |
| 8 | PyInstaller `--onedir` + Inno Setup | Aporte 4 (empaquetado). Presupuestar tiempo para el `.spec` |
| 9 | Prueba con usuarios | Los documentos ya están generados |

---

## 5. Al empaquetar

```python
# Habitusitos.spec
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs

mp_datas = collect_data_files('mediapipe', includes=['**/*.task', '**/*.tflite', '**/*.binarypb'])
mp_bins  = collect_dynamic_libs('mediapipe')

a = Analysis(
    ['main.py'],
    datas=mp_datas + [('assets', 'assets')],
    binaries=mp_bins,
    hiddenimports=['mediapipe'],
    # PyInstaller ABORTA si detecta hooks de más de un binding de Qt.
    excludes=['tkinter', 'matplotlib', 'PySide6', 'PyQt5', 'PySide2'],
)
```

| Regla | Por qué |
|---|---|
| **`--onedir`, nunca `--onefile`** | `--onefile` se autoextrae a `%TEMP%` y ejecuta el intérprete extraído: es la definición de libro de un *malware dropper*. Con Inno Setup el usuario no nota la diferencia |
| **`--noupx`** | UPX dispara heurísticas de antivirus y rompe algunas DLL de Qt |
| **Fijar versiones** | `mediapipe<=0.10.35`, `opencv-python` en la última 4.x. Un salto de major el mes de la entrega es riesgo puro |
| **Verificar en VirusTotal antes de entregar** | Y adjuntar el reporte como anexo: es un buen detalle metodológico |
| **Registrar el AUMID en el `.iss`** | Sin eso los avisos salen como "Python" |
| **Cuidado con los acentos en el `.iss`** | Inno Setup 7 **falla con error** si el archivo tiene bytes inválidos para su code page |

Tamaño esperado: carpeta de 300–450 MB, instalador comprimido de 110–180 MB.

**La firma de código** reduce drásticamente los falsos positivos, pero cuesta dinero. Si no hay presupuesto, **decirlo en el capítulo de limitaciones** en vez de omitirlo.

---

## 6. Lo que NO se debe copiar del prototipo

| Qué | Por qué |
|---|---|
| Cualquier llamada de red | El §8.4 promete que el software no habla con ningún servidor. La consulta de festivos es exclusiva del prototipo |
| Las cifras del benchmark | Son plausibles, no medidas. **No pueden citarse en la tesis** |
| El almacén en localStorage | Lo reemplaza SQLite en modo WAL |
| La latencia artificial | Existe para que la demostración se sienta real |
| Los umbrales de las siete métricas | Punto de partida razonado. El §8.2 exige fijarlos con datos reales |

---

## 7. Antes de decir "listo"

- [ ] Los tests portados de `dominio/` pasan en Python
- [ ] Una racha larga de mala postura **no mueve** la referencia (revertir la compuerta debe poner el test en rojo)
- [ ] El puntaje mostrado no salta más de ~1 punto entre muestras consecutivas
- [ ] Los nueve escenarios de error terminan en una acción, ninguno en una traza de Python
- [ ] El vídeo no se persiste en ninguna configuración — auditable con una búsqueda en el código
- [ ] El icono de bandeja cambia **de forma**, no solo de color
- [ ] `NOTICE.md` actualizado con las modificaciones respecto al proyecto original
- [ ] El instalador enlaza al código fuente (obligación de la AGPL-3.0)
- [ ] Instala y corre en un equipo Windows limpio, sin Python
- [ ] Una persona no técnica completa instalación y calibración **sin ayuda**
