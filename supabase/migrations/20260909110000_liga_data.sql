create table if not exists public.liga_data (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.liga_data enable row level security;

drop policy if exists "liga_data_leitura_publica" on public.liga_data;
create policy "liga_data_leitura_publica"
  on public.liga_data for select
  using (true);

insert into public.liga_data (key, data) values (
  'config',
  '{
    "modo": "simulacao",
    "etapa": 1,
    "fase": "grupos",
    "jornada": 1
  }'::jsonb
) on conflict (key) do nothing;