// supabase/functions/_shared/previsoesEngine.ts
//
// Réplica, em Deno/TypeScript, da lógica de simulação de "Previsões"
// (src/App.jsx: teamStrength, simulateGroups, resolvePrev). A aleatoriedade
// (sorteio de grupos, resultados dos jogos) passa a correr aqui — no
// servidor — para que o jogador não possa fabricar os "resultados reais"
// contra os quais a sua previsão é avaliada.
//
// Mantém isto em sincronia se esta lógica mudar no cliente.

import { JORNADA_TEAMS, TEAM_RANK } from "./jornadaTeams.ts";

export const ALL_TEAM_IDS: string[] = JORNADA_TEAMS.map((t) => t.id);

export function teamStrength(id: string): number {
  return 19 - (TEAM_RANK[id] || 18);
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// sorteia as 18 equipas em 3 grupos de 6
export function drawGroups(): string[][] {
  const shuffled = shuffle(ALL_TEAM_IDS);
  return [shuffled.slice(0, 6), shuffled.slice(6, 12), shuffled.slice(12, 18)];
}

export interface GroupSimResult { realQual: string[]; bracket: string[] }

// classificações por grupo ponderadas pela força real; passam 2 primeiros +
// 2 melhores terceiros, e a bracket dos quartos sai já sorteada
export function simulateGroups(groups: string[][]): GroupSimResult {
  const standings = groups.map((g) => [...g].sort((a, b) => (teamStrength(b) + Math.random() * 10) - (teamStrength(a) + Math.random() * 10)));
  const thirds = standings.map((s) => s[2]);
  const bestThirds = [...thirds].sort((a, b) => (teamStrength(b) + Math.random() * 8) - (teamStrength(a) + Math.random() * 8)).slice(0, 2);
  const realQual = [...standings.flatMap((s) => s.slice(0, 2)), ...bestThirds];
  const bracket = shuffle(realQual);
  return { realQual, bracket };
}

export interface BracketResult { rqf: string[]; rsf: string[]; rchamp: string }

// resolve os confrontos da bracket (quartos -> meias -> final)
export function resolveBracket(bracket: string[]): BracketResult {
  const playTie = (a: string, b: string) => ((teamStrength(a) + Math.random() * 12) > (teamStrength(b) + Math.random() * 12) ? a : b);
  const rqf = [playTie(bracket[0], bracket[1]), playTie(bracket[2], bracket[3]), playTie(bracket[4], bracket[5]), playTie(bracket[6], bracket[7])];
  const rsf = [playTie(rqf[0], rqf[1]), playTie(rqf[2], rqf[3])];
  const rchamp = playTie(rsf[0], rsf[1]);
  return { rqf, rsf, rchamp };
}

// mantém em sincronia com resolvePrev em src/App.jsx
export function scoreToRewardPack(score: number): string | null {
  return score >= 130 ? "finals" : score >= 80 ? "base" : null;
}

export const EMPTY_PREV = {
  groups: null as string[][] | null,
  qual: [] as string[],
  groupResult: null as { realQual: string[]; qualHits: number } | null,
  bracket: null as string[] | null,
  qf: [null, null, null, null] as (string | null)[],
  sf: [null, null] as (string | null)[],
  fin: null as string | null,
  resolved: null as Record<string, unknown> | null,
  rewardClaimed: false,
};
