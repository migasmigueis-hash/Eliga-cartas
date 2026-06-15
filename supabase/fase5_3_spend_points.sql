-- ============================================================
-- eLiga Cartas — Fase 5.3: gastar pontos Twitch a abrir packs.
--
-- Corre isto no Supabase SQL Editor. É seguro voltar a correr.
-- ============================================================

-- A trigger protect_twitch_fields (Fase 5.1) impede qualquer alteração a
-- twitch_points fora do service_role — o que bloquearia também a nossa
-- própria função debit_twitch_points (chamada pelo jogador, role
-- "authenticated"). Atualizamos a trigger para abrir uma excepção quando a
-- variável de sessão app.bypass_twitch_guard estiver ativa — só
-- debit_twitch_points a liga, e só dentro da sua própria transação.
create or replace function public.protect_twitch_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' and coalesce(current_setting('app.bypass_twitch_guard', true), 'false') <> 'true' then
    if new.twitch_user_id is distinct from old.twitch_user_id then new.twitch_user_id := old.twitch_user_id; end if;
    if new.twitch_login is distinct from old.twitch_login then new.twitch_login := old.twitch_login; end if;
    if new.twitch_points is distinct from old.twitch_points then new.twitch_points := old.twitch_points; end if;
  end if;
  return new;
end;
$$;

-- debita pontos Twitch do próprio utilizador, de forma atómica
-- (UPDATE ... WHERE ... RETURNING numa única instrução — impede gastar mais
-- do que o saldo, mesmo com vários pedidos quase simultâneos).
create or replace function public.debit_twitch_points(p_amount int)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  new_points int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Pedido inválido.';
  end if;

  perform set_config('app.bypass_twitch_guard', 'true', true);

  update public.profiles
  set twitch_points = twitch_points - p_amount, updated_at = now()
  where id = auth.uid()
    and twitch_points >= p_amount
  returning twitch_points into new_points;

  if new_points is null then
    raise exception 'PONTOS_INSUFICIENTES: não tens pontos Twitch suficientes para abrir este pack.';
  end if;

  return new_points;
end;
$$;

grant execute on function public.debit_twitch_points(int) to authenticated;

NOTIFY pgrst, 'reload schema';
