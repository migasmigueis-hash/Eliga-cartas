// supabase/functions/_shared/objectives.ts
//
// Réplica, em Deno/TypeScript, de buildObjectives (src/App.jsx): recalcula
// prog/alvo/recompensa de um objetivo a partir de profiles.state (meta +
// collection), para que claim-objective e open-pack (claim) possam confirmar
// que o objetivo está mesmo cumprido — em vez de confiarem no cliente.
//
// Mantém isto em sincronia com buildObjectives() em src/App.jsx.

import { CARD_POOL } from "./cardpool.ts";
import { JORNADA_TEAMS } from "./jornadaTeams.ts";

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// mesma fórmula ISO-8601 (semana começa à segunda) que o cliente usa
function weekKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}

function streakOf(dias: string[]): number {
  const set = new Set(dias);
  let s = 0;
  const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) {
    s++;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

export interface ObjectiveResult {
  tipo: "diario" | "semanal" | "permanente";
  periodo: string; // periodo atual esperado para este objetivo
  prog: number;
  alvo: number;
  reward: string; // "base" | "finals" | "escolha1" | "escolha2" | "escolha3"
}

// recalcula o objetivo "id" a partir do estado guardado; null se "id" for desconhecido
export function computeObjective(id: string, meta: Record<string, unknown>, collection: Record<string, number>): ObjectiveResult | null {
  const today = todayStr();
  const wk = weekKey(new Date(today + "T12:00:00"));

  const dias = (Array.isArray(meta.dias) ? meta.dias as string[] : []);
  const packs = (meta.packs as Record<string, number>) ?? {};
  const trocas = (meta.trocas as Record<string, number>) ?? {};
  const escUso = (meta.escUso as Record<string, number>) ?? {};

  const sumInWeek = (rec: Record<string, number>) =>
    Object.entries(rec).filter(([d]) => weekKey(new Date(d + "T12:00:00")) === wk).reduce((s, [, n]) => s + n, 0);

  const packsToday = packs[today] || 0;
  const packsWeek = sumInWeek(packs);
  const trocasWeek = sumInWeek(trocas);
  const escDia = escUso[today] || 0;
  const escWeek = sumInWeek(escUso);
  const streak = streakOf(dias);
  const inWeek = dias.filter((d) => weekKey(new Date(d + "T12:00:00")) === wk).length;
  const totalPacks = Object.values(packs).reduce((s, n) => s + n, 0);
  const temLendaria = CARD_POOL.some((c) => c.rarity === "lendaria" && (collection[c.id] || 0) > 0);
  const totalOwned = Object.keys(collection).filter((k) => (collection[k] || 0) > 0).length;

  switch (id) {
    case "d-login": return { tipo: "diario", periodo: today, prog: dias.includes(today) ? 1 : 0, alvo: 1, reward: "base" };
    case "d-packs3": return { tipo: "diario", periodo: today, prog: Math.min(3, packsToday), alvo: 3, reward: "base" };
    case "d-escolha1": return { tipo: "diario", periodo: today, prog: Math.min(1, escDia), alvo: 1, reward: "base" };
    case "d-packs5": return { tipo: "diario", periodo: today, prog: Math.min(5, packsToday), alvo: 5, reward: "base" };
    case "s-login5": return { tipo: "semanal", periodo: wk, prog: Math.min(5, inWeek), alvo: 5, reward: "escolha2" };
    case "s-packs10": return { tipo: "semanal", periodo: wk, prog: Math.min(10, packsWeek), alvo: 10, reward: "escolha2" };
    case "s-trocas3": return { tipo: "semanal", periodo: wk, prog: Math.min(3, trocasWeek), alvo: 3, reward: "finals" };
    case "s-esc5": return { tipo: "semanal", periodo: wk, prog: Math.min(5, escWeek), alvo: 5, reward: "finals" };
    case "p-streak7": return { tipo: "permanente", periodo: "perm", prog: Math.min(7, streak), alvo: 7, reward: "finals" };
    case "p-streak14": return { tipo: "permanente", periodo: "perm", prog: Math.min(14, streak), alvo: 14, reward: "escolha3" };
    case "p-packs50": return { tipo: "permanente", periodo: "perm", prog: Math.min(50, totalPacks), alvo: 50, reward: "finals" };
    case "p-packs100": return { tipo: "permanente", periodo: "perm", prog: Math.min(100, totalPacks), alvo: 100, reward: "finals" };
    case "p-lendaria": return { tipo: "permanente", periodo: "perm", prog: temLendaria ? 1 : 0, alvo: 1, reward: "finals" };
    case "p-col15": return { tipo: "permanente", periodo: "perm", prog: Math.min(15, totalOwned), alvo: 15, reward: "escolha1" };
    case "p-col30": return { tipo: "permanente", periodo: "perm", prog: Math.min(30, totalOwned), alvo: 30, reward: "escolha2" };
    case "p-col45": return { tipo: "permanente", periodo: "perm", prog: Math.min(45, totalOwned), alvo: 45, reward: "escolha3" };
  }

  if (id.startsWith("p-team-")) {
    const teamId = id.slice("p-team-".length);
    if (!JORNADA_TEAMS.some((t) => t.id === teamId)) return null;
    const cards = CARD_POOL.filter((c) => c.team === teamId && !c.edition);
    const got = cards.filter((c) => (collection[c.id] || 0) > 0).length;
    return { tipo: "permanente", periodo: "perm", prog: got, alvo: cards.length, reward: "finals" };
  }

  return null;
}

export type ObjectiveClaimResult = { ok: true; reward: string } | { ok: false; error: string };

// confirma que o objetivo "id" está cumprido AGORA para o "periodo" indicado,
// e que ainda não foi reclamado nesse período
export function validateObjectiveClaim(id: unknown, periodo: unknown, meta: Record<string, unknown>, collection: Record<string, number>): ObjectiveClaimResult {
  if (typeof id !== "string" || typeof periodo !== "string" || periodo.length > 20) {
    return { ok: false, error: "Pedido inválido." };
  }
  const obj = computeObjective(id, meta, collection);
  if (!obj) return { ok: false, error: "Objetivo desconhecido." };
  if (periodo !== obj.periodo) return { ok: false, error: "Este objetivo já não está disponível para este período." };
  if (obj.prog < obj.alvo) return { ok: false, error: "Ainda não cumpriste este objetivo." };
  const claims = (meta.claims as Record<string, string>) ?? {};
  if (claims[id] === periodo) return { ok: false, error: "Objetivo já reclamado." };
  return { ok: true, reward: obj.reward };
}
