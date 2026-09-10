create or replace function public.commit_admin_player_state(
  p_user_id uuid,
  p_expected_state jsonb,
  p_new_state jsonb,
  p_twitch_delta int default 0,
  p_score_delta int default 0,
  p_jornada_delta int default 0
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state jsonb;
  uname text;
begin
  if auth.role() <> 'service_role'
    or p_user_id is null
    or p_expected_state is null
    or jsonb_typeof(p_expected_state) <> 'object'
    or p_new_state is null
    or jsonb_typeof(p_new_state) <> 'object'
    or octet_length(p_new_state::text) > 500000
    or p_twitch_delta < 0
    or p_score_delta < 0
    or p_jornada_delta < 0
    or p_jornada_delta > 1 then
    raise exception 'Atualização administrativa inválida.';
  end if;

  select coalesce(state, '{}'::jsonb), username
  into current_state, uname
  from public.profiles
  where id = p_user_id
  for update;

  if current_state is null then
    raise exception 'Perfil não encontrado.';
  end if;
  if current_state is distinct from p_expected_state then
    return false;
  end if;

  update public.profiles
  set state = p_new_state,
      twitch_points = twitch_points + p_twitch_delta,
      updated_at = now()
  where id = p_user_id;

  if uname is not null and p_score_delta > 0 then
    insert into public.leaderboard (username, user_id, score, jornadas)
    values (uname, p_user_id, p_score_delta, p_jornada_delta)
    on conflict (username) do update
      set score = leaderboard.score + p_score_delta,
          jornadas = leaderboard.jornadas + p_jornada_delta,
          user_id = p_user_id,
          updated_at = now();
  end if;

  return true;
end;
$$;

revoke all on function public.commit_admin_player_state(uuid, jsonb, jsonb, int, int, int) from public;
grant execute on function public.commit_admin_player_state(uuid, jsonb, jsonb, int, int, int) to service_role;

notify pgrst, 'reload schema';
