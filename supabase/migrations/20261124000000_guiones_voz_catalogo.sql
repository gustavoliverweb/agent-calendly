-- La voz de un guion nuevo tiene que estar permitida también en la BD, no
-- solo en la acción del panel (lib/voces.ts → vozPermitida): un propietario
-- puede insertar en guiones directamente con la API de Supabase y su sesión,
-- y elegir así cualquier voz de la cuenta de ElevenLabs del proveedor.
--
-- Permitida: null (la del agente), una voz activa del catálogo o la del guion
-- que la empresa ya tiene activo. Solo se exige a los usuarios con sesión; el
-- servidor (service role) no pasa por aquí.

create function public.comprobar_voz_guion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.voz_id is null or coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;
  if exists (select 1 from public.voces v where v.voice_id = new.voz_id and v.activa) then
    return new;
  end if;
  if exists (
    select 1
    from public.empresas e
    join public.guiones g on g.id = e.guion_activo_id
    where e.id = new.empresa_id and g.voz_id = new.voz_id
  ) then
    return new;
  end if;
  raise exception 'Voz no disponible' using errcode = 'check_violation';
end;
$$;

revoke all on function public.comprobar_voz_guion() from public, anon, authenticated;

create trigger guiones_voz_catalogo
  before insert on public.guiones
  for each row execute function public.comprobar_voz_guion();
