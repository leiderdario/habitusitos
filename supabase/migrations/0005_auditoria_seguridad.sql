-- Auditoria de seguridad de las migraciones 0001-0004. Ver docs/AUDITORIA_SEGURIDAD_SUPABASE.md
-- para el detalle y la severidad de cada hallazgo.
--
-- Ejecutar despues de 0004. Es idempotente: se puede correr dos veces sin dano.
-- Probar con supabase/pruebas/rls_fase8.sql.

-- ---------------------------------------------------------------------------
-- H1 (alto). `usuarios.correo` lo escribia el cliente, sin verificar contra la
-- cuenta real. Quien asigna el rol RRHH con `where correo = ...` podia terminar
-- promoviendo a un atacante que se hubiera puesto el correo de la victima en su
-- perfil. Ahora el correo sale siempre de auth.users, nunca del cliente.
-- ---------------------------------------------------------------------------
revoke insert (correo) on usuarios from authenticated;

create or replace function fijar_correo_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.correo := (select u.email from auth.users u where u.id = new.id);
  return new;
end;
$$;

drop trigger if exists usuarios_fijar_correo on usuarios;
create trigger usuarios_fijar_correo
  before insert on usuarios
  for each row execute function fijar_correo_desde_auth();

-- ---------------------------------------------------------------------------
-- H2 (medio). `unirse_con_codigo_organizacion` dejaba que un rrhh_jefe se mudara
-- a otra organizacion con solo conocer su codigo, conservando el rol, y asi leer
-- los agregados de la otra. Tambien estaba concedida a `anon`, que no puede
-- usarla (necesita auth.uid()) pero si sondear si un codigo existe.
-- ---------------------------------------------------------------------------
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

  select * into v_org from organizaciones where codigo_acceso = p_codigo;
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

-- Postgres concede EXECUTE a PUBLIC por defecto en toda funcion nueva.
revoke execute on function unirse_con_codigo_organizacion(text) from public, anon;
grant execute on function unirse_con_codigo_organizacion(text) to authenticated;
revoke execute on function acumular_historial_diario(numeric, numeric, numeric) from public, anon;
revoke execute on function resumen_equipo(int, int) from public, anon;

-- ---------------------------------------------------------------------------
-- H3 (medio). `acumular_historial_diario` topaba cada llamada (3600 s) pero no el
-- total: llamandola en bucle una cuenta podia "monitorear" 100 horas en un dia,
-- ensuciando su historial y los agregados de RRHH. Ahora el total del dia no puede
-- superar el tiempo realmente transcurrido desde la medianoche (+ 2 min de holgura
-- para un lote que cruza la medianoche).
-- ---------------------------------------------------------------------------
create or replace function acumular_historial_diario(
  p_segundos numeric,
  p_puntaje_ponderado numeric,
  p_segundos_mala numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ahora_local timestamp := now() at time zone 'America/Bogota';
  hoy date := ahora_local::date;
  transcurrido numeric := extract(epoch from (ahora_local - date_trunc('day', ahora_local)));
  actual numeric;
begin
  if auth.uid() is null then
    raise exception 'sesion requerida';
  end if;
  if p_segundos < 0 or p_segundos > 3600
     or p_segundos_mala < 0 or p_segundos_mala > p_segundos
     or p_puntaje_ponderado < 0 or p_puntaje_ponderado > p_segundos * 100 then
    raise exception 'valores fuera de rango';
  end if;

  select h.segundos_monitoreados into actual
  from historial_diario h where h.usuario_id = auth.uid() and h.fecha = hoy;
  if coalesce(actual, 0) + p_segundos > transcurrido + 120 then
    raise exception 'excede-tiempo-transcurrido';
  end if;

  insert into historial_diario as h
    (usuario_id, fecha, segundos_monitoreados, puntaje_ponderado, segundos_mala_postura)
  values (auth.uid(), hoy, p_segundos, p_puntaje_ponderado, p_segundos_mala)
  on conflict (usuario_id, fecha) do update set
    segundos_monitoreados = h.segundos_monitoreados + excluded.segundos_monitoreados,
    puntaje_ponderado = h.puntaje_ponderado + excluded.puntaje_ponderado,
    segundos_mala_postura = h.segundos_mala_postura + excluded.segundos_mala_postura,
    actualizado_en = now();
end;
$$;

grant execute on function acumular_historial_diario(numeric, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- H4 (medio). El consentimiento de salud solo se exigia en la aplicacion: una
-- llamada directa a la API guardaba antecedentes sin consentimiento. Ahora lo exige
-- la base. (No comprueba la VERSION del texto: eso sigue siendo cosa de la app.)
-- ---------------------------------------------------------------------------
create or replace function tengo_consentimiento_salud()
returns boolean
language sql
stable
as $$
  select coalesce(
    (select c.aceptado from consentimientos c
      where c.usuario_id = auth.uid() and c.tipo = 'salud'
      order by c.creado_en desc limit 1),
    false);
$$;

drop policy if exists "crear los propios antecedentes" on antecedentes_salud;
drop policy if exists "editar los propios antecedentes" on antecedentes_salud;
drop policy if exists "escribir el propio historico de cambios" on antecedentes_cambios;

create policy "crear los propios antecedentes"
  on antecedentes_salud for insert
  with check (usuario_id = auth.uid() and tengo_consentimiento_salud());

create policy "editar los propios antecedentes"
  on antecedentes_salud for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid() and tengo_consentimiento_salud());

create policy "escribir el propio historico de cambios"
  on antecedentes_cambios for insert
  with check (usuario_id = auth.uid() and tengo_consentimiento_salud());

-- ---------------------------------------------------------------------------
-- H5 (bajo). Rangos y tamanos: sin ellos se guardan 1e9 horas sentado o textos
-- de megabytes en el log.
-- ---------------------------------------------------------------------------
alter table antecedentes_salud drop constraint if exists horas_sentado_dia_rango;
alter table antecedentes_salud
  add constraint horas_sentado_dia_rango check (horas_sentado_dia between 0 and 24);

alter table eventos_log drop constraint if exists eventos_log_detalle_largo;
alter table eventos_log
  add constraint eventos_log_detalle_largo check (detalle is null or length(detalle) <= 200);

alter table antecedentes_cambios drop constraint if exists antecedentes_cambios_largo;
alter table antecedentes_cambios
  add constraint antecedentes_cambios_largo check (
    length(campo) <= 80 and length(valor_nuevo) <= 200
    and (valor_anterior is null or length(valor_anterior) <= 200));
