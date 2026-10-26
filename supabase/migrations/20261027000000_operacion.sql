-- Fase 7: operación.
--
-- latidos: última ejecución de tareas periódicas (despacho, purga), para
-- avisar en el panel si la tarea programada dejó de ejecutarse.
-- Retención (RGPD §13.3): plazos editables y purga diaria.
-- kpis_llamadas: agregados del resumen sin traer filas al servidor.

create table public.latidos (
  nombre text primary key,
  en     timestamptz not null default now()
);

alter table public.latidos enable row level security;
create policy "autenticados leen latidos" on public.latidos
  for select to authenticated using (true);

alter table public.configuracion
  add column retencion_transcripciones_dias int not null default 365
    check (retencion_transcripciones_dias between 30 and 3650),
  add column retencion_webhooks_dias int not null default 30
    check (retencion_webhooks_dias between 7 and 365);

-- Borra el contenido conversacional de las llamadas antiguas (transcripción,
-- análisis con los datos recogidos y resumen) y los webhooks recibidos.
-- Se conservan estado, clasificación, duración y cita: lo que alimenta los
-- KPIs y el historial, sin datos de la conversación.
create function public.purgar_datos_antiguos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.configuracion%rowtype;
  v_llamadas int;
  v_eventos int;
begin
  select * into v_config from public.configuracion where id = 1;

  update public.llamadas
     set transcripcion = null, analisis = null, resultado = null
   where creado_en < now() - make_interval(days => v_config.retencion_transcripciones_dias)
     and (transcripcion is not null or analisis is not null or resultado is not null);
  get diagnostics v_llamadas = row_count;

  delete from public.eventos_webhook
   where recibido_en < now() - make_interval(days => v_config.retencion_webhooks_dias);
  get diagnostics v_eventos = row_count;

  insert into public.latidos (nombre, en) values ('purga', now())
  on conflict (nombre) do update set en = excluded.en;

  if v_llamadas > 0 or v_eventos > 0 then
    insert into public.auditoria (usuario, accion, entidad, detalle)
    values (null, 'purga_retencion', 'sistema',
            jsonb_build_object('llamadas', v_llamadas, 'eventos_webhook', v_eventos));
  end if;

  return jsonb_build_object('llamadas', v_llamadas, 'eventos_webhook', v_eventos);
end;
$$;

-- Llamadas desde una fecha: total, contestadas (hubo conversación), citas y
-- segundos hablados. Respeta RLS (security invoker).
create function public.kpis_llamadas(p_desde timestamptz)
returns table (llamadas int, contestadas int, citas int, segundos bigint)
language sql
stable
set search_path = ''
as $$
  select count(*)::int,
         count(*) filter (
           where l.estado = 'completada'
             and coalesce(l.clasificacion, '') not in ('sin_respuesta', 'buzon')
         )::int,
         count(*) filter (where l.cita_agendada)::int,
         coalesce(sum(l.duracion_seg), 0)::bigint
    from public.llamadas l
   where l.creado_en >= p_desde;
$$;

revoke all on function public.purgar_datos_antiguos() from public, anon, authenticated;
grant execute on function public.purgar_datos_antiguos() to service_role;
revoke all on function public.kpis_llamadas(timestamptz) from public, anon;
grant execute on function public.kpis_llamadas(timestamptz) to authenticated, service_role;
