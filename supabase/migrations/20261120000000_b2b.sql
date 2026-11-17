-- SaaS S6c: modo B2B, llamadas a otras empresas (docs/plan-saas.md §5).
--
-- - Contactos con empresa (organizacion), cargo, sector, web y origen de los
--   datos. El teléfono puede ser la centralita.
-- - Tipo de campaña "b2b": no exige consentimiento previo (base jurídica de
--   interés legítimo, que protege a empresas y no a personas físicas), pero sí
--   la empresa del contacto y el origen documentado de sus datos.
-- - El proveedor habilita el modo por empresa (empresas.b2b_habilitado) cuando
--   el asesor lo haya revisado; sin habilitar, la empresa no puede elegirlo.
--
-- tipo_campana pasa de enum a texto con check: añadir un valor a un enum no se
-- puede usar en la misma transacción (ni en las pruebas con rollback).

-- -----------------------------------------------------------------------------
-- Tipo de campaña: comercial, no_comercial, b2b
-- -----------------------------------------------------------------------------

alter table public.configuracion alter column tipo_campana drop default;
alter table public.configuracion alter column tipo_campana type text using tipo_campana::text;
alter table public.configuracion alter column tipo_campana set default 'comercial';
alter table public.configuracion
  add constraint configuracion_tipo_campana_check check (tipo_campana in ('comercial', 'no_comercial', 'b2b'));
drop type public.tipo_campana;

alter table public.empresas
  add column b2b_habilitado boolean not null default false;

comment on column public.empresas.b2b_habilitado is 'El proveedor permite campañas B2B (revisado con el asesor); sin ello no se puede elegir';

-- Sin habilitar, una empresa no puede pasar a B2B (ni con la sesión ni con service role).
create function public.comprobar_campana_b2b()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo_campana = 'b2b'
     and (tg_op = 'INSERT' or old.tipo_campana is distinct from 'b2b')
     and not coalesce((select e.b2b_habilitado from public.empresas e where e.id = new.empresa_id), false) then
    raise exception 'b2b_no_habilitado' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger configuracion_campana_b2b
  before insert or update of tipo_campana on public.configuracion
  for each row execute function public.comprobar_campana_b2b();

-- -----------------------------------------------------------------------------
-- Contactos B2B
-- -----------------------------------------------------------------------------

alter table public.contactos
  add column organizacion text check (organizacion is null or length(organizacion) <= 200),
  add column cargo        text check (cargo is null or length(cargo) <= 120),
  add column sector       text check (sector is null or length(sector) <= 120),
  add column web          text check (web is null or length(web) <= 300),
  add column origen_datos text check (origen_datos is null or length(origen_datos) <= 300);

comment on column public.contactos.organizacion is 'Empresa del contacto (llamadas B2B)';
comment on column public.contactos.cargo is 'Cargo o puesto de la persona a la que se quiere llegar';
comment on column public.contactos.origen_datos is 'B2B: de dónde salen los datos (web corporativa, directorio, feria…), evidencia del interés legítimo';

create index contactos_organizacion_trgm_idx on public.contactos using gin (organizacion extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Regla de cada tipo de campaña (lotes y llamadas sueltas)
-- -----------------------------------------------------------------------------

-- Motivo por el que un contacto no se puede llamar en ese tipo de campaña, o null.
create function public.motivo_campana(p_tipo text, p_consentimiento boolean, p_organizacion text, p_origen text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tipo = 'comercial' and not coalesce(p_consentimiento, false) then 'sin_consentimiento'
    when p_tipo = 'b2b' and (nullif(trim(p_organizacion), '') is null or nullif(trim(p_origen), '') is null)
      then 'sin_datos_b2b'
  end;
$$;

grant execute on function public.motivo_campana(text, boolean, text, text) to authenticated, service_role;

create or replace function public.crear_lote(
  p_empresa_id uuid,
  p_contacto_ids uuid[],
  p_nombre text default null,
  p_creado_por uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
  v_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if auth.role() <> 'service_role' and p_creado_por is distinct from auth.uid() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  perform public.comprobar_acceso_empresa(p_empresa_id);
  if coalesce(array_length(p_contacto_ids, 1), 0) = 0 or array_length(p_contacto_ids, 1) > 5000 then
    raise exception 'seleccion_invalida' using errcode = 'P0001';
  end if;

  select c.tipo_campana into v_tipo
    from public.configuracion c where c.empresa_id = p_empresa_id;

  insert into public.lotes (empresa_id, nombre, creado_por)
  values (p_empresa_id, nullif(trim(p_nombre), ''), p_creado_por)
  returning id into v_id;

  -- Solo contactos de la empresa: los ids de otras se ignoran (no_encontrado).
  insert into public.lote_items (lote_id, contacto_id, estado, motivo_omision)
  select v_id, c.id,
         case when m.motivo is null then 'en_cola' else 'omitido' end::public.lote_item_estado,
         m.motivo
    from public.contactos c
    cross join lateral (
      select case
        when c.estado = 'no_llamar' then 'no_llamar'
        when c.estado = 'cita_agendada' then 'cita_agendada'
        when public.motivo_campana(v_tipo, c.consentimiento, c.organizacion, c.origen_datos) is not null
          then public.motivo_campana(v_tipo, c.consentimiento, c.organizacion, c.origen_datos)
        when exists (
          select 1
            from public.lote_items i
            join public.lotes l on l.id = i.lote_id
           where i.contacto_id = c.id
             and l.estado in ('activo', 'pausado')
             and i.estado in ('en_cola', 'en_llamada', 'esperando_reintento')
        ) then 'en_otro_lote'
      end as motivo
    ) m
   where c.id = any (p_contacto_ids)
     and c.empresa_id = p_empresa_id;

  insert into public.auditoria (usuario, empresa_id, accion, entidad, entidad_id, detalle)
  values (p_creado_por, p_empresa_id, 'crear_lote', 'lote', v_id,
          jsonb_build_object('seleccionados', array_length(p_contacto_ids, 1)));
  return v_id;
end;
$$;

revoke all on function public.crear_lote(uuid, uuid[], text, uuid) from public, anon;
grant execute on function public.crear_lote(uuid, uuid[], text, uuid) to authenticated, service_role;

create or replace function public.reservar_llamadas_lote(p_empresa_id uuid, p_max int default null)
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
           c.estado as contacto_estado, c.consentimiento, c.organizacion, c.origen_datos
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
       or public.motivo_campana(v_config.tipo_campana, r.consentimiento, r.organizacion, r.origen_datos) is not null then
      update public.lote_items
         set estado = 'omitido',
             motivo_omision = case
               when r.contacto_estado in ('no_llamar', 'cita_agendada') then r.contacto_estado::text
               else public.motivo_campana(v_config.tipo_campana, r.consentimiento, r.organizacion, r.origen_datos)
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
