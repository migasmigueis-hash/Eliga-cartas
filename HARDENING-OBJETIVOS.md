# Hardening — Validação de objetivos no servidor (prog >= alvo)

## O que muda

Até agora, `claim-objective` e `open-pack` (com `claim:{id,periodo}`) só
confirmavam que o objetivo ainda não tinha sido reclamado — confiavam no
cliente para "prog >= alvo". Um jogador podia, em teoria, abrir a consola e
chamar estas funções para qualquer `id` de objetivo, mesmo sem o ter
cumprido.

Agora ambas recalculam o objetivo a partir de `profiles.state` (server-side,
em `_shared/objectives.ts` — réplica fiel de `buildObjectives` do cliente,
verificada com testes automáticos contra 34 objetivos em 5 cenários
diferentes) e confirmam:
- o `id` corresponde a um objetivo conhecido;
- o `periodo` enviado é o período atual (hoje / semana atual / "perm");
- `prog >= alvo` — o objetivo está mesmo cumprido;
- ainda não foi reclamado nesse período;
- (só no `open-pack`) o pack pedido (base/finals) é mesmo a recompensa
  desse objetivo — impede pedir o pack "errado" (mais valioso) para um
  objetivo que dá outro.

Ficheiros novos/alterados:
```
supabase/functions/_shared/objectives.ts    — nova (recalcula prog/alvo/reward)
supabase/functions/claim-objective/index.ts — usa validateObjectiveClaim
supabase/functions/open-pack/index.ts       — valida claim antes de sortear
```

## 1. Copiar os ficheiros

- Cria `supabase/functions/_shared/objectives.ts`.
- Substitui `supabase/functions/claim-objective/index.ts`.
- Substitui `supabase/functions/open-pack/index.ts`.

## 2. Deploy

```powershell
supabase functions deploy claim-objective --use-api
supabase functions deploy open-pack --use-api
```

## 3. Testar

```powershell
npm run dev
```
- Reclama um objetivo que já esteja cumprido (ex.: "Entrar no jogo hoje") —
  deve funcionar normalmente, como antes.
- (Teste de seguranca) Abre a consola do browser e tenta:
  ```js
  await supabase.functions.invoke("claim-objective", { body: { id: "p-col45", periodo: "perm" } })
  ```
  Sem teres 45 cartas diferentes, deve devolver { error: "Ainda não
  cumpriste este objetivo." } e não dar Escolhas.
- Tenta reclamar o mesmo objetivo duas vezes (rapidamente) — a segunda deve
  dizer "Objetivo já reclamado." e não duplicar a recompensa.

## 4. Commit e push

```powershell
git add -A
git commit -m "Hardening: valida prog>=alvo no servidor para objetivos"
git push
```

---

Com isto fica fechada a última peça de hardening do roteiro original da Fase
3b — todas as recompensas (packs, trocas, Escolhas, jornada, objetivos,
pontos Twitch) são agora confirmadas no servidor.
