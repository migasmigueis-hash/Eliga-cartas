-- ============================================================
-- fase6_remove_jornada_limit.sql
-- Remove o limite de 10 jornadas do register_jornada (era só para a
-- fase de testes em modo simulação). Corre no Supabase SQL Editor.
-- ============================================================

create or replace function public.register_jornada(p_points int)
returns table(username text, score int, jornadas int)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  uname text;
begin
  if p_points is null or p_points < 0 or p_points > 1000 then
    raise exception 'Pontuação inválida.';
  end if;

  select p.username into uname from public.profiles p where p.id = auth.uid();
  if uname is null then
    raise exception 'Perfil não encontrado para este utilizador.';
  end if;

  -- (LIMITE DE 10 JORNADAS REMOVIDO)

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
