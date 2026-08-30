# Mapa del prompt maestro → prototipo

| Campo | Detalle |
|---|---|
| Documento | Tabla de trazabilidad entre [PROMPT_MAESTRO_HABITUSITOS.md](../PROMPT_MAESTRO_HABITUSITOS.md) y el código |
| Para qué sirve | Verificar cobertura sin releer 54 KB de prosa, y saber dónde está implementado cada requisito |
| Estado de la leyenda | 🟢 **real** (lógica implementada de verdad) · 🔵 **simulado** (visualmente completo, datos de ejemplo) · ⚪ **fuera de alcance** (corresponde al software final) |

---

## Requisitos funcionales

| RF | Requisito | Estado en el original | Cobertura en el prototipo | Dónde |
|---|---|---|---|---|
| **RF-1** | Detección de postura en tiempo real | Heredado | 🟢 **real** — las siete métricas del §4.4 implementadas y con tests; funciona con webcam real vía MediaPipe | [`dominio/puntaje.ts`](../app/src/dominio/puntaje.ts) · [`camara/detector-pose.ts`](../app/src/camara/detector-pose.ts) · pantalla `/` |
| **RF-2** | Silencio ante buena postura | Heredado | 🟢 **real** — la máquina de estados no emite nada por encima del umbral | [`dominio/maquina-estado.ts`](../app/src/dominio/maquina-estado.ts) |
| **RF-3** | Alerta solo ante mala postura sostenida | Heredado, validar | 🟢 **real** — estado `vigilando` intermedio + enfriamiento. Cubierto por el test *"un movimiento brusco de menos de 2 segundos NO dispara notificación"* | `maquina-estado.ts` · escenario E2 de `/demo` |
| **RF-4** | Notificaciones nativas de Windows | Heredado, confirmar | 🔵 **simulado** — toast representado en la interfaz. La implementación real requiere `windows-toasts` + AUMID registrado | [`componentes/layout/franja-bandeja.tsx`](../app/src/componentes/layout/franja-bandeja.tsx) · [INVESTIGACION_2026.md §1.5](INVESTIGACION_2026.md) |
| **RF-5** | Ejecución en segundo plano desde bandeja | Heredado | 🔵 **simulado** — franja superior con icono de estado y menú | `franja-bandeja.tsx` |
| **RF-6** | Calibración personalizada inicial | Heredado | 🔵 **simulado** — asistente de 5 pasos con cuenta regresiva de 6 s. ⚠️ **Ver hallazgo:** en el original la calibración se guarda pero no alimenta el scoring | pantalla `/bienvenida` · [INVESTIGACION_2026.md §1.3](INVESTIGACION_2026.md) |
| **RF-7** | **Personalización adaptativa del baseline** | **Nuevo — tesis** | 🟢 **real** — EMA con τ en segundos + tres salvaguardas anti-deriva, con tests que las blindan | [`dominio/baseline-adaptativo.ts`](../app/src/dominio/baseline-adaptativo.ts) · pantalla `/baseline` |
| **RF-8** | Registro histórico local (SQLite) | Heredado | 🔵 **simulado** — 98 días de historial + esquema espejado en tipos. Opt-in respetado | [`dominio/tipos.ts`](../app/src/dominio/tipos.ts) · [`datos/fixtures/historial.ts`](../app/src/datos/fixtures/historial.ts) |
| **RF-9** | Dashboard de analítica | Heredado + extender | 🟢/🔵 — sparkline, racha, promedio, mín/máx y declive son cálculo real sobre las muestras; el historial de 98 días es simulado | pantallas `/` y `/historial` |
| **RF-10** | **Modo benchmark de recursos** | **Nuevo — tesis** | 🔵 **simulado, y declarado como tal** — formato del entregable y metodología completos; las cifras NO son medidas y la pantalla lo dice con un aviso que no se puede cerrar | pantalla `/benchmark` |
| **RF-11** | Empaquetado como instalador Windows | Nuevo | ⚪ **fuera de alcance** — corresponde al software final. La investigación de riesgos está hecha | [INVESTIGACION_2026.md §3](INVESTIGACION_2026.md) |

---

## Requisitos no funcionales

| RNF | Requisito | Cobertura | Dónde |
|---|---|---|---|
| §8.1 | Windows 10/11 exclusivo | ⚪ El prototipo es web por decisión acordada; el mapeo a PyQt6 está documentado | [DE_MOCK_A_REAL.md](DE_MOCK_A_REAL.md) |
| §8.2 | Consumo de recursos medible | 🔵 Metodología completa y visible; objetivo numérico pendiente de datos reales, como exige el propio documento | `/benchmark` |
| §8.3 | Estabilidad ante hardware no controlado | 🟢 Los 9 escenarios de la matriz de errores implementados con acción sugerida; degradación con gracia en cámara y persistencia | `/ayuda` · [`datos/cliente.ts`](../app/src/datos/cliente.ts) |
| §8.4 | **Privacidad no negociable** | 🟢 El vídeo se pinta y se descarta, nunca se persiste. Comunicado en el onboarding, en el panel y en `/acerca-de`. Una sola llamada de red, declarada y con respaldo local | `vista-camara.tsx` · `/bienvenida` paso 2 |
| §8.5 | Usabilidad y accesibilidad | 🟢 Español (Colombia), errores accionables sin jerga, **estado en tres canales redundantes** (color + forma + texto) | [SISTEMA_DISENO.md](SISTEMA_DISENO.md) |

---

## Matriz de manejo de errores (§10)

Los nueve escenarios están implementados con título en lenguaje llano, explicación sin jerga y **una acción concreta**. Galería navegable en `/ayuda`, catálogo en [`datos/cliente.ts`](../app/src/datos/cliente.ts).

| Escenario del §10 | Cubierto | Comportamiento |
|---|---|---|
| No hay cámara al iniciar | 🟢 | Mensaje + reintentar + selección de otra cámara en el onboarding |
| Cámara desconectada o bloqueada a mitad | 🟢 | El hook escucha el evento `ended` del track: sin eso la interfaz se quedaría congelada mostrando el último frame |
| Hardware más lento de lo esperado | 🔵 | Degradación a 640×480 comunicada como decisión, no como fallo |
| Iluminación deficiente | 🔵 | Aviso + límite conocido documentado en vez de ocultado |
| Falla la escritura a SQLite | 🟢 | `escribir()` nunca lanza; marca degradación, avisa **una vez** y sigue |
| Falla la exportación | 🔵 | Mensaje con sugerencia; los datos en memoria no se pierden |
| Suspensión del equipo durante tracking | 🟢 | `resumirSesion` descarta saltos > 5 s entre muestras. Cubierto por test |
| Sin detección (persona ausente) | 🟢 | Pausa automática que **no rompe la racha ni ensucia estadísticas** |
| Múltiples instancias | ⚪ | Corresponde al software final |

---

## Diferenciadores de tesis (§11)

### 11.1 Personalización adaptativa — 🟢 implementado

| Elemento exigido | Estado |
|---|---|
| Fórmula EMA sobre métricas geométricas, no solo sobre el score final | ✅ Sobre las siete métricas |
| α configurable y justificado | ✅ **α se deriva de τ en segundos**, no al revés. Con α por frame, un portátil a 12 FPS se adaptaría 2,5× más lento que uno a 30 |
| Salvaguarda anti-deriva | ✅ **Tres**: compuerta de calidad · congelado en alerta · límite duro alrededor del óptimo ergonómico |
| Reseteo manual del usuario | ✅ Con confirmación explícita |
| Registro de la evolución para evidencia | ✅ Tabla `adaptive_baseline_history` espejada, con el motivo del rechazo añadido |
| Persistencia definida | ✅ Esquema en `tipos.ts` |

**Añadido no previsto en el documento:** se detectó una **cuarta vía de deriva** —no por cómo se aprende la referencia, sino por cómo se usa— y se mitigó con compensación parcial aditiva. Ver [INVESTIGACION_2026.md §2.3](INVESTIGACION_2026.md).

### 11.2 Optimización medible — 🔵 formato completo, cifras simuladas

| Elemento exigido | Estado |
|---|---|
| Modo instrumentado con muestreo regular | ✅ Formato y series completos |
| CPU, RAM, FPS efectivo, tasa de detección | ✅ Las cuatro |
| Exportación a CSV con metadatos de configuración | ✅ Con equipo, plan de energía y calentamiento declarados |
| Dos configuraciones comparables (antes/después) | ✅ |
| Metodología correcta | ✅ Calentamiento descartado y **visible sombreado en la gráfica**; los 10 errores que invalidan una medición documentados |

> ⚠️ Las cifras son de ejemplo y **no pueden citarse en el documento de tesis**. La pantalla lo declara con un aviso permanente.

### 11.3 Analítica ampliada — 🟢 tres de cuatro, con la cuarta justificada

| Vista propuesta | Decisión |
|---|---|
| Comparación entre días de la semana | ✅ Implementada — es la única que produce una acción concreta ("los viernes empeoro") |
| Vista de tendencia / mapa de calor | ✅ Implementada — el progreso a mediano plazo es lo que sostiene la adherencia |
| Exportación ampliada | ✅ Implementada, con neutralización de inyección de fórmulas en CSV |
| Indicador de declive intra-sesión | ✅ Implementado, **pero en el panel de hoy y no en el historial**: es un dato de la sesión en curso |

El §11.3 pedía explícitamente *no implementar todas por inercia*. Las cuatro resultaron justificables; lo que se movió fue **dónde** vive cada una.

---

## Fases de desarrollo (§14)

| Fase | Estado |
|---|---|
| 1 — Análisis del código base | ⚪ Pendiente del software real. ⚠️ **Rehacer entero**: el repositorio fue renombrado y su historial borrado el 2026-07-28 |
| 2 — Preparación del entorno | ⚪ Pendiente |
| 3 — Personalización adaptativa | 🟢 **Diseño técnico completo y validable** en `baseline-adaptativo.ts` + `/baseline`. La implementación en Python es traducción directa |
| 4 — Optimización y benchmark | 🔵 Formato del entregable y metodología listos; falta medir |
| 5 — Ampliación de analítica | 🟢 **Propuesta implementada y navegable** — se puede validar viéndola, no describiéndola |
| 6 — Empaquetado | ⚪ Riesgos investigados: no hay hook de PyInstaller para MediaPipe |
| 7 — Documentación de soporte | 🟢 Este documento + [INVESTIGACION_2026.md](INVESTIGACION_2026.md) + los documentos de prueba |

---

## Checklist de "Definition of Done" (§20)

| Ítem | Estado |
|---|---|
| Las tres contribuciones implementadas y diferenciadas del código heredado | 🟢 en el prototipo · ⚪ pendiente en el producto |
| Instalación y uso de punta a punta sin Python | ⚪ Fuera de alcance |
| Ningún flujo de error termina en crash sin explicación | 🟢 Los 9 escenarios cubiertos con acción |
| El vídeo nunca se persiste ni se transmite | 🟢 Verificable en el código |
| `NOTICE.md` con las modificaciones | ⚪ Corresponde al repositorio del software real |
| AGPL-3.0 respetada, acceso al código disponible | 🟢 Declarado en `/acerca-de` |
| Suite de pruebas en verde | 🟢 65 tests |
| Documentación lista para el capítulo de resultados | 🟢 |

---

## Correcciones al prompt maestro

Cuatro puntos del documento no coinciden con la realidad verificada. Detalle completo en [INVESTIGACION_2026.md §1](INVESTIGACION_2026.md).

| § | Dice | Realidad |
|---|---|---|
| 4.1 | "API Solutions de MediaPipe" | Eliminada de los wheels ≥ 0.10.31. Migrar a Tasks API es obligatorio |
| 4.4 | Ángulo entre *(orejas → hombros)* y `[0,-1,0]` | Esa dirección da 180° con postura perfecta. Lo correcto es *hombros → orejas* |
| 4.5 | La calibración "determina el punto de partida" | Se guarda pero el detector no la usa |
| 4.6 | Sugiere que `score_service.py` calcula el score | La fórmula vive en `ml/pose_detector.py` |
