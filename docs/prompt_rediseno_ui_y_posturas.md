# Corrección: rediseño no aplicado + bug real de lectura de postura + selector pendiente

> Sigue a `prompt_rediseno_ui_y_posturas.md`. El agente reportó los cambios como hechos; la
> captura de pantalla muestra que dos de las tres cosas pedidas no se implementaron, y aparece
> un bug funcional nuevo que hay que diagnosticar con evidencia, no adivinar.

---

## 0. Regla para esta ronda

**No se acepta "listo" sin verificar cada criterio de aceptación de este documento uno por
uno, explícitamente.** La ronda anterior se reportó como completa y no lo estaba — el layout
de la tarjeta de métricas es visualmente idéntico al de antes. Esta vez cada sección trae un
criterio verificable, no un principio general.

---

## 1. El rediseño visual no se aplicó

**Evidencia:** la tarjeta "De que se compone tu puntaje" sigue mostrando las 7 métricas
completas, expandidas, con barra + texto explicativo cada una — exactamente la misma
estructura que antes del prompt anterior. `prompt_rediseno_ui_y_posturas.md` §2 pedía
divulgación progresiva explícitamente como punto central, no opcional.

**Criterio de aceptación concreto para esta vez:**

- Por defecto, la tarjeta muestra **solo** la métrica identificada como "lo que más resta"
  (ya se calcula hoy, es el texto "Lo que mas te esta restando ahora").
- Las otras 6 métricas están **colapsadas detrás de un control explícito** — un
  `<details>/<summary>`, un acordeón, o un botón "Ver las 7 métricas" — cerrado por defecto al
  cargar la pantalla.
- Verificación: al abrir el Panel de hoy por primera vez en una sesión, la tarjeta de métricas
  debe ocupar visiblemente menos de la mitad del alto que ocupa hoy en la captura adjunta.
  Si no se puede verificar eso a simple vista, no está hecho.

No se acepta una versión "un poco más compacta" de las 7 tarjetas expandidas. El punto es que
la mayoría de la información esté oculta hasta que el usuario la pida.

---

## 2. Bug: varias métricas leen mal aunque la persona esté bien sentada

### 2.1 El hallazgo que hay que verificar primero, antes de tocar código

Reconstruyendo el valor crudo de cada métrica a partir de los puntos mostrados en la tarjeta
(`metrica = 1 - resta / (peso*100)`):

| Métrica | Valor reconstruido |
|---|---|
| inclinacionCabeza | 0.11 |
| cuelloVertical | 0.11 |
| rotacionHombros | 0.113 |
| alineacionColumna | 0.107 |
| rotacionCabeza | 0.11 |
| nivelHombros | 0.39 |
| inclinacionLateralCabeza | 0.98 |

Cinco métricas con fórmulas totalmente distintas (profundidad nariz-orejas, ángulo contra la
vertical en dos pares de puntos distintos, diferencia de profundidad entre hombros, razón de
distancia entre orejas) caen dentro de un rango de 0.006 entre sí. Eso no es ruido
independiente — apunta a una causa compartida.

La única métrica que sale bien (**inclinacionLateralCabeza = 0.98**) es la única de las siete
que **no usa el canal `z` (profundidad) ni depende de las caderas** — solo compara la altura
(`y`) de las dos orejas.

**Esto no se declara diagnosticado todavía.** Es la pista más fuerte que hay, no una
conclusión. Antes de cambiar una sola línea, verificar en este orden:

### 2.2 Paso 1 — descartar que sea un problema de encuadre, no de código

La captura muestra a la persona muy cerca de la cámara, encuadre tipo selfie, sin caderas
visibles en el cuadro. El canal `z` de MediaPipe está calibrado asumiendo una distancia de
trabajo típica (torso completo o al menos hombros-caderas visibles); a esta distancia el
`z` puede estar genuinamente distorsionado, y las caderas fuera de cuadro obligan al modelo a
extrapolar su posición con baja confianza.

**Acción:** repetir la prueba sentado a una distancia normal de escritorio (como se usaría la
app de verdad: laptop a un brazo de distancia, torso visible). Si los valores se normalizan
solos a esa distancia, **no es un bug de cálculo** — es una condición de encuadre que hoy no
se detecta ni se comunica. En ese caso el arreglo correcto NO es tocar umbrales para que este
caso particular se vea mejor (eso rompería la validez de la métrica en condiciones normales —
es exactamente el antipatrón que `CLAUDE.md` §7 prohíbe: "Bug = causa raíz, no síntoma"). El
arreglo correcto es la compuerta de cobertura del punto 2.4.

### 2.3 Paso 2 — si se reproduce también a distancia normal, verificar código en este orden

1. **Los índices de `PUNTO` no cambiaron.** Al agregar los índices nuevos (codos, muñecas,
   ojos, boca) para el trabajo de patrones posturales, confirmar con un `console.log` o test
   directo que `PUNTO.NARIZ === 0`, `PUNTO.OREJA_IZQ === 7`, `PUNTO.OREJA_DER === 8`,
   `PUNTO.HOMBRO_IZQ === 11`, `PUNTO.HOMBRO_DER === 12`, `PUNTO.CADERA_IZQ === 23`,
   `PUNTO.CADERA_DER === 24` siguen exactamente iguales a los del proyecto original. Un
   índice mal copiado al extender esa constante explicaría una corrupción amplia y repentina
   como la que se ve aquí.
2. **`UMBRALES_POR_DEFECTO` no cambió.** Comparar valor por valor contra los originales:
   `inclinacionCabeza: 2.5, cuelloVertical: 35, nivelHombros: 0.06, rotacionHombros: 0.12,
   alineacionColumna: 30, rotacionCabeza: 0.35, inclinacionLateralCabeza: 0.05`. Si alguno se
   movió al agregar `UMBRAL_VISIBILIDAD_LANDMARK` o `UMBRALES_PATRON`, ahí está el bug.
3. **Instrumentar, no adivinar.** Antes de cambiar nada, loguear temporalmente (o escribir un
   test con datos reales de este caso) los valores crudos que entran a `normalizar()` para
   cada una de las cinco métricas afectadas: el ángulo en grados o la distancia cruda, no el
   resultado ya normalizado. Si los cinco `desviacion/umbral` dan un cociente parecido, el
   problema está antes de `normalizar` (en cómo se leen los puntos). Si dan cocientes muy
   distintos que casualmente normalizan parecido, es coincidencia real de geometría distorsionada
   por el encuadre, y confirma el diagnóstico del punto 2.2.

### 2.4 El arreglo de fondo, con evidencia o sin ella

Independientemente de si la causa es puramente el encuadre de esta prueba: **hoy
`calcularMetricas` no tiene ninguna compuerta de visibilidad.** Usa la posición de cualquier
punto aunque `visibility` sea casi cero (caderas extrapoladas fuera de cuadro, por ejemplo)
como si fuera un dato confiable. Esto ya estaba señalado como hueco en
`plan_implementacion_postura_3d_v2.md`.

Agregar, antes o junto con el resto de este trabajo:

- Un chequeo de visibilidad mínima (`config.UMBRAL_VISIBILIDAD_LANDMARK`) sobre los puntos que
  necesita cada métrica.
- Cuando no se cumple, esa métrica específica no se computa con un número inventado — se marca
  como no disponible, y la interfaz lo dice en lenguaje llano ("Necesito verte un poco más de
  cuerpo para medir esto bien") en vez de mostrar un puntaje bajo que parece una medición real
  pero no lo es. Esto es directamente lo que pide `CLAUDE.md` §5: nunca presentar un dato
  inventado como medido.
- El puntaje total, en ese caso, se recalcula solo sobre las métricas que sí tienen datos
  confiables, con los pesos renormalizados entre ellas — no se le asigna 0 a una métrica sin
  datos, porque eso penalizaría al usuario por algo que la cámara no pudo ver, no por su
  postura real.

---

## 3. El selector de perspectiva sigue sin implementarse

No aparece en la captura. Se pidió en `prompt_rediseno_ui_y_posturas.md` §3.1 con 4 opciones
verticales (frente/lateral/laptop baja/monitor alto); el usuario aclaró que lo que necesita es
más simple: **tres opciones de ángulo horizontal**, en sus propias palabras:

- `Al frente`
- `Al lado`
- `En diagonal`

Reemplazar las 4 opciones originales por estas 3. Todo lo demás de esa sección sigue igual:
es informativo, nunca alimenta el cálculo de `dominio/` directamente, y la corrección real de
ángulo sigue viniendo exclusivamente de la calibración con `worldLandmarks` (botón "Marca tu
postura normal").

**Criterio de aceptación:** el selector con esas 3 opciones debe ser visible en el recuadro de
cámara, tanto en modo simulado como en modo cámara real, antes de reportar esta parte como
terminada.

---

## 4. Antes de decir "listo" esta vez

- [ ] La tarjeta de métricas carga colapsada por defecto, verificado visualmente.
- [ ] Se reprodujo (o se descartó) el bug a distancia normal de escritorio, no solo en el
      encuadre tipo selfie de la captura original.
- [ ] Los índices de `PUNTO` y `UMBRALES_POR_DEFECTO` se verificaron contra los valores
      originales, no solo "revisados de vista".
- [ ] Existe una compuerta de visibilidad antes de calcular cualquier métrica, con mensaje
      honesto cuando falta cobertura — no un número que parece medido y no lo es.
- [ ] El selector de perspectiva con las 3 opciones (Al frente / Al lado / En diagonal) es
      visible y no toca el cálculo de dominio.