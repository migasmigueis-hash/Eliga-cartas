# eLiga Cartas — Handoff de continuação

*Cola este documento como primeira mensagem numa conversa nova com o Claude, junto com o link do GitHub. Comunicação em PT-PT.*

## Estado atual
- **Repositório:** github.com/migasmigueis-hash/Eliga-cartas (ficheiro principal: `index.html` na raiz)
- **Deploy:** https://eligaportugal.vercel.app — ligado ao GitHub, deploy automático a cada `git push`
- **Ficheiro fonte de verdade:** um único `index.html` (~2640 linhas), React + Babel standalone via unpkg (sem build). O `App.jsx` interno gera-se removendo imports React e envolvendo no template HTML.
- **Fluxo de trabalho até agora:** Claude edita, gera `index.html`, utilizador descarrega → substitui na pasta local → `git add` / `commit` / `push` → Vercel atualiza sozinho.
- **Primeiro passo nesta nova conversa:** o Claude deve usar `web_fetch` em `https://raw.githubusercontent.com/migasmigueis-hash/Eliga-cartas/main/index.html` para obter o código atual e replicá-lo no seu ambiente de trabalho (`/home/claude/eliga-cartas/`) antes de fazer qualquer edição.

## Projeto: eLiga Cartas — jogo de coleção de cartas para a eLiga Portugal (FIFA/EA FC esports da Liga Portugal)
Utilizador comunica em PT-PT, por vezes no telemóvel. Época 25/26 terminou; nova época fev 2027.

## Dados reais (raspados de esports.ligaportugal.pt)
- LOGO_BASE: https://esports.ligaportugal.pt/images/teams/logos/ | PHOTO_BASE: .../teams/players/ | ELIGA_LOGO: .../images/logo@2x.png
- 18 clubes (TEAMS); 30 jogadores (PLAYERS) com fotos e stats 25/26 reais (j, v%, g, mg). Destaques: Leks 16J/87.5%/6.13; Luca-NR1 22J/130G.
- TEAM_RANK (Finals valem mais): 1 benfica, 2 santaclara, 3 estrela, 4 moreirense, 5 sporting, 6 afs, 7 arouca, 8 porto; 9-18 pela geral.

## Sistema de cartas — POOL = 71 cartas
- **Jogadores** (30): perfScore/totalScore → épica ≥75, rara ≥55; OVR clamp(62+s*0.33, 65, 93).
- **Clubes** (18): clubRarity por TEAM_RANK (1-2 épica, 3-8 rara), clubPower=92-(rank-1)*1.5, sem stats.
- **Casters** (6, categoria própria via CASTERS, sem stats de jogo): Don Pablo 88 épica, PickyWiky 87 épica "PIVOT", Dantas 86, Mucha 85, Zeny 84, Loureiro 83 (raras). Label PRO→CASTER/PIVOT; "🎙 {role} OFICIAL eLIGA"; arte = 🎙 + iniciais (photo: null — substituir quando houver ficheiros oficiais).
- **Especiais** (SPECIALS, ~17): Leks/MarQzou/Benfica FINALS 25/26 + Tundi TAÇA (lendárias); Leks+MarQzou E1, GugaFerraz E2, Gueric E3 + 3 clubes de etapa (épicas); 6 casters GRANDE FINAL via `casterRef` (épicas). OVR +2/+4; faixa horizontal opaca no topo com `edition`; **efeito sempre diferente da base** (fxTypeFor com offset por hash — ex: Leks ETAPA tem efeito distinto do Leks base).
- `cardIdentity(c)`: "club-team"/"cast-id"/"pl-id|ref" — versões do mesmo jogador/clube/caster partilham identidade (não podem coexistir na equipa de Competição nem na Vitrine).

## Efeitos (FX_MAG por raridade comum/rara/epica/lendaria)
- PLAYER_FX: artilheiro, vencedor, consistente, imparavel, resiliente, cacagrandes
- CLUB_FX: clube (Espírito), mentor, fortaleza
- CASTER_FX: hype (+% ao capitão), vozdaliga (pts fixos/jornada), analista (+pts por empate)

## Funcionalidades completas
1. **Login local** (pré-Supabase): contas em store wrapper (localStorage), pHash djb2, conta seed admin/admin, onboarding 3 passos.
2. **PWA**: manifest gerado em runtime via Blob (location.origin), meta tags Apple, viewport `maximum-scale=1.0`, CSS `input,select,textarea{font-size:16px!important}` (mata zoom iOS), `.apph{padding-top:calc(14px+env(safe-area-inset-top))}` em `@media (display-mode:standalone)`.
3. **Loja**: Pack Base (odds 76/20/3/1) e Finals (52/35/10/3); Etapa1/Taça bloqueados; Pack Admin (só admin). REDEEM_CODES: ELIGA2026/BEMVINDO=base, FINALS25/TWITCHDROP=finals, ESCOLHAS10=10 escolhas. Odds públicas (toggle "Ver probabilidades"). Painel GARANTIA pity X/10 (10º pack sem épica+ garante uma, 12% lendária). "Últimas aberturas" (50, em `hist`).
4. **Abertura de packs**: drag-to-tear com `tearProg` (pointer events), tampa OPACA + interior escuro revelado pelo `clipPath`, tesoura ✂️ segue o dedo, abre ≥92%. `packAway` anim (pack encolhe/cai) antes da 1ª carta. Flip com `effectOf` mostrado, badge **NOVA em slot fixo** acima da carta (corrigido: usa `isNew(idx)` = não tinha antes E primeira aparição no pack — duplicados no mesmo pack não duplicam o badge). Som WebAudio (`playFx`) + vibração (`buzz`), mute persistido. Showcase holográfico (`showcase={flipped}`) no flip.
5. **Trocas — 6 opções**: por raridade (comum/rara/épica), cada uma com 2 modos: **10 duplicados → 1 aleatória** acima (TRADE_COST) e **25 duplicados → 1 "à escolha"** (TRADE_DIRECT=25, modal `directTrade`/`directTradeGo`). Termo "à escolha" (não "dirigida"). Nunca perde última cópia.
6. **Objetivos**: diários (login=base, 3/5 packs=base/escolha2, 1 escolha=base, trivia integrada), semanais (5 logins=escolha2, 10 packs=escolha2, 3 trocas=finals, 5 escolhas=finals), permanentes (streak7/14, coleção 15/30/45=escolha1/2/3, 50/100 packs=finals, 1ª lendária=finals, 18 objetivos por clube=finals).
7. **Trivia diária**: 16 perguntas sobre época 25/26, `triviaOfDay()` por dia, acertar = **Pack Base** (não escolha), 1/dia em `meta.trivia`.
8. **Escolhas (Wonder Pick)**: **3 conjuntos normais** (`WonderBoard`, seed=`slot6h + picksBump*1000003 + i*7919`, odds 55/30/11/4) + **Conjunto Premium ★** (4º board, seed+777777, sem comuns: 55 rara/32 épica/13 lendária, custa 3 escolhas, estilo dourado). Fluxo: cartas viradas para baixo SEM glow → "Usar N Escolhas" → juntam-se ao centro em leque + wobble "A BARALHAR…" → separam viradas para baixo → escolha cega → revela todas (a tua com showcase+GANHASTE!). Uma escolha por conjunto/6h (`picksUsed` por `boardKey-i`/`boardKey-p`). 5 escolhas de oferta única (`esc-seed`), regeneração +1/6h (cap 8, `escSlot`), countdown. "↻ Regenerar (admin)" (`picksBump` global). Dot na tab = `anyBoardFree`.
9. **Competição**: 3 cartas + **capitão obrigatório** (×2, badge dourado, posicionado acima da faixa de edição se houver; botão "Tornar capitão"; simular bloqueado sem capitão). Seletor de carta por slot impede repetir `cardIdentity` (mesmo jogador/clube/caster) e tem filtro "🎙 Casters". Tabela de pontuação visível. `simulatePerformance` sorteia 2 adversários reais (winP ajustado por TEAM_RANK do oponente); casters não jogam (0 jogos, "🎙 Na cabine de comentário"). Resultado mostra "**Vitória 6–3** vs Nome Completo (top 8)" colorido (V verde/E amarelo/D vermelho) + sinergias (clube/mentor/fortaleza/hype/analista). Ranking global com 10 bots. **"As tuas jornadas"**: `jHist` (30 guardadas, 10 mostradas) com barra proporcional, cartas, capitão, hasCaster.
10. **Perfil** (tab): estatísticas (packs, trocas, escolhas, lendárias, streak via `calcStreak`, jornadas, melhor jornada, posição ranking); **vitrine** 3 cartas (`vitrinePick` modal, sem repetidos via `!vitrine.some(...)`, showcase, limpar slot); **14 conquistas** via `buildAchievements` (Primeiro Pack → Capitã Lendária), verde se `ok` / cinza se não.
11. **Coleção**: estados `search`+`sortBy` (Raridade/OVR/Nome/Clube), input 16px + select com ícone funil. **Modo álbum** quando filter="todas" + clubFilter="todos" + !search + sortBy="raridade": secções por clube (ClubLogo+nome+"got/total"+barra+"✓ COMPLETO" dourado se completo) + secções 🎙Casters e ✨Edições Especiais; senão grelha plana `filtered`. Filtros: todas/jogadores/clubes/casters/especiais + chip dropdown clube (com opção "🎙 Casters").
12. **Previsões** (tab, fluxo em 5 passos, estado `prev` = `{groups, qual, groupResult, bracket, qf[4], sf[2], fin, resolved, rewardClaimed}`, persistido `eliga-tcg-prev-`):
    1. **Sortear grupos** (🎲 3 grupos de 6, `drawGroups`)
    2. **Prever 8 apurados** (`toggleQual`, máx 3/grupo, contador por grupo e total)
    3. **"▶ Simular fase de grupos"** (`simulateGroups`) → calcula `realQual` (2 primeiros + 2 melhores terceiros, ponderado por `teamStrength`=19-TEAM_RANK) → mostra ✓/✗ + "PASSOU" nos que passaram sem aposta + "acertaste X/8 (+X0 pts)"
    4. **Sortear eliminatórias** (`drawBracket`, com os 8 **reais**, não os previstos)
    5. **Prever QF→SF→Final em cascata** (`pickQF`/`pickSF`/`pickFin`, mudar um pick limpa as rondas seguintes) → **"▶ Simular eliminatórias"** (`resolvePrev`) → resultado com breakdown (apurados+10/quartos+10/meias+15/campeão+50, máx 200) → **"🎁 Abrir recompensa"** por botão separado (80+=Pack Base, 130+=Pack Finals, `rewardClaimed`) → "↻ Nova previsão" (`clearPrev`).
13. **Partilha**: `cardToPng` (canvas 600×852, foto via proxy `images.weserv.nl` por CORS com fallback, `_wrapText` maxLines=2, role do caster no PNG); `packToPng` compõe N cartas lado a lado com cabeçalho. Partilha **só no resumo final** do pack (não na revelação carta-a-carta): botão por carta + "↗ Partilhar pack" conjunto. Zoom da coleção tem chip do efeito + legenda de stats + botões descarregar/partilhar.

## Notas técnicas críticas
- Edições via patches Python (`str.replace` com `assert` antes); grep âncoras antes de cortar (template literals com `}` enganam cortes por índice).
- Ordem real dos `tab ===` no JSX: loja → trocas → competicao → escolhas → previsoes → objetivos → colecao → perfil. Modais (no fim, antes do toast): pickSlot, directTrade, vitrinePick, onboard.
- Validação pós-edição: contagem chavetas/parênteses == 0.
- Regenerar `index.html` no fim com o template completo (PWA meta+manifest runtime+CSS 16px+maximum-scale).
- Storage keys: `eliga-tcg-{contas,sessao}`, `-col-`, `-meta-` (dias/packs/claims/pity/trocas/escUso/trivia), `-lineup-` ({ids,captain}), `-rank-global`, `-hist-`, `-codes-`, `-escolhas-`, `-esc-seed-`, `-esc-slot-`, `-picksused-`, `-picks-bump` (global), `-onboard-`, `-jhist-`, `-vitrine-`, `-prev-`, `-mute`.
- Imagens do site não carregam no preview claude.ai (CSP) — só em deploy real.
- `btn(primary)` helper de estilo; `FONT` = Chakra Petch; `RARITY`/`RARITY_UP` constantes.

## Plano de backend acordado (ainda não iniciado — guia entregue em `guia-backend-eliga-cartas.md`)
- **Fase 0**: converter para Vite+React (destranca env vars, autenticação). Repo já no GitHub, deploy automático já a funcionar.
- **Fase 1**: Supabase Auth (email/password) substitui o login local com pHash.
- **Fase 2**: tabelas Supabase (profiles, collection, lineup, predictions, history) substituem localStorage. RLS por utilizador.
- **Fase 3**: Edge Functions para ações sensíveis (abrir_pack, trocar, usar_escolha, simular_jornada, resolver_previsoes, resgatar_codigo) — anti-batota, remover "admin" hardcoded.
- **Fase 4**: ranking real, painel admin, Twitch OAuth (fica para depois).
- Custo: tudo no free tier do Supabase/Vercel para a escala atual (~100 jogadores e muito mais).

## Pendências / próximos passos combinados
- Utilizador vai fornecer fotos oficiais dos casters quando disponíveis (campo `photo` em `CASTERS`, mesma pasta do site dos jogadores).
- Avançar Fase 0 do backend quando o utilizador estiver pronto (tem Node 20+, VS Code, contas GitHub/Vercel/Supabase prontas).
