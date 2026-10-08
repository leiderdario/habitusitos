-- Fase 2: antecedentes de salud, con rastro inmutable de cambios.
--
-- Ejecutar despues de 0001_fase1_cuentas.sql, igual modo: pegar en el SQL
-- Editor del dashboard de Supabase y correr, o `supabase db push`.
--
-- Ver app/src/dominio/tipos.ts (AntecedentesSalud, CambioAntecedente) y
-- app/src/datos/api/antecedentes.api.ts para quien las usa.

create table if not exists antecedentes_salud (
  usuario_id uuid primary key references usuarios (id) on delete cascade,

  -- Columna
  cervicalgia boolean not null default false,
  lumbalgia boolean not null default false,
  cifosis_hipercifosis boolean not null default false,
  lordosis boolean not null default false,
  hernia_protrusion boolean not null default false,
  escoliosis boolean not null default false,
  cirugia_columna_cuello_hombro boolean not null default false,

  -- Miembro superior
  tunel_carpiano boolean not null default false,
  tendinitis_de_quervain boolean not null default false,
  epicondilitis boolean not null default false,
  manguito_rotador boolean not null default false,
  cirugia_mano_muneca boolean not null default false,

  -- Otros (embarazo es dato sensible: RLS lo protege igual que el resto de la
  -- fila, pero nunca debe copiarse a ninguna vista agregada ni export futuro)
  usa_ferulas boolean not null default false,
  embarazo boolean not null default false,
  dolor_cronico boolean not null default false,
  enfermedad_laboral_biomecanica_previa boolean not null default false,

  -- Habitos
  horas_sentado_dia numeric not null default 8,
  mano_dominante text not null default 'derecha'
    check (mano_dominante in ('izquierda', 'derecha', 'ambidiestro')),
  muneca_reloj text not null default 'no_usa'
    check (muneca_reloj in ('izquierda', 'derecha', 'ambidiestro', 'no_usa')),
  ya_hace_pausas boolean not null default false,

  actualizado_en timestamptz not null default now()
);

create table if not exists antecedentes_cambios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios (id) on delete cascade,
  campo text not null,
  valor_anterior text,
  valor_nuevo text not null,
  cambiado_en timestamptz not null default now()
);

alter table antecedentes_salud enable row level security;
alter table antecedentes_cambios enable row level security;

-- Solo la propia cuenta, nunca RRHH ni ninguna vista agregada futura: los
-- antecedentes son individuales por definicion (ver docs/prompt_maestro_multipersona_oficina.md §1).
create policy "leer los propios antecedentes"
  on antecedentes_salud for select
  using (usuario_id = auth.uid());

create policy "crear los propios antecedentes"
  on antecedentes_salud for insert
  with check (usuario_id = auth.uid());

create policy "editar los propios antecedentes"
  on antecedentes_salud for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "leer el propio historico de cambios"
  on antecedentes_cambios for select
  using (usuario_id = auth.uid());

create policy "escribir el propio historico de cambios"
  on antecedentes_cambios for insert
  with check (usuario_id = auth.uid());
-- Sin policy de update/delete en antecedentes_cambios: es un registro de
-- auditoria, igual que eventos_log.

-- `actualizado_en` lo pone siempre el servidor, nunca el cliente (regla del
-- proyecto: nada de new Date() -- ver app/src/arquitectura.test.ts). Un
-- trigger es la unica forma honesta de que la columna sea "la ultima vez que
-- esto cambio" en vez de "lo que el navegador de quien lo guardo creyo que
-- era la hora".
create or replace function tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger antecedentes_salud_actualizado_en
  before insert or update on antecedentes_salud
  for each row execute function tocar_actualizado_en();
