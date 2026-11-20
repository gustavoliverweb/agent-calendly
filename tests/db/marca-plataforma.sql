-- Marca de la plataforma (/admin → Marca): validaciones de las columnas y
-- que nadie la cambie con su sesión. Dentro de la transacción de pnpm db:test.

\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;

update public.ajustes_plataforma
   set marca_nombre = 'Nombre de prueba', marca_email = 'hola@ejemplo.es', marca_logo = 'plataforma/logo-1.png'
 where id;

do $$
begin
  begin
    update public.ajustes_plataforma set marca_email = 'no-es-un-email' where id;
    raise exception 'FALLO: email de la marca sin validar';
  exception when check_violation then null;
  end;
  begin
    update public.ajustes_plataforma set marca_logo = '../otra-empresa/logo.png' where id;
    raise exception 'FALLO: ruta del logo fuera de plataforma/';
  exception when check_violation then null;
  end;
  begin
    update public.ajustes_plataforma set marca_nombre = '   ' where id;
    raise exception 'FALLO: nombre vacío aceptado';
  exception when check_violation then null;
  end;
  raise notice 'ok: columnas de la marca de la plataforma validadas';
end $$;

select set_config('t.mu', gen_random_uuid()::text, true);
insert into auth.users (id, email, aud, role)
values (current_setting('t.mu')::uuid, 'm@marca.test', 'authenticated', 'authenticated');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.mu'), 'role', 'authenticated')::text, true);

do $$
declare
  filas int;
begin
  begin
    update public.ajustes_plataforma set marca_nombre = 'Intrusa' where id;
    get diagnostics filas = row_count;
    if filas > 0 then
      raise exception 'FALLO: un usuario cambió la marca de la plataforma';
    end if;
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: la marca de la plataforma solo la cambia el servidor';
end $$;

reset role;
