# Prompt maestro: implementación de multi-persona, panel de oficina, rediseño UI y wearable

> Pégale esto a tu asistente de código JUNTO CON estos otros cuatro archivos, en este orden de
> lectura obligatorio:
> 1. `aspectos_generales.md` — marco legal, ético, y la arquitectura de datos ya decidida
>    (login por organización, monitoreo agregado y anónimo, detalle personal solo para uno
>    mismo). Es la restricción que gobierna todo lo de abajo.
> 2. `aspectos_ingenieria_sistemas.md` — arquitectura, infraestructura, seguridad.
> 3. `aspectos_ingenieria_software.md` — diseño de la aplicación, modelo de datos multi-persona.
> 4. `notas_estrategia_y_reutilizacion.md` — **corrige el §3 de `aspectos_ingenieria_sistemas.md`**
>    (orden de pasos para el modelo de pose multi-persona) y da los repositorios concretos a
>    usar como base. Su sección 5 es la lista de qué cambió y por qué.
>
> Este documento NO repite el contenido de esos cuatro — donde haga falta una decisión que ya
> está tomada ahí, la referencia por nombre de archivo y sección, no la reescribe. Este
> documento es el "cómo", los otros cuatro son el "qué" y el "por qué".

---

## 0. Supuesto de plataforma que hay que confirmar o corregir antes de empezar

**Voy a asumir que la base de trabajo es la aplicación web actual (Vite + React + TypeScript,
desplegada en Vercel), y que el plan de empaquetarla con Capacitor para móvil queda en pausa**
— ninguno de los cuatro documentos de esta ronda lo menciona, y toda la conversación reciente
habla de "la aplicación web" y su URL de Vercel. Si el plan de Capacitor sigue vivo en
paralelo, dilo antes de que el agente construya sobre un supuesto equivocado — no es algo que
se pueda corregir a mitad de la implementación sin rehacer trabajo.

## 1. Restricción que no se negocia en ninguna fase

`aspectos_generales.md` §1 y §3 fijan que el modo oficina es **agregado y anónimo por diseño**,
y que procesar datos biométricos de compañeros de oficina reales probablemente necesita
aprobación de un comité de ética antes de recolectar un solo dato real. Traducido a reglas de
implementación:

- **Se puede construir, probar y hacer demos de todo lo de abajo con datos sintéticos o con
  el propio desarrollador como único sujeto**, sin esperar ninguna aprobación.
- **No conectar el sistema a cámaras reales monitoreando a terceros identificables en un
  entorno de oficina real de producción** hasta tener ese punto resuelto con el asesor. Esto
  es una decisión de proceso, no de código, pero el agente de código no debe asumir que "ya se
  puede desplegar en la oficina de alguien" solo porque el software esté listo.

---

## 2. Fase 0 — Spike obligatorio antes de construir nada más

Ver `notas_estrategia_y_reutilizacion.md` §2.1 para el razonamiento completo. Aquí, los pasos
exactos:

### 2.1 Probar `numPoses > 1` en lo que ya existe

**Archivo:** `app/src/camara/detector-pose.ts`

```ts
// ANTES:
numPoses: 1,

// AHORA, para el spike (temporal, no el valor final):
numPoses: 4,
```

Grabar una escena real con 2-4 personas, incluyendo que una tape parcialmente a otra, y medir:
- ¿Cuántas personas detecta consistentemente?
- ¿Qué tan estables son los landmarks de cada persona entre frames (jitter)?
- ¿La persona parcialmente oculta da landmarks con `visibility` baja de forma honesta, o
  landmarks inventados con confianza alta? (esto es crítico — la compuerta de visibilidad que
  ya existe en `puntaje.ts` depende de que `visibility` sea honesta).

**No seguir a la Fase 1 sin este dato.** Si `numPoses > 1` de MediaPipe funciona
razonablemente para 2-4 personas, gran parte del resto de este documento se simplifica —
`detector-pose.ts` casi no cambia de forma, solo de forma de salida (ver Fase 1). Si no
funciona, activar el plan B de `notas_estrategia_y_reutilizacion.md` §2.1 (MoveNet Multipose)
antes de continuar con el resto de las fases — el resto del documento asume que hay ALGÚN
detector que da N esqueletos por frame, sin importar cuál termine siendo.

### 2.2 Página de laboratorio temporal

Crear una ruta de desarrollo, **no una funcionalidad final**, ej. `app/src/funcionalidades/laboratorio-multipersona/pantalla.tsx`, que solo muestre el video con el esqueleto de cada persona detectada dibujado en un color distinto y su `idSeguimiento` (ver Fase 1) como texto — para verificar visualmente antes de construir el resto de la UI encima. Se elimina al terminar la Fase 0.

---

## 3. Fase 1 — `dominio/`: tipos y agregación multi-persona

Todo esto es lógica pura, sin dependencias externas — sigue la regla que ya rige `dominio/`.

### 3.1 Tipos nuevos en `dominio/tipos.ts`

```ts
/** Efimero: se genera al iniciar una sesion de camara y nunca persiste mas alla de ella.
 *  NO es una identidad real de la persona — ver aspectos_ingenieria_sistemas.md #4. */
export type IdSeguimiento = string;

export interface PersonaEnFrame {
  idSeguimiento: IdSeguimiento;
  pose: FramePose;
}

export interface FrameMultiPersona {
  personas: readonly PersonaEnFrame[];
}
```

### 3.2 Nuevo archivo: `dominio/agregacion-oficina.ts`

```ts
/**
 * Agregacion anonima de varias personas para el modo "monitoreo general" de oficina.
 *
 * REGLA DE ARQUITECTURA QUE NO SE PUEDE ROMPER: esta interfaz nunca lleva un campo que
 * identifique a una persona (nombre, idSeguimiento, foto, ni nada de lo que se pueda
 * reconstruir hacia una identidad). Ver aspectos_generales.md #1. Cualquier cambio a esta
 * lista de campos exige revision de codigo explicita, no un agregado silencioso.
 */
import type { EstadoPostural, MuestraPuntaje } from "./tipos";

export interface DatosAgregadosOficina {
  timestampUTC: string;
  personasActivas: number;
  puntajeAgregado: { promedio: number; minimo: number; maximo: number };
  conteoPorEstado: Record<EstadoPostural, number>;
  tendenciaUltimaHora: ReadonlyArray<{ t: number; promedio: number }>;
}

/** Lista cerrada de campos permitidos — usada por el test de forma en agregacion-oficina.test.ts. */
export const CAMPOS_AGREGADO_OFICINA = [
  "timestampUTC",
  "personasActivas",
  "puntajeAgregado",
  "conteoPorEstado",
  "tendenciaUltimaHora",
] as const;

export function agregarOficina(
  muestras: ReadonlyArray<{ estado: EstadoPostural; puntaje: number }>,
  historial: ReadonlyArray<{ t: number; promedio: number }>,
  ahoraUTC: string,
): DatosAgregadosOficina {
  // Implementacion: promedio/min/max sobre muestras.puntaje, conteo por estado con
  // Object.groupBy o reduce, tendenciaUltimaHora = historial filtrado a la ultima hora.
  // Sin acceso a idSeguimiento en ningun punto de esta funcion — ni siquiera para descartarlo,
  // para que sea imposible que se filtre por error.
}
```

**Test obligatorio, no opcional:**

```ts
// dominio/agregacion-oficina.test.ts
import { agregarOficina, CAMPOS_AGREGADO_OFICINA } from "./agregacion-oficina";

test("agregarOficina nunca produce un campo fuera de la lista permitida", () => {
  const resultado = agregarOficina(muestrasDePrueba, [], "2026-01-01T00:00:00Z");
  expect(Object.keys(resultado).sort()).toEqual([...CAMPOS_AGREGADO_OFICINA].sort());
});
```

Este test falla automáticamente si alguien agrega un campo nuevo a la interfaz sin actualizar
la lista — que es exactamente el punto: fuerza una decisión consciente, no un descuido.

### 3.3 Seguimiento (tracking) simple entre frames

**Nuevo archivo:** `dominio/seguimiento-multipersona.ts` (o `camara/`, si se prefiere que
viva junto al detector — decisión de estilo, no de arquitectura, pero manteniéndolo puro si
va en `dominio/`).

MediaPipe no da un ID persistente entre frames en modo multi-persona — hay que asignarlo. Un
emparejamiento simple por proximidad del centro de cadera entre frames consecutivos alcanza
para este caso (no se necesita un tracker sofisticado tipo DeepSORT para 2-4 personas
relativamente estáticas sentadas en escritorios):

```ts
interface PosicionAnterior {
  idSeguimiento: IdSeguimiento;
  centroCadera: { x: number; y: number };
}

/** Empareja las personas del frame actual con las del frame anterior por distancia del
 *  centro de cadera. Si nadie coincide dentro de UMBRAL_DISTANCIA_SEGUIMIENTO, se asigna un
 *  idSeguimiento nuevo (persona que entra al cuadro). */
export function asignarSeguimiento(
  personasActuales: ReadonlyArray<{ pose: FramePose }>,
  anteriores: ReadonlyArray<PosicionAnterior>,
  umbralDistancia: number,
): PersonaEnFrame[] {
  // Implementacion: para cada persona actual, calcular centro de cadera (promedio de
  // PUNTO.CADERA_IZQ/DER), buscar el "anterior" mas cercano dentro del umbral, reusar su
  // idSeguimiento; si no hay match, generar uno nuevo (ej. con un contador incremental de
  // sesion, nunca un UUID persistente entre sesiones).
}
```

---

## 4. Fase 2 — `camara/` y `estado/`: orquestación multi-persona

### 4.1 `camara/detector-pose.ts`

```ts
// La firma de Detector cambia:
export interface Detector {
  detectar(video: HTMLVideoElement, tMs: number): FrameMultiPersona | null;
  cerrar(): void;
  origen: "local" | "cdn";
}
```

Dentro, `detectar` ahora mapea `resultado.landmarks` (arreglo de arreglos) en vez de tomar
solo `[0]`, aplica `asignarSeguimiento`, y devuelve `{ personas }`. El modo de una sola persona
(`Habitusitos` personal) simplemente usa `personas[0]` — no hace falta un camino de código
separado para "modo persona" vs "modo oficina" a este nivel; la diferencia está en cuántas
personas se procesan después, no en cómo se detectan.

### 4.2 Nuevo: `config/app.config.ts`

```ts
/** Punto de partida — ajustar despues del spike de la Fase 0. */
MAX_PERSONAS_SIMULTANEAS: 4,
UMBRAL_DISTANCIA_SEGUIMIENTO: 0.15, // fraccion del ancho de frame, ajustar con datos reales
```

### 4.3 Nuevo: `estado/sesion-oficina.ts`

Reemplaza el supuesto de "una sola persona" de `estado/simulacion.ts` cuando el modo activo es
"oficina". Estructura:

```ts
interface EstadoPorPersona {
  maquina: EstadoMaquina;
  baseline: EstadoBaseline;
  clasificacion: EstadoClasificacion;
  ultimoPuntaje: number;
}

interface EstadoSesionOficina {
  personas: Map<IdSeguimiento, EstadoPorPersona>;
  agregado: DatosAgregadosOficina;
}
```

Cada `idSeguimiento` nuevo que aparece recibe un `EstadoPorPersona` inicial (mismo
`crearMaquina()`, `crearBaseline()` que ya existen). Cada frame, se recorre el mapa, se llama
`avanzar`/`actualizarBaseline`/`avanzarClasificacion` por persona exactamente igual que hoy se
hace para una sola — **esto es paralelizar la orquestación, no reescribir la lógica de
`dominio/`, que sigue operando sobre un esqueleto a la vez** (ver
`aspectos_ingenieria_software.md` §1-2, ya especificado ahí).

Al final de cada frame, se llama `agregarOficina` con los puntajes actuales de todo el mapa —
**nunca se expone el mapa completo (con sus `idSeguimiento`) a ningún componente de UI del
modo oficina.** Solo `agregado` sale de esta capa hacia afuera.

---

## 5. Fase 3 — `datos/`: multi-tenencia y autenticación

- Necesita un proveedor de autenticación real — dado que el stack es Vite (no Next.js),
  Supabase Auth es la opción más directa (auth + base de datos Postgres con row-level
  security, que es exactamente el mecanismo correcto para reforzar el límite entre
  organizaciones que pide `aspectos_generales.md` §1 a nivel de base de datos, no solo de
  interfaz).
- Row-level security: cada fila de datos agregados lleva un `organizacion_id`; las políticas
  de Postgres impiden que una consulta cruce ese límite, sin depender de que el código de la
  aplicación nunca tenga un bug — la base de datos lo impide aunque el código falle.
- El histórico personal (modo persona) sigue el mismo esquema que ya existía, ahora con
  `usuario_id` real en vez de `localStorage`.

---

## 6. Fase 4 — Interfaz: reconstrucción sobre `shadcn-admin`

Ver `notas_estrategia_y_reutilizacion.md` §2.2 y §3 para el razonamiento — aquí, la estructura
concreta:

```
app/src/
  componentes/
    comunes/            <- reconstruido con los tokens/patrones de satnaing/shadcn-admin
  funcionalidades/
    panel-personal/      <- hoy es "panel-hoy", renombrado; misma logica de dominio, UI nueva
    panel-oficina/        <- NUEVO. Consume SOLO DatosAgregadosOficina, nunca el mapa por persona
    autenticacion/         <- NUEVO. Login + seleccion de organizacion
```

**Regla de diseño no negociable para `panel-oficina/`:** el componente de esta pantalla debe
tipar sus props como `DatosAgregadosOficina` (o un subconjunto) — si TypeScript permite que le
llegue algo con un campo de identidad, la barrera de tipos ya falló antes de llegar a la UI.

**Principios visuales concretos** (de `notas_estrategia_y_reutilizacion.md` §3): un solo color
de acento, espacio en blanco generoso, divulgación progresiva construida desde el inicio del
componente (no un `useState` de "expandido" añadido después), el puntaje principal en un solo
lugar por pantalla.

---

## 7. Fase 5 — Wearable (hardware, la fase más experimental)

Ver `notas_estrategia_y_reutilizacion.md` §2.3 y §4. Dos partes que viven en dos mundos
distintos del mismo repositorio (o en un repo hermano, a decidir):

### 7.1 Firmware — fork de `IEEE-VIT/posture-correct`

Carpeta nueva, fuera de `app/`: `firmware/sensor-postura/` (código C++/Arduino, no
TypeScript — no pasa por `arquitectura.test.ts` ni por las reglas de capas de la app web,
es un proyecto distinto). Punto de partida: el repositorio ya identificado, adaptado para
exponer un servicio BLE con una característica que publique el ángulo de inclinación de
espalda calculado desde el MPU6050.

### 7.2 Puente Web Bluetooth — nuevo módulo en la app

```ts
// app/src/dispositivos/ble-cliente.ts (NUEVO)
export async function conectarSensorPostura(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (!navigator.bluetooth) {
    throw new ErrorApp(
      "bluetooth-no-disponible",
      "Este navegador no soporta Web Bluetooth. No funciona en Safari ni iPhone — es una limitacion de esas plataformas, no de esta app.",
    );
  }
  const dispositivo = await navigator.bluetooth.requestDevice({
    filters: [{ services: [SERVICIO_UUID_POSTURA] }],
  });
  const servidor = await dispositivo.gatt?.connect();
  const servicio = await servidor?.getPrimaryService(SERVICIO_UUID_POSTURA);
  const caracteristica = await servicio?.getCharacteristic(CARACTERISTICA_UUID_INCLINACION);
  if (!caracteristica) throw new ErrorApp("sensor-no-encontrado", "No se encontro el sensor.");
  return caracteristica;
}
```

Esta fase es opcional y puede quedar completamente al final — nada de las fases 1 a 4 depende
de que esto exista.

---

## 8. Qué se conserva sin cambios de las reglas de calidad ya establecidas

Aunque el contexto de plataforma cambió (ya no es Windows/PyQt6), estas reglas de calidad de
código siguen aplicando tal cual, y hay que extender su verificación automática a las carpetas
nuevas:

- `dominio/` sin ninguna dependencia externa — incluye los archivos nuevos de este documento.
- Ninguna funcionalidad importa de otra funcionalidad directamente.
- Sin `enum` (si el `tsconfig` sigue con `erasableSyntaxOnly` activo — confirmar antes de
  asumirlo).
- Nada usa `Math.random()` sin pasar por una semilla determinista donde aplique a datos de
  demostración.
- Extender `arquitectura.test.ts` con las reglas de las carpetas nuevas (`dispositivos/`,
  `panel-oficina/`, `agregacion-oficina.ts`) antes de considerar esta fase terminada — un test
  de arquitectura que no cubre el código nuevo no protege nada.

## 9. Definición de "listo" por fase

- **Fase 0**: dato real de cuántas personas detecta de forma estable, con oclusión parcial
  real, documentado — no una impresión, un número.
- **Fase 1**: `agregacion-oficina.test.ts` en verde, incluyendo el test de forma cerrada.
- **Fase 2**: dos o más `idSeguimiento` mantienen máquinas de estado independientes en una
  prueba con video real — verificado, no asumido.
- **Fase 3**: una organización no puede leer datos de otra ni con una consulta manual directa
  a la base de datos saltándose la capa de aplicación (probar esto explícitamente).
- **Fase 4**: comparación visual lado a lado del panel anterior vs. el nuevo — si no se ve
  claramente menos saturado, no está terminada.
- **Fase 5**: opcional — se marca "lista" solo si de verdad se construyó el hardware físico,
  no como código teórico sin probar contra un sensor real.
