-- Fase 1: cuentas, modo de uso, codigo de acceso de organizacion, log de eventos.
--
-- Como ejecutarla: pegar este archivo completo en el SQL Editor del proyecto
-- de Supabase (Dashboard -> SQL Editor -> New query -> Run), una sola vez. Si
-- el CLI de Supabase esta enlazado a este proyecto, `supabase db push` hace lo
-- mismo. No requiere la service_role key para ejecutarse desde el dashboard.
--
-- Ver app/src/dominio/tipos.ts (Usuario, Organizacion, EventoRegistro) para las
-- formas de dominio que espejan estas tablas, y
-- app/src/datos/api/auth.api.ts / registro.api.ts para quien las usa.

create extension if not exists pgcrypto;

create table if not exists organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- Codigo corto para el segundo metodo de login (equipos compartidos de
  -- oficina). Unico: dos organizaciones nunca comparten codigo.
  codigo_acceso text not null unique,
  creado_en timestamptz not null default now()
);

create table if not exists usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text,
  nombre text not null default '',
  modo_uso text not null default 'personal' check (modo_uso in ('personal', 'oficina')),
  rol text not null default 'trabajador' check (rol in ('trabajador', 'rrhh_jefe')),
  organizacion_id uuid references organizaciones (id) on delete set null,
  creado_en timestamptz not null default now()
);

create table if not exists eventos_log (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users (id) on delete set null,
  tipo text not null check (
    tipo in (
      'login_exitoso', 'login_fallido', 'logout',
      'camara_iniciada', 'camara_detenida', 'exportacion', 'cambio_perfil'
    )
  ),
  detalle text,
  creado_en timestamptz not null default now()
);

alter table organizaciones enable row level security;
alter table usuarios enable row level security;
alter table eventos_log enable row level security;

-- organizaciones: nunca listable; solo se puede leer la propia (para mostrar
-- el nombre, nunca el codigo de otra). Crear/rotar el codigo se hace desde el
-- SQL Editor o un script con service_role hasta que exista la vista RRHH
-- (Fase 8) con su propia pantalla de administracion.
create policy "leer la propia organizacion"
  on organizaciones for select
  using (id = (select organizacion_id from usuarios where id = auth.uid()));

-- usuarios: cada cuenta lee y edita solo su propia fila. Nunca la de otra,
-- ni siquiera para leer el nombre.
create policy "leer el propio perfil"
  on usuarios for select
  using (id = auth.uid());

create policy "crear el propio perfil al registrarse"
  on usuarios for insert
  with check (id = auth.uid());

create policy "editar el propio perfil"
  on usuarios for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- eventos_log: insert permitido incluso sin sesion (login_fallido ocurre ANTES
-- de autenticar), pero solo a nombre de si mismo o anonimo. Sin policy de
-- update/delete: es un registro de auditoria, inmutable desde la aplicacion.
create policy "escribir eventos propios o anonimos"
  on eventos_log for insert
  with check (usuario_id = auth.uid() or usuario_id is null);

create policy "leer los propios eventos"
  on eventos_log for select
  using (usuario_id = auth.uid());

-- Segundo metodo de login: codigo de acceso de organizacion. El cliente ya
-- abrio una sesion anonima (supabase.auth.signInAnonymously()) antes de llamar
-- esta funcion -- requiere "Anonymous sign-ins" activado en
-- Authentication > Sign In / Up del dashboard, viene desactivado por defecto.
-- SECURITY DEFINER porque "organizaciones" no tiene policy de select para una
-- cuenta que todavia no tiene organizacion_id asignado -- es exactamente la
-- unica puerta por la que se permite esa lectura.
create or replace function unirse_con_codigo_organizacion(p_codigo text)
returns table (organizacion_id uuid, organizacion_nombre text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org organizaciones%rowtype;
begin
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

grant execute on function unirse_con_codigo_organizacion(text) to anon, authenticated;

-- Organizacion de ejemplo para probar el login por codigo en desarrollo.
-- Borrar o cambiar el codigo antes de un uso real.
insert into organizaciones (nombre, codigo_acceso)
values ('Oficina de prueba', 'DEMO-0001')
on conflict (codigo_acceso) do nothing;
