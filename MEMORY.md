# MEMORY — estado vivo del proyecto

> Estado mutable, el "qué". Las reglas durables, el "cómo", están en [CLAUDE.md](CLAUDE.md).
> **Última alineación documentos ↔ código: 2026-07-31.**

---

## Índice de documentos

| Documento | Gancho |
|---|---|
| [PROMPT_MAESTRO_HABITUSITOS.md](PROMPT_MAESTRO_HABITUSITOS.md) | La especificación del trabajo de grado. 54 KB. No se modifica |
| [README.md](README.md) | Cómo arrancar, estructura, convenciones, licencia |
| [CLAUDE.md](CLAUDE.md) | Reglas durables del agente: idioma, capas, honestidad de datos, gotchas |
| [docs/INVESTIGACION_2026.md](docs/INVESTIGACION_2026.md) | **Empezar aquí.** Seis contradicciones entre el prompt maestro y la realidad de julio 2026 |
| [docs/DE_MOCK_A_REAL.md](docs/DE_MOCK_A_REAL.md) | Para quien construya el producto: qué se traduce, qué se tira, orden de ataque |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Capas, reglas verificadas por test, SOLID aplicado, deuda declarada |
| [docs/MAPA_PROMPT_MAESTRO.md](docs/MAPA_PROMPT_MAESTRO.md) | Cada RF/RNF → pantalla → archivo → estado |
| [docs/SISTEMA_DISENO.md](docs/SISTEMA_DISENO.md) | Tokens, tipografía, WCAG 2.2 AA, voz y copy |
| [docs/GUIA_DEMO.md](docs/GUIA_DEMO.md) | Guion de 12 minutos y preguntas probables |
| [docs/DOCUMENTOS_PRUEBA.md](docs/DOCUMENTOS_PRUEBA.md) | Los seis documentos de la prueba: quién, cuándo, para qué |

---

## Estado actual

**Fase:** prototipo completo y verificado. Listo para presentar.

| | |
|---|---|
| Pantallas | 9 de 9 |
| Tests | 65 en verde (dominio + arquitectura) |
| Build | Limpio |
| Documentos de la prueba | 4 PDF + 2 CSV generados y validados |
| Documentación | README + CLAUDE.md + MEMORY.md + 7 documentos en `docs/` |

**Stack:** Vite 8 · React 19.2 · TypeScript 6 · Tailwind v4 · shadcn/ui (`base-nova` sobre Base UI 1.6) · Recharts 3 · Zustand 5 · react-router 8 · `@mediapipe/tasks-vision` 1.0

**No versionado** (se regenera): `app/public/wasm/`, `app/public/modelos/`, `app/public/documentos/`, `dist/`, `node_modules/`.

---

## Decisiones tomadas

| Fecha | Decisión | Por qué |
|---|---|---|
| 2026-07-31 | **Prototipo web, no PyQt6** | Permite enseñar todas las pantallas antes de que exista el producto. La capa `dominio/` se escribió sin dependencias para traducirse línea por línea |
| 2026-07-31 | **Modo dual: simulado por defecto, cámara real opcional** | La demostración nunca depende de que haya webcam o permisos. Si la cámara falla, cae a simulado sin romper nada |
| 2026-07-31 | **Layout web limpio, no escritorio Windows simulado** | Decisión del usuario. La bandeja y los avisos se representan en una franja superior persistente |
| 2026-07-31 | **Corregir y documentar las contradicciones** | El README y `DE_MOCK_A_REAL.md` reflejan la realidad verificada, no el documento literal |
| 2026-07-31 | **Regla de arquitectura como test, no como ESLint** | ~80 líneas sin dependencias nuevas, corre con `npm test`, y el mensaje de error explica **por qué** existe la regla |
| 2026-07-31 | **Una sola API externa (Nager.Date) con respaldo local** | `api.quotable.io` murió; el día de la sustentación no puede depender de un servicio gratuito |
| 2026-07-31 | **`card.tsx` se deja sin tocar** | El usuario declinó modificar la primitiva de terceros. Queda como deuda declarada |

---

## Bitácora

### 2026-07-31 · Construcción completa del prototipo

**Hecho**
- Investigación web verificada con peticiones reales: seis contradicciones con el prompt maestro, fundamento académico de los tres aportes, riesgos de empaquetado, versiones del stack y APIs públicas vivas.
- Capa `dominio/` con las siete métricas del §4.4, máquina de estados de alertas, estadísticas y el baseline adaptativo con tres salvaguardas. 65 tests.
- Capa `datos/` con PRNG determinista, almacén, frontera de API y fixtures que cuentan una historia.
- Capa `camara/` con MediaPipe Tasks Vision y degradación a simulado.
- Motor de simulación en vivo con un único camino de cálculo para muestra simulada y real.
- 9 pantallas, layout, franja de bandeja y notificaciones.
- Generador de documentos en Python con stdlib pura: 4 PDF + 2 CSV.
- README, CLAUDE.md, MEMORY.md y 7 documentos en `docs/`.

**Hallazgos que cambiaron el código**

| # | Qué | Corrección |
|---|---|---|
| 1 | La dirección de los vectores del §4.4 está invertida: daría 180° con postura perfecta | Implementada la versión correcta (*hombros → orejas*, *caderas → hombros*), con la discrepancia documentada. **Verificar contra `pose_detector.py` en la Fase 1** |
| 2 | Usar `\|dx\|` como ancho de hombros acopla el desnivel con la métrica de giro de cabeza | Distancia 2D, que es invariante ante rotación. Test que lo blinda |
| 3 | Mostrar el puntaje crudo a 5 muestras/s incumple el criterio de aceptación del RF-1 | Suavizado exponencial (τ=4 s) **sobre las métricas**, no sobre el puntaje, para que el desglose siga sumando el total. Medido: salto máximo 1 punto entre ticks |
| 4 | **La normalización por división reintroduce la deriva del baseline por otra puerta**: con la referencia relajada, todo puntúa alto y la app dice "excelente" todo el día | Compensación **parcial aditiva**: se acredita una fracción de la diferencia, nunca toda. Test `NO convierte una mala postura en aceptable` |
| 5 | La sesión no se hidrataba fuera del panel: entrar directo a `/historial` mostraba la bandeja en cero | La carga pasó del panel al marco de la aplicación |
| 6 | La pantalla del aporte 1 salía **vacía**: leía solo el estado en vivo y las fixtures no producían ni un rechazo | Se hidrata desde la API + se añadió un bajón sostenido a la sesión. Sin muestras rechazadas, las salvaguardas no se ven |
| 7 | Las pestañas salían en vertical: shadcn genera `data-horizontal:` y Base UI emite `data-orientation="horizontal"` | Corregido en `tabs.tsx` (arreglo en la raíz, afecta a todas las pantallas) |
| 8 | Los desplegables mostraban el valor crudo ("0" en vez de "Ligero") | `CampoSelect` compartido en `componentes/comunes/`, usado por ajustes y benchmark |
| 9 | El mapa de calor tenía objetivos táctiles < 24 px y las filas desalineadas | Botón de 24 px con cuadro visual de 18 px dentro (WCAG 2.5.8) |
| 10 | `index.html` declaraba `lang="en"` | Corregido a `es-CO`. Un lector de pantalla leía el español con fonética inglesa |
| 11 | El desglose se reordenaba en cada tick y las filas saltaban | Orden fijo del algoritmo + etiqueta "la que más resta" en la peor métrica |

**Pendiente**

| Qué | Cuándo |
|---|---|
| Recalibrar los umbrales de las siete métricas y el factor de compensación (0,6) con datos reales | Con la muestra de 15-70 participantes. El §8.2 lo exige |
| `CardTitle` renderiza `<div>` en vez de encabezado | Antes de una auditoría de accesibilidad formal |
| Dividir el bundle por rutas (~305 KB comprimidos) | Solo si se despliega público |
| Auditoría con la herramienta de accesibilidad | El MCP no conectó; se hizo verificación manual por script (nombres accesibles, etiquetas, objetivos táctiles, jerarquía) |
| Revisión del consentimiento informado por el comité de ética | Antes de la prueba con usuarios |

---

## Al abrir el proyecto

```bash
cd app && npm install && npm run dev     # → localhost:5173
```

Empezar por `/demo`: trae el recorrido guionado de seis escenarios.

Antes de una presentación: `npm run preparar-camara` (para no depender de la conexión de la sala) y pulsar **Reiniciar la sesión** en `/demo`.
