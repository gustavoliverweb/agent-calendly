-- SaaS S2: administración de la plataforma y equipo de cada empresa
-- (docs/plan-saas.md §4.1 Equipo y §4.2 /admin).
--
-- Empresas y miembros se crean y cambian solo con service role, desde
-- /admin (proveedor) o desde la sección Equipo (propietario de la empresa),
-- tras comprobar en el servidor quién lo pide.

-- -----------------------------------------------------------------------------
-- Administradores de la plataforma (el proveedor)
-- -----------------------------------------------------------------------------

create table public.admins_plataforma (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  creado_en  timestamptz not null default now()
);

-- Sin políticas: solo service role.
alter table public.admins_plataforma enable row level security;
revoke all on public.admins_plataforma from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Una empresa nunca se queda sin propietario
-- -----------------------------------------------------------------------------

create function public.proteger_ultimo_propietario()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.rol <> 'propietario' or (tg_op = 'UPDATE' and new.rol = 'propietario') then
    return coalesce(new, old);
  end if;
  -- Borrado en cascada de la empresa entera: no hay nada que proteger.
  if not exists (select 1 from public.empresas e where e.id = old.empresa_id) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1 from public.miembros m
     where m.empresa_id = old.empresa_id
       and m.rol = 'propietario'
       and m.usuario_id <> old.usuario_id
  ) then
    raise exception 'ultimo_propietario' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger miembros_ultimo_propietario
  before update of rol or delete on public.miembros
  for each row execute function public.proteger_ultimo_propietario();

-- -----------------------------------------------------------------------------
-- Funciones
-- -----------------------------------------------------------------------------

-- Equipo de una empresa con el email de cada miembro (auth.users no es
-- legible desde la API). "pendiente": aún no ha entrado nunca.
create function public.equipo_empresa(p_empresa_id uuid)
returns table (
  usuario_id uuid,
  email text,
  rol public.miembro_rol,
  creado_en timestamptz,
  ultimo_acceso timestamptz,
  pendiente boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.usuario_id, u.email::text, m.rol, m.creado_en, u.last_sign_in_at, u.last_sign_in_at is null
    from public.miembros m
    join auth.users u on u.id = m.usuario_id
   where m.empresa_id = p_empresa_id
     and (auth.role() = 'service_role' or public.es_miembro(p_empresa_id))
   order by m.creado_en;
$$;

revoke all on function public.equipo_empresa(uuid) from public, anon;
grant execute on function public.equipo_empresa(uuid) to authenticated, service_role;

-- Id del usuario con ese email, si existe (para invitar a alguien que ya
-- tiene cuenta en otra empresa).
create function public.usuario_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.usuario_por_email(text) from public, anon, authenticated;
grant execute on function public.usuario_por_email(text) to service_role;

-- Resumen de cada empresa para /admin: miembros, contactos y uso de los
-- últimos 30 días. Sin datos personales.
create function public.resumen_empresas()
returns table (
  id uuid,
  nombre text,
  slug text,
  estado text,
  creado_en timestamptz,
  miembros int,
  contactos int,
  llamadas_30d int,
  segundos_30d bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.nombre, e.slug, e.estado, e.creado_en,
         (select count(*)::int from public.miembros m where m.empresa_id = e.id),
         (select count(*)::int from public.contactos c where c.empresa_id = e.id),
         (select count(*)::int from public.llamadas l
           where l.empresa_id = e.id and l.creado_en >= now() - interval '30 days'),
         (select coalesce(sum(l.duracion_seg), 0)::bigint from public.llamadas l
           where l.empresa_id = e.id and l.creado_en >= now() - interval '30 days')
    from public.empresas e
   order by e.creado_en;
$$;

revoke all on function public.resumen_empresas() from public, anon, authenticated;
grant execute on function public.resumen_empresas() to service_role;
