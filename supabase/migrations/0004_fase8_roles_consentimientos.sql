-- Fase 8: cierra un hueco de seguridad de la Fase 1, agrega la vista de equipo
-- para RRHH (solo agregados anonimos) y el registro de consentimientos.
--
-- Ejecutar despues de 0003_fase5_historial.sql, igual modo: pegar en el SQL
-- Editor del dashboard de Supabase, o `supabase db push`.
-- Para probarla: supabase/pruebas/rls_fase8.sql.

-- ---------------------------------------------------------------------------
-- 1. HUECO DE LA FASE 1: escalada de privilegios.
--    Las policies "crear el propio perfil" y "editar el propio perfil" solo
--    comparan id = auth.uid(); no limitan COLUMNAS. Cualquier cuenta podia
--    ejecutar update usuarios set rol = 'rrhh_jefe' sobre si misma, o
--    asignarse una organizacion. Los privilegios por columna lo cierran:
--    la aplicacion solo puede tocar las columnas listadas aqui. `rol` y
--    `organizacion_id` solo cambian desde el SQL Editor o por funciones
--    SECURITY DEFINER (como unirse_con_codigo_organizacion), que corren con
--    los permisos del dueno y no se ven afectadas.
-- ---------------------------------------------------------------------------
revoke insert, update on usuarios from anon, authenticated;
grant insert (id, correo, nombre, modo_uso) on usuarios to authenticated;
grant update (nombre, modo_uso) on usuarios to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Vista de equipo para RRHH: SOLO agregados, con minimo de personas.
--    Ninguna policy permite a un rrhh_jefe leer filas individuales de
--    usuarios, historial_diario ni antecedentes_*: esta funcion es la unica
--    puerta, y devuelve por dia el total de la organizacion.
--    Los dias con menos de `k` fuentes activas se omiten: con 1 o 2 personas
--    un "agregado" identifica a alguien. k = 5 es un valor de arranque
--    (ver docs/PREGUNTAS_Y_MEJORAS.md).
--    "Fuente" = cuenta con uso ese dia. En oficina una cuenta compartida es
--    un equipo, no una persona; por eso no se llama "personas".
-- ---------------------------------------------------------------------------
create or replace function resumen_equipo(p_dias int default 28, p_minimo_fuentes int default 5)
returns table (
  fecha date,
  fuentes_activas bigint,
  minutos_monitoreados numeric,
  puntaje_promedio numeric,
  porcentaje_mala_postura numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_rol text;
begin
  select u.organizacion_id, u.rol into v_org, v_rol from usuarios u where u.id = auth.uid();
  if v_rol is distinct from 'rrhh_jefe' or v_org is null then
    raise exception 'acceso-denegado';
  end if;
  -- El minimo no puede bajarse desde el cliente: se ignora cualquier valor menor a 5.
  p_minimo_fuentes := greatest(p_minimo_fuentes, 5);
  p_dias := least(greatest(p_dias, 1), 366);

  return query
    select h.fecha,
           count(*)::bigint,
           round(sum(h.segundos_monitoreados) / 60, 1),
           round(sum(h.puntaje_ponderado) / nullif(sum(h.segundos_monitoreados), 0), 1),
           round(100 * sum(h.segundos_mala_postura) / nullif(sum(h.segundos_monitoreados), 0), 1)
    from historial_diario h
    join usuarios u on u.id = h.usuario_id
    where u.organizacion_id = v_org
      and h.segundos_monitoreados > 0
      and h.fecha >= (now() at time zone 'America/Bogota')::date - p_dias
    group by h.fecha
    having count(*) >= p_minimo_fuentes
    order by h.fecha;
end;
$$;

grant execute on function resumen_equipo(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Consentimientos: insert-only, con la version del texto aceptado.
--    Una fila por aceptacion o retiro; el estado vigente es la ultima fila de
--    cada (usuario, tipo). Nunca se edita ni se borra: es evidencia.
-- ---------------------------------------------------------------------------
create table if not exists consentimientos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios (id) on delete cascade,
  tipo text not null check (tipo in ('camara', 'salud', 'reloj')),
  version text not null,
  aceptado boolean not null,
  creado_en timestamptz not null default now()
);

alter table consentimientos enable row level security;

create policy "registrar el propio consentimiento"
  on consentimientos for insert
  with check (usuario_id = auth.uid());

create policy "leer los propios consentimientos"
  on consentimientos for select
  using (usuario_id = auth.uid());

-- Para asignar el rol RRHH (unico camino, deliberadamente manual). Se busca por el
-- id de la cuenta en auth.users, NO por usuarios.correo: ese campo lo escribia el
-- cliente (ver 0005, hallazgo H1).
--   update usuarios set rol = 'rrhh_jefe', organizacion_id = '<id de la organizacion>'
--   where id = (select id from auth.users where email = '<correo de la persona>');
