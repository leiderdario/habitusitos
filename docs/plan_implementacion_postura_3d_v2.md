# Plan de Implementación v2: Detección de Postura 3D y Reconocimiento de Patrones Posturales

> Revisión del plan original a la luz del código real (`detector-pose.ts`, `use-camara.ts`,
> `tipos.ts`, `puntaje.ts`, `baseline-adaptativo.ts`, `simulacion.ts`, `vista-camara.tsx`,
> `ajustes.ts`, `app.config.ts`) y de las reglas de `CLAUDE.md` / `ARQUITECTURA.md`.
> Cada decisión de diseño ambigua en el plan original queda cerrada aquí — el objetivo es que
> un agente de codificación no tenga que inventar nada por su cuenta.

---

## 0. Qué cambia respecto al plan original, y por qué

| Plan original | Plan v2 | Razón |
|---|---|---|
| `TipoPerspectiva` con 4-5 categorías fijas (frontal, laptop_baja, monitor_alto, lateral_oficina) que el sistema "detecta" | Una sola calibración geométrica continua: vector "arriba" del usuario, derivado de `worldLandmarks` en su postura neutra | Con MediaPipe monocular no hay forma honesta de clasificar la posición física de la cámara en categorías con nombre (viola CLAUDE.md §5, "nunca inventar un dato y presentarlo como medido"). Lo único que se puede medir de verdad es la orientación del propio usuario respecto a su cámara actual. |
| `ConfiguracionPerspectiva` como flujo de calibración nuevo e independiente | Una sola calibración: se extiende el botón "Marca tu postura normal" que ya existe en `vista-camara.tsx` | Ese flujo ya captura el instante exacto que se necesita (usuario en postura neutra). Duplicarlo en un asistente nuevo crea dos calibraciones que se pueden desincronizar. |
| Ángulos de Euler de cabeza vía "triangulación facial" sin especificar de dónde salen los puntos | Se calculan desde `worldLandmarks` (11 puntos faciales de BlazePose ya incluidos: nariz, ojos, orejas, boca), en espacio métrico 3D, sin modelo adicional | No hace falta un segundo modelo (Face Landmarker): sería una llamada de cómputo extra no presupuestada y rompería la filosofía de un solo modelo local. Se documenta como aproximación, no como pose 6DOF clínica. |
| `PatronPostural` como enum/unión mutuamente excluyente, sin mecanismo de suavizado propio | Un patrón principal + patrones secundarios, con histéresis temporal dedicada (reutilizando el estilo de `maquina-estado.ts` y las funciones `alphaDesdeTau`/`tauDesdeAlpha` de `baseline-adaptativo.ts`) | Sin esto, el patrón mostrado va a parpadear entre categorías con ruido de landmarks. La arquitectura ya tiene un patrón idiomático para esto (`vigilando` → `alerta` con `sostenido`); se reutiliza en vez de inventar uno nuevo. |
| Vector vertical del proyecto (`VERTICAL_IDEAL` en `puntaje.ts`) tratado como si cambiar su valor fuera trivial | Se convierte en parámetro opcional de `calcularMetricas`/`anguloConVertical`, con el valor fijo actual como default | `VERTICAL_IDEAL` hoy es una constante de módulo cerrada sobre la función. El código heredado de `pose_detector.py` debe seguir comportándose igual cuando no hay calibración — el cambio es aditivo, no una reescritura. |
| Nueva lógica de patrones sin tocar `estado/simulacion.ts` | Se modifica `empujarLandmarks`, `marcarPosturaNeutra` y `procesarMuestra` explícitamente, con firmas nuevas | `procesarMuestra` es "el camino único de cálculo" y hoy solo recibe `MetricasPostura` ya reducidas — no le llegan landmarks crudos. Sin tocarlo, el clasificador no tiene de dónde leer ángulos o proximidad de muñeca/codo. |
| Patrones posturales esperados también en modo simulado | Patrones solo se calculan en modo cámara real; en modo simulado se declara explícitamente "sin datos" | El modo simulado (`metricasDesdeNivel`) fabrica las 7 métricas con ruido gaussiano independiente por métrica — no hay un modelo anatómico detrás del que derivar ángulos de cabeza o proximidad de codo. Fabricar un patrón ahí sería inventar un dato con apariencia de medido. |

---

## 1. Decisiones de diseño cerradas

Estas son las reglas que el agente de codificación debe seguir sin desviarse:

1. **Ninguna categoría de "tipo de cámara" se presenta como detectada.** Solo se calibra un vector personal. Los nombres tipo "laptop baja"/"monitor alto" pueden aparecer como texto informativo en ajustes, nunca como un valor que el sistema afirma haber medido.
2. **Una sola fuente de matemática vectorial.** `dominio/geometria-3d.ts` es dueño de las operaciones de vectores y del cálculo de ángulo entre vectores. `puntaje.ts` importa desde ahí en vez de mantener su propia copia de `anguloConVertical`.
3. **Sin `enum`.** `erasableSyntaxOnly` está activo (CLAUDE.md §3). Todo tipo de patrón/estado es unión de literales string, igual que `PatronPostural`, `EstadoPostural`, etc. ya lo hacen hoy.
4. **`CalibracionCabeza` se renombra a `CalibracionPostural`** y gana un segundo campo. Ver §3.1. Se actualiza en los cuatro sitios donde el tipo/nombre aparece hoy: `tipos.ts`, `simulacion.ts`, `vista-camara.tsx`, `pantalla.tsx`.
5. **`VERTICAL_IDEAL` pasa a ser un parámetro opcional**, no una reescritura de la función. El comportamiento sin calibración queda bit a bit igual al actual.
6. **El clasificador de patrones vive en `dominio/`, con dos funciones separadas**, igual que `maquina-estado.ts` separa "cuándo avisar" de "cómo se presenta el estado":
   - `clasificarPatron(...)`: pura, un frame, sin memoria.
   - `avanzarClasificacion(estadoAnterior, candidato, ahora, cfg)`: con histéresis temporal, misma forma que `avanzar()` en `maquina-estado.ts`.
7. **Patrones posturales: solo en modo cámara.** En modo simulado, `patronPrincipal` vale `"sin_datos"` (nuevo valor, distinto de `"postura_desconocida"`, que se reserva para cuando la cámara está activa pero la confianza es insuficiente).
8. **Umbral de visibilidad centralizado.** Hoy `vista-camara.tsx` usa `0.4` a mano para no dibujar un punto. Se sube a `config/app.config.ts` como `UMBRAL_VISIBILIDAD_LANDMARK` y lo usan tanto el dibujo como el clasificador.
9. **Todo umbral nuevo (ángulos, distancias de proximidad) se declara `PENDIENTE`** en `app.config.ts`, con el mismo comentario que ya usa `UMBRALES_POR_DEFECTO`: son un punto de partida razonado, no un valor medido, y deben recalibrarse con la muestra de participantes.
10. **El badge de patrón usa icono + texto, sin canal de color propio.** El color ya está asignado al estado postural (`excelente/buena/vigilando/alerta/pausa`); darle un color independiente al patrón crearía dos semáforos que compiten por atención.

---

## 2. Capa de Cámara (`app/src/camara/`)

### [MODIFY] `detector-pose.ts`

- `Detector.detectar` cambia de firma:

  ```ts
  // Antes:
  detectar(video: HTMLVideoElement, tMs: number): Landmark[] | null;

  // Despues:
  detectar(video: HTMLVideoElement, tMs: number): FramePose | null;
  ```

  Donde `FramePose` es el nuevo tipo de `dominio/tipos.ts` (ver §3.1). Dentro de la función:

  ```ts
  const resultado = landmarker.detectForVideo(video, tMs);
  const puntos = resultado.landmarks?.[0];
  const puntosMundo = resultado.worldLandmarks?.[0];
  if (!puntos || puntos.length < 25) return null;

  return {
    landmarks: puntos.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 })),
    // worldLandmarks es null si el modelo no lo devolvio esta vez: nunca se
    // inventa un vector 3D a partir de coordenadas proyectivas.
    worldLandmarks: puntosMundo && puntosMundo.length >= 25
      ? puntosMundo.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 }))
      : null,
  };
  ```

  El modelo BlazePose ya calcula `worldLandmarks` en cada llamada a `detectForVideo`; hoy simplemente se descarta. No hay costo de cómputo adicional en el detector por este cambio.

- `CONEXIONES` se amplía para dibujar brazos y torso completo. Índices BlazePose (convención ya usada en el archivo: `IZQ`/`DER` mapean a `left_*`/`right_*` de MediaPipe, no a lo que aparece a la izquierda de la imagen espejada):

  ```ts
  export const CONEXIONES: [number, number][] = [
    [7, 8],   // oreja a oreja
    [11, 12], // hombro a hombro
    [11, 23], // hombro izq a cadera izq
    [12, 24], // hombro der a cadera der
    [23, 24], // cadera a cadera
    [0, 7],   // nariz a oreja izq
    [0, 8],   // nariz a oreja der
    [11, 13], [13, 15], // brazo izq: hombro-codo-muñeca
    [12, 14], [14, 16], // brazo der: hombro-codo-muñeca
  ];
  ```

- Se agregan a `PUNTO` (en `tipos.ts`, ver abajo) los índices de codo, muñeca, ojos y boca que hacían falta para geometría facial y de brazos.

### [MODIFY] `use-camara.ts`

- El estado `landmarks: Landmark[] | null` se reemplaza por `pose: FramePose | null`, un solo campo para no arriesgar que `landmarks` y `worldLandmarks` queden desincronizados entre dos `useState` separados:

  ```ts
  interface useCamara {
    // ...
    pose: FramePose | null; // antes: landmarks: Landmark[] | null
    // ...
  }
  ```

  Dentro del `setInterval` de `encender()`: `setPose(d.detectar(v, performance.now()))`.

- Esto obliga a actualizar el único consumidor hoy: `pantalla.tsx` pasa `camara.landmarks` a dos sitios (`VistaCamara` y `empujarLandmarks`). Ver §5.

---

## 3. Capa de Dominio (`app/src/dominio/`)

### [MODIFY] `tipos.ts`

```ts
/** Punto en espacio metrico 3D (metros, origen en la pelvis). Misma forma que
 *  Landmark; se usa un alias para dejar claro en las firmas cual espacio es. */
export type Landmark3D = Landmark;

/** Salida completa de un frame de deteccion: landmarks proyectivos (2D + z
 *  relativo) y, si el modelo los devolvio, los landmarks metricos 3D. */
export interface FramePose {
  landmarks: Landmark[];
  /** null cuando el modelo no los produjo en este frame. Nunca se sintetizan:
   *  si no hay dato metrico real, la calibracion 3D y el clasificador de
   *  patrones se degradan con gracia en vez de inventar un valor. */
  worldLandmarks: Landmark3D[] | null;
}

export const PUNTO = {
  NARIZ: 0,
  OJO_INT_IZQ: 1,
  OJO_IZQ: 2,
  OJO_EXT_IZQ: 3,
  OJO_INT_DER: 4,
  OJO_DER: 5,
  OJO_EXT_DER: 6,
  OREJA_IZQ: 7,
  OREJA_DER: 8,
  BOCA_IZQ: 9,
  BOCA_DER: 10,
  HOMBRO_IZQ: 11,
  HOMBRO_DER: 12,
  CODO_IZQ: 13,
  CODO_DER: 14,
  MUNECA_IZQ: 15,
  MUNECA_DER: 16,
  CADERA_IZQ: 23,
  CADERA_DER: 24,
} as const;

/** Calibracion de la postura neutra del usuario, capturada en un solo instante
 *  (el mismo click de "Marca tu postura normal" en vista-camara.tsx).
 *
 *  APORTE PROPIO — capa 3D. offsetZ ya existia (metrica 1, cabeza adelantada).
 *  vectorArriba es nuevo: reemplaza el vector vertical fijo [0,-1,0] de las
 *  metricas 2 y 5 por la orientacion real del torso de ESTE usuario frente a
 *  ESTA camara, sin necesidad de clasificar donde esta la camara. */
export interface CalibracionPostural {
  offsetZ: number;
  /** null = sin calibrar (o worldLandmarks no disponibles al calibrar): las
   *  metricas 2 y 5 usan el vector vertical fijo heredado, comportamiento
   *  identico al actual. */
  vectorArriba: [number, number, number] | null;
}

export type PatronPostural =
  | "optima"
  | "cuello_adelantado"
  | "encorvamiento_toracico"
  | "reclinacion_excesiva"
  | "apoyo_asimetrico_codo"
  | "torsion_lateral"
  | "cabeza_ladeada"
  | "postura_desconocida" // camara activa, confianza insuficiente
  | "sin_datos";          // modo simulado: no hay landmarks reales que clasificar

export interface ResultadoClasificacion {
  patronPrincipal: PatronPostural;
  patronesSecundarios: PatronPostural[];
  diagnosticoPrincipal: string;
  /** [0,1]. Baja cuando faltan puntos por poca visibilidad. */
  confianza: number;
  anguloCervical3D: number | null;
  anguloEspalda3D: number | null;
  rotacionCabeza3D: { pitch: number; yaw: number; roll: number } | null;
}
```

`ResultadoPostura` **no se modifica**. El resultado de clasificación es un objeto separado que vive en el estado de `simulacion.ts`, no dentro del resultado del puntaje — así se mantiene el contrato actual de `calcularPuntaje`/`evaluarFrame` intacto para quien ya lo consume.

### [MODIFY] `puntaje.ts`

- `anguloConVertical` se mueve a `geometria-3d.ts` (ver abajo) y se importa aquí. Gana un tercer parámetro opcional:

  ```ts
  // geometria-3d.ts
  export function anguloConVertical(
    desde: Vec3,
    hasta: Vec3,
    verticalIdeal: [number, number, number] = [0, -1, 0],
  ): number { /* misma implementacion que hoy */ }
  ```

- `calcularMetricas` gana un quinto parámetro opcional, con default que preserva el comportamiento actual sin cambios:

  ```ts
  export function calcularMetricas(
    puntos: readonly Landmark[],
    umbrales: UmbralesMetricas,
    offsetCabezaAdelante = 0,
    verticalIdeal: [number, number, number] = [0, -1, 0], // NUEVO
  ): MetricasPostura {
    // ...
    const cuelloVertical = normalizar(
      anguloConVertical(medioHombros, medioOrejas, verticalIdeal),
      umbrales.cuelloVertical,
    );
    // ...
    const alineacionColumna = normalizar(
      anguloConVertical(medioCaderas, medioHombros, verticalIdeal),
      umbrales.alineacionColumna,
    );
    // ...
  }
  ```

  Sin calibración (`verticalIdeal` no se pasa, o es null y el llamador usa el default), el cálculo es exactamente el de hoy — la traducción fiel a `pose_detector.py` queda intacta para el caso heredado. El comentario existente sobre la discrepancia de dirección de `VERTICAL_IDEAL` se conserva tal cual.

### [NEW] `geometria-3d.ts`

Responsabilidades:
- Tipo `Vec3` y operaciones básicas (resta, producto punto, producto cruz, norma, normalizar). Reexporta o reimplementa lo que hoy es privado en `puntaje.ts`, pero como única fuente.
- `anguloConVertical` (movida desde `puntaje.ts`, ver arriba).
- `rotacionCabeza3D(worldLandmarks, vectorArriba): { pitch, yaw, roll }`. Convención fijada explícitamente en el código: orden de rotación **ZYX** (yaw sobre eje vertical calibrado, luego pitch, luego roll), grados. Se documenta como **aproximación por landmarks dispersos, no una pose 6DOF clínica** — comentario obligatorio en la cabecera del archivo, en el mismo espíritu que el aviso de "PENDIENTE" en `app.config.ts`. Se calcula a partir de: `PUNTO.NARIZ`, `PUNTO.OJO_IZQ`, `PUNTO.OJO_DER`, `PUNTO.OREJA_IZQ`, `PUNTO.OREJA_DER`, `PUNTO.BOCA_IZQ`, `PUNTO.BOCA_DER` en `worldLandmarks`. Debe manejar explícitamente el caso de pitch cercano a ±90° (gimbal lock) sin devolver `NaN`.
- `distanciaMetros(a: Vec3, b: Vec3): number` sobre `worldLandmarks` — para proximidad muñeca/codo-cabeza.
- `visiblePara(puntos: readonly Landmark[], indices: number[], umbral: number): boolean` — chequeo de visibilidad reutilizable, usa `config.UMBRAL_VISIBILIDAD_LANDMARK`.

### [NEW] `perspectivas.ts`

Nombre conservado del plan original, pero **con alcance reducido**: solo la calibración del vector vertical personal, no una clasificación de "tipo de cámara".

```ts
/**
 * Deriva el vector "arriba" personal del usuario a partir de un frame de
 * worldLandmarks capturado en postura neutra (el mismo instante que ya usa
 * marcarPosturaNeutra para offsetZ).
 *
 * Se promedia la direccion cadera->hombro y hombro->oreja en espacio metrico
 * 3D, normalizado. Es deliberadamente UN vector por usuario, no una categoria
 * de posicion de camara: ver seccion 0 del plan de implementacion sobre por
 * que no se clasifica la perspectiva.
 *
 * Devuelve null si algun punto necesario tiene visibilidad insuficiente: una
 * calibracion mala afecta dos metricas en cada frame futuro, mas grave que
 * dejar el offsetZ sin calibrar, asi que aqui se es mas estricto.
 */
export function calibrarVectorArriba(
  worldLandmarks: readonly Landmark3D[],
  umbralVisibilidad: number,
): [number, number, number] | null;
```

Test de invariancia: el mismo esqueleto rotado como si la cámara estuviera en distintas posiciones debe producir métricas 2 y 5 estables una vez calibrado — este es el test que reemplaza la promesa (irreal) de "detectar" la perspectiva.

### [NEW] `clasificador-posturas.ts`

Dos funciones, siguiendo el patrón de `maquina-estado.ts`:

```ts
export interface ConfigClasificacion {
  segundosSostenidos: number; // histeresis antes de cambiar el patron mostrado
  umbralVisibilidad: number;
  // umbrales de angulo/distancia, todos PENDIENTE, importados de config
}

export interface EstadoClasificacion {
  patronMostrado: PatronPostural;
  candidato: PatronPostural | null;
  candidatoDesde: number | null; // tiempo monotonico, igual que vigilandoDesde
}

/** Un frame, sin memoria. Requiere worldLandmarks; si son null, devuelve
 *  patronPrincipal: "postura_desconocida" con confianza 0. */
export function clasificarPatron(
  pose: FramePose,
  metricas: MetricasPostura,
  vectorArriba: [number, number, number] | null,
  cfg: ConfigClasificacion,
): ResultadoClasificacion;

/** Con memoria: exige que el candidato se sostenga cfg.segundosSostenidos
 *  antes de reemplazar patronMostrado. Misma forma que avanzar() en
 *  maquina-estado.ts. */
export function avanzarClasificacion(
  estado: EstadoClasificacion,
  candidato: ResultadoClasificacion,
  ahora: number,
  cfg: ConfigClasificacion,
): EstadoClasificacion;
```

Reglas de clasificación (motor de reglas simple, trazable a las métricas — nunca una caja negra):
- `cuello_adelantado`: `anguloCervical3D` sobre umbral Y `metricas.inclinacionCabeza` baja.
- `encorvamiento_toracico`: `anguloEspalda3D` sobre umbral con curvatura hacia adelante.
- `reclinacion_excesiva`: torso inclinado hacia atrás (signo opuesto del anterior) + desplazamiento de cadera.
- `apoyo_asimetrico_codo`: distancia muñeca/codo-cabeza bajo umbral en un solo lado, usando `distanciaMetros` sobre `worldLandmarks`.
- `torsion_lateral`: `rotacionCabeza3D.yaw` sostenido sobre umbral, o `metricas.rotacionHombros` baja de forma persistente.
- `cabeza_ladeada`: `rotacionCabeza3D.roll` sobre umbral.
- `optima`: todo lo anterior dentro de umbral.
- Cualquier punto requerido con visibilidad insuficiente excluye esa regla del cálculo (no fuerza `postura_desconocida` global salvo que falten demasiados puntos para evaluar ninguna regla — umbral de cobertura mínima, también `PENDIENTE`).
- `patronesSecundarios`: cualquier otra regla que también se cumpla, ordenadas por severidad.
- `diagnosticoPrincipal`: texto en español llano generado a partir del patrón principal y su magnitud, sin jerga (ver §5 tabla de jerga prohibida).

### [NEW] Tests
- `geometria-3d.test.ts`: ángulos conocidos, gimbal lock en pitch ±90°, distancias métricas.
- `perspectivas.test.ts`: invariancia de métricas 2/5 ante distintas orientaciones de cámara simuladas, una vez calibrado; comportamiento con visibilidad insuficiente (devuelve null, no un vector inventado).
- `clasificador-posturas.test.ts`: cada patrón con un esqueleto sintético que lo dispara; histéresis (`avanzarClasificacion` no cambia `patronMostrado` con un candidato de menos de `segundosSostenidos`, análogo al test de `maquina-estado.ts` sobre movimientos bruscos de menos de 2 segundos).

---

## 4. Capa de Estado (`app/src/estado/simulacion.ts`)

### [MODIFY]

- **Estado nuevo:**
  ```ts
  calibracionPostural: CalibracionPostural; // reemplaza calibracionCabeza
  clasificacion: EstadoClasificacion;
  ```
  con default `{ offsetZ: 0, vectorArriba: null }` y `{ patronMostrado: "sin_datos", candidato: null, candidatoDesde: null }`.

- **`empujarLandmarks` cambia de firma:**
  ```ts
  // Antes:
  empujarLandmarks(puntos: Landmark[] | null): void;

  // Despues:
  empujarLandmarks(pose: FramePose | null): void;
  ```
  Dentro, en la rama de "sí hay persona":
  ```ts
  procesarMuestra(
    calcularMetricas(
      pose.landmarks,
      s.ajustes.deteccion.umbrales,
      s.calibracionPostural.offsetZ,
      s.calibracionPostural.vectorArriba ?? undefined,
    ),
    dt,
    set,
    get,
    pose, // NUEVO: se pasa la pose completa solo para clasificacion
  );
  ```
  En la rama sin persona (`!puntos`), además de lo que ya hace, degradar `clasificacion.patronMostrado` no se fuerza inmediatamente — se deja que la ausencia de llamadas a `avanzarClasificacion` la deje estancada hasta que vuelva a haber persona; es una decisión de UX menor, documentar la elección en el código.

- **`procesarMuestra` gana un quinto parámetro opcional `pose?: FramePose`:**
  Cuando `pose` está presente (modo cámara) y `s.calibracionPostural.vectorArriba` no es null, se llama a `clasificarPatron` y `avanzarClasificacion`, y el resultado se mezcla en el `set()` junto a lo demás. Cuando `pose` es `undefined` (modo simulado, la llamada que ya existe hoy desde el `setInterval` de `iniciar()`) se deja `clasificacion` sin tocar, ya en su default `"sin_datos"`.

- **Notificaciones**: cuando `transicion.emitirNotificacion` es verdadero y `clasificacion.patronMostrado` no es `"sin_datos"`/`"postura_desconocida"`/`"optima"`, el `cuerpo` de la notificación usa `diagnosticoPrincipal` del resultado de clasificación en vez de un elemento aleatorio de `TEXTOS_ALERTA`. `TEXTOS_ALERTA` se conserva como respaldo genérico para cuando no hay diagnóstico específico disponible (modo simulado, o patrón `"postura_desconocida"`).

- **`marcarPosturaNeutra` cambia de firma:**
  ```ts
  marcarPosturaNeutra(pose: FramePose | null): void {
    if (!pose) return;
    const nariz = pose.landmarks[PUNTO.NARIZ];
    const orejaIzq = pose.landmarks[PUNTO.OREJA_IZQ];
    const orejaDer = pose.landmarks[PUNTO.OREJA_DER];
    if (!nariz || !orejaIzq || !orejaDer) return;
    const medioOrejasZ = (orejaIzq.z + orejaDer.z) / 2;
    const offsetZ = Math.abs(nariz.z - medioOrejasZ);

    const vectorArriba = pose.worldLandmarks
      ? calibrarVectorArriba(pose.worldLandmarks, config.UMBRAL_VISIBILIDAD_LANDMARK)
      : null; // sin worldLandmarks, la calibracion de angulo simplemente no se activa

    set({ calibracionPostural: { offsetZ, vectorArriba } });
  }
  ```
  `offsetZ` se sigue calculando siempre igual que hoy — nunca falla por falta de `worldLandmarks`. `vectorArriba` se degrada con gracia a `null` si no hay datos 3D o si la visibilidad es insuficiente, y el sistema sigue funcionando con el vector fijo heredado.

- **`limpiarCalibracionCabeza` se renombra a `limpiarCalibracionPostural`**, resetea ambos campos.

---

## 5. Capa de UI

### [MODIFY] `camara/vista-camara.tsx` (no estaba en el plan original)

- Prop `landmarks: Landmark[] | null` se alimenta desde `pose?.landmarks ?? null` (ver `pantalla.tsx`).
- Nueva prop `worldLandmarks: Landmark3D[] | null`.
- `onMarcaPosturaNeutra` pasa a recibir la `FramePose` completa, no solo `landmarks`.
- El botón "Marca tu postura normal" se deshabilita si falta `landmarks` **o** el usuario está en el primer intento y `worldLandmarks` es null (se puede seguir permitiendo calibrar solo `offsetZ` con un texto distinto: "Se calibró tu postura, pero no se detectó suficiente profundidad para ajustar el ángulo de cámara" — nunca fallar en silencio).
- El umbral `0.4` hardcodeado en el dibujo del esqueleto se reemplaza por `config.UMBRAL_VISIBILIDAD_LANDMARK`.
- Se añaden al set de puntos dibujados como círculo: `PUNTO.CODO_IZQ, PUNTO.CODO_DER, PUNTO.MUNECA_IZQ, PUNTO.MUNECA_DER`.
- Nuevo elemento de UI: badge de patrón postural (icono + texto, sin color propio — ver decisión §1.10). Oculto o en estado neutro cuando `patronMostrado` es `"sin_datos"`.

### [MODIFY] `funcionalidades/panel-hoy/pantalla.tsx`

- Destructuring de `useSimulacion()` cambia: `calibracionCabeza, marcarPosturaNeutra, limpiarCalibracionCabeza` → `calibracionPostural, marcarPosturaNeutra, limpiarCalibracionPostural`, más `clasificacion`.
- El `useEffect` que empuja landmarks:
  ```ts
  useEffect(() => {
    if (modoCamara) empujarLandmarks(camara.pose); // antes: camara.landmarks
  }, [camara.pose, modoCamara, empujarLandmarks]);
  ```
- Props nuevas hacia `VistaCamara`: `landmarks={camara.pose?.landmarks ?? null}`, `worldLandmarks={camara.pose?.worldLandmarks ?? null}`, `onMarcaPosturaNeutra={() => marcarPosturaNeutra(camara.pose)}`.
- Se muestra el badge de `clasificacion.patronMostrado` y `diagnosticoPrincipal` en el panel, con la traducción a lenguaje llano de §6.

### [MODIFY] `funcionalidades/ajustes/pantalla.tsx`

- Sección informativa (no un selector de categorías): explica en lenguaje llano que la app aprende la orientación de la cámara a partir de la calibración de postura normal, con el mismo botón que ya existe. Ningún dropdown de "tipo de cámara".
- Toggle nuevo: `AjustesDeteccion.clasificacionPatronesActiva: boolean` (default `true`), consistente con cómo `baseline.activo` ya se expone como interruptor.

### [MODIFY] `datos/fixtures/ajustes.ts`

- `AjustesDeteccion` gana `clasificacionPatronesActiva: boolean`.
- `AJUSTES_POR_DEFECTO.deteccion.clasificacionPatronesActiva = true`.
- **`PRESETS_PESOS` no se modifica** — los patrones no entran al vector de pesos ponderado; son una capa de diagnóstico paralela sobre las mismas 7 métricas.

### [MODIFY] `config/app.config.ts`

Nuevas constantes, todas con el mismo comentario `PENDIENTE` que ya usa `UMBRALES_POR_DEFECTO`:

```ts
/** Visibilidad minima para que un punto se dibuje o se use en clasificacion.
 *  Antes vivia hardcodeado en vista-camara.tsx; una sola fuente ahora. */
UMBRAL_VISIBILIDAD_LANDMARK: 0.4,

/** Segundos que un patron candidato debe sostenerse antes de reemplazar el
 *  patron mostrado. Evita parpadeo por ruido de landmarks. */
SEGUNDOS_SOSTENIDOS_PATRON: 3,
```

Y, junto a `UMBRALES_POR_DEFECTO` (con el mismo aviso "PENDIENTE — punto de partida razonado, no medido"):

```ts
export const UMBRALES_PATRON = {
  cuelloAdelantadoGrados: 25,
  encorvamientoGrados: 20,
  reclinacionGrados: 15,
  torsionGrados: 20,
  ladeoGrados: 15,
  distanciaCodoCabezaMetros: 0.15,
} as const;
```

---

## 6. Jerga prohibida en pantalla — tabla ampliada

Extensión de la tabla de CLAUDE.md §2 para el vocabulario nuevo. El test que verifica la frase generada del panel debe cubrir también el texto de `diagnosticoPrincipal` y el badge de patrón.

| No decir | Decir |
|---|---|
| worldLandmarks | (no mencionar) |
| pitch / yaw / roll | "inclinación", "giro", "ladeo" de la cabeza |
| vector arriba / calibración de matriz | "tu postura de referencia" |
| patrón postural (como término técnico) | describir la postura en una frase, no nombrar la categoría interna |
| confianza / cobertura de landmarks | "no se pudo ver bien tu postura en este momento" |

---

## 7. Fuera de alcance / riesgos declarados

- **No se añade un segundo modelo (Face Landmarker).** Los ángulos de cabeza son una aproximación desde 11 puntos dispersos, documentada como tal. Si en el futuro se necesita precisión clínica, es una decisión aparte con su propio costo de rendimiento.
- **`complejidadModelo` (`0 | 1 | 2` en `AjustesDeteccion`) sigue sin conectarse al detector real** (`detector-pose.ts` tiene `pose_landmarker_lite.task` fijo). Codos y muñecas van a ser más ruidosos que hombros/caderas con el modelo lite. Se recomienda evaluar conectar este ajuste como parte de este trabajo, pero es una decisión de producto aparte — no bloquea el resto del plan porque el clasificador ya está diseñado para degradar con gracia ante baja visibilidad.
- **Rendimiento**: el clasificador corre por frame en modo cámara (5 muestras/seg por defecto). Si se nota costoso en equipos de gama media, evaluar ejecutar `clasificarPatron` cada N frames en vez de cada uno — la histéresis de `avanzarClasificacion` ya tolera esto sin cambios porque opera sobre tiempo monotónico, no sobre conteo de frames.
- **Modo simulado sin patrones**: si más adelante se decide que el modo demo necesita mostrar patrones también (por ejemplo para las capturas de pantalla de la tesis), es una extensión deliberada y separada — no se hace por defecto porque violaría §5 de `CLAUDE.md`.

---

## 8. Plan de verificación

1. `cd app && npm run verificar` — deben seguir pasando los tests existentes sin modificación de sus expectativas (los cambios en `calcularMetricas` son aditivos con default retrocompatible).
2. Nuevos tests: `geometria-3d.test.ts`, `perspectivas.test.ts`, `clasificador-posturas.test.ts`, más los casos añadidos a `puntaje.test.ts` (si existe) verificando que `calcularMetricas(puntos, umbrales, offset)` sin cuarto argumento da exactamente el mismo resultado que antes del cambio.
3. `arquitectura.test.ts`: confirmar que `dominio/geometria-3d.ts`, `perspectivas.ts` y `clasificador-posturas.ts` siguen con cero imports externos.
4. Verificación visual: activar cámara real, calibrar postura normal, y comprobar que:
   - El esqueleto dibujado incluye brazos.
   - El badge de patrón cambia con un retraso perceptible (histéresis), no frame a frame.
   - Al no calibrar (`vectorArriba: null`), el puntaje se comporta exactamente igual que antes del cambio.
   - En modo simulado, el badge muestra el estado "sin datos" honesto, nunca un patrón inventado.
