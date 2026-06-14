-- ============================================================
-- eLiga Cartas — Fase 4: ranking real e partilhado.
--
-- Cria uma tabela "leaderboard" visível por todos os jogadores
-- (RLS: leitura aberta, escrita só via função register_jornada),
-- com os "bots" de preenchimento já semeados, e uma função que
-- regista os pontos de uma jornada de forma atómica no servidor.
--
-- Corre este script todo de uma vez no Supabase: Dashboard →
-- SQL Editor → New query → cola tudo → Run.
-- É seguro voltar a correr.
-- ============================================================

-- 1) Tabela do ranking ---------------------------------------------
create table if not exists public.leaderboard (
  username text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  score int not null default 0,
  jornadas int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_score_idx on public.leaderboard (score desc);

alter table public.leaderboard enable row level security;

-- toda a gente (autenticada) pode ver o ranking
drop policy if exists "leaderboard_select_all" on public.leaderboard;
create policy "leaderboard_select_all" on public.leaderboard
  for select using (true);

-- (sem políticas de insert/update: só a função register_jornada,
--  que corre com privilégios elevados, pode escrever aqui)

-- 2) "Bots" de preenchimento, para o ranking não ficar vazio --------
insert into public.leaderboard (username, score, jornadas)
values
  ('dragao_99', 0, 0),
  ('verde_e_branco', 0, 0),
  ('aguia_voadora', 0, 0),
  ('ilha_esports', 0, 0),
  ('minhoto_10', 0, 0),
  ('tricolor_w7m', 0, 0),
  ('arsenalista', 0, 0),
  ('gamer_do_norte', 0, 0),
  ('casapiano', 0, 0),
  ('alverca_goat', 0, 0)
on conflict (username) do nothing;

-- 3) Função: regista os pontos da jornada do utilizador autenticado,
--    avança alguns "bots" aleatoriamente, e devolve o ranking atualizado.
create or replace function public.register_jornada(p_points int)
returns table(username text, score int, jornadas int)
language plpgsql
security definer set search_path = public
as $$
declare
  uname text;
  bot record;
begin
  if p_points is null or p_points < 0 or p_points > 1000 then
    raise exception 'Pontuação inválida.';
  end if;

  select p.username into uname from public.profiles p where p.id = auth.uid();
  if uname is null then
    raise exception 'Perfil não encontrado para este utilizador.';
  end if;

  insert into public.leaderboard (username, user_id, score, jornadas)
  values (uname, auth.uid(), p_points, 1)
  on conflict (username) do update
    set score = leaderboard.score + p_points,
        jornadas = leaderboard.jornadas + 1,
        user_id = auth.uid(),
        updated_at = now();

  -- os "bots" (sem user_id) também avançam, com alguma aleatoriedade,
  -- para o ranking continuar vivo sem crescer demasiado depressa
  for bot in select l.username from public.leaderboard l where l.user_id is null loop
    if random() < 0.35 then
      update public.leaderboard
        set score = score + (60 + floor(random() * 131))::int,
            jornadas = jornadas + 1,
            updated_at = now()
        where username = bot.username;
    end if;
  end loop;

  return query select l.username, l.score, l.jornadas from public.leaderboard l order by l.score desc;
end;
$$;

grant execute on function public.register_jornada(int) to authenticated;
