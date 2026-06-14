-- ============================================================
-- eLiga Cartas — Fase 4 (extra): botão de admin que reinicia o
-- ranking partilhado E o histórico "As tuas jornadas" de TODOS
-- os jogadores.
--
-- Corre isto no Supabase SQL Editor.
-- Requer a Fase 3a (coluna profiles.is_admin) já aplicada.
-- Substitui/remove a função reset_leaderboard (se a tiveres criado).
-- ============================================================

drop function if exists public.reset_leaderboard();

create or replace function public.admin_reset_competicao()
returns void
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Apenas administradores podem reiniciar a competição.';
  end if;

  -- reinicia o ranking partilhado (jogadores reais + bots)
  update public.leaderboard set score = 0, jornadas = 0, updated_at = now() where true;

  -- limpa "As tuas jornadas" (jHist) de todos os jogadores, sem tocar no resto do progresso
  update public.profiles
    set state = jsonb_set(coalesce(state, '{}'::jsonb), '{jHist}', '[]'::jsonb),
        updated_at = now()
    where true;
end;
$$;

grant execute on function public.admin_reset_competicao() to authenticated;

NOTIFY pgrst, 'reload schema';
