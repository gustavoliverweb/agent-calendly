-- Fase 5: alta atómica de llamadas.
--
-- Comprobar la concurrencia y después insertar en dos pasos deja una carrera:
-- dos clics (o el panel y el dispatcher a la vez) leen el mismo número de
-- llamadas activas y ambos lanzan. Esta función lo hace bajo un advisory lock
-- de transacción, que serializa a todos los que crean llamadas.

create function public.crear_llamada(
  p_contacto_id uuid,
  p_lote_id uuid default null,
  p_lanzada_por uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
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

  perform pg_advisory_xact_lock(hashtext('public.crear_llamada'));

  select * into v_config from public.configuracion where id = 1;
  if v_config.pausa_global then
    raise exception 'pausa_global' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.contactos
     where id = p_contacto_id and estado = 'no_llamar'
  ) then
    raise exception 'no_llamar' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.llamadas
     where contacto_id = p_contacto_id
       and estado in ('iniciada', 'en_curso')
       and creado_en > now() - make_interval(mins => v_config.timeout_llamada_min)
  ) then
    raise exception 'llamada_activa' using errcode = 'P0001';
  end if;

  if public.llamadas_activas() >= v_config.max_concurrencia then
    raise exception 'concurrencia' using errcode = 'P0001';
  end if;

  insert into public.llamadas (contacto_id, lote_id, lanzada_por)
  values (p_contacto_id, p_lote_id, p_lanzada_por)
  returning id into v_id;

  update public.contactos set ultimo_intento_en = now() where id = p_contacto_id;
  return v_id;
end;
$$;

revoke all on function public.crear_llamada(uuid, uuid, uuid) from public, anon;
grant execute on function public.crear_llamada(uuid, uuid, uuid) to authenticated, service_role;
