# Preguntas abiertas y mejoras propuestas

> Acordado con el usuario (2026-10-02): **las preguntas y recomendaciones se acumulan aquí durante
> las fases y se resuelven todas juntas al terminar la Fase 8**, después se implementan. Mientras
> tanto el agente decide con un valor por defecto razonable, lo declara, y lo anota aquí.
> Al responder una, marcarla ✅ con la decisión; no borrarla.
>
> Prioridad: 🔴 bloquea algo real · 🟡 cambia el diseño · 🟢 mejora opcional.

---

## A. Preguntas

### Fase 1 — Cuentas
1. 🟡 **Segundo método de login.** Se construyó "código de acceso de organización" (sesión anónima +
   `unirse_con_codigo_organizacion`) porque el pedido original decía "un segundo método que definas".
   Nunca se confirmó. ¿Es el método que quieres? ¿Quién genera esos códigos hoy? No hay pantalla de
   administración: solo se pueden crear por SQL.
2. 🔴 **Rotar la clave `service_role`** de Supabase: quedó escrita en el chat de la sesión del 2026-10-02.
3. 🟡 **Verificación de correo al registrarse:** ¿obligatoria? Afecta a cómo se prueba el registro.

### Fase 2 — Antecedentes
4. 🟡 ¿El formulario de antecedentes se pide **en el registro** (como dice el plan) o solo desde
   `/antecedentes`? Hoy es una pantalla aparte; no está en el flujo de registro.
5. ✅ **DECIDIDO (2026-10-05): la revisión del comité NO incluye aún datos de salud; hay que ampliarla.** Bloqueo: `/antecedentes` no se usa con personas reales hasta la aprobación. Embarazo opcional; se deja de pedir si el comité no lo avala.
   ~~Pregunta original:~~ **Embarazo y otros datos de salud:** ¿la revisión del comité de ética ya incluye datos de salud
   individuales, o hay que ampliarla? Va con la pregunta 14.

### Fase 3 — Personal vs oficina
6. 🟡 ¿Una cuenta de oficina puede tener además uso personal (modo híbrido), o el modo es fijo al registrarse?
7. 🟢 `datos/fixtures/escenarios.ts` está huérfano (guion de una pantalla `/demo` que ya no existe).
   ¿Se elimina?

### Fase 4 — Latencia de webcam
8. 🔴 **Medir** el arranque en un navegador real, con y sin `npm run preparar-camara`. Sin esa cifra la
   fase no está "lista". Las marcas ya están en la consola (`performance.getEntriesByType("mark")`).
9. 🟡 **Calibración por persona en oficina:** ¿hace falta? Cada persona está en un ángulo distinto
   respecto a la misma cámara y hoy no se calibra. ¿Prefieres calibrar por escritorio (una vez, al instalar)
   o por persona (cada vez que se sienta)?

### Fase 5 — Historial
10. 🟡 **Retención:** ¿cuánto tiempo se guarda el historial diario? Hoy, indefinido.
11. 🟡 **Borrado:** la pantalla decía "puedes borrarlo desde Ajustes". Revisar si Ajustes borra el
    historial de Supabase (el texto ya se reescribió, pero la función de borrado puede no existir).
12. 🟡 **Hojas del export SST** "por sala" y "pausas": ¿se persiste el agregado de la oficina (de
    `vision-node/`) en una tabla por sala y día? Sin eso no hay fuente para la hoja 2.
13. 🟡 ¿El "% de mala postura" usa el umbral 60 (`config.UMBRAL_MALA_POSTURA`) o el que el usuario
    configure en Ajustes? Hoy usa el fijo.

### Transversales / ética
14. ✅ **DECIDIDO (2026-10-05): "El video nunca sale de la sala".** El video no se graba ni sale del equipo/nodo de la sala; solo viajan métricas numéricas (y agregados anónimos en oficina) a la cuenta. Falta: el texto de consentimiento debe decir dónde corre el stream de video del `vision-node/`. Sigue pasando por el comité de ética.
    ~~Pregunta original:~~ **Privacidad y red:** ¿qué promesa de privacidad reemplaza al "cero llamadas de red"? Ahora hay
    WebSocket, Supabase y (opcional) pulso del reloj. Hay que decidirla **antes** de pruebas con
    personas reales, y probablemente pasa por el comité de ética.
15. ✅ **Cubierta por la 30 (2026-10-05):** aviso físico en la sala, sujeto al comité de ética.
    ~~Pregunta original:~~ **Consentimiento informado** para monitorear a terceros identificables en una oficina real.
16. 🟡 **Ejecutar las migraciones** 0001, 0002 y 0003 en Supabase y activar "Anonymous sign-ins". Sin
    esto, nada de lo construido funciona de verdad. No se pudo hacer desde el código.
17. 🟡 **Prueba visual de todo:** ninguna pantalla nueva se ha visto en un navegador (no había Chromium
    disponible). Hace falta una pasada manual completa antes de cualquier demostración.

### Fase 6 — Reloj (protocolo documentado en `docs/PROTOCOLO_RELOJ.md`)
18. 🟡 **[Fase 6] ¿Dónde corre el Python del reloj?** MicroPython/CircuitPython en el microcontrolador, o
    Python en un compañero tipo Raspberry Pi Zero junto al sensor. Cambia el puente (BLE directo vs red
    local) y el consumo de batería. El plan maestro asumía C++/Arduino: es un cambio de plan.
19. 🟡 **[Fase 6] ¿Qué hardware concreto?** (IMU y sensor de pulso). Fija el UUID de servicio BLE, la
    frecuencia real de muestreo y la precisión del pulso en muñeca (la óptica en muñeca es ruidosa con
    movimiento: puede no servir para MET fino).
20. 🟡 **[Fase 6] Puente A (Web Bluetooth) o B (vía Supabase).** Recomendación del agente: A para la tesis.
    B sube pulso (dato de salud) a un servidor. No funciona A en iPhone/Safari: ¿hay usuarios con iPhone?
21. 🟡 **[Fase 6] Umbral de "discordantes":** ¿cuántos grados de diferencia entre cámara e IMU? No se
    inventó; hay que calibrarlo con lecturas reales (lo primero que se haga cuando exista el reloj).
22. 🟢 **[Fase 6] ¿Frecuencia de envío a 5 Hz?** Se eligió para coincidir con el muestreo de la app; el
    reloj gasta menos batería a 1–2 Hz si la postura no necesita más.

### Fase 7 — Sedentarismo y pausas (diseño en `docs/DISENO_PAUSAS_Y_SEDENTARISMO.md`)
23. ✅ **DECIDIDO (2026-10-05): pausas bloqueadas hasta validación clínica.** Quedan apagadas por defecto (hoy ya no están conectadas a la interfaz); se activan solo cuando un fisioterapeuta/asesor SST revise la tabla.
    ~~Pregunta original:~~ **[Fase 7] Validación clínica** de la tabla de contraindicaciones (túnel carpiano, hernia,
    embarazo, etc.). ¿Hay un fisioterapeuta o asesor de SST que la revise? Sin eso no se debe mostrar
    ninguna pausa a una persona real.
24. 🟡 **[Fase 7] ¿Cuánto tiempo sentado antes de avisar?** Se dejó 45 min; la tolerancia a interrupciones
    en 60 s y la posposición en 10 min. Son valores de arranque. ¿Los fija SST de la organización o
    cada usuario (como opciones etiquetadas, no campo libre)?
25. 🟡 **[Fase 7] ¿Sin reloj, el aviso de pausa sigue siendo útil?** Sin MET, "sentado" incluye a quien
    está de pie frente a la cámara pero sentado en un balón, etc. ¿Se acepta esa imprecisión en el
    modo solo-cámara?
26. 🟡 **[Fase 7] ¿Qué se registra de una pausa?** Propuesta: tomada / pospuesta / ignorada en
    `eventos_log`. ¿Eso es aceptable para el comité de ética? Si RRHH llegara a ver "ignoradas" por
    persona sería vigilancia: debería quedar solo agregado.
27. 🟢 **[Fase 7] Contenido de las pausas guiadas:** ¿texto, ilustración, video corto? El plan dice
    60–90 s con contenido distinto según zona y antecedentes.
28. 🟢 **[Fase 7] Hidratación y 20-20-20:** ¿siempre activas, o solo si la persona las activa en Ajustes?

### Fase 8 — Roles, RRHH y consentimientos
29. 🔴 **Ejecutar `0004` y luego `supabase/pruebas/rls_fase8.sql`.** La 0004 cierra una escalada de
    privilegios de la Fase 1 (cualquier cuenta podía hacerse `rrhh_jefe`). Hasta entonces el hueco existe
    en la base real. La prueba nunca se ha ejecutado: puede tener errores propios y hay que correrla.
30. ✅ **DECIDIDO (2026-10-05): solo aviso físico en la sala.** Límite declarado: es consentimiento implícito, el más débil de las tres opciones; el agente lo recomendó fuera de esta (formulario previo + opt-out). Se implementa el aviso en la app y la confirmación de que el aviso está colocado; queda **sujeto a la aprobación del comité de ética** (CLAUDE.md §10) antes de monitorear a personas reales. Cubre también la 15.
    ~~Pregunta original:~~ **Consentimiento en oficina compartida.** El consentimiento lo da la *cuenta* (código de
    organización), pero a quienes monitorea la cámara son personas distintas que nunca aceptaron nada.
    ¿Cómo se obtiene el de cada persona? (aviso físico en la sala, formulario previo, opt-out por
    persona…). Es el punto más débil de ética del producto.
31. 🟡 **[Fase 8] Mínimo de 5 cuentas por día en la vista RRHH.** Valor de arranque. Con equipos de menos
    de 5 puestos la vista quedaría siempre vacía. ¿Se baja, o se agrega en ventanas de varios días?
32. 🟡 **[Fase 8] "Cuenta" no es "persona" en oficina:** una cuenta compartida cuenta como 1 fuente aunque
    la use un puesto con varios turnos. ¿Se muestra como "equipos" y no "personas"? Hoy dice "cuentas activas".
33. 🟡 **[Fase 8] Comparativa "tu sala vs meta":** el plan la menciona con una meta (ej. 30 %). No inventé la
    meta. ¿Quién la fija: SST de la organización, o se toma de una guía?
34. 🟡 **[Fase 8] ¿Cómo se crea una organización y su primer RRHH?** Hoy solo por SQL. ¿Hace falta un flujo
    de alta, o basta con proceso manual para la tesis?
35. 🟡 **[Fase 8] Retirar el consentimiento de cámara desde Ajustes:** el texto lo promete, pero no existe
    el control en Ajustes. Hay que construirlo (el dato ya soporta retirar: es una fila nueva).
36. 🟡 **[Fase 8] ¿Los textos de consentimiento los redacta/revisa el comité de ética o un abogado?**
    Los actuales son borrador de ingeniería. Cambiar un texto cambia `VERSION_CONSENTIMIENTOS`.
37. 🟢 **[Fase 8] Informe semanal por correo** (backlog explícito): ¿sigue siendo deseable, y a quién
    se envía (solo RRHH, con los mismos agregados)?

### Auditoría de seguridad (detalle en `docs/AUDITORIA_SEGURIDAD_SUPABASE.md`)
38. ✅ **DECIDIDO (2026-10-05): construir `eliminar_mis_datos`; el log se conserva anonimizado** (filas con `usuario_id` nulo y sin detalle personal). Borra cuenta, historial, antecedentes y consentimientos. Validar con asesoría legal (Ley 1581).
    ~~Pregunta original:~~ **N5 — Borrado de datos propios.** Hoy no existe. ¿Se construye `eliminar_mis_datos` (borra cuenta,
    historial, antecedentes y consentimientos)? ¿Qué se conserva del log de auditoría? Conviene validarlo con
    asesoría legal (Ley 1581 de 2012).
39. ✅ **DECIDIDO (2026-10-05): ventana semanal + confiar en RRHH, documentado.** El mínimo de 5 cuentas se evalúa sobre la semana, no el día; se declara que el administrador del código es de confianza (el ataque se reduce, no se elimina).
    ~~Pregunta original:~~ **N3 — Ataque por diferencia a los agregados.** Quien administra el código de la organización puede aislar
    a una persona con cuentas falsas. ¿Se acepta confiar en RRHH, o se agrega por ventanas de varios días /
    se añade ruido / se verifican las cuentas de oficina?
40. 🟡 **N1/N2 — Logs escritos por el cliente.** ¿Cuánta fuerza probatoria necesitan? Si el comité o SST los
    van a usar como evidencia, hay que moverlos al servidor.
41. 🟡 **N4 — Códigos de organización.** ¿Quién los genera y con qué longitud? Borrar la organización `DEMO-0001`
    antes del uso real. ¿Se agrega caducidad y rotación?
42. 🟢 **N6/N7** — Dejar de guardar el correo de los intentos fallidos y activar CAPTCHA para inicios anónimos.

*(Fin de las fases: este archivo está completo para responderse.)*

---

## B. Mejoras y recomendaciones

0. 🔴 **Auditar las demás policies de las migraciones 0001–0003 con la misma lupa** que encontró la
   escalada de `usuarios`: revisar que ninguna otra permita escribir columnas que la app no debe tocar
   (ej. `antecedentes_*`, `historial_diario`, `consentimientos`). La función `acumular_historial_diario` y
   los privilegios por columna son el patrón a replicar.

1. 🟡 **Pruebas de RLS reales.** El plan pide un script que pruebe que un usuario no lee la fila de otro
   ni con consulta directa. Aún no existe; es la prueba más importante del producto. Proponer un script
   con dos usuarios de prueba en Supabase.
2. 🟡 **Code splitting.** El bundle principal pasó de ~968 KB a ~1.18 MB (ExcelJS ya va en carga diferida,
   pero queda todo lo demás). Dividir por rutas con `React.lazy`.
3. 🟡 **Pantalla de administración de códigos de organización** (crear, revocar, ver caducidad). Hoy es SQL.
4. 🟢 **Registrar `cambio_perfil` y `exportacion`** de forma uniforme: `exportacion` ya se registra desde
   el historial; `cambio_perfil` existe en el tipo pero nadie lo emite al guardar antecedentes.
5. 🟢 **Tests de integración de la capa `datos/api/`** contra un Supabase local (`supabase start`): hoy
   solo se prueba `dominio/`, que es puro.
6. 🟢 **Medir el arranque de cámara en CI** con Playwright y una cámara falsa
   (`--use-fake-device-for-media-stream`) para que la latencia no regrese sin que nadie se entere.
7. 🟢 **Rebranding a Espinker** en una pasada aparte (plan en `/home/dari/.claude/plans/`).
8. 🟢 **Actualizar `docs/GUIA_DEMO.md`**, desactualizada respecto al modo oficina y al registro con cuenta.
9. 🟢 **Informe semanal por correo** y **botón "falso positivo"**: backlog del plan; el segundo es barato y
   útil para evaluar umbrales en la tesis.
10. 🟢 **`CardTitle` renderiza `<div>`** en vez de encabezado: arreglar antes de una auditoría de accesibilidad.
