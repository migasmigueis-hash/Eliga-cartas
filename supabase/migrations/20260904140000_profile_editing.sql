create or replace function public.update_own_profile(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_username text := lower(trim(p_username));
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;
  if clean_username !~ '^[a-z0-9_]{3,16}$' then
    raise exception 'Nome de utilizador inválido.';
  end if;

  update public.profiles
  set username = clean_username, updated_at = now()
  where id = auth.uid();

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  update public.leaderboard
  set username = clean_username, updated_at = now()
  where user_id = auth.uid();
end;
$$;

revoke all on function public.update_own_profile(text) from public;
grant execute on function public.update_own_profile(text) to authenticated;