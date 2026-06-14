-- ============================================================
-- eLiga Cartas — correção da Fase 4: "column reference username
-- is ambiguous" em register_jornada.
--
-- Corre isto no Supabase SQL Editor (substitui a função anterior).
-- ============================================================

create or replace function public.register_jornada(p_points int)
returns table(username text, score int, jornadas int)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
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

  -- os "bots" (sem user_id) também avançam, com alguma aleatoriedade
  for bot in select l.username from public.leaderboard l where l.user_id is null loop
    if random() < 0.35 then
      update public.leaderboard as lb
        set score = lb.score + (60 + floor(random() * 131))::int,
            jornadas = lb.jornadas + 1,
            updated_at = now()
        where lb.username = bot.username;
    end if;
  end loop;

  return query select l.username, l.score, l.jornadas from public.leaderboard l order by l.score desc;
end;
$$;

grant execute on function public.register_jornada(int) to authenticated;

-- NOTIFY para garantir que a API vê a função atualizada de imediato
NOTIFY pgrst, 'reload schema';
