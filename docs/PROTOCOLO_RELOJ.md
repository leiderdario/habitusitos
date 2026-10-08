# Protocolo del reloj wearable (Fase 6)

> **Estado: diseño.** No existe firmware ni hardware todavía. Este documento y los tipos de
> `app/src/dominio/tipos.ts` (`LecturaReloj`, `FuenteDato`, `EstadoConexionReloj`) fijan el contrato
> para que la implementación no tenga que inventarlo a mitad de camino.
> Las decisiones que aún dependen del usuario están en [PREGUNTAS_Y_MEJORAS.md](PREGUNTAS_Y_MEJORAS.md),
> marcadas con **[Fase 6]**.

## 1. Principio

Igual que `vision-node/`: el reloj envía **datos livianos en JSON, nunca video ni audio**, y el
sistema **degrada con gracia**: si el reloj falla, la app sigue funcionando solo con visión y lo dice
en pantalla, igual que hoy cae a modo simulado si falla la cámara.

## 2. Qué mide el reloj

| Dato | Para qué |
|---|---|
| Orientación (cuaternión de IMU) | Posición de la muñeca/antebrazo: complementa a la cámara cuando el brazo sale de cuadro o hay mala luz |
| Frecuencia cardíaca | Fase 7: estimar MET (sedentarismo) con la ecuación de Wicks |
| En muñeca (sí/no) | No interpretar lecturas de un reloj sobre la mesa como postura |
| Batería | Avisar "reloj por agotarse" antes de que deje de responder |

Se usa cuaternión y no ángulos de Euler: evita el bloqueo de cardán y es lo que entregan nativamente
los filtros de fusión de IMU.

## 3. Mensaje

Un objeto `LecturaReloj` (ver tipos) por lectura, a **5 Hz** (misma cadencia que
`config.MUESTRAS_POR_SEGUNDO`, para no tener que remuestrear). Ejemplo:

```json
{ "version": 1, "t_ms": 1832400, "orientacion": { "w": 0.98, "x": 0.02, "y": -0.17, "z": 0.05 },
  "fc_bpm": 72, "bateria_pct": 64, "en_muneca": true }
```

- `t_ms` es monotónico desde el arranque del reloj, no hora real: ordena lecturas sin sincronizar relojes.
  La app asigna su propia marca de tiempo al recibirlas.
- `fc_bpm: null` significa "sin lectura válida", **nunca** `0`: un cero se confundiría con un dato.
- `version` permite cambiar el formato sin romper firmware ya instalado.

## 4. Etiqueta de fuente (`FuenteDato`)

Cada valor de postura que llegue a la capa de fusión se etiqueta con qué lo respalda:

| Valor | Condición |
|---|---|
| `solo_vision` | Hay persona en cámara y el reloj no responde o no está en la muñeca |
| `solo_imu` | El reloj responde y la cámara no ve a la persona |
| `ambas` | Las dos responden y coinciden |
| `discordantes` | Las dos responden y no coinciden: se muestra la discrepancia, no se promedia |

El **umbral de discordancia** (cuántos grados de diferencia cuentan como "no coinciden") queda como
**PENDIENTE de calibrar con datos reales**: no se inventa un número ahora (regla de honestidad de datos
de `CLAUDE.md` §5). El tipo y la etiqueta se declaran ya; la función que decide queda para cuando haya
lecturas reales con las que calibrar.

## 5. Conexión y caída del reloj

`EstadoConexionReloj` replica el patrón de `EstadoConexionVisionNode`
(`estado/simulacion.ts`): `inactivo → conectando → conectado → sin_senal → desconectado`.

- Si pasan **más de 5 s sin lecturas** (mismo criterio que el heartbeat del `vision-node`) →
  `sin_senal`, y la fuente cae a `solo_vision`.
- La pantalla lo dice con texto ("El reloj no responde. Revisa que esté cargado y cerca"), no solo con color.
- "Prueba de que el reloj está en carga": el reloj envía `bateria_pct`; bajo un umbral se avisa antes
  de que se apague, en vez de enterarse porque dejó de responder.

## 6. Puente al navegador — dos opciones

| Opción | Cómo | Pros | Contras |
|---|---|---|---|
| **A. Web Bluetooth directo** | `navigator.bluetooth` conecta el reloj con la pestaña (boceto en `docs/prompt_maestro_multipersona_oficina.md` §7.2, módulo futuro `app/src/dispositivos/ble-cliente.ts`) | Sin servidor intermedio; funciona sin red | No existe en Safari ni en iPhone; hay que mantener el navegador abierto y cerca |
| **B. Vía Supabase** | El reloj (o su compañero) publica lecturas a un endpoint; la app las lee | Funciona en cualquier navegador; sobrevive a recargar la pestaña | Requiere red y suma latencia; **sube datos fisiológicos a un servidor**: entra de lleno en la decisión de ética pendiente |

**Recomendación (no es decisión tomada):** A para el prototipo de tesis, por simplicidad y por
mantener los datos de pulso en el equipo. B solo si hay que soportar iPhone, y no antes de resolver
la revisión del comité de ética.

El UUID de servicio y de característica del reloj se fijan al construir el firmware; no se inventan aquí.

## 7. Firmware

El pedido actual es **Python**; el plan maestro original asumía C++/Arduino (fork de
`IEEE-VIT/posture-correct`). Es un **cambio de plan respecto a lo documentado**. Dónde corre ese
Python (MicroPython/CircuitPython en el microcontrolador, o Python en un compañero tipo Raspberry Pi
Zero junto al sensor) cambia el diseño del puente (BLE directo vs red local) y **está pendiente de
confirmar**: ver **[Fase 6]** en PREGUNTAS_Y_MEJORAS.md.

## 8. Privacidad

La frecuencia cardíaca es **dato de salud**, con el mismo trato que los antecedentes (Fase 2):
nunca agregada ni visible a nivel de persona para RRHH (Fase 8), y no sale del equipo del usuario
mientras no se resuelva la revisión de ética (opción A de §6).
