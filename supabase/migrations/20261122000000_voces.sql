-- Catálogo de voces que el proveedor ofrece a las empresas (/admin/voces).
-- Cada empresa elige una en su guion (guiones.voz_id); null = la voz
-- configurada en el agente de ElevenLabs.

create table public.voces (
  id             uuid primary key default gen_random_uuid(),
  -- voice_id de ElevenLabs.
  voice_id       text not null unique check (voice_id ~ '^[A-Za-z0-9]{1,64}$'),
  nombre         text not null check (length(trim(nombre)) between 1 and 60),
  descripcion    text not null default '' check (length(descripcion) <= 200),
  -- Muestra de audio que da ElevenLabs; la app la sirve a través de su servidor.
  muestra_url    text check (muestra_url is null or (muestra_url ~ '^https://' and length(muestra_url) <= 1000)),
  -- Desactivada: no se ofrece para guiones nuevos; los que ya la usan siguen igual.
  activa         boolean not null default true,
  orden          int not null default 0,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.voces is 'Catálogo de voces que se pueden elegir en el guion; lo gestiona el proveedor';

create trigger voces_actualizado_en
  before update on public.voces
  for each row execute function public.set_actualizado_en();

alter table public.voces enable row level security;

-- Cualquier usuario con sesión ve las voces ofrecidas (selector del guion).
-- Altas y cambios solo desde el servidor (service role, /admin).
create policy "usuarios ven voces activas" on public.voces
  for select to authenticated using (activa);

revoke insert, update, delete on public.voces from anon, authenticated;
