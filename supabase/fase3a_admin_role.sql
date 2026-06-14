-- ============================================================
-- eLiga Cartas — Fase 3a: admin deixa de depender do nome de
-- jogador ("admin") e passa a ser um campo na conta (is_admin).
--
-- Corre este script todo de uma vez no Supabase: Dashboard →
-- SQL Editor → New query → cola tudo → Run.
-- É seguro voltar a correr.
-- ============================================================

-- 1) Nova coluna -------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2) Protege is_admin: um utilizador normal não se pode dar a si
--    próprio acesso de admin através de um pedido direto ao Supabase
--    (ex.: a partir da consola do browser). Só o service_role
--    (usado por nós, fora da app) pode alterar este campo.
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_is_admin_trigger on public.profiles;
create trigger protect_is_admin_trigger
  before update on public.profiles
  for each row execute function public.protect_is_admin();

-- 3) Torna a tua conta administradora -----------------------------
-- Substitui 'admin' pelo nome de jogador que usaste para a conta
-- de admin (o que escreveste no campo "Nome de jogador" ao registar).
update public.profiles set is_admin = true where username = 'admin';

-- Confirma que funcionou:
select username, is_admin from public.profiles;
