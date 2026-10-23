-- Fase 2: soporte del panel de contactos.

-- Totales por estado para los filtros del listado.
create function public.contactos_por_estado()
returns table (estado public.contacto_estado, total bigint)
language sql
stable
set search_path = ''
as $$
  select c.estado, count(*) from public.contactos c group by c.estado;
$$;

revoke all on function public.contactos_por_estado() from public, anon;
grant execute on function public.contactos_por_estado() to authenticated, service_role;

-- El panel registra sus propias acciones (importaciones, ediciones) a nombre
-- del usuario que las hace; nadie puede escribir a nombre de otro.
create policy "autenticados registran su auditoria" on public.auditoria
  for insert to authenticated with check (usuario = auth.uid());
