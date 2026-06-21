// supabase/functions/play-jornada/index.ts v2
// Modo real: lê resultados reais e calcula pontos. Guard de "já jogaste" para
// grupos E eliminatórias.
// body: { lineup: [string,string,string], captain: 0|1|2 }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { JORNADA_CARDS, scoreLineup, type ScoreRow, effectOf } from "../_shared/jornadaScore.ts";

const SCORE_REAL = { vit: 20, emp: 8, der: 3, golo: 2 };

interface RealMatch {
  teamA: string; playerA: string; golosA: number;
  teamB: string; playerB: string; golosB: number;
}

function scoreRealCard(cardId: string, allMatches: RealMatch[]): ScoreRow {
  const card = JORNADA_CARDS.find((c) => c.id === cardId)!;
  if (card.isCaster) {
    return { cardId, captain: false, synergy: 0, perf: { vit: 0, emp: 0, der: 0, golos: 0, jogos: 0, games: [] }, base: 0, bonus: 0, fx: effectOf(card), subtotal: 0 };
  }
  const lookupId = card.isClub
    ? card.team
    : ((card as unknown as { ref?: string }).ref ? `pl-${(card as unknown as { ref: string }).ref}` : cardId);
  const myMatches = card.isClub
    ? allMatches.filter((m) => m.teamA === lookupId || m.teamB === lookupId)
    : allMatches.filter((m) => m.playerA === lookupId || m.playerB === lookupId);

  let vit = 0, emp = 0, der = 0, golos = 0;
  const games: { opp: string; oppRank: number; res: "V" | "E" | "D"; g: number; og: number }[] = [];
  for (const m of myMatches) {
    const isA = card.isClub ? m.teamA === lookupId : m.playerA === lookupId;
    const g = isA ? m.golosA : m.golosB;
    const og = isA ? m.golosB : m.golosA;
    const diff = g - og;
    const res: "V" | "E" | "D" = diff > 0 ? "V" : diff === 0 ? "E" : "D";
    if (res === "V") vit++; else if (res === "E") emp++; else der++;
    if (!card.isClub) golos += g;
    games.push({ opp: isA ? m.teamB : m.teamA, oppRank: 9, res, g, og });
  }
  const base = card.isClub
    ? vit * SCORE_REAL.vit + emp * SCORE_REAL.emp + der * SCORE_REAL.der
    : vit * SCORE_REAL.vit + emp * SCORE_REAL.emp + der * SCORE_REAL.der + golos * SCORE_REAL.golo;
  return { cardId, captain: false, synergy: 0, perf: { vit, emp, der, golos, jogos: games.length, games }, base, bonus: 0, fx: effectOf(card), subtotal: base };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { lineup?: unknown; captain?: unknown };
  try { body = await req.json(); } catch { return jsonResponse({ error: "Pedido inválido." }, 400); }

  const lineup = body.lineup;
  const captain = body.captain;
  if (!Array.isArray(lineup) || lineup.length !== 3 || lineup.some((id) => typeof id !== "string"))
    return jsonResponse({ error: "Equipa inválida." }, 400);
  if (typeof captain !== "number" || ![0, 1, 2].includes(captain))
    return jsonResponse({ error: "Capitão inválido." }, 400);

  const cards = (lineup as string[]).map((id) => JORNADA_CARDS.find((c) => c.id === id));
  if (cards.some((c) => !c)) return jsonResponse({ error: "Carta desconhecida na equipa." }, 400);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const [profileRes, configRes] = await Promise.all([
    admin.from("profiles").select("state").eq("id", userId).single(),
    admin.from("liga_data").select("data").eq("key", "config").single(),
  ]);
  if (profileRes.error || !profileRes.data) return jsonResponse({ error: "Perfil não encontrado." }, 404);
  const state = (profileRes.data.state ?? {}) as Record<string, unknown>;
  const collection = (state.collection as Record<string, number>) ?? {};
  for (const id of lineup as string[]) {
    if (!(collection[id] > 0)) return jsonResponse({ error: "Não tens essa carta na coleção." }, 400);
  }

  const config = (configRes.data?.data ?? { modo: "simulacao", etapa: 1, fase: "grupos", grupo: "A" }) as {
    modo: string; etapa: number | string; fase: string; grupo?: string;
  };

  if (config.modo === "real" && config.fase === "grupos") {
    const jHist = Array.isArray(state.jHist) ? state.jHist as Record<string, unknown>[] : [];
    const jaJogou = jHist.some((j) => String(j.etapa) === String(config.etapa) && j.grupo === config.grupo && j.fase === config.fase && j.modo !== "simulacao_fallback");
    if (jaJogou) return jsonResponse({ error: `Já jogaste o Grupo ${config.grupo} da Etapa ${config.etapa}.` }, 400);
  }
  if (config.modo === "real" && config.fase === "eliminatorias") {
    const jHist = Array.isArray(state.jHist) ? state.jHist as Record<string, unknown>[] : [];
    const jaJogou = jHist.some((j) => String(j.etapa) === String(config.etapa) && j.fase === "eliminatorias" && j.modo !== "simulacao_fallback");
    if (jaJogou) return jsonResponse({ error: `Já jogaste as eliminatórias da ${config.etapa === "finals" ? "Finals" : `Etapa ${config.etapa}`}.` }, 400);
  }

  let rows: ScoreRow[];
  let total: number;
  const modoUsado = config.modo;

  if (config.modo === "real") {
    const etapaKey = config.etapa === "finals" ? "finals" : `etapa${config.etapa}`;

    if (config.fase === "grupos") {
      const grupoKey = config.grupo || "A";
      const grupoLabel = `grupo${grupoKey}`;
      const [, ...rondasRes] = await Promise.all([
        admin.from("liga_data").select("data").eq("key", `${etapaKey}_grupos`).single(),
        ...([1, 2, 3, 4, 5].map((r) => admin.from("liga_data").select("data").eq("key", `${etapaKey}_${grupoLabel}_ronda${r}`).single())),
      ]);
      let allMatches: RealMatch[] = [];
      for (const r of rondasRes) { if (r.data?.data) allMatches = allMatches.concat(r.data.data as RealMatch[]); }
      if (allMatches.length === 0) return jsonResponse({ error: `Dados do Grupo ${config.grupo} ainda não disponíveis. Contacta o admin para sincronizar.` }, 400);

      rows = (lineup as string[]).map((id, i) => { const r = scoreRealCard(id, allMatches); r.captain = i === captain; return r; });
      for (const r of rows) {
        const fx = r.fx;
        if (fx.tipo === "artilheiro") r.bonus = r.perf.golos * fx.mag;
        else if (fx.tipo === "vencedor") r.bonus = r.perf.vit * fx.mag;
        else if (fx.tipo === "consistente") r.bonus = Math.round((r.base * fx.mag) / 100);
        else if (fx.tipo === "imparavel") r.bonus = r.perf.vit >= 4 ? fx.mag : 0;
        else if (fx.tipo === "resiliente") r.bonus = r.perf.der * fx.mag;
        else if (fx.tipo === "cacagrandes") r.bonus = r.perf.games.filter((g) => g.res === "V").length * fx.mag;
        else if (fx.tipo === "vozdaliga") r.bonus = fx.mag;
        r.subtotal = r.base + r.bonus;
      }
      for (const r of rows) {
        const fx = r.fx;
        const card = JORNADA_CARDS.find((c) => c.id === r.cardId)!;
        if (fx.tipo === "clube") rows.forEach((o) => { if (o !== r && JORNADA_CARDS.find((c) => c.id === o.cardId)?.team === card.team) o.synergy += Math.round(((o.base + o.bonus) * fx.mag) / 100); });
        if (fx.tipo === "mentor") rows.forEach((o) => { if (o !== r) o.synergy += fx.mag; });
        if (fx.tipo === "fortaleza") { const ders = rows.reduce((s, o) => s + o.perf.der, 0); r.synergy += ders * fx.mag; }
        if (fx.tipo === "hype") { const cap = rows.find((o) => o.captain); if (cap && cap !== r) cap.synergy += Math.round(((cap.base + cap.bonus) * fx.mag) / 100); }
        if (fx.tipo === "analista") { const emps = rows.reduce((s, o) => s + o.perf.emp, 0); r.synergy += emps * fx.mag; }
      }
      rows.forEach((r) => { r.subtotal = (r.base + r.bonus + r.synergy) * (r.captain ? 2 : 1); });
      total = rows.reduce((s, r) => s + r.subtotal, 0);
    } else {
      let allMatches: RealMatch[] = [];
      if (etapaKey === "finals") {
        const { data: jogosRow } = await admin.from("liga_data").select("data").eq("key", "finals_jogos").maybeSingle();
        allMatches = (jogosRow?.data as RealMatch[]) ?? [];
      } else {
        const [qfRes, sfRes, finalRes] = await Promise.all([
          admin.from("liga_data").select("data").eq("key", `${etapaKey}_qf`).maybeSingle(),
          admin.from("liga_data").select("data").eq("key", `${etapaKey}_sf`).maybeSingle(),
          admin.from("liga_data").select("data").eq("key", `${etapaKey}_final`).maybeSingle(),
        ]);
        allMatches = [
          ...((qfRes.data?.data as RealMatch[]) ?? []),
          ...((sfRes.data?.data as RealMatch[]) ?? []),
          ...((finalRes.data?.data as RealMatch[]) ?? []),
        ];
      }
      if (allMatches.length === 0) return jsonResponse({ error: "Dados das eliminatórias ainda não disponíveis. Contacta o admin para sincronizar." }, 400);

      rows = (lineup as string[]).map((id, i) => { const r = scoreRealCard(id, allMatches); r.captain = i === captain; return r; });
      for (const r of rows) {
        const fx = r.fx;
        if (fx.tipo === "artilheiro") r.bonus = r.perf.golos * fx.mag;
        else if (fx.tipo === "vencedor") r.bonus = r.perf.vit * fx.mag;
        else if (fx.tipo === "consistente") r.bonus = Math.round((r.base * fx.mag) / 100);
        else if (fx.tipo === "imparavel") r.bonus = r.perf.vit >= 2 ? fx.mag : 0;
        else if (fx.tipo === "resiliente") r.bonus = r.perf.der * fx.mag;
        else if (fx.tipo === "vozdaliga") r.bonus = fx.mag;
        r.subtotal = r.base + r.bonus;
      }
      for (const r of rows) {
        const fx = r.fx;
        const card = JORNADA_CARDS.find((c) => c.id === r.cardId)!;
        if (fx.tipo === "clube") rows.forEach((o) => { if (o !== r && JORNADA_CARDS.find((c) => c.id === o.cardId)?.team === card.team) o.synergy += Math.round(((o.base + o.bonus) * fx.mag) / 100); });
        if (fx.tipo === "mentor") rows.forEach((o) => { if (o !== r) o.synergy += fx.mag; });
        if (fx.tipo === "hype") { const cap = rows.find((o) => o.captain); if (cap && cap !== r) cap.synergy += Math.round(((cap.base + cap.bonus) * fx.mag) / 100); }
        if (fx.tipo === "analista") { const emps = rows.reduce((s, o) => s + o.perf.emp, 0); r.synergy += emps * fx.mag; }
      }
      rows.forEach((r) => { r.subtotal = (r.base + r.bonus + r.synergy) * (r.captain ? 2 : 1); });
      total = rows.reduce((s, r) => s + r.subtotal, 0);
    }
  } else {
    const result = scoreLineup(cards as NonNullable<typeof cards[number]>[], captain as number);
    rows = result.rows; total = result.total;
  }

  const { data: lb, error: rpcErr } = await userClient.rpc("register_jornada", { p_points: total });
  if (rpcErr) return jsonResponse({ error: rpcErr.message }, 400);

  const jHist = Array.isArray(state.jHist) ? [...(state.jHist as unknown[])] : [];
  const jornadaNum = jHist.length + 1;
  const capCard = cards[captain as number]!;
  jHist.unshift({
    j: jornadaNum, t: Date.now(), total, modo: modoUsado,
    etapa: config.etapa, fase: config.fase, grupo: config.grupo,
    label: config.modo === "real"
      ? config.fase === "grupos"
        ? `${config.etapa === "finals" ? "Finals" : `Etapa ${config.etapa}`} · Grupo ${config.grupo}`
        : `${config.etapa === "finals" ? "Finals" : `Etapa ${config.etapa}`} · Eliminatórias`
      : `Jornada ${jornadaNum}`,
    cards: (cards as NonNullable<typeof cards[number]>[]).map((c) => c.name),
    cap: capCard.name, capRarity: capCard.rarity,
    hasCaster: (cards as NonNullable<typeof cards[number]>[]).some((c) => c.isCaster),
  });

  const newState = { ...state, jHist: jHist.slice(0, 50) };
  const { error: updErr } = await admin.from("profiles").update({ state: newState, updated_at: new Date().toISOString() }).eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ total, rows, jHist: newState.jHist, leaderboard: lb, j: jornadaNum, modo: modoUsado });
});
