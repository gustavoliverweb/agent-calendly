-- SaaS S4: Calendly por empresa con OAuth (docs/plan-saas.md §2.2).
--
-- Cada empresa autoriza su cuenta de Calendly ("Conectar con Calendly"),
-- elige el tipo de evento y la app crea un webhook hacia
-- /api/webhooks/calendly/<empresa>. Los tokens se guardan cifrados por la app
-- (AES-256-GCM con ENCRYPTION_KEY): la BD nunca los ve en claro.
--
-- El refresh token de Calendly es de un solo uso: cada renovación devuelve
-- uno nuevo e invalida el anterior. reclamar_renovacion_calendly() da un
-- turno por empresa para que dos peticiones a la vez no renueven las dos.

create table public.integraciones_calendly (
  empresa_id        uuid primary key references public.empresas (id) on delete cascade,
  -- pendiente: autorizada, falta elegir el tipo de evento.
  -- conectada: lista para consultar huecos y reservar.
  -- desconectada: la autorización dejó de valer (revocada, contraseña cambiada…); hay que reconectar.
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente', 'conectada', 'desconectada')),
  access_token      text,
  refresh_token     text,
  token_expira_en   timestamptz,
  renovando_hasta   timestamptz,
  usuario_uri       text,
  organizacion_uri  text,
  cuenta_nombre     text,
  cuenta_email      text,
  event_type_uri    text,
  event_type_nombre text,
  -- Ubicación que se envía al reservar (debe coincidir con la del tipo de evento).
  ubicacion_kind    text,
  ubicacion         text,
  webhook_uri       text,
  -- Último problema para avisar en el panel: refresh_invalido, plan_sin_api, webhook…
  ultimo_error      text,
  ultimo_error_en   timestamptz,
  conectado_por     uuid references auth.users (id) on delete set null,
  conectado_en      timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  check (estado = 'desconectada' or (access_token is not null and refresh_token is not null))
);

comment on table public.integraciones_calendly is 'Cuenta de Calendly de cada empresa (OAuth). Tokens cifrados por la app; solo service role';

-- Una cuenta de Calendly solo puede estar conectada a una empresa: si no, los
-- webhooks y las reservas de dos empresas se mezclarían.
create unique index integraciones_calendly_usuario_key
  on public.integraciones_calendly (usuario_uri)
  where estado <> 'desconectada';

create trigger integraciones_calendly_actualizado_en
  before update on public.integraciones_calendly
  for each row execute function public.set_actualizado_en();

-- Sin políticas: tokens. El panel lee el estado en el servidor tras comprobar
-- que el usuario es miembro de la empresa.
alter table public.integraciones_calendly enable row level security;
revoke all on public.integraciones_calendly from anon, authenticated;

-- Turno para renovar el token de una empresa (30 s). Devuelve true a quien lo consigue.
create function public.reclamar_renovacion_calendly(p_empresa_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with r as (
    update public.integraciones_calendly
       set renovando_hasta = now() + interval '30 seconds'
     where empresa_id = p_empresa_id
       and estado in ('pendiente', 'conectada')
       and (renovando_hasta is null or renovando_hasta < now())
    returning 1
  )
  select exists (select 1 from r);
$$;

revoke all on function public.reclamar_renovacion_calendly(uuid) from public, anon, authenticated;
grant execute on function public.reclamar_renovacion_calendly(uuid) to service_role;

-- /admin: estado de Calendly de cada empresa (sin datos de la cuenta).
drop function public.resumen_empresas();

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
  segundos_30d bigint,
  calendly text,
  guion_activo boolean
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
           where l.empresa_id = e.id and l.creado_en >= now() - interval '30 days'),
         coalesce((select i.estado from public.integraciones_calendly i where i.empresa_id = e.id), 'sin_conectar'),
         e.guion_activo_id is not null
    from public.empresas e
   order by e.creado_en;
$$;

revoke all on function public.resumen_empresas() from public, anon, authenticated;
grant execute on function public.resumen_empresas() to service_role;
