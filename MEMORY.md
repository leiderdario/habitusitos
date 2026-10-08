# MEMORY — estado vivo del proyecto

> Estado mutable, el "qué". Las reglas durables, el "cómo", están en [CLAUDE.md](CLAUDE.md).
> **Última alineación documentos ↔ código: 2026-10-02.**

**Nombre futuro: Espinker** (de *spine* + *care*). Se mantiene "Habitusitos" en código/UI hasta
que se haga el rebranding completo en una pasada aparte — ver plan en
`/home/dari/.claude/plans/sequential-tinkering-cosmos.md` (fuera del repo, en el directorio de
planes de Claude Code).

---

## Índice de documentos

| Documento | Gancho |
|---|---|
| [README.md](README.md) | Cómo arrancar `app/` y `vision-node/`, estructura, licencia |
| [CLAUDE.md](CLAUDE.md) | Reglas durables del agente: idioma, capas, honestidad de datos, gotchas |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Capas de `app/`, reglas verificadas por test, SOLID aplicado, deuda declarada |
| [docs/prompt_maestro_multipersona_oficina.md](docs/prompt_maestro_multipersona_oficina.md) | **Plan vigente.** Multi-persona, panel de oficina, auth/multi-tenencia, wearable. Ver estado de cada fase abajo |
| [docs/plan_implementacion_postura_3d_v2.md](docs/plan_implementacion_postura_3d_v2.md) | Plan de detección 3D (ángulos reales en Z, patrones posturales) — **ya implementado**, ver `dominio/geometria-3d.ts`, `clasificador-posturas.ts`, `perspectivas.ts` |
| [docs/prompt_rediseno_ui_y_posturas.md](docs/prompt_rediseno_ui_y_posturas.md) | Corrección de bug de lectura de métricas + divulgación progresiva de la tarjeta de puntaje — **ya implementado** |
| [app/mejora.md](app/mejora.md) | Estado de conexión del `vision-node` + degradación de gracia por métrica — **ya implementado**, ver `estado/simulacion.ts`, `vista-camara.tsx`, `puntaje.ts` |
| [docs/PREGUNTAS_Y_MEJORAS.md](docs/PREGUNTAS_Y_MEJORAS.md) | **Preguntas abiertas y mejoras acumuladas**: se resuelven todas juntas al terminar la Fase 8 y luego se implementan |
| [docs/PLAN_REDISENO_ESPINKER.md](docs/PLAN_REDISENO_ESPINKER.md) | Plan UX/UI (2026-10-08): rebranding visible a Espinker, paleta nueva, login 55/45 con fondo animado, cámara al centro, sin avisos de demo — **sin implementar**, con 6 decisiones pendientes |
| [docs/PROTOCOLO_RELOJ.md](docs/PROTOCOLO_RELOJ.md) | Protocolo del reloj wearable (Fase 6, solo diseño) |
| [docs/DISENO_PAUSAS_Y_SEDENTARISMO.md](docs/DISENO_PAUSAS_Y_SEDENTARISMO.md) | Sedentarismo, MET, bouts y pausas activas (Fase 7): lógica de dominio hecha, sin conectar |
| [docs/AUDITORIA_SEGURIDAD_SUPABASE.md](docs/AUDITORIA_SEGURIDAD_SUPABASE.md) | Auditoría de las migraciones 0001–0004: 5 hallazgos corregidos en `0005`, 7 límites sin corregir (N1–N7) |
| [docs/SEGURIDAD_VISION_NODE.md](docs/SEGURIDAD_VISION_NODE.md) | Autenticación Supabase + ticket de video, orígenes, límites, variables `VISION_*`, límites conocidos. Implementado 2026-10-08; el nodo corre en local |
| [docs/SISTEMA_DISENO.md](docs/SISTEMA_DISENO.md) | Tokens, tipografía, WCAG 2.2 AA, voz y copy |
| [docs/GUIA_DEMO.md](docs/GUIA_DEMO.md) | Guion de 12 minutos y preguntas probables (desactualizado respecto al modo oficina, pendiente de revisión) |
| [docs/DOCUMENTOS_PRUEBA.md](docs/DOCUMENTOS_PRUEBA.md) | Los seis documentos de la prueba: quién, cuándo, para qué |
| [feedback.md](feedback.md) | Feedback crudo del usuario: notificaciones móviles, formulario de salud al registrarse, pausas activas, oficina no invasiva. Parcialmente cubierto — ver "Pendiente" abajo |

**Eliminados el 2026-10-01** por describir un plan abandonado (destino Python+PyQt6/Windows) y referenciar `PROMPT_MAESTRO_HABITUSITOS.md`, que nunca existió en este repositorio git: `docs/INVESTIGACION_2026.md`, `docs/DE_MOCK_A_REAL.md`, `docs/MAPA_PROMPT_MAESTRO.md`. Recuperables del historial de git si hace falta algo puntual (ej. el detalle de por qué `winotify` está muerto).

**Eliminado el 2026-10-02**: la pantalla `/benchmark` ("Recursos", aporte 2 de tesis) completa — código, API, fixtures, ruta y navegación. Decisión explícita del usuario, no un hallazgo de auditoría. Recuperable de git si hace falta defender la metodología ante el jurado.

---

## Estado actual

**Fase:** aplicación web real + nodo de visión Python funcionando en conjunto. Ya no es "prototipo descartable": es la base sobre la que se construye el resto.

| | |
|---|---|
| `app/` | Vite + React, 9 pantallas, 152 tests en verde, build limpio |
| `vision-node/` | Python, YOLO-pose (`yolo11n-pose.pt`), multi-persona por escritorio, WebSocket + stream de video con autenticación de Supabase; se ejecuta en local, no se despliega en la nube |
| Conexión `app/` ↔ `vision-node/` | Funciona: WebSocket, con estado de conexión visible en la interfaz (`conectando`/`conectado_sin_personas`/`conectado_con_personas`/`desconectado`) |
| Despliegue | `app/` en Vercel (`vercel.json`), base de datos y login en Supabase. `vision-node/` corre en local. Fly.io descartado el 2026-10-08: se eliminaron `fly.toml` y `Dockerfile` (recuperables de git) |

**Stack `app/`:** Vite 8 · React 19.2 · TypeScript 6 · Tailwind v4 · shadcn/ui (`base-nova` sobre Base UI 1.6) · Recharts 3 · Zustand 5 · react-router 8 · `@mediapipe/tasks-vision` 1.0

**Stack `vision-node/`:** Python 3.13 · ultralytics/YOLO11-pose · OpenCV headless · pydantic · websockets · pytest

**No versionado** (se regenera): `app/public/wasm/`, `app/public/modelos/`, `app/public/documentos/`, `dist/`, `node_modules/`, `vision-node/.venv/`.

---

## Decisiones tomadas

| Fecha | Decisión | Por qué |
|---|---|---|
| 2026-07-31 | Prototipo web, no PyQt6 (decisión original) | Permitía enseñar todas las pantallas antes de que existiera el producto |
| 2026-08-29 | **El baseline personal (1 cámara, modo "Webcam personal") se mantiene como primer modo** | Base estable antes de sumar multi-persona |
| 2026-09-17 | **Se abandona el plan Python+PyQt6/Windows. El destino es web + `vision-node/` multi-persona** | `docs/prompt_maestro_multipersona_oficina.md` §0: toda la conversación reciente habla de "la aplicación web" y su URL de Vercel; Capacitor para móvil queda en pausa, no descartado |
| 2026-09-17 | `vision-node/` usa YOLO-pose (COCO-17), no MediaPipe Python | Evita el techo de `mediapipe.solutions` (ver commits de `fix` sobre CDN/MediaPipe en el frontend, que sí sigue usando `@mediapipe/tasks-vision` en el navegador para el modo personal) |
| 2026-10-01 | Se elimina la documentación centrada en el destino PyQt6 en vez de actualizarla | Describía código y decisiones que ya no existen; mantenerla "por si acaso" es más riesgo (alguien construye sobre un supuesto falso) que valor — recuperable de git |

---

## Bitácora

### 2026-07-31 · Construcción completa del prototipo
Ver commit `7cd76bd`. 9 pantallas, capa `dominio/` con 65 tests, capa `datos/` simulada, capa `camara/` con MediaPipe Tasks Vision, generador de documentos de prueba en Python stdlib.

### 2026-08-29 · Fixes de reproducción de video y detección 3D de postura
Commits `e50e30f`, `704ffbc`, `5e71d1c`. Eliminada métrica redundante "cabeza al frente" (se conserva "cabeza adelantada"). MediaPipe cargado directo desde CDN en despliegues web (evita error de SPA rewrite). Fallback GPU/CPU + `autoPlay` para asegurar reproducción de video. Implementado `docs/plan_implementacion_postura_3d_v2.md`: ángulos reales en 3D desde `worldLandmarks` (`dominio/geometria-3d.ts`), clasificador de patrones posturales (`clasificador-posturas.ts`), calibración de perspectiva (`perspectivas.ts`). Aplicado `docs/prompt_rediseno_ui_y_posturas.md`: divulgación progresiva en la tarjeta de métricas + corrección del bug de lectura (cinco métricas colapsando al mismo valor).

### 2026-09-17 · Nodo de visión multi-persona
Commit `1512d64`. Nuevo `vision-node/`: Python + YOLO-pose, tracking por escritorio (`spatial_mapping.py`), máquina de estados por escritorio con histéresis (`state_machine.py`), servidor WebSocket (`websocket_server.py`) + servidor de stream de video (`stream_server.py`), mapeo COCO-17 → BlazePose-33 (`mapper.py`) para que el frontend no tenga que cambiar sus índices. Soporte de despliegue Fly.io (`fly.toml`, `Dockerfile`; retirado el 2026-10-08) y Vercel (`vercel.json`). Aplicado `app/mejora.md`: estado de conexión visible (`EstadoConexionVisionNode`), banner en `vista-camara.tsx`, degradación de gracia por métrica en `puntaje.ts` (ya no colapsa todo a "no identificada" si falta una sola métrica) con `MINIMO_METRICAS_VISIBLES`.

### 2026-10-01 · Auditoría de contexto y limpieza de documentación obsoleta
- Instaladas dependencias de `app/` (`npm install`) y `vision-node/` (venv + `pip install`, torch CPU-only vía el índice de PyTorch para evitar tirar de las ruedas CUDA sin GPU en esta máquina).
- `npm audit fix` aplicado: 3 vulnerabilidades (vitest/nanoid, solo dev) → 0.
- Verificado `npm run verificar`: 106 tests en verde, build limpio, 4 warnings de lint (no bloqueantes, dos en archivos de terceros vendorizados).
- Eliminados `docs/INVESTIGACION_2026.md`, `docs/DE_MOCK_A_REAL.md`, `docs/MAPA_PROMPT_MAESTRO.md` (ver "Decisiones tomadas").
- `docs/ARQUITECTURA.md` corregido: ya no describe el destino como PyQt6/Windows; se marcó como pendiente de confirmar la promesa de "cero llamadas de red" hacia los participantes, porque `vision-node/` sí hace llamadas de red (WebSocket) y eso no estaba reconciliado con el §8.4 original.
- `CLAUDE.md` §1 y §10 actualizados para quitar la referencia a `PROMPT_MAESTRO_HABITUSITOS.md` (nunca existió en git) y la regla "cero llamadas de red" sin matizar.

### 2026-10-02 · Fase 1 de Espinker: cuentas, registro con modo de uso, login, logging

Plan completo (8 fases) en `/home/dari/.claude/plans/sequential-tinkering-cosmos.md`. Esta sesión
construyó la **Fase 1**: cuentas reales en Supabase (Auth + Postgres + RLS), reemplazando el blob
único de `localStorage`.

- `dominio/tipos.ts`: tipos nuevos `Usuario`, `Organizacion`, `ModoUso`, `EventoRegistro` (espejo de
  columnas reales de Postgres desde el día uno, no de un SQLite hipotético). 4 códigos de error
  nuevos (`credenciales-invalidas`, `correo-ya-registrado`, `codigo-organizacion-invalido`,
  `sesion-requerida`) con sus mensajes en `datos/cliente.ts::CATALOGO_ERRORES`.
- `datos/supabase/cliente.ts` (nuevo): único archivo que importa `@supabase/supabase-js`.
- `datos/api/auth.api.ts` y `datos/api/registro.api.ts` (nuevos): registro, login con **dos
  métodos** (correo+contraseña, y código de acceso de organización para equipos compartidos vía
  `supabase.auth.signInAnonymously()` + la función SQL `unirse_con_codigo_organizacion`), logout,
  y log de auditoría en `eventos_log` (login éxito/fallo, logout, inicio/fin de cámara).
  **A propósito no pasan por `resolver()` de `datos/cliente.ts`**: esa función existe para fingir
  latencia sobre fixtures; aquí ya hay backend real desde el día uno.
- `estado/sesion-usuario.ts` (nuevo): store Zustand que envuelve la sesión de Supabase.
- `componentes/layout/ruta-protegida.tsx` (nuevo) + ruta `/ingresar` en `App.tsx`: todo lo que antes
  era de acceso libre (`/bienvenida` y las pantallas dentro de `Marco`) ahora exige sesión.
- `funcionalidades/autenticacion/pantalla.tsx` (nueva): login/registro con tabs, usa `CampoSelect`
  para elegir modo de uso al registrarse (el pedido original: "al crear la cuenta, preguntar si es
  personal o de oficina").
- `camara/use-camara.ts`: llamadas a `registrarEvento` en encendido/apagado real de la cámara
  (webcam y oficina), por refs para evitar el cierre obsoleto del `useCallback` con deps `[]`.
- `supabase/migrations/0001_fase1_cuentas.sql` (nuevo, en la raíz del repo, fuera de `app/`): tablas
  `organizaciones`, `usuarios`, `eventos_log`, políticas RLS, y la función `unirse_con_codigo_organizacion`.
  **No se ejecutó sola**: no tengo acceso de administración a la base de datos (ni service_role ni
  contraseña de Postgres se usan desde el código) — ver "Pendiente" para el paso manual.
- `npm install @supabase/supabase-js`; `app/.env.local` creado con `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_ANON_KEY` (la key `publishable`, segura para el navegador — **nunca** la
  `service_role`/`secret`, que no se guardó en ningún archivo del repo).
- Verificado: `npm run verificar` (106 tests, incluyendo `arquitectura.test.ts`, build limpio, 4
  warnings de lint preexistentes). **No verificado visualmente**: no hay navegador disponible en
  este entorno (Playwright no pudo lanzar Chromium) — falta la prueba manual end-to-end.

**Fase 2 (misma sesión): formulario de antecedentes de salud.**
- `dominio/tipos.ts`: `AntecedentesSalud` (columna, miembro superior, otros — incluye `embarazo`
  como dato sensible, hábitos incluyendo `muneca_reloj` para la futura Fase 6), `ManoDominante`,
  `CambioAntecedente`, constante `ANTECEDENTES_VACIOS`.
- `datos/api/antecedentes.api.ts` (nuevo): `leerAntecedentes(usuarioId)` (devuelve
  `ANTECEDENTES_VACIOS` si no existe fila todavía, sin escribir nada hasta el primer guardado),
  `guardarAntecedentes(usuarioId, parcial)` — compara cada campo contra el valor anterior y solo
  anota en `antecedentes_cambios` lo que de verdad cambió.
- `funcionalidades/antecedentes/pantalla.tsx` (nueva) + ruta `/antecedentes` + ítem de navegación:
  mismo patrón que `ajustes/pantalla.tsx` (tabs por sección, guardado optimista), con aviso
  explícito de "esto no diagnostica".
- `supabase/migrations/0002_fase2_antecedentes.sql` (nuevo): tablas `antecedentes_salud` y
  `antecedentes_cambios` (insert-only), RLS por usuario, y un trigger `tocar_actualizado_en` —
  el timestamp lo pone siempre el servidor, nunca el cliente, porque `new Date()` sin argumentos
  está prohibido en todo `app/src` por `arquitectura.test.ts` y esto no es una excepción.
- Verificado: `npm run verificar` en verde otra vez (106 tests, build limpio). Misma limitación:
  sin prueba visual en este entorno.

**Fase 3 (misma sesión): split personal/oficina real + eliminación de `/benchmark`.**
- Decisiones confirmadas con el usuario antes de construir: (1) del puntaje solo se quita el
  número grande (medidor circular + el número en la franja superior) — desglose, sparkline y
  tarjetas de estadísticas se quedan; (2) "placeholder de investigación" = la frase inicial de
  `resumirEnPalabras`, se quita; (3) el círculo de oficina promedia sobre una ventana de 5 minutos,
  no el frame actual.
- `funcionalidades/panel-hoy/` renombrado a `funcionalidades/panel-personal/`
  (`PantallaPanelPersonal`). Ya no muestra ningún número: el medidor circular (`MedidorPostura`,
  **eliminado**, sin otros usos) se reemplazó por `InsigniaEstado` + `FormaEstado` grandes y el
  diagnóstico específico de `clasificador-posturas.ts` (`DIAGNOSTICO_PATRON`) como mensaje
  principal, con la descripción cualitativa de `PRESENTACION` como respaldo cuando no hay
  diagnóstico activo. `resumirEnPalabras` (y su test) **eliminados** de `dominio/estadisticas.ts`:
  era puramente numérico ("llevas X min... Y puntos mejor que ayer") y quedó sin ningún llamador.
- `funcionalidades/panel-oficina/pantalla.tsx` (nuevo): video protagonista, círculo de estado
  grupal (`estadoDesdePuntaje` sobre el promedio de la ventana), alerta visible si
  `proporcionMalaPostura > 0.5`. Nunca recibe ni muestra un puntaje por persona.
- `dominio/agregacion-oficina.ts` + test (nuevo): `agregarOficina`/`proporcionMalaPostura`, con
  lista cerrada de campos (`CAMPOS_AGREGADO_OFICINA`) y test que verifica que ningún campo de
  identidad se filtre — igual patrón que `docs/prompt_maestro_multipersona_oficina.md` §3.2 ya
  especificaba.
- `estado/simulacion.ts`: nuevo `historialAgregadoOficina`, una ventana deslizante de
  `config.VENTANA_AGREGADO_OFICINA_SEGUNDOS` (300s) alimentada en `empujarLotePersonasOficina`.
  Usa `Date.now()` (reloj de pared), no el `t` monotónico de la sesión — `t` se queda congelado
  en modo oficina porque el bucle de simulación se detiene cuando `modoCamara` está activo, así
  que no sirve para medir una ventana real de minutos ahí. Es la única excepción documentada a
  "nada usa reloj real" del proyecto, y es deliberada (telemetría multi-persona en vivo, no dato
  de demostración).
- `componentes/comunes/vista-camara.tsx`: **movido** desde `funcionalidades/panel-personal/` —
  ahora lo usan dos funcionalidades (`panel-personal` y `panel-oficina`), y
  `arquitectura.test.ts` prohíbe que una funcionalidad importe de otra; subir el componente
  compartido a `componentes/comunes/` es la regla, no una excepción. Se quitó también la etiqueta
  `"persona_N (XX pts)"` que dibujaba sobre cada esqueleto en modo oficina.
- `App.tsx`: `/` monta `PantallaPanelPersonal` o `PantallaPanelOficina` según
  `Usuario.modo_uso` (componente `PanelSegunModo`), no la misma pantalla con un flag — pedido
  explícito del usuario. `/benchmark` eliminada de rutas y navegación (`marco.tsx`).
- `franja-bandeja.tsx`: ya no muestra el número de puntaje, solo icono + color + etiqueta de
  texto (los tres canales de siempre, uno menos: el número nunca fue uno de los tres exigidos por
  WCAG 1.4.1, era un extra).
- Limpieza de código muerto que quedaba colgando tras borrar `/benchmark`: `SerieBenchmark` en
  `componentes/comunes/graficas.tsx`, `NotaSimulado` en `avisos.tsx` (sin otros usos), los tipos
  `CorridaBenchmark`/`ConfigBenchmark`/`MuestraBenchmark`/`ResumenBenchmark` en `dominio/tipos.ts`,
  y las constantes `BENCHMARK_*` en `config/app.config.ts`.
- **Hallazgo sin tocar, fuera de alcance de esta fase**: `datos/fixtures/escenarios.ts` (guion de
  una pantalla `/demo` que ya no existe) está completamente huérfano — ninguna ruta ni API lo usa.
  Es código muerto preexistente a esta sesión, no introducido por los cambios de hoy.
- Verificado: `npm run verificar` — **110 tests** (106 anteriores − 3 de `resumirEnPalabras` + 7 de
  `agregacion-oficina`), `arquitectura.test.ts` en verde con los archivos movidos/nuevos, build
  limpio. Sin prueba visual, misma limitación de entorno de las fases anteriores.

**Fase 4 (misma sesión): latencia de arranque de la webcam — parcial.**
- Causa por lectura de código: en `camara/use-camara.ts` el modo webcam hacía `await crearDetector()`
  (~17 MB de WASM + modelo, más un `HEAD` previo) y **después** `getUserMedia`: tiempo total = suma,
  y el diálogo de permiso aparecía tras la carga. Ahora ambos arrancan a la vez (tiempo = el más lento).
- Un `tokenEncendidoRef` (incrementado en `apagar()`) hace que un encendido cancelado a mitad de
  carga descarte el flujo/detector que creó, en vez de dejar la cámara encendida.
- Marcas `performance.mark` (`camara:inicio`, `:permiso-concedido`, `:modelo-listo`,
  `:primer-frame-listo`): leerlas con `performance.getEntriesByType("mark")` en la consola.
- **No medido**: sin navegador en este entorno no hay cifras antes/después, así que el criterio
  "listo" del plan (segundos hasta el primer frame) **sigue abierto**. Falta medir en un navegador real,
  con y sin `npm run preparar-camara`.
- **No tocado**: el punto de calibración por persona en la rama oficina de `simulacion.ts`.
- Verificado: `npm run verificar` — 110 tests, build limpio.

**Fase 5 (misma sesión): historial real por persona + export a Excel — parcial.**
- `supabase/migrations/0003_fase5_historial.sql` (nuevo): tabla `historial_diario` (un agregado por
  usuario y día, no una fila por muestra), RLS de solo lectura de lo propio, y la función
  `acumular_historial_diario` (SECURITY DEFINER, valida rangos, la fecha la pone el servidor en
  zona `America/Bogota`). **No se ejecutó**: pegar en el SQL Editor después de la 0002.
- `datos/api/historial.api.ts` reescrito sobre Supabase, mismo contrato público
  (`obtenerHistorial`/`obtenerDiaSemana`/`obtenerTendencia`). `acumularMuestraHistorial` junta en
  memoria y envía un lote por minuto; `vaciarHistorialPendiente` se llama al apagar la cámara.
  Solo se acumula cuando `procesarMuestra` recibe `pose` (persona real): el bucle simulado nunca
  escribe, para no mezclar datos inventados con medidos.
- `dominio/historial-diario.ts` + test (nuevo): `construirDias`, `filasExportacion`. `DiaHistorial`
  gana `porcentajeMalaPostura`. Eliminada `datos/fixtures/historial.ts` (el generador de 98 días).
- Export: `.xlsx` con ExcelJS (import dinámico), columnas fijas en `COLUMNAS_EXPORTACION`, y ahora
  sí registra el evento `exportacion` (cierra el pendiente 5 de abajo). El botón CSV y
  `generarCsvHistorial` se eliminaron.
- `/historial` ya no muestra `AvisoDemo` (los datos son reales) y el texto "se guarda solo en este
  equipo, nunca se envía a ningún servidor" se reescribió porque ya era falso.
- **No hecho**: hojas "por sala" y "pausas" del export SST (sin fuente: falta persistir el agregado
  de `vision-node/` y la Fase 7), columnas MET y bouts > 60 min (Fase 7), tendencia de sedentarismo
  y pausas (solo existe % de mala postura). El modo oficina tampoco escribe historial por persona.
- **No verificado**: contra Supabase real ni en navegador; "listo" del plan (cerrar sesión, entrar
  desde otro navegador y ver el mismo historial; abrir el Excel) sigue pendiente de prueba manual.
- Verificado: `npm run verificar` — 152 tests (+5), build limpio.

**Fase 6 (misma sesión): protocolo del reloj — solo diseño, como estaba acordado.**
- `docs/PROTOCOLO_RELOJ.md` (nuevo): qué mide el reloj, formato del mensaje, etiqueta de fuente, caída
  con degradación a "solo visión", dos opciones de puente (Web Bluetooth directo o vía Supabase), privacidad.
- `dominio/tipos.ts`: `FuenteDato`, `LecturaReloj`, `EstadoConexionReloj` (mismo patrón que
  `EstadoConexionVisionNode`). Sin lógica: el umbral de "discordantes" queda PENDIENTE de calibrar con
  lecturas reales, no se inventó.
- No se construyó firmware, hardware ni `dispositivos/ble-cliente.ts`.
- Las preguntas de esta fase (dónde corre el Python, hardware, puente A/B) están en
  `docs/PREGUNTAS_Y_MEJORAS.md`, no aquí.

**Fase 7 (misma sesión): sedentarismo, MET, bouts y pausas activas — dominio hecho, sin conectar.**
- `dominio/sedentarismo.ts` + test: `calcularMet` (Wicks, `null` si falta dato), `estimarFcReposo`
  (mediana de ventana quieta ≥ 4 min), `avanzarBout` (reductor puro con tolerancia a interrupciones,
  cuenta bouts largos ≥ 60 min).
- `dominio/pausas-activas.ts` + test: catálogo con contraindicaciones por antecedente, `elegirPausa`
  (cae a "caminar"), `evaluarAviso` (reloj primero, pantalla después) y `responderAviso`.
- Los umbrales (45 min, 10 min, 60 s, 30 s) son **valores de arranque sin respaldo en datos**.
  La tabla de contraindicaciones **no está validada clínicamente**: ver el aviso en el documento.
- **No hecho**: conectar a `estado/` ni a la interfaz, persistir bouts/pausas, tipos de evento de
  pausa en `eventos_log`, contenido de las pausas guiadas, reloj físico.
- Verificado: `npm run verificar` — 152 tests (+27), build limpio. Preguntas en
  `docs/PREGUNTAS_Y_MEJORAS.md`.

**Fase 8 (misma sesión): roles, vista RRHH agregada y consentimientos.**
- **Hallazgo de seguridad de la Fase 1, corregido en SQL (sin ejecutar):** las policies de `usuarios`
  solo comparaban `id = auth.uid()` sin limitar columnas, así que cualquier cuenta podía hacer
  `update usuarios set rol = 'rrhh_jefe'` sobre sí misma o asignarse una organización.
  `0004_fase8_roles_consentimientos.sql` lo cierra con privilegios por columna (la app solo puede
  escribir `nombre`, `modo_uso`, y en el alta `id`, `correo`). Hasta ejecutar esa migración, **el
  hueco sigue abierto en la base real**.
- `0004` también crea `resumen_equipo()` (SECURITY DEFINER: valida rol, suma por día toda la
  organización y **omite los días con menos de 5 cuentas activas**; el mínimo no se puede bajar desde
  el cliente) y la tabla `consentimientos` (insert-only, con versión del texto).
- `supabase/pruebas/rls_fase8.sql` (nuevo): prueba que dentro de una transacción con ROLLBACK
  verifica que un trabajador no sube de rol ni cambia de organización, que RRHH no lee historial
  individual, perfiles ni antecedentes, y que con <5 fuentes el agregado se suprime. **No se ha
  ejecutado.**
- `dominio/consentimientos.ts` + test (textos versionados, estado vigente = última fila por tipo y
  solo de la versión actual) y `dominio/resumen-equipo.ts` + test (forma cerrada de campos, sin
  identidad). Los textos de consentimiento son **borrador sin revisión del comité de ética**; la
  pantalla lo dice con un aviso que no se cierra.
- UI: `/consentimiento` (cámara obligatoria, salud opcional; reloj inactivo hasta que exista),
  `ExigeConsentimiento` envuelve el marco, `/equipo` (solo `rrhh_jefe`, vía `RutaRol`, ítem de
  navegación condicional). `guardarAntecedentes` exige consentimiento de salud vigente.
- El rol RRHH **solo se asigna a mano por SQL** (comando al final de la migración): no hay
  pantalla, a propósito.
- Verificado: `npm run verificar` — 152 tests (+10), build limpio. Sin probar contra Supabase ni en
  navegador.

### Cierre formal del mock (pedido por el plan, Fase 8)
El prototipo nació como demostración con datos simulados (2026-07-31). Ese mock fue la **fase 1 del
proyecto**, no el producto: permitió enseñar las pantallas antes de que existiera el backend. Se fue
reemplazando por datos reales así: nodo de visión multi-persona (2026-09-17), cuentas y registro
(Fase 1), antecedentes (Fase 2), historial real (Fase 5). Lo que sigue simulado, y debe seguir
declarándose en pantalla: la sesión de demostración del panel personal (`datos/api/sesion.api.ts`,
`baseline.api.ts`, `ajustes.api.ts` aún pasan por `resolver()` y fixtures). La eliminación del
historial simulado y de `/benchmark` está registrada arriba.

### 2026-10-03 · Auditoría de seguridad de las migraciones
Detalle en `docs/AUDITORIA_SEGURIDAD_SUPABASE.md`. Por lectura de SQL y código; **nada ejecutado**.
`0005_auditoria_seguridad.sql` corrige: `usuarios.correo` escribible por el cliente (alto: permitía
promover a un atacante al asignar RRHH por correo), mudanza de organización conservando el rol RRHH,
`acumular_historial_diario` sin tope diario, consentimiento de salud solo en la interfaz, y rangos/tamaños.
`auth.api.ts` ya no envía `correo` al registrarse (la columna dejó de ser escribible). Sin corregir:
log de eventos y de cambios escritos por el cliente, ataque por diferencia a los agregados de RRHH,
códigos de organización cortos, falta de borrado de datos propios. Verificado: `npm run verificar`
sigue en 152 tests y build limpio. Pasos manuales: ejecutar 0001→0005 y la prueba `rls_fase8.sql`.

---

## Pendiente

Cruce entre `feedback.md` (lo que pidió el usuario) y lo construido:

| Pedido en feedback.md | Estado |
|---|---|
| Identificar inclinación del cuello en Z, con más puntos reales (no inventados) | 🟢 Hecho — `dominio/geometria-3d.ts`, `worldLandmarks` |
| Entender varios ángulos/posturas del usuario sentado en oficina | 🟢 Hecho — `clasificador-posturas.ts`, `perspectivas.ts` |
| Oficina inteligente no invasiva, varias personas | 🟢 Backend (`vision-node/`) + frontend (`panel-oficina/`, `agregacion-oficina.ts`) hechos: video + círculo grupal + alerta, agregado y anónimo. **Sigue faltando**: autenticación multi-organización con RLS real por `organizacion_id` más allá del código de acceso (Fase 3 del plan de roadmap), y los tipos `FrameMultiPersona`/`idSeguimiento` explícitos de `docs/prompt_maestro_multipersona_oficina.md` §3.1 — el equivalente real que se construyó usa `track_id`/`persona_<n>` directamente en `estado/simulacion.ts`, un camino más corto que llegó al mismo resultado |
| Registro con formulario de salud (hipertensión, hernias, túnel carpiano, escoliosis, etc.) | 🟢 Hecho — `/antecedentes`, tabla `antecedentes_salud` con historial de cambios en `antecedentes_cambios` |
| Notificaciones al celular | 🔴 No iniciado. El plan de Capacitor está en pausa (ver "Decisiones tomadas" 2026-09-17), no descartado |
| Pausas activas obligatorias (baño, caminar, subir/bajar escaleras, tomar líquidos) | 🔴 No iniciado. La máquina de estados actual (`maquina-estado.ts`) cubre alertas de postura, no pausas activas programadas |
| Sin grabar video ni audio, solo analizar en tiempo real | 🟢 Vigente — `camara/` pinta y descarta el frame, `vision-node/` no persiste video por defecto (`events_output_file` solo guarda eventos JSON, no video) |
| La notificación debe decir qué parte de la postura empeoró | 🟢 Hecho — el desglose ya marca "la que más resta" |

Otros pendientes heredados, aún vigentes:

| Qué | Cuándo |
|---|---|
| Recalibrar umbrales de las siete métricas y el factor de compensación (0,6) con datos reales | Con la muestra de participantes |
| `CardTitle` renderiza `<div>` en vez de encabezado | Antes de una auditoría de accesibilidad formal |
| Dividir el bundle por rutas (968 KB sin comprimir / 298 KB gzip, advertencia de Vite en el build) | Si se despliega público a gran escala |
| **Decidir y documentar la promesa de privacidad/red hacia los participantes**, ahora que `vision-node/` sí hace llamadas de red | Antes de cualquier prueba con usuarios reales — puede necesitar pasar por el comité de ética (ver `docs/prompt_maestro_multipersona_oficina.md` §1) |
| Revisión del consentimiento informado por el comité de ética | Antes de la prueba con usuarios, y antes de monitorear a terceros identificables en una oficina real |

**Pasos manuales para dejar la Fase 1 funcionando de verdad (ninguno de código):**

1. Ejecutar `supabase/migrations/0001_fase1_cuentas.sql`, `0002_fase2_antecedentes.sql` y
   `0003_fase5_historial.sql` `0004_fase8_roles_consentimientos.sql` (cierra la escalada de privilegios) y
   `0005_auditoria_seguridad.sql`, en ese orden, una vez cada uno, en el SQL Editor del dashboard de Supabase (o `supabase db push` si
   el CLI está enlazado a este proyecto).
2. Activar **"Anonymous sign-ins"** en Authentication → Sign In / Up — viene desactivado por
   defecto y el login por código de organización depende de él.
3. Probar manualmente el registro y los dos métodos de login en el navegador — no se pudo hacer en
   esta sesión (sin Chromium disponible en el entorno).
4. Rotar la `service_role`/`secret` key del proyecto si no se ha hecho todavía (quedó escrita en el
   chat de la sesión 2026-10-02 antes de decidir no usarla en ningún archivo).

---

## Al abrir el proyecto

```bash
cd app && npm install && npm run dev        # → localhost:5173
```

```bash
cd vision-node && python3 -m venv .venv && .venv/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m vision_node.main --source 0 --no-gui
```

> El `torch` del índice por defecto de PyPI trae ruedas CUDA aunque la máquina no tenga GPU — en una máquina sin GPU, instalarlo primero desde `https://download.pytorch.org/whl/cpu` evita descargar varios GB de más (y evitó un "No space left on device" real en esta sesión).

Antes de una presentación: `npm run preparar-camara` en `app/` (para no depender de la conexión de la sala).
