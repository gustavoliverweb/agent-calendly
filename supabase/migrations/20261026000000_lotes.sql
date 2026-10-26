-- Fase 6: motor de lotes.
--
-- crear_lote: alta de un lote con sus items, filtrando en el momento a quien
-- no se puede llamar (queda como item omitido con su motivo, visible en el
-- panel).
--
-- reservar_llamadas_lote: el dispatcher reclama items y crea sus llamadas en
-- la misma transacción y bajo el mismo advisory lock que crear_llamada, así
-- que ni dos ejecuciones del dispatcher ni el panel a la vez superan
-- max_concurrencia ni llaman dos veces al mismo contacto.

create function public.crear_lote(
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
  v_comercial boolean;
  v_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if auth.role() <> 'service_role' and p_creado_por is distinct from auth.uid() then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_contacto_ids, 1), 0) = 0 or array_length(p_contacto_ids, 1) > 5000 then
    raise exception 'seleccion_invalida' using errcode = 'P0001';
  end if;

  select c.tipo_campana = 'comercial' into v_comercial from public.configuracion c where c.id = 1;

  insert into public.lotes (nombre, creado_por)
  values (nullif(trim(p_nombre), ''), p_creado_por)
  returning id into v_id;

  insert into public.lote_items (lote_id, contacto_id, estado, motivo_omision)
  select v_id, c.id,
         case when m.motivo is null then 'en_cola' else 'omitido' end::public.lote_item_estado,
         m.motivo
    from public.contactos c
    cross join lateral (
      select case
        when c.estado = 'no_llamar' then 'no_llamar'
        when c.estado = 'cita_agendada' then 'cita_agendada'
        when v_comercial and not c.consentimiento then 'sin_consentimiento'
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
   where c.id = any (p_contacto_ids);

  insert into public.auditoria (usuario, accion, entidad, entidad_id, detalle)
  values (p_creado_por, 'crear_lote', 'lote', v_id,
          jsonb_build_object('seleccionados', array_length(p_contacto_ids, 1)));
  return v_id;
end;
$$;

-- Reclama items elegibles y crea su llamada. Devuelve lo necesario para
-- lanzar cada una contra ElevenLabs.
create function public.reservar_llamadas_lote()
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
  v_config public.configuracion%rowtype;
  v_libres int;
  v_llamada uuid;
  r record;
begin
  perform pg_advisory_xact_lock(hashtext('public.crear_llamada'));

  select * into v_config from public.configuracion where id = 1;
  if v_config.pausa_global then
    return;
  end if;

  v_libres := v_config.max_concurrencia - public.llamadas_activas();
  if v_libres <= 0 then
    return;
  end if;

  for r in
    select i.id as item_id, i.lote_id, c.id as contacto_id, c.nombre, c.telefono, c.email,
           c.estado as contacto_estado, c.consentimiento
      from public.lote_items i
      join public.lotes l on l.id = i.lote_id
      join public.contactos c on c.id = i.contacto_id
     where l.estado = 'activo'
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

-- Lotes activos sin nada pendiente → completado. Devuelve cuántos cerró.
create function public.cerrar_lotes_terminados()
returns int
language sql
security definer
set search_path = ''
as $$
  with cerrados as (
    update public.lotes l
       set estado = 'completado'
     where l.estado = 'activo'
       and not exists (
         select 1 from public.lote_items i
          where i.lote_id = l.id
            and i.estado in ('en_cola', 'en_llamada', 'esperando_reintento')
       )
    returning 1
  )
  select count(*)::int from cerrados;
$$;

revoke all on function public.crear_lote(uuid[], text, uuid) from public, anon;
revoke all on function public.reservar_llamadas_lote() from public, anon, authenticated;
revoke all on function public.cerrar_lotes_terminados() from public, anon, authenticated;
grant execute on function public.crear_lote(uuid[], text, uuid) to authenticated, service_role;
grant execute on function public.reservar_llamadas_lote() to service_role;
grant execute on function public.cerrar_lotes_terminados() to service_role;
