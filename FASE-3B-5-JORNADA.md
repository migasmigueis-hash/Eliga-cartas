# Fase 3b.5 — Simular jornada via Edge Function

Pré-requisito: 3b.1 a 3b.4 feitas, e a SQL `fase4_jornadas_reais.sql` já aplicada
(bots removidos + limite de 10 jornadas).

## O que esta sub-fase faz

- Nova Edge Function `play-jornada`. Ao clicar "Simular jornada", o servidor:
  1. Confirma que tens mesmo as 3 cartas escolhidas na coleção.
  2. Corre a simulação dos 2 jogos de cada carta (a parte aleatória) com a
     sua própria aleatoriedade.
  3. Calcula pontos base + efeitos + sinergias + bónus de capitão (×2) —
     exatamente a mesma fórmula que já existia, agora no servidor.
  4. Chama `register_jornada` (já com o limite de 10/jogador da alteração
     anterior) para gravar o ranking partilhado.
  5. Atualiza "As tuas jornadas" (`jHist`).

- O cliente deixou de calcular `total` sozinho — recebe o resultado já
  validado e só o apresenta (reconstrói o `card` e o nome do adversário a
  partir do `POOL`/`TEAMS` locais, que são só para exibição).

- **Verificação feita**: o motor do servidor (`scoreLineup`) dá exatamente os
  mesmos resultados que o motor antigo do cliente, testado com várias
  composições (clube, jogador, caster, carta especial) e várias sequências
  aleatórias.

Ficheiros novos/alterados:
```
supabase/functions/_shared/jornadaCards.ts  — nova (71 cartas com stats v/mg/ref/casterRef)
supabase/functions/_shared/jornadaTeams.ts  — nova (18 equipas + ranking)
supabase/functions/_shared/jornadaScore.ts  — nova (fxTypeFor/effectOf/simulatePerformance/scoreLineup)
supabase/functions/play-jornada/index.ts    — nova
src/App.jsx                                 — simulateJornada chama play-jornada;
                                               removidos simulatePerformance/scoreLineup
                                               (SCORING e effectOf/FX_LABEL ficam — são
                                               usados só para mostrar regras/efeitos na UI)
```

## 1. Copiar os ficheiros

- Cria `supabase/functions/_shared/jornadaCards.ts`, `jornadaTeams.ts`, `jornadaScore.ts`.
- Cria `supabase/functions/play-jornada/index.ts`.
- Substitui `src/App.jsx`.

## 2. Deploy

```powershell
supabase functions deploy play-jornada --use-api
```

(as outras funções não mudaram nesta sub-fase)

## 3. Testar localmente

```powershell
npm run dev
```
- Vai a **Competição**, escolhe 3 cartas + capitão, "Simular jornada".
- Deve aparecer o resultado normalmente (cartas, jogos V/E/D, base/efeito/sinergia,
  total) e o ranking atualizar.
- Confirma no Supabase → **Table Editor → leaderboard** que `score`/`jornadas`
  do teu utilizador avançaram.
- Repete até ao limite de 10 → deve mostrar "Limite de 10 jornadas atingido".
- (Teste de segurança) Abre a consola e tenta chamar `play-jornada` com uma
  carta que não tens na coleção — deve dar "Não tens essa carta na coleção."

## 4. Commit e push

```powershell
git add -A
git commit -m "Fase 3b.5: simular jornada via Edge Function (anti-cheat)"
git push
```

## Estado da Fase 3b

Com isto, **todas** as ações que dão recompensas ou pontos (abrir pack, trocas,
códigos, objetivos, Escolhas, jornada) passam pelo servidor. O que faltava no
roteiro original era só isto — a 3b.5 era a maior peça.

Fica em aberto, sempre opcional e sem pressa:
- **Hardening final**: tornar `profiles.state` só de leitura para o cliente
  (bloquear `update` direto via RLS), obrigando tudo a passar por Edge
  Functions. Com tudo migrado, este é o momento natural para isso — mas exige
  cuidado extra (qualquer campo de `state` esquecido deixaria de poder ser
  guardado).
- **Integração Twitch**: quando estiver pronta, ligar pontos a "abrir pack" na
  Loja (hoje reservado ao admin).
- **Validação de objetivos**: `claim-objective`/`claim` (3b.1/3b.3) ainda não
  recalculam `prog >= alvo` no servidor — confiam no cliente para essa parte.
