# Auditoría de seguridad — migraciones de Supabase 0001 a 0004

> Alcance: las 7 tablas, sus políticas RLS, las funciones `SECURITY DEFINER`, los privilegios por
> columna, y los secretos del repositorio. **Método: lectura del SQL y del código cliente. Nada se ha
> ejecutado contra una base real**, así que los hallazgos son razonamiento, no una explotación
> demostrada. Lo corregido está en `0005_auditoria_seguridad.sql` y cubierto por
> `supabase/pruebas/rls_fase8.sql`, que tampoco se ha ejecutado.

## Lo que está bien

- RLS activado en las 7 tablas (`organizaciones`, `usuarios`, `eventos_log`, `antecedentes_salud`,
  `antecedentes_cambios`, `historial_diario`, `consentimientos`). Sin política = denegado.
- Sin ninguna política de `delete`, y de `update` solo donde hace falta: los registros de auditoría y
  consentimientos son insert-only.
- `historial_diario` no admite escritura directa, solo por función con validación de rangos y fecha del servidor.
- Ningún secreto en el repositorio: búsqueda de `service_role`, `sb_secret_` y JWT en todo el árbol sin
  resultados; `.env.local` está en `.gitignore` y no está versionado. El único secreto expuesto fue el
  que se pegó en el chat (sigue pendiente rotarlo).

## Corregidos en `0005` (pendientes de ejecutar)

| # | Sev. | Hallazgo | Escenario | Corrección |
|---|---|---|---|---|
| H1 | **Alto** | `usuarios.correo` lo escribía el cliente sin verificar | Un atacante registra su perfil con el correo de la persona a quien RRHH va a promover; el `update ... where correo = X` de asignación lo promueve a él también | `correo` ya no es escribible; un trigger lo toma de `auth.users`. La instrucción de asignación ahora busca por `id` |
| H2 | Medio | `unirse_con_codigo_organizacion` permitía a un `rrhh_jefe` mudarse a otra organización conservando el rol | RRHH de la org A con el código de la B lee los agregados de B. Además estaba concedida a `anon` (sondeo de códigos) | La función rechaza a quien no sea `trabajador`; `EXECUTE` revocado a `public` y `anon` en todas las funciones |
| H3 | Medio | `acumular_historial_diario` topaba cada llamada pero no el total | Llamarla en bucle: 100 h "monitoreadas" en un día, contaminando los agregados de RRHH | El total del día no puede superar el tiempo transcurrido desde la medianoche (+2 min) |
| H4 | Medio | El consentimiento de salud solo se exigía en la interfaz | Una llamada directa a la API guardaba antecedentes sin consentimiento | Las políticas de `antecedentes_*` exigen consentimiento de salud vigente en la base |
| H5 | Bajo | Sin rangos ni tamaños | `horas_sentado_dia = 1e9`; textos de megabytes en el log | `check` de rango y longitud |

La corrección del escalado de privilegios sobre `rol` y `organizacion_id` (privilegios por columna) está
en `0004`.

## Corregidos en `0006` (pendiente de ejecutar; prueba `supabase/pruebas/rls_0006.sql`, sin ejecutar)

| # | Corrección |
|---|---|
| N4 | `crear_organizacion` y `rotar_codigo_organizacion` (solo dueño de la base) generan códigos de 20 hexadecimales (80 bits); `check` de mínimo 12 caracteres (`not valid`, no revisa filas viejas); se borra `DEMO-0001` |
| N5 | `eliminar_mis_datos('ELIMINAR')`: borra cuenta, perfil, antecedentes, historial y consentimientos; deja `eventos_log` anonimizado. Ver [POLITICA_DATOS_LEY_1581.md](POLITICA_DATOS_LEY_1581.md) §6 |
| N6 | Se limpian los `detalle` de `login_fallido`, la base los rechaza y la app ya no los envía |

## Sin corregir: límites reales del diseño

| # | Sev. | Hallazgo | Por qué no se corrigió |
|---|---|---|---|
| N1 | Medio | **`eventos_log` lo escribe el cliente**: cualquiera puede falsificar eventos propios, y sin sesión se puede insertar sin límite (la política permite `usuario_id` nulo para `login_fallido`) | Un log de auditoría escrito por el cliente nunca es a prueba de manipulación. Solución real: escribirlo desde el servidor (Edge Function o trigger sobre `auth`) y limitar el insert anónimo. Es trabajo de diseño |
| N2 | Medio | `antecedentes_cambios` también lo escribe el cliente | Mismo motivo. Un trigger sobre `antecedentes_salud` lo haría fiable, pero hay que decidir cómo registrar el primer guardado |
| N3 | Medio | **Ataque por diferencia a los agregados:** el mínimo de 5 cuentas no protege de un interno. Quien administra el código de la organización puede crear cuentas anónimas falsas con uso conocido, y restarlas del total del día para aislar a una persona real | El mínimo solo cubre el caso honesto. Defensas posibles: ventanas de varios días, ruido diferencial, o cuentas de oficina verificadas. Decisión de producto |
| N4 ✅ 0006 | Medio | **Códigos de organización cortos y sin límite de intentos**; la migración 0001 inserta `DEMO-0001` | Hay que generar códigos largos y aleatorios (≥ 12 caracteres) y borrar la organización demo antes de usar en serio |
| N5 ✅ 0006 | Medio | **No hay forma de borrar los propios datos.** Ninguna política de `delete` | Es lo que en Colombia exige el derecho de supresión de la Ley 1581 de 2012 (verificar con asesoría legal). Falta una función `eliminar_mis_datos` |
| N6 ✅ 0006 | Bajo | `login_fallido` guarda en `detalle` el correo intentado, incluso de personas sin cuenta | Dato personal sin necesidad clara. Dejar de registrarlo, o registrar solo un hash |
| N7 | Bajo | Cada "Anonymous sign-in" crea una fila en `auth.users` | Activar protección contra abuso (CAPTCHA) y limpiar cuentas anónimas inactivas |

## Cómo verificar

1. Ejecutar 0001 → 0005 en orden en el SQL Editor.
2. Ejecutar `supabase/pruebas/rls_fase8.sql`: debe terminar en `TODAS LAS PRUEBAS PASARON`. Cada bloque
   falla con `FALLO: ...` nombrando la regla rota. Si falla por un error de sintaxis o de datos de
   prueba, es un fallo del script, no necesariamente de la política: corregirlo y volver a correr.
3. Ejecutar 0006 y `supabase/pruebas/rls_0006.sql`.
4. N1, N2, N3 y N7 no tienen prueba porque no están corregidos.
