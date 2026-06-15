# Fase 5.3 — Gastar pontos Twitch na Loja

Pré-requisito: 5.1 e 5.2 feitas (conta Twitch ligada, pontos a serem
creditados pelos resgates de Channel Points).

## O que esta sub-fase faz

- Cada pack passa a ter um custo em pontos Twitch:
  - **Pack Base**: 50 pontos
  - **Pack Finals 25/26**: 150 pontos
  - (Etapa 1 / Taça continuam bloqueados, sem custo definido)
- Na Loja, jogadores **sem conta Twitch ligada** veem "Liga a tua conta
  Twitch" (vai direto ao Perfil). Jogadores **com conta ligada**:
  - saldo suficiente → botão "Abrir (X pontos)";
  - saldo insuficiente → botão desativado "Pontos insuficientes (Y/X)".
- O cabeçalho da Loja mostra o saldo atual de pontos Twitch.
- `open-pack` debita os pontos **atomicamente** (mesma técnica do
  `apply_wonder_pick`) antes de sortear o pack — impossível abrir mais packs
  do que o saldo permite, mesmo com vários cliques rápidos. Se por algum
  motivo o registo do pack falhar depois do débito, os pontos são repostos.

Ficheiros novos/alterados:
```
supabase/fase5_3_spend_points.sql
supabase/functions/_shared/gameData.ts  — PACKS ganham twitchCost (50/150)
supabase/functions/open-pack/index.ts   — aceita spendTwitchPoints
src/App.jsx                             — PACKS com twitchCost; Loja mostra
                                           saldo e botões "Abrir (X pontos)"
```

## 1. SQL

SQL Editor → corre `supabase/fase5_3_spend_points.sql`.

Isto atualiza a função `protect_twitch_fields` (Fase 5.1) para permitir que
`debit_twitch_points` (nova) altere `twitch_points` do próprio utilizador —
continua a bloquear qualquer tentativa direta do cliente.

## 2. Copiar os ficheiros

- Substitui `supabase/functions/_shared/gameData.ts`.
- Substitui `supabase/functions/open-pack/index.ts`.
- Substitui `src/App.jsx`.

## 3. Deploy

```powershell
supabase functions deploy open-pack --use-api
```

## 4. Testar

```powershell
npm run dev
```
- **Loja**: se tiveres conta Twitch ligada e ≥50 pontos, vês "Abrir (50
  pontos)" no Pack Base. Clica → deve abrir normalmente (animação igual à de
  sempre) e o saldo no topo da Loja desce 50.
- Se tiveres menos de 50 → "Pontos insuficientes (X/50)" (desativado).
- Se não tiveres conta Twitch ligada → "Liga a tua conta Twitch" → vai ao
  Perfil.
- Conta admin: continua a ver "Abrir grátis (admin)", sem gastar pontos.
- (Teste rápido de segurança) Abre a consola e chama `open-pack` duas vezes
  seguidas muito rápido com `spendTwitchPoints: true` tendo só pontos para
  uma — a segunda deve falhar com "Não tens pontos Twitch suficientes...".

## 5. Ajustar custos (opcional)

Os valores (50/150) são só uma sugestão inicial. Para mudar, edita
`twitchCost` em **dois sítios** (têm de ficar iguais):
- `src/App.jsx` → array `PACKS`
- `supabase/functions/_shared/gameData.ts` → array `PACKS`

E volta a fazer deploy de `open-pack`.

## 6. Commit e push

```powershell
git add -A
git commit -m "Fase 5.3: gastar pontos Twitch na Loja"
git push
```

---

## Estado da Fase 5

Com isto, o ciclo completo está fechado: ligar conta -> ganhar pontos
(Channel Points) -> gastar pontos (packs na Loja).

Possíveis afinações futuras (sem pressa):
- Custos diferentes por pack, ou um "desconto" para quem assiste há mais
  tempo.
- Mostrar nas Definições/Perfil um link direto para a recompensa de Channel
  Points no canal Twitch.
- Histórico de pontos ganhos/gastos (hoje só vês o saldo atual).
