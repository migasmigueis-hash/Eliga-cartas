-- ============================================================
-- eLiga Cartas — Fase 5.1: ligar a conta Twitch (necessário para
-- a Fase 5.2, que vai creditar pontos via Channel Points / EventSub).
--
-- Corre isto no Supabase SQL Editor. É seguro voltar a correr.
-- ============================================================

alter table public.profiles
  add column if not exists twitch_user_id text unique,
  add column if not exists twitch_login text,
  add column if not exists twitch_points integer not null default 0;

-- Protege estes campos: um utilizador normal não os pode alterar
-- diretamente (ex.: pela consola do browser). Só o service_role
-- (usado pelas Edge Functions de ligação/crédito de pontos) pode.
create or replace function public.protect_twitch_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.twitch_user_id is distinct from old.twitch_user_id then new.twitch_user_id := old.twitch_user_id; end if;
    if new.twitch_login is distinct from old.twitch_login then new.twitch_login := old.twitch_login; end if;
    if new.twitch_points is distinct from old.twitch_points then new.twitch_points := old.twitch_points; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_twitch_fields_trigger on public.profiles;
create trigger protect_twitch_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_twitch_fields();

NOTIFY pgrst, 'reload schema';
