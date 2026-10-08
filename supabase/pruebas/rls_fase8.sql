-- Prueba de seguridad de la Fase 8. NO modifica datos: todo ocurre dentro de una
-- transaccion que termina en ROLLBACK. Pegar en el SQL Editor y ejecutar; cada
-- bloque `do` lanza una excepcion con "FALLO: ..." si la regla no se cumple, y el
-- script termina con la fila "TODAS LAS PRUEBAS PASARON".
--
-- NO se ha ejecutado todavia (no hay acceso a la base desde el codigo).
-- Simula usuarios cambiando de rol y fijando `request.jwt.claims`, que es lo que
-- lee auth.uid() dentro de Supabase.

begin;

-- Datos de prueba (como dueno de la base, sin RLS).
insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prueba_' || g || '@ejemplo.test'
from generate_series(1, 7) g;

insert into organizaciones (id, nombre, codigo_acceso)
values ('00000000-0000-0000-0000-0000000000a1', 'Org A de prueba', 'PRUEBA-A-0000-0000'),
       ('00000000-0000-0000-0000-0000000000b2', 'Org B de prueba', 'PRUEBA-B-0000-0000');

-- Usuarios 1-6: trabajadores de la org A. Usuario 7: rrhh de la org A.
insert into usuarios (id, correo, rol, organizacion_id)
select id, email,
       case when row_number() over (order by email) = 7 then 'rrhh_jefe' else 'trabajador' end,
       '00000000-0000-0000-0000-0000000000a1'
from auth.users where email like 'prueba_%@ejemplo.test';

-- 6 trabajadores con uso hoy (supera el minimo de 5) y antecedentes sensibles.
insert into historial_diario (usuario_id, fecha, segundos_monitoreados, puntaje_ponderado, segundos_mala_postura)
select u.id, (now() at time zone 'America/Bogota')::date, 3600, 3600 * 70, 600
from usuarios u where u.rol = 'trabajador';

insert into antecedentes_salud (usuario_id, embarazo)
select id, true from usuarios where rol = 'trabajador';

create temp table ids as
  select (select id from usuarios where rol = 'rrhh_jefe') as rrhh,
         (select id from usuarios where rol = 'trabajador' order by correo limit 1) as trabajador;
grant select on ids to authenticated;

-- ---- Como el trabajador 1 ----
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select trabajador from ids), 'role', 'authenticated')::text, true);

do $$ begin
  begin
    update usuarios set rol = 'rrhh_jefe' where id = auth.uid();
    raise exception 'FALLO: un trabajador pudo subirse a rrhh_jefe';
  exception when insufficient_privilege then null; end;
  begin
    update usuarios set organizacion_id = '00000000-0000-0000-0000-0000000000b2' where id = auth.uid();
    raise exception 'FALLO: un trabajador pudo cambiarse de organizacion';
  exception when insufficient_privilege then null; end;
  if (select count(*) from usuarios) <> 1 then raise exception 'FALLO: un trabajador ve perfiles ajenos'; end if;
  if (select count(*) from historial_diario) <> 1 then raise exception 'FALLO: un trabajador ve historial ajeno'; end if;
  begin
    update usuarios set correo = 'otra@persona.test' where id = auth.uid();
    raise exception 'FALLO: un trabajador pudo escribir su correo de perfil';
  exception when insufficient_privilege then null; end;
  begin
    insert into historial_diario (usuario_id, fecha, segundos_monitoreados)
    values (auth.uid(), current_date - 1, 99999);
    raise exception 'FALLO: un trabajador pudo escribir historial directo, sin la funcion';
  exception when insufficient_privilege then null; end;
  begin
    update antecedentes_salud set lumbalgia = true where usuario_id = auth.uid();
    raise exception 'FALLO: se editaron antecedentes sin consentimiento de salud';
  exception when insufficient_privilege then null; end;
  begin
    for i in 1..30 loop
      perform acumular_historial_diario(3600, 3600 * 70, 0);
    end loop;
    raise exception 'FALLO: se acumularon mas horas de las que tiene el dia';
  exception when others then
    if sqlerrm not like '%excede-tiempo-transcurrido%' then raise; end if;
  end;
  begin
    perform * from resumen_equipo();
    raise exception 'FALLO: un trabajador pudo pedir el resumen de equipo';
  exception when others then
    if sqlerrm not like '%acceso-denegado%' then raise; end if;
  end;
end $$;

-- ---- Como RRHH ----
select set_config('request.jwt.claims', json_build_object('sub', (select rrhh from ids), 'role', 'authenticated')::text, true);

do $$ begin
  if (select count(*) from historial_diario where usuario_id <> auth.uid()) <> 0 then
    raise exception 'FALLO: rrhh_jefe lee historial individual de otros';
  end if;
  if (select count(*) from antecedentes_salud) <> 0 then
    raise exception 'FALLO: rrhh_jefe lee antecedentes de salud';
  end if;
  if (select count(*) from usuarios where id <> auth.uid()) <> 0 then
    raise exception 'FALLO: rrhh_jefe lee perfiles individuales';
  end if;
  if (select count(*) from resumen_equipo()) <> 1 then
    raise exception 'FALLO: rrhh_jefe deberia ver 1 dia agregado (6 fuentes >= minimo 5)';
  end if;
  if (select fuentes_activas from resumen_equipo() limit 1) <> 6 then
    raise exception 'FALLO: el agregado no cuenta 6 fuentes';
  end if;
  -- Bajar el minimo desde el cliente no debe funcionar.
  if (select count(*) from resumen_equipo(28, 1)) <> 1 then
    raise exception 'FALLO: inesperado con minimo 1';
  end if;
end $$;

reset role;

-- Con menos de 5 fuentes el dia se omite aunque RRHH pida minimo 1.
delete from historial_diario where usuario_id in (
  select id from usuarios where rol = 'trabajador' order by correo limit 2);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select rrhh from ids), 'role', 'authenticated')::text, true);
do $$ begin
  if (select count(*) from resumen_equipo(28, 1)) <> 0 then
    raise exception 'FALLO: con 4 fuentes el agregado deberia suprimirse (k-anonimato)';
  end if;
end $$;
reset role;

select 'TODAS LAS PRUEBAS PASARON' as resultado;
rollback;
