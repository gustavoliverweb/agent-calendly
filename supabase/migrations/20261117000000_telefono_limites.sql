-- SaaS S5: línea telefónica por empresa y límites de uso (docs/plan-saas.md §2.1 y §6).
--
-- - Cada empresa aporta su línea SIP; el proveedor la importa en ElevenLabs y
--   asigna su phone_number_id a la empresa desde /admin.
-- - El proveedor fija por empresa las llamadas simultáneas contratadas y un
--   límite de minutos al mes (la factura de ElevenLabs la paga él).
-- - La concurrencia del plan de ElevenLabs es una sola para toda la
--   plataforma: max_concurrencia_global la reparte entre empresas.
--
-- Todas las altas de llamadas pasan a serializarse con un único bloqueo de
-- plataforma (antes era por empresa): así el límite global no se supera con
-- dos empresas lanzando a la vez. Son transacciones cortas, sin llamadas externas.

-- -----------------------------------------------------------------------------
-- Línea y límites de cada empresa
-- -----------------------------------------------------------------------------

alter table public.empresas
  add column phone_number_id text unique check (phone_number_id is null or length(phone_number_id) between 1 and 100),
  add column telefono_numero text check (telefono_numero is null or length(telefono_numero) between 1 and 30),
  add column limite_minutos_mes int check (limite_minutos_mes is null or limite_minutos_mes between 1 and 1000000),
  add column max_concurrencia_contratada int not null default 2 check (max_concurrencia_contratada between 1 and 50);

comment on column public.empresas.phone_number_id is 'Número importado en ElevenLabs (línea SIP de la empresa); lo asigna el proveedor';
comment on column public.empresas.limite_minutos_mes is 'Minutos de llamada al mes (null: sin límite); al alcanzarlo no salen más llamadas';
comment on column public.empresas.max_concurrencia_contratada is 'Llamadas simultáneas contratadas: tope de configuracion.max_concurrencia';

-- -----------------------------------------------------------------------------
-- Ajustes de la plataforma (una fila)
-- -----------------------------------------------------------------------------

create table public.ajustes_plataforma (
  id                      boolean primary key default true check (id),
  -- Conversaciones simultáneas que permite el plan de ElevenLabs, para todas las empresas.
  max_concurrencia_global int not null default 5 check (max_concurrencia_global between 1 and 500),
  actualizado_en          timestamptz not null default now()
);

insert into public.ajustes_plataforma default values;

create trigger ajustes_plataforma_actualizado_en
  before update on public.ajustes_plataforma
  for each row execute function public.set_actualizado_en();

-- Solo service role (/admin).
alter table public.ajustes_plataforma enable row level security;
revoke all on public.ajustes_plataforma from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Uso
-- -----------------------------------------------------------------------------

-- Minutos consumidos en el mes natural, en la zona horaria de la empresa.
-- Las llamadas en curso aún no tienen duración: el límite puede superarse en
-- lo que duren las que estén abiertas al alcanzarlo.
create function public.minutos_mes(p_empresa_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(coalesce(sum(l.duracion_seg), 0)::numeric / 60, 1)
    from public.llamadas l
    join public.empresas e on e.id = l.empresa_id
   where l.empresa_id = p_empresa_id
     and l.creado_en >= (date_trunc('month', now() at time zone e.zona_horaria) at time zone e.zona_horaria)
     and (auth.role() = 'service_role' or public.es_miembro(p_empresa_id));
$$;

revoke all on function public.minutos_mes(uuid) from public, anon;
grant execute on function public.minutos_mes(uuid) to authenticated, service_role;

-- Llamadas abiertas en toda la plataforma (con el timeout de cada empresa).
create function public.llamadas_activas_global()
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
    from public.llamadas l
    join public.configuracion c on c.empresa_id = l.empresa_id
   where l.estado in ('iniciada', 'en_curso')
     and l.creado_en > now() - make_interval(mins => c.timeout_llamada_min);
$$;

revoke all on function public.llamadas_activas_global() from public, anon, authenticated;
grant execute on function public.llamadas_activas_global() to service_role;

-- Hueco libre en la plataforma, para el reparto del dispatcher.
create function public.concurrencia_global()
returns table (maximo int, activas int)
language sql
stable
security definer
set search_path = ''
as $$
  select (select a.max_concurrencia_global from public.ajustes_plataforma a), public.llamadas_activas_global();
$$;

revoke all on function public.concurrencia_global() from public, anon, authenticated;
grant execute on function public.concurrencia_global() to service_role;

-- Empresas activas con items de lote listos para llamar (reparto justo).
create function public.empresas_con_cola()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct i.empresa_id
    from public.lote_items i
    join public.lotes l on l.id = i.lote_id
    join public.empresas e on e.id = i.empresa_id
   where e.estado = 'activa'
     and l.estado = 'activo'
     and i.estado in ('en_cola', 'esperando_reintento')
     and (i.proximo_intento_en is null or i.proximo_intento_en <= now());
$$;

revoke all on function public.empresas_con_cola() from public, anon, authenticated;
grant execute on function public.empresas_con_cola() to service_role;

-- -----------------------------------------------------------------------------
-- crear_llamada: límites de la empresa y de la plataforma
-- -----------------------------------------------------------------------------

create or replace function public.crear_llamada(
  p_contacto_id uuid,
  p_lote_id uuid default null,
  p_lanzada_por uuid default null,
  p_guion_id uuid default null,
  p_prueba boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa public.empresas%rowtype;
  v_guion uuid;
  v_config public.configuracion%rowtype;
  v_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  -- Desde el panel solo se puede lanzar a nombre propio.
  if auth.role() <> 'service_role' and p_lanzada_por is distinct from auth.uid() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;

  select e.* into v_empresa
    from public.contactos c join public.empresas e on e.id = c.empresa_id
   where c.id = p_contacto_id;
  perform public.comprobar_acceso_empresa(v_empresa.id);
  if v_empresa.estado <> 'activa' then
    raise exception 'empresa_suspendida' using errcode = 'P0001';
  end if;

  -- Una versión concreta (prueba de un guion aún no activo) o la activa.
  if p_guion_id is not null then
    select g.id into v_guion from public.guiones g where g.id = p_guion_id and g.empresa_id = v_empresa.id;
  else
    v_guion := v_empresa.guion_activo_id;
  end if;
  if v_guion is null then
    raise exception 'sin_guion' using errcode = 'P0001';
  end if;

  -- Serializa todas las altas de llamadas (panel y dispatcher, todas las empresas).
  perform pg_advisory_xact_lock(hashtext('public.crear_llamada:global'));

  select * into v_config from public.configuracion where empresa_id = v_empresa.id;
  if v_config.pausa_global then
    raise exception 'pausa_global' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.contactos
     where id = p_contacto_id and estado = 'no_llamar'
  ) then
    raise exception 'no_llamar' using errcode = 'P0001';
  end if;

  if v_empresa.limite_minutos_mes is not null
     and public.minutos_mes(v_empresa.id) >= v_empresa.limite_minutos_mes then
    raise exception 'limite_minutos' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.llamadas
     where contacto_id = p_contacto_id
       and estado in ('iniciada', 'en_curso')
       and creado_en > now() - make_interval(mins => v_config.timeout_llamada_min)
  ) then
    raise exception 'llamada_activa' using errcode = 'P0001';
  end if;

  if public.llamadas_activas(v_empresa.id) >= least(v_config.max_concurrencia, v_empresa.max_concurrencia_contratada) then
    raise exception 'concurrencia' using errcode = 'P0001';
  end if;

  if public.llamadas_activas_global() >= (select a.max_concurrencia_global from public.ajustes_plataforma a) then
    raise exception 'concurrencia_global' using errcode = 'P0001';
  end if;

  insert into public.llamadas (contacto_id, lote_id, lanzada_por, guion_id, es_prueba)
  values (p_contacto_id, p_lote_id, p_lanzada_por, v_guion, coalesce(p_prueba, false))
  returning id into v_id;

  update public.contactos set ultimo_intento_en = now() where id = p_contacto_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- reservar_llamadas_lote: límites y reparto entre empresas
-- -----------------------------------------------------------------------------

drop function public.reservar_llamadas_lote(uuid);

-- Reclama items elegibles de una empresa y crea su llamada. El dispatcher la
-- llama una vez por empresa activa (tras comprobar franja, guion y línea),
-- con p_max para repartir la concurrencia global entre las empresas con cola.
create function public.reservar_llamadas_lote(p_empresa_id uuid, p_max int default null)
returns table (
  item_id uuid,
  lote_id uuid,
  llamada_id uuid,
  contacto_id uuid,
  nombre text,
  telefono text,
  email text
)
language plpgsql
security definer
set search_path = ''
as $$
-- Las columnas de salida (lote_id, nombre…) no deben tapar a las de las tablas.
#variable_conflict use_column
declare
  v_empresa public.empresas%rowtype;
  v_config public.configuracion%rowtype;
  v_libres int;
  v_llamada uuid;
  r record;
begin
  select * into v_empresa from public.empresas e where e.id = p_empresa_id and e.estado = 'activa';
  if not found then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('public.crear_llamada:global'));

  select * into v_config from public.configuracion where empresa_id = p_empresa_id;
  if v_config.pausa_global then
    return;
  end if;
  if v_empresa.limite_minutos_mes is not null
     and public.minutos_mes(p_empresa_id) >= v_empresa.limite_minutos_mes then
    return;
  end if;

  v_libres := least(
    least(v_config.max_concurrencia, v_empresa.max_concurrencia_contratada) - public.llamadas_activas(p_empresa_id),
    (select a.max_concurrencia_global from public.ajustes_plataforma a) - public.llamadas_activas_global(),
    coalesce(p_max, 2147483647)
  );
  if v_libres <= 0 then
    return;
  end if;

  for r in
    select i.id as item_id, i.lote_id, c.id as contacto_id, c.nombre, c.telefono, c.email,
           c.estado as contacto_estado, c.consentimiento
      from public.lote_items i
      join public.lotes l on l.id = i.lote_id
      join public.contactos c on c.id = i.contacto_id
     where i.empresa_id = p_empresa_id
       and l.estado = 'activo'
       and i.estado in ('en_cola', 'esperando_reintento')
       and (i.proximo_intento_en is null or i.proximo_intento_en <= now())
     order by i.proximo_intento_en asc nulls first, i.creado_en asc
       for update of i skip locked
  loop
    exit when v_libres <= 0;

    -- Se comprueba al lanzar, no solo al crear el lote (§9.4).
    if r.contacto_estado in ('no_llamar', 'cita_agendada')
       or (v_config.tipo_campana = 'comercial' and not r.consentimiento) then
      update public.lote_items
         set estado = 'omitido',
             motivo_omision = case
               when r.contacto_estado in ('no_llamar', 'cita_agendada') then r.contacto_estado::text
               else 'sin_consentimiento'
             end
       where id = r.item_id;
      continue;
    end if;

    -- Ya hay una llamada abierta con ese contacto (p. ej. lanzada desde el
    -- panel): se queda en cola para la siguiente pasada.
    continue when exists (
      select 1 from public.llamadas ll
       where ll.contacto_id = r.contacto_id
         and ll.estado in ('iniciada', 'en_curso')
         and ll.creado_en > now() - make_interval(mins => v_config.timeout_llamada_min)
    );

    insert into public.llamadas (contacto_id, lote_id)
    values (r.contacto_id, r.lote_id)
    returning id into v_llamada;

    update public.lote_items
       set estado = 'en_llamada',
           intentos = intentos + 1,
           ultima_llamada_id = v_llamada,
           proximo_intento_en = null
     where id = r.item_id;

    update public.contactos set ultimo_intento_en = now() where id = r.contacto_id;

    item_id := r.item_id;
    lote_id := r.lote_id;
    llamada_id := v_llamada;
    contacto_id := r.contacto_id;
    nombre := r.nombre;
    telefono := r.telefono;
    email := r.email;
    return next;
    v_libres := v_libres - 1;
  end loop;
end;
$$;

revoke all on function public.reservar_llamadas_lote(uuid, int) from public, anon, authenticated;
grant execute on function public.reservar_llamadas_lote(uuid, int) to service_role;

-- -----------------------------------------------------------------------------
-- /admin: línea, límites y minutos del mes
-- -----------------------------------------------------------------------------

drop function public.resumen_empresas();

create function public.resumen_empresas()
returns table (
  id uuid,
  nombre text,
  slug text,
  estado text,
  creado_en timestamptz,
  miembros int,
  contactos int,
  llamadas_30d int,
  segundos_30d bigint,
  calendly text,
  guion_activo boolean,
  phone_number_id text,
  telefono_numero text,
  limite_minutos_mes int,
  max_concurrencia_contratada int,
  minutos_mes numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.nombre, e.slug, e.estado, e.creado_en,
         (select count(*)::int from public.miembros m where m.empresa_id = e.id),
         (select count(*)::int from public.contactos c where c.empresa_id = e.id),
         (select count(*)::int from public.llamadas l
           where l.empresa_id = e.id and l.creado_en >= now() - interval '30 days'),
         (select coalesce(sum(l.duracion_seg), 0)::bigint from public.llamadas l
           where l.empresa_id = e.id and l.creado_en >= now() - interval '30 days'),
         coalesce((select i.estado from public.integraciones_calendly i where i.empresa_id = e.id), 'sin_conectar'),
         e.guion_activo_id is not null,
         e.phone_number_id,
         e.telefono_numero,
         e.limite_minutos_mes,
         e.max_concurrencia_contratada,
         public.minutos_mes(e.id)
    from public.empresas e
   order by e.creado_en;
$$;

revoke all on function public.resumen_empresas() from public, anon, authenticated;
grant execute on function public.resumen_empresas() to service_role;
