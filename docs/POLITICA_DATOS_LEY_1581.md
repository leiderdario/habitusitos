# Tratamiento de datos personales — Ley 1581 de 2012 y habeas data

> **Borrador de ingeniería para el anteproyecto.** No lo redactó ni lo revisó un abogado ni el comité de
> ética. Lo que depende de una decisión que no es técnica está marcado **PENDIENTE**. Las referencias
> legales son las normas que rigen el tema en Colombia (Constitución art. 15; Ley 1581 de 2012; Decreto
> 1377 de 2013, compilado en el Decreto 1074 de 2015); **los artículos citados deben verificarse con
> asesoría legal** antes de presentarlo como política vigente.

## 1. Alcance y responsable

| Elemento | Contenido |
|---|---|
| Sistema | Habitusitos: monitoreo de postura por cámara (`app/` en Vercel, cuentas y datos en Supabase, `vision-node/` en el equipo local). |
| Responsable del tratamiento | **PENDIENTE.** En la prueba de la tesis: la persona autora, bajo la Universidad de Cartagena. Si una organización lo usa en su oficina, esa organización decide para qué se usan los datos de sus trabajadores y sería la responsable; el proyecto sería encargado. Hay que fijarlo por escrito antes de la prueba. |
| Contacto para consultas y reclamos | **PENDIENTE** (un correo institucional dedicado; no se inventa aquí). |
| Encargados | Supabase (base de datos y autenticación) y Vercel (alojamiento de la interfaz). **PENDIENTE:** región del proyecto de Supabase; si está fuera de Colombia, aplica el régimen de transmisión/transferencia internacional (Ley 1581 art. 26 y Decreto 1377). |

## 2. Qué datos se tratan

| Dato | Dónde | Categoría | Origen |
|---|---|---|---|
| Correo, nombre, modo de uso, rol, organización | `auth.users`, `usuarios` | Personal (privado) | La persona |
| Antecedentes de salud (columna, manos, **embarazo**, dolor crónico, horas sentado…) | `antecedentes_salud`, `antecedentes_cambios` | **Sensible (salud)** | La persona, opcional |
| Resumen diario: minutos monitoreados, puntaje, % de mala postura | `historial_diario` | Personal; derivado de la postura | Calculado en el navegador |
| Consentimientos con versión del texto aceptado | `consentimientos` | Personal (evidencia) | La persona |
| Eventos de acceso y uso (sin correo ni IP aplicativa) | `eventos_log` | Personal mientras tenga `usuario_id` | Cliente |
| **Imagen de la persona frente a la cámara** | Solo en memoria del navegador o del `vision-node` | **Tratada como sensible/biométrica**, ver §3 | Cámara |
| Puntos del cuerpo (esqueleto) y ángulos | Solo en memoria | Ídem | Calculado en el equipo |

**No se almacena:** video, fotogramas ni puntos del cuerpo. Cada cuadro se analiza y se descarta. Lo único
que llega a Supabase de la cámara es el resumen diario. El `vision-node` no se despliega en la nube: el
video no sale del equipo donde corre (`127.0.0.1`), y su transmisión a la app exige un ticket de un solo
uso (ver [SEGURIDAD_VISION_NODE.md](SEGURIDAD_VISION_NODE.md)).

## 3. Video y postura: tratamiento como dato sensible

La Ley 1581 (art. 5) define como sensibles los datos que afectan la intimidad o cuyo uso indebido puede
generar discriminación, y cita entre ellos los de salud y los **biométricos**. Esta política los trata así:

- El sistema **no identifica personas**: no hace reconocimiento facial ni compara contra una plantilla
  de identidad. Estrictamente, la postura derivada del esqueleto no es un biométrico de identificación.
  Se adopta, aun así, el criterio **más protector** porque (a) la imagen permite reconocer a la persona,
  (b) la postura en el tiempo puede revelar condiciones de salud y (c) en oficina las personas
  monitoreadas pueden no haber elegido estar ahí. **PENDIENTE:** que asesoría legal confirme si el
  procesamiento local, sin conservación, cae o no bajo la definición de tratamiento sensible.
- Consecuencias prácticas: autorización previa, expresa e informada; ninguna obligación de responder
  sobre datos sensibles; finalidad única; sin conservación del video; sin cesión.
- En **modo oficina**, la autorización la da la cuenta (código de la organización), pero la cámara ve a
  personas que pueden no haber aceptado nada. La decisión tomada (pregunta 30 de
  [PREGUNTAS_Y_MEJORAS.md](PREGUNTAS_Y_MEJORAS.md)) fue **aviso físico en la sala**, que es
  consentimiento implícito, el más débil de las tres opciones. **Queda sujeto a la aprobación del comité de
  ética** y no se monitorea a personas reales identificables antes (CLAUDE.md §10). Un trabajador sin
  alternativa real de negarse tampoco da una autorización libre: es el principal riesgo jurídico del
  modo oficina y debe discutirse con el comité.

## 4. Finalidad

1. Mostrar a la persona su postura en tiempo real y sugerirle pausas.
2. Guardar su historial diario para que ella vea su evolución.
3. En oficina, ofrecer a RRHH **solo agregados** por organización, con un mínimo de 5 cuentas activas
   (`resumen_equipo`). RRHH no puede leer filas individuales, antecedentes ni perfiles.
4. Los antecedentes de salud sirven solo para adaptar las sugerencias de pausas de esa misma persona.
5. Evidencia académica de la tesis, únicamente con datos agregados y sin identificar.

**Usos que no se hacen:** evaluar el desempeño laboral, decisiones disciplinarias o de contratación,
publicidad, venta o cesión a terceros, ni diagnóstico médico.

## 5. Base legal y autorización

- **Autorización previa, expresa e informada del titular** (Ley 1581 arts. 4 y 9). Se captura en la
  aplicación con tres consentimientos separados (`camara` obligatorio para usar la cámara; `salud` y
  `reloj` opcionales), cada uno con la **versión del texto aceptado** y la fecha, en `consentimientos`
  (solo inserción). Retirar un consentimiento es una fila nueva.
- Para los datos sensibles se informa que **no es obligatorio responder** (art. 6): la cuenta funciona sin
  consentimiento de salud, y la base lo exige para guardar antecedentes (migración 0005, H4).
- Los textos actuales (`dominio/consentimientos.ts`, versión `2026-10-borrador-1`) son borrador.
  **PENDIENTE:** que los revise el comité de ética o un abogado. Deben añadirse: finalidad completa,
  derechos del titular, canal de contacto, y que el video se procesa en el equipo local.
- **PENDIENTE:** menores de edad (art. 7). Se supone que solo usan el sistema mayores de edad; no hay
  verificación.

## 6. Derechos del titular (art. 8)

| Derecho | Cómo se ejerce hoy |
|---|---|
| Conocer, actualizar y rectificar | La persona ve y edita su perfil y antecedentes en la aplicación. Cada cambio de antecedentes queda en `antecedentes_cambios`. |
| Prueba de la autorización | Tabla `consentimientos`: qué texto (versión) y cuándo. |
| Ser informado del uso | Esta política y los textos de consentimiento. |
| Revocar la autorización | Nueva fila `aceptado = false`. **PENDIENTE:** el control en Ajustes no está construido (pregunta 35). |
| **Supresión** | Función `eliminar_mis_datos('ELIMINAR')` (migración 0006). **PENDIENTE:** botón en la aplicación. Mientras no exista, se atiende a solicitud por correo, ejecutando la función con el identificador de la cuenta. |
| Acceso gratuito | **PENDIENTE:** exportación de todos los datos propios (hoy existe la exportación del historial, no la de perfil y consentimientos). |
| Queja ante la Superintendencia de Industria y Comercio | Se informa en la política publicada. |

Plazos legales: consultas, 10 días hábiles (prorrogables 5); reclamos, 15 días hábiles (prorrogables 8).
**PENDIENTE:** confirmar los plazos con asesoría legal e indicar el proceso interno.

### Qué hace la supresión

| Se borra | Se conserva |
|---|---|
| Cuenta de acceso, perfil, antecedentes y su historial de cambios, historial diario, **consentimientos** | `eventos_log`, **anonimizado**: `usuario_id` y `detalle` en nulo, más un evento `cuenta_eliminada` sin autor |

Decisión: **los consentimientos también se borran**. Una copia sin titular no prueba el consentimiento de
nadie y una copia con titular contradice la supresión. **PENDIENTE de asesoría legal:** si la obligación
de acreditar la autorización (Decreto 1377) exige conservar esa prueba por un tiempo después de la
supresión; si así fuera, la alternativa es conservar solo `(tipo, versión, fecha)` sin identificador, que
no prueba nada individual y por eso no se implementó. El log anonimizado no es dato personal porque ya no
se puede vincular a la persona; **PENDIENTE:** confirmarlo, y definir cuánto tiempo se conserva.

Límites que se declaran: los agregados que RRHH ya consultó no se recalculan hacia atrás; en oficina,
borrar la cuenta compartida borra el historial de esa cuenta, que representa a un equipo.

## 7. Retención

| Dato | Propuesta | Estado |
|---|---|---|
| Video, fotogramas, esqueleto | No se conservan (solo memoria) | Implementado |
| Perfil, antecedentes, historial, consentimientos | Mientras exista la cuenta; se borran con la supresión | Implementado (borrado a petición) |
| Cuentas inactivas | Borrado automático tras un periodo | **PENDIENTE:** el periodo (p. ej. 12 meses) es una decisión; no hay tarea que lo ejecute. Incluye las cuentas anónimas de oficina que se acumulan (N7) |
| `eventos_log` anonimizado | Conservar para auditoría de seguridad | **PENDIENTE:** el plazo |
| Fin de la tesis | Borrar la base de la prueba o anonimizarla de forma irreversible | **PENDIENTE:** fecha |

## 8. Seguridad (resumen verificable)

- RLS en las 7 tablas; sin política de borrado; escritura del historial solo por función con tope de
  tiempo. Auditoría y correcciones en [AUDITORIA_SEGURIDAD_SUPABASE.md](AUDITORIA_SEGURIDAD_SUPABASE.md);
  pruebas en `supabase/pruebas/`.
- Cabeceras de seguridad y CSP en `app/vercel.json`; `vision-node` autenticado con el token de
  Supabase, solo en loopback.
- Códigos de organización largos y aleatorios (migración 0006); el correo intentado en un acceso fallido
  ya no se guarda.
- **Límites reconocidos:** el log lo escribe el cliente (N1, N2); el administrador del código es de
  confianza (N3); no hay limitación de intentos de códigos más allá de la de Supabase Auth.

## 9. Pendientes para que esto sea una política publicable

1. Responsable, encargados y correo de contacto.
2. Revisión jurídica de §3 (sensible o no) y de la retención de la prueba de autorización (§6).
3. Región de Supabase y régimen de transmisión internacional.
4. Textos de consentimiento revisados y completados (finalidad, derechos, contacto, video local).
5. Aprobación del comité de ética para el modo oficina.
6. Botón de supresión, control de retiro de consentimiento y exportación completa en la aplicación.
7. Registro Nacional de Bases de Datos de la SIC: **verificar si aplica** (depende del tipo de
   responsable); para una tesis podría no ser obligatorio.
8. Periodos de retención (§7).
