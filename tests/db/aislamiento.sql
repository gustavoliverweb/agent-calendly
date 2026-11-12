-- Aislamiento entre empresas (docs/plan-saas.md §2.3).
--
-- Se ejecuta dentro de una transacción que se deshace al final (pnpm
-- db:test), contra la base de datos real: no deja nada. Crea dos empresas
-- con un usuario y un contacto cada una y comprueba, con la sesión del
-- usuario de A, que no puede ver ni tocar nada de B.
--
-- Cada comprobación que falla aborta con "FALLO: …".

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Datos de prueba (como postgres, sin RLS) ---------------------------------

select set_config('t.ua', gen_random_uuid()::text, true),
       set_config('t.ub', gen_random_uuid()::text, true);

insert into auth.users (id, email, aud, role)
values (current_setting('t.ua')::uuid, 'a@aislamiento.test', 'authenticated', 'authenticated'),
       (current_setting('t.ub')::uuid, 'b@aislamiento.test', 'authenticated', 'authenticated');

with a as (insert into public.empresas (nombre, slug) values ('Empresa A', 'test-aislamiento-a') returning id),
     b as (insert into public.empresas (nombre, slug) values ('Empresa B', 'test-aislamiento-b') returning id)
select set_config('t.ea', (select id from a)::text, true),
       set_config('t.eb', (select id from b)::text, true);

insert into public.miembros (empresa_id, usuario_id, rol)
values (current_setting('t.ea')::uuid, current_setting('t.ua')::uuid, 'propietario'),
       (current_setting('t.eb')::uuid, current_setting('t.ub')::uuid, 'propietario');

with a as (
  insert into public.contactos (empresa_id, nombre, telefono, consentimiento)
  values (current_setting('t.ea')::uuid, 'Contacto A', '+34600000001', true) returning id
), b as (
  insert into public.contactos (empresa_id, nombre, telefono, consentimiento)
  values (current_setting('t.eb')::uuid, 'Contacto B', '+34600000001', true) returning id
)
select set_config('t.ca', (select id from a)::text, true),
       set_config('t.cb', (select id from b)::text, true);

-- La empresa de la llamada sale del contacto aunque se pida otra.
with lb as (
  insert into public.llamadas (contacto_id, empresa_id)
  values (current_setting('t.cb')::uuid, current_setting('t.ea')::uuid) returning id, empresa_id
)
select set_config('t.lb', (select id from lb)::text, true),
       set_config('t.lb_empresa', (select empresa_id from lb)::text, true);

do $$
begin
  if current_setting('t.lb_empresa')::uuid <> current_setting('t.eb')::uuid then
    raise exception 'FALLO: la llamada no tomó la empresa de su contacto';
  end if;
  if (select count(*) from public.configuracion
       where empresa_id in (current_setting('t.ea')::uuid, current_setting('t.eb')::uuid)) <> 2 then
    raise exception 'FALLO: una empresa nueva no recibió su configuración';
  end if;
  raise notice 'ok: empresa heredada del contacto y configuración por empresa';
end $$;

-- Integridad: una cita de A no puede apuntar a una llamada de B.
do $$
begin
  insert into public.citas (contacto_id, llamada_id, calendly_event_uri, calendly_invitee_uri, inicio)
  values (current_setting('t.ca')::uuid, current_setting('t.lb')::uuid, 'evt', 'inv-aislamiento', now());
  raise exception 'FALLO: cita de A enlazada a una llamada de B';
exception when foreign_key_violation then
  raise notice 'ok: referencias cruzadas entre empresas rechazadas';
end $$;

-- Sesión del usuario de A ----------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('t.ua'), 'role', 'authenticated')::text, true);

do $$
begin
  if (select count(*) from public.contactos where empresa_id = current_setting('t.eb')::uuid) <> 0
     or (select count(*) from public.contactos where id = current_setting('t.ca')::uuid) <> 1 then
    raise exception 'FALLO: lectura de contactos';
  end if;
  if exists (select 1 from public.llamadas where id = current_setting('t.lb')::uuid) then
    raise exception 'FALLO: ve llamadas de B';
  end if;
  if exists (select 1 from public.empresas where id = current_setting('t.eb')::uuid)
     or exists (select 1 from public.miembros where empresa_id = current_setting('t.eb')::uuid)
     or exists (select 1 from public.configuracion where empresa_id = current_setting('t.eb')::uuid) then
    raise exception 'FALLO: ve la empresa, los miembros o la configuración de B';
  end if;
  if exists (select 1 from public.contactos_por_estado(current_setting('t.eb')::uuid)) then
    raise exception 'FALLO: contactos_por_estado de B';
  end if;
  if (select llamadas from public.kpis_llamadas(current_setting('t.eb')::uuid, now() - interval '1 day')) <> 0 then
    raise exception 'FALLO: kpis_llamadas de B';
  end if;
  raise notice 'ok: A no lee nada de B';
end $$;

do $$
begin
  update public.contactos set nombre = 'cambiado' where id = current_setting('t.cb')::uuid;
  update public.configuracion set pausa_global = true where empresa_id = current_setting('t.eb')::uuid;
  raise notice 'ok: las actualizaciones sobre B no afectan a ninguna fila (comprobado abajo)';
end $$;

do $$
begin
  insert into public.contactos (empresa_id, nombre, telefono)
  values (current_setting('t.eb')::uuid, 'Intruso', '+34600000002');
  raise exception 'FALLO: A creó un contacto en B';
exception when insufficient_privilege then
  raise notice 'ok: A no crea contactos en B';
end $$;

do $$
begin
  insert into public.auditoria (usuario, empresa_id, accion, entidad)
  values (current_setting('t.ua')::uuid, current_setting('t.eb')::uuid, 'x', 'x');
  raise exception 'FALLO: A escribió en la auditoría de B';
exception when insufficient_privilege then
  raise notice 'ok: A no escribe en la auditoría de B';
end $$;

do $$
begin
  perform public.crear_llamada(current_setting('t.cb')::uuid, null, current_setting('t.ua')::uuid);
  raise exception 'FALLO: A lanzó una llamada a un contacto de B';
exception when insufficient_privilege then
  raise notice 'ok: A no llama a contactos de B';
end $$;

do $$
begin
  perform public.crear_lote(current_setting('t.eb')::uuid, array[current_setting('t.cb')::uuid], 'x',
                            current_setting('t.ua')::uuid);
  raise exception 'FALLO: A creó un lote en B';
exception when insufficient_privilege then
  raise notice 'ok: A no crea lotes en B';
end $$;

do $$
declare
  v_lote uuid;
begin
  v_lote := public.crear_lote(current_setting('t.ea')::uuid,
                              array[current_setting('t.ca')::uuid, current_setting('t.cb')::uuid],
                              'mixto', current_setting('t.ua')::uuid);
  if (select count(*) from public.lote_items where lote_id = v_lote) <> 1
     or not exists (select 1 from public.lote_items
                     where lote_id = v_lote and contacto_id = current_setting('t.ca')::uuid) then
    raise exception 'FALLO: un lote de A incluyó contactos de B';
  end if;
  raise notice 'ok: los lotes de A ignoran contactos de B';
end $$;

do $$
begin
  perform public.marcar_no_llamar(current_setting('t.cb')::uuid);
  raise exception 'FALLO: A marcó no_llamar a un contacto de B';
exception when insufficient_privilege then
  raise notice 'ok: A no marca no_llamar en B';
end $$;

do $$
begin
  perform public.borrar_contacto_rgpd(current_setting('t.cb')::uuid);
  raise exception 'FALLO: A borró un contacto de B';
exception when insufficient_privilege then
  raise notice 'ok: A no borra contactos de B';
end $$;

do $$
begin
  insert into public.miembros (empresa_id, usuario_id) values (current_setting('t.eb')::uuid, current_setting('t.ua')::uuid);
  raise exception 'FALLO: A se añadió como miembro de B';
exception when insufficient_privilege then
  raise notice 'ok: A no puede hacerse miembro de B';
end $$;

-- Comprobación final como postgres -------------------------------------------

reset role;

do $$
begin
  if (select nombre from public.contactos where id = current_setting('t.cb')::uuid) <> 'Contacto B'
     or (select estado from public.contactos where id = current_setting('t.cb')::uuid) <> 'pendiente'
     or (select pausa_global from public.configuracion where empresa_id = current_setting('t.eb')::uuid) then
    raise exception 'FALLO: A modificó datos de B';
  end if;
  raise notice 'ok: los datos de B siguen intactos';
  raise notice 'AISLAMIENTO OK';
end $$;
