-- Fase 5: historial real por persona (agregado por dia).
--
-- Ejecutar despues de 0002_fase2_antecedentes.sql, igual modo: pegar en el SQL
-- Editor del dashboard de Supabase, o `supabase db push`.
--
-- Se guarda UN agregado por usuario y dia, no cada muestra: es lo que necesita el
-- calendario, la tendencia y el export, y evita acumular miles de filas de
-- postura por persona (menos dato personal retenido).
--
-- Ver app/src/datos/api/historial.api.ts.

create table if not exists historial_diario (
  usuario_id uuid not null references usuarios (id) on delete cascade,
  fecha date not null,
  segundos_monitoreados numeric not null default 0 check (segundos_monitoreados >= 0),
  -- Suma de (puntaje * segundos): el promedio del dia es esto / segundos_monitoreados,
  -- ponderado por tiempo real y no por numero de muestras.
  puntaje_ponderado numeric not null default 0 check (puntaje_ponderado >= 0),
  segundos_mala_postura numeric not null default 0 check (segundos_mala_postura >= 0),
  actualizado_en timestamptz not null default now(),
  primary key (usuario_id, fecha)
);

alter table historial_diario enable row level security;

-- Solo lectura de lo propio. Sin policy de insert/update: se escribe unicamente por
-- la funcion de abajo, que valida los rangos. Ningun rol (RRHH incluido) lee filas
-- individuales; la vista de equipo de la Fase 8 sera agregada y anonima.
create policy "leer el propio historial"
  on historial_diario for select
  using (usuario_id = auth.uid());

-- La fecha la decide el servidor (zona de Colombia), nunca el cliente: un reloj
-- local mal puesto no debe escribir en dias ajenos al real.
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
  hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if auth.uid() is null then
    raise exception 'sesion requerida';
  end if;
  -- Un lote razonable es de ~1 minuto; el tope impide inflar el historial de golpe.
  if p_segundos < 0 or p_segundos > 3600
     or p_segundos_mala < 0 or p_segundos_mala > p_segundos
     or p_puntaje_ponderado < 0 or p_puntaje_ponderado > p_segundos * 100 then
    raise exception 'valores fuera de rango';
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
