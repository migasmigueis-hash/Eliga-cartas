# Fase 3b.4 — Escolhas (Wonder Pick) via Edge Function

Pré-requisito: 3b.1, 3b.2, 3b.3 feitas.

## O que esta sub-fase faz

- Nova Edge Function `wonder-pick`. Quando clicas numa carta de um tabuleiro
  de Escolhas, o servidor:
  1. Recalcula, pela sua própria hora, qual o "slot" de 6h atual e reconstrói
     os 3 tabuleiros normais + o premium (mesmo algoritmo determinístico que o
     cliente já usava — confirmei que dão exatamente os mesmos resultados).
  2. Confirma que a carta pedida pertence mesmo a esse tabuleiro.
  3. Confirma que tens Escolhas suficientes (`escolhas >= custo`) e que ainda
     não usaste esta Escolha (`picksUsed[key]`).
  4. Só então: debita as Escolhas, marca `picksUsed`, dá a carta, regista
     `meta.escUso` (objetivos) e o histórico — tudo numa escrita atómica.

- **Removido**: o botão "↻ Regenerar (admin)" e o mecanismo `picksBump`. Como
  o servidor agora recalcula o tabuleiro pela sua própria hora (ignorando
  qualquer "bump" local), esse botão deixaria as Escolhas dessa conta por usar
  até à próxima janela de 6h. Era só uma ferramenta de teste — já não é
  necessária.

Ficheiros novos/alterados:
```
supabase/functions/_shared/gameData.ts   — + PICK_SLOT_MS, buildPickBoard()
supabase/functions/wonder-pick/index.ts  — nova
src/App.jsx                              — wonderPick async; remoção de picksBump/adminRefreshBoard
```

## 1. Copiar os ficheiros

- Substitui `supabase/functions/_shared/gameData.ts`.
- Cria `supabase/functions/wonder-pick/index.ts`.
- Substitui `src/App.jsx`.

## 2. Deploy

```powershell
supabase functions deploy open-pack --use-api
supabase functions deploy trade-cards --use-api
supabase functions deploy redeem-code --use-api
supabase functions deploy claim-objective --use-api
supabase functions deploy wonder-pick --use-api
```

(o `gameData.ts` partilhado mudou, por isso o mais seguro é voltar a fazer
deploy de todas — não muda nada nas que já estavam corretas, mas garante que
todas usam a versão mais recente)

## 3. Testar localmente

```powershell
npm run dev
```
- Vai a **Escolhas**. Usa uma Escolha num dos 3 tabuleiros normais → deve
  aparecer a animação/som da carta e o contador de Escolhas descer 1.
- Se tiveres 3+ Escolhas, testa também o tabuleiro **premium** (custa 3).
- Confirma que o mesmo tabuleiro não pode ser usado duas vezes (depois de
  usares, as cartas desse conjunto devem aparecer marcadas/desativadas).
- Objetivos relacionados com Escolhas devem avançar.

## 4. Commit e push

```powershell
git add -A
git commit -m "Fase 3b.4: Escolhas (Wonder Pick) via Edge Function"
git push
```

## Estado da Fase 3b

Com isto, as principais ações que **dão recompensas** (abrir pack, trocas,
códigos, objetivos com pack/Escolhas, Wonder Pick) já passam todas pelo
servidor. Falta no roteiro original:

- **3b.5 — Previsões + validação da pontuação de jornada**: a simulação de
  jornada (`register_jornada`) já existe desde a Fase 4, mas confia no valor
  de pontos enviado pelo cliente; e o resgate de recompensas das Previsões
  ainda é local.
- **Hardening final**: tornar `profiles.state` só de leitura para o cliente
  (bloquear `update` direto via RLS), obrigando tudo a passar por Edge
  Functions. Só faz sentido depois da 3b.5.

Podes continuar para a 3b.5 quando quiseres, ou ficar por aqui — o jogo já
está muito mais resistente a "consola aberta" do que estava no início da Fase
3b.
