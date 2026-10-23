-- =============================================================================
-- Esquema inicial: agente de voz saliente con agenda en Calendly
-- Tablas del brief (contactos, llamadas) + tablas técnicas (citas, lotes,
-- lote_items, configuracion, eventos_webhook, auditoria).
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type public.contacto_estado as enum
  ('pendiente', 'llamado', 'cita_agendada', 'no_interesado', 'no_contesta', 'no_llamar');

create type public.llamada_estado as enum
  ('iniciada', 'en_curso', 'completada', 'fallida', 'buzon');

create type public.lote_estado as enum
  ('activo', 'pausado', 'completado', 'cancelado');

create type public.lote_item_estado as enum
  ('en_cola', 'en_llamada', 'esperando_reintento', 'completado', 'omitido', 'fallido');

create type public.cita_estado as enum
  ('activa', 'cancelada', 'reprogramada');

create type public.tipo_campana as enum
  ('comercial', 'no_comercial');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create function public.set_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- contactos
-- -----------------------------------------------------------------------------

create table public.contactos (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null check (length(trim(nombre)) > 0),
  telefono              text not null unique check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  email                 text,
  estado                public.contacto_estado not null default 'pendiente',
  consentimiento        boolean not null default false,
  consentimiento_fecha  timestamptz,
  consentimiento_origen text,
  notas                 text,
  -- técnicos
  requiere_seguimiento  boolean not null default false,
  seguimiento_motivo    text,
  intentos              int not null default 0 check (intentos >= 0),
  ultimo_intento_en     timestamptz,
  no_llamar_en          timestamptz,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

comment on column public.contactos.telefono is 'Formato E.164 (+346…), único';
comment on column public.contactos.consentimiento_origen is 'Evidencia RGPD: de dónde procede el consentimiento';
comment on column public.contactos.intentos is 'Intentos sin contestar acumulados';

create index contactos_estado_idx on public.contactos (estado);
create index contactos_seguimiento_idx on public.contactos (requiere_seguimiento) where requiere_seguimiento;
create index contactos_nombre_trgm_idx on public.contactos using gin (nombre extensions.gin_trgm_ops);
create index contactos_email_trgm_idx on public.contactos using gin (email extensions.gin_trgm_ops);
create index contactos_telefono_trgm_idx on public.contactos using gin (telefono extensions.gin_trgm_ops);

create trigger contactos_actualizado_en
  before update on public.contactos
  for each row execute function public.set_actualizado_en();

-- -----------------------------------------------------------------------------
-- lotes
-- -----------------------------------------------------------------------------

create table public.lotes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text,
  estado     public.lote_estado not null default 'activo',
  creado_por uuid references auth.users (id) on delete set null,
  creado_en  timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger lotes_actualizado_en
  before update on public.lotes
  for each row execute function public.set_actualizado_en();

-- -----------------------------------------------------------------------------
-- llamadas
-- -----------------------------------------------------------------------------

create table public.llamadas (
  id                      uuid primary key default gen_random_uuid(),
  contacto_id             uuid not null references public.contactos (id) on delete cascade,
  conversation_id         text unique,
  estado                  public.llamada_estado not null default 'iniciada',
  resultado               text,
  duracion_seg            int check (duracion_seg >= 0),
  transcripcion           jsonb,
  cita_agendada           boolean not null default false,
  calendly_event_uri      text,
  fecha_cita              timestamptz,
  creado_en               timestamptz not null default now(),
  -- técnicos
  lote_id                 uuid references public.lotes (id) on delete set null,
  sip_call_id             text,
  clasificacion           text,
  analisis                jsonb,
  motivo_fallo            text,
  calendly_invitee_uri    text,
  calendly_cancel_url     text,
  calendly_reschedule_url text,
  finalizada_en           timestamptz,
  webhook_recibido_en     timestamptz,
  lanzada_por             uuid references auth.users (id) on delete set null,
  actualizado_en          timestamptz not null default now()
);

comment on column public.llamadas.conversation_id is 'ID de ElevenLabs, para cruzar con el webhook';
comment on column public.llamadas.fecha_cita is 'En UTC';

create index llamadas_contacto_idx on public.llamadas (contacto_id, creado_en desc);
create index llamadas_activas_idx on public.llamadas (creado_en) where estado in ('iniciada', 'en_curso');
create index llamadas_lote_idx on public.llamadas (lote_id);
create index llamadas_creado_idx on public.llamadas (creado_en desc);

create trigger llamadas_actualizado_en
  before update on public.llamadas
  for each row execute function public.set_actualizado_en();

-- -----------------------------------------------------------------------------
-- citas (historial; llamadas.calendly_event_uri / fecha_cita reflejan la vigente)
-- -----------------------------------------------------------------------------

create table public.citas (
  id                   uuid primary key default gen_random_uuid(),
  contacto_id          uuid not null references public.contactos (id) on delete cascade,
  llamada_id           uuid references public.llamadas (id) on delete set null,
  calendly_event_uri   text not null,
  calendly_invitee_uri text not null unique,
  inicio               timestamptz not null,
  estado               public.cita_estado not null default 'activa',
  reprogramada_desde   uuid references public.citas (id) on delete set null,
  cancelada_en         timestamptz,
  motivo_cancelacion   text,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);

create index citas_contacto_idx on public.citas (contacto_id, inicio desc);
create index citas_llamada_idx on public.citas (llamada_id);
create index citas_event_idx on public.citas (calendly_event_uri);

create trigger citas_actualizado_en
  before update on public.citas
  for each row execute function public.set_actualizado_en();

-- -----------------------------------------------------------------------------
-- lote_items (cola de llamadas de un lote)
-- -----------------------------------------------------------------------------

create table public.lote_items (
  id                 uuid primary key default gen_random_uuid(),
  lote_id            uuid not null references public.lotes (id) on delete cascade,
  contacto_id        uuid not null references public.contactos (id) on delete cascade,
  estado             public.lote_item_estado not null default 'en_cola',
  intentos           int not null default 0 check (intentos >= 0),
  proximo_intento_en timestamptz,
  ultima_llamada_id  uuid references public.llamadas (id) on delete set null,
  motivo_omision     text,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  unique (lote_id, contacto_id)
);

create index lote_items_cola_idx on public.lote_items (estado, proximo_intento_en);
create index lote_items_contacto_idx on public.lote_items (contacto_id);

create trigger lote_items_actualizado_en
  before update on public.lote_items
  for each row execute function public.set_actualizado_en();

-- -----------------------------------------------------------------------------
-- configuracion (fila única)
-- -----------------------------------------------------------------------------

create table public.configuracion (
  id                     int primary key default 1 check (id = 1),
  max_concurrencia       int not null default 2 check (max_concurrencia between 1 and 20),
  -- Franjas en hora de Europe/Madrid. dias: 1 = lunes … 7 = domingo (ISO).
  franjas                jsonb not null default '[
    {"dias": [1, 2, 3, 4, 5], "desde": "10:00", "hasta": "14:00"},
    {"dias": [1, 2, 3, 4, 5], "desde": "16:00", "hasta": "20:00"}
  ]'::jsonb check (jsonb_typeof(franjas) = 'array'),
  max_reintentos         int not null default 2 check (max_reintentos between 0 and 10),
  horas_entre_reintentos int not null default 24 check (horas_entre_reintentos between 1 and 720),
  -- Fechas 'YYYY-MM-DD' sin llamadas.
  festivos               jsonb not null default '[]'::jsonb check (jsonb_typeof(festivos) = 'array'),
  -- Por defecto el escenario más restrictivo (exige consentimiento).
  tipo_campana           public.tipo_campana not null default 'comercial',
  pausa_global           boolean not null default false,
  timeout_llamada_min    int not null default 15 check (timeout_llamada_min between 5 and 120),
  actualizado_en         timestamptz not null default now(),
  actualizado_por        uuid references auth.users (id) on delete set null
);

insert into public.configuracion (id) values (1);

create trigger configuracion_actualizado_en
  before update on public.configuracion
  for each row execute function public.set_actualizado_en();

-- -----------------------------------------------------------------------------
-- eventos_webhook (idempotencia y auditoría de lo recibido)
-- -----------------------------------------------------------------------------

create table public.eventos_webhook (
  id           uuid primary key default gen_random_uuid(),
  origen       text not null check (origen in ('elevenlabs', 'calendly')),
  id_externo   text not null,
  tipo         text not null,
  recibido_en  timestamptz not null default now(),
  procesado_en timestamptz,
  error        text,
  payload      jsonb,
  unique (origen, id_externo)
);

create index eventos_webhook_recibido_idx on public.eventos_webhook (recibido_en desc);

-- -----------------------------------------------------------------------------
-- auditoria (sin datos personales en "detalle")
-- -----------------------------------------------------------------------------

create table public.auditoria (
  id         bigint generated always as identity primary key,
  usuario    uuid references auth.users (id) on delete set null,
  accion     text not null,
  entidad    text not null,
  entidad_id uuid,
  detalle    jsonb,
  creado_en  timestamptz not null default now()
);

create index auditoria_creado_idx on public.auditoria (creado_en desc);

-- -----------------------------------------------------------------------------
-- Lista de exclusión: "no_llamar" es permanente
-- -----------------------------------------------------------------------------

-- Impide sacar a un contacto de no_llamar salvo que la transacción lo permita
-- explícitamente (set local app.permitir_reactivar = 'on'), lo que solo debe
-- hacer una función administrativa auditada.
create function public.proteger_no_llamar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado = 'no_llamar'
     and new.estado is distinct from 'no_llamar'
     and coalesce(current_setting('app.permitir_reactivar', true), '') <> 'on' then
    raise exception 'El contacto % está en la lista de exclusión (no_llamar)', old.id
      using errcode = 'check_violation';
  end if;

  if new.estado = 'no_llamar' and old.estado is distinct from 'no_llamar' then
    new.no_llamar_en := coalesce(new.no_llamar_en, now());
  end if;

  return new;
end;
$$;

create trigger contactos_proteger_no_llamar
  before update of estado on public.contactos
  for each row execute function public.proteger_no_llamar();

-- Al entrar en no_llamar, se retira de cualquier lote pendiente, venga de
-- donde venga el cambio (tool del agente, webhook o panel).
create function public.retirar_de_lotes_si_no_llamar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.lote_items
     set estado = 'omitido', motivo_omision = 'no_llamar'
   where contacto_id = new.id
     and estado in ('en_cola', 'esperando_reintento');
  return new;
end;
$$;

create trigger contactos_retirar_de_lotes
  after update of estado on public.contactos
  for each row
  when (new.estado = 'no_llamar' and old.estado is distinct from 'no_llamar')
  execute function public.retirar_de_lotes_si_no_llamar();

-- -----------------------------------------------------------------------------
-- Funciones (RPC)
-- -----------------------------------------------------------------------------

-- Llamadas que ocupan un hueco de concurrencia. Las que llevan más de
-- timeout_llamada_min sin cerrarse no cuentan (se reconcilian aparte).
create function public.llamadas_activas()
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
    from public.llamadas l
   where l.estado in ('iniciada', 'en_curso')
     and l.creado_en > now() - make_interval(mins => (
       select c.timeout_llamada_min from public.configuracion c where c.id = 1
     ));
$$;

-- Marca un contacto como no_llamar (inmediato y permanente) y lo audita.
create function public.marcar_no_llamar(p_contacto_id uuid, p_origen text default 'panel')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;

  update public.contactos
     set estado = 'no_llamar'
   where id = p_contacto_id
     and estado <> 'no_llamar';

  if found then
    insert into public.auditoria (usuario, accion, entidad, entidad_id, detalle)
    values (auth.uid(), 'marcar_no_llamar', 'contacto', p_contacto_id,
            jsonb_build_object('origen', p_origen));
  end if;
end;
$$;

-- Derecho de supresión (RGPD): borra el contacto y en cascada sus llamadas,
-- transcripciones, citas e items de lote. Deja una traza sin datos personales.
create function public.borrar_contacto_rgpd(p_contacto_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llamadas int;
begin
  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_llamadas from public.llamadas where contacto_id = p_contacto_id;

  delete from public.contactos where id = p_contacto_id;

  if found then
    insert into public.auditoria (usuario, accion, entidad, entidad_id, detalle)
    values (auth.uid(), 'borrar_contacto_rgpd', 'contacto', p_contacto_id,
            jsonb_build_object('llamadas_borradas', v_llamadas));
  end if;
end;
$$;

revoke all on function public.marcar_no_llamar(uuid, text) from public, anon;
revoke all on function public.borrar_contacto_rgpd(uuid) from public, anon;
revoke all on function public.llamadas_activas() from public, anon;
grant execute on function public.marcar_no_llamar(uuid, text) to authenticated, service_role;
grant execute on function public.borrar_contacto_rgpd(uuid) to authenticated, service_role;
grant execute on function public.llamadas_activas() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Un único negocio con pocos usuarios internos: cualquier usuario autenticado
-- ve todo. anon no ve nada. Tools, webhooks y cron usan service_role.
-- -----------------------------------------------------------------------------

alter table public.contactos       enable row level security;
alter table public.llamadas        enable row level security;
alter table public.citas           enable row level security;
alter table public.lotes           enable row level security;
alter table public.lote_items      enable row level security;
alter table public.configuracion   enable row level security;
alter table public.eventos_webhook enable row level security;
alter table public.auditoria       enable row level security;

create policy "autenticados leen contactos" on public.contactos
  for select to authenticated using (true);
create policy "autenticados crean contactos" on public.contactos
  for insert to authenticated with check (true);
create policy "autenticados editan contactos" on public.contactos
  for update to authenticated using (true) with check (true);

create policy "autenticados leen llamadas" on public.llamadas
  for select to authenticated using (true);

create policy "autenticados leen citas" on public.citas
  for select to authenticated using (true);

create policy "autenticados leen lotes" on public.lotes
  for select to authenticated using (true);

create policy "autenticados leen lote_items" on public.lote_items
  for select to authenticated using (true);

create policy "autenticados leen configuracion" on public.configuracion
  for select to authenticated using (true);
create policy "autenticados editan configuracion" on public.configuracion
  for update to authenticated using (true) with check (true);

create policy "autenticados leen auditoria" on public.auditoria
  for select to authenticated using (true);

-- eventos_webhook: sin políticas → solo service_role (contiene payloads crudos).

-- Los borrados de contactos van solo por borrar_contacto_rgpd().
revoke delete on public.contactos from authenticated;
revoke all on all tables in schema public from anon;
