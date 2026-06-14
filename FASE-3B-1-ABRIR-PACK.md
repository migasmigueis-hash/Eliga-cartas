# Fase 3b.1 — Abrir pack via Edge Function

Pré-requisito: `FASE-3B-SETUP-CLI.md` feito (Supabase CLI instalada e ligada ao projeto).

## O que esta sub-fase faz

- Move o sorteio de cartas (probabilidades por raridade, garantia/pity ao 10º
  pack) para uma Edge Function (`open-pack`).
- O servidor lê e atualiza diretamente `profiles.state` (coleção, `meta.pity`,
  `meta.packs`, `hist`) para o utilizador autenticado.
- O cliente deixa de "inventar" o resultado — só mostra a animação com as cartas
  que o servidor devolveu.

Ficheiros já incluídos neste pacote:
```
supabase/functions/_shared/cardpool.ts
supabase/functions/_shared/gameData.ts
supabase/functions/_shared/cors.ts
supabase/functions/open-pack/index.ts
```

## 1. Deploy da função

Na pasta do projeto:
```powershell
supabase functions deploy open-pack
```
(ou `supabase functions deploy open-pack --use-api` se pedir Docker)

No fim, deve aparecer um URL do tipo:
```
https://<PROJECT_REF>.supabase.co/functions/v1/open-pack
```

## 2. Testar a função isoladamente (opcional, mas recomendado)

No Supabase Dashboard → **Edge Functions** → `open-pack` → tab "Invoke" (ou
"Test"), ou via `curl`/Postman, envia um pedido `POST` com:
- Header `Authorization: Bearer <access_token>` (o access token de uma sessão
  ativa — podes obtê-lo na app, na consola do browser, com
  `(await supabase.auth.getSession()).data.session.access_token`).
- Body: `{ "packId": "base" }`

Resposta esperada (exemplo):
```json
{
  "cardIds": ["pl-leks", "club-benfica", "cast-donpablo"],
  "collection": { "...": 1 },
  "meta": { "pity": 1, "packs": { "2026-06-15": 1 }, "...": "..." },
  "hist": [ { "t": 1234567890, "pack": "Pack Base", "ids": ["pl-leks", "club-benfica", "cast-donpablo"] } ]
}
```

Se vires `{"error": "..."}`, lê a mensagem — geralmente indica token inválido ou
perfil não encontrado (confirma que estás a usar o token de uma conta que já fez
login na app, com perfil criado na Fase 2).

## 3. Alterar `src/App.jsx`

Localiza a função `openPack` (perto de `const openPack = (pack) => {`) e
substitui-a por esta versão:

```jsx
const openPack = async (pack) => {
  if (pack.locked) return;
  const ownedBefore = new Set(Object.keys(collection).filter((k) => collection[k] > 0));
  const { data, error } = await supabase.functions.invoke("open-pack", { body: { packId: pack.id } });
  if (error || !data || data.error) {
    let msg = "Não foi possível abrir o pack. Tenta novamente.";
    if (error?.context) {
      try { const body = await error.context.json(); if (body?.error) msg = body.error; } catch (e) { /* ignora */ }
    } else if (data?.error) {
      msg = data.error;
    }
    setToast(msg); setTimeout(() => setToast(null), 2600);
    return;
  }
  const cards = data.cardIds.map((id) => POOL.find((c) => c.id === id)).filter(Boolean);
  setCollection(data.collection);
  setMeta(data.meta);
  setHist(data.hist);
  setOpening({ pack, cards, ownedBefore, initialPhase: "pack", again: () => openPack(pack), againLabel: "Abrir outro" });
};
```

Isto substitui a versão antiga (que chamava `drawPack`, `addCards`, `setMeta`,
`setHist` localmente).

> Nota: `drawPack`, `randomOfRarity`, `rollRarity`, `hasEpicPlus` ficam sem uso em
> `openPack`, mas continuam a ser usadas pelo **Pack Admin** (`openAdminPack`) —
> não as apagues.

## 4. Testar localmente

```powershell
npm run dev
```
- Abre um pack na Loja → deve funcionar exatamente como antes (animação, cartas,
  contagem de packs, garantia ao 10º pack).
- Confirma no Supabase → **Table Editor → profiles** que `state.collection` e
  `state.meta` da tua conta foram atualizados.
- (Teste de segurança) Abre a consola (`F12`) e tenta:
  ```js
  await supabase.from('profiles').update({ state: { collection: { 'sp-leks-finals': 99 } } }).eq('id', (await supabase.auth.getUser()).data.user.id)
  ```
  Isto **ainda funciona** (RLS permite escrever na própria linha) — o que mudou é
  que `openPack` já não depende disto para decidir o resultado. Fechar esta porta
  por completo (impedir updates diretos a `profiles.state` vindos do browser) é
  trabalho para uma sub-fase futura, quando todas as ações estiverem migradas.

## 5. Commit e push

```powershell
git add -A
git commit -m "Fase 3b.1: abrir pack via Edge Function (anti-cheat)"
git push
```

Confirma em produção.

## Erros comuns

- **"Não autenticado"**: o token não chegou à função — confirma que estás
  autenticado na app (não em modo incógnito sem login).
- **"Perfil não encontrado"**: a tua conta não tem linha em `profiles` — confirma
  que correste o SQL da Fase 2/3a para esta conta.
- **CORS error na consola**: confirma que o deploy terminou sem erros — os
  ficheiros em `_shared/` são importados automaticamente pela função, não
  precisas de fazer deploy deles à parte.
