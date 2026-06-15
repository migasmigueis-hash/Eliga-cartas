-- ============================================================
-- eLiga Cartas — Fase 4 (ajuste): remove os "bots" de preenchimento
-- do ranking, deixando só jogadores reais, e limita a 10 o número
-- de jornadas simuladas por utilizador (fase de testes — sem
-- integração da Twitch ainda).
--
-- Corre isto no Supabase SQL Editor. É seguro voltar a correr.
-- Substitui register_jornada() da Fase 4 (fase4_leaderboard.sql /
-- fase4_fix_ambiguous.sql).
-- ============================================================

-- 1) remove os bots (linhas sem user_id associado)
delete from public.leaderboard where user_id is null;

-- 2) nova versão de register_jornada: sem avanço de bots, com limite de 10
create or replace function public.register_jornada(p_points int)
returns table(username text, score int, jornadas int)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  uname text;
  cur_jornadas int;
begin
  if p_points is null or p_points < 0 or p_points > 1000 then
    raise exception 'Pontuação inválida.';
  end if;

  select p.username into uname from public.profiles p where p.id = auth.uid();
  if uname is null then
    raise exception 'Perfil não encontrado para este utilizador.';
  end if;

  select coalesce(l.jornadas, 0) into cur_jornadas
    from public.leaderboard l where l.username = uname;

  if coalesce(cur_jornadas, 0) >= 10 then
    raise exception 'LIMITE_JORNADAS: já atingiste o limite de 10 jornadas simuladas (fase de testes).';
  end if;

  insert into public.leaderboard (username, user_id, score, jornadas)
  values (uname, auth.uid(), p_points, 1)
  on conflict (username) do update
    set score = leaderboard.score + p_points,
        jornadas = leaderboard.jornadas + 1,
        user_id = auth.uid(),
        updated_at = now();

  return query select l.username, l.score, l.jornadas from public.leaderboard l order by l.score desc;
end;
$$;

grant execute on function public.register_jornada(int) to authenticated;

NOTIFY pgrst, 'reload schema';
