-- SaaS S3: guion por empresa (docs/plan-saas.md §2.1 y §4.1 Guion).
--
-- Cada empresa redacta su guion en el panel. Cada vez que se guarda se crea
-- una versión nueva, que ya no se modifica; la empresa elige cuál está activa.
-- El texto montado viaja en cada llamada como variable dinámica
-- ({{guion_negocio}}), junto con el nombre del agente y el primer mensaje;
-- la parte técnica y legal del prompt sigue fija en ElevenLabs.
--
-- Cada llamada guarda la versión con la que se hizo, para auditar qué dijo
-- el agente. Sin guion activo, la empresa no puede llamar.

-- -----------------------------------------------------------------------------
-- Propietario de una empresa
-- -----------------------------------------------------------------------------

create function public.es_propietario(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros m
     where m.empresa_id = p_empresa_id and m.usuario_id = auth.uid() and m.rol = 'propietario'
  );
$$;

revoke all on function public.es_propietario(uuid) from public, anon;
grant execute on function public.es_propietario(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- guiones
-- -----------------------------------------------------------------------------

create table public.guiones (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  version        int not null,
  -- Lo que dice el agente: nombre del negocio, su propio nombre y el saludo.
  negocio_nombre text not null check (length(trim(negocio_nombre)) between 1 and 80),
  nombre_agente  text not null check (length(trim(nombre_agente)) between 1 and 40),
  primer_mensaje text not null check (length(trim(primer_mensaje)) between 20 and 400),
  -- Null: la voz configurada en el agente de ElevenLabs.
  voz_id         text check (voz_id is null or length(voz_id) between 1 and 64),
  -- Apartados del formulario.
  negocio        text not null check (length(negocio) <= 1500),
  motivo         text not null check (length(motivo) <= 1000),
  oferta         text not null check (length(oferta) <= 1500),
  cita           text not null check (length(cita) <= 800),
  preguntas      text not null default '' check (length(preguntas) <= 3000),
  objeciones     text not null default '' check (length(objeciones) <= 2000),
  limites        text not null default '' check (length(limites) <= 1500),
  -- Texto final que recibe el agente ({{guion_negocio}}), montado al guardar.
  texto          text not null check (length(texto) between 1 and 12000),
  creado_por     uuid references auth.users (id) on delete set null,
  creado_en      timestamptz not null default now(),
  unique (empresa_id, version),
  unique (empresa_id, id)
);

comment on table public.guiones is 'Versiones del guion de cada empresa; no se modifican (S3)';

create index guiones_empresa_idx on public.guiones (empresa_id, version desc);

-- Número de versión correlativo dentro de cada empresa.
create function public.numerar_guion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.guiones:' || new.empresa_id::text));
  select coalesce(max(g.version), 0) + 1 into new.version
    from public.guiones g where g.empresa_id = new.empresa_id;
  return new;
end;
$$;

create trigger guiones_version
  before insert on public.guiones
  for each row execute function public.numerar_guion();

alter table public.guiones enable row level security;

create policy "miembros leen guiones" on public.guiones
  for select to authenticated using (public.es_miembro(empresa_id));
create policy "propietarios crean guiones" on public.guiones
  for insert to authenticated
  with check (public.es_propietario(empresa_id) and creado_por = auth.uid());

-- Las versiones no se editan ni se borran (solo en cascada con la empresa).
revoke update, delete on public.guiones from authenticated;

-- -----------------------------------------------------------------------------
-- Guion activo de cada empresa y versión usada en cada llamada
-- -----------------------------------------------------------------------------

alter table public.empresas add column guion_activo_id uuid;
alter table public.empresas
  add constraint empresas_guion_activo_fkey foreign key (id, guion_activo_id)
    references public.guiones (empresa_id, id) on delete set null (guion_activo_id);

alter table public.llamadas
  add column guion_id uuid,
  add column es_prueba boolean not null default false;
alter table public.llamadas
  add constraint llamadas_guion_empresa_fkey foreign key (empresa_id, guion_id)
    references public.guiones (empresa_id, id) on delete set null (guion_id);

comment on column public.llamadas.es_prueba is 'Conversación de prueba desde el navegador (botón "Probar" del guion)';

-- Las llamadas sin guion explícito (las del motor de lotes) usan el activo.
-- Se dispara después de llamadas_empresa (orden alfabético), que fija empresa_id.
create function public.guion_de_la_llamada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.guion_id is null then
    select e.guion_activo_id into new.guion_id from public.empresas e where e.id = new.empresa_id;
  end if;
  return new;
end;
$$;

create trigger llamadas_guion
  before insert on public.llamadas
  for each row execute function public.guion_de_la_llamada();

-- Activar una versión: solo el propietario (o el servidor).
create function public.activar_guion(p_guion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  select g.empresa_id into v_empresa from public.guiones g where g.id = p_guion_id;
  if v_empresa is null
     or (auth.role() <> 'service_role' and not public.es_propietario(v_empresa)) then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;

  update public.empresas set guion_activo_id = p_guion_id where id = v_empresa;

  insert into public.auditoria (usuario, empresa_id, accion, entidad, entidad_id)
  values (auth.uid(), v_empresa, 'activar_guion', 'guion', p_guion_id);
end;
$$;

revoke all on function public.activar_guion(uuid) from public, anon;
grant execute on function public.activar_guion(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- crear_llamada: exige guion, admite una versión concreta y llamadas de prueba
-- -----------------------------------------------------------------------------

drop function public.crear_llamada(uuid, uuid, uuid);

create function public.crear_llamada(
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
  v_empresa uuid;
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

  select c.empresa_id into v_empresa from public.contactos c where c.id = p_contacto_id;
  perform public.comprobar_acceso_empresa(v_empresa);
  if exists (select 1 from public.empresas e where e.id = v_empresa and e.estado <> 'activa') then
    raise exception 'empresa_suspendida' using errcode = 'P0001';
  end if;

  -- Una versión concreta (prueba de un guion aún no activo) o la activa.
  if p_guion_id is not null then
    select g.id into v_guion from public.guiones g where g.id = p_guion_id and g.empresa_id = v_empresa;
  else
    select e.guion_activo_id into v_guion from public.empresas e where e.id = v_empresa;
  end if;
  if v_guion is null then
    raise exception 'sin_guion' using errcode = 'P0001';
  end if;

  -- Serializa a quien crea llamadas de la misma empresa (panel y dispatcher).
  perform pg_advisory_xact_lock(hashtext('public.crear_llamada:' || v_empresa::text));

  select * into v_config from public.configuracion where empresa_id = v_empresa;
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

  if public.llamadas_activas(v_empresa) >= v_config.max_concurrencia then
    raise exception 'concurrencia' using errcode = 'P0001';
  end if;

  insert into public.llamadas (contacto_id, lote_id, lanzada_por, guion_id, es_prueba)
  values (p_contacto_id, p_lote_id, p_lanzada_por, v_guion, coalesce(p_prueba, false))
  returning id into v_id;

  update public.contactos set ultimo_intento_en = now() where id = p_contacto_id;
  return v_id;
end;
$$;

revoke all on function public.crear_llamada(uuid, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.crear_llamada(uuid, uuid, uuid, uuid, boolean) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Guion inicial de la empresa principal: el de ejemplo que ya usaba el agente
-- (docs/system-prompt.md), para que sus llamadas sigan igual. Se edita en el panel.
-- -----------------------------------------------------------------------------

with nuevo as (
  insert into public.guiones (
    empresa_id, version, negocio_nombre, nombre_agente, primer_mensaje,
    negocio, motivo, oferta, cita, preguntas, objeciones, limites, texto
  )
  select e.id, 1,
    'Clínica Sonrisa',
    'Clara',
    'Hola, ¿hablo con {nombre}? Le llamo de {negocio}. Soy {agente}, una asistente virtual con inteligencia artificial, y esta llamada se transcribe para gestionar su cita.',
    'Clínica dental.',
    'La persona pidió información en la web sobre una limpieza o revisión dental. Si pregunta de dónde tenemos su número: lo dejó al pedir información en el formulario de la web.',
    'Una primera visita gratuita de 30 minutos, con revisión y presupuesto sin compromiso.',
    'En la clínica, calle Mayor 10, Madrid. Dura unos 30 minutos.',
    E'¿Cuánto cuesta? La primera visita es gratuita. Los precios de cada tratamiento se los dará el dentista en la visita.\n¿Hay que llevar algo? Solo el DNI y, si tiene, informes dentales anteriores.',
    '',
    'No des precios de tratamientos ni diagnósticos.',
    E'Negocio: Clínica Sonrisa\n\n'
    || E'A qué se dedica:\nClínica dental.\n\n'
    || E'Motivo de la llamada:\nLa persona pidió información en la web sobre una limpieza o revisión dental. Si pregunta de dónde tenemos su número: lo dejó al pedir información en el formulario de la web.\n\n'
    || E'Oferta:\nUna primera visita gratuita de 30 minutos, con revisión y presupuesto sin compromiso.\n\n'
    || E'La cita:\nEn la clínica, calle Mayor 10, Madrid. Dura unos 30 minutos.\n\n'
    || E'Preguntas frecuentes:\n¿Cuánto cuesta? La primera visita es gratuita. Los precios de cada tratamiento se los dará el dentista en la visita.\n¿Hay que llevar algo? Solo el DNI y, si tiene, informes dentales anteriores.\n\n'
    || E'Lo que no debes decir:\nNo des precios de tratamientos ni diagnósticos.'
    from public.empresas e
   where e.slug = 'principal'
  returning id, empresa_id
)
update public.empresas e
   set guion_activo_id = nuevo.id
  from nuevo
 where e.id = nuevo.empresa_id;
