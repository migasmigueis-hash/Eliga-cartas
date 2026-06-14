# Fase 3b — Edge Functions / anti-cheat (plano geral)

## Porque é que isto é necessário

Desde a Fase 2, o progresso de cada jogador (`profiles.state`) é lido e escrito
**pelo browser do próprio jogador**. Isso significa que, hoje, alguém com
conhecimentos técnicos pode abrir a consola do browser (`F12`) e:

- Chamar diretamente `supabase.from('profiles').update({ state: { ...} })` com
  uma coleção inventada (ex.: todas as cartas Lendárias, 999999 Escolhas).
- Marcar códigos como não usados, ou objetivos como reclamáveis sem cumprir os
  requisitos.
- Simular jornadas com pontuações inventadas (o `register_jornada` da Fase 4 já
  limita a 0–1000, mas não confirma que a jornada foi "jogada" de verdade).

A solução: as ações que **dão recompensas** passam a ser processadas no
servidor (**Supabase Edge Functions**), que é o único sítio com permissão para
escrever certas partes do `profiles.state`. O browser deixa de "decidir" o
resultado — só pede a ação e recebe o resultado já validado.

## Arquitetura (a partir de agora)

```
Browser (React)                 Edge Function (Deno, no Supabase)
   |  supabase.functions.invoke('open-pack', { packId })
   |------------------------------------------------------>|
   |                                                        | 1. confirma quem é o
   |                                                        |    utilizador (JWT)
   |                                                        | 2. lê profiles.state
   |                                                        |    (com service_role)
   |                                                        | 3. aplica as regras
   |                                                        |    do jogo (sorteio,
   |                                                        |    validações, etc.)
   |                                                        | 4. escreve o novo
   |                                                        |    profiles.state
   |  <------------------------------------------------------|
   |  { cardIds, collection, meta, hist }
   |
   | setCollection(...), setMeta(...), setHist(...)
   | (o efeito de "guardar progresso" da Fase 2 mantém-se,
   |  agora só com dados confirmados pelo servidor)
```

Pontos-chave:
- O cliente nunca calcula o resultado de uma ação "que dá prémios" — só envia o
  pedido e aplica a resposta.
- As Edge Functions usam a `service_role key` (que nunca vai para o browser) para
  ler/escrever `profiles.state`, ignorando RLS — mas só fazem isso para o
  utilizador identificado pelo seu próprio token de sessão.
- A lógica de jogo (raridades, packs, etc.) passa a existir **em dois sítios**:
  `src/App.jsx` (para a UI/animações) e `supabase/functions/_shared/` (para a
  decisão real). Sempre que mudares uma regra de jogo, tens de atualizar os dois.

## Pré-requisito único: Supabase CLI

Todas as sub-fases abaixo precisam da Supabase CLI instalada e ligada ao projeto.
Isto faz-se **uma única vez** — ver `FASE-3B-SETUP-CLI.md`.

## Sub-fases (ordem recomendada)

| # | O que migra | Risco que resolve | Estado |
|---|---|---|---|
| 3b.1 | **Abrir pack** (Loja) | Dar-se cartas Lendárias/Épicas à toa | ✅ Código pronto — ver `FASE-3B-1-ABRIR-PACK.md` |
| 3b.2 | **Trocas** (duplicados → carta superior) | Trocar sem ter duplicados, ou escolher sempre Lendária | ⏳ Planeado |
| 3b.3 | **Códigos promocionais + Objetivos** | Resgatar o mesmo código várias vezes, reclamar objetivos não cumpridos | ⏳ Planeado |
| 3b.4 | **Escolhas (Wonder Pick)** | Escolher sempre a carta mais rara do tabuleiro | ⏳ Planeado |
| 3b.5 | **Previsões + validação da jornada** | Pontuação de jornada inventada (o `register_jornada` da Fase 4 confia no valor enviado) | ⏳ Planeado |
| 3b.6 (opcional) | Pack Admin | Baixo risco (admin já é confiável) — pode ficar como está | ⏳ Opcional |

Cada sub-fase é independente: podes aplicar a 3b.1, testar/usar durante uns dias,
e só depois avançar para a 3b.2 — não há obrigação de fazer tudo de seguida.

## O que já está pronto neste pacote

```
supabase/
  functions/
    _shared/
      cardpool.ts     — todas as 71 cartas (id, raridade, clube, edição), extraídas do POOL atual
      gameData.ts      — PACKS, PACK_ODDS, rollRarity, randomOfRarity, drawPack (réplica do cliente)
      cors.ts          — cabeçalhos CORS + helper de resposta JSON
    open-pack/
      index.ts         — Edge Function completa para "abrir pack" (3b.1)
FASE-3B-PLANO.md         — este ficheiro
FASE-3B-SETUP-CLI.md     — tutorial de instalação da Supabase CLI (Windows)
FASE-3B-1-ABRIR-PACK.md  — como aplicar a sub-fase 3b.1 (deploy + alteração no App.jsx)
```

## Nota sobre manutenção de `cardpool.ts`

Este ficheiro foi gerado automaticamente a partir do `POOL` atual do
`src/App.jsx` (71 cartas: 25 comuns, 20 raras, 22 épicas, 4 lendárias). Se um dia
adicionares/removeres cartas (`TEAMS`, `PLAYERS`, `CASTERS`, `SPECIALS`), também
precisas de regenerar este ficheiro — caso contrário as Edge Functions vão
sortear de um conjunto de cartas desatualizado. Quando chegar a esse ponto, eu
posso gerar a versão atualizada a partir do `App.jsx` (é um processo automático).
