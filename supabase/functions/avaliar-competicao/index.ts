// supabase/functions/avaliar-competicao/index.ts  (NOVA — admin)
// Avalia a competição da fase atual: calcula pontos de cada compSubmit, grava jHist
// (com detalhe rows), soma ao ranking. Limpa compSubmit.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { JORNADA_CARDS, type ScoreRow, effectOf } from "../_shared/jornadaScore.ts";

const SCORE_REAL = { vit: 20, emp: 8, der: 3, golo: 2 };
interface RealMatch { teamA: string; playerA: string; golosA: number; teamB: string; playerB: string; golosB: number; }

function scoreRealCard(cardId: string, allMatches: RealMatch[]): ScoreRow {
  const card = JORNADA_CARDS.find((c) => c.id === cardId)!;
  if (card.isCaster) return { cardId, captain: false, synergy: 0, perf: { vit: 0, emp: 0, der: 0, golos: 0, jogos: 0, games: [] }, base: 0, bonus: 0, fx: effectOf(card), subtotal: 0 };
  const lookupId = card.isClub ? card.team : ((card as unknown as { ref?: string }).ref ? `pl-${(card as unknown as { ref: string }).ref}` : cardId);
  const myMatches = card.isClub ? allMatches.filter((m) => m.teamA === lookupId || m.teamB === lookupId) : allMatches.filter((m) => m.playerA === lookupId || m.playerB === lookupId);
  let vit = 0, emp = 0, der = 0, golos = 0;
  const games: { opp: string; oppRank: number; res: "V" | "E" | "D"; g: number; og: number }[] = [];
  for (const m of myMatches) {
    const isA = card.isClub ? m.teamA === lookupId : m.playerA === lookupId;
    const g = isA ? m.golosA : m.golosB, og = isA ? m.golosB : m.golosA, diff = g - og;
    const res: "V" | "E" | "D" = diff > 0 ? "V" : diff === 0 ? "E" : "D";
    if (res === "V") vit++; else if (res === "E") emp++; else der++;
    if (!card.isClub) golos += g;
    games.push({ opp: isA ? m.teamB : m.teamA, oppRank: 9, res, g, og });
  }
  const base = card.isClub ? vit * SCORE_REAL.vit + emp * SCORE_REAL.emp + der * SCORE_REAL.der
    : vit * SCORE_REAL.vit + emp * SCORE_REAL.emp + der * SCORE_REAL.der + golos * SCORE_REAL.golo;
  return { cardId, captain: false, synergy: 0, perf: { vit, emp, der, golos, jogos: games.length, games }, base, bonus: 0, fx: effectOf(card), subtotal: base };
}

function applyEffectsAndTotal(rows: ScoreRow[], isElim: boolean): number {
  for (const r of rows) {
    const fx = r.fx;
    if (fx.tipo === "artilheiro") r.bonus = r.perf.golos * fx.mag;
    else if (fx.tipo === "vencedor") r.bonus = r.perf.vit * fx.mag;
    else if (fx.tipo === "consistente") r.bonus = Math.round((r.base * fx.mag) / 100);
    else if (fx.tipo === "imparavel") r.bonus = r.perf.vit >= (isElim ? 2 : 4) ? fx.mag : 0;
    else if (fx.tipo === "resiliente") r.bonus = r.perf.der * fx.mag;
    else if (fx.tipo === "cacagrandes") r.bonus = r.perf.games.filter((g) => g.res === "V").length * fx.mag;
    else if (fx.tipo === "vozdaliga") r.bonus = fx.mag;
    r.subtotal = r.base + r.bonus;
  }
  for (const r of rows) {
    const fx = r.fx, card = JORNADA_CARDS.find((c) => c.id === r.cardId)!;
    if (fx.tipo === "clube") rows.forEach((o) => { if (o !== r && JORNADA_CARDS.find((c) => c.id === o.cardId)?.team === card.team) o.synergy += Math.round(((o.base + o.bonus) * fx.mag) / 100); });
    if (fx.tipo === "mentor") rows.forEach((o) => { if (o !== r) o.synergy += fx.mag; });
    if (fx.tipo === "fortaleza") { const ders = rows.reduce((s, o) => s + o.perf.der, 0); r.synergy += ders * fx.mag; }
    if (fx.tipo === "hype") { const cap = rows.find((o) => o.captain); if (cap && cap !== r) cap.synergy += Math.round(((cap.base + cap.bonus) * fx.mag) / 100); }
    if (fx.tipo === "analista") { const emps = rows.reduce((s, o) => s + o.perf.emp, 0); r.synergy += emps * fx.mag; }
  }
  rows.forEach((r) => { r.subtotal = (r.base + r.bonus + r.synergy) * (r.captain ? 2 : 1); });
  return rows.reduce((s, r) => s + r.subtotal, 0);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: adminProfile } = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!adminProfile?.is_admin) return jsonResponse({ error: "Sem permissão." }, 403);

  const { data: configRow } = await admin.from("liga_data").select("data").eq("key", "config").single();
  const config = (configRow?.data ?? { etapa: 1, fase: "grupos", grupo: "A" }) as { etapa: number | string; fase: string; grupo?: string };
  const etapaKey = config.etapa === "finals" ? "finals" : `etapa${config.etapa}`;
  const etapaLabel = config.etapa === "finals" ? "Finals" : `Etapa ${config.etapa}`;
  const isElim = config.fase !== "grupos";

  let allMatches: RealMatch[] = [];
  if (!isElim) {
    const grupoLabel = `grupo${config.grupo || "A"}`;
    const rondas = await Promise.all([1, 2, 3, 4, 5].map((r) => admin.from("liga_data").select("data").eq("key", `${etapaKey}_${grupoLabel}_ronda${r}`).maybeSingle()));
    for (const r of rondas) if (r.data?.data) allMatches = allMatches.concat(r.data.data as RealMatch[]);
    if (allMatches.length === 0) return jsonResponse({ error: `Dados do Grupo ${config.grupo || "A"} (${etapaLabel}) ainda não disponíveis. Sincroniza as rondas.` }, 400);
  } else {
    if (etapaKey === "finals") { const { data: jr } = await admin.from("liga_data").select("data").eq("key", "finals_jogos").maybeSingle(); allMatches = (jr?.data as RealMatch[]) ?? []; }
    else {
      const [qf, sf, fi] = await Promise.all([
        admin.from("liga_data").select("data").eq("key", `${etapaKey}_qf`).maybeSingle(),
        admin.from("liga_data").select("data").eq("key", `${etapaKey}_sf`).maybeSingle(),
        admin.from("liga_data").select("data").eq("key", `${etapaKey}_final`).maybeSingle(),
      ]);
      allMatches = [...((qf.data?.data as RealMatch[]) ?? []), ...((sf.data?.data as RealMatch[]) ?? []), ...((fi.data?.data as RealMatch[]) ?? [])];
    }
    if (allMatches.length === 0) return jsonResponse({ error: `Dados das eliminatórias (${etapaLabel}) ainda não disponíveis.` }, 400);
  }

  async function addEligaPoints(uname: string | null, uid: string, pts: number) {
    if (!uname || pts <= 0) return;
    const { data: row } = await admin.from("leaderboard").select("score, jornadas").eq("username", uname).maybeSingle();
    await admin.from("leaderboard").upsert({ username: uname, user_id: uid, score: ((row?.score as number) ?? 0) + pts, jornadas: ((row?.jornadas as number) ?? 0) + 1, updated_at: new Date().toISOString() }, { onConflict: "username" });
  }

  const { data: profiles } = await admin.from("profiles").select("id, state, username");
  let evaluated = 0, skipped = 0;
  for (const profile of profiles ?? []) {
    const state = (profile.state ?? {}) as Record<string, unknown>;
    const sub = (state.compSubmit ?? null) as Record<string, unknown> | null;
    if (!sub || !Array.isArray(sub.lineup) || typeof sub.captain !== "number") { skipped++; continue; }
    const matchFase = String(sub.etapa) === String(config.etapa) && (isElim ? sub.fase !== "grupos" : (sub.fase === "grupos" && (sub.grupo || "A") === (config.grupo || "A")));
    if (!matchFase) { skipped++; continue; }
    const lineup = sub.lineup as string[], captain = sub.captain as number;
    const cards = lineup.map((id) => JORNADA_CARDS.find((c) => c.id === id));
    if (cards.some((c) => !c)) { skipped++; continue; }

    const rows = lineup.map((id, i) => { const r = scoreRealCard(id, allMatches); r.captain = i === captain; return r; });
    const total = applyEffectsAndTotal(rows, isElim);

    const jHist = Array.isArray(state.jHist) ? [...(state.jHist as unknown[])] : [];
    const capCard = cards[captain]!;
    jHist.unshift({
      j: jHist.length + 1, t: Date.now(), total, modo: "real", etapa: config.etapa, fase: config.fase, grupo: sub.grupo ?? null,
      label: isElim ? `${etapaLabel} · Eliminatórias` : `${etapaLabel} · Grupo ${config.grupo || "A"}`,
      cards: cards.map((c) => c!.name), cap: capCard.name, capRarity: capCard.rarity, hasCaster: cards.some((c) => c!.isCaster), rows,
    });

    await admin.from("profiles").update({ state: { ...state, jHist: jHist.slice(0, 50), compSubmit: null }, updated_at: new Date().toISOString() }).eq("id", profile.id);
    await addEligaPoints((profile.username as string) ?? null, profile.id as string, total);
    evaluated++;
  }
  return jsonResponse({ ok: true, evaluated, skipped, etapa: config.etapa, fase: isElim ? "eliminatorias" : `grupo ${config.grupo || "A"}` });
});
