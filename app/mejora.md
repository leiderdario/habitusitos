# Instrucciones de implementación: feedback de estado y degradación de gracia en modo "Cámara de oficina"

> **Para el asistente de código:** este documento continúa el trabajo de `instrucciones-migracion-habitusitos-multi-persona.md`, ya completado (el pipeline `vision-node/` ↔ WebSocket ↔ frontend funciona correctamente). Lo que sigue son dos correcciones puntuales de UX/lógica identificadas en la segunda auditoría, más un ajuste menor de claridad visual. No son cambios de arquitectura — son ajustes localizados sobre componentes que ya existen.

**Diagnóstico de partida (no volver a auditar, ya está confirmado):**
- El WebSocket a `vision-node/` conecta y transmite correctamente. No hay bug de conectividad.
- El problema es que la UI no comunica su propio estado de conexión, y que el cálculo de puntaje colapsa a "no identificada" en vez de degradarse con gracia cuando falta un keypoint por baja confianza.

---

## Paso 1 — Máquina de estados de conexión del `vision-node`

**Dónde:** junto al estado de personas del Paso 1 de `instrucciones-migracion-habitusitos-multi-persona.md` (`estado/simulacion.ts`), agregar un estado hermano, independiente del estado de las poses:

```typescript
type EstadoConexionVisionNode =
  | { tipo: "inactivo" }                                    // modo "Webcam personal" activo, no aplica
  | { tipo: "conectando" }
  | { tipo: "conectado_sin_personas" }
  | { tipo: "conectado_con_personas"; cantidad: number }
  | { tipo: "desconectado"; motivo?: string };
```

**Cómo se deriva (sin tocar el backend):**
- Al abrir el WebSocket → `conectando`.
- En el evento `onopen` del socket → `conectado_sin_personas`.
- En cada mensaje recibido con `personas: []` (array vacío) → `conectado_sin_personas`.
- En cada mensaje recibido con `personas.length > 0` → `conectado_con_personas` con `cantidad = personas.length`.
- En `onclose` o `onerror`, o si no llega ningún mensaje durante más de N segundos (timeout de heartbeat, recomendado 5s ya que el análisis corre a 2-5 FPS) → `desconectado`.
- Al cambiar el toggle a "Webcam personal" → cerrar el socket explícitamente y volver a `inactivo` (no dejar el socket abierto en segundo plano sin uso).

**Importante:** este estado es **independiente** del estado de las poses (`personas` del documento anterior). Un socket puede estar `conectado_sin_personas` (todo bien, simplemente no hay nadie en el encuadre) sin que eso sea un error — no confundir "sin personas" con "desconectado" en ningún punto del código.

---

## Paso 2 — Banner de estado visible en `vista-camara.tsx`

**Archivo:** `app/src/funcionalidades/panel-hoy/vista-camara.tsx`

Cuando el modo activo es "Cámara de oficina", renderizar un banner fijo en la parte superior del recuadro (donde hoy está el lienzo vacío/gris), con el siguiente mapeo de texto y color:

| Estado | Texto | Color |
|---|---|---|
| `conectando` | "Conectando al servidor de visión…" | Gris/neutro, con spinner |
| `conectado_sin_personas` | "Conectado — buscando personas en el encuadre" | Verde tenue |
| `conectado_con_personas` | "Conectado — {cantidad} persona(s) detectada(s)" | Verde |
| `desconectado` | "Sin conexión con el servidor de visión" + botón "Reintentar" | Rojo |

Este banner **reemplaza** el lienzo vacío actual que genera la confusión de "parece caído" — no debe convivir un lienzo en blanco sin texto junto a los esqueletos; el usuario siempre debe tener una frase que le diga qué está pasando, incluso cuando todo funciona bien y simplemente no hay nadie en cuadro.

**Validación de este paso:**
1. Alternar a "Cámara de oficina" con el servidor apagado → debe verse "conectando" y luego "desconectado", nunca quedarse en silencio.
2. Alternar a "Cámara de oficina" con el servidor encendido pero sin nadie frente a la cámara → debe verse "buscando personas en el encuadre", no un lienzo vacío ambiguo.
3. Pararse frente a la cámara → debe pasar a "1 persona detectada" y aparecer el esqueleto.

---

## Paso 3 — Degradación de gracia en el cálculo de puntaje (en vez de "no identificada" todo-o-nada)

**Archivo:** `app/src/dominio/puntaje.ts`

**Comportamiento actual (a corregir):** si algún punto requerido tiene confianza por debajo del umbral (0.30), el sistema completo cae a "Postura no identificada".

**Comportamiento deseado:** el mismo patrón que ya existe para la métrica "Espalda alineada" (que se excluye individualmente y se recalcula el puntaje con las métricas restantes) debe aplicarse a **todas** las métricas, no solo a esa.

**Cambio a implementar:**
1. Definir explícitamente, para cada una de las 7 métricas, qué keypoints requiere y con qué confianza mínima.
2. Antes de calcular cada métrica individual, verificar si sus keypoints requeridos cumplen el umbral. Si no, marcar esa métrica como `no_visible` (igual que ya hace "Espalda alineada") en vez de abortar el cálculo completo.
3. El puntaje final se calcula únicamente con las métricas visibles, re-normalizando los pesos (tal como ya lo hace la UI cuando excluye una métrica — reutilizar esa misma lógica de re-normalización, generalizándola a N métricas excluidas en vez de asumir que máximo se excluye una).
4. Solo cuando el número de métricas visibles caiga por debajo de un mínimo (ver Paso 4) se debe mostrar "Postura no identificada" — no cuando falte una sola métrica de siete.

**Validación de este paso:** con un frame de prueba donde 2 de las 7 métricas no tengan confianza suficiente (simular ocultando esos keypoints), el sistema debe mostrar un puntaje calculado con las 5 restantes — igual que ya hace hoy cuando falta solo "Espalda alineada" — en vez de "no identificada".

---

## Paso 4 — Definir el umbral mínimo de métricas visibles (⚠️ decisión pendiente, no asumir un número sin confirmar)

Antes de que "Postura no identificada" tenga sentido como resultado final, hay que decidir: **¿cuántas de las 7 métricas deben ser visibles como mínimo para que el puntaje calculado sea confiable?**

- Recomendación de partida para discutir con el desarrollador: mínimo 3 de 7 métricas visibles. Con menos de eso, un puntaje calculado sería estadísticamente poco representativo de la postura real.
- Este número debe ser una constante configurable (`MINIMO_METRICAS_VISIBLES = 3`), no un valor mágico enterrado en la lógica, porque es razonable que se ajuste durante el piloto según qué tan seguido ocurre en la práctica (ángulos diagonales muy cerrados, por ejemplo).
- Cuando se cae por debajo de este mínimo, el mensaje al usuario debería ser más específico que "no identificada" a secas — considerar algo como: "No se pudo ver suficiente de tu postura desde este ángulo. Intenta ajustar la cámara." — para que el usuario entienda que es un problema de encuadre, no un fallo del sistema (conecta con el Problema A: nunca dejar al usuario sin saber si algo está roto o simplemente no hay datos suficientes).

---

## Paso 5 — Claridad visual de qué fuente está activa

En la captura de pantalla compartida se observó que, durante la prueba con ángulo diagonal, el botón visualmente resaltado seguía siendo "Webcam personal" aunque la intención era probar "Cámara de oficina". Esto sugiere que el estado activo/inactivo de esos dos botones no es lo suficientemente claro.

**Cambio a implementar:** asegurar que el botón de la fuente activa tenga un contraste inequívoco (por ejemplo, fondo sólido + texto en negrita en el botón activo, vs. fondo transparente + texto gris en el inactivo — no solo un cambio sutil de tono), y que el cambio de fuente dispare inmediatamente el banner del Paso 2 (para que quede claro, sin ambigüedad, cuál fuente está efectivamente alimentando el recuadro en cada momento).

---

## Orden de ejecución resumido

```
1. Estado de conexión (EstadoConexionVisionNode) en estado/simulacion.ts
2. Banner de estado en vista-camara.tsx, reemplazando el lienzo vacío actual
3. Degradación de gracia por métrica en dominio/puntaje.ts (generalizar el patrón ya existente de "Espalda alineada")
4. Definir MINIMO_METRICAS_VISIBLES como constante configurable (confirmar valor con el desarrollador)
5. Reforzar el contraste visual del botón de fuente activa
```

Después de estos 5 pasos, el modo "Cámara de oficina" debería sentirse tan confiable como el modo "Webcam personal" — con feedback explícito de qué está pasando en todo momento, y sin caer a "no identificada" solo porque un ángulo cerrado oculta una métrica de siete.