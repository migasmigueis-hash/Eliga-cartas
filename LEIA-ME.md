# eLiga Cartas — pacote completo (back-end)

## Para a última funcionalidade (prazos + recompensas) precisas de:
- redeployar 4 funções: `admin-liga-config`, `previsoes-simular-grupos`,
  `previsoes-resolver`, `previsoes-avaliar`
- correr `sql/fase6_remove_jornada_limit.sql` no SQL Editor (remove limite de jornadas)
- substituir `src/App.jsx` pelo novo

## Deploy (PowerShell — uma linha)
```powershell
supabase functions deploy admin-liga-config previsoes-simular-grupos previsoes-resolver previsoes-avaliar --use-api
```

(As outras funções no pacote são de rondas anteriores; já as tens deployadas.)

## Prazos
- Card "Prazos das Previsões" na tab Admin: define data/hora limite para grupos e
  eliminatórias. Depois do prazo, ninguém submete nem altera (validado no servidor).

## Recompensas por fase (pack + Twitch) — ajustáveis em previsoes-avaliar/index.ts
Grupos (apurados certos): 7-8→Finals+150 · 5-6→Finals+100 · 3-4→Base+50 · 1-2→Base+20
Eliminatória (pontos da fase): ≥100→Finals+200 · ≥60→Finals+120 · ≥30→Base+60 · ≥10→Base+25
- Twitch creditado automaticamente ao avaliar; pack aberto pelo jogador.
