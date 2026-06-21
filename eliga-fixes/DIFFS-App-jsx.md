# Alterações no src/App.jsx (aplica no teu editor)

Três funcionalidades:
1. Reabrir previsão (alterar + resubmeter) ATÉ ao prazo.
2. Corrigir o botão "Abrir Pack Base" da fase de grupos.
3. "Pontos eLiga" unificados + nova tab Ranking.

> Dica: usa Ctrl+F com o texto em **AntES** para localizar, e substitui pelo **DEPOIS**.

---

## 1) Reabrir previsão até ao prazo

### 1a. Adiciona 2 funções novas (logo a seguir a `claimGroupReward`)

Procura o fim da função `claimGroupReward` (termina com `if (!ok) setPrev((p) => ({ ...p, groupRewardClaimed: false }));` e `};`). Imediatamente A SEGUIR, cola:

```js
  const unlockGroups = async () => {
    if (grupoExpirado) { setToast("O prazo já terminou — não podes alterar."); setTimeout(() => setToast(null), 2600); return; }
    const { data, message } = await invokeFn("previsoes-desbloquear", { fase: "grupos" }, "Não foi possível reabrir a previsão.");
    if (message) { setToast(message); setTimeout(() => setToast(null), 2800); return; }
    setPrev(data.prev);
    playFx("flip", muted);
  };
  const unlockBracket = async () => {
    if (elimExpirado) { setToast("O prazo já terminou — não podes alterar."); setTimeout(() => setToast(null), 2600); return; }
    const { data, message } = await invokeFn("previsoes-desbloquear", { fase: "elim" }, "Não foi possível reabrir a previsão.");
    if (message) { setToast(message); setTimeout(() => setToast(null), 2800); return; }
    setPrev(data.prev);
    playFx("flip", muted);
  };
```

### 1b. Bloco "🔒 Previsão dos apurados fechada" → adiciona botão Alterar

ANTES:
```jsx
                  ) : prev.groupResult?.locked ? (
                    <div style={{ marginTop: 16, fontSize: 13, color: "#9FB0C8", background: "#0B1226", border: "1px solid #F2C14E44", borderRadius: 12, padding: "12px 16px" }}>
                      🔒 Previsão fechada — aguarda que o admin revele os resultados da fase de grupos.
                    </div>
                  ) : (
```
DEPOIS:
```jsx
                  ) : prev.groupResult?.locked ? (
                    <div style={{ marginTop: 16, fontSize: 13, color: "#9FB0C8", background: "#0B1226", border: "1px solid #F2C14E44", borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
                      🔒 Previsão dos apurados fechada{grupoExpirado ? " — o prazo terminou, já não podes alterar." : ". Aguarda que o admin revele os resultados."}
                      {!grupoExpirado && (
                        <div style={{ marginTop: 10 }}>
                          <button onClick={unlockGroups} style={{ ...btn(false), fontSize: 12, padding: "8px 16px" }}>✏️ Alterar previsão</button>
                          {prazoGruposMs != null && <div style={{ fontSize: 11, color: "#6f87a8", marginTop: 6 }}>Podes alterar até {fmtPrazo(prazoGruposMs)} (faltam {fmtRestante(prazoGruposMs)}).</div>}
                        </div>
                      )}
                    </div>
                  ) : (
```

### 1c. Bloco "🔒 Previsão fechada" (caminho Finals/skipGroups) → botão Alterar

ANTES:
```jsx
                    {prev.bracketLocked && !prev.resolved && (
                      <div style={{ marginTop: 16, fontSize: 13, color: "#9FB0C8", background: "#0B1226", border: "1px solid #F2C14E44", borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
                        🔒 Previsão fechada — aguarda que o admin valide com os resultados reais.
                      </div>
                    )}
```
DEPOIS:
```jsx
                    {prev.bracketLocked && !prev.resolved && (
                      <div style={{ marginTop: 16, fontSize: 13, color: "#9FB0C8", background: "#0B1226", border: "1px solid #F2C14E44", borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
                        🔒 Previsão fechada{elimExpirado ? " — o prazo terminou, já não podes alterar." : " — aguarda a validação do admin."}
                        {!elimExpirado && (
                          <div style={{ marginTop: 10 }}>
                            <button onClick={unlockBracket} style={{ ...btn(false), fontSize: 12, padding: "8px 16px" }}>✏️ Alterar previsão</button>
                            {prazoElimMs != null && <div style={{ fontSize: 11, color: "#6f87a8", marginTop: 6 }}>Podes alterar até {fmtPrazo(prazoElimMs)} (faltam {fmtRestante(prazoElimMs)}).</div>}
                          </div>
                        )}
                      </div>
                    )}
```

### 1d. Bloco "🔒 Previsão das eliminatórias fechada" (secção 4) → botão Alterar

ANTES:
```jsx
                    {prev.bracketLocked && !prev.resolved && (
                      <div style={{ marginTop: 16, fontSize: 13, color: "#9FB0C8", background: "#0B1226", border: "1px solid #F2C14E44", borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
                        🔒 Previsão das eliminatórias fechada — aguarda que o admin valide com os resultados reais.
                      </div>
                    )}
```
DEPOIS:
```jsx
                    {prev.bracketLocked && !prev.resolved && (
                      <div style={{ marginTop: 16, fontSize: 13, color: "#9FB0C8", background: "#0B1226", border: "1px solid #F2C14E44", borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
                        🔒 Previsão das eliminatórias fechada{elimExpirado ? " — o prazo terminou, já não podes alterar." : " — aguarda a validação do admin."}
                        {!elimExpirado && (
                          <div style={{ marginTop: 10 }}>
                            <button onClick={unlockBracket} style={{ ...btn(false), fontSize: 12, padding: "8px 16px" }}>✏️ Alterar previsão</button>
                            {prazoElimMs != null && <div style={{ fontSize: 11, color: "#6f87a8", marginTop: 6 }}>Podes alterar até {fmtPrazo(prazoElimMs)} (faltam {fmtRestante(prazoElimMs)}).</div>}
                          </div>
                        )}
                      </div>
                    )}
```

> Nota: o caso "não podes alterar se ainda não fechaste E o prazo passou" já está coberto —
> `toggleQual`/`pickQF/SF/Fin` e os botões de submeter já verificam `grupoExpirado`/`elimExpirado`.

---

## 2) Corrigir o botão "Abrir Pack Base" (fase de grupos)

Substitui a função `claimGroupReward` inteira.

ANTES:
```js
  const claimGroupReward = async () => {
    if (!prev.groupReward || !prev.groupReward.pack || prev.groupRewardClaimed) return;
    setPrev((p) => ({ ...p, groupRewardClaimed: true }));
    const ok = await openPack(PACKS.find((pk) => pk.id === prev.groupReward.pack) || PACKS[0], null, { prevReward: true });
    if (!ok) setPrev((p) => ({ ...p, groupRewardClaimed: false }));
  };
```
DEPOIS:
```js
  const claimGroupReward = async () => {
    if (!prev.groupReward || !prev.groupReward.pack || prev.groupRewardClaimed) return;
    const ownedBefore = new Set(Object.keys(collection).filter((k) => collection[k] > 0));
    const { data, message } = await invokeFn("previsoes-abrir-pack-grupos", {}, "Não foi possível abrir o pack. Tenta novamente.");
    if (message) { setToast(message); setTimeout(() => setToast(null), 2600); return; }
    setPrev((p) => ({ ...p, groupRewardClaimed: true }));
    const cards = data.cardIds.map((id) => POOL.find((c) => c.id === id)).filter(Boolean);
    setCollection(data.collection);
    setMeta(data.meta);
    setHist(data.hist);
    const pack = PACKS.find((pk) => pk.id === prev.groupReward.pack) || PACKS[0];
    setOpening({ pack, cards, ownedBefore, initialPhase: "pack", again: null });
  };
```

---

## 3) "Pontos eLiga" + nova tab Ranking

O servidor (previsoes-avaliar v3) já soma os pontos das previsões ao mesmo ranking
da Competição. Falta só mostrar o ranking numa tab própria.

### 3a. Adiciona um helper de refresh (logo a seguir a `clearPrev`)

Procura `const clearPrev = () => setPrev(EMPTY_PREV);` e A SEGUIR cola:
```js
  const refreshRanking = async () => {
    const { data: lb, error } = await supabase.from("leaderboard").select("username, score, jornadas").order("score", { ascending: false });
    if (!error && lb) {
      const scores = {}, jornadasMap = {};
      lb.forEach((r) => { scores[r.username] = r.score; jornadasMap[r.username] = r.jornadas; });
      setRank({ scores, jornadas: jornadasMap });
    }
  };
```

### 3b. Atualiza o ranking ao abrir a tab (adiciona um useEffect)

Procura o `useEffect` da "regeneração passiva" (tem o comentário
`// regeneração passiva: +1 Escolha a cada 6 horas`). Logo A SEGUIR ao fecho desse
`useEffect` (`}, [pickSlotNow, escSlot, username]);`), cola:
```js
  // atualizar o ranking ao abrir a tab Ranking
  useEffect(() => {
    if (tab !== "ranking" || !username) return;
    refreshRanking();
  }, [tab, username]);
```

### 3c. Adiciona o item de navegação "Ranking"

Procura na lista de navegação:
```jsx
            { k: "previsoes", label: "Previsões" },
```
e adiciona LOGO A SEGUIR:
```jsx
            { k: "ranking", label: "Ranking" },
```

### 3d. Adiciona a tab Ranking

Procura `{tab === "objetivos" && (` e cola TODO este bloco IMEDIATAMENTE ANTES:
```jsx
      {tab === "ranking" && (
        <main style={{ maxWidth: 760, margin: "0 auto", padding: "36px 20px 80px" }}>
          <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, margin: 0 }}>Ranking eLiga</h1>
          <p style={{ color: "#8fa3bd", fontSize: 14, marginTop: 6, maxWidth: 640 }}>
            Os <b style={{ color: "#1BF5A3" }}>pontos eLiga</b> juntam tudo: o que ganhas na <b>Competição</b> (jornadas) e nas <b>Previsões</b> (apurados, quartos, meias e campeão). Os pontos Twitch são um bónus à parte e <b>não</b> contam para este ranking.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={refreshRanking} style={{ ...btn(false), fontSize: 12, padding: "8px 16px" }}>↻ Atualizar</button>
          </div>
          {Object.keys(rank.scores).length === 0 ? (
            <div style={{ marginTop: 12, background: "#0E162E", border: "1px solid #22304d", borderRadius: 14, padding: "24px 20px", textAlign: "center", color: "#6f87a8", fontSize: 13 }}>
              Ainda não há pontos. Joga uma jornada na Competição ou faz uma previsão para entrares no ranking.
            </div>
          ) : (
            <div style={{ marginTop: 12, background: "#0E162E", border: "1px solid #22304d", borderRadius: 14, overflow: "hidden" }}>
              {Object.entries(rank.scores).sort((a, b) => b[1] - a[1]).map(([name, pts], i) => {
                const isMe = name === username;
                return (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: "1px solid #16203a", background: isMe ? "#1BF5A314" : "transparent" }}>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, width: 30, color: i === 0 ? "#F2C14E" : i === 1 ? "#c0cbd9" : i === 2 ? "#cd8f5a" : "#6f87a8" }}>{i + 1}º</span>
                    <span style={{ flex: 1, fontFamily: FONT, fontSize: 14, color: isMe ? "#1BF5A3" : "#E7EEF8", fontWeight: isMe ? 700 : 400 }}>{name}{isMe ? " (tu)" : ""}</span>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: "#fff" }}>{pts.toLocaleString("pt-PT")}</span>
                    <span style={{ fontFamily: FONT, fontSize: 11, color: "#6f87a8" }}>pontos eLiga</span>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}
```

### 3e. (Opcional) Na Competição, aponta para a tab Ranking

O ranking dentro da Competição continua a funcionar. Se quiseres evitar duplicação,
podes substituir o título "Ranking" lá por uma nota. Não é obrigatório.

---

## Deploy do back-end
```powershell
supabase functions deploy previsoes-avaliar previsoes-desbloquear previsoes-abrir-pack-grupos --use-api
```
(As funções novas usam `_shared/cors.ts` e `_shared/gameData.ts`, que já tens.)
