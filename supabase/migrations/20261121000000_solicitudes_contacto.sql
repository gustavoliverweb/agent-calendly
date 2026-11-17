-- Web pública: solicitudes del formulario de contacto (/contacto).
--
-- Las guarda el servidor (service role) tras validar y limitar por IP; nadie
-- las lee con la sesión: el proveedor las ve en /admin/solicitudes. Mientras
-- no haya proveedor de email, este es el único aviso.
--
-- Se borran 12 meses después del último cambio, como dice la política de
-- privacidad (purgar_datos_antiguos, cada noche).

create table public.solicitudes_contacto (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(trim(nombre)) between 1 and 120),
  email          text not null check (length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  empresa        text check (empresa is null or length(empresa) <= 200),
  telefono       text check (telefono is null or length(telefono) <= 40),
  sector         text check (sector is null or length(sector) <= 60),
  volumen        text check (volumen is null or length(volumen) <= 60),
  mensaje        text check (mensaje is null or length(mensaje) <= 3000),
  -- Página desde la que llegó (p. ej. /soluciones/clinicas).
  origen         text check (origen is null or length(origen) <= 200),
  estado         text not null default 'nueva' check (estado in ('nueva', 'atendida', 'descartada')),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index solicitudes_contacto_creado_idx on public.solicitudes_contacto (creado_en desc);

create trigger solicitudes_contacto_actualizado_en
  before update on public.solicitudes_contacto
  for each row execute function public.set_actualizado_en();

-- Solo service role.
alter table public.solicitudes_contacto enable row level security;
revoke all on public.solicitudes_contacto from anon, authenticated;

-- Retención: añade las solicitudes a la purga nocturna.
create or replace function public.purgar_datos_antiguos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llamadas int;
  v_eventos int;
  v_eventos_sin_empresa int;
  v_solicitudes int;
begin
  update public.llamadas l
     set transcripcion = null, analisis = null, resultado = null
    from public.configuracion c
   where c.empresa_id = l.empresa_id
     and l.creado_en < now() - make_interval(days => c.retencion_transcripciones_dias)
     and (l.transcripcion is not null or l.analisis is not null or l.resultado is not null);
  get diagnostics v_llamadas = row_count;

  delete from public.eventos_webhook e
   using public.configuracion c
   where c.empresa_id = e.empresa_id
     and e.recibido_en < now() - make_interval(days => c.retencion_webhooks_dias);
  get diagnostics v_eventos = row_count;

  delete from public.eventos_webhook
   where empresa_id is null
     and recibido_en < now() - interval '30 days';
  get diagnostics v_eventos_sin_empresa = row_count;
  v_eventos := v_eventos + v_eventos_sin_empresa;

  -- Solicitudes de la web: 12 meses sin cambios (política de privacidad).
  delete from public.solicitudes_contacto
   where actualizado_en < now() - interval '12 months';
  get diagnostics v_solicitudes = row_count;

  insert into public.latidos (nombre, en) values ('purga', now())
  on conflict (nombre) do update set en = excluded.en;

  if v_llamadas > 0 or v_eventos > 0 or v_solicitudes > 0 then
    insert into public.auditoria (usuario, accion, entidad, detalle)
    values (null, 'purga_retencion', 'sistema',
            jsonb_build_object('llamadas', v_llamadas, 'eventos_webhook', v_eventos, 'solicitudes', v_solicitudes));
  end if;

  return jsonb_build_object('llamadas', v_llamadas, 'eventos_webhook', v_eventos, 'solicitudes', v_solicitudes);
end;
$$;
