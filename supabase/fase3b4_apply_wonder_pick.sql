-- ============================================================
-- eLiga Cartas — Fase 3b.4 (fix): debita Escolhas e marca o
-- tabuleiro como usado de forma ATÓMICA (UPDATE ... WHERE ...
-- RETURNING numa única instrução), para impedir que vários
-- pedidos de "wonder-pick" feitos quase ao mesmo tempo leiam o
-- mesmo saldo de Escolhas e gastem mais do que o jogador tem.
--
-- Corre isto no Supabase SQL Editor. É seguro voltar a correr.
-- A Edge Function wonder-pick passa a chamar esta função antes
-- de aplicar a carta/coleção/histórico.
-- ============================================================

create or replace function public.apply_wonder_pick(p_key text, p_cost int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  new_state jsonb;
begin
  if p_key is null or p_cost is null or p_cost <= 0 or length(p_key) > 20 then
    raise exception 'Pedido inválido.';
  end if;

  update public.profiles p
  set state = jsonb_set(
        (p.state || jsonb_build_object('picksUsed', coalesce(p.state->'picksUsed', '{}'::jsonb)))
          || jsonb_build_object('escolhas', to_jsonb(coalesce((p.state->>'escolhas')::int, 0) - p_cost)),
        array['picksUsed', p_key],
        'true'::jsonb
      ),
      updated_at = now()
  where p.id = auth.uid()
    and coalesce((p.state->>'escolhas')::int, 0) >= p_cost
    and coalesce((p.state->'picksUsed'->p_key)::boolean, false) = false
  returning p.state into new_state;

  if new_state is null then
    raise exception 'WONDER_PICK_REJEITADO: Escolhas insuficientes ou esta Escolha já foi usada.';
  end if;

  return new_state;
end;
$$;

grant execute on function public.apply_wonder_pick(text, int) to authenticated;

NOTIFY pgrst, 'reload schema';
