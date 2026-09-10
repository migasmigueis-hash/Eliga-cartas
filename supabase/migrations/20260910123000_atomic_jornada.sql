create or replace function public.commit_jornada(
  p_user_id uuid,
  p_expected_state jsonb,
  p_jhist jsonb,
  p_points int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state jsonb;
  uname text;
  leaderboard_rows jsonb;
begin
  if auth.role() <> 'service_role'
    or p_user_id is null
    or p_expected_state is null
    or jsonb_typeof(p_expected_state) <> 'object'
    or p_jhist is null
    or jsonb_typeof(p_jhist) <> 'array'
    or jsonb_array_length(p_jhist) > 50
    or p_points is null
    or p_points < 0
    or p_points > 1000 then
    raise exception 'Pedido de jornada inválido.';
  end if;

  select coalesce(state, '{}'::jsonb), username
  into current_state, uname
  from public.profiles
  where id = p_user_id
  for update;

  if current_state is null or uname is null then
    raise exception 'Perfil não encontrado.';
  end if;
  if current_state is distinct from p_expected_state then
    raise exception 'STATE_CONFLICT';
  end if;

  update public.profiles
  set state = jsonb_set(current_state, '{jHist}', p_jhist, true),
      updated_at = now()
  where id = p_user_id;

  insert into public.leaderboard (username, user_id, score, jornadas)
  values (uname, p_user_id, p_points, 1)
  on conflict (username) do update
    set score = leaderboard.score + p_points,
        jornadas = leaderboard.jornadas + 1,
        user_id = p_user_id,
        updated_at = now();

  select coalesce(
    jsonb_agg(
      jsonb_build_object('username', ranked.username, 'score', ranked.score, 'jornadas', ranked.jornadas)
      order by ranked.score desc
    ),
    '[]'::jsonb
  )
  into leaderboard_rows
  from public.leaderboard as ranked;

  return leaderboard_rows;
end;
$$;

revoke all on function public.commit_jornada(uuid, jsonb, jsonb, int) from public;
grant execute on function public.commit_jornada(uuid, jsonb, jsonb, int) to service_role;

revoke all on function public.register_jornada(int) from public;
revoke execute on function public.register_jornada(int) from authenticated;

notify pgrst, 'reload schema';