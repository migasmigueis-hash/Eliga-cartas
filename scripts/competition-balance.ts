import { JORNADA_CARDS, effectOf, scoreLineup, type JornadaCard, type ScoreRow } from "../supabase/functions/_shared/jornadaScore.ts";
import { JORNADA_TEAMS } from "../supabase/functions/_shared/jornadaTeams.ts";

function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function contribution(row: ScoreRow, rows: ScoreRow[], cards: JornadaCard[]): number {
  const card = cards.find((item) => item.id === row.cardId)!;
  const effect = row.fx;
  if (["artilheiro", "vencedor", "consistente", "imparavel", "resiliente", "cacagrandes", "vozdaliga"].includes(effect.tipo)) return row.bonus;
  if (effect.tipo === "clube") return rows.reduce((sum, other) => {
    const otherCard = cards.find((item) => item.id === other.cardId)!;
    return sum + (other !== row && otherCard.team === card.team ? Math.round(((other.base + other.bonus) * effect.mag) / 100) : 0);
  }, 0);
  if (effect.tipo === "mentor") return effect.mag * (rows.length - 1);
  if (effect.tipo === "fortaleza") return rows.reduce((sum, other) => sum + other.perf.der, 0) * effect.mag;
  if (effect.tipo === "hype") {
    const captain = rows.find((item) => item.captain);
    return captain && captain !== row ? Math.round(((captain.base + captain.bonus) * effect.mag) / 100) : 0;
  }
  if (effect.tipo === "analista") return rows.reduce((sum, other) => sum + other.perf.emp, 0) * effect.mag;
  return 0;
}

const random = seededRandom(20260904);
const originalRandom = Math.random;
Math.random = random;
const testCount = Math.max(1, Number.parseInt(process.argv[2] || "1000", 10) || 1000);

const publishedEdition = [
  { id: "custom-e1-2627-leks", name: "Leks", rarity: "lendaria", team: "benfica", customEffect: { tipo: "cacagrandes", mag: 35 } },
  { id: "custom-e1-2627-gugaferraz", name: "GugaFerraz", rarity: "lendaria", team: "santaclara", customEffect: { tipo: "resiliente", mag: 5 } },
  { id: "custom-e1-2627-lucanr1", name: "Luca-NR1", rarity: "epica", team: "moreirense", customEffect: { tipo: "imparavel", mag: 50 } },
  { id: "custom-e1-2627-gueric", name: "Gueric", rarity: "epica", team: "estrela", customEffect: { tipo: "consistente", mag: 30 } },
  { id: "custom-e1-2627-diogopeyroteo", name: "DiogoPeyroteo9", rarity: "epica", team: "sporting", customEffect: { tipo: "cacagrandes", mag: 24 } },
  { id: "custom-e1-2627-tundi", name: "Tundi", rarity: "rara", team: "santaclara", customEffect: { tipo: "resiliente", mag: 8 } },
  { id: "custom-e1-2627-peter16", name: "Peter16", rarity: "rara", team: "porto", customEffect: { tipo: "vencedor", mag: 10 } },
  { id: "custom-e1-2627-giobundyy", name: "Giobundyy", rarity: "rara", team: "alverca", customEffect: { tipo: "artilheiro", mag: 2 } },
  { id: "custom-e1-2627-jotapb10", name: "Jotapb10", rarity: "comum", team: "arouca", customEffect: { tipo: "cacagrandes", mag: 6 } },
  { id: "custom-e1-2627-marqzou", name: "MarQzou", rarity: "comum", team: "benfica", customEffect: { tipo: "consistente", mag: 10 } },
] as const;
const testCards: JornadaCard[] = [...JORNADA_CARDS, ...publishedEdition.map((edition) => {
  const base = JORNADA_CARDS.find((card) => !card.edition && !card.isClub && !card.isCaster && card.name === edition.name)!;
  return { ...base, ...edition, edition: "ETAPA 1 · 26/27", isClub: false, isCaster: false } as JornadaCard;
})];

const stages: Array<number | "finals"> = [1, 2, 3, "finals"];
const groupNames = ["A", "B", "C"];
const contexts = stages.flatMap((stage) => {
  const teams = shuffled(JORNADA_TEAMS.map((team) => team.id), random);
  return groupNames.map((group, index) => ({ stage, group, teams: teams.slice(index * 6, index * 6 + 6) }));
});
const metrics = new Map<string, { samples: number; active: number; total: number; max: number }>();
const variantMetrics = new Map<string, { samples: number; active: number; total: number; max: number }>();
const cardMetrics = new Map<string, { name: string; rarity: string; effect: string; samples: number; base: number; power: number; impact: number; max: number }>();
const failures: string[] = [];
const coverage = new Set<string>();
const totals: number[] = [];

for (let testIndex = 0; testIndex < testCount; testIndex++) {
  const requiredCard = testCards[testIndex % testCards.length];
  const preferredStage = stages[testIndex % stages.length];
  const context = testIndex < testCards.length && !requiredCard.isCaster
    ? contexts.find((item) => item.stage === preferredStage && item.teams.includes(requiredCard.team || ""))!
    : contexts[testIndex % contexts.length];
  const eligible = testCards.filter((card) => card.isCaster || (!!card.team && context.teams.includes(card.team)));
  const focus = testIndex < testCards.length ? requiredCard : eligible[testIndex % eligible.length];
  const focusEffect = effectOf(focus);
  const strategicAllies = focusEffect.tipo === "clube"
    ? shuffled(eligible.filter((card) => card.id !== focus.id && card.team === focus.team), random)
    : [];
  const rest = [...strategicAllies, ...shuffled(eligible.filter((card) => card.id !== focus.id && !strategicAllies.some((ally) => ally.id === card.id)), random)].slice(0, 2);
  const cards = [focus, ...rest];
  const captain = focusEffect.tipo === "hype" ? 1 + (testIndex % 2) : testIndex % 3;
  const result = scoreLineup(cards, captain);
  coverage.add(`${context.stage}-${context.group}`);
  cards.forEach((card) => coverage.add(card.id));
  totals.push(result.total);

  if (cards.length !== 3 || new Set(cards.map((card) => card.id)).size !== 3) failures.push(`Teste ${testIndex + 1}: lineup inválida`);
  if (cards.some((card) => !card.isCaster && !context.teams.includes(card.team || ""))) failures.push(`Teste ${testIndex + 1}: carta fora do grupo`);
  if (!Number.isFinite(result.total) || result.total < 0) failures.push(`Teste ${testIndex + 1}: total inválido`);
  if (result.rows.length !== 3 || result.total !== result.rows.reduce((sum, row) => sum + row.subtotal, 0)) failures.push(`Teste ${testIndex + 1}: subtotais inconsistentes`);

  result.rows.forEach((row) => {
    const value = contribution(row, result.rows, cards);
    const sourceCard = cards.find((item) => item.id === row.cardId)!;
    const current = metrics.get(row.fx.tipo) || { samples: 0, active: 0, total: 0, max: 0 };
    current.samples++;
    current.active += value > 0 ? 1 : 0;
    current.total += value;
    current.max = Math.max(current.max, value);
    metrics.set(row.fx.tipo, current);
    const variantKey = `${row.fx.tipo} +${row.fx.mag}`;
    const variant = variantMetrics.get(variantKey) || { samples: 0, active: 0, total: 0, max: 0 };
    variant.samples++;
    variant.active += value > 0 ? 1 : 0;
    variant.total += value;
    variant.max = Math.max(variant.max, value);
    variantMetrics.set(variantKey, variant);
    const cardMetric = cardMetrics.get(row.cardId) || { name: sourceCard.name, rarity: sourceCard.rarity, effect: variantKey, samples: 0, base: 0, power: 0, impact: 0, max: 0 };
    const impact = row.base + value;
    cardMetric.samples++;
    cardMetric.base += row.base;
    cardMetric.power += value;
    cardMetric.impact += impact;
    cardMetric.max = Math.max(cardMetric.max, impact);
    cardMetrics.set(row.cardId, cardMetric);
  });
}

Math.random = originalRandom;

const powers = [...metrics.entries()].map(([power, value]) => ({
  power,
  samples: value.samples,
  activation: `${Math.round((value.active / value.samples) * 100)}%`,
  average: Number((value.total / value.samples).toFixed(2)),
  max: value.max,
})).sort((left, right) => right.average - left.average);
const variants = [...variantMetrics.entries()].map(([variant, value]) => ({
  variant,
  samples: value.samples,
  activation: `${Math.round((value.active / value.samples) * 100)}%`,
  average: Number((value.total / value.samples).toFixed(2)),
  max: value.max,
})).sort((left, right) => right.average - left.average);
const cards = [...cardMetrics.entries()].map(([id, value]) => ({
  id,
  name: value.name,
  rarity: value.rarity,
  effect: value.effect,
  samples: value.samples,
  averageBase: Number((value.base / value.samples).toFixed(2)),
  averagePower: Number((value.power / value.samples).toFixed(2)),
  averageImpact: Number((value.impact / value.samples).toFixed(2)),
  maxImpact: value.max,
})).sort((left, right) => right.averageImpact - left.averageImpact);

const report = {
  tests: testCount,
  failures,
  contextsCovered: contexts.filter((context) => coverage.has(`${context.stage}-${context.group}`)).length,
  cardsCovered: testCards.filter((card) => coverage.has(card.id)).length,
  cardsAvailable: testCards.length,
  totalPoints: { min: Math.min(...totals), average: Number((totals.reduce((sum, value) => sum + value, 0) / totals.length).toFixed(2)), max: Math.max(...totals) },
  powers,
  variants,
  cards,
};

if (process.argv.includes("--summary")) {
  const impacts = cards.map((card) => card.averageImpact);
  const mean = impacts.reduce((sum, value) => sum + value, 0) / impacts.length;
  const standardDeviation = Math.sqrt(impacts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / impacts.length);
  const effectCounts = Object.fromEntries(["comum", "rara", "epica", "lendaria"].map((rarity) => [rarity, cards.filter((card) => card.rarity === rarity).reduce<Record<string, number>>((counts, card) => {
    counts[card.effect] = (counts[card.effect] || 0) + 1;
    return counts;
  }, {})]));
  console.log(JSON.stringify({ tests: report.tests, failures: report.failures, contextsCovered: report.contextsCovered, cardsCovered: report.cardsCovered, cardsAvailable: report.cardsAvailable, mean: Number(mean.toFixed(2)), standardDeviation: Number(standardDeviation.toFixed(2)), maxMinRatio: Number((Math.max(...impacts) / Math.max(0.01, Math.min(...impacts))).toFixed(2)), top10: cards.slice(0, 10), bottom10: cards.slice(-10).reverse(), effectCounts }, null, 2));
} else {
  console.log(JSON.stringify(report, null, 2));
}