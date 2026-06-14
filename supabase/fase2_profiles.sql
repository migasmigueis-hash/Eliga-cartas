-- ============================================================
-- eLiga Cartas — Fase 2: tabela "profiles" com o progresso do
-- jogo (jsonb), RLS por utilizador, criação automática de perfil
-- no registo, e backfill para contas já existentes (Fase 1).
--
-- Corre este script todo de uma vez no Supabase: Dashboard →
-- SQL Editor → New query → cola tudo → Run.
-- É seguro voltar a correr (usa IF NOT EXISTS / OR REPLACE / etc.)
-- ============================================================

-- 1) Tabela principal -----------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Row Level Security: cada utilizador só vê/edita a sua linha
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- 3) Criar perfil automaticamente quando uma conta é registada --
-- usa o "nome de jogador" guardado em user_metadata.username;
-- se já estiver ocupado, acrescenta 1, 2, 3... até encontrar livre.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := coalesce(new.raw_user_meta_data->>'username', 'jogador');
  final_username := base_username;
  loop
    begin
      insert into public.profiles (id, username) values (new.id, final_username);
      exit;
    exception when unique_violation then
      suffix := suffix + 1;
      final_username := base_username || suffix::text;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Backfill: cria perfis para contas criadas na Fase 1
--    (ex.: test, test1, admin) que ainda não têm linha em profiles.
insert into public.profiles (id, username)
select u.id, coalesce(u.raw_user_meta_data->>'username', 'jogador_' || substr(u.id::text, 1, 8))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (username) do nothing;
