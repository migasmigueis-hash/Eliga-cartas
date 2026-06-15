# Fase 5.2 — Creditar pontos via Channel Points (EventSub)

Pré-requisito: 5.1 feita (conta Twitch ligada, vês "Twitch ligada: ..." no Perfil).

## O que esta sub-fase faz

- Nova tabela `twitch_redemptions` (evita creditar duas vezes o mesmo resgate,
  caso a Twitch reenvie a notificação).
- Nova função SQL `credit_twitch_points` — soma pontos a `profiles.twitch_points`
  de forma atómica, a partir do `twitch_user_id`.
- Nova Edge Function `twitch-eventsub` — recebe as notificações da Twitch
  (EventSub), confirma a assinatura, e chama `credit_twitch_points` quando
  alguém resgata a recompensa de Channel Points "Pontos eLiga Cartas".

Ficheiros novos:
```
supabase/fase5_2_twitch_eventsub.sql
supabase/functions/twitch-eventsub/index.ts
```

## 1. Gerar o segredo do EventSub

Este é um segredo **diferente** do `TWITCH_CLIENT_SECRET` — é escolhido por
nós e usado só para a Twitch assinar as notificações que nos envia. No
PowerShell:

```powershell
$secret = [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")
$secret
```

Copia o valor que aparece (64 caracteres). Vamos usá-lo em dois sítios: nos
segredos do Supabase, e no pedido que cria a subscrição (passo 5).

## 2. Configurar segredos no Supabase

```powershell
supabase secrets set TWITCH_EVENTSUB_SECRET=<o valor gerado no passo 1>
supabase secrets set TWITCH_REWARD_TITLE="Pontos eLiga Cartas"
supabase secrets set TWITCH_POINTS_PER_REDEMPTION=10
```

(`TWITCH_REWARD_TITLE`/`TWITCH_POINTS_PER_REDEMPTION` são opcionais — estes
são já os valores por defeito. Ajusta se quiseres outro nome/quantidade.)

## 3. SQL

SQL Editor → corre `supabase/fase5_2_twitch_eventsub.sql`.

## 4. Deploy da função

```powershell
supabase functions deploy twitch-eventsub --no-verify-jwt --use-api
```

⚠️ Tem de estar deployed **antes** do passo 6 (criar a subscrição) — a Twitch
testa o URL logo ao criar a subscrição.

## 5. Criar a recompensa de Channel Points

No painel de criador da Twitch (creator dashboard) → **Viewer Rewards** →
**Channel Points** → **Manage Rewards** → **+ Add Custom Reward**:
- **Título**: exatamente `Pontos eLiga Cartas` (ou o que puseste em
  `TWITCH_REWARD_TITLE` no passo 2 — tem de ser **igual**, maiúsculas/minúsculas
  não importam, mas o texto sim).
- **Custo**: o que quiseres em Channel Points (ex.: 500).
- Podes desativar "Require Viewer to Enter Text" e deixar "Skip Reward
  Requests Queue" ativo (não é usado por nós, mas evita teres de aprovar
  manualmente).

## 6. Criar a subscrição EventSub

Precisas do `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET` da Fase 5.1 (se já não
os tiveres à mão, gera um novo secret na Twitch Developer Console e atualiza
`supabase secrets set TWITCH_CLIENT_SECRET=...` também).

No PowerShell, na pasta do projeto:

```powershell
$clientId     = "<TWITCH_CLIENT_ID>"
$clientSecret = "<TWITCH_CLIENT_SECRET>"
$channelLogin = "<nome do canal Twitch, ex.: eligaportugal>"
$callbackUrl  = "https://axfwwgefedphzeokmbhu.supabase.co/functions/v1/twitch-eventsub"
$eventsubSecret = "<o valor gerado no passo 1>"

# 1) token de aplicação
$token = Invoke-RestMethod -Method Post -Uri "https://id.twitch.tv/oauth2/token" -Body @{
  client_id = $clientId; client_secret = $clientSecret; grant_type = "client_credentials"
}
$headers = @{ "Client-Id" = $clientId; "Authorization" = "Bearer $($token.access_token)" }

# 2) obter o broadcaster_user_id do canal
$user = Invoke-RestMethod -Uri "https://api.twitch.tv/helix/users?login=$channelLogin" -Headers $headers
$broadcasterId = $user.data[0].id
Write-Host "broadcaster_user_id: $broadcasterId"

# 3) criar a subscrição EventSub
$body = @{
  type = "channel.channel_points_custom_reward_redemption.add"
  version = "1"
  condition = @{ broadcaster_user_id = $broadcasterId }
  transport = @{ method = "webhook"; callback = $callbackUrl; secret = $eventsubSecret }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "https://api.twitch.tv/helix/eventsub/subscriptions" -Headers $headers -Body $body -ContentType "application/json"
```

Resultado esperado: um objeto com `status: "webhook_callback_verification_pending"`.
Confirma que passou a `"enabled"`:

```powershell
Invoke-RestMethod -Uri "https://api.twitch.tv/helix/eventsub/subscriptions" -Headers $headers
```

Se ficar `"webhook_callback_verification_failed"`:
- Confirma que o deploy do passo 4 terminou sem erros.
- Confirma `supabase secrets list` tem `TWITCH_EVENTSUB_SECRET` definido.
- Tenta apagar a subscrição (`Invoke-RestMethod -Method Delete -Uri
  "https://api.twitch.tv/helix/eventsub/subscriptions?id=<id>" -Headers
  $headers`) e repete o passo 3.

## 7. Testar

- No teu canal Twitch (com a conta cuja `twitch_user_id` está ligada ao teu
  perfil eLiga Cartas), resgata a recompensa "Pontos eLiga Cartas" nos
  Channel Points.
- Na app → **Perfil**, atualiza a página → "X pontos Twitch" deve ter subido
  por `TWITCH_POINTS_PER_REDEMPTION` (10 por defeito).
- Confirma no Supabase → **Table Editor**:
  - `twitch_redemptions` tem uma linha nova.
  - `profiles.twitch_points` da tua conta aumentou.

## 8. Commit e push

```powershell
git add -A
git commit -m "Fase 5.2: creditar pontos via Channel Points (EventSub)"
git push
```

## Limitações conhecidas (aceitáveis para esta fase)

- Se alguém resgatar a recompensa **sem ter ligado a conta Twitch** (5.1), os
  pontos ficam "perdidos" — `credit_twitch_points` não encontra nenhum perfil
  com esse `twitch_user_id` e não credita nada. Fica registado em
  `twitch_redemptions` (para não ser creditado em duplicado se algum dia
  reprocessarmos manualmente), mas não há reprocessamento automático.
- A verificação da assinatura usa comparação direta de strings (não
  "constant-time"). Para o nível de risco deste projeto (moeda interna de um
  jogo de coleção, sem valor monetário real) é um compromisso razoável.

## Próxima sub-fase

**5.3 — Gastar pontos na Loja**: cada pack passa a ter um custo em
`twitch_points`; `open-pack` confirma e debita o saldo (atomicamente, como o
`apply_wonder_pick`) antes de sortear o pack.
