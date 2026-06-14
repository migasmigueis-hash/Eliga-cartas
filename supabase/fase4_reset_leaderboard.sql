-- ============================================================
-- eLiga Cartas — Fase 4 (extra): permitir a um admin reiniciar
-- o ranking partilhado (leaderboard) a partir da app.
--
-- Corre isto no Supabase SQL Editor.
-- Requer a Fase 3a (coluna profiles.is_admin) já aplicada.
-- ============================================================

create or replace function public.reset_leaderboard()
returns void
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Apenas administradores podem reiniciar o ranking.';
  end if;

  update public.leaderboard set score = 0, jornadas = 0, updated_at = now();
end;
$$;

grant execute on function public.reset_leaderboard() to authenticated;

NOTIFY pgrst, 'reload schema';
