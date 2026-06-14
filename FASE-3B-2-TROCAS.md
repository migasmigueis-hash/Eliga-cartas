# Fase 3b.2 — Trocas via Edge Function

Pré-requisito: já tens a Supabase CLI configurada (feito na 3b.1).

## O que esta sub-fase faz

- Move a lógica de **Trocas** (10 duplicados → 1 carta aleatória da raridade
  acima; 25 duplicados → escolher a carta exata) para uma Edge Function
  (`trade-cards`).
- O servidor confirma que tens mesmo os duplicados, consome-os e dá a carta —
  o browser já não decide nada disto.
- `src/App.jsx` ganhou também um pequeno helper `fnErrorMessage` (partilhado
  entre `openPack`, `confirmTrade` e `directTradeGo`) para mostrar mensagens de
  erro da Edge Function de forma consistente.
- As funções `rollRarity`, `randomOfRarity` e `drawPack` foram removidas do
  cliente (já não são usadas — a lógica equivalente vive em
  `supabase/functions/_shared/gameData.ts`).

Ficheiros novos/alterados neste pacote:
```
supabase/functions/_shared/gameData.ts   — atualizado (RARITY_UP, RARITY_LABEL,
                                            TRADE_COST/DIRECT, duplicatesOf, pickDuplicates)
supabase/functions/trade-cards/index.ts  — nova Edge Function
src/App.jsx                              — atualizado (confirmTrade, directTradeGo,
                                            openPack, fnErrorMessage, limpeza)
```

## 1. Copiar os ficheiros

- Substitui `supabase/functions/_shared/gameData.ts` pelo deste pacote.
- Cria a pasta `supabase/functions/trade-cards/` e coloca lá o `index.ts`.
- Substitui `src/App.jsx`.

## 2. Deploy

Como o `gameData.ts` (em `_shared/`) mudou, e o `open-pack` também o importa,
o mais seguro é voltar a fazer deploy das duas funções:

```powershell
supabase functions deploy open-pack --use-api
supabase functions deploy trade-cards --use-api
```

## 3. Testar localmente

```powershell
npm run dev
```
- Vai a **Trocas**. Se já tiveres 10+ duplicados de alguma raridade, clica
  "Trocar" → confirma → deve aparecer a animação com a carta nova.
- Testa também "Escolher carta" (25 duplicados) se tiveres o suficiente.
- Confirma no Supabase → **Table Editor → profiles** que `state.collection` e
  `state.meta.trocas` foram atualizados.
- Objetivos → "Fazer 3 trocas esta semana" deve avançar.

### Se não tiveres duplicados suficientes para testar

Podes usar o **Pack Admin** (conta `admin`) para encher rapidamente a coleção —
dá 1 cópia de cada carta, o que sozinho não chega para 10 duplicados da mesma
raridade, mas abrir alguns Packs Base normais a seguir deve gerar duplicados
rapidamente (raridade "comum" é a mais provável).

## 4. Commit e push

```powershell
git add -A
git commit -m "Fase 3b.2: trocas via Edge Function (anti-cheat)"
git push
```

Confirma em produção.

## Próxima sub-fase

**3b.3 — Códigos promocionais + Objetivos de Escolhas**: validar no servidor que
um código ainda não foi usado por esta conta, e mover a concessão de Escolhas
(`escolha1/2/3`) dos objetivos para o servidor também (hoje só o `claims` fica
protegido — a contagem de Escolhas em si ainda é só local).
