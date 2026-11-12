-- SaaS S1: base multi-empresa (docs/plan-saas.md §2.3 y §3).
--
-- Cada fila de negocio pertenece a una empresa. Un usuario solo ve las filas
-- de las empresas de las que es miembro (RLS); las funciones security
-- definer comprueban lo mismo. Lo existente pasa a la empresa "principal".
--
-- Coherencia: llamadas, citas e items de lote toman la empresa de su
-- contacto (trigger), y las referencias entre ellos llevan la empresa en la
-- clave foránea, así que no puede haber una cita de la empresa A apuntando a
-- una llamada de la B.

-- -----------------------------------------------------------------------------
-- empresas y miembros
-- -----------------------------------------------------------------------------

create type public.miembro_rol as enum ('propietario', 'operador');

create table public.empresas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(trim(nombre)) > 0),
  slug           text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'),
  estado         text not null default 'activa' check (estado in ('activa', 'suspendida')),
  zona_horaria   text not null default 'Europe/Madrid',
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on column public.empresas.slug is 'Identificador corto (subdominio por defecto en la fase de marca blanca)';

create trigger empresas_actualizado_en
  before update on public.empresas
  for each row execute function public.set_actualizado_en();

create table public.miembros (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  rol        public.miembro_rol not null default 'operador',
  creado_en  timestamptz not null default now(),
  primary key (empresa_id, usuario_id)
);

create index miembros_usuario_idx on public.miembros (usuario_id);

-- security definer: las políticas de miembros no pueden consultar miembros
-- sin recursión.
create function public.es_miembro(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembros m
     where m.empresa_id = p_empresa_id and m.usuario_id = auth.uid()
  );
$$;

revoke all on function public.es_miembro(uuid) from public, anon;
grant execute on function public.es_miembro(uuid) to authenticated, service_role;

insert into public.empresas (nombre, slug) values ('Empresa principal', 'principal');

-- Los usuarios actuales son del único negocio que había.
insert into public.miembros (empresa_id, usuario_id, rol)
select e.id, u.id, 'propietario'
  from auth.users u
 cross join public.empresas e
 where e.slug = 'principal';

-- -----------------------------------------------------------------------------
-- empresa_id en las tablas de negocio
-- -----------------------------------------------------------------------------

alter table public.contactos       add column empresa_id uuid references public.empresas (id) on delete cascade;
alter table public.lotes           add column empresa_id uuid references public.empresas (id) on delete cascade;
alter table public.llamadas        add column empresa_id uuid references public.empresas (id) on delete cascade;
alter table public.citas           add column empresa_id uuid references public.empresas (id) on delete cascade;
alter table public.lote_items      add column empresa_id uuid references public.empresas (id) on delete cascade;
alter table public.configuracion   add column empresa_id uuid references public.empresas (id) on delete cascade;
-- Nulas cuando no hay empresa: acciones del sistema, webhooks aún sin asociar.
alter table public.auditoria       add column empresa_id uuid references public.empresas (id) on delete cascade;
alter table public.eventos_webhook add column empresa_id uuid references public.empresas (id) on delete cascade;

update public.contactos       set empresa_id = (select id from public.empresas where slug = 'principal');
update public.lotes           set empresa_id = (select id from public.empresas where slug = 'principal');
update public.llamadas        set empresa_id = (select id from public.empresas where slug = 'principal');
update public.citas           set empresa_id = (select id from public.empresas where slug = 'principal');
update public.lote_items      set empresa_id = (select id from public.empresas where slug = 'principal');
update public.configuracion   set empresa_id = (select id from public.empresas where slug = 'principal');
update public.auditoria       set empresa_id = (select id from public.empresas where slug = 'principal');
update public.eventos_webhook set empresa_id = (select id from public.empresas where slug = 'principal');

alter table public.contactos     alter column empresa_id set not null;
alter table public.lotes         alter column empresa_id set not null;
alter table public.llamadas      alter column empresa_id set not null;
alter table public.citas         alter column empresa_id set not null;
alter table public.lote_items    alter column empresa_id set not null;
alter table public.configuracion alter column empresa_id set not null;

-- Claves para las referencias con empresa.
alter table public.contactos add constraint contactos_empresa_id_id_key unique (empresa_id, id);
alter table public.lotes     add constraint lotes_empresa_id_id_key unique (empresa_id, id);
alter table public.llamadas  add constraint llamadas_empresa_id_id_key unique (empresa_id, id);

-- El teléfono es único dentro de cada empresa, no en toda la plataforma.
alter table public.contactos drop constraint contactos_telefono_key;
alter table public.contactos add constraint contactos_empresa_telefono_key unique (empresa_id, telefono);

alter table public.llamadas
  add constraint llamadas_contacto_empresa_fkey foreign key (empresa_id, contacto_id)
    references public.contactos (empresa_id, id) on delete cascade,
  add constraint llamadas_lote_empresa_fkey foreign key (empresa_id, lote_id)
    references public.lotes (empresa_id, id) on delete set null (lote_id);

alter table public.citas
  add constraint citas_contacto_empresa_fkey foreign key (empresa_id, contacto_id)
    references public.contactos (empresa_id, id) on delete cascade,
  add constraint citas_llamada_empresa_fkey foreign key (empresa_id, llamada_id)
    references public.llamadas (empresa_id, id) on delete set null (llamada_id);

alter table public.lote_items
  add constraint lote_items_contacto_empresa_fkey foreign key (empresa_id, contacto_id)
    references public.contactos (empresa_id, id) on delete cascade,
  add constraint lote_items_lote_empresa_fkey foreign key (empresa_id, lote_id)
    references public.lotes (empresa_id, id) on delete cascade,
  add constraint lote_items_llamada_empresa_fkey foreign key (empresa_id, ultima_llamada_id)
    references public.llamadas (empresa_id, id) on delete set null (ultima_llamada_id);

-- Las claves de una sola columna quedan cubiertas por las compuestas. Además,
-- con las dos la API no sabría por cuál unir en los select anidados
-- (p. ej. llamadas → contactos (nombre)).
alter table public.llamadas
  drop constraint llamadas_contacto_id_fkey,
  drop constraint llamadas_lote_id_fkey;
alter table public.citas
  drop constraint citas_contacto_id_fkey,
  drop constraint citas_llamada_id_fkey;
alter table public.lote_items
  drop constraint lote_items_contacto_id_fkey,
  drop constraint lote_items_lote_id_fkey,
  drop constraint lote_items_ultima_llamada_id_fkey;

-- Índices por empresa para los listados del panel.
drop index public.contactos_estado_idx;
create index contactos_empresa_estado_idx on public.contactos (empresa_id, estado);
create index lotes_empresa_idx on public.lotes (empresa_id, creado_en desc);
create index llamadas_empresa_creado_idx on public.llamadas (empresa_id, creado_en desc);
create index citas_empresa_idx on public.citas (empresa_id);
create index lote_items_empresa_idx on public.lote_items (empresa_id);
create index auditoria_empresa_idx on public.auditoria (empresa_id, creado_en desc);
create index eventos_webhook_empresa_idx on public.eventos_webhook (empresa_id, recibido_en desc);

-- La empresa de llamadas, citas e items es siempre la de su contacto.
create function public.empresa_del_contacto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select c.empresa_id into new.empresa_id from public.contactos c where c.id = new.contacto_id;
  if new.empresa_id is null then
    raise exception 'Contacto % no encontrado', new.contacto_id using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger llamadas_empresa
  before insert or update of contacto_id, empresa_id on public.llamadas
  for each row execute function public.empresa_del_contacto();
create trigger citas_empresa
  before insert or update of contacto_id, empresa_id on public.citas
  for each row execute function public.empresa_del_contacto();
create trigger lote_items_empresa
  before insert or update of contacto_id, empresa_id on public.lote_items
  for each row execute function public.empresa_del_contacto();

-- -----------------------------------------------------------------------------
-- configuracion: una fila por empresa
-- -----------------------------------------------------------------------------

alter table public.configuracion drop constraint configuracion_pkey;
alter table public.configuracion drop column id;
alter table public.configuracion add primary key (empresa_id);

create function public.crear_configuracion_empresa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.configuracion (empresa_id) values (new.id);
  return new;
end;
$$;

create trigger empresas_configuracion
  after insert on public.empresas
  for each row execute function public.crear_configuracion_empresa();

-- -----------------------------------------------------------------------------
-- RLS por empresa
-- -----------------------------------------------------------------------------

drop policy "autenticados leen contactos" on public.contactos;
drop policy "autenticados crean contactos" on public.contactos;
drop policy "autenticados editan contactos" on public.contactos;
drop policy "autenticados leen llamadas" on public.llamadas;
drop policy "autenticados leen citas" on public.citas;
drop policy "autenticados leen lotes" on public.lotes;
drop policy "autenticados leen lote_items" on public.lote_items;
drop policy "autenticados leen configuracion" on public.configuracion;
drop policy "autenticados editan configuracion" on public.configuracion;
drop policy "autenticados leen auditoria" on public.auditoria;
drop policy "autenticados registran su auditoria" on public.auditoria;

alter table public.empresas enable row level security;
alter table public.miembros enable row level security;

create policy "miembros leen su empresa" on public.empresas
  for select to authenticated using (public.es_miembro(id));

create policy "miembros leen los miembros de su empresa" on public.miembros
  for select to authenticated using (public.es_miembro(empresa_id));

create policy "miembros leen contactos" on public.contactos
  for select to authenticated using (public.es_miembro(empresa_id));
create policy "miembros crean contactos" on public.contactos
  for insert to authenticated with check (public.es_miembro(empresa_id));
create policy "miembros editan contactos" on public.contactos
  for update to authenticated
  using (public.es_miembro(empresa_id)) with check (public.es_miembro(empresa_id));

create policy "miembros leen llamadas" on public.llamadas
  for select to authenticated using (public.es_miembro(empresa_id));

create policy "miembros leen citas" on public.citas
  for select to authenticated using (public.es_miembro(empresa_id));

create policy "miembros leen lotes" on public.lotes
  for select to authenticated using (public.es_miembro(empresa_id));

create policy "miembros leen lote_items" on public.lote_items
  for select to authenticated using (public.es_miembro(empresa_id));

create policy "miembros leen configuracion" on public.configuracion
  for select to authenticated using (public.es_miembro(empresa_id));
create policy "miembros editan configuracion" on public.configuracion
  for update to authenticated
  using (public.es_miembro(empresa_id)) with check (public.es_miembro(empresa_id));

create policy "miembros leen auditoria" on public.auditoria
  for select to authenticated using (public.es_miembro(empresa_id));
create policy "miembros registran su auditoria" on public.auditoria
  for insert to authenticated with check (usuario = auth.uid() and public.es_miembro(empresa_id));

-- empresas y miembros se gestionan con service role (alta por invitación, S2).
revoke insert, update, delete on public.empresas from authenticated;
revoke insert, update, delete on public.miembros from authenticated;
revoke all on public.empresas, public.miembros from anon;

-- -----------------------------------------------------------------------------
-- Funciones: por empresa
-- -----------------------------------------------------------------------------

-- Lanzar desde el panel o el dispatcher solo es posible si la empresa está
-- activa y quien lo pide es miembro.
create function public.comprobar_acceso_empresa(p_empresa_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_empresa_id is null then
    raise exception 'no_encontrado' using errcode = 'P0001';
  end if;
  if auth.role() <> 'service_role' and not public.es_miembro(p_empresa_id) then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function public.comprobar_acceso_empresa(uuid) from public, anon, authenticated;

drop function public.llamadas_activas();

create function public.llamadas_activas(p_empresa_id uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
    from public.llamadas l
   where l.empresa_id = p_empresa_id
     and l.estado in ('iniciada', 'en_curso')
     and l.creado_en > now() - make_interval(mins => (
       select c.timeout_llamada_min from public.configuracion c where c.empresa_id = p_empresa_id
     ));
$$;

revoke all on function public.llamadas_activas(uuid) from public, anon, authenticated;
grant execute on function public.llamadas_activas(uuid) to service_role;

create or replace function public.marcar_no_llamar(p_contacto_id uuid, p_origen text default 'panel')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  select empresa_id into v_empresa from public.contactos where id = p_contacto_id;
  if v_empresa is null then
    return;
  end if;
  perform public.comprobar_acceso_empresa(v_empresa);

  update public.contactos
     set estado = 'no_llamar'
   where id = p_contacto_id
     and estado <> 'no_llamar';

  if found then
    insert into public.auditoria (usuario, empresa_id, accion, entidad, entidad_id, detalle)
    values (auth.uid(), v_empresa, 'marcar_no_llamar', 'contacto', p_contacto_id,
            jsonb_build_object('origen', p_origen));
  end if;
end;
$$;

create or replace function public.borrar_contacto_rgpd(p_contacto_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_llamadas int;
begin
  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  select empresa_id into v_empresa from public.contactos where id = p_contacto_id;
  if v_empresa is null then
    return;
  end if;
  perform public.comprobar_acceso_empresa(v_empresa);

  select count(*) into v_llamadas from public.llamadas where contacto_id = p_contacto_id;

  delete from public.contactos where id = p_contacto_id;

  if found then
    insert into public.auditoria (usuario, empresa_id, accion, entidad, entidad_id, detalle)
    values (auth.uid(), v_empresa, 'borrar_contacto_rgpd', 'contacto', p_contacto_id,
            jsonb_build_object('llamadas_borradas', v_llamadas));
  end if;
end;
$$;

drop function public.contactos_por_estado();

create function public.contactos_por_estado(p_empresa_id uuid)
returns table (estado public.contacto_estado, total bigint)
language sql
stable
set search_path = ''
as $$
  select c.estado, count(*) from public.contactos c where c.empresa_id = p_empresa_id group by c.estado;
$$;

revoke all on function public.contactos_por_estado(uuid) from public, anon;
grant execute on function public.contactos_por_estado(uuid) to authenticated, service_role;

drop function public.kpis_llamadas(timestamptz);

create function public.kpis_llamadas(p_empresa_id uuid, p_desde timestamptz)
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
   where l.empresa_id = p_empresa_id
     and l.creado_en >= p_desde;
$$;

revoke all on function public.kpis_llamadas(uuid, timestamptz) from public, anon;
grant execute on function public.kpis_llamadas(uuid, timestamptz) to authenticated, service_role;

drop function public.crear_llamada(uuid, uuid, uuid);

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
  v_empresa uuid;
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

  insert into public.llamadas (contacto_id, lote_id, lanzada_por)
  values (p_contacto_id, p_lote_id, p_lanzada_por)
  returning id into v_id;

  update public.contactos set ultimo_intento_en = now() where id = p_contacto_id;
  return v_id;
end;
$$;

revoke all on function public.crear_llamada(uuid, uuid, uuid) from public, anon;
grant execute on function public.crear_llamada(uuid, uuid, uuid) to authenticated, service_role;

drop function public.crear_lote(uuid[], text, uuid);

create function public.crear_lote(
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
  v_comercial boolean;
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

  select c.tipo_campana = 'comercial' into v_comercial
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

drop function public.reservar_llamadas_lote();

-- Reclama items elegibles de una empresa y crea su llamada. El dispatcher la
-- llama una vez por empresa activa, tras comprobar su franja horaria.
create function public.reservar_llamadas_lote(p_empresa_id uuid)
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
  if not exists (select 1 from public.empresas e where e.id = p_empresa_id and e.estado = 'activa') then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('public.crear_llamada:' || p_empresa_id::text));

  select * into v_config from public.configuracion where empresa_id = p_empresa_id;
  if v_config.pausa_global then
    return;
  end if;

  v_libres := v_config.max_concurrencia - public.llamadas_activas(p_empresa_id);
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

revoke all on function public.reservar_llamadas_lote(uuid) from public, anon, authenticated;
grant execute on function public.reservar_llamadas_lote(uuid) to service_role;

-- Retención con los plazos de cada empresa. Los webhooks aún sin empresa usan
-- el plazo por defecto.
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
