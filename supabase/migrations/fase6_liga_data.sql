-- fase6_liga_data.sql
-- Tabela que guarda todos os dados da competição real (grupos, jornadas,
-- resultados das eliminatórias, config do modo de jogo).
-- As Edge Functions escrevem via service_role; o cliente lê via anon.

create table if not exists liga_data (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table liga_data enable row level security;

-- qualquer utilizador autenticado (ou anónimo) pode ler
create policy "liga_data_leitura_publica"
  on liga_data for select
  using (true);

-- escrita apenas via service_role (Edge Functions admin)
-- (não é necessária uma policy de escrita — service_role bypassa RLS)

-- config inicial: modo simulação, Etapa 1, fase de grupos, Jornada 1
insert into liga_data (key, data) values (
  'config',
  '{
    "modo": "simulacao",
    "etapa": 1,
    "fase": "grupos",
    "jornada": 1
  }'::jsonb
) on conflict (key) do nothing;

-- comentário para referência: estrutura esperada de cada key
-- 
-- "etapa1_grupos"  → { "A": ["santaclara","afs",...], "B": [...], "C": [...] }
-- "etapa1_jornada1" → [{ teamA, playerA, golosA, teamB, playerB, golosB }, ...]
-- "etapa1_jornada2" → (idem)
-- "etapa1_knockout" → { qf: [...], sf: [...], final: {...} }
-- "etapa1_grupos_resultado" → { realQual: [...], bracket: [...] }
-- (repetir para etapa2, etapa3, finals)
