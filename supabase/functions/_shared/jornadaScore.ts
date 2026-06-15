// supabase/functions/_shared/jornadaScore.ts
//
// Réplica, em Deno/TypeScript, do motor de pontuação da "Competição"
// (src/App.jsx: hash, fxTypeFor, effectOf, SCORING, simulatePerformance,
// scoreLineup). Mantém isto em sincronia se essas regras mudarem no cliente.
//
// A única parte aleatória é simulatePerformance (resultados dos 2 jogos da
// jornada) — o resto é determinístico a partir da carta + desses resultados.

import type { Rarity } from "./cardpool.ts";
import { JORNADA_CARDS, type JornadaCard } from "./jornadaCards.ts";
import { JORNADA_TEAMS, TEAM_RANK } from "./jornadaTeams.ts";

export { JORNADA_CARDS, type JornadaCard };

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const PLAYER_FX = ["artilheiro", "vencedor", "consistente", "imparavel", "resiliente", "cacagrandes"];
const CLUB_FX = ["clube", "mentor", "fortaleza"];
const CASTER_FX = ["hype", "vozdaliga", "analista"];

// mantém em sincronia com FX_MAG em src/App.jsx
const FX_MAG: Record<Rarity, Record<string, number>> = {
  comum:    { artilheiro: 1, vencedor: 5,  consistente: 10,  imparavel: 8,  resiliente: 4,  cacagrandes: 6,  clube: 15,  mentor: 4,  fortaleza: 3,  hype: 10, vozdaliga: 8,  analista: 5 },
  rara:     { artilheiro: 2, vencedor: 10, consistente: 25,  imparavel: 16, resiliente: 8,  cacagrandes: 12, clube: 30,  mentor: 8,  fortaleza: 6,  hype: 20, vozdaliga: 15, analista: 10 },
  epica:    { artilheiro: 3, vencedor: 20, consistente: 50,  imparavel: 30, resiliente: 14, cacagrandes: 24, clube: 60,  mentor: 15, fortaleza: 10, hype: 40, vozdaliga: 30, analista: 18 },
  lendaria: { artilheiro: 5, vencedor: 35, consistente: 100, imparavel: 50, resiliente: 22, cacagrandes: 40, clube: 120, mentor: 25, fortaleza: 18, hype: 80, vozdaliga: 50, analista: 30 },
};

export function fxTypeFor(card: JornadaCard): string {
  const pool = card.isCaster ? CASTER_FX : card.isClub ? CLUB_FX : PLAYER_FX;
  const baseKey = card.isCaster
    ? "cast-" + (card.casterRef || card.id.replace("cast-", ""))
    : card.isClub ? "club-" + card.team : (card.ref ? "pl-" + card.ref : card.id);
  const baseIdx = hash(baseKey + "fx") % pool.length;
  if (!card.edition) return pool[baseIdx];
  const offset = 1 + (hash(card.id + "fx") % (pool.length - 1));
  return pool[(baseIdx + offset) % pool.length];
}

export interface Effect { tipo: string; mag: number }
export function effectOf(card: JornadaCard): Effect {
  const t = fxTypeFor(card);
  return { tipo: t, mag: FX_MAG[card.rarity][t] };
}

// mantém em sincronia com SCORING em src/App.jsx
export const SCORING = {
  jogador: { vit: 20, emp: 10, der: 2, golo: 3 },
  clube: { vit: 25, emp: 12, der: 5 },
};

export interface GameResult { opp: string; oppRank: number; res: "V" | "E" | "D"; g: number; og: number }
export interface Performance { vit: number; emp: number; der: number; golos: number; jogos: number; games: GameResult[] }

export function simulatePerformance(card: JornadaCard): Performance {
  // casters não jogam — o valor deles vem exclusivamente dos efeitos de apoio
  if (card.isCaster) return { vit: 0, emp: 0, der: 0, golos: 0, jogos: 0, games: [] };
  const winBase = Math.max(0.12, Math.min(0.88, (card.v || 35) / 100));
  const others = JORNADA_TEAMS.filter((t) => t.id !== card.team);
  let vit = 0, emp = 0, der = 0, golos = 0;
  const games: GameResult[] = [];
  for (let i = 0; i < 2; i++) {
    const opp = others[Math.floor(Math.random() * others.length)];
    const oppRank = TEAM_RANK[opp.id] || 18;
    const winP = Math.max(0.08, Math.min(0.92, winBase + (oppRank - 9.5) * 0.022));
    const r = Math.random();
    let res: "V" | "E" | "D";
    if (r < winP) { vit++; res = "V"; } else if (r < winP + 0.16) { emp++; res = "E"; } else { der++; res = "D"; }
    const g = Math.max(res === "V" ? 1 : 0, Math.round((card.mg || 4) + (Math.random() * 4 - 2)));
    let og: number;
    if (res === "V") og = Math.max(0, g - (1 + Math.floor(Math.random() * 3)));
    else if (res === "E") og = g;
    else og = g + 1 + Math.floor(Math.random() * 3);
    golos += g;
    games.push({ opp: opp.id, oppRank, res, g, og });
  }
  return { vit, emp, der, golos, jogos: 2, games };
}

export interface ScoreRow {
  cardId: string;
  perf: Performance;
  base: number;
  bonus: number;
  fx: Effect;
  synergy: number;
  captain: boolean;
  subtotal: number;
}
export interface ScoreResult { rows: ScoreRow[]; total: number }

export function scoreLineup(cards: JornadaCard[], captainIdx: number): ScoreResult {
  const rows = cards.map((card, i) => {
    const perf = simulatePerformance(card);
    const base = card.isClub
      ? perf.vit * SCORING.clube.vit + perf.emp * SCORING.clube.emp + perf.der * SCORING.clube.der
      : perf.vit * SCORING.jogador.vit + perf.emp * SCORING.jogador.emp + perf.der * SCORING.jogador.der + perf.golos * SCORING.jogador.golo;
    const fx = effectOf(card);
    let bonus = 0;
    if (fx.tipo === "artilheiro") bonus = perf.golos * fx.mag;
    if (fx.tipo === "vencedor") bonus = perf.vit * fx.mag;
    if (fx.tipo === "consistente") bonus = Math.round((base * fx.mag) / 100);
    if (fx.tipo === "imparavel") bonus = perf.vit === 2 ? fx.mag : 0;
    if (fx.tipo === "resiliente") bonus = perf.der * fx.mag;
    if (fx.tipo === "cacagrandes") bonus = perf.games.filter((g) => g.res === "V" && g.oppRank <= 8).length * fx.mag;
    if (fx.tipo === "vozdaliga") bonus = fx.mag;
    return { card, perf, base, bonus, fx, synergy: 0, captain: i === captainIdx, subtotal: 0 };
  });
  rows.forEach((r) => {
    if (r.fx.tipo === "clube") rows.forEach((o) => { if (o !== r && o.card.team === r.card.team) o.synergy += Math.round(((o.base + o.bonus) * r.fx.mag) / 100); });
    if (r.fx.tipo === "mentor") rows.forEach((o) => { if (o !== r) o.synergy += r.fx.mag; });
    if (r.fx.tipo === "fortaleza") { const ders = rows.reduce((s, o) => s + o.perf.der, 0); r.synergy += ders * r.fx.mag; }
    if (r.fx.tipo === "hype") {
      const cap = rows.find((o) => o.captain);
      if (cap && cap !== r) cap.synergy += Math.round(((cap.base + cap.bonus) * r.fx.mag) / 100);
    }
    if (r.fx.tipo === "analista") { const emps = rows.reduce((s, o) => s + o.perf.emp, 0); r.synergy += emps * r.fx.mag; }
  });
  rows.forEach((r) => {
    r.subtotal = r.base + r.bonus + r.synergy;
    if (r.captain) r.subtotal *= 2;
  });
  const total = rows.reduce((s, r) => s + r.subtotal, 0);
  return {
    rows: rows.map((r) => ({ cardId: r.card.id, perf: r.perf, base: r.base, bonus: r.bonus, fx: r.fx, synergy: r.synergy, captain: r.captain, subtotal: r.subtotal })),
    total,
  };
}
