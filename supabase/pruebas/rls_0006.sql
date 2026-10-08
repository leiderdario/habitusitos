-- Prueba de la migracion 0006 (N4 codigos de organizacion, N5 supresion, N6 log).
-- Ejecutar DESPUES de 0006. NO deja datos: todo ocurre en una transaccion que termina
-- en ROLLBACK. Cada bloque lanza "FALLO: ..." si la regla no se cumple y el script
-- termina con la fila "TODAS LAS PRUEBAS PASARON".
--
-- Aviso: ejecutar con el rol dueno (el del SQL Editor). Si falla por sintaxis o por
-- datos de prueba, es un fallo del script, no necesariamente de la migracion.

begin;

-- ---- Datos de prueba (como dueno, sin RLS) ----
insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p6_' || g || '@ejemplo.test'
from generate_series(1, 3) g;

insert into organizaciones (id, nombre, codigo_acceso)
values ('00000000-0000-0000-0000-0000000000c3', 'Org C de prueba', 'PRUEBA-C-0000-0000');

insert into usuarios (id, rol, organizacion_id)
select id, 'trabajador', '00000000-0000-0000-0000-0000000000c3'
from auth.users where email like 'p6_%@ejemplo.test';

create temp table ids as
  select (select id from usuarios u join auth.users a using (id) where a.email = 'p6_1@ejemplo.test') as borrado,
         (select id from usuarios u join auth.users a using (id) where a.email = 'p6_2@ejemplo.test') as otro,
         (select id from usuarios u join auth.users a using (id) where a.email = 'p6_3@ejemplo.test') as nuevo;
grant select on ids to authenticated, anon;

-- Datos de los dos primeros usuarios en todas las tablas que guardan algo.
insert into consentimientos (usuario_id, tipo, version, aceptado)
select x, 'salud', 'v1', true from (select borrado x from ids union all select otro from ids) t;
insert into antecedentes_salud (usuario_id, embarazo)
select x, true from (select borrado x from ids union all select otro from ids) t;
insert into antecedentes_cambios (usuario_id, campo, valor_nuevo)
select x, 'embarazo', 'true' from (select borrado x from ids union all select otro from ids) t;
insert into historial_diario (usuario_id, fecha, segundos_monitoreados)
select x, current_date, 60 from (select borrado x from ids union all select otro from ids) t;
insert into eventos_log (usuario_id, tipo, detalle)
select x, 'login_exitoso', 'registro' from (select borrado x from ids union all select otro from ids) t;

-- ---- N6: la base ya no acepta el correo en login_fallido ----
do $$ begin
  begin
    insert into eventos_log (usuario_id, tipo, detalle) values (null, 'login_fallido', 'alguien@ejemplo.test');
    raise exception 'FALLO: login_fallido acepto un correo en detalle';
  exception when check_violation then null; end;
  insert into eventos_log (usuario_id, tipo) values (null, 'login_fallido');
  if exists (select 1 from eventos_log where tipo = 'login_fallido' and detalle is not null) then
    raise exception 'FALLO: quedan login_fallido con detalle';
  end if;
end $$;

-- El cliente sin sesion (rol anon) sigue pudiendo registrar el intento fallido.
set local role anon;
do $$ begin
  insert into eventos_log (usuario_id, tipo, detalle) values (null, 'login_fallido', null);
exception when insufficient_privilege or others then
  raise exception 'FALLO: anon ya no puede registrar login_fallido (%)', sqlerrm;
end $$;
reset role;

-- ---- N4: codigos largos, aleatorios y sin DEMO-0001 ----
do $$
declare
  a record; b record; v_rota text;
begin
  if exists (select 1 from organizaciones where codigo_acceso = 'DEMO-0001') then
    raise exception 'FALLO: sigue existiendo la organizacion DEMO-0001';
  end if;
  begin
    insert into organizaciones (nombre, codigo_acceso) values ('corta', 'CORTO-1');
    raise exception 'FALLO: se acepto un codigo de menos de 12 caracteres';
  exception when check_violation then null; end;

  select * into a from crear_organizacion('Org generada 1');
  select * into b from crear_organizacion('Org generada 2');
  if length(a.codigo_acceso) < 12 then raise exception 'FALLO: codigo generado demasiado corto'; end if;
  if a.codigo_acceso !~ '^[0-9A-F]{4}(-[0-9A-F]{4}){4}$' then
    raise exception 'FALLO: formato inesperado del codigo: %', a.codigo_acceso;
  end if;
  if a.codigo_acceso = b.codigo_acceso then raise exception 'FALLO: dos codigos iguales'; end if;

  v_rota := rotar_codigo_organizacion(a.organizacion_id);
  if v_rota = a.codigo_acceso
     or (select codigo_acceso from organizaciones where id = a.organizacion_id) <> v_rota then
    raise exception 'FALLO: la rotacion no cambio el codigo';
  end if;
  begin
    perform rotar_codigo_organizacion('00000000-0000-0000-0000-000000000000');
    raise exception 'FALLO: rotar una organizacion inexistente no fallo';
  exception when others then
    if sqlerrm not like '%organizacion-inexistente%' then raise; end if;
  end;
end $$;

-- La app (authenticated) y el cliente sin sesion no pueden crear ni rotar codigos.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select otro from ids), 'role', 'authenticated')::text, true);
do $$ begin
  begin
    perform crear_organizacion('intrusa');
    raise exception 'FALLO: authenticated pudo crear una organizacion';
  exception when insufficient_privilege then null; end;
  begin
    perform rotar_codigo_organizacion('00000000-0000-0000-0000-0000000000c3');
    raise exception 'FALLO: authenticated pudo rotar un codigo';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform crear_organizacion('intrusa');
    raise exception 'FALLO: anon pudo crear una organizacion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Unirse con el codigo tecleado a mano (minusculas y espacios).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select nuevo from ids), 'role', 'authenticated')::text, true);
do $$ begin
  perform unirse_con_codigo_organizacion('  prueba-c-0000-0000 ');
  begin
    perform unirse_con_codigo_organizacion('PRUEBA-C');
    raise exception 'FALLO: un prefijo del codigo fue aceptado';
  exception when others then
    if sqlerrm not like '%codigo-organizacion-invalido%' then raise; end if;
  end;
end $$;
reset role;

-- ---- N5: eliminar_mis_datos ----
-- Sin sesion o sin confirmacion no borra nada.
set local role anon;
do $$ begin
  begin
    perform eliminar_mis_datos('ELIMINAR');
    raise exception 'FALLO: anon pudo ejecutar eliminar_mis_datos';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select borrado from ids), 'role', 'authenticated')::text, true);
do $$ begin
  begin
    perform eliminar_mis_datos('eliminar');
    raise exception 'FALLO: se borro sin la confirmacion exacta';
  exception when others then
    if sqlerrm not like '%confirmacion-requerida%' then raise; end if;
  end;
  if not exists (select 1 from usuarios where id = auth.uid()) then
    raise exception 'FALLO: una confirmacion invalida borro el perfil';
  end if;

  perform eliminar_mis_datos('ELIMINAR');
end $$;
reset role;

do $$
declare
  v_id uuid := (select borrado from ids);
  v_otro uuid := (select otro from ids);
begin
  if exists (select 1 from auth.users where id = v_id) then raise exception 'FALLO: sigue la cuenta en auth.users'; end if;
  if exists (select 1 from usuarios where id = v_id) then raise exception 'FALLO: sigue el perfil'; end if;
  if exists (select 1 from antecedentes_salud where usuario_id = v_id) then raise exception 'FALLO: siguen los antecedentes'; end if;
  if exists (select 1 from antecedentes_cambios where usuario_id = v_id) then raise exception 'FALLO: sigue el historico de antecedentes'; end if;
  if exists (select 1 from historial_diario where usuario_id = v_id) then raise exception 'FALLO: sigue el historial'; end if;
  if exists (select 1 from consentimientos where usuario_id = v_id) then raise exception 'FALLO: siguen los consentimientos'; end if;

  -- El log se conserva sin vinculo a la persona.
  if exists (select 1 from eventos_log where usuario_id = v_id) then raise exception 'FALLO: el log sigue apuntando a la persona'; end if;
  if not exists (select 1 from eventos_log where tipo = 'cuenta_eliminada' and usuario_id is null and detalle is null) then
    raise exception 'FALLO: falta el evento cuenta_eliminada anonimo';
  end if;
  if not exists (select 1 from eventos_log where tipo = 'login_exitoso' and usuario_id is null and detalle is null) then
    raise exception 'FALLO: el evento de acceso previo no quedo anonimizado y conservado';
  end if;

  -- Los datos de otra persona no se tocan.
  if not exists (select 1 from usuarios where id = v_otro)
     or not exists (select 1 from antecedentes_salud where usuario_id = v_otro)
     or not exists (select 1 from antecedentes_cambios where usuario_id = v_otro)
     or not exists (select 1 from historial_diario where usuario_id = v_otro)
     or not exists (select 1 from consentimientos where usuario_id = v_otro)
     or not exists (select 1 from eventos_log where usuario_id = v_otro) then
    raise exception 'FALLO: se borraron datos de otra cuenta';
  end if;
end $$;

select 'TODAS LAS PRUEBAS PASARON' as resultado;
rollback;
