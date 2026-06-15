# Fase 5 — Integração Twitch (plano geral)

## Objetivo

Os espectadores ganham **pontos** a resgatar uma recompensa de "Channel
Points" no canal Twitch da eLiga Portugal, e podem trocar esses pontos por
packs na Loja (hoje reservada ao admin, à espera disto).

## Arquitetura (visão geral)

```
1) LIGAR CONTA (Fase 5.1 — este pacote)
   Jogador (Perfil) --"Ligar conta Twitch"--> OAuth Twitch --> callback
   --> grava profiles.twitch_user_id / twitch_login

2) GANHAR PONTOS (Fase 5.2 — seguinte)
   Espectador resgata recompensa "Channel Points" na Twitch
   --> Twitch envia evento EventSub (webhook) --> Edge Function
   --> soma profiles.twitch_points onde twitch_user_id = <quem resgatou>

3) GASTAR PONTOS (Fase 5.3 — seguinte)
   Jogador (Loja) --"Abrir pack (X pontos)"--> Edge Function
   --> confirma twitch_points >= custo, debita, abre o pack
```

Cada sub-fase é independente e dá para testar isoladamente.

## Sub-fase 5.1 — Ligar conta Twitch (este pacote)

### O que faz

- 2 colunas novas em `profiles`: `twitch_user_id`, `twitch_login`,
  `twitch_points` (protegidas por trigger — só Edge Functions/service_role
  podem alterar, tal como `is_admin` na Fase 3a).
- `twitch-link-start`: o jogador clica "Ligar conta Twitch" → esta função
  gera um link de autorização da Twitch (com um "state" assinado que
  identifica a conta eLiga Cartas).
- `twitch-link-callback`: URL de redirecionamento configurada na app Twitch.
  Troca o código por um token, obtém o utilizador Twitch, e grava
  `twitch_user_id`/`twitch_login` no perfil. Depois redireciona de volta para
  a app.
- Perfil: nova secção "🟣 Conta Twitch" — mostra se está ligada e os pontos
  atuais (0 até a 5.2 estar feita).

Ficheiros novos/alterados:
```
supabase/fase5_1_twitch_link.sql
supabase/functions/_shared/twitchState.ts
supabase/functions/twitch-link-start/index.ts
supabase/functions/twitch-link-callback/index.ts
src/App.jsx — secção Twitch no Perfil + linkTwitch()
```

### 1. Criar a app na Twitch Developer Console

1. Vai a **https://dev.twitch.tv/console/apps** (login com a conta Twitch da
   eLiga Portugal) → **Register Your Application**.
2. **Name**: `eLiga Cartas` (ou outro nome — só aparece no ecrã de
   autorização da Twitch).
3. **OAuth Redirect URLs**: adiciona exatamente
   ```
   https://axfwwgefedphzeokmbhu.supabase.co/functions/v1/twitch-link-callback
   ```
   (substitui pelo teu `<PROJECT_REF>` se for diferente)
4. **Category**: "Website Integration" (ou "Game Integration").
5. **Client Type**: **Confidential**.
6. Cria. Na página da app:
   - Copia o **Client ID**.
   - Clica **New Secret** → copia o **Client Secret** (só é mostrado uma vez).

### 2. Configurar os segredos na Supabase

```powershell
supabase secrets set TWITCH_CLIENT_ID=<o teu Client ID>
supabase secrets set TWITCH_CLIENT_SECRET=<o teu Client Secret>
```

(`APP_URL` tem como valor por defeito `https://eligaportugal.vercel.app` — só
precisas de definir `supabase secrets set APP_URL=...` se o site estiver
noutro domínio)

### 3. Copiar os ficheiros e SQL

- SQL Editor → corre `supabase/fase5_1_twitch_link.sql`.
- Cria `supabase/functions/_shared/twitchState.ts`.
- Cria `supabase/functions/twitch-link-start/index.ts`.
- Cria `supabase/functions/twitch-link-callback/index.ts`.
- Substitui `src/App.jsx`.

### 4. Deploy

```powershell
supabase functions deploy twitch-link-start --use-api
supabase functions deploy twitch-link-callback --no-verify-jwt --use-api
```

⚠️ O `--no-verify-jwt` no `twitch-link-callback` é **essencial** — é a Twitch
que chama este URL diretamente (sem sessão Supabase); sem esta flag, o
Supabase rejeita o pedido antes de chegar à função.

### 5. Testar

```powershell
npm run dev
```
- Vai a **Perfil** → deve aparecer "🟣 Conta Twitch não ligada" com um botão
  "Ligar conta Twitch".
- Clica → deves ser levado para a página de autorização da Twitch
  (`id.twitch.tv`) → aceita.
- Deves voltar à app com um aviso "Conta Twitch ligada com sucesso! 🟣" e o
  Perfil agora mostra "Twitch ligada: <o teu nome de utilizador Twitch>" e
  "0 pontos Twitch".
- Confirma no Supabase → **Table Editor → profiles** que `twitch_user_id` e
  `twitch_login` ficaram preenchidos para a tua conta.

> Nota: localhost (`npm run dev`) também funciona — o redirecionamento final
> volta para `APP_URL` (produção), não para o `localhost`. Para testar
> totalmente em local, terias de mudar `APP_URL` temporariamente — não é
> necessário só para confirmar que a ligação grava os dados certos.

### 6. Commit e push

```powershell
git add -A
git commit -m "Fase 5.1: ligar conta Twitch (OAuth)"
git push
```

---

## Próximas sub-fases (planeadas, ainda não implementadas)

### 5.2 — Creditar pontos via Channel Points (EventSub)

- Criar a recompensa de "Channel Points" no painel de criador da Twitch (ex.:
  "10 pontos eLiga Cartas").
- Nova Edge Function `twitch-eventsub` (`--no-verify-jwt`), que:
  - Responde ao desafio de verificação da subscrição EventSub.
  - Verifica a assinatura HMAC dos pedidos da Twitch (segredo definido por
    nós).
  - Em `channel.channel_points_custom_reward_redemption.add`: encontra o
    perfil com `twitch_user_id = event.user_id` e soma pontos a
    `twitch_points` (de forma atómica, `update ... set twitch_points =
    twitch_points + N`).
  - Guarda o `redemption.id` processado, para ignorar reenvios duplicados da
    Twitch.
- Criar a subscrição EventSub (`channel.channel_points_custom_reward_redemption.add`)
  via API da Twitch — passo único, feito uma vez com um pedido autenticado
  (App Access Token).

### 5.3 — Gastar pontos na Loja

- Cada pack passa a ter um custo em pontos Twitch (ex.: Pack Base = 50,
  Finals = 150 — valores a decidir).
- `open-pack` passa a aceitar `{ packId, spendTwitchPoints: true }`: confirma
  `twitch_points >= custo`, debita atomicamente (mesma técnica do
  `apply_wonder_pick`), e só depois sorteia o pack.
- Loja: para jogadores com conta Twitch ligada, o botão passa de "Em breve
  (pontos Twitch)" para "Abrir (X pontos)", desativado se não tiverem pontos
  suficientes.

Avisa quando quiseres avançar para a 5.2 — vai precisar que tenhas criado a
recompensa de Channel Points no painel da Twitch primeiro.
