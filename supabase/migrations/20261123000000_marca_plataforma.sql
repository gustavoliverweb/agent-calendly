-- Marca de la plataforma editable desde /admin → Marca: nombre, descripción,
-- email de contacto, logo y favicon de la web pública, del acceso y de /admin.
-- Null = el valor por defecto del código (lib/marca.ts). Las imágenes van al
-- bucket público "marca" bajo plataforma/.

alter table public.ajustes_plataforma
  add column marca_nombre      text check (marca_nombre is null or length(trim(marca_nombre)) between 1 and 60),
  add column marca_descripcion text check (marca_descripcion is null or length(trim(marca_descripcion)) between 1 and 300),
  add column marca_email       text check (marca_email is null or (length(marca_email) <= 254 and marca_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column marca_logo        text check (marca_logo is null or marca_logo ~ '^plataforma/[A-Za-z0-9._-]+$'),
  add column marca_favicon     text check (marca_favicon is null or marca_favicon ~ '^plataforma/[A-Za-z0-9._-]+$');
