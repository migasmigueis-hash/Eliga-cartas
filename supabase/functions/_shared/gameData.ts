// supabase/functions/_shared/gameData.ts
//
// Réplica, em Deno/TypeScript, da lógica de "abrir pack" que existe em
// src/App.jsx (RARITY, PACKS, PACK_ODDS, rollRarity, randomOfRarity, drawPack).
// Mantém isto em sincronia se essas regras mudarem no cliente.

import { CARD_POOL, type CardRef, type Rarity } from "./cardpool.ts";

export { CARD_POOL };
export type { CardRef, Rarity };


export const RARITY_ORDER: Record<Rarity, number> = { comum: 0, rara: 1, epica: 2, lendaria: 3 };

// mantém em sincronia com RARITY_UP / RARITY (label) em src/App.jsx
export const RARITY_UP: Record<string, Rarity> = { comum: "rara", rara: "epica", epica: "lendaria" };
export const RARITY_LABEL: Record<Rarity, string> = { comum: "Comum", rara: "Rara", epica: "Épica", lendaria: "Lendária" };

export const TRADE_COST = 10; // duplicados -> 1 carta aleatória da raridade acima
export const TRADE_DIRECT = 25; // duplicados -> escolher a carta exata da raridade acima

// nº de duplicados (cópias além da 1ª) de uma raridade
export function duplicatesOf(rarity: Rarity, collection: Record<string, number>): number {
  return CARD_POOL.filter((c) => c.rarity === rarity).reduce((s, c) => s + Math.max(0, (collection[c.id] || 0) - 1), 0);
}

// escolhe quais duplicados consumir (mesma lógica que existia no cliente):
// vai sempre à carta com mais cópias primeiro
export function pickDuplicates(rarity: Rarity, collection: Record<string, number>, n: number): Record<string, number> {
  const picks: Record<string, number> = {};
  const temp = { ...collection };
  let remaining = n;
  while (remaining > 0) {
    const candidates = CARD_POOL
      .filter((c) => c.rarity === rarity && (temp[c.id] || 0) > 1)
      .sort((a, b) => (temp[b.id] || 0) - (temp[a.id] || 0));
    if (!candidates.length) break;
    const id = candidates[0].id;
    temp[id]--;
    picks[id] = (picks[id] || 0) + 1;
    remaining--;
  }
  return picks;
}


export interface PackDef {
  id: string;
  name: string;
  locked: boolean;
  specialBoost: 0 | 1;
  twitchCost?: number;
}

// mantém os ids/nomes/locked/specialBoost/twitchCost em sincronia com PACKS em src/App.jsx
export const PACKS: PackDef[] = [
  { id: "base", name: "Pack Base", locked: false, specialBoost: 0, twitchCost: 50 },
  { id: "finals", name: "Pack Finals 25/26", locked: false, specialBoost: 1, twitchCost: 150 },
  { id: "etapa1", name: "Pack Etapa 1 · 26/27", locked: true, specialBoost: 0 },
  { id: "taca", name: "Pack Taça eLiga 26/27", locked: true, specialBoost: 0 },
];


// mantém em sincronia com PACK_ODDS em src/App.jsx
export const PACK_ODDS: Record<0 | 1, Array<[Rarity, number]>> = {
  0: [["comum", 76], ["rara", 20], ["epica", 3], ["lendaria", 1]],
  1: [["comum", 52], ["rara", 35], ["epica", 10], ["lendaria", 3]],
};

export function rollRarity(boost: 0 | 1): Rarity {
  let r = Math.random() * 100;
  for (const [k, w] of PACK_ODDS[boost]) {
    if ((r -= w) <= 0) return k;
  }
  return "comum";
}

export function randomOfRarity(rarity: Rarity, preferSpecial: boolean): CardRef {
  let candidates = CARD_POOL.filter((c) => c.rarity === rarity);
  if (preferSpecial && (rarity === "epica" || rarity === "lendaria")) {
    const specials = candidates.filter((c) => c.edition);
    if (specials.length && Math.random() < 0.65) candidates = specials;
  } else if (!preferSpecial) {
    const nonSpecial = candidates.filter((c) => !c.edition);
    if (nonSpecial.length && Math.random() < 0.8) candidates = nonSpecial;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function drawPack(pack: PackDef): CardRef[] {
  const cards = [0, 1, 2].map(() => randomOfRarity(rollRarity(pack.specialBoost), !!pack.specialBoost));
  return cards.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
}

export function hasEpicPlus(cards: CardRef[]): boolean {
  return cards.some((c) => c.rarity === "epica" || c.rarity === "lendaria");
}

// ---------- Escolhas (Wonder Pick) ----------
// mantém em sincronia com PICK_SLOT_MS / mulberry32 / buildPickBoard em src/App.jsx
export const PICK_SLOT_MS = 6 * 3600 * 1000;

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildPickBoard(seed: number, premium = false): CardRef[] {
  const rnd = mulberry32(seed);
  const pickRar = (): Rarity => {
    const r = rnd() * 100;
    return premium
      ? (r < 55 ? "rara" : r < 87 ? "epica" : "lendaria")
      : (r < 55 ? "comum" : r < 85 ? "rara" : r < 96 ? "epica" : "lendaria");
  };
  const board: CardRef[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (board.length < 5 && guard++ < 300) {
    const cands = CARD_POOL.filter((c) => c.rarity === pickRar() && !used.has(c.id));
    if (!cands.length) continue;
    const c = cands[Math.floor(rnd() * cands.length)];
    used.add(c.id);
    board.push(c);
  }
  return board;
}


export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ids dos objetivos cuja recompensa é em Escolhas, e quantas Escolhas dão —
// mantém em sincronia com buildObjectives() em src/App.jsx (campo "reward":
// "escolhaN"). Usado por claim-objective para validar o pedido.
export const OBJECTIVE_ESCOLHA_REWARDS: Record<string, number> = {
  "s-login5": 2,
  "s-packs10": 2,
  "p-streak14": 3,
  "p-col15": 1,
  "p-col30": 2,
  "p-col45": 3,
};

// mantém em sincronia com REDEEM_CODES em src/App.jsx
export interface RedeemEntry {
  pack?: string;
  escolhas?: number;
}
export const REDEEM_CODES: Record<string, RedeemEntry> = {
  "ELIGA2026": { pack: "base" },
  "BEMVINDO": { pack: "base" },
  "FINALS25": { pack: "finals" },
  "TWITCHDROP": { pack: "finals" },
  "ESCOLHAS10": { escolhas: 10 },
};

export interface PackOpeningResult {
  collection: Record<string, number>;
  meta: Record<string, unknown>;
  hist: unknown[];
  cardIds: string[];
}

// lógica completa de "abrir pack" (sorteio + garantia/pity + atualização de
// coleção/meta/histórico), partilhada entre as Edge Functions open-pack e
// redeem-code. Não escreve na base de dados — só calcula o novo estado.
export function applyPackOpening(state: Record<string, unknown>, pack: PackDef): PackOpeningResult {
  const collection: Record<string, number> = { ...((state.collection as Record<string, number>) ?? {}) };
  const prevMeta = (state.meta as Record<string, unknown>) ?? {};
  const meta: Record<string, unknown> = {
    ...prevMeta,
    packs: { ...((prevMeta.packs as Record<string, number>) ?? {}) },
  };
  const hist: unknown[] = Array.isArray(state.hist) ? [...(state.hist as unknown[])] : [];

  let cards: CardRef[] = drawPack(pack);
  const pity = (meta.pity as number) || 0;
  if (!hasEpicPlus(cards) && pity + 1 >= 10) {
    const rar = Math.random() < 0.12 ? "lendaria" : "epica";
    cards[2] = randomOfRarity(rar, !!pack.specialBoost);
    cards = [...cards].sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
  }
  const resetPity = hasEpicPlus(cards);

  cards.forEach((c) => {
    collection[c.id] = (collection[c.id] || 0) + 1;
  });
  meta.pity = resetPity ? 0 : pity + 1;
  const today = todayStr();
  const packsByDay = meta.packs as Record<string, number>;
  packsByDay[today] = (packsByDay[today] || 0) + 1;

  hist.unshift({ t: Date.now(), pack: pack.name, ids: cards.map((c) => c.id) });

  return { collection, meta, hist: hist.slice(0, 50), cardIds: cards.map((c) => c.id) };
}

