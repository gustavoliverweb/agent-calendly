-- Baja de una empresa (/admin → Baja definitiva).
--
-- Dentro de la transacción de pnpm db:test (se deshace al final). Crea una
-- empresa con todo lo que puede tener (dos propietarios, guion activo,
-- contacto, lote, llamada con guion, cita, item de lote, Calendly, dominio,
-- auditoría) y comprueba que borrar la fila de empresas se lleva todo,
-- sin tocar otras empresas ni las cuentas de usuario.

\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;

select set_config('t.bu1', gen_random_uuid()::text, true),
       set_config('t.bu2', gen_random_uuid()::text, true);
insert into auth.users (id, email, aud, role)
values (current_setting('t.bu1')::uuid, 'p1@baja.test', 'authenticated', 'authenticated'),
       (current_setting('t.bu2')::uuid, 'p2@baja.test', 'authenticated', 'authenticated');

with e as (insert into public.empresas (nombre, slug) values ('Empresa baja', 'test-baja') returning id)
select set_config('t.be', (select id from e)::text, true);

insert into public.miembros (empresa_id, usuario_id, rol)
values (current_setting('t.be')::uuid, current_setting('t.bu1')::uuid, 'propietario'),
       (current_setting('t.be')::uuid, current_setting('t.bu2')::uuid, 'propietario');

with g as (
  insert into public.guiones (empresa_id, negocio_nombre, nombre_agente, primer_mensaje, negocio, motivo, oferta, cita, texto)
  values (current_setting('t.be')::uuid, 'Negocio', 'Laura', 'Hola, soy Laura y te llamo de parte de Negocio.', 'n', 'm', 'o', 'c', 't')
  returning id
)
update public.empresas set guion_activo_id = (select id from g) where id = current_setting('t.be')::uuid;

with c as (
  insert into public.contactos (empresa_id, nombre, telefono, consentimiento)
  values (current_setting('t.be')::uuid, 'Contacto baja', '+34600000099', true) returning id
)
select set_config('t.bc', (select id from c)::text, true);

with l as (insert into public.lotes (empresa_id, nombre) values (current_setting('t.be')::uuid, 'Lote') returning id)
select set_config('t.bl', (select id from l)::text, true);

with ll as (
  insert into public.llamadas (contacto_id, empresa_id, lote_id, conversation_id)
  values (current_setting('t.bc')::uuid, current_setting('t.be')::uuid, current_setting('t.bl')::uuid, 'conv_baja_test')
  returning id
)
select set_config('t.bll', (select id from ll)::text, true);

insert into public.citas (contacto_id, llamada_id, calendly_event_uri, calendly_invitee_uri, inicio)
values (current_setting('t.bc')::uuid, current_setting('t.bll')::uuid, 'evt-baja', 'inv-baja', now());
insert into public.lote_items (lote_id, contacto_id, empresa_id, ultima_llamada_id)
values (current_setting('t.bl')::uuid, current_setting('t.bc')::uuid, current_setting('t.be')::uuid, current_setting('t.bll')::uuid);
insert into public.integraciones_calendly (empresa_id, estado, access_token, refresh_token) values (current_setting('t.be')::uuid, 'conectada', 'x', 'y');
insert into public.dominios_empresa (empresa_id, dominio) values (current_setting('t.be')::uuid, 'agenda.baja-test.es');
insert into public.auditoria (empresa_id, accion, entidad) values (current_setting('t.be')::uuid, 'prueba', 'empresa');

select set_config('t.otras', (select count(*) from public.empresas where id <> current_setting('t.be')::uuid)::text, true);

delete from public.empresas where id = current_setting('t.be')::uuid;

do $$
declare
  e uuid := current_setting('t.be')::uuid;
  restos int;
begin
  select (select count(*) from public.miembros where empresa_id = e)
       + (select count(*) from public.guiones where empresa_id = e)
       + (select count(*) from public.contactos where empresa_id = e)
       + (select count(*) from public.lotes where empresa_id = e)
       + (select count(*) from public.llamadas where empresa_id = e)
       + (select count(*) from public.citas where empresa_id = e)
       + (select count(*) from public.lote_items where empresa_id = e)
       + (select count(*) from public.configuracion where empresa_id = e)
       + (select count(*) from public.integraciones_calendly where empresa_id = e)
       + (select count(*) from public.dominios_empresa where empresa_id = e)
       + (select count(*) from public.auditoria where empresa_id = e)
    into restos;
  if restos <> 0 then
    raise exception 'FALLO: la baja dejó % filas de la empresa', restos;
  end if;
  if (select count(*) from public.empresas) <> current_setting('t.otras')::int then
    raise exception 'FALLO: la baja tocó otras empresas';
  end if;
  if (select count(*) from auth.users where id in (current_setting('t.bu1')::uuid, current_setting('t.bu2')::uuid)) <> 2 then
    raise exception 'FALLO: la baja borró cuentas de usuario';
  end if;
  raise notice 'ok: la baja de una empresa borra todos sus datos y solo los suyos';
end $$;

-- La auditoría de la plataforma (empresa_id nulo) se puede escribir.
insert into public.auditoria (empresa_id, accion, entidad, entidad_id, detalle)
values (null, 'borrar_empresa', 'empresa', current_setting('t.be')::uuid, '{"slug":"test-baja"}');
do $$ begin raise notice 'ok: auditoría de plataforma sin empresa'; end $$;
