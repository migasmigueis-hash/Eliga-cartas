-- Associate Supabase Twitch identities with the profile used by EventSub points.
create or replace function public.sync_twitch_identity_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  twitch_login_value text;
begin
  if new.provider <> 'twitch' then
    return new;
  end if;

  twitch_login_value := coalesce(
    new.identity_data->>'preferred_username',
    new.identity_data->>'user_name',
    new.identity_data->>'login',
    new.identity_data->>'name'
  );

  update public.profiles
  set twitch_user_id = new.provider_id,
      twitch_login = twitch_login_value,
      updated_at = now()
  where id = new.user_id;

  return new;
exception
  when unique_violation then
    -- Never block authentication if this Twitch account was linked manually
    -- to another profile before automatic linking was enabled.
    return new;
end;
$$;

drop trigger if exists sync_twitch_identity_to_profile_trigger on auth.identities;
create trigger sync_twitch_identity_to_profile_trigger
  after insert or update of identity_data, provider_id on auth.identities
  for each row execute function public.sync_twitch_identity_to_profile();

-- Apply the same association to users who already signed in with Twitch.
update public.profiles as profile
set twitch_user_id = identity.provider_id,
    twitch_login = coalesce(
      identity.identity_data->>'preferred_username',
      identity.identity_data->>'user_name',
      identity.identity_data->>'login',
      identity.identity_data->>'name'
    ),
    updated_at = now()
from auth.identities as identity
where identity.provider = 'twitch'
  and identity.user_id = profile.id
  and not exists (
    select 1
    from public.profiles as linked_profile
    where linked_profile.twitch_user_id = identity.provider_id
      and linked_profile.id <> profile.id
  );

revoke all on function public.sync_twitch_identity_to_profile() from public;
revoke all on function public.sync_twitch_identity_to_profile() from anon;
revoke all on function public.sync_twitch_identity_to_profile() from authenticated;