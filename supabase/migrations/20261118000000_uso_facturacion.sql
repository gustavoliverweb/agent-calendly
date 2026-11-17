-- SaaS S6: uso por empresa y mes, para facturar fuera de la app (docs/plan-saas.md §1, §4.1 y §4.2).
--
-- - Tarifa por minuto de cada empresa (la fija el proveedor, en euros): con ella
--   el panel de la empresa muestra un importe estimado. Sin tarifa, solo minutos.
-- - Uso mensual en la zona horaria de cada empresa: llamadas, contestadas,
--   citas, minutos de llamadas y minutos de pruebas en el navegador (también
--   los paga el proveedor a ElevenLabs y cuentan para el límite del mes).
-- - Detalle de las llamadas de un mes sin datos personales (justificante de la
--   factura): sirve al proveedor sin ver nombres ni teléfonos.

alter table public.empresas
  add column precio_minuto numeric(8,4) check (precio_minuto is null or precio_minuto between 0 and 1000);

comment on column public.empresas.precio_minuto is 'Tarifa por minuto en euros que paga la empresa (null: sin tarifa en la app); la fija el proveedor';

-- -----------------------------------------------------------------------------
-- Agregado de un periodo (interno: lo usan las funciones de abajo)
-- -----------------------------------------------------------------------------

create function public.uso_periodo(p_empresa_id uuid, p_desde timestamptz, p_hasta timestamptz)
returns table (
  llamadas int,
  contestadas int,
  citas int,
  citas_canceladas int,
  segundos bigint,
  pruebas int,
  segundos_pruebas bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where not l.es_prueba)::int,
         -- Mismo criterio que kpis_llamadas: hubo conversación.
         count(*) filter (
           where not l.es_prueba
             and l.estado = 'completada'
             and coalesce(l.clasificacion, '') not in ('sin_respuesta', 'buzon')
         )::int,
         count(*) filter (where not l.es_prueba and l.cita_agendada)::int,
         count(*) filter (
           where not l.es_prueba
             and l.cita_agendada
             and exists (select 1 from public.citas c where c.llamada_id = l.id and c.estado = 'cancelada')
         )::int,
         coalesce(sum(l.duracion_seg) filter (where not l.es_prueba), 0)::bigint,
         count(*) filter (where l.es_prueba)::int,
         coalesce(sum(l.duracion_seg) filter (where l.es_prueba), 0)::bigint
    from public.llamadas l
   where l.empresa_id = p_empresa_id
     and l.creado_en >= p_desde
     and l.creado_en < p_hasta;
$$;

revoke all on function public.uso_periodo(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.uso_periodo(uuid, timestamptz, timestamptz) to service_role;

-- -----------------------------------------------------------------------------
-- Panel de la empresa: últimos meses (el actual primero)
-- -----------------------------------------------------------------------------

create function public.uso_mensual(p_empresa_id uuid, p_meses int default 12)
returns table (
  mes date,
  llamadas int,
  contestadas int,
  citas int,
  citas_canceladas int,
  segundos bigint,
  pruebas int,
  segundos_pruebas bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with e as (
    select e.id, e.zona_horaria
      from public.empresas e
     where e.id = p_empresa_id
       and (auth.role() = 'service_role' or public.es_miembro(p_empresa_id))
  ),
  meses as (
    select (date_trunc('month', now() at time zone e.zona_horaria) - make_interval(months => g))::date as mes,
           e.id, e.zona_horaria
      from e, generate_series(0, least(greatest(coalesce(p_meses, 12), 1), 36) - 1) g
  )
  select m.mes, u.*
    from meses m
   cross join lateral public.uso_periodo(
     m.id,
     m.mes::timestamp at time zone m.zona_horaria,
     (m.mes + interval '1 month')::timestamp at time zone m.zona_horaria
   ) u
   order by m.mes desc;
$$;

revoke all on function public.uso_mensual(uuid, int) from public, anon;
grant execute on function public.uso_mensual(uuid, int) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- /admin: todas las empresas en un mes (para la exportación de facturación)
-- -----------------------------------------------------------------------------

create function public.uso_plataforma(p_mes date)
returns table (
  empresa_id uuid,
  nombre text,
  slug text,
  estado text,
  precio_minuto numeric,
  limite_minutos_mes int,
  llamadas int,
  contestadas int,
  citas int,
  citas_canceladas int,
  segundos bigint,
  pruebas int,
  segundos_pruebas bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.nombre, e.slug, e.estado, e.precio_minuto, e.limite_minutos_mes, u.*
    from public.empresas e
   cross join lateral public.uso_periodo(
     e.id,
     date_trunc('month', p_mes)::timestamp at time zone e.zona_horaria,
     (date_trunc('month', p_mes) + interval '1 month')::timestamp at time zone e.zona_horaria
   ) u
   -- Empresas que existían ese mes.
   where e.creado_en < (date_trunc('month', p_mes) + interval '1 month')::timestamp at time zone e.zona_horaria
   order by e.nombre;
$$;

revoke all on function public.uso_plataforma(date) from public, anon, authenticated;
grant execute on function public.uso_plataforma(date) to service_role;

-- -----------------------------------------------------------------------------
-- Detalle de las llamadas de un mes, sin datos personales
-- -----------------------------------------------------------------------------

create function public.llamadas_del_mes(p_empresa_id uuid, p_mes date)
returns table (
  id uuid,
  creado_en timestamptz,
  estado public.llamada_estado,
  clasificacion text,
  duracion_seg int,
  cita_agendada boolean,
  es_prueba boolean,
  lote_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.creado_en, l.estado, l.clasificacion, l.duracion_seg, l.cita_agendada, l.es_prueba, l.lote_id
    from public.llamadas l
    join public.empresas e on e.id = l.empresa_id
   where l.empresa_id = p_empresa_id
     and (auth.role() = 'service_role' or public.es_miembro(p_empresa_id))
     and l.creado_en >= date_trunc('month', p_mes)::timestamp at time zone e.zona_horaria
     and l.creado_en < (date_trunc('month', p_mes) + interval '1 month')::timestamp at time zone e.zona_horaria
   order by l.creado_en, l.id;
$$;

revoke all on function public.llamadas_del_mes(uuid, date) from public, anon;
grant execute on function public.llamadas_del_mes(uuid, date) to authenticated, service_role;
