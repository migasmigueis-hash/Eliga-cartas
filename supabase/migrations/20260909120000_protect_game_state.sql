create or replace function public.protect_game_state()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  proposed_state jsonb := coalesce(new.state, '{}'::jsonb);
  preference_key text;
  previous_seen bigint;
  requested_seen bigint;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if jsonb_typeof(proposed_state) <> 'object' or octet_length(proposed_state::text) > 20000 then
    raise exception 'Estado de preferências inválido.';
  end if;

  new.state := coalesce(old.state, '{}'::jsonb);
  foreach preference_key in array array['lineup', 'vitrine', 'muted', 'onboardDone'] loop
    if proposed_state ? preference_key then
      new.state := jsonb_set(new.state, array[preference_key], proposed_state->preference_key, true);
    end if;
  end loop;
  if proposed_state ? 'lastSeenCompetitionResult' then
    if jsonb_typeof(proposed_state->'lastSeenCompetitionResult') <> 'number'
      or (proposed_state->>'lastSeenCompetitionResult') !~ '^\d+$' then
      raise exception 'Marcador de resultado inválido.';
    end if;
    previous_seen := case when coalesce(old.state->>'lastSeenCompetitionResult', '') ~ '^\d+$' then (old.state->>'lastSeenCompetitionResult')::bigint else 0 end;
    requested_seen := (proposed_state->>'lastSeenCompetitionResult')::bigint;
    new.state := jsonb_set(new.state, '{lastSeenCompetitionResult}', to_jsonb(greatest(previous_seen, requested_seen)), true);
  end if;
  return new;
end;
$$;

drop trigger if exists protect_game_state_trigger on public.profiles;
create trigger protect_game_state_trigger
  before update of state on public.profiles
  for each row execute function public.protect_game_state();

-- Perfis são criados exclusivamente pelo trigger de auth; impedir que um
-- cliente recrie uma linha em falta já com progressão inventada.
drop policy if exists "profiles_insert_own" on public.profiles;

create or replace function public.sync_player_state(p_preferences jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state jsonb;
  next_state jsonb;
  meta jsonb;
  days jsonb;
  today text := to_char(timezone('Europe/Lisbon', now()), 'YYYY-MM-DD');
  current_slot bigint := floor(extract(epoch from now()) * 1000 / 21600000)::bigint;
  previous_slot bigint;
  current_choices int;
  gained int;
  preference_key text;
  previous_seen bigint;
  requested_seen bigint;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object' then
    raise exception 'Preferências inválidas.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_preferences) as preference(key)
    where key not in ('lineup', 'vitrine', 'muted', 'onboardDone', 'lastSeenCompetitionResult')
  ) or octet_length(p_preferences::text) > 10000 then
    raise exception 'Preferências inválidas.';
  end if;

  select coalesce(state, '{}'::jsonb)
  into current_state
  from public.profiles
  where id = auth.uid()
  for update;
  if current_state is null then
    raise exception 'Perfil não encontrado.';
  end if;

  next_state := current_state;
  foreach preference_key in array array['lineup', 'vitrine', 'muted', 'onboardDone'] loop
    if p_preferences ? preference_key then
      next_state := jsonb_set(next_state, array[preference_key], p_preferences->preference_key, true);
    end if;
  end loop;
  if p_preferences ? 'lastSeenCompetitionResult' then
    if jsonb_typeof(p_preferences->'lastSeenCompetitionResult') <> 'number'
      or (p_preferences->>'lastSeenCompetitionResult') !~ '^\d+$' then
      raise exception 'Marcador de resultado inválido.';
    end if;
    previous_seen := case when coalesce(next_state->>'lastSeenCompetitionResult', '') ~ '^\d+$' then (next_state->>'lastSeenCompetitionResult')::bigint else 0 end;
    requested_seen := (p_preferences->>'lastSeenCompetitionResult')::bigint;
    next_state := jsonb_set(next_state, '{lastSeenCompetitionResult}', to_jsonb(greatest(previous_seen, requested_seen)), true);
  end if;

  meta := coalesce(next_state->'meta', '{}'::jsonb);
  days := case when jsonb_typeof(meta->'dias') = 'array' then meta->'dias' else '[]'::jsonb end;
  if not days ? today then
    days := days || to_jsonb(today);
    if jsonb_array_length(days) > 90 then
      select jsonb_agg(value order by ordinality)
      into days
      from jsonb_array_elements(days) with ordinality
      where ordinality > jsonb_array_length(days) - 90;
    end if;
  end if;
  meta := jsonb_set(meta, '{dias}', days, true);

  current_choices := case
    when coalesce(next_state->>'escolhas', '') ~ '^\d+$' then least(10, (next_state->>'escolhas')::int)
    else 5
  end;
  previous_slot := case
    when coalesce(next_state->>'escSlot', '') ~ '^\d+$' then (next_state->>'escSlot')::bigint
    else current_slot
  end;
  gained := least(greatest(current_slot - previous_slot, 0)::int, greatest(10 - current_choices, 0));

  next_state := next_state
    || jsonb_build_object(
      'meta', meta,
      'escolhas', current_choices + gained,
      'escSlot', current_slot
    );

  update public.profiles
  set state = next_state, updated_at = now()
  where id = auth.uid();

  return next_state;
end;
$$;

revoke all on function public.sync_player_state(jsonb) from public;
grant execute on function public.sync_player_state(jsonb) to authenticated;

create or replace function public.refund_twitch_points(p_user_id uuid, p_amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_points int;
begin
  if auth.role() <> 'service_role' or p_user_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'Pedido inválido.';
  end if;
  update public.profiles
  set twitch_points = twitch_points + p_amount, updated_at = now()
  where id = p_user_id
  returning twitch_points into new_points;
  return new_points;
end;
$$;

revoke all on function public.refund_twitch_points(uuid, int) from public;
grant execute on function public.refund_twitch_points(uuid, int) to service_role;

create or replace function public.rollback_wonder_pick(p_user_id uuid, p_key text, p_cost int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' or p_user_id is null or p_key is null or p_cost is null or p_cost <= 0 then
    raise exception 'Pedido inválido.';
  end if;
  update public.profiles
  set state = jsonb_set(
        jsonb_set(
          state,
          '{escolhas}',
          to_jsonb(least(10, coalesce((state->>'escolhas')::int, 0) + p_cost)),
          true
        ),
        array['picksUsed', p_key],
        'false'::jsonb,
        true
      ),
      updated_at = now()
  where id = p_user_id
    and coalesce((state->'picksUsed'->p_key)::boolean, false) = true;
end;
$$;

revoke all on function public.rollback_wonder_pick(uuid, text, int) from public;
grant execute on function public.rollback_wonder_pick(uuid, text, int) to service_role;

notify pgrst, 'reload schema';