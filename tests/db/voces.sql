-- Catálogo de voces (/admin/voces): las empresas ven solo las activas y no
-- pueden tocar el catálogo. Dentro de la transacción de pnpm db:test.

\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;

insert into public.voces (voice_id, nombre, activa)
values ('vozTestActiva1', 'Activa', true), ('vozTestInactiva1', 'Inactiva', false);

select set_config('t.vu', gen_random_uuid()::text, true);
insert into auth.users (id, email, aud, role)
values (current_setting('t.vu')::uuid, 'v@voces.test', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.vu'), 'role', 'authenticated')::text, true);

do $$
begin
  if not exists (select 1 from public.voces where voice_id = 'vozTestActiva1')
     or exists (select 1 from public.voces where voice_id = 'vozTestInactiva1') then
    raise exception 'FALLO: un usuario debe ver solo las voces activas';
  end if;
  begin
    insert into public.voces (voice_id, nombre) values ('vozTestIntrusa1', 'Intrusa');
    raise exception 'FALLO: un usuario pudo añadir una voz';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.voces set nombre = 'Cambiada' where voice_id = 'vozTestActiva1';
    raise exception 'FALLO: un usuario pudo cambiar una voz';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: catálogo de voces de solo lectura y solo las activas';
end $$;

reset role;

do $$
begin
  insert into public.voces (voice_id, nombre) values ('no válida', 'X');
  raise exception 'FALLO: voice_id con caracteres no permitidos';
exception when check_violation then
  raise notice 'ok: voice_id validado';
end $$;

-- Guion con voz: un propietario solo puede guardar null, una voz activa del
-- catálogo o la de su guion activo, aunque inserte directamente con su sesión.
with e as (insert into public.empresas (nombre, slug) values ('Empresa voces', 'test-voces') returning id)
select set_config('t.ve', (select id from e)::text, true);
insert into public.miembros (empresa_id, usuario_id, rol)
values (current_setting('t.ve')::uuid, current_setting('t.vu')::uuid, 'propietario');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.vu'), 'role', 'authenticated')::text, true);

do $$
declare
  v_empresa uuid := current_setting('t.ve')::uuid;
  v_user uuid := current_setting('t.vu')::uuid;
begin
  insert into public.guiones (empresa_id, negocio_nombre, nombre_agente, primer_mensaje, negocio, motivo, oferta, cita, texto, creado_por, voz_id)
  values (v_empresa, 'N', 'L', 'Hola, soy Laura y te llamo de parte de N.', 'n', 'm', 'o', 'c', 't', v_user, null),
         (v_empresa, 'N', 'L', 'Hola, soy Laura y te llamo de parte de N.', 'n', 'm', 'o', 'c', 't', v_user, 'vozTestActiva1');
  begin
    insert into public.guiones (empresa_id, negocio_nombre, nombre_agente, primer_mensaje, negocio, motivo, oferta, cita, texto, creado_por, voz_id)
    values (v_empresa, 'N', 'L', 'Hola, soy Laura y te llamo de parte de N.', 'n', 'm', 'o', 'c', 't', v_user, 'vozFueraCatalogo1');
    raise exception 'FALLO: un propietario guardó un guion con una voz fuera del catálogo';
  exception when check_violation then null;
  end;
  begin
    insert into public.guiones (empresa_id, negocio_nombre, nombre_agente, primer_mensaje, negocio, motivo, oferta, cita, texto, creado_por, voz_id)
    values (v_empresa, 'N', 'L', 'Hola, soy Laura y te llamo de parte de N.', 'n', 'm', 'o', 'c', 't', v_user, 'vozTestInactiva1');
    raise exception 'FALLO: un propietario guardó un guion con una voz desactivada';
  exception when check_violation then null;
  end;
  raise notice 'ok: la voz de un guion nuevo tiene que estar en el catálogo';
end $$;

reset role;

-- Si la voz se desactiva, quien la tiene en su guion activo puede seguir guardando versiones con ella.
update public.voces set activa = false where voice_id = 'vozTestActiva1';
update public.empresas
set guion_activo_id = (select id from public.guiones where empresa_id = current_setting('t.ve')::uuid and voz_id = 'vozTestActiva1')
where id = current_setting('t.ve')::uuid;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.vu'), 'role', 'authenticated')::text, true);

do $$
begin
  insert into public.guiones (empresa_id, negocio_nombre, nombre_agente, primer_mensaje, negocio, motivo, oferta, cita, texto, creado_por, voz_id)
  values (current_setting('t.ve')::uuid, 'N', 'L', 'Hola, soy Laura y te llamo de parte de N.', 'n', 'm', 'o', 'c', 't',
          current_setting('t.vu')::uuid, 'vozTestActiva1');
  raise notice 'ok: la voz del guion activo se conserva aunque se desactive';
end $$;

reset role;
