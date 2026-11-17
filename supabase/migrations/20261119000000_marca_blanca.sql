-- SaaS S6b: marca blanca (docs/plan-saas.md §4.3).
--
-- - Cada empresa entra al panel por su dominio (p. ej. llamadas.empresa-a.com,
--   un CNAME hacia Render que da de alta el proveedor) o, si la plataforma tiene
--   dominio base, por <slug>.<dominio base>. La empresa se deduce del dominio.
-- - Marca por empresa: nombre visible, color, logo y favicon (en Storage) y
--   los datos legales de sus páginas de aviso legal y privacidad.
--
-- Las escrituras van siempre por el servidor (service role) tras comprobar el
-- rol: los miembros solo leen.

-- -----------------------------------------------------------------------------
-- Marca y datos legales de la empresa
-- -----------------------------------------------------------------------------

alter table public.empresas
  add column marca_nombre    text check (marca_nombre is null or length(marca_nombre) between 1 and 60),
  add column marca_color     text check (marca_color is null or marca_color ~ '^#[0-9a-f]{6}$'),
  add column marca_logo      text check (marca_logo is null or length(marca_logo) <= 300),
  add column marca_favicon   text check (marca_favicon is null or length(marca_favicon) <= 300),
  add column legal_razon_social text check (legal_razon_social is null or length(legal_razon_social) <= 200),
  add column legal_nif       text check (legal_nif is null or length(legal_nif) <= 20),
  add column legal_domicilio text check (legal_domicilio is null or length(legal_domicilio) <= 300),
  add column legal_registro  text check (legal_registro is null or length(legal_registro) <= 300),
  add column legal_email     text check (legal_email is null or (length(legal_email) <= 200 and legal_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

comment on column public.empresas.marca_nombre is 'Nombre que ven sus usuarios (login, panel, páginas legales); null: el nombre de la empresa';
comment on column public.empresas.marca_color is 'Color principal en hexadecimal (#rrggbb)';
comment on column public.empresas.marca_logo is 'Ruta del logo en el bucket público "marca"';
comment on column public.empresas.marca_favicon is 'Ruta del favicon en el bucket público "marca"';

-- -----------------------------------------------------------------------------
-- Dominios propios
-- -----------------------------------------------------------------------------

create table public.dominios_empresa (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  -- En minúsculas, sin puerto ni punto final.
  dominio       text not null unique check (
    length(dominio) <= 253
    and dominio ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  ),
  -- pendiente: falta el DNS o el certificado; verificado: Render lo sirve con HTTPS.
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'verificado', 'error')),
  render_id     text,
  detalle       text check (detalle is null or length(detalle) <= 500),
  comprobado_en timestamptz,
  creado_en     timestamptz not null default now()
);

create index dominios_empresa_empresa_idx on public.dominios_empresa (empresa_id);

comment on table public.dominios_empresa is 'Dominios propios de cada empresa (marca blanca); los da de alta el proveedor';

alter table public.dominios_empresa enable row level security;

create policy "miembros leen los dominios de su empresa" on public.dominios_empresa
  for select to authenticated
  using (public.es_miembro(empresa_id));

revoke all on public.dominios_empresa from anon;
revoke insert, update, delete on public.dominios_empresa from authenticated;

-- -----------------------------------------------------------------------------
-- Imágenes de marca (lectura pública: se ven en el login, antes de entrar)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca', 'marca', true, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
