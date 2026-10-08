-- Hallazgos N4, N5 y N6 de docs/AUDITORIA_SEGURIDAD_SUPABASE.md.
--
-- Ejecutar despues de 0005. Idempotente. Probar con supabase/pruebas/rls_0006.sql.
--
-- Despues de ejecutarla hay que crear la organizacion real (la demo se borra aqui):
--   select * from crear_organizacion('Nombre de la organizacion');
-- El codigo se muestra una sola vez en ese resultado; se puede rotar con
-- rotar_codigo_organizacion(<id>).

-- ---------------------------------------------------------------------------
-- N6 (bajo). `login_fallido` guardaba el correo intentado en `detalle`, incluso
-- de personas sin cuenta. Se limpia lo ya guardado y la base deja de aceptarlo.
-- Tambien se agrega el tipo `cuenta_eliminada` para N5.
-- ---------------------------------------------------------------------------
update eventos_log set detalle = null where tipo = 'login_fallido' and detalle is not null;

alter table eventos_log drop constraint if exists eventos_log_tipo_check;
alter table eventos_log
  add constraint eventos_log_tipo_check check (
    tipo in (
      'login_exitoso', 'login_fallido', 'logout',
      'camara_iniciada', 'camara_detenida', 'exportacion', 'cambio_perfil',
      'cuenta_eliminada'
    ));

alter table eventos_log drop constraint if exists eventos_log_login_fallido_sin_detalle;
alter table eventos_log
  add constraint eventos_log_login_fallido_sin_detalle check (tipo <> 'login_fallido' or detalle is null);

-- ---------------------------------------------------------------------------
-- N4 (medio). Codigos de organizacion cortos y adivinables.
-- `not valid`: no revisa filas ya existentes, solo las nuevas o modificadas.
-- ---------------------------------------------------------------------------
delete from organizaciones where codigo_acceso = 'DEMO-0001';

alter table organizaciones drop constraint if exists organizaciones_codigo_largo;
alter table organizaciones
  add constraint organizaciones_codigo_largo check (length(codigo_acceso) >= 12) not valid;

-- 20 caracteres hexadecimales (80 bits) en grupos de 4. Salen de gen_random_uuid(),
-- que es aleatorio fuerte; se saltan el caracter 13 (version) y el 17 (variante),
-- que no son aleatorios.
create or replace function generar_codigo_organizacion()
returns text
language sql
volatile
as $$
  select upper(
    substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4) || '-' ||
    substr(h, 18, 4) || '-' || substr(h, 22, 4))
  from (select replace(gen_random_uuid()::text, '-', '') as h) t;
$$;

-- Solo el dueno de la base (SQL Editor) o service_role: no hay alta desde la app.
create or replace function crear_organizacion(p_nombre text)
returns table (organizacion_id uuid, codigo_acceso text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_nombre is null or length(btrim(p_nombre)) = 0 then
    raise exception 'nombre-requerido';
  end if;
  return query
    insert into organizaciones (nombre, codigo_acceso)
    values (btrim(p_nombre), generar_codigo_organizacion())
    returning id, organizaciones.codigo_acceso;
end;
$$;

create or replace function rotar_codigo_organizacion(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := generar_codigo_organizacion();
begin
  update organizaciones set codigo_acceso = v_codigo where id = p_id;
  if not found then
    raise exception 'organizacion-inexistente';
  end if;
  return v_codigo;
end;
$$;

revoke execute on function generar_codigo_organizacion() from public, anon, authenticated;
revoke execute on function crear_organizacion(text) from public, anon, authenticated;
revoke execute on function rotar_codigo_organizacion(uuid) from public, anon, authenticated;

-- Mismo cuerpo que en 0005, normalizando el codigo escrito a mano (espacios y
-- minusculas), porque los codigos generados son largos y se teclean.
create or replace function unirse_con_codigo_organizacion(p_codigo text)
returns table (organizacion_id uuid, organizacion_nombre text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org organizaciones%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sesion-requerida';
  end if;
  if exists (select 1 from usuarios where id = auth.uid() and rol <> 'trabajador') then
    raise exception 'rol-no-permitido';
  end if;

  select * into v_org from organizaciones where codigo_acceso = upper(btrim(p_codigo));
  if v_org.id is null then
    raise exception 'codigo-organizacion-invalido';
  end if;

  insert into usuarios (id, modo_uso, organizacion_id, nombre)
  values (auth.uid(), 'oficina', v_org.id, 'Oficina')
  on conflict (id) do update
    set modo_uso = 'oficina', organizacion_id = v_org.id;

  return query select v_org.id, v_org.nombre;
end;
$$;

revoke execute on function unirse_con_codigo_organizacion(text) from public, anon;
grant execute on function unirse_con_codigo_organizacion(text) to authenticated;

-- ---------------------------------------------------------------------------
-- N5 (medio). Derecho de supresion (Ley 1581 de 2012, art. 8): la persona puede
-- borrar sus datos.
--
-- SE BORRA: la cuenta de auth.users y, por cascada, el perfil (usuarios), los
--   antecedentes de salud y su historico de cambios, el historial diario y los
--   consentimientos.
-- SE CONSERVA, ANONIMIZADO: eventos_log. Las filas del titular quedan con
--   usuario_id nulo y detalle nulo (sin forma de volver a la persona), y se suma
--   una fila `cuenta_eliminada` sin autor. Sirve para auditoria de seguridad
--   (cuantos accesos, cuantas supresiones) sin dato personal.
-- NO SE CONSERVAN los consentimientos: una copia sin titular no prueba nada y una
--   con titular contradice la supresion. Ver docs/POLITICA_DATOS_LEY_1581.md para
--   la justificacion y el punto que debe confirmar la asesoria legal.
--
-- Los agregados que RRHH ya consulto no se recalculan hacia atras; hacia adelante
-- la cuenta deja de contar como fuente.
--
-- El borrado es irreversible, por eso exige escribir ELIMINAR. La sesion actual
-- sigue siendo un JWT valido hasta que expire: la aplicacion debe cerrar sesion.
-- ---------------------------------------------------------------------------
create or replace function eliminar_mis_datos(p_confirmacion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sesion-requerida';
  end if;
  if p_confirmacion is distinct from 'ELIMINAR' then
    raise exception 'confirmacion-requerida';
  end if;

  update eventos_log set usuario_id = null, detalle = null where usuario_id = v_uid;
  insert into eventos_log (usuario_id, tipo) values (null, 'cuenta_eliminada');

  -- usuarios, antecedentes_*, historial_diario y consentimientos caen por cascada.
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function eliminar_mis_datos(text) from public, anon;
grant execute on function eliminar_mis_datos(text) to authenticated;
