# eLiga Cartas — correção dos 4 bugs + fluxo de Previsões em 2 momentos

## Fluxo implementado (design A — bracket = 8 equipas reais)

```
1. Admin define grupos A/B/C (composição) em liga_data            [já existia]
2. JOGADOR prevê os 8 apurados e FECHA            → 🔒 groupResult.locked
3. Fim dos grupos: admin insere o bracket real (8 que passaram) em etapaN_qf
   e avança a fase para "eliminatorias"
4. ADMIN clica "Avaliar #1"                       → previsoes-revelar-grupos
      • pontua apurados (qualHits) e revela
      • popula prev.bracket com as 8 equipas reais
5. JOGADOR prevê a eliminatória (QF/MF/Final) e FECHA → 🔒 bracketLocked
   (as escolhas ficam fixas)
6. Eliminatória jogada: admin insere resultados em etapaN_qf/sf/final
7. ADMIN clica "Avaliar #2"                        → previsoes-validar-todos
      • pontua a bracket e escreve prev.resolved (mostra pontos + recompensa)
```

## Edge Functions (substituir/criar — todas no zip)

| Função | Estado | Resolve |
|---|---|---|
| `admin-liga-config` | v3 | Bug 1 — aceita `grupo:null`; força `grupo:null` em eliminatórias/finals |
| `previsoes-iniciar` | v2 | Bug 2 — em eliminatórias nunca cai para grupos |
| `play-jornada` | v2 | guard "já jogaste" também nas eliminatórias |
| `previsoes-simular-grupos` | v3 | Bug 3 — em real só bloqueia (🔒), não revela |
| `previsoes-revelar-grupos` | **NOVA** | Avaliar #1: revela apurados + popula bracket real |
| `previsoes-resolver` | v3 | Bug 4 — em real só bloqueia bracket (🔒), não resolve |
| `previsoes-validar-todos` | v3 | Avaliar #2: pontua a bracket (posicional) |

### Deploy
```bash
supabase functions deploy \
  admin-liga-config previsoes-iniciar play-jornada \
  previsoes-simular-grupos previsoes-revelar-grupos \
  previsoes-resolver previsoes-validar-todos --use-api
```

---

## Alterações no `src/App.jsx` (4 diffs — pequenos)

O `App.jsx` NÃO vai no zip. A tua "Diff 1" (grupo:null no `adminAvancarFase`) **já está
aplicada**, por isso não está aqui. Estes são os que faltam por causa do novo estado
`bracketLocked` e do segundo botão de admin.

### Diff A — `resolvePrev` à prova de `null` (CRÍTICO)
No fluxo real, `previsoes-resolver` passa a devolver `resolved:null` (só bloqueia).
O código atual faz `data.prev.resolved.score` e rebenta. Substitui a função inteira:

```js
const resolvePrev = async () => {
  if (!prev.fin || prev.resolved || prev.bracketLocked || !prev.bracket) return;
  const { data, message } = await invokeFn("previsoes-resolver", { qf: prev.qf, sf: prev.sf, fin: prev.fin }, "Não foi possível fechar as eliminatórias. Tenta novamente.");
  if (message) { setToast(message); setTimeout(() => setToast(null), 2800); return; }
  setPrev(data.prev);
  if (data.prev.resolved) {
    const score = data.prev.resolved.score;
    playFx(score >= 130 ? "lendaria" : score >= 80 ? "epica" : "rara", muted);
  } else {
    playFx("flip", muted); // modo real: ficou bloqueada, aguarda admin
  }
};
```

### Diff B — `tie(...)` desativa também quando bracketLocked
Dentro da função `tie`, no `<button ... disabled={!!prev.resolved}>`, troca por:

```js
disabled={!!prev.resolved || !!prev.bracketLocked}
```

### Diff C — secção 4 (eliminatórias normais): esconder submit quando bloqueado + mensagem 🔒
Localiza, na secção `4 · ELIMINATÓRIAS`, este bloco:

```jsx
{prev.fin && !prev.resolved && (
  <div style={{ textAlign: "center", marginTop: 18 }}>
    <button onClick={resolvePrev} style={{ ...btn(true), fontSize: 13, padding: "13px 26px" }}>
      {ligaConfig?.modo === "real" ? "✓ Validar previsões com resultados reais" : "▶ Simular eliminatórias"}
    </button>
    <div style={{ fontSize: 11.5, color: "#6f87a8", marginTop: 8 }}>
      {ligaConfig?.modo === "real"
        ? "Os resultados reais das eliminatórias vão pontuar as tuas previsões."
        : `Previsão completa: ${teamOf(prev.fin)?.name ?? prev.fin} campeão. Vê como correu jogo a jogo.`}
    </div>
  </div>
)}
```

Substitui-o por (adiciona o `&& !prev.bracketLocked` e o novo ramo 🔒):

```jsx
{prev.fin && !prev.resolved && !prev.bracketLocked && (
  <div style={{ textAlign: "center", marginTop: 18 }}>
    <button onClick={resolvePrev} style={{ ...btn(true), fontSize: 13, padding: "13px 26px" }}>
      {ligaConfig?.modo === "real" ? "🔒 Fechar previsão das eliminatórias" : "▶ Simular eliminatórias"}
    </button>
    <div style={{ fontSize: 11.5, color: "#6f87a8", marginTop: 8 }}>
      {ligaConfig?.modo === "real"
        ? "As tuas escolhas ficam fixas. O admin pontua quando a eliminatória terminar."
        : `Previsão completa: ${teamOf(prev.fin)?.name ?? prev.fin} campeão. Vê como correu jogo a jogo.`}
    </div>
  </div>
)}
{prev.bracketLocked && !prev.resolved && (
  <div style={{ marginTop: 16, fontSize: 13, color: "#9FB0C8", background: "#0B1226", border: "1px solid #F2C14E44", borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
    🔒 Previsão das eliminatórias fechada — aguarda que o admin valide com os resultados reais.
  </div>
)}
```

> (Opcional) Há um bloco de submit igual na secção das Finals/skipGroups
> (`✓ Fechar previsões`). Se usares esse caminho (late-joiners/Finals), aplica-lhe
> a mesma lógica `&& !prev.bracketLocked` + mensagem.

### Diff D — segundo botão de admin: "Avaliar #1 (revelar grupos)"
Na tab Competição, no bloco de admin do Ranking, já tens o botão
"🏆 Validar previsões de todos" (esse é o **Avaliar #2**, mantém-no).
Adiciona ANTES dele o **Avaliar #1**:

```jsx
<button onClick={async () => {
  const { data, message } = await invokeFn("previsoes-revelar-grupos", {}, "Erro ao revelar grupos.");
  if (message) { setToast(message); setTimeout(() => setToast(null), 3000); }
  else setToast(`✓ Grupos revelados: ${data.revealed} jogadores pontuados nos apurados.`);
  setTimeout(() => setToast(null), 4000);
}} style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 1, padding: "6px 12px", borderRadius: 99, cursor: "pointer", background: "transparent", border: "1px dashed #39E6FF88", color: "#39E6FF" }}>
  🔓 Revelar grupos & pontuar apurados (admin)
</button>
```

Ordem de uso pelo admin: **🔓 Revelar grupos** (depois dos grupos) → mais tarde
**🏆 Validar previsões** (depois da eliminatória).

---

## Notas
- `EMPTY_PREV` não precisa de alteração: `bracketLocked` ausente é `undefined` (falsy)
  e o `clearPrev()` repõe corretamente.
- Em modo **simulação**, tudo continua a revelar de imediato (sem os 🔒) — só o modo
  **real** usa o fluxo de 2 momentos.
- Os pontos: apurado +10 · QF +10 · MF +15 · campeão +50. Pack Base 80+, Pack Finals 130+.
