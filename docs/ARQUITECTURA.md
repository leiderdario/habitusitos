# Arquitectura del prototipo

| Campo | Detalle |
|---|---|
| Documento | Decisiones de arquitectura y reglas de organización |
| Ámbito | El prototipo navegable (`app/`). Para el producto final ver [DE_MOCK_A_REAL.md](DE_MOCK_A_REAL.md) |
| Estado | Vigente. Las reglas se verifican automáticamente en `app/src/arquitectura.test.ts` |

---

## 1. Qué es y qué no es este código

**Es** un prototipo navegable con todas las pantallas del producto, con la lógica de dominio implementada de verdad y el resto simulado de forma determinista.

**No es** el producto. El producto final es una aplicación de escritorio Windows en Python + PyQt6 + MediaPipe.

Esa distinción gobierna todas las decisiones que siguen. La pregunta que se hizo en cada una fue: **¿esto se tira cuando llegue el software real, o se traduce?**

| Capa | Destino |
|---|---|
| `dominio/` | **Se traduce**, línea por línea, a Python |
| `datos/api/` | **Se traduce**: cada función pasa a ser una consulta a SQLite |
| `datos/fixtures/`, `datos/almacen.ts` | **Se tira** |
| `camara/` | **Se traduce** conceptualmente (Tasks API en Python) |
| `componentes/`, `funcionalidades/` | **Se traduce** a widgets de PyQt6, no se reutiliza |
| `estado/` | **Se tira** (PyQt6 tiene su propio modelo de estado) |

---

## 2. Metodología

**Base:** [bulletproof-react](https://github.com/alan2207/bulletproof-react) — 35 mil estrellas y, sobre todo, una regla de dependencias que se puede **verificar automáticamente**. Una regla de arquitectura que solo vive en un README se rompe en la tercera semana y nadie se entera.

**Vocabulario:** español, siguiendo [Screaming Architecture](https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25). Un `src/` con `components/ hooks/ utils/` grita "aplicación de React". Uno con `dominio/ camara/ funcionalidades/` grita lo que el sistema hace.

**SOLID, aplicado de verdad y no como decoración:**

| Principio | Dónde se ve |
|---|---|
| **S** — una responsabilidad | `puntaje.ts` calcula, `maquina-estado.ts` decide cuándo avisar, `baseline-adaptativo.ts` aprende. Ninguno hace lo del otro. |
| **O** — abierto/cerrado | El baseline adaptativo **extiende** el motor de puntaje sin tocarlo: `aplicarBaseline` transforma las métricas antes de que `calcularPuntaje` las reciba. Se puede apagar y el sistema vuelve al comportamiento heredado. |
| **L** — sustitución | Las dos fuentes de muestras (simulada y cámara real) entran por la misma función `procesarMuestra`. Son intercambiables. |
| **I** — interfaces específicas | `ConfigAlertas`, `ConfigBaseline`, `UmbralesMetricas` son tipos por operación, no un objeto de configuración gigante que todo el mundo recibe entero. |
| **D** — depender de abstracciones | Las pantallas dependen de `datos/api/*`, no del almacén ni de las fixtures. Cuando `datos/api/*` pase a hablar con SQLite, ninguna pantalla cambia. |

---

## 3. Las capas y la regla

```
config → dominio → datos → camara → componentes → funcionalidades → app
```

**Una capa solo puede importar de capas anteriores o de sí misma.**

```
app/src/
├─ config/          Fuente única de umbrales, límites, banderas y semilla
├─ dominio/         Lógica pura. CERO imports externos. Con tests.
├─ datos/           El "backend" simulado. La frontera.
│  ├─ api/          Lo único que las pantallas pueden llamar
│  ├─ fixtures/     Datos de ejemplo. Nadie fuera de api/ los toca.
│  ├─ cliente.ts    Latencia artificial, errores, catálogo de mensajes
│  ├─ semilla.ts    PRNG determinista. La ÚNICA fuente de azar.
│  └─ almacen.ts    localStorage. Nadie fuera de api/ lo toca.
├─ camara/          Modo cámara real. Aislado: si falla, cae a simulado.
├─ componentes/
│  ├─ comunes/      Piezas propias reutilizables
│  ├─ layout/       Marco, barra lateral, bandeja, notificaciones
│  └─ ../components/ui/   Primitivas shadcn/ui (código de terceros, en inglés)
├─ funcionalidades/ Una carpeta por pantalla
├─ estado/          Zustand. Solo estado de interfaz y el motor en vivo.
└─ utils/           Formato. Todo Intl con la zona y el locale de config.
```

### 3.1 Reglas duras, todas verificadas por test

`app/src/arquitectura.test.ts` recorre el árbol de archivos y falla la suite si se rompe alguna:

| Regla | Por qué |
|---|---|
| Ninguna capa importa de una capa posterior | Es lo que hace posible traducir `dominio/` a Python sin arrastrar la mitad del proyecto |
| **`dominio/` no importa NADA externo** — ni React, ni la config, ni el store | Es lo único que el desarrollador real puede portar línea por línea |
| Ninguna funcionalidad importa de otra funcionalidad | Si algo se comparte entre pantallas, sube a `componentes/comunes/` |
| Las pantallas nunca importan `datos/fixtures/*`, `datos/almacen.ts` ni `datos/semilla.ts` | Todo pasa por `datos/api/*`. Si una pantalla lee la fixture directo, migrar al backend real obliga a reescribir esa pantalla |
| **Ningún componente escribe un color en crudo** | Sin esto, el modo oscuro y el contraste AA se rompen a pedazos |
| **Nada usa `Math.random()` ni `new Date()` sin argumentos** | Dos demostraciones consecutivas tienen que verse idénticas |

> Esta última regla ya cazó dos violaciones reales durante la construcción: la pantalla de ajustes y la de demostración importaban fixtures directamente. Se corrigieron moviendo los datos a la frontera (`listarPresetsPesos()`, `listarEscenarios()`), no silenciando el test.

### 3.2 Por qué un test y no ESLint

`eslint-plugin-import` con `import/no-restricted-paths` haría lo mismo. Se descartó porque:

- Son ~80 líneas sin dependencias nuevas (ESLint + el plugin + typescript-eslint son tres paquetes y una configuración que mantener).
- Corre con el resto de la suite: `npm test` y ya.
- **El mensaje de error explica POR QUÉ existe la regla** en vez de escupir un código. Cuando alguien la rompa dentro de seis meses, el mensaje le dice qué hacer.

---

## 4. El núcleo: `dominio/`

Es lo único de este repositorio que sobrevive intacto al producto real.

| Archivo | Qué hace | Procedencia |
|---|---|---|
| `tipos.ts` | Espejo literal del esquema SQLite | Heredado (§4.7 y §12) |
| `puntaje.ts` | Las siete métricas geométricas ponderadas | **Heredado** — traducción de `ml/pose_detector.py` |
| `maquina-estado.ts` | Cuándo avisar: buena → vigilando → alerta → pausa | Heredado + refinado |
| `estadisticas.ts` | Rachas, promedio móvil, declive intra-sesión | Heredado (§4.6) |
| `baseline-adaptativo.ts` | **Aporte 1 de tesis** | **Nuevo** |
| `postura-de-prueba.ts` | Generador de esqueletos con geometría controlada | Nuevo (soporte) |

### 4.1 Por qué los campos persistidos están en inglés

Los tipos que representan filas de base de datos (`FilaPuntaje`, `FilaBaseline`, `MuestraBenchmark`) usan `snake_case` inglés **a propósito**: son nombres de columna que **ya existen** en `data/database.py`. Traducirlos aquí crearía una capa de conversión que mantener y un sitio donde el prototipo y la base de datos real podrían divergir en silencio.

Todo lo demás —conceptos, funciones, variables— va en español.

**Regla:** si un campo cambia aquí, cambia en la migración SQL. Y al revés.

### 4.2 Trazabilidad de autoría

Cada archivo declara en su cabecera si es heredado de BatesPosture o aporte propio, y por qué está donde está. No es documentación decorativa: el §0.3 del prompt maestro lo exige porque el autor debe defender el código ante un jurado.

---

## 5. La frontera: `datos/`

Es lo que hace que el prototipo se sienta como un producto y lo que permite migrar sin reescribir pantallas.

### 5.1 `cliente.ts` — el contrato

```ts
resolver("SELECT ... FROM posture_scores", () => datos)
```

Cada llamada declara **la consulta real que hará el producto** y simula latencia. Tres decisiones deliberadas:

1. **Latencia artificial determinista.** Sin ella la demostración se siente falsa: nada tarda nunca y el cliente no ve los estados de carga que el producto real sí tendrá.
2. **`MODO_DATOS=http` lanza un error explícito** en vez de fingir. Un modo a medias que devuelve datos simulados en silencio es la peor forma posible de descubrir que la integración no estaba hecha.
3. **El catálogo de errores está en español y con acción sugerida.** Ningún error termina en un callejón sin salida y ninguno muestra una traza técnica.

### 5.2 `semilla.ts` — determinismo

`mulberry32` con semilla fija y una fecha ancla en UTC. Existe por una razón práctica: si el cliente pide *"muéstrame otra vez lo del baseline"* y salen números distintos, la demostración pierde el hilo y la confianza.

Es el **único archivo autorizado a usar `Math.random`**, y la regla se verifica por test.

### 5.3 Las fixtures cuentan una historia

El historial de 98 días no es ruido: hay mejora progresiva con recaídas, los viernes caen (que es el patrón que la vista de día de semana existe para revelar), los fines de semana casi no hay uso y los festivos ninguno.

La sesión de hoy tiene un bajón sostenido a media tarde. **No es decorativo:** sin él, ninguna muestra del baseline sería rechazada y la pantalla del aporte 1 mostraría 100 % de aceptación — exactamente lo contrario de lo que hay que demostrar. Las salvaguardas se ven cuando rechazan algo.

El historial del baseline **se genera ejecutando el motor real**, no escribiendo resultados a mano. Si mañana se ajusta una salvaguarda, la gráfica se ajusta con ella y no queda mintiendo.

---

## 6. El motor: `estado/simulacion.ts`

Un solo camino de cálculo para las dos fuentes de muestras:

```
MODO SIMULADO ─┐
               ├─▶ métricas ─▶ puntaje ─▶ máquina de estados
MODO CÁMARA   ─┘                     └─▶ baseline adaptativo
```

Que las dos converjan es lo que hace honesto el modo cámara: el número que ve el cliente cuando se sienta frente a la webcam sale de la fórmula del §4.4, no de una aproximación hecha para la demostración.

**Vive fuera de React** a propósito: el bucle no debe reiniciarse porque una pantalla se monte o se desmonte.

### 6.1 Suavizado: qué se suaviza y qué no

El criterio de aceptación del RF-1 exige *"un score de postura estable, sin saltos erráticos frame a frame"*. A cinco muestras por segundo, mostrar el valor crudo lo incumple.

**Se suavizan las métricas, no el puntaje**, y el puntaje visible se recalcula a partir de ellas. Suavizar el puntaje por separado desincronizaría el desglose: las siete barras dejarían de sumar el número grande, que es justo lo que el panel promete y lo que un jurado va a verificar.

El valor **crudo** se conserva aparte para el sparkline y el historial: ahí la variabilidad es información, no ruido.

---

## 7. Cámara real: aislamiento

`camara/` es la única capa que puede fallar por causas fuera del control del código: permisos, dispositivo ocupado, desconexión a mitad, ausencia de hardware.

**Contrato: nunca rompe la aplicación.** Si algo falla, expone el error traducido y el motor sigue en modo simulado. El modo cámara es un extra demostrativo, no un requisito para presentar.

Los recursos de MediaPipe (≈50 MB entre WASM y modelo) **no se versionan**. Se regeneran con `npm run preparar-camara` y, si no están, el detector cae a CDN con la versión fijada. Así el repositorio queda ligero y la demostración funciona sin internet cuando hace falta.

---

## 8. Datos externos

**Una sola API pública**: [Nager.Date](https://date.nager.at) para marcar festivos colombianos en el calendario. Marcarlos explica los huecos: sin eso, un puente de tres días parece abandono de la aplicación, y es justo lo contrario.

Con **tabla de respaldo local**, que no es un adorno: durante esta investigación se comprobó que `api.quotable.io` —una API que llevaba años funcionando— está muerta. El día de la sustentación no puede depender de que un servicio gratuito siga arriba.

> ⚠️ **Esto es exclusivo del prototipo.** El software real **no hace ninguna llamada de red**. Es una promesa de producto del §8.4 hacia los 15–70 participantes, no una preferencia técnica.

---

## 9. Deuda declarada

Cosas que se dejaron a propósito, con su razón:

| Qué | Por qué | Cuándo resolverlo |
|---|---|---|
| El bundle principal pesa ~305 KB comprimidos | Recharts + React + Base UI. Para un prototipo local es irrelevante | Si se despliega público, dividir por rutas |
| `CardTitle` renderiza `<div>`, no un encabezado | Es una primitiva de terceros vendorizada; cambiarla se salía del alcance acordado | Antes de una auditoría de accesibilidad formal |
| Los umbrales de sensibilidad de las siete métricas son un punto de partida razonado, no medido | El §8.2 exige fijarlos con datos reales | Con la muestra de 15–70 participantes |
| El factor de compensación del baseline (0,6) es una decisión de diseño | Ídem | Ídem |
| No hay tests de componentes | Es un prototipo visual; un test de render aquí daría una falsa sensación de cobertura | Cuando exista lógica de interfaz no trivial |

---

## 10. Verificación

```bash
cd app
npm test          # 65 tests: dominio + reglas de arquitectura
npm run build     # tipos + build de producción
npm run lint
npm run verificar # los tres seguidos
```

Los tests de `dominio/` son el contrato. En particular, `baseline-adaptativo.test.ts` verifica que **una racha larga de mala postura no mueve la referencia**: si alguien quita la compuerta de calidad o el congelado en alerta, ese archivo se pone rojo. Un test que no falla al revertir el arreglo que cubre no ha probado nada.
