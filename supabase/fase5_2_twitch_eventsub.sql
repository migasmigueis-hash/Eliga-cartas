-- ============================================================
-- eLiga Cartas — Fase 5.2: creditar pontos Twitch a partir de
-- "Channel Points" (EventSub: channel.channel_points_custom_reward_redemption.add)
--
-- Corre isto no Supabase SQL Editor. É seguro voltar a correr.
-- ============================================================

-- guarda os "redemption ids" já processados, para ignorar reenvios
-- duplicados da Twitch (a EventSub pode reenviar a mesma notificação)
create table if not exists public.twitch_redemptions (
  redemption_id text primary key,
  twitch_user_id text not null,
  points int not null,
  created_at timestamptz not null default now()
);

alter table public.twitch_redemptions enable row level security;
-- sem policies -> ninguém via anon/authenticated; só service_role (Edge Functions)

-- credita pontos de forma atómica e ignora redemptions já processadas.
-- devolve o novo saldo de twitch_points, ou null se já tinha sido processada
-- ou se não existir nenhum perfil ligado a este twitch_user_id.
create or replace function public.credit_twitch_points(p_twitch_user_id text, p_amount int, p_redemption_id text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  new_points int;
begin
  insert into public.twitch_redemptions (redemption_id, twitch_user_id, points)
  values (p_redemption_id, p_twitch_user_id, p_amount)
  on conflict (redemption_id) do nothing;

  if not found then
    return null; -- já tinha sido processada
  end if;

  update public.profiles
  set twitch_points = twitch_points + p_amount, updated_at = now()
  where twitch_user_id = p_twitch_user_id
  returning twitch_points into new_points;

  return new_points; -- null se nenhum perfil tem este twitch_user_id ligado
end;
$$;

grant execute on function public.credit_twitch_points(text, int, text) to service_role;

NOTIFY pgrst, 'reload schema';
