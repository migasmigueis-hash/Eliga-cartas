# Fase 3b.3 — Códigos promocionais + Objetivos de Escolhas

Pré-requisito: 3b.1 e 3b.2 feitas.

## O que esta sub-fase faz

- **Códigos promocionais**: nova Edge Function `redeem-code`. O servidor
  confirma que o código existe e que **esta conta** ainda não o usou
  (`state.codesUsed`), e só depois dá a recompensa (Escolhas, ou abre um pack
  — reaproveitando a mesma lógica de sorteio do `open-pack`).
- **Objetivos com recompensa em Escolhas** (`s-login5`, `s-packs10`,
  `p-streak14`, `p-col15/30/45`): nova Edge Function `claim-objective`. Marca
  `meta.claims[id] = periodo` e soma as Escolhas numa única escrita atómica —
  fecha a mesma classe de corrida que já tínhamos fechado na 3b.1 para os
  objetivos com recompensa em pack.
- **Refactor**: a lógica de "abrir pack" (sorteio + pity + atualizar
  coleção/meta/hist) foi extraída para `applyPackOpening()` em
  `_shared/gameData.ts`, partilhada entre `open-pack` e `redeem-code`.

Ficheiros novos/alterados:
```
supabase/functions/_shared/gameData.ts     — + REDEEM_CODES, OBJECTIVE_ESCOLHA_REWARDS,
                                              applyPackOpening()
supabase/functions/open-pack/index.ts      — refatorado (usa applyPackOpening)
supabase/functions/redeem-code/index.ts    — nova
supabase/functions/claim-objective/index.ts — nova
src/App.jsx                                — redeemCode e claimObjective (escolhas) async
```

## ⚠️ Limitação conhecida (por design, para esta sub-fase)

`claim-objective` valida que o `id` é um objetivo conhecido com recompensa em
Escolhas e que ainda não foi reclamado neste período — mas **não recalcula** se
o objetivo está mesmo cumprido (`prog >= alvo`). Essa validação completa exige
replicar o `buildObjectives` inteiro no servidor (todas as contagens de packs,
trocas, coleção por clube, streaks, etc.) e fica para uma sub-fase de hardening
dedicada, quando todas as ações de jogo já estiverem migradas.

Da mesma forma, enquanto `profiles.state` continuar a ser escrevível
diretamente pelo browser (Fase 2), alguém com a consola aberta ainda consegue
em teoria escrever valores arbitrários em `state.escolhas`, `state.collection`,
etc. via `supabase.from('profiles').update(...)`. Fechar isso por completo
(tornar `profiles.state` só de leitura para o cliente, tudo via Edge
Functions) é o objetivo final da Fase 3b, mas é uma mudança maior que faz mais
sentido só depois de todas as ações estarem migradas.

## 1. Copiar os ficheiros

- Substitui `supabase/functions/_shared/gameData.ts`.
- Substitui `supabase/functions/open-pack/index.ts`.
- Cria `supabase/functions/redeem-code/index.ts` e `supabase/functions/claim-objective/index.ts`.
- Substitui `src/App.jsx`.

## 2. Deploy

```powershell
supabase functions deploy open-pack --use-api
supabase functions deploy redeem-code --use-api
supabase functions deploy claim-objective --use-api
```

(o `trade-cards` não mudou nesta sub-fase, não precisa de novo deploy)

## 3. Testar localmente

```powershell
npm run dev
```
- **Códigos**: usa um código que ainda não tenhas resgatado nesta conta (ex.:
  `ESCOLHAS10` dá +10 Escolhas; `ELIGA2026`/`BEMVINDO` abrem um Pack Base;
  `FINALS25`/`TWITCHDROP` abrem um Pack Finals). Confirma que:
  - Funciona normalmente da 1ª vez.
  - Tentar o mesmo código outra vez dá "Esse código já foi usado nesta conta."
- **Objetivos de Escolhas**: completa um objetivo semanal/permanente com
  recompensa em Escolhas (ex.: "Entrar em 5 dias diferentes esta semana" —
  pode levar a semana toda; ou um dos marcos de coleção `p-col15/30/45`, se já
  tiveres 15+ cartas diferentes). Reclama → deve dar as Escolhas e marcar
  "✓ Reclamado" sem permitir reclamar de novo.

## 4. Commit e push

```powershell
git add -A
git commit -m "Fase 3b.3: codigos promocionais + objetivos de Escolhas via Edge Function"
git push
```

## Próxima sub-fase

**3b.4 — Escolhas (Wonder Pick)**: o tabuleiro de 5 cartas já é determinístico
(seed partilhada), mas o registo de "Escolha usada" (`meta.escUso`, que conta
para objetivos) e a entrega da carta escolhida ainda são só locais. Mover isto
para uma Edge Function fecha mais uma fonte de `meta` "inventado".
