-- Permisos por defecto como los de producción, para un proyecto Supabase
-- NUEVO (pruebas e2e, o si algún día se recrea producción).
--
-- Los proyectos creados desde 2025 ya no dan permisos automáticos sobre las
-- tablas y funciones nuevas a anon, authenticated y service_role. Las
-- migraciones de este repo cuentan con ellos (solo quitan permisos donde hace
-- falta; la protección real es RLS), así que en un proyecto nuevo hay que
-- ejecutar esto ANTES de aplicar las migraciones (pnpm db:pruebas:preparar).
--
-- Reproduce exactamente pg_default_acl de producción (consultado el
-- 2026-11-23) para el rol postgres en el esquema public.

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;
