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
