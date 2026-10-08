# Diseño: sedentarismo, MET y pausas activas (Fase 7)

> **Estado:** la lógica de dominio está implementada y probada con datos deterministas
> (`app/src/dominio/sedentarismo.ts`, `pausas-activas.ts`). **No está conectada** a la interfaz ni a
> `estado/`, y no existe reloj físico que la alimente. Contrato de datos del reloj:
> [PROTOCOLO_RELOJ.md](PROTOCOLO_RELOJ.md). Preguntas abiertas: marcadas **[Fase 7]** en
> [PREGUNTAS_Y_MEJORAS.md](PREGUNTAS_Y_MEJORAS.md).

## 1. Qué es sedentarismo aquí

Criterio SBRN: **sentado y MET ≤ 1,5**. Sin reloj no hay MET, así que basta con estar sentado
(la postura la da la cámara). Con reloj, estar sentado con MET alto (por ejemplo, pedaleando en un
escritorio-bici) no cuenta como sedentario.

`MET ≈ 6 · FC / FC_reposo − 5` (Wicks), acotado a un mínimo de 1. Devuelve `null`, nunca un número
inventado, si falta el pulso o el de reposo.

## 2. Pulso en reposo (calibración explícita)

`estimarFcReposo`: mediana de la última ventana **continua, quieta y con pulso válido** de al menos
4 min. Antes de tenerla, `null` y no hay MET. Es el mismo principio que el baseline postural: se
calibra, no se asume. La mediana resiste picos sueltos.

## 3. Bouts

`avanzarBout` es un reductor puro (estado + muestra → estado). Una interrupción de menos de
`toleranciaInterrupcionSegundos` (60 s, **valor de arranque sin respaldo en datos propios**) no rompe el
bout y su tiempo se suma: agacharse a recoger algo no es una pausa activa. Una más larga lo cierra.
Los bouts cerrados de ≥ 60 min se cuentan en `boutsLargos` (columna "bouts > 60 min" del export SST).

## 4. Aviso de pausa: una máquina, dos pasos

```
bout >= 45 min ──▶ aviso en RELOJ ──(30 s sin respuesta)──▶ aviso en PANTALLA
                   (sin reloj: directo a pantalla)
respuesta: tomada → rearma desde 45 min · pospuesta/ignorada → vuelve a avisar en +10 min
```

- **Ignorar no acelera el aviso.** Insistir más rápido a quien ignora sería vigilancia, no ayuda; la
  respuesta "ignorada" se registra aparte para la tesis.
- Cada respuesta se registrará en `eventos_log` (Fase 1). Falta añadir los tipos de evento
  (`pausa_tomada`, `pausa_pospuesta`, `pausa_ignorada`) en la migración cuando se conecte.
- Hidratación y regla 20-20-20 son pausas del catálogo (`general`) y salen por el mismo mecanismo; no
  hay lógica nueva.

## 5. Qué pausa proponer

`elegirPausa(zona, antecedentes)` toma la zona que falla (cuello / espalda / muñeca / general) y
descarta las pausas cuyos antecedentes contraindicados estén marcados (Fase 2). Si ninguna de la zona
es apta cae a **caminar**, que no está contraindicada en el catálogo, así siempre hay propuesta.
Sin antecedentes cargados (`null`) se asume apta: no bloquear la pausa por un formulario sin llenar.

Mapeo previsto de patrón postural a zona (`clasificador-posturas.ts`): `cuello_adelantado`,
`cabeza_ladeada` → cuello · `encorvamiento_toracico`, `reclinacion_excesiva`, `torsion_lateral` →
espalda · `apoyo_asimetrico_codo` → muñeca · resto → general.

> ⚠ **Las contraindicaciones son una propuesta de ingeniería, conservadora, sin revisión clínica.**
> Un fisioterapeuta debe validarlas antes de mostrar una pausa a una persona real. Ante la duda se
> excluye. Esta aplicación no diagnostica ni prescribe.

## 6. Lo que falta para cerrar la fase de verdad

1. Conectar estas funciones a `estado/` (bout y aviso corriendo en la sesión) y a la interfaz
   (aviso, pausa guiada de 60–90 s con contenido por zona).
2. Persistir bouts y pausas (alimenta las hojas "por persona" y "pausas" del export SST, Fase 5).
3. Contenido de cada pausa guiada (texto e ilustración) y su revisión clínica.
4. Un reloj físico, y calibrar con datos reales los valores de arranque (45 min, 10 min, 60 s).
