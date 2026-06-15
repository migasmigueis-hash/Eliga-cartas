import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './lib/supabaseClient';


/* ============================================================
   eLiga Portugal — Cartas Colecionáveis (protótipo v2)
   - Login local do jogo (contas guardadas por utilizador)
   - Loja de packs (aberturas grátis reservadas ao admin; jogadores ganham
     packs via Objetivos e códigos promocionais — pontos Twitch em breve)
   - Trocas: 10 duplicados de uma raridade -> 1 carta da raridade acima
   - Coleção por utilizador, persistente
   - Fotos oficiais dos jogadores (site eLiga) nas cartas
   ============================================================ */

const LOGO_BASE = "https://esports.ligaportugal.pt/images/teams/logos/";
const PHOTO_BASE = "https://esports.ligaportugal.pt/images/teams/players/";
const ELIGA_LOGO = "https://esports.ligaportugal.pt/images/logo@2x.png";

const TEAMS = [
  { id: "benfica", name: "SL Benfica Esports", short: "SLB", logo: "36y1bm2m34mc080g84.png", color: "#E11B22", rarity: "epica" },
  { id: "sporting", name: "Sporting CP | IGW", short: "SCP", logo: "sportingcp.png", color: "#1E8E4B", rarity: "rara" },
  { id: "porto", name: "FC Porto | Luna", short: "FCP", logo: "icw9zqr0ba8g8cg4s.png", color: "#1B5FAA", rarity: "rara" },
  { id: "braga", name: "SC Braga | EGN ESPORTS", short: "SCB", logo: "bn9q9v5a9c84s84cog.png", color: "#C8102E", rarity: "rara" },
  { id: "santaclara", name: "Santa Clara", short: "CDSC", logo: "tsk5ibdkduog8k8osg.png", color: "#D02030", rarity: "epica" },
  { id: "estrela", name: "Estrela Amadora Fluxo W7M", short: "CFEA", logo: "2zau7leg05mos8gook.png", color: "#2E9E4F", rarity: "rara" },
  { id: "estoril", name: "Estoril Praia", short: "EST", logo: "estorilpraia.png", color: "#F5C518", rarity: "comum" },
  { id: "gilvicente", name: "Gil Vicente FC", short: "GVFC", logo: "31irmayqu0w00gw8sc.png", color: "#C8102E", rarity: "comum" },
  { id: "arouca", name: "FC Arouca by Quest | OGM", short: "FCA", logo: "arouca.png", color: "#F2A900", rarity: "comum" },
  { id: "tondela", name: "CD Tondela | Apogee", short: "CDT", logo: "2s19ksuel0g08scg40.png", color: "#F2C14E", rarity: "comum" },
  { id: "moreirense", name: "Moreirense FC", short: "MFC", logo: "pj7qj76ifz4kokkc8k.png", color: "#1E7A3C", rarity: "rara" },
  { id: "famalicao", name: "FC Famalicão", short: "FCF", logo: "famalicao.png", color: "#1B4FA0", rarity: "comum" },
  { id: "vitoria", name: "Vitória SC | ISG", short: "VSC", logo: "vitoriasc.png", color: "#E5E5E5", rarity: "comum" },
  { id: "rioave", name: "Rio Ave FC", short: "RAFC", logo: "rioave.png", color: "#1E8E4B", rarity: "comum" },
  { id: "casapia", name: "Casa Pia AC | Grow uP", short: "CPAC", logo: "casapiaac.png", color: "#2B2B2B", rarity: "comum" },
  { id: "nacional", name: "CD Nacional", short: "CDN", logo: "3fgv6n5zzl4wogs84k.png", color: "#0B0B0B", rarity: "comum" },
  { id: "afs", name: "AFS | TxT Gaming", short: "AFS", logo: "w5rtbwhtu1cc8cw084.png", color: "#1B4FA0", rarity: "comum" },
  { id: "alverca", name: "FC Alverca | GOAT", short: "FCAL", logo: "2mjud1i5g6yowcccwg.png", color: "#C8102E", rarity: "comum" },
];

// Jogadores com fotos e estatísticas oficiais da época 25/26 (site da eLiga)
// j = jogos, v = % vitórias, g = golos marcados, mg = média golos/jogo
const PLAYERS = [
  { id: "leks", name: "Leks", team: "benfica", photo: "sywjo0t8tf4sw0sgsc.png", j: 16, v: 87.5, g: 98, mg: 6.13 },
  { id: "marqzou", name: "MarQzou", team: "benfica", photo: "ygbt1zy3xcg8kokw4w.png", j: 8, v: 50, g: 37, mg: 4.63 },
  { id: "tundi", name: "Tundi", team: "santaclara", photo: "xpsvloidd6o0kow0s.png", j: 7, v: 57.1, g: 46, mg: 6.57 },
  { id: "gugaferraz", name: "GugaFerraz", team: "santaclara", photo: "owk4l871jnk4ssg8wc.png", j: 19, v: 84.2, g: 108, mg: 5.68 },
  { id: "diogopeyroteo", name: "DiogoPeyroteo9", team: "sporting", photo: "lxqb5g75c28cgo8gsg.png", j: 18, v: 50, g: 92, mg: 5.11 },
  { id: "bret4o", name: "bret4o", team: "sporting", photo: "pch6zceyc3k4go8so.png", j: 1, v: 0, g: 7, mg: 7.0 },
  { id: "peter16", name: "Peter16", team: "porto", photo: "36leo3bsu7408wokkk.png", j: 7, v: 42.9, g: 38, mg: 5.43 },
  { id: "diogosilva", name: "Diogo Silva", team: "porto", photo: "fzd9rj27alsssk488.png", j: 13, v: 46.2, g: 60, mg: 4.62 },
  { id: "jperes99", name: "JPeres99", team: "braga", photo: "gy4vc62gg9w0kkws0o.png", j: 11, v: 27.3, g: 40, mg: 3.64 },
  { id: "rikhard", name: "Rikhard", team: "braga", photo: "27vocb6i1xescwgk8w.png", j: 4, v: 0, g: 12, mg: 3.0 },
  { id: "mike27", name: "Mike_27", team: "estrela", photo: "1ccyf6h70yzo0wc4cs.png", j: 5, v: 20, g: 18, mg: 3.6 },
  { id: "gueric", name: "Gueric", team: "estrela", photo: "36sqsqbdynwgso8g0g.png", j: 15, v: 60, g: 73, mg: 4.87 },
  { id: "lucanr1", name: "Luca-NR1", team: "moreirense", photo: "nqcya9h68is0cgokco.png", j: 22, v: 68.2, g: 130, mg: 5.91 },
  { id: "licapu", name: "Licapu", team: "estoril", photo: "k2qctsqx1nkgc8k00s.png", j: 18, v: 33.3, g: 85, mg: 4.72 },
  { id: "zitsubasa", name: "Zitsubasa", team: "gilvicente", photo: "p4l4j3mdqdwok88c40.png", j: 17, v: 41.2, g: 91, mg: 5.35 },
  { id: "jotapb10", name: "Jotapb10", team: "arouca", photo: "80u0jxmw1604s04oog.png", j: 20, v: 40, g: 113, mg: 5.65 },
  { id: "guiddias", name: "Guiddias_14", team: "arouca", photo: "3zfeqvroni04owgwc.png", j: 0, v: 0, g: 0, mg: 0 },
  { id: "darkley11", name: "Darkley11", team: "tondela", photo: "7liuzav4lrsw00ck8.png", j: 16, v: 43.8, g: 101, mg: 6.31 },
  { id: "vinagrolih", name: "Vinagrolih", team: "famalicao", photo: "atpltj9f94w0ssso0w.png", j: 7, v: 28.6, g: 25, mg: 3.57 },
  { id: "rodr7gol", name: "Rodr7gol", team: "famalicao", photo: "36v59lwg5pq88koco4.png", j: 10, v: 50, g: 59, mg: 5.9 },
  { id: "dekass", name: "Dekass", team: "vitoria", photo: "9t7vrweeqvc4gwk8sc.png", j: 7, v: 14.3, g: 26, mg: 3.71 },
  { id: "skreibar", name: "Skreibar", team: "vitoria", photo: "ytnyoctqxiooowow84.png", j: 9, v: 33.3, g: 27, mg: 3.0 },
  { id: "phoenix", name: "phoenix3687", team: "rioave", photo: "wl0v18uimio04ws48.png", j: 16, v: 31.3, g: 89, mg: 5.56 },
  { id: "rickyp", name: "RickyP", team: "rioave", photo: "ypxcij1l0uo888gswk.png", j: 0, v: 0, g: 0, mg: 0 },
  { id: "godrafa", name: "GodRafa", team: "casapia", photo: "43zqz08skask8o4og.png", j: 10, v: 50, g: 53, mg: 5.3 },
  { id: "ggrilo", name: "ggrilo_10", team: "casapia", photo: "1j3rfbkbkblwo0wkwo.png", j: 5, v: 0, g: 15, mg: 3.0 },
  { id: "canha14", name: "Canha14", team: "nacional", photo: "gaebbuqcs3k0c0o8gw.png", j: 15, v: 6.7, g: 66, mg: 4.4 },
  { id: "jsilva29", name: "JSilva29_", team: "afs", photo: "opfyvljkmf40cgsgkg.png", j: 14, v: 50, g: 68, mg: 4.86 },
  { id: "npena80", name: "Npena80", team: "afs", photo: "k4m7g6qqysggccks44.png", j: 5, v: 40, g: 21, mg: 4.2 },
  { id: "giobundyy", name: "Giobundyy", team: "alverca", photo: "qmf2p41dznk48c0c88.png", j: 17, v: 47.1, g: 112, mg: 6.59 },
];

// Ranking 25/26: as Finals valem mais que a geral — campeão nacional primeiro,
// finalista, meias-finais, quartos (ordenados pelos pontos da geral entre si).
// Do 9º ao 18º vale a classificação geral oficial.
const TEAM_RANK = {
  benfica: 1, santaclara: 2, estrela: 3, moreirense: 4,
  sporting: 5, afs: 6, arouca: 7, porto: 8,
  famalicao: 9, alverca: 10, gilvicente: 11, estoril: 12, tondela: 13,
  rioave: 14, vitoria: 15, braga: 16, casapia: 17, nacional: 18,
};

// Score = desempenho individual (%V, média golos, jogos) × posição da equipa na geral.
// Quem não fez top 8 com a equipa é penalizado, mesmo com bons números individuais.
// Casters oficiais da eLiga — categoria própria, sem stats de jogo.
// photo: null por agora — substituir pelo nome do ficheiro oficial quando disponível,
// tal como nas fotos dos jogadores (mesma pasta do site).
const CASTERS = [
  { id: "donpablo", name: "Don Pablo", ovr: 88, role: "CASTER", rarity: "epica", photo: null },
  { id: "pickywiky", name: "PickyWiky", ovr: 87, role: "PIVOT", rarity: "epica", photo: null },
  { id: "dantas", name: "Dantas", ovr: 86, role: "CASTER", rarity: "rara", photo: null },
  { id: "mucha", name: "Mucha", ovr: 85, role: "CASTER", rarity: "rara", photo: null },
  { id: "zeny", name: "Zeny", ovr: 84, role: "CASTER", rarity: "rara", photo: null },
  { id: "loureiro", name: "Loureiro", ovr: 83, role: "CASTER", rarity: "rara", photo: null },
];

const perfScore = (p) => (p.j === 0 ? 0 : p.v * 0.5 + p.mg * 5 + Math.min(p.j, 20));
const totalScore = (p) => (p.j === 0 ? 0 : perfScore(p) * 0.7 + (19 - (TEAM_RANK[p.team] || 18)) * 1.7);
const playerRarity = (p) => { const s = totalScore(p); return s >= 75 ? "epica" : s >= 55 ? "rara" : "comum"; };
const playerOvr = (p) => { const s = totalScore(p); return Math.max(65, Math.min(93, Math.round(62 + s * 0.33))); };
// Clubes: raridade e força a partir da classificação geral
const clubRarity = (teamId) => { const r = TEAM_RANK[teamId] || 18; return r <= 2 ? "epica" : r <= 8 ? "rara" : "comum"; };
const clubPower = (teamId) => Math.round(92 - ((TEAM_RANK[teamId] || 18) - 1) * 1.5);

// Cartas especiais — edições únicas de cada momento da época 25/26
const SPECIALS = [
  { id: "sp-leks-finals", name: "Leks", team: "benfica", rarity: "lendaria", edition: "FINALS 25/26", tag: "Campeão Nacional", ref: "leks" },
  { id: "sp-marqzou-finals", name: "MarQzou", team: "benfica", rarity: "lendaria", edition: "FINALS 25/26", tag: "Campeão Nacional", ref: "marqzou" },
  { id: "sp-benfica-finals", name: "SL Benfica Esports", team: "benfica", rarity: "lendaria", edition: "FINALS 25/26", tag: "Campeão Nacional", isClub: true },
  { id: "sp-tundi-taca", name: "Tundi", team: "santaclara", rarity: "lendaria", edition: "TAÇA eLIGA", tag: "Campeão de Inverno", ref: "tundi" },
  { id: "sp-leks-e1", name: "Leks", team: "benfica", rarity: "epica", edition: "ETAPA 1", tag: "Vencedor da Etapa 1", ref: "leks" },
  { id: "sp-marqzou-e1", name: "MarQzou", team: "benfica", rarity: "epica", edition: "ETAPA 1", tag: "Vencedor da Etapa 1", ref: "marqzou" },
  { id: "sp-guga-e2", name: "GugaFerraz", team: "santaclara", rarity: "epica", edition: "ETAPA 2", tag: "Vencedor da Etapa 2", ref: "gugaferraz" },
  { id: "sp-gueric-e3", name: "Gueric", team: "estrela", rarity: "epica", edition: "ETAPA 3", tag: "Vencedor da Etapa 3", ref: "gueric" },
  { id: "sp-benfica-e1", name: "SL Benfica Esports", team: "benfica", rarity: "epica", edition: "ETAPA 1", tag: "Vencedor da Etapa", isClub: true },
  { id: "sp-santaclara-e2", name: "Santa Clara", team: "santaclara", rarity: "epica", edition: "ETAPA 2", tag: "Vencedor da Etapa", isClub: true },
  { id: "sp-estrela-e3", name: "Estrela Amadora Fluxo W7M", team: "estrela", rarity: "epica", edition: "ETAPA 3", tag: "Vencedor da Etapa", isClub: true },
  // casters na Grande Final
  { id: "sp-donpablo-gf", name: "Don Pablo", rarity: "epica", edition: "GRANDE FINAL", tag: "Voz da Grande Final", casterRef: "donpablo" },
  { id: "sp-pickywiky-gf", name: "PickyWiky", rarity: "epica", edition: "GRANDE FINAL", tag: "Pivot da Grande Final", casterRef: "pickywiky" },
  { id: "sp-dantas-gf", name: "Dantas", rarity: "epica", edition: "GRANDE FINAL", tag: "Voz da Grande Final", casterRef: "dantas" },
  { id: "sp-mucha-gf", name: "Mucha", rarity: "epica", edition: "GRANDE FINAL", tag: "Voz da Grande Final", casterRef: "mucha" },
  { id: "sp-zeny-gf", name: "Zeny", rarity: "epica", edition: "GRANDE FINAL", tag: "Voz da Grande Final", casterRef: "zeny" },
  { id: "sp-loureiro-gf", name: "Loureiro", rarity: "epica", edition: "GRANDE FINAL", tag: "Voz da Grande Final", casterRef: "loureiro" },
];

const RARITY = {
  comum: { label: "Comum", color: "#9FB0C8", glow: "rgba(159,176,200,0.35)", frame: "linear-gradient(160deg,#5d6b80,#9FB0C8 45%,#5d6b80)", ovr: [70, 77] },
  rara: { label: "Rara", color: "#F2C14E", glow: "rgba(242,193,78,0.55)", frame: "linear-gradient(160deg,#8a6420,#F2C14E 40%,#fff0c2 50%,#F2C14E 60%,#8a6420)", ovr: [78, 84] },
  epica: { label: "Épica", color: "#B45CFF", glow: "rgba(180,92,255,0.6)", frame: "linear-gradient(160deg,#5a1e9e,#B45CFF 40%,#ecd6ff 50%,#B45CFF 60%,#5a1e9e)", ovr: [85, 89] },
  lendaria: { label: "Lendária", color: "#39E6FF", glow: "rgba(57,230,255,0.7)", frame: "linear-gradient(120deg,#39E6FF,#1BF5A3 25%,#F2C14E 50%,#FF5CE1 75%,#39E6FF)", ovr: [90, 94] },
};
const RARITY_UP = { comum: "rara", rara: "epica", epica: "lendaria" };

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return h; }

function buildPool() {
  const cards = [];
  // clubes: sem stats — a força interna (para a competição) vem da média dos seus jogadores
  TEAMS.forEach((t) => {
    const squad = PLAYERS.filter((p) => p.team === t.id && p.j > 0);
    const v = squad.length ? squad.reduce((s, p) => s + p.v, 0) / squad.length : 35;
    const mg = squad.length ? squad.reduce((s, p) => s + p.mg, 0) / squad.length : 4;
    cards.push({ id: "club-" + t.id, name: t.name, team: t.id, rarity: clubRarity(t.id), isClub: true, edition: null, ovr: clubPower(t.id), v: Math.round(v * 10) / 10, mg: Math.round(mg * 100) / 100, j: null, g: null });
  });
  // jogadores: raridade e OVR derivados dos stats reais da época
  PLAYERS.forEach((p) => {
    cards.push({ id: "pl-" + p.id, name: p.name, team: p.team, rarity: playerRarity(p), isClub: false, edition: null, photo: p.photo, ovr: playerOvr(p), j: p.j, v: p.v, g: p.g, mg: p.mg });
  });
  // casters: categoria própria, sem stats de jogo
  CASTERS.forEach((c) => {
    cards.push({ id: "cast-" + c.id, name: c.name, team: null, rarity: c.rarity, isClub: false, isCaster: true, role: c.role, edition: null, photo: c.photo, ovr: c.ovr, j: null, v: null, g: null, mg: null });
  });
  // especiais: herdam os stats reais do jogador (ou o perfil do caster); OVR com bónus de edição
  SPECIALS.forEach((s) => {
    const boost = s.rarity === "lendaria" ? 4 : 2;
    if (s.casterRef) {
      const base = CASTERS.find((c) => c.id === s.casterRef);
      cards.push({ ...s, team: null, isClub: false, isCaster: true, role: base?.role || "CASTER", photo: base?.photo, ovr: Math.min(96, (base?.ovr || 84) + boost), j: null, v: null, g: null, mg: null });
      return;
    }
    const base = s.ref ? PLAYERS.find((p) => p.id === s.ref) : null;
    cards.push({
      ...s, isClub: !!s.isClub, photo: base?.photo,
      ovr: base ? Math.min(96, playerOvr(base) + boost) : 90,
      j: base?.j ?? null, v: base?.v ?? null, g: base?.g ?? null, mg: base?.mg ?? null,
    });
  });
  return cards.map((c) => ({ ...c, teamData: TEAMS.find((t) => t.id === c.team) }));
}
const POOL = buildPool();

// identidade base de uma carta — versões diferentes do mesmo jogador/clube/caster partilham-na
const cardIdentity = (c) => {
  if (!c) return "";
  if (c.isClub) return "club-" + c.team;
  if (c.isCaster) return "cast-" + (c.casterRef || c.id.replace("cast-", ""));
  return "pl-" + (c.ref || c.id.replace("pl-", ""));
};

/* ---------- Escolhas (estilo Wonder Pick): conjunto global de 5 cartas que
   renova de 6 em 6 horas; gasta 1 Escolha para virar, baralhar e escolher às cegas */
const PICK_SLOT_MS = 6 * 3600 * 1000;
const EMPTY_PREV = { groups: null, qual: [], groupResult: null, bracket: null, qf: [null, null, null, null], sf: [null, null], fin: null, resolved: null, rewardClaimed: false };
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function buildPickBoard(seed, premium = false) {
  const rnd = mulberry32(seed);
  const pickRar = premium
    ? () => { const r = rnd() * 100; return r < 55 ? "rara" : r < 87 ? "epica" : "lendaria"; }
    : () => { const r = rnd() * 100; return r < 55 ? "comum" : r < 85 ? "rara" : r < 96 ? "epica" : "lendaria"; };
  const board = [], used = new Set();
  let guard = 0;
  while (board.length < 5 && guard++ < 300) {
    const cands = POOL.filter((c) => c.rarity === pickRar() && !used.has(c.id));
    if (!cands.length) continue;
    const c = cands[Math.floor(rnd() * cands.length)];
    used.add(c.id); board.push(c);
  }
  return board;
}

const TRADE_DIRECT = 25; // duplicados para escolher uma carta específica da raridade acima

// Trivia diária — uma pergunta por dia, acertar dá 1 Escolha
const TRIVIA = [
  { q: "Quem venceu as Finals 25/26 e é campeão nacional?", opts: ["SL Benfica", "Santa Clara", "Estrela Amadora", "FC Porto"], a: 0 },
  { q: "Que clube venceu a Taça eLiga 25/26?", opts: ["SL Benfica", "Santa Clara", "Sporting CP", "Moreirense"], a: 1 },
  { q: "Quem venceu a Etapa 1 da época 25/26?", opts: ["Santa Clara", "Estrela Amadora", "SL Benfica", "AFS"], a: 2 },
  { q: "Quem venceu a Etapa 2 da época 25/26?", opts: ["Santa Clara", "SL Benfica", "FC Porto", "Arouca"], a: 0 },
  { q: "Quem venceu a Etapa 3 da época 25/26?", opts: ["Moreirense", "Famalicão", "Gil Vicente", "Estrela Amadora"], a: 3 },
  { q: "Que clube terminou em 1º na classificação geral por pontos?", opts: ["SL Benfica", "Santa Clara", "Estrela Amadora", "Sporting CP"], a: 1 },
  { q: "Quantos golos marcou o Luca-NR1 na época 25/26?", opts: ["98", "112", "130", "85"], a: 2 },
  { q: "Quem teve a melhor percentagem de vitórias da época (87.5%)?", opts: ["GugaFerraz", "Leks", "Tundi", "Gueric"], a: 1 },
  { q: "Quantos clubes participam na eLiga Portugal?", opts: ["16", "18", "20", "12"], a: 1 },
  { q: "Que jogador do Alverca marcou 112 golos na época?", opts: ["Giobundyy", "Rodr7gol", "phoenix3687", "Jotapb10"], a: 0 },
  { q: "Qual foi a média de golos por jogo do Leks?", opts: ["4.87", "5.68", "6.13", "6.59"], a: 2 },
  { q: "Quem disputou mais jogos na época 25/26 (22 jogos)?", opts: ["Leks", "Luca-NR1", "Jotapb10", "DiogoPeyroteo9"], a: 1 },
  { q: "Que clube representa o GugaFerraz?", opts: ["SL Benfica", "FC Porto", "Santa Clara", "Braga"], a: 2 },
  { q: "Que clube terminou a geral com 0 pontos?", opts: ["Casa Pia", "Nacional", "Braga", "Rio Ave"], a: 1 },
  { q: "Quem é o pivot da equipa de transmissão da eLiga?", opts: ["Don Pablo", "Dantas", "PickyWiky", "Mucha"], a: 2 },
  { q: "Que clube representa o Gueric, vencedor da Etapa 3?", opts: ["Estrela Amadora", "Moreirense", "Tondela", "Estoril"], a: 0 },
];
const triviaOfDay = () => TRIVIA[Math.floor(Date.now() / 86400000) % TRIVIA.length];

// Conquistas — insígnias permanentes calculadas sobre o estado do jogador
function calcStreak(dias) {
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if ((dias || []).includes(key)) { streak++; d.setDate(d.getDate() - 1); } else break;
  }
  return streak;
}
function buildAchievements({ collection, meta, jHist }) {
  const uniques = POOL.filter((c) => (collection[c.id] || 0) > 0);
  const nUniq = uniques.length;
  const totalPacks = Object.values(meta.packs || {}).reduce((s, n) => s + n, 0);
  const totalTrocas = Object.values(meta.trocas || {}).reduce((s, n) => s + n, 0);
  const totalEsc = Object.values(meta.escUso || {}).reduce((s, n) => s + n, 0);
  const streak = calcStreak(meta.dias);
  const clubeFechado = TEAMS.some((t) => POOL.filter((c) => c.team === t.id && !c.edition).every((c) => (collection[c.id] || 0) > 0));
  const best = (jHist || []).reduce((m, e) => Math.max(m, e.total), 0);
  return [
    { id: "a1", emoji: "🃏", titulo: "Primeiro Pack", desc: "Abre o teu primeiro pack", ok: totalPacks >= 1 },
    { id: "a2", emoji: "📦", titulo: "Meio Cento", desc: "Abre 50 packs", ok: totalPacks >= 50 },
    { id: "a3", emoji: "🏭", titulo: "Centena", desc: "Abre 100 packs", ok: totalPacks >= 100 },
    { id: "a4", emoji: "💜", titulo: "Primeira Épica", desc: "Obtém uma carta Épica", ok: uniques.some((c) => c.rarity === "epica") },
    { id: "a5", emoji: "🌟", titulo: "Primeira Lendária", desc: "Obtém uma carta Lendária", ok: uniques.some((c) => c.rarity === "lendaria") },
    { id: "a6", emoji: "📚", titulo: "Meio Álbum", desc: "Tem metade da coleção", ok: nUniq >= Math.ceil(POOL.length / 2) },
    { id: "a7", emoji: "🏆", titulo: "Coleção Completa", desc: "Tem todas as cartas", ok: nUniq >= POOL.length },
    { id: "a8", emoji: "🛡", titulo: "Clube Fechado", desc: "Completa as cartas de um clube", ok: clubeFechado },
    { id: "a9", emoji: "🔁", titulo: "Negociante", desc: "Faz 5 trocas", ok: totalTrocas >= 5 },
    { id: "a10", emoji: "🎯", titulo: "Mão Quente", desc: "Usa 10 Escolhas", ok: totalEsc >= 10 },
    { id: "a11", emoji: "🔥", titulo: "Semana Perfeita", desc: "Entra 7 dias seguidos", ok: streak >= 7 },
    { id: "a12", emoji: "⚡", titulo: "Jornada de 300", desc: "Marca 300+ pts numa jornada", ok: best >= 300 },
    { id: "a13", emoji: "🎙", titulo: "Voz Amiga", desc: "Joga uma jornada com um caster", ok: (jHist || []).some((e) => e.hasCaster) },
    { id: "a14", emoji: "👑", titulo: "Capitã Lendária", desc: "Usa uma Lendária como capitã", ok: (jHist || []).some((e) => e.capRarity === "lendaria") },
  ];
}

// Códigos promocionais — revelados em stream/redes; um resgate por conta
const REDEEM_CODES = {
  "ELIGA2026": { pack: "base" },
  "BEMVINDO": { pack: "base" },
  "FINALS25": { pack: "finals" },
  "TWITCHDROP": { pack: "finals" },
  "ESCOLHAS10": { escolhas: 10 },
};

const PACKS = [
  { id: "base", name: "Pack Base", sub: "Época 25/26 · 3 cartas", desc: "Todos os clubes e jogadores da eLiga Portugal.", gradient: "linear-gradient(165deg,#0E2A4A 0%,#0A4D3C 60%,#1BF5A3 140%)", accent: "#1BF5A3", locked: false, specialBoost: 0 },
  { id: "finals", name: "Pack Finals 25/26", sub: "Edição comemorativa · 3 cartas", desc: "Probabilidade aumentada de cartas especiais das Finals, Taça e Etapas.", gradient: "linear-gradient(165deg,#1a0a3a 0%,#5a1e9e 55%,#F2C14E 150%)", accent: "#F2C14E", locked: false, specialBoost: 1 },
  { id: "etapa1", name: "Pack Etapa 1 · 26/27", sub: "Cartas únicas da Etapa 1", desc: "Disponível com o arranque da nova época, em fevereiro de 2027.", gradient: "linear-gradient(165deg,#10243f,#1f3a5f)", accent: "#6f87a8", locked: true, lockLabel: "Fevereiro 2027" },
  { id: "taca", name: "Pack Taça eLiga 26/27", sub: "Cartas únicas da Taça", desc: "Disponível durante a Taça eLiga Portugal.", gradient: "linear-gradient(165deg,#241027,#3f1f3a)", accent: "#a86f9d", locked: true, lockLabel: "Brevemente" },
];

// Probabilidades por carta — publicadas na Loja
// (o sorteio real acontece no servidor — ver supabase/functions/_shared/gameData.ts)
const PACK_ODDS = {
  0: [["comum", 76], ["rara", 20], ["epica", 3], ["lendaria", 1]],
  1: [["comum", 52], ["rara", 35], ["epica", 10], ["lendaria", 3]],
};

/* ---------- datas (objetivos diários/semanais) ---------- */
const todayStr = () => new Date().toISOString().slice(0, 10);
function weekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}
function streakOf(dias) {
  const set = new Set(dias);
  let s = 0; const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

/* ---------- seleção dos duplicados que uma troca vai consumir ---------- */
function pickDuplicates(rarity, collection, n) {
  const picks = {}; const temp = { ...collection };
  let remaining = n;
  while (remaining > 0) {
    const candidates = POOL.filter((c) => c.rarity === rarity && (temp[c.id] || 0) > 1).sort((a, b) => temp[b.id] - temp[a.id]);
    if (!candidates.length) break;
    temp[candidates[0].id]--; picks[candidates[0].id] = (picks[candidates[0].id] || 0) + 1; remaining--;
  }
  return picks; // mapa id -> nº de cópias a consumir
}

/* ---------- objetivos ---------- */
function buildObjectives(meta, collection) {
  const today = todayStr(), wk = weekKey(new Date(today + "T12:00:00"));
  const dias = meta.dias || [];
  const packsToday = (meta.packs || {})[today] || 0;
  const packsWeek = Object.entries(meta.packs || {}).filter(([d]) => weekKey(new Date(d + "T12:00:00")) === wk).reduce((s, [, n]) => s + n, 0);
  const streak = streakOf(dias);
  const inWeek = dias.filter((d) => weekKey(new Date(d + "T12:00:00")) === wk).length;
  const objs = [
    { id: "d-login", tipo: "diario", periodo: today, titulo: "Entrar no jogo hoje", prog: dias.includes(today) ? 1 : 0, alvo: 1, reward: "base" },
    { id: "d-packs3", tipo: "diario", periodo: today, titulo: "Abrir 3 packs hoje", prog: Math.min(3, packsToday), alvo: 3, reward: "base" },
    { id: "s-login5", tipo: "semanal", periodo: wk, titulo: "Entrar em 5 dias diferentes esta semana", prog: Math.min(5, inWeek), alvo: 5, reward: "escolha2" },
    { id: "s-packs10", tipo: "semanal", periodo: wk, titulo: "Abrir 10 packs esta semana", prog: Math.min(10, packsWeek), alvo: 10, reward: "escolha2" },
    { id: "p-streak7", tipo: "permanente", periodo: "perm", titulo: "Entrar 7 dias seguidos", prog: Math.min(7, streak), alvo: 7, reward: "finals" },
    { id: "p-streak14", tipo: "permanente", periodo: "perm", titulo: "Entrar 14 dias seguidos", prog: Math.min(14, streak), alvo: 14, reward: "escolha3" },
  ];
  // atividade de trocas e escolhas
  const trocasWeek = Object.entries(meta.trocas || {}).filter(([d]) => weekKey(new Date(d + "T12:00:00")) === wk).reduce((s, [, n]) => s + n, 0);
  const escDia = (meta.escUso || {})[today] || 0;
  const escWeek = Object.entries(meta.escUso || {}).filter(([d]) => weekKey(new Date(d + "T12:00:00")) === wk).reduce((s, [, n]) => s + n, 0);
  const totalPacks = Object.values(meta.packs || {}).reduce((s, n) => s + n, 0);
  const temLendaria = POOL.some((c) => c.rarity === "lendaria" && (collection[c.id] || 0) > 0);
  objs.push({ id: "d-escolha1", tipo: "diario", periodo: today, titulo: "Usar 1 Escolha hoje", prog: Math.min(1, escDia), alvo: 1, reward: "base" });
  objs.push({ id: "d-packs5", tipo: "diario", periodo: today, titulo: "Abrir 5 packs hoje", prog: Math.min(5, packsToday), alvo: 5, reward: "base" });
  objs.push({ id: "s-trocas3", tipo: "semanal", periodo: wk, titulo: "Fazer 3 trocas esta semana", prog: Math.min(3, trocasWeek), alvo: 3, reward: "finals" });
  objs.push({ id: "s-esc5", tipo: "semanal", periodo: wk, titulo: "Usar 5 Escolhas esta semana", prog: Math.min(5, escWeek), alvo: 5, reward: "finals" });
  objs.push({ id: "p-packs50", tipo: "permanente", periodo: "perm", titulo: "Abrir 50 packs no total", prog: Math.min(50, totalPacks), alvo: 50, reward: "finals" });
  objs.push({ id: "p-packs100", tipo: "permanente", periodo: "perm", titulo: "Abrir 100 packs no total", prog: Math.min(100, totalPacks), alvo: 100, reward: "finals" });
  objs.push({ id: "p-lendaria", tipo: "permanente", periodo: "perm", titulo: "Obter uma carta Lendária", prog: temLendaria ? 1 : 0, alvo: 1, reward: "finals" });
  // marcos de coleção — recompensados em Escolhas
  const totalOwned = Object.keys(collection).filter((k) => (collection[k] || 0) > 0).length;
  objs.push({ id: "p-col15", tipo: "permanente", periodo: "perm", titulo: "Ter 15 cartas diferentes na coleção", prog: Math.min(15, totalOwned), alvo: 15, reward: "escolha1" });
  objs.push({ id: "p-col30", tipo: "permanente", periodo: "perm", titulo: "Ter 30 cartas diferentes na coleção", prog: Math.min(30, totalOwned), alvo: 30, reward: "escolha2" });
  objs.push({ id: "p-col45", tipo: "permanente", periodo: "perm", titulo: "Ter 45 cartas diferentes na coleção", prog: Math.min(45, totalOwned), alvo: 45, reward: "escolha3" });
  // um objetivo de coleção por cada um dos 18 clubes (clube + jogadores, sem especiais)
  TEAMS.forEach((t) => {
    const cards = POOL.filter((c) => c.team === t.id && !c.edition);
    const got = cards.filter((c) => (collection[c.id] || 0) > 0).length;
    objs.push({ id: "p-team-" + t.id, tipo: "permanente", periodo: "perm", titulo: "Colecionar todas as cartas: " + t.name, prog: got, alvo: cards.length, reward: "finals", team: t.id });
  });
  return objs;
}

/* ---------- competição fantasy: efeitos das cartas ---------- */
const PLAYER_FX = ["artilheiro", "vencedor", "consistente", "imparavel", "resiliente", "cacagrandes"];
const CLUB_FX = ["clube", "mentor", "fortaleza"];
const CASTER_FX = ["hype", "vozdaliga", "analista"];
const FX_MAG = {
  comum:    { artilheiro: 1, vencedor: 5,  consistente: 10,  imparavel: 8,  resiliente: 4,  cacagrandes: 6,  clube: 15,  mentor: 4,  fortaleza: 3,  hype: 10, vozdaliga: 8,  analista: 5 },
  rara:     { artilheiro: 2, vencedor: 10, consistente: 25,  imparavel: 16, resiliente: 8,  cacagrandes: 12, clube: 30,  mentor: 8,  fortaleza: 6,  hype: 20, vozdaliga: 15, analista: 10 },
  epica:    { artilheiro: 3, vencedor: 20, consistente: 50,  imparavel: 30, resiliente: 14, cacagrandes: 24, clube: 60,  mentor: 15, fortaleza: 10, hype: 40, vozdaliga: 30, analista: 18 },
  lendaria: { artilheiro: 5, vencedor: 35, consistente: 100, imparavel: 50, resiliente: 22, cacagrandes: 40, clube: 120, mentor: 25, fortaleza: 18, hype: 80, vozdaliga: 50, analista: 30 },
};
const FX_LABEL = {
  artilheiro: (m) => `Artilheiro: cada golo vale +${m} pts extra`,
  vencedor: (m) => `Vencedor: +${m} pts por vitória`,
  consistente: (m) => `Consistente: +${m}% aos pontos desta carta`,
  imparavel: (m) => `Imparável: vencer os 2 jogos da jornada dá +${m} pts de bónus`,
  resiliente: (m) => `Resiliente: +${m} pts por derrota — nunca desiste`,
  cacagrandes: (m) => `Caça-Grandes: vitórias contra equipas do top 8 valem +${m} pts extra`,
  clube: (m) => `Espírito de Clube: +${m}% aos pontos das tuas cartas do mesmo clube`,
  mentor: (m) => `Mentor: +${m} pts a cada uma das outras cartas da tua equipa`,
  fortaleza: (m) => `Fortaleza: +${m} pts por cada derrota da tua equipa — amortece jornadas más`,
  hype: (m) => `Hype: o teu capitão ganha +${m}% aos pontos — a bancada ao rubro`,
  vozdaliga: (m) => `Voz da Liga: +${m} pts garantidos por jornada, faça chuva ou faça sol`,
  analista: (m) => `Analista: +${m} pts por cada empate da tua equipa — vê o que ninguém vê`,
};
// O tipo de efeito da carta base é estável (hash do id base). As edições especiais
// têm garantidamente um efeito DIFERENTE da carta base do mesmo jogador/clube —
// é essa a vantagem real de uma especial com a mesma raridade da base (ex.: Leks
// Épica base "Vencedor" vs Leks ETAPA 1 Épica com outro efeito).
function fxTypeFor(card) {
  const pool = card.isCaster ? CASTER_FX : card.isClub ? CLUB_FX : PLAYER_FX;
  const baseKey = card.isCaster
    ? "cast-" + (card.casterRef || card.id.replace("cast-", ""))
    : card.isClub ? "club-" + card.team : (card.ref ? "pl-" + card.ref : card.id);
  const baseIdx = hash(baseKey + "fx") % pool.length;
  if (!card.edition) return pool[baseIdx];
  const offset = 1 + (hash(card.id + "fx") % (pool.length - 1));
  return pool[(baseIdx + offset) % pool.length];
}
function effectOf(card) {
  const t = fxTypeFor(card);
  const m = FX_MAG[card.rarity][t];
  return { tipo: t, mag: m, label: FX_LABEL[t](m) };
}

/* pontuação por jornada (2 jogos) — valores visíveis no separador Competição.
   A simulação em si (simulatePerformance/scoreLineup) corre agora no servidor
   — ver supabase/functions/_shared/jornadaScore.ts e play-jornada. */
const SCORING = {
  jogador: { vit: 20, emp: 10, der: 2, golo: 3 },
  clube: { vit: 25, emp: 12, der: 5 },
};

// nomes dos "bots" de preenchimento do ranking — semeados em
// supabase/fase4_leaderboard.sql, evoluem no servidor (ver register_jornada)

/* ---------- som (sintetizado, sem ficheiros) e háptica ---------- */
let _audioCtx = null;
function playFx(kind, muted) {
  if (muted) return;
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const tone = (f, t0, dur, type = "triangle", vol = 0.16) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(vol, now + t0);
      g.gain.exponentialRampToValueAtTime(0.001, now + t0 + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(now + t0); o.stop(now + t0 + dur);
    };
    if (kind === "tear") {
      const len = 0.22, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.6;
      const s = ctx.createBufferSource(); s.buffer = buf;
      // filtro passa-baixo: tira o "chiado" agudo, fica mais um rasgar de papel surdo
      const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 1500; filter.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0.16;
      s.connect(filter); filter.connect(g); g.connect(ctx.destination); s.start();
    }
    if (kind === "flip") tone(520, 0, 0.07, "sine", 0.1);
    if (kind === "comum") tone(440, 0, 0.14, "sine", 0.1);
    if (kind === "rara") { tone(523, 0, 0.14); tone(659, 0.09, 0.22); }
    if (kind === "epica") { tone(523, 0, 0.12); tone(659, 0.09, 0.12); tone(784, 0.18, 0.32, "triangle", 0.2); }
    if (kind === "lendaria") { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.36, "triangle", 0.2)); tone(1319, 0.42, 0.55, "sine", 0.16); }
  } catch (e) { /* sem áudio disponível */ }
}
function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* sem háptica */ } }

// extrai uma mensagem de erro amigável da resposta de supabase.functions.invoke
async function fnErrorMessage(error, data, fallback = "Não foi possível completar a ação. Tenta novamente.") {
  if (error?.context) {
    try { const body = await error.context.json(); if (body?.error) return body.error; } catch (e) { /* ignora */ }
  }
  if (data?.error) return data.error;
  if (error) return fallback;
  return fallback;
}

/* ---------- showcase: desenhar a carta num canvas e exportar PNG ---------- */
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function _loadImg(srcUrl) {
  // o site da eLiga não envia cabeçalhos CORS, por isso a imagem direta "contamina"
  // o canvas; em fallback usamos um proxy de imagens com CORS aberto. Em produção,
  // com as imagens no mesmo domínio, o caminho direto funciona sempre.
  const tryLoad = (u) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = u; });
  const prox = "https://images.weserv.nl/?url=" + encodeURIComponent(srcUrl.replace(/^https?:\/\//, ""));
  return tryLoad(srcUrl).catch(() => tryLoad(prox));
}
function _wrapText(ctx, text, x, y, maxW, lineH, maxLines = 99) {
  const words = text.split(" ");
  let line = "", yy = y, lines = 0;
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi];
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines++;
      if (lines === maxLines) {
        while (ctx.measureText(line + "…").width > maxW && line.length) line = line.slice(0, -1);
        ctx.fillText(line + "…", x, yy); return yy;
      }
      ctx.fillText(line, x, yy); line = w; yy += lineH;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}
async function cardToPng(card, withImages = true) {
  const W = 600, H = 852;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const palettes = {
    lendaria: ["#39E6FF", "#1BF5A3", "#F2C14E", "#FF5CE1"],
    epica: ["#5a1e9e", "#B45CFF", "#ecd6ff", "#B45CFF"],
    rara: ["#8a6420", "#F2C14E", "#fff0c2", "#F2C14E"],
    comum: ["#5d6b80", "#9FB0C8", "#c9d4e4", "#9FB0C8"],
  };
  const pal = palettes[card.rarity];
  const frame = ctx.createLinearGradient(0, 0, W, H);
  pal.forEach((c, i) => frame.addColorStop(i / (pal.length - 1), c));
  _roundRect(ctx, 0, 0, W, H, 30); ctx.fillStyle = frame; ctx.fill();
  _roundRect(ctx, 14, 14, W - 28, H - 28, 22);
  const bg = ctx.createRadialGradient(W / 2, 60, 40, W / 2, H / 2, H);
  bg.addColorStop(0, (card.teamData?.color || "#1BF5A3") + "55"); bg.addColorStop(0.55, "#0B1226"); bg.addColorStop(1, "#060A16");
  ctx.fillStyle = bg; ctx.fill();
  ctx.save(); _roundRect(ctx, 14, 14, W - 28, H - 28, 22); ctx.clip();
  const topPad = card.edition ? 64 : 14;
  if (card.edition) {
    ctx.fillStyle = frame; ctx.fillRect(14, 14, W - 28, 48);
    ctx.fillStyle = "#06101a"; ctx.font = "bold 24px 'Chakra Petch', sans-serif";
    ctx.textAlign = "center"; ctx.fillText(card.edition, W / 2, 47); ctx.textAlign = "left";
  }
  if (withImages) {
    try {
      const img = await _loadImg(card.isClub ? LOGO_BASE + card.teamData.logo : PHOTO_BASE + card.photo);
      const areaH = H - 260 - topPad;
      const scale = Math.min((W - 120) / img.width, areaH / img.height);
      const iw = img.width * scale, ih = img.height * scale;
      ctx.drawImage(img, (W - iw) / 2, H - 245 - ih, iw, ih);
    } catch (e) { /* imagem indisponível — exporta sem foto */ }
  }
  const plate = ctx.createLinearGradient(0, H - 330, 0, H);
  plate.addColorStop(0, "rgba(4,8,18,0)"); plate.addColorStop(0.4, "rgba(4,8,18,0.94)");
  ctx.fillStyle = plate; ctx.fillRect(14, H - 330, W - 28, 316);
  if (!card.isClub) {
    ctx.fillStyle = "#fff"; ctx.font = "bold 76px 'Chakra Petch', sans-serif";
    ctx.fillText(String(card.ovr), 40, topPad + 78);
    ctx.fillStyle = pal[1]; ctx.font = "16px 'Chakra Petch', sans-serif";
    ctx.fillText(card.isCaster ? card.role.split("").join(" ") : "P R O", 42, topPad + 102);
  } else {
    ctx.fillStyle = pal[1]; ctx.font = "16px 'Chakra Petch', sans-serif";
    ctx.fillText("C L U B E", 40, topPad + 36);
  }
  let y = H - 206;
  if (card.tag) { ctx.fillStyle = pal[1]; ctx.font = "18px 'Chakra Petch', sans-serif"; ctx.fillText("★ " + card.tag.toUpperCase(), 40, y); y += 34; }
  ctx.fillStyle = "#fff"; ctx.font = "bold 42px 'Chakra Petch', sans-serif";
  ctx.fillText(card.name, 40, y); y += 36;
  if (card.isCaster) {
    ctx.fillStyle = "#39E6FF"; ctx.font = "20px 'Chakra Petch', sans-serif";
    ctx.fillText(`🎙 ${card.role} OFICIAL eLIGA`, 40, y); y += 32;
  } else if (!card.isClub && card.j > 0) {
    ctx.fillStyle = "#c4d2e6"; ctx.font = "22px 'Chakra Petch', sans-serif";
    ctx.fillText(`${card.j} J   ·   ${card.v} %V   ·   ${card.mg} G/J`, 40, y); y += 32;
  }
  ctx.fillStyle = pal[1]; ctx.font = "19px sans-serif";
  _wrapText(ctx, "⚡ " + effectOf(card).label, 40, y, W - 90, 25, 2);
  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "15px 'Chakra Petch', sans-serif";
  ctx.fillText("eLIGA PORTUGAL · CARTAS", 40, H - 30);
  ctx.restore();
  try {
    return cv.toDataURL("image/png");
  } catch (e) {
    // canvas "tainted" (imagem sem CORS) — re-renderiza sem imagem
    if (withImages) return cardToPng(card, false);
    throw e;
  }
}

async function packToPng(cards) {
  const urls = [];
  for (const c of cards) urls.push(await cardToPng(c));
  const imgs = await Promise.all(urls.map((u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; })));
  const cw = 380, ch = Math.round(380 * 852 / 600), pad = 26, headH = 76;
  const W = cw * imgs.length + pad * (imgs.length + 1), H = ch + pad * 2 + headH;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0C1730"); bg.addColorStop(1, "#060A16");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1BF5A3"; ctx.font = "bold 30px 'Chakra Petch', sans-serif"; ctx.textAlign = "center";
  ctx.fillText("eLIGA PORTUGAL · CARTAS", W / 2, 50); ctx.textAlign = "left";
  imgs.forEach((im, i) => ctx.drawImage(im, pad + i * (cw + pad), headH, cw, ch));
  return cv.toDataURL("image/png");
}

// armazenamento: localStorage em produção (Vercel), com fallback em memória
const memStore = {};
const store = {
  async get(k) {
    try { const v = localStorage.getItem(k); return v !== null ? v : (memStore[k] ?? null); }
    catch (e) { return memStore[k] ?? null; }
  },
  async set(k, v) {
    memStore[k] = v;
    try { localStorage.setItem(k, v); } catch (e) { /* quota excedida, fica em memória */ }
  },
  async delete(k) {
    delete memStore[k];
    try { localStorage.removeItem(k); } catch (e) {}
  },
};

// Fase 2: na primeira entrada de uma conta sem progresso ainda guardado no Supabase,
// tenta recuperar o que foi jogado localmente (Fase 0/1) com o mesmo nome de jogador.
async function loadLegacyLocalState(username) {
  try {
    const rawCol = await store.get("eliga-tcg-col-" + username);
    if (rawCol === null) return null; // nada para migrar
    const collection = JSON.parse(rawCol || "{}");
    const meta = JSON.parse((await store.get("eliga-tcg-meta-" + username)) || "{}");
    const rawL = await store.get("eliga-tcg-lineup-" + username);
    let lineup = { ids: [null, null, null], captain: null };
    if (rawL) {
      const d = JSON.parse(rawL);
      lineup = Array.isArray(d) ? { ids: d, captain: null } : { ids: d.ids || [null, null, null], captain: d.captain ?? null };
    }
    const hist = JSON.parse((await store.get("eliga-tcg-hist-" + username)) || "[]");
    const codesUsed = JSON.parse((await store.get("eliga-tcg-codes-" + username)) || "[]");
    let escolhas = parseInt((await store.get("eliga-tcg-escolhas-" + username)) || "0") || 0;
    const seeded = await store.get("eliga-tcg-esc-seed-" + username);
    if (!seeded) escolhas += 5;
    const rawSlot = await store.get("eliga-tcg-esc-slot-" + username);
    const escSlot = rawSlot ? parseInt(rawSlot) : Math.floor(Date.now() / PICK_SLOT_MS);
    const picksUsed = JSON.parse((await store.get("eliga-tcg-picksused-" + username)) || "{}");
    const jHist = JSON.parse((await store.get("eliga-tcg-jhist-" + username)) || "[]");
    const vitrine = JSON.parse((await store.get("eliga-tcg-vitrine-" + username)) || "[null,null,null]");
    const rawPr = await store.get("eliga-tcg-prev-" + username);
    const prevRaw = rawPr ? JSON.parse(rawPr) : null;
    const prev = prevRaw && prevRaw.groupResult !== undefined ? prevRaw : EMPTY_PREV;
    const muted = (await store.get("eliga-tcg-mute")) === "1";
    const onboardDone = !!(await store.get("eliga-tcg-onboard-" + username));
    return { collection, meta, lineup, hist, codesUsed, escolhas, escSlot, picksUsed, jHist, vitrine, prev, muted, onboardDone };
  } catch (e) {
    return null;
  }
}

const FONT = "'Chakra Petch',sans-serif";
const btn = (primary) => ({
  fontFamily: FONT, fontWeight: 700, fontSize: 13, letterSpacing: 1,
  padding: "12px 22px", borderRadius: 10, cursor: "pointer",
  background: primary ? "#1BF5A3" : "transparent", color: primary ? "#04140c" : "#1BF5A3",
  border: primary ? "none" : "1px solid #1BF5A366",
});

/* ---------- logo de clube com fallback ---------- */
function ClubLogo({ team, size, dim }) {
  const [err, setErr] = useState(false);
  if (!team) return null;
  if (err)
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: team.color + "33", border: `2px solid ${team.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 700, fontSize: size * 0.28, color: "#fff" }}>{team.short}</div>
    );
  return <img src={LOGO_BASE + team.logo} alt={team.name} loading="lazy" onError={() => setErr(true)} style={{ width: size, height: size, objectFit: "contain", filter: dim ? "grayscale(1) brightness(0.45)" : "drop-shadow(0 6px 18px rgba(0,0,0,0.55))" }} draggable={false} />;
}

/* ---------- foto de jogador com fallback para o escudo ---------- */
function PlayerArt({ card, height, dim }) {
  const [err, setErr] = useState(false);
  if ((!card.photo || err) && card.isCaster)
    return (
      <div style={{ height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: height * 0.04, filter: dim ? "grayscale(1) brightness(0.45)" : "none" }}>
        <div style={{ fontSize: height * 0.34, filter: "drop-shadow(0 8px 18px rgba(57,230,255,0.35))" }}>🎙</div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: height * 0.13, color: "#39E6FF", letterSpacing: 2, textShadow: "0 0 18px rgba(57,230,255,0.5)" }}>{card.name.split(" ").map((w) => w[0]).join("").toUpperCase()}</div>
      </div>
    );
  if (!card.photo || err)
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}><ClubLogo team={card.teamData} size={height * 0.75} dim={dim} /></div>;
  return (
    <img src={PHOTO_BASE + card.photo} alt={card.name} loading="lazy" onError={() => setErr(true)} draggable={false}
      style={{ height, width: "100%", objectFit: "contain", objectPosition: "bottom center", filter: dim ? "grayscale(1) brightness(0.45)" : "drop-shadow(0 10px 24px rgba(0,0,0,0.6))" }} />
  );
}

/* ---------- a carta: folha holográfica + tilt 3D ---------- */
function Card({ card, width = 220, interactive = true, dim = false, showcase = false }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50, on: false });
  const r = RARITY[card.rarity];
  const h = width * 1.42;
  const fs = width / 220;
  const onMove = (e) => {
    if (!interactive || !ref.current) return;
    const b = ref.current.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    setTilt({ rx: (0.5 - y) * 16, ry: (x - 0.5) * 16, gx: x * 100, gy: y * 100, on: true });
  };
  const reset = () => setTilt({ rx: 0, ry: 0, gx: 50, gy: 50, on: false });

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={reset} style={{ width, height: h, perspective: 900, cursor: interactive ? "pointer" : "default", flexShrink: 0 }}>
      <div style={{
        width: "100%", height: "100%", borderRadius: 14 * fs, position: "relative",
        transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: tilt.on ? "transform 60ms linear" : "transform 350ms ease",
        transformStyle: "preserve-3d", background: r.frame, padding: 5 * fs,
        boxShadow: dim ? "none" : `0 ${10 * fs}px ${30 * fs}px rgba(0,0,0,0.55), 0 0 ${26 * fs}px ${r.glow}`,
        filter: dim ? "grayscale(1) brightness(0.5)" : "none",
      }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 10 * fs, overflow: "hidden", position: "relative", background: `radial-gradient(120% 90% at 50% 0%, ${card.teamData?.color || "#39E6FF"}40 0%, #0B1226 55%, #060A16 100%)` }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "repeating-linear-gradient(115deg, transparent 0 10px, rgba(255,255,255,0.5) 10px 11px)" }} />
          {card.edition && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: r.frame, color: "#06101a", fontFamily: FONT, fontWeight: 700, fontSize: 9 * fs, letterSpacing: 2, padding: `${3.5 * fs}px 0`, textAlign: "center", zIndex: 3, whiteSpace: "nowrap", overflow: "hidden" }}>{card.edition}</div>
          )}
          <div style={{ position: "absolute", top: (card.edition ? 28 : 10) * fs, left: 12 * fs, zIndex: 2 }}>
            {!card.isClub && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 34 * fs, lineHeight: 1, color: "#fff", textShadow: `0 0 ${14 * fs}px ${r.glow}` }}>{card.ovr}</div>}
            <div style={{ fontFamily: FONT, fontSize: 9 * fs, letterSpacing: 2, color: r.color, marginTop: 2 * fs }}>{card.isCaster ? card.role : card.isClub ? "CLUBE" : "PRO"}</div>
          </div>
          {/* arte: foto do jogador ou escudo do clube */}
          {card.isClub ? (
            <div style={{ position: "absolute", top: "22%", left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 1 }}>
              <ClubLogo team={card.teamData} size={122 * fs} dim={dim} />
            </div>
          ) : (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 62 * fs, zIndex: 1 }}>
              <PlayerArt card={card} height={190 * fs} dim={dim} />
            </div>
          )}
          {!card.isClub && card.teamData && (
            <div style={{ position: "absolute", top: (card.edition ? 30 : 12) * fs, right: 12 * fs, zIndex: 2, opacity: 0.95 }}>
              <ClubLogo team={card.teamData} size={26 * fs} />
            </div>
          )}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: `${10 * fs}px ${12 * fs}px ${12 * fs}px`, background: "linear-gradient(180deg, transparent, rgba(4,8,18,0.92) 34%)", zIndex: 2 }}>
            {card.tag && <div style={{ fontFamily: FONT, fontSize: 8.5 * fs, letterSpacing: 1.5, color: r.color, marginBottom: 2 * fs }}>★ {card.tag.toUpperCase()}</div>}
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: (card.name.length > 16 ? 13 : 16) * fs, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.name}</div>
            {card.isCaster && (
              <div style={{ marginTop: 6 * fs, borderTop: `1px solid ${r.color}55`, paddingTop: 6 * fs, fontSize: 9 * fs, letterSpacing: 1.5, color: r.color, fontFamily: FONT }}>🎙 {card.role} OFICIAL eLIGA</div>
            )}
            {!card.isClub && !card.isCaster && (card.j > 0 ? (
              <div style={{ display: "flex", gap: 10 * fs, marginTop: 6 * fs, borderTop: `1px solid ${r.color}55`, paddingTop: 6 * fs }}>
                {[["J", card.j], ["%V", card.v], ["G/J", card.mg]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 3 * fs }}>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13 * fs, color: "#fff" }}>{v}</span>
                    <span style={{ fontSize: 8 * fs, letterSpacing: 1, color: "#8fa3bd" }}>{k}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 6 * fs, borderTop: `1px solid ${r.color}55`, paddingTop: 6 * fs, fontSize: 9 * fs, letterSpacing: 1.5, color: "#8fa3bd", fontFamily: FONT }}>ESTREANTE 25/26</div>
            ))}
          </div>
          {!dim && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none", mixBlendMode: "overlay",
              background: card.rarity === "lendaria"
                ? `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.85), transparent 32%), linear-gradient(${115 + tilt.ry * 3}deg, rgba(57,230,255,0.35), rgba(255,92,225,0.3) 40%, rgba(242,193,78,0.35) 70%, transparent)`
                : card.rarity === "epica"
                  ? `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.7), transparent 30%), linear-gradient(${115 + tilt.ry * 3}deg, rgba(180,92,255,0.3), transparent 60%)`
                  : `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,${card.rarity === "rara" ? 0.55 : 0.3}), transparent 30%)`,
              opacity: tilt.on ? 1 : showcase ? 0.85 : card.rarity === "lendaria" ? 0.5 : 0.25, transition: "opacity 300ms",
            }} />
          )}
          {showcase && !dim && (
            <div style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none", mixBlendMode: "overlay", background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)", backgroundSize: "300% 100%", animation: "sheen 2.4s ease-in-out infinite" }} />
          )}
        </div>
      </div>
    </div>
  );
}

function CardBack({ width = 220 }) {
  const h = width * 1.42;
  return (
    <div style={{ width, height: h, borderRadius: 14, background: "linear-gradient(160deg,#0E2A4A,#06101f)", border: "2px solid #1BF5A355", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg, transparent 0 14px, rgba(27,245,163,0.06) 14px 15px)" }} />
      <img src={ELIGA_LOGO} alt="eLiga" style={{ width: width * 0.62, opacity: 0.9 }} draggable={false} onError={(e) => (e.target.style.display = "none")} />
    </div>
  );
}

/* ---------- abertura: packs e trocas (mesmo fluxo de reveal) ---------- */
function PackOpening({ pack, cards, ownedBefore, initialPhase = "pack", muted = false, onShare, onSharePack, onDone, onAgain, againLabel = "Abrir outro" }) {
  // uma carta é "NOVA" se não a tinhas antes deste pack E é a primeira aparição dela dentro do pack
  // (duplicados no mesmo pack não contam como novos)
  const isNew = (cardIdx) => !ownedBefore.has(cards[cardIdx].id) && cards.findIndex((x) => x.id === cards[cardIdx].id) === cardIdx;
  const [phase, setPhase] = useState(initialPhase);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [fx, setFx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tearProg, setTearProg] = useState(0);
  const tearing = useRef(false);
  const dragRef = useRef(null);
  const onTearDown = (e) => {
    if (phase !== "pack") return;
    tearing.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
  };
  const onTearMove = (e) => {
    if (!tearing.current || phase !== "pack" || !dragRef.current) return;
    const b = dragRef.current.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
    setTearProg((prev) => {
      const np = Math.max(prev, p);
      if (np >= 0.92 && prev < 0.92) { tearing.current = false; tear(); }
      return np;
    });
  };
  const onTearUp = () => {
    tearing.current = false;
    if (phase === "pack") setTearProg((p) => (p >= 0.92 ? p : 0));
  };
  const share = async (c, e) => {
    if (e) e.stopPropagation();
    if (busy || !onShare) return;
    setBusy(true); await onShare(c); setBusy(false);
  };
  const current = cards[idx];

  const tear = () => { playFx("tear", muted); buzz(25); setPhase("torn"); setTimeout(() => setPhase("reveal"), 1000); };
  const flip = () => {
    if (flipped) {
      playFx("flip", muted);
      setFlipped(false); setFx(null);
      if (idx + 1 >= cards.length) setPhase("summary");
      else setIdx(idx + 1);
    } else {
      setFlipped(true); setFx(current.rarity);
      playFx(current.rarity, muted);
      if (current.rarity === "epica") buzz(45);
      if (current.rarity === "lendaria") buzz([60, 40, 90]);
    }
  };

  const big = RARITY[fx || "comum"];
  const shake = fx === "lendaria";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "radial-gradient(120% 100% at 50% 0%, #0B1A33 0%, #04070f 70%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      className={shake && flipped ? "shake" : ""}>
      {flipped && (fx === "epica" || fx === "lendaria") && (
        <div style={{ position: "absolute", inset: "-50%", animation: "spin 9s linear infinite", background: `repeating-conic-gradient(from 0deg, ${fx === "lendaria" ? "rgba(57,230,255,0.16)" : "rgba(180,92,255,0.14)"} 0deg 8deg, transparent 8deg 22deg)`, pointerEvents: "none" }} />
      )}
      {flipped && fx && fx !== "comum" && <div key={idx + fx} style={{ position: "absolute", inset: 0, background: big.glow, animation: "flash 700ms ease-out forwards", pointerEvents: "none" }} />}
      {flipped && fx === "lendaria" && Array.from({ length: 26 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", top: "45%", left: "50%", width: 8, height: 12, background: ["#39E6FF", "#1BF5A3", "#F2C14E", "#FF5CE1"][i % 4], animation: `confetti 1.4s ${i * 0.03}s ease-out forwards`, "--dx": `${(Math.random() - 0.5) * 560}px`, "--dy": `${-180 - Math.random() * 320}px`, "--rot": `${Math.random() * 720}deg`, pointerEvents: "none" }} />
      ))}

      {phase === "pack" || phase === "torn" ? (
        <div style={{ textAlign: "center", animation: phase === "pack" && tearProg === 0 ? "float 2.8s ease-in-out infinite" : "none" }}>
          <div ref={dragRef} onPointerDown={onTearDown} onPointerMove={onTearMove} onPointerUp={onTearUp} onPointerCancel={onTearUp}
            style={{ width: 250, height: 360, position: "relative", margin: "0 auto", filter: "drop-shadow(0 26px 50px rgba(0,0,0,0.6))", animation: phase === "torn" ? "packAway 620ms ease-in 320ms forwards" : "none", touchAction: "none", cursor: phase === "pack" ? "grab" : "default" }}>
            {/* corpo do pack com frisos (crimp) em cima e em baixo, como uma saqueta real */}
            <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: pack.gradient, overflow: "hidden", boxShadow: `inset 0 0 50px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.25), 0 0 44px ${pack.accent}44` }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(115deg, transparent 0 12px, rgba(255,255,255,0.06) 12px 13px)" }} />
              {/* brilho metálico vertical (folha) */}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: "10%", width: 34, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, right: "16%", width: 16, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 48%, transparent 60%)", backgroundSize: "300% 100%", animation: "sheen 2.6s ease-in-out infinite" }} />
              {/* interior escuro do pack — fica visível onde a tampa já foi rasgada */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 62, background: "linear-gradient(180deg, #03060c, #0a1224)", boxShadow: "inset 0 -10px 16px rgba(0,0,0,0.7)", zIndex: 1 }} />
              {/* tampa OPACA que rasga: a parte cortada desaparece e revela o interior */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: pack.gradient, backgroundSize: "100% 360px", backgroundPosition: "0 0", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 8, animation: phase === "torn" ? "tear 650ms ease-in forwards" : "none", zIndex: 2, borderBottom: phase === "pack" ? `2px dashed ${pack.accent}` : "none", clipPath: `polygon(${tearProg * 100}% 0, 100% 0, 100% 100%, ${tearProg * 100}% 100%)` }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(115deg, transparent 0 12px, rgba(255,255,255,0.06) 12px 13px)" }} />
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 16, background: "repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0 3px, rgba(255,255,255,0.16) 3px 6px)", borderBottom: "1px solid rgba(0,0,0,0.5)" }} />
                <span style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 3, color: pack.accent, textShadow: "0 1px 6px rgba(0,0,0,0.8)", position: "relative" }}>{phase === "pack" && tearProg < 0.4 ? "ARRASTA PARA RASGAR →" : ""}</span>
              </div>
              {/* linha de corte e tesoura que seguem o dedo */}
              {phase === "pack" && tearProg > 0 && tearProg < 0.92 && (
                <div style={{ position: "absolute", top: 0, height: 62, left: `${tearProg * 100}%`, width: 0, zIndex: 3, pointerEvents: "none" }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: -1, width: 2, background: "#fff", boxShadow: `0 0 12px #fff, 0 0 22px ${pack.accent}` }} />
                  <span style={{ position: "absolute", top: 20, left: -11, fontSize: 20, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}>✂️</span>
                </div>
              )}
              {/* friso inferior */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 16, background: "repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0 3px, rgba(255,255,255,0.16) 3px 6px)", borderTop: "1px solid rgba(0,0,0,0.5)" }} />
              <div style={{ position: "absolute", top: "30%", left: 0, right: 0, textAlign: "center", padding: "0 16px" }}>
                <img src={ELIGA_LOGO} alt="" style={{ width: 120, margin: "0 auto 14px", display: "block" }} onError={(e) => (e.target.style.display = "none")} draggable={false} />
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>{pack.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>{pack.sub}</div>
              </div>
            </div>
          </div>
          {phase === "pack" && (
            <div style={{ marginTop: 18, fontSize: 12, color: "#6f87a8" }}>
              {tearProg === 0 ? "arrasta o dedo ao longo da linha tracejada, da esquerda para a direita" : tearProg < 0.92 ? `${Math.round(tearProg * 100)}% rasgado…` : ""}
            </div>
          )}
        </div>
      ) : phase === "reveal" ? (
        <div onClick={flip} style={{ cursor: "pointer", textAlign: "center" }}>
          <div style={{ height: 30, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
            {flipped && isNew(idx) && (
              <div style={{ background: "#1BF5A3", color: "#04140c", fontFamily: FONT, fontWeight: 700, fontSize: 11, letterSpacing: 1.5, padding: "4px 16px", borderRadius: 99, boxShadow: "0 0 18px rgba(27,245,163,0.75)", whiteSpace: "nowrap", animation: "pop 300ms ease-out" }}>NOVA</div>
            )}
          </div>
          <div style={{ perspective: 1100, animation: "pop 420ms ease-out" }} key={idx}>
            <div style={{ position: "relative", width: 260, height: 260 * 1.42, margin: "0 auto", transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)", transition: "transform 600ms cubic-bezier(.2,.7,.3,1.1)" }}>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}><CardBack width={260} /></div>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}><Card card={current} width={260} showcase={flipped} /></div>
            </div>
          </div>
          <div style={{ marginTop: 22, minHeight: 44 }}>
            {flipped ? (
              <>
                <div style={{ fontFamily: FONT, fontWeight: 700, letterSpacing: 3, fontSize: 14, color: big.color, textShadow: `0 0 16px ${big.glow}` }}>{RARITY[current.rarity].label.toUpperCase()}{current.edition ? ` · ${current.edition}` : ""}</div>
                <div style={{ fontSize: 12, color: RARITY[current.rarity].color, marginTop: 8, maxWidth: 300, marginLeft: "auto", marginRight: "auto", lineHeight: 1.45 }}>⚡ {effectOf(current).label}</div>
                <div style={{ fontSize: 11, color: "#6f87a8", marginTop: 8 }}>toca para continuar · {idx + 1}/{cards.length}</div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "#6f87a8", letterSpacing: 2 }}>TOCA PARA REVELAR · {idx + 1}/{cards.length}</div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", animation: "pop 400ms ease-out", padding: 16 }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: "#fff", marginBottom: 18 }}>{cards.length > 1 ? "Cartas obtidas" : "Carta obtida"}</div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {cards.map((c, i) => (
              <div key={i} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ position: "relative" }}>
                  <Card card={c} width={150} />
                  {isNew(i) && <div style={{ position: "absolute", top: c.edition ? -20 : -8, left: "50%", transform: "translateX(-50%)", background: "#1BF5A3", color: "#04140c", fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: 1, padding: "2px 8px", borderRadius: 99 }}>NOVA</div>}
                </div>
                <div style={{ fontSize: 9.5, color: RARITY[c.rarity].color, maxWidth: 150, lineHeight: 1.4 }}>⚡ {effectOf(c).label}</div>
                {onShare && <button onClick={(e) => share(c, e)} style={{ ...btn(false), padding: "5px 12px", fontSize: 10, opacity: busy ? 0.5 : 1 }}>↗ Partilhar</button>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 26, flexWrap: "wrap" }}>
            {onAgain && <button onClick={onAgain} style={btn(true)}>{againLabel}</button>}
            {onSharePack && cards.length > 1 && (
              <button onClick={async () => { if (busy) return; setBusy(true); await onSharePack(cards); setBusy(false); }} style={{ ...btn(false), opacity: busy ? 0.5 : 1 }}>
                {busy ? "A gerar…" : "↗ Partilhar pack"}
              </button>
            )}
            <button onClick={onDone} style={btn(!onAgain)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- ecrã de entrada (Supabase Auth: email + palavra-passe) ---------- */
// nome de jogador guardado em user_metadata.username no registo;
// fallback (contas criadas fora deste formulário) deriva-se do email.
function deriveUsername(user) {
  if (!user) return null;
  const meta = user.user_metadata?.username;
  if (meta && /^[a-z0-9_]{3,16}$/.test(meta)) return meta;
  const local = (user.email || "").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16);
  return local.length >= 3 ? local : "jogador";
}

function authErrorMessage(err) {
  const msg = err?.message || "";
  if (/already registered/i.test(msg)) return "Já existe uma conta com este email — tenta iniciar sessão.";
  if (/invalid login credentials/i.test(msg)) return "Email ou palavra-passe incorretos.";
  if (/password should be at least/i.test(msg)) return "A palavra-passe deve ter pelo menos 6 caracteres.";
  if (/unable to validate email|invalid email/i.test(msg)) return "Email inválido.";
  if (/email not confirmed/i.test(msg)) return "Confirma o teu email (verifica a caixa de entrada) antes de entrares.";
  if (/rate limit/i.test(msg)) return "Demasiadas tentativas — espera um pouco e tenta novamente.";
  return msg || "Ocorreu um erro. Tenta novamente.";
}

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [user, setUser] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setError("Indica um email válido."); return; }
    if (pass.length < 6) { setError("A palavra-passe deve ter pelo menos 6 caracteres."); return; }
    setBusy(true); setError(""); setInfo("");

    if (mode === "registo") {
      const u = user.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,16}$/.test(u)) { setError("O nome de jogador deve ter 3–16 caracteres (letras, números, _)."); setBusy(false); return; }
      const { data, error: err } = await supabase.auth.signUp({
        email: em, password: pass, options: { data: { username: u } },
      });
      if (err) { setError(authErrorMessage(err)); setBusy(false); return; }
      if (!data.session) {
        setInfo("Conta criada! Verifica o teu email para confirmar a conta e depois inicia sessão.");
        setMode("login"); setBusy(false); return;
      }
      onLogin(deriveUsername(data.user));
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email: em, password: pass });
      if (err) { setError(authErrorMessage(err)); setBusy(false); return; }
      onLogin(deriveUsername(data.user));
    }
  };

  const input = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid #22304d", background: "#0A1126", color: "#E7EEF8", fontSize: 14, outline: "none", fontFamily: "system-ui,sans-serif" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: 380, maxWidth: "100%", background: "#0E162E", border: "1px solid #1BF5A333", borderRadius: 18, padding: 28, boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
        <img src={ELIGA_LOGO} alt="eLiga Portugal" style={{ height: 40, display: "block", margin: "0 auto 6px" }} onError={(e) => (e.target.style.display = "none")} />
        <div style={{ textAlign: "center", fontFamily: FONT, fontWeight: 700, letterSpacing: 3, fontSize: 13, color: "#1BF5A3", marginBottom: 20 }}>CARTAS COLECIONÁVEIS</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "#0A1126", borderRadius: 10, padding: 4 }}>
          {[["login", "Iniciar sessão"], ["registo", "Criar conta"]].map(([k, label]) => (
            <button key={k} onClick={() => { setMode(k); setError(""); setInfo(""); }} style={{ flex: 1, fontFamily: FONT, fontWeight: 600, fontSize: 13, padding: "9px 0", borderRadius: 8, cursor: "pointer", border: "none", background: mode === k ? "#1BF5A3" : "transparent", color: mode === k ? "#04140c" : "#9FB0C8" }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "registo" && (
            <div>
              <label style={{ fontSize: 11, letterSpacing: 1.5, color: "#8fa3bd", fontFamily: FONT }}>NOME DE JOGADOR</label>
              <input style={{ ...input, marginTop: 6 }} value={user} onChange={(e) => setUser(e.target.value)} placeholder="ex: campeao_slb" maxLength={16} onKeyDown={(e) => e.key === "Enter" && submit()} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, letterSpacing: 1.5, color: "#8fa3bd", fontFamily: FONT }}>EMAIL</label>
            <input style={{ ...input, marginTop: 6 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@exemplo.com" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          <div>
            <label style={{ fontSize: 11, letterSpacing: 1.5, color: "#8fa3bd", fontFamily: FONT }}>PALAVRA-PASSE</label>
            <input style={{ ...input, marginTop: 6 }} type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#ff7b8a", background: "#ff7b8a14", border: "1px solid #ff7b8a33", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}
          {info && <div style={{ fontSize: 12, color: "#1BF5A3", background: "#1BF5A314", border: "1px solid #1BF5A333", borderRadius: 8, padding: "8px 12px" }}>{info}</div>}
          <button onClick={submit} disabled={busy} style={{ ...btn(true), width: "100%", opacity: busy ? 0.6 : 1, marginTop: 4 }}>
            {busy ? "Um momento…" : mode === "registo" ? "Criar conta e jogar" : "Entrar"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#44557a", textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
          Conta da eLiga Cartas — a tua coleção fica associada a esta conta.<br />
          {mode === "registo" ? "Já tens conta? Muda para \"Iniciar sessão\"." : "Ainda sem conta? Cria uma em \"Criar conta\"."}
        </div>
      </div>
    </div>
  );
}

/* ---------- um conjunto de Escolhas: junta no meio, baralha, separa, escolhe ---------- */
function WonderBoard({ idx, board, boardKey, used, canUse, muted, onPick, nextIn, cost = 1, premium = false }) {
  const [phase, setPhase] = useState("idle"); // idle | stack | pick | revealed
  const [order, setOrder] = useState([0, 1, 2, 3, 4]);
  const [chosen, setChosen] = useState(null);
  useEffect(() => { setPhase("idle"); setChosen(null); setOrder([0, 1, 2, 3, 4]); }, [boardKey]);
  const start = () => {
    if (!canUse || used || phase !== "idle") return;
    playFx("flip", muted); buzz(20);
    setOrder([0, 1, 2, 3, 4].sort(() => Math.random() - 0.5));
    setPhase("stack");
    setTimeout(() => setPhase("pick"), 1600);
  };
  const choose = async (pos) => {
    if (phase !== "pick") return;
    setPhase("checking");
    const ok = await onPick(board[order[pos]], boardKey, cost);
    if (ok) { setChosen(pos); setPhase("revealed"); }
    else setPhase("pick");
  };
  const faceUp = phase === "idle" || phase === "revealed";
  const W = 116, H = W * 1.42;
  return (
    <section style={{ background: premium ? "linear-gradient(135deg, #1a1608, #0E162E)" : "#0E162E", border: `1px solid ${used && phase !== "revealed" ? "#1a2440" : premium ? "#F2C14E66" : "#22304d"}`, borderRadius: 16, padding: "14px 14px 18px", marginTop: 16, boxShadow: premium && !used ? "0 0 26px rgba(242,193,78,0.12)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, letterSpacing: 2, color: used ? "#5c6c88" : premium ? "#F2C14E" : "#1BF5A3" }}>{premium ? "★ CONJUNTO PREMIUM" : `CONJUNTO ${idx + 1}`}</span>
        {premium && !used && <span style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 1, color: "#F2C14E", border: "1px solid #F2C14E55", borderRadius: 99, padding: "3px 10px" }}>SEM COMUNS · {cost} ESCOLHAS</span>}
        {used && phase !== "revealed" && <span style={{ fontFamily: FONT, fontSize: 11, color: "#6f87a8" }}>✓ escolha usada · renova em {nextIn}</span>}
      </div>
      {phase === "stack" ? (
        /* as 5 cartas juntam-se ao centro, baralham, e depois separam-se viradas */
        <div style={{ height: H + 28, position: "relative" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ position: "absolute", left: "50%", top: 6, marginLeft: -W / 2, transform: `rotate(${(i - 2) * 5}deg) translateY(${Math.abs(i - 2) * 2}px)`, animation: `wob 0.42s ease-in-out ${i * 0.06}s 3` }}>
              <CardBack width={W} />
            </div>
          ))}
          <div style={{ position: "absolute", bottom: -4, left: 0, right: 0, textAlign: "center", fontFamily: FONT, fontSize: 12, letterSpacing: 2, color: "#39E6FF" }}>A BARALHAR…</div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {[0, 1, 2, 3, 4].map((pos) => {
            const card = phase === "idle" ? board[pos] : board[order[pos]];
            const isChosen = phase === "revealed" && chosen === pos;
            return (
              <div key={pos} onClick={() => choose(pos)} style={{ position: "relative", cursor: phase === "pick" ? "pointer" : "default", transform: isChosen ? "translateY(-10px) scale(1.05)" : "none", transition: "transform 300ms", animation: phase === "pick" ? "pop 350ms ease-out" : "none" }}>
                <div style={{ perspective: 800 }}>
                  <div style={{ position: "relative", width: W, height: H, transformStyle: "preserve-3d", transform: faceUp ? "rotateY(0deg)" : "rotateY(180deg)", transition: "transform 480ms ease" }}>
                    {/* frente invisível enquanto virada — sem brilho de raridade a denunciar */}
                    <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", opacity: faceUp ? 1 : 0, transition: "opacity 180ms 160ms", filter: (phase === "revealed" && !isChosen) || (used && phase === "idle") ? "grayscale(0.6) brightness(0.55)" : "none" }}>
                      <Card card={card} width={W} interactive={false} showcase={isChosen} />
                    </div>
                    <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                      <CardBack width={W} />
                    </div>
                  </div>
                </div>
                {isChosen && <div style={{ position: "absolute", top: card.edition ? -22 : -11, left: "50%", transform: "translateX(-50%)", background: "#1BF5A3", color: "#04140c", fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: 1, padding: "3px 10px", borderRadius: 99, boxShadow: "0 0 14px rgba(27,245,163,0.7)", whiteSpace: "nowrap", zIndex: 5 }}>GANHASTE!</div>}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ textAlign: "center", marginTop: 14 }}>
        {phase === "idle" && !used && (
          <button onClick={start} disabled={!canUse} style={{ ...btn(canUse), padding: "10px 22px", fontSize: 12, opacity: canUse ? 1 : 0.35, cursor: canUse ? "pointer" : "not-allowed" }}>
            {canUse ? `Usar ${cost} Escolha${cost > 1 ? "s" : ""} 🎯` : cost > 1 ? `Precisas de ${cost} Escolhas` : "Sem Escolhas"}
          </button>
        )}
        {phase === "pick" && <div style={{ fontFamily: FONT, fontSize: 13, letterSpacing: 2, color: "#1BF5A3", animation: "float 2s ease-in-out infinite" }}>TOCA NUMA CARTA</div>}
        {phase === "checking" && <div style={{ fontFamily: FONT, fontSize: 13, letterSpacing: 2, color: "#8fa3bd" }}>A CONFIRMAR…</div>}
        {phase === "revealed" && chosen !== null && (
          <div style={{ fontSize: 12, color: "#9FB0C8" }}>
            Ganhaste <b style={{ color: RARITY[board[order[chosen]].rarity].color }}>{board[order[chosen]].name}</b> — assim ficaram baralhadas.
            <div style={{ fontSize: 11, color: RARITY[board[order[chosen]].rarity].color, marginTop: 6 }}>⚡ {effectOf(board[order[chosen]]).label}</div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- app ---------- */
const TRADE_COST = 10;

function App() {
  const [username, setUsername] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("loja");
  const [collection, setCollection] = useState({});
  const [meta, setMeta] = useState({ dias: [], packs: {}, claims: {}, pity: 0 });
  const [tradePreview, setTradePreview] = useState(null);
  const [lineup, setLineup] = useState([null, null, null]);
  const [captain, setCaptain] = useState(null);
  const [pickSlot, setPickSlot] = useState(null);
  const [compResult, setCompResult] = useState(null);
  const [rank, setRank] = useState({ scores: {} });
  const [hist, setHist] = useState([]);
  const [muted, setMuted] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codesUsed, setCodesUsed] = useState([]);
  const [jHist, setJHist] = useState([]);
  const [vitrine, setVitrine] = useState([null, null, null]);
  const [vitrinePick, setVitrinePick] = useState(null);
  const [directTrade, setDirectTrade] = useState(null);
  const [prev, setPrev] = useState(EMPTY_PREV);
  const [escolhas, setEscolhas] = useState(0);
  const [escSlot, setEscSlot] = useState(null);
  const [picksUsed, setPicksUsed] = useState({});
  const [now, setNow] = useState(Date.now());

  const [onboardStep, setOnboardStep] = useState(null);
  const [points] = useState(1250);
  const [opening, setOpening] = useState(null);
  const [filter, setFilter] = useState("todas");
  const [clubFilter, setClubFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("raridade");
  const [pickClub, setPickClub] = useState("todos");
  const [zoom, setZoom] = useState(null);
  const loaded = useRef(false);

  // sessão Supabase Auth + bump global das Escolhas
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (active && data.session) {
        setUserId(data.session.user.id);
        setUsername(deriveUsername(data.session.user));
      }
      if (active) setAuthChecked(true);
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session ? session.user.id : null);
      setUsername(session ? deriveUsername(session.user) : null);
    });
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => { active = false; listener.subscription.unsubscribe(); clearInterval(t); };
  }, []);

  // carregar progresso do utilizador a partir do Supabase (profiles.state),
  // com migração pontual do que existia em localStorage nas Fases 0/1
  useEffect(() => {
    if (!username || !userId) return;
    loaded.current = false;
    (async () => {
      // ranking — partilhado, vem do Supabase (Fase 4)
      try {
        const { data: lb, error } = await supabase.from("leaderboard").select("username, score").order("score", { ascending: false });
        if (!error && lb) {
          const scores = {};
          lb.forEach((r) => { scores[r.username] = r.score; });
          setRank({ scores });
        } else {
          setRank({ scores: {} });
        }
      } catch (e) { setRank({ scores: {} }); }

      let profile = null;
      try {
        const { data, error } = await supabase.from("profiles").select("username, state, is_admin").eq("id", userId).single();
        if (!error) profile = data;
      } catch (e) { /* sem ligação — segue com defaults/legado */ }

      setIsAdmin(!!profile?.is_admin);
      if (profile?.username && profile.username !== username) setUsername(profile.username);

      let st = profile?.state && Object.keys(profile.state).length > 0 ? profile.state : null;
      if (!st) st = await loadLegacyLocalState(username);
      st = st || {};

      setCollection(st.collection || {});

      const m = st.meta || {};
      const dias = m.dias || [];
      const t = todayStr();
      setMeta({ dias: dias.includes(t) ? dias : [...dias, t].slice(-90), packs: m.packs || {}, claims: m.claims || {}, pity: m.pity || 0, trocas: m.trocas || {}, escUso: m.escUso || {}, trivia: m.trivia || {} });

      const lin = st.lineup || {};
      setLineup(lin.ids || [null, null, null]);
      setCaptain(lin.captain ?? null);

      setHist(st.hist || []);
      setCodesUsed(st.codesUsed || []);
      // contas novas (sem progresso anterior) arrancam com 5 Escolhas de oferta
      setEscolhas(st.escolhas !== undefined ? st.escolhas : 5);
      setEscSlot(st.escSlot ?? Math.floor(Date.now() / PICK_SLOT_MS));
      setPicksUsed(st.picksUsed || {});
      setJHist(st.jHist || []);
      setVitrine(st.vitrine || [null, null, null]);
      setPrev(st.prev && st.prev.groupResult !== undefined ? st.prev : EMPTY_PREV);
      setMuted(!!st.muted);
      if (!st.onboardDone) setOnboardStep(0);

      loaded.current = true;
    })();
  }, [username, userId]);

  // guardar progresso do utilizador no Supabase (profiles.state), com debounce
  useEffect(() => {
    if (!loaded.current || !username || !userId) return;
    const state = {
      collection, meta,
      lineup: { ids: lineup, captain },
      hist: hist.slice(0, 50),
      codesUsed,
      escolhas,
      escSlot,
      picksUsed,
      jHist: jHist.slice(0, 30),
      vitrine,
      prev,
      muted,
      onboardDone: onboardStep === null,
    };
    const t = setTimeout(() => {
      supabase.from("profiles").update({ state, updated_at: new Date().toISOString() }).eq("id", userId)
        .then(({ error }) => { if (error) console.error("Erro ao guardar progresso:", error.message); });
    }, 600);
    return () => clearTimeout(t);
  }, [collection, meta, lineup, captain, hist, codesUsed, escolhas, picksUsed, escSlot, jHist, vitrine, prev, muted, onboardStep, username, userId]);


  const logout = async () => {
    await supabase.auth.signOut();
    setUsername(null); setIsAdmin(false); setCollection({}); setMeta({ dias: [], packs: {}, claims: {}, pity: 0 }); setTradePreview(null); setLineup([null, null, null]); setCaptain(null); setHist([]); setCodesUsed([]); setCodeInput(""); setEscolhas(0); setEscSlot(null); setPicksUsed({}); setJHist([]); setVitrine([null, null, null]); setVitrinePick(null); setDirectTrade(null); setPrev(EMPTY_PREV); setCompResult(null); setOnboardStep(null); setTab("loja"); setOpening(null);
  };

  const addCards = (cards) => setCollection((prev) => {
    const next = { ...prev };
    cards.forEach((c) => (next[c.id] = (next[c.id] || 0) + 1));
    return next;
  });

  const openPack = async (pack, claim, extra) => {
    if (pack.locked) return;
    const ownedBefore = new Set(Object.keys(collection).filter((k) => collection[k] > 0));
    const { data, error } = await supabase.functions.invoke("open-pack", { body: { packId: pack.id, ...(claim ? { claim } : {}), ...(extra || {}) } });
    if (error || !data || data.error) {
      const msg = await fnErrorMessage(error, data, "Não foi possível abrir o pack. Tenta novamente.");
      setToast(msg); setTimeout(() => setToast(null), 2600);
      return;
    }
    const cards = data.cardIds.map((id) => POOL.find((c) => c.id === id)).filter(Boolean);
    setCollection(data.collection);
    setMeta(data.meta);
    setHist(data.hist);
    setOpening({ pack, cards, ownedBefore, initialPhase: "pack", again: () => openPack(pack), againLabel: "Abrir outro" });
  };

  // ---- trocas ----
  const duplicatesOf = (rarity) => POOL.filter((c) => c.rarity === rarity).reduce((s, c) => s + Math.max(0, (collection[c.id] || 0) - 1), 0);
  const startTrade = (rarity) => {
    if (duplicatesOf(rarity) < TRADE_COST) return;
    setTradePreview({ rarity, picks: pickDuplicates(rarity, collection, TRADE_COST) });
  };
  const confirmTrade = async () => {
    if (!tradePreview) return;
    const { rarity } = tradePreview;
    setTradePreview(null);
    const ownedBefore = new Set(Object.keys(collection).filter((k) => collection[k] > 0));
    const { data, error } = await supabase.functions.invoke("trade-cards", { body: { mode: "rand", rarity } });
    if (error || !data || data.error) {
      const msg = await fnErrorMessage(error, data, "Não foi possível fazer a troca. Tenta novamente.");
      setToast(msg); setTimeout(() => setToast(null), 2600);
      return;
    }
    const reward = POOL.find((c) => c.id === data.cardId);
    setCollection(data.collection);
    setMeta(data.meta);
    setHist(data.hist);
    setOpening({
      pack: { name: "Troca", sub: "1 carta " + RARITY[RARITY_UP[rarity]].label, gradient: "linear-gradient(165deg,#0E2A4A,#1BF5A3)", accent: "#1BF5A3" },
      cards: [reward],
      ownedBefore,
      initialPhase: "reveal", again: null,
    });
  };

  // ---- objetivos ----
  const objectives = useMemo(() => buildObjectives(meta, collection), [meta, collection]);
  const isClaimable = (o) => o.prog >= o.alvo && meta.claims[o.id] !== o.periodo;
  const claimableCount = objectives.filter(isClaimable).length;
  const claimObjective = async (o) => {
    if (!isClaimable(o)) return;
    if (o.reward.startsWith("escolha")) {
      const n = parseInt(o.reward.slice(7)) || 1;
      const { data, error } = await supabase.functions.invoke("claim-objective", { body: { id: o.id, periodo: o.periodo } });
      if (error || !data || data.error) {
        const msg = await fnErrorMessage(error, data, "Não foi possível reclamar o objetivo. Tenta novamente.");
        setToast(msg); setTimeout(() => setToast(null), 2600);
        return;
      }
      setMeta(data.meta);
      setEscolhas(data.escolhas);
      setToast(`+${n} Escolha${n > 1 ? "s" : ""}! 🎯 Usa-as no separador Escolhas.`); setTimeout(() => setToast(null), 2800);
    } else {
      openPack(PACKS.find((p) => p.id === o.reward) || PACKS[0], { id: o.id, periodo: o.periodo });
    }
  };

  // ---- competição fantasy ----
  const lineupCards = lineup.map((id) => (id ? POOL.find((c) => c.id === id) : null));
  const lineupFull = lineupCards.every(Boolean);
  const JORNADA_LIMIT = 10;
  const simulateJornada = async () => {
    if (!lineupFull || captain === null) return;
    if (jHist.length >= JORNADA_LIMIT) {
      setToast(`Limite de ${JORNADA_LIMIT} jornadas simuladas atingido (fase de testes).`); setTimeout(() => setToast(null), 2800);
      return;
    }
    const { data, error } = await supabase.functions.invoke("play-jornada", { body: { lineup, captain } });
    if (error || !data || data.error) {
      let msg = await fnErrorMessage(error, data, "Não foi possível registar a jornada. Tenta novamente.");
      msg = msg.replace(/^LIMITE_JORNADAS:\s*/, "");
      setToast(msg); setTimeout(() => setToast(null), 2800);
      return;
    }
    const rows = data.rows.map((r) => ({
      ...r,
      card: POOL.find((c) => c.id === r.cardId),
      perf: { ...r.perf, games: r.perf.games.map((g) => ({ ...g, opp: TEAMS.find((t) => t.id === g.opp) || { id: g.opp, name: g.opp } })) },
    }));
    setCompResult({ rows, total: data.total, j: data.j });
    setJHist(data.jHist);
    if (data.leaderboard) {
      const scores = {};
      data.leaderboard.forEach((r) => { scores[r.username] = r.score; });
      setRank({ scores });
    }
  };
  const pickCard = (card) => {
    if (pickSlot === null) return;
    setLineup((l) => l.map((id, i) => (i === pickSlot ? card.id : id)));
    setPickSlot(null);
  };

  // ---- showcase e partilha ----
  const downloadCard = async (card) => {
    setShareBusy(true);
    try {
      const url = await cardToPng(card);
      const a = document.createElement("a");
      a.href = url; a.download = card.name.replace(/\s+/g, "-") + "-eliga.png"; a.click();
    } catch (e) { setToast("Não foi possível gerar a imagem."); setTimeout(() => setToast(null), 2400); }
    setShareBusy(false);
  };
  const shareCard = async (card) => {
    setShareBusy(true);
    const texto = `Tenho ${card.name} (${RARITY[card.rarity].label}${card.edition ? " · " + card.edition : ""}) na minha coleção eLiga Cartas! ⚽🔥`;
    try {
      const url = await cardToPng(card);
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], "carta-eliga.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: texto });
      } else if (navigator.share) {
        await navigator.share({ text: texto, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(texto + " " + window.location.href);
        setToast("Texto copiado — cola nas tuas redes!"); setTimeout(() => setToast(null), 2400);
      }
    } catch (e) { /* partilha cancelada pelo utilizador */ }
    setShareBusy(false);
  };
  const sharePack = async (cards) => {
    const texto = `Abri um pack na eLiga Cartas e saíram-me: ${cards.map((c) => c.name).join(", ")}! 🎴🔥`;
    try {
      const url = await packToPng(cards);
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], "pack-eliga.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: texto });
      } else if (navigator.share) {
        await navigator.share({ text: texto, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(texto + " " + window.location.href);
        setToast("Texto copiado — cola nas tuas redes!"); setTimeout(() => setToast(null), 2400);
      }
    } catch (e) { /* partilha cancelada */ }
  };
  const finishOnboard = () => setOnboardStep(null);
  const toggleMute = () => setMuted((m) => !m);
  const directTradeGo = async (rarity, target) => {
    setDirectTrade(null);
    const ownedBefore = new Set(Object.keys(collection).filter((k) => collection[k] > 0));
    const { data, error } = await supabase.functions.invoke("trade-cards", { body: { mode: "direct", rarity, targetId: target.id } });
    if (error || !data || data.error) {
      const msg = await fnErrorMessage(error, data, "Não foi possível fazer a troca. Tenta novamente.");
      setToast(msg); setTimeout(() => setToast(null), 2600);
      return;
    }
    const card = POOL.find((c) => c.id === data.cardId) || target;
    setCollection(data.collection);
    setMeta(data.meta);
    setHist(data.hist);
    setOpening({
      pack: { name: "Troca à escolha", sub: card.name, gradient: "linear-gradient(165deg,#0E2A4A,#39E6FF)", accent: "#39E6FF" },
      cards: [card],
      ownedBefore,
      initialPhase: "reveal",
    });
  };

  const answerTrivia = async (idx) => {
    const t = todayStr();
    if ((meta.trivia || {})[t]) return;
    const q = triviaOfDay();
    const ok = idx === q.a;
    if (ok) {
      playFx("rara", muted);
      await openPack(PACKS[0], null, { trivia: { day: t, pick: idx, ok } });
    } else {
      setMeta((m) => ({ ...m, trivia: { ...(m.trivia || {}), [t]: { pick: idx, ok } } }));
      setToast("Errada — volta amanhã para nova pergunta."); setTimeout(() => setToast(null), 2600);
    }
  };

  // ---- Previsões da etapa: grupos → previsão de apurados → SIMULAR grupos →
  //      bracket com os apurados REAIS → previsão das eliminatórias → SIMULAR → recompensa ----
  const teamStrength = (id) => 19 - (TEAM_RANK[id] || 18);
  const drawGroups = () => {
    if (prev.resolved) return;
    const shuffled = [...TEAMS].map((t) => t.id).sort(() => Math.random() - 0.5);
    setPrev({ ...EMPTY_PREV, groups: [shuffled.slice(0, 6), shuffled.slice(6, 12), shuffled.slice(12, 18)] });
  };
  const toggleQual = (id, gi) => {
    if (prev.resolved || prev.groupResult) return;
    setPrev((p) => {
      if (p.qual.includes(id)) return { ...p, qual: p.qual.filter((x) => x !== id) };
      const inGroup = p.groups[gi].filter((x) => p.qual.includes(x)).length;
      if (inGroup >= 3 || p.qual.length >= 8) return p;
      return { ...p, qual: [...p.qual, id] };
    });
  };
  const simulateGroups = () => {
    if (prev.resolved || prev.groupResult || prev.qual.length !== 8) return;
    // classificações por grupo ponderadas pela força real; passam 2 primeiros + 2 melhores terceiros
    const standings = prev.groups.map((g) => [...g].sort((a, b) => (teamStrength(b) + Math.random() * 10) - (teamStrength(a) + Math.random() * 10)));
    const thirds = standings.map((s) => s[2]);
    const bestThirds = [...thirds].sort((a, b) => (teamStrength(b) + Math.random() * 8) - (teamStrength(a) + Math.random() * 8)).slice(0, 2);
    const realQual = [...standings.flatMap((s) => s.slice(0, 2)), ...bestThirds];
    const qualHits = prev.qual.filter((id) => realQual.includes(id)).length;
    setPrev((p) => ({ ...p, groupResult: { realQual, qualHits } }));
    playFx("flip", muted);
  };
  const drawBracket = () => {
    if (prev.resolved || !prev.groupResult) return;
    const order = [...prev.groupResult.realQual].sort(() => Math.random() - 0.5);
    setPrev((p) => ({ ...p, bracket: order, qf: [null, null, null, null], sf: [null, null], fin: null }));
  };
  const redoBracket = () => {
    if (prev.resolved) return;
    setPrev((p) => ({ ...p, bracket: null, qf: [null, null, null, null], sf: [null, null], fin: null }));
  };
  const pickQF = (i, id) => { if (prev.resolved) return; setPrev((p) => ({ ...p, qf: p.qf.map((w, ix) => (ix === i ? id : w)), sf: [null, null], fin: null })); };
  const pickSF = (i, id) => { if (prev.resolved) return; setPrev((p) => ({ ...p, sf: p.sf.map((w, ix) => (ix === i ? id : w)), fin: null })); };
  const pickFin = (id) => { if (prev.resolved) return; setPrev((p) => ({ ...p, fin: id })); };
  const resolvePrev = () => {
    if (!prev.fin || prev.resolved || !prev.bracket) return;
    const playTie = (a, b) => ((teamStrength(a) + Math.random() * 12) > (teamStrength(b) + Math.random() * 12) ? a : b);
    const b = prev.bracket;
    const rqf = [playTie(b[0], b[1]), playTie(b[2], b[3]), playTie(b[4], b[5]), playTie(b[6], b[7])];
    const rsf = [playTie(rqf[0], rqf[1]), playTie(rqf[2], rqf[3])];
    const rchamp = playTie(rsf[0], rsf[1]);
    const qfHits = prev.qf.filter((w, i) => w === rqf[i]).length;
    const sfHits = prev.sf.filter((w, i) => w === rsf[i]).length;
    const champOk = prev.fin === rchamp;
    const score = prev.groupResult.qualHits * 10 + qfHits * 10 + sfHits * 15 + (champOk ? 50 : 0);
    const rewardPack = score >= 130 ? "finals" : score >= 80 ? "base" : null;
    setPrev((p) => ({ ...p, resolved: { rqf, rsf, champ: rchamp, qfHits, sfHits, champOk, score, rewardPack }, rewardClaimed: false }));
    playFx(score >= 130 ? "lendaria" : score >= 80 ? "epica" : "rara", muted);
  };
  const claimPrevReward = async () => {
    if (!prev.resolved || !prev.resolved.rewardPack || prev.rewardClaimed) return;
    setPrev((p) => ({ ...p, rewardClaimed: true }));
    await openPack(PACKS.find((pk) => pk.id === prev.resolved.rewardPack) || PACKS[0], null, { prevReward: true });
  };
  const clearPrev = () => setPrev(EMPTY_PREV);

  // admin: reinicia o ranking partilhado e o histórico "As tuas jornadas" de TODOS os jogadores
  const adminResetRanking = async () => {
    setJHist([]);
    try {
      const { error } = await supabase.rpc("admin_reset_competicao");
      if (error) {
        console.error("admin_reset_competicao falhou:", error.message, error);
        setToast("Não foi possível reiniciar a competição (ver consola).");
      } else {
        const { data: lb, error: e2 } = await supabase.from("leaderboard").select("username, score").order("score", { ascending: false });
        if (!e2 && lb) {
          const scores = {};
          lb.forEach((r) => { scores[r.username] = r.score; });
          setRank({ scores });
        } else {
          setRank({ scores: {} });
        }
        setToast("Jornadas (de todos) e ranking reiniciados.");
      }
    } catch (e) {
      console.error("admin_reset_competicao — erro de ligação:", e);
      setToast("Não foi possível reiniciar a competição (ver consola).");
    }
    setTimeout(() => setToast(null), 2600);
  };

  const redeemCode = async () => {
    const c = codeInput.trim().toUpperCase();
    if (!c) return;
    setCodeInput("");
    const ownedBefore = new Set(Object.keys(collection).filter((k) => collection[k] > 0));
    const { data, error } = await supabase.functions.invoke("redeem-code", { body: { code: c } });
    if (error || !data || data.error) {
      const msg = await fnErrorMessage(error, data, "Não foi possível resgatar o código. Tenta novamente.");
      setToast(msg); setTimeout(() => setToast(null), 2600);
      return;
    }
    setCodesUsed(data.codesUsed);
    if (data.type === "escolhas") {
      setEscolhas(data.escolhas);
      setToast(`+${data.amount} Escolhas! 🎯`); setTimeout(() => setToast(null), 2600);
    } else {
      const cards = data.cardIds.map((id) => POOL.find((c2) => c2.id === id)).filter(Boolean);
      setCollection(data.collection);
      setMeta(data.meta);
      setHist(data.hist);
      const pack = PACKS.find((p) => p.id === REDEEM_CODES[c]?.pack) || PACKS[0];
      setOpening({ pack, cards, ownedBefore, initialPhase: "pack", again: null });
    }
  };

  // ---- Escolhas (Wonder Pick) ----
  const pickSlotNow = Math.floor(now / PICK_SLOT_MS);
  const boardKey = String(pickSlotNow);
  const wonderBoards = useMemo(() => [0, 1, 2].map((i) => buildPickBoard(pickSlotNow + i * 7919)), [pickSlotNow]);
  const boardKeys = [0, 1, 2].map((i) => boardKey + "-" + i);
  const premiumBoard = useMemo(() => buildPickBoard(pickSlotNow + 777777, true), [pickSlotNow]);
  const premiumKey = boardKey + "-p";
  const anyBoardFree = (escolhas > 0 && boardKeys.some((k) => !picksUsed[k])) || (escolhas >= 3 && !picksUsed[premiumKey]);
  const nextBoardIn = (pickSlotNow + 1) * PICK_SLOT_MS - now;
  const fmtCountdown = (ms) => {
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  };
  const wonderPick = async (card, key, cost = 1) => {
    if (escolhas < cost || picksUsed[key]) {
      setToast(picksUsed[key] ? "Já usaste esta Escolha." : "Não tens Escolhas suficientes.");
      setTimeout(() => setToast(null), 2400);
      return false;
    }
    const { data, error } = await supabase.functions.invoke("wonder-pick", { body: { key, cardId: card.id } });
    if (error || !data || data.error) {
      const msg = await fnErrorMessage(error, data, "Não foi possível usar a Escolha. Tenta novamente.");
      setToast(msg); setTimeout(() => setToast(null), 2600);
      return false;
    }
    setEscolhas(data.escolhas);
    setPicksUsed(data.picksUsed);
    setCollection(data.collection);
    setMeta(data.meta);
    setHist(data.hist);
    playFx(card.rarity, muted);
    if (card.rarity === "epica") buzz(45);
    if (card.rarity === "lendaria") buzz([60, 40, 90]);
    return true;
  };

  // regeneração passiva: +1 Escolha a cada 6 horas (acumula até 8 em ausências longas)
  useEffect(() => {
    if (!username || escSlot === null) return;
    if (pickSlotNow > escSlot) {
      const gain = Math.min(8, pickSlotNow - escSlot);
      setEscolhas((e) => e + gain);
      setEscSlot(pickSlotNow);
      setToast(`+${gain} Escolha${gain > 1 ? "s" : ""} 🎯 (regeneras 1 a cada 6h)`); setTimeout(() => setToast(null), 2800);
    }
  }, [pickSlotNow, escSlot, username]);

  // ---- indicadores e ferramentas de admin ----
  const tradeReady = ["comum", "rara", "epica"].some((r) => duplicatesOf(r) >= TRADE_COST);
  const [toast, setToast] = useState(null);
  const openAdminPack = () => {
    addCards(POOL);
    setToast(`Pack Admin: ${POOL.length} cartas adicionadas (1 de cada)`);
    setTimeout(() => setToast(null), 2600);
  };

  const ownedCount = Object.keys(collection).filter((k) => collection[k] > 0).length;
  const filtered = useMemo(() => {
    let list = POOL;
    if (filter === "jogadores") list = list.filter((c) => !c.isClub && !c.isCaster && !c.edition);
    if (filter === "clubes") list = list.filter((c) => c.isClub && !c.edition);
    if (filter === "casters") list = list.filter((c) => c.isCaster && !c.edition);
    if (filter === "especiais") list = list.filter((c) => c.edition);
    if (clubFilter !== "todos") list = list.filter((c) => (clubFilter === "casters" ? c.isCaster : c.team === clubFilter));
    if (search.trim()) { const s = search.trim().toLowerCase(); list = list.filter((c) => c.name.toLowerCase().includes(s)); }
    const order = { lendaria: 0, epica: 1, rara: 2, comum: 3 };
    const sorters = {
      raridade: (a, b) => order[a.rarity] - order[b.rarity] || b.ovr - a.ovr,
      ovr: (a, b) => b.ovr - a.ovr,
      nome: (a, b) => a.name.localeCompare(b.name),
      clube: (a, b) => (a.teamData?.name || "zzz").localeCompare(b.teamData?.name || "zzz") || order[a.rarity] - order[b.rarity],
    };
    return [...list].sort(sorters[sortBy] || sorters.raridade);
  }, [filter, clubFilter, search, sortBy]);

  const clubSelect = (value, onChange) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "0 6px 0 12px", borderRadius: 99, border: `1px solid ${value !== "todos" ? "#1BF5A3" : "#22304d"}`, background: "#0A1126" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={value !== "todos" ? "#1BF5A3" : "#9FB0C8"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
        <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />
      </svg>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filtrar por clube"
        style={{ fontFamily: FONT, fontSize: 12, padding: "8px 4px", cursor: "pointer", border: "none", background: "transparent", color: value !== "todos" ? "#1BF5A3" : "#9FB0C8", maxWidth: 170, outline: "none" }}>
        <option value="todos">Todos os clubes</option>
        <option value="casters">🎙 Casters</option>
        {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </span>
  );

  const shell = (children) => (
    <div style={{ minHeight: "100vh", background: "radial-gradient(140% 90% at 50% 0%, #0C1730 0%, #060A16 60%)", color: "#E7EEF8", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
        @keyframes sheen { 0%,100% { background-position: 200% 0; } 50% { background-position: -100% 0; } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes tear { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(-160px) rotate(-14deg); opacity: 0; } }
        @keyframes pop { 0% { transform: scale(0.7) translateY(30px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes confetti { 0% { transform: translate(0,0) rotate(0); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
        @keyframes shakeK { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-6px,4px); } 40% { transform: translate(6px,-4px); } 60% { transform: translate(-4px,-3px); } 80% { transform: translate(4px,3px); } }
        .shake { animation: shakeK 450ms ease-in-out; }
        @keyframes packAway { 0% { transform: scale(1) translateY(0); opacity: 1; } 100% { transform: scale(0.55) translateY(90px); opacity: 0; } }
        @keyframes wob { 0% { transform: translate(0,0) rotate(0); } 25% { transform: translate(-16px,8px) rotate(-7deg); } 50% { transform: translate(12px,-10px) rotate(6deg); } 75% { transform: translate(-8px,5px) rotate(-4deg); } 100% { transform: translate(0,0) rotate(0); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        button:focus-visible, input:focus-visible { outline: 2px solid #1BF5A3; outline-offset: 2px; }
        ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-thumb { background: #1BF5A344; border-radius: 99px; }
        .topnav { display: flex; gap: 4px; overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .topnav::-webkit-scrollbar { display: none; }
        html, body { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
        input, select, textarea { font-size: 16px !important; }
        @media (display-mode: standalone) {
          .apph { padding-top: calc(14px + env(safe-area-inset-top)) !important; }
          body { padding-bottom: env(safe-area-inset-bottom); }
        }
        @media (max-width: 760px) {
          header { row-gap: 8px; }
          .topnav { order: 3; flex-basis: 100%; }
        }
      `}</style>
      {children}
    </div>
  );

  if (!authChecked) return shell(<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6f87a8", fontFamily: FONT, letterSpacing: 2 }}>A CARREGAR…</div>);
  if (!username) return shell(<AuthScreen onLogin={setUsername} />);

  return shell(
    <>
      <header className="apph" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "14px 20px", borderBottom: "1px solid rgba(27,245,163,0.18)", position: "sticky", top: 0, background: "rgba(6,10,22,0.85)", backdropFilter: "blur(10px)", zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={ELIGA_LOGO} alt="eLiga Portugal" style={{ height: 34 }} onError={(e) => (e.target.style.display = "none")} draggable={false} />
          <div style={{ fontFamily: FONT, fontWeight: 700, letterSpacing: 2, fontSize: 14, color: "#1BF5A3" }}>CARTAS</div>
        </div>
        <nav className="topnav">
          {[
            { k: "loja", label: "Loja" },
            { k: "competicao", label: "Competição" },
            { k: "trocas", label: "Trocas", dot: tradeReady },
            { k: "escolhas", label: "Escolhas", dot: anyBoardFree },
            { k: "previsoes", label: "Previsões" },
            { k: "objetivos", label: "Objetivos", dot: claimableCount > 0 },
            { k: "colecao", label: `Coleção · ${ownedCount}/${POOL.length}` },
            { k: "perfil", label: "Perfil" },
          ].map(({ k, label, dot }) => (
            <button key={k} onClick={() => setTab(k)} style={{ position: "relative", fontFamily: FONT, fontWeight: 600, fontSize: 13, letterSpacing: 1, padding: "8px 13px", borderRadius: 8, cursor: "pointer", border: "none", whiteSpace: "nowrap", flexShrink: 0, background: tab === k ? "#1BF5A3" : "transparent", color: tab === k ? "#04140c" : "#9FB0C8" }}>
              {label}
              {dot && <span style={{ position: "absolute", top: 4, right: 5, width: 8, height: 8, borderRadius: "50%", background: "#ff4757", boxShadow: "0 0 7px #ff4757", border: "1.5px solid #060A16" }} />}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#1BF5A3", boxShadow: "0 0 8px #1BF5A3" }} />
            <span style={{ color: "#fff", fontWeight: 700 }}>{points.toLocaleString("pt-PT")}</span>
            <span style={{ color: "#6f87a8", fontSize: 11 }}>pts Twitch</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid #22304d", paddingLeft: 14 }}>
            <button onClick={toggleMute} aria-label={muted ? "Ativar som" : "Silenciar som"} style={{ fontSize: 15, padding: "4px 8px", borderRadius: 99, cursor: "pointer", background: "transparent", border: "1px solid #22304d" }}>{muted ? "🔇" : "🔊"}</button>
            <span style={{ fontFamily: FONT, fontSize: 12, color: "#9FB0C8" }}>{username}</span>
            <button onClick={logout} style={{ fontFamily: FONT, fontSize: 11, letterSpacing: 1, padding: "5px 12px", borderRadius: 99, cursor: "pointer", background: "transparent", border: "1px solid #22304d", color: "#8fa3bd" }}>Sair</button>
          </div>
        </div>
      </header>

      {tab === "loja" && (
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 20px 80px" }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, margin: 0 }}>Loja de Packs</h1>
            <p style={{ color: "#8fa3bd", fontSize: 14, marginTop: 6, maxWidth: 620 }}>
              Em breve: ganha pontos a assistir à transmissão da eLiga Portugal na Twitch e troca-os por packs.
              Por agora, ganha packs através dos <span style={{ color: "#1BF5A3" }}>Objetivos</span> e de
              <span style={{ color: "#1BF5A3" }}> códigos promocionais</span>.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
            {PACKS.map((p) => (
              <div key={p.id} style={{ borderRadius: 16, overflow: "hidden", background: "#0E162E", border: `1px solid ${p.locked ? "#22304d" : p.accent + "44"}`, display: "flex", flexDirection: "column" }}>
                <div style={{ height: 170, background: p.gradient, position: "relative", overflow: "hidden", filter: p.locked ? "grayscale(0.8) brightness(0.6)" : "none" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(115deg, transparent 0 12px, rgba(255,255,255,0.07) 12px 13px)" }} />
                  {!p.locked && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.28) 48%, transparent 60%)", backgroundSize: "300% 100%", animation: "sheen 3.2s ease-in-out infinite" }} />}
                  <div style={{ position: "absolute", bottom: 12, left: 14, fontFamily: FONT, fontWeight: 700, fontSize: 18, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>{p.name}</div>
                  {p.locked && <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", border: "1px solid #44557a", borderRadius: 99, padding: "4px 12px", fontSize: 11, fontFamily: FONT, letterSpacing: 1, color: "#9FB0C8" }}>🔒 {p.lockLabel}</div>}
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1.5, color: p.locked ? "#5c6c88" : p.accent, fontFamily: FONT }}>{p.sub.toUpperCase()}</div>
                  <div style={{ fontSize: 13, color: "#9FB0C8", flex: 1 }}>{p.desc}</div>
                  {p.locked ? (
                    <button disabled style={{ ...btn(false), opacity: 0.4, cursor: "not-allowed", width: "100%" }}>Indisponível</button>
                  ) : isAdmin ? (
                    <button onClick={() => openPack(p)} style={{ ...btn(true), width: "100%" }}>Abrir grátis (admin)</button>
                  ) : (
                    <button disabled style={{ ...btn(false), opacity: 0.4, cursor: "not-allowed", width: "100%" }}>Em breve (pontos Twitch)</button>
                  )}
                </div>
              </div>
            ))}
            {isAdmin && (
              <div style={{ borderRadius: 16, overflow: "hidden", background: "#0E162E", border: "1px dashed #ff7b8a88", display: "flex", flexDirection: "column" }}>
                <div style={{ height: 170, background: "repeating-linear-gradient(45deg,#1a1030 0 16px,#241638 16px 32px)", position: "relative" }}>
                  <div style={{ position: "absolute", top: 12, right: 12, background: "#ff7b8a", color: "#2a060c", borderRadius: 99, padding: "4px 12px", fontSize: 11, fontFamily: FONT, fontWeight: 700, letterSpacing: 1 }}>ADMIN</div>
                  <div style={{ position: "absolute", bottom: 12, left: 14, fontFamily: FONT, fontWeight: 700, fontSize: 18, color: "#fff" }}>Pack Admin</div>
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1.5, color: "#ff7b8a", fontFamily: FONT }}>FERRAMENTA DE TESTES</div>
                  <div style={{ fontSize: 13, color: "#9FB0C8", flex: 1 }}>Adiciona 1 cópia de todas as {POOL.length} cartas, sem animação. Visível apenas para a conta admin.</div>
                  <button onClick={openAdminPack} style={{ ...btn(false), width: "100%", color: "#ff7b8a", border: "1px solid #ff7b8a66" }}>Abrir (instantâneo)</button>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 36, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: "#6f87a8", fontFamily: FONT }}>RARIDADES</span>
            {Object.entries(RARITY).map(([k, r]) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#c4d2e6" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: r.frame, boxShadow: `0 0 8px ${r.glow}` }} />{r.label}
              </span>
            ))}
          </div>

          {/* códigos promocionais */}
          <div style={{ marginTop: 26, background: "#0E162E", border: "1px solid #1BF5A333", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontFamily: FONT, fontSize: 12, letterSpacing: 1.5, color: "#1BF5A3", flexShrink: 0 }}>🎟 TENS UM CÓDIGO?</div>
            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && redeemCode()} placeholder="EX: ELIGA2026" maxLength={16} aria-label="Código promocional"
              style={{ flex: 1, minWidth: 140, padding: "10px 14px", borderRadius: 10, border: "1px solid #22304d", background: "#0A1126", color: "#E7EEF8", fontFamily: FONT, fontSize: 13, letterSpacing: 2, outline: "none" }} />
            <button onClick={redeemCode} style={{ ...btn(true), padding: "10px 18px", fontSize: 12 }}>Resgatar</button>
            <div style={{ flexBasis: "100%", fontSize: 11, color: "#6f87a8" }}>Os códigos são revelados durante as transmissões na Twitch e nas redes da eLiga. Cada código vale um pack e só pode ser usado uma vez por conta.</div>
          </div>

          {/* probabilidades públicas */}
          <div style={{ marginTop: 24 }}>
            <button onClick={() => setShowOdds(!showOdds)} style={{ ...btn(false), padding: "9px 18px", fontSize: 12 }}>
              {showOdds ? "Esconder probabilidades" : "Ver probabilidades dos packs"}
            </button>
            {showOdds && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
                {[["Pack Base", 0], ["Pack Finals 25/26", 1]].map(([nome, k]) => (
                  <div key={k} style={{ flex: 1, minWidth: 240, background: "#0E162E", border: "1px solid #22304d", borderRadius: 14, padding: "14px 18px" }}>
                    <div style={{ fontFamily: FONT, fontSize: 12, letterSpacing: 1.5, color: "#1BF5A3", marginBottom: 10 }}>{nome.toUpperCase()} — POR CARTA</div>
                    {PACK_ODDS[k].map(([rar, pct]) => (
                      <div key={rar} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ width: 11, height: 11, borderRadius: 3, background: RARITY[rar].frame, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#c4d2e6", flex: 1 }}>{RARITY[rar].label}</span>
                        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: "#fff" }}>{pct}%</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* garantia (pity) */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#9FB0C8", background: "#0E162E", border: "1px solid #B45CFF44", borderRadius: 12, padding: "10px 14px" }}>
            <span style={{ fontFamily: FONT, letterSpacing: 1.5, color: "#B45CFF", flexShrink: 0 }}>🛡 GARANTIA</span>
            <span style={{ flex: 1, minWidth: 200 }}>Ao 10º pack seguido sem carta Épica ou superior, o pack traz pelo menos uma garantida.</span>
            <span style={{ fontFamily: FONT, fontWeight: 700, color: (meta.pity || 0) >= 7 ? "#B45CFF" : "#c4d2e6", whiteSpace: "nowrap" }}>{meta.pity || 0}/10 sem Épica</span>
          </div>

          {/* histórico de aberturas */}
          {hist.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "#fff" }}>Últimas aberturas</h2>
              <div style={{ background: "#0E162E", border: "1px solid #22304d", borderRadius: 14, overflow: "hidden" }}>
                {hist.slice(0, 10).map((h, i) => {
                  const dt = new Date(h.t);
                  const hh = String(dt.getHours()).padStart(2, "0") + ":" + String(dt.getMinutes()).padStart(2, "0");
                  const dd = String(dt.getDate()).padStart(2, "0") + "/" + String(dt.getMonth() + 1).padStart(2, "0");
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid #16203a", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: FONT, fontSize: 11, color: "#6f87a8", width: 86, flexShrink: 0 }}>{dd} {hh}</span>
                      <span style={{ fontFamily: FONT, fontSize: 12, color: "#9FB0C8", width: 150, flexShrink: 0 }}>{h.pack}</span>
                      <span style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1, fontSize: 12 }}>
                        {h.ids.map((id, j) => {
                          const c = POOL.find((x) => x.id === id);
                          if (!c) return null;
                          return (
                            <span key={j} style={{ display: "flex", alignItems: "center", gap: 5, color: "#c4d2e6" }}>
                              <span style={{ width: 9, height: 9, borderRadius: 2, background: RARITY[c.rarity].frame }} />{c.name}
                            </span>
                          );
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      )}

      {tab === "trocas" && (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px 80px" }}>
          <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, margin: 0 }}>Trocas</h1>
          <p style={{ color: "#8fa3bd", fontSize: 14, marginTop: 6, maxWidth: 620 }}>
            Junta {TRADE_COST} cartas duplicadas da mesma raridade e troca-as por uma carta aleatória da raridade acima — ou junta {TRADE_DIRECT} e escolhe exatamente a carta que queres.
            Nunca perdes a última cópia de cada carta.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 26 }}>
            {[
              { rar: "comum", mode: "rand" }, { rar: "comum", mode: "choose" },
              { rar: "rara", mode: "rand" }, { rar: "rara", mode: "choose" },
              { rar: "epica", mode: "rand" }, { rar: "epica", mode: "choose" },
            ].map(({ rar, mode }) => {
              const r = RARITY[rar], up = RARITY[RARITY_UP[rar]];
              const cost = mode === "rand" ? TRADE_COST : TRADE_DIRECT;
              const have = duplicatesOf(rar);
              const ready = have >= cost;
              return (
                <div key={rar + mode} style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", background: "#0E162E", border: `1px solid ${ready ? r.color + "66" : "#22304d"}`, borderRadius: 16, padding: "18px 20px", boxShadow: ready ? `0 0 24px ${r.glow}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 210 }}>
                    <span style={{ width: 38, height: 52, borderRadius: 6, background: r.frame, boxShadow: `0 0 12px ${r.glow}`, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: "#fff" }}>{cost}× {r.label}</div>
                      <div style={{ fontSize: 12, color: "#8fa3bd" }}>duplicados</div>
                    </div>
                    <span style={{ fontFamily: FONT, fontSize: 20, color: "#6f87a8" }}>→</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 38, height: 52, borderRadius: 6, background: up.frame, boxShadow: `0 0 12px ${up.glow}`, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: up.color }}>1× {up.label}</div>
                        <div style={{ fontSize: 12, color: mode === "choose" ? "#39E6FF" : "#8fa3bd", fontWeight: mode === "choose" ? 700 : 400 }}>{mode === "choose" ? "à escolha" : "aleatória"}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8fa3bd", marginBottom: 6 }}>
                      <span>Duplicados disponíveis</span>
                      <span style={{ fontFamily: FONT, fontWeight: 700, color: ready ? "#1BF5A3" : "#c4d2e6" }}>{Math.min(have, cost)}/{cost}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, background: "#1a2440", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, (have / cost) * 100)}%`, height: "100%", background: ready ? `linear-gradient(90deg, ${r.color}, #1BF5A3)` : r.color + "88", transition: "width 400ms" }} />
                    </div>
                  </div>
                  <button onClick={() => (mode === "rand" ? startTrade(rar) : setDirectTrade(rar))} disabled={!ready} style={{ ...btn(ready), opacity: ready ? 1 : 0.35, cursor: ready ? "pointer" : "not-allowed" }}>{mode === "rand" ? "Trocar" : "Escolher carta"}</button>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 22, fontSize: 12, color: "#44557a" }}>
            As cartas Lendárias são o topo da coleção e não podem ser trocadas.
          </div>
        </main>
      )}

      {tab === "competicao" && (
        <main style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 20px 80px" }}>
          <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, margin: 0 }}>Competição</h1>
          <p style={{ color: "#8fa3bd", fontSize: 14, marginTop: 6, maxWidth: 680 }}>
            Escolhe 3 cartas da tua coleção. Em cada jornada da eLiga, ganhas pontos com a performance real dos jogadores e clubes escolhidos, amplificada pelos efeitos das cartas — quanto maior a raridade, mais forte o efeito.
            <span style={{ color: "#F2C14E" }}> Até ao arranque da época, os resultados são simulados.</span>
          </p>

          {/* tabela de pontuação — contexto para a estratégia */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 22 }}>
            <div style={{ flex: 1, minWidth: 260, background: "#0E162E", border: "1px solid #22304d", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontFamily: FONT, fontSize: 11, letterSpacing: 2, color: "#1BF5A3", marginBottom: 8 }}>PONTOS POR CARTA DE JOGADOR</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "#c4d2e6" }}>
                <span>Vitória <b style={{ color: "#1BF5A3", fontFamily: FONT }}>+{SCORING.jogador.vit}</b></span>
                <span>Empate <b style={{ color: "#F2C14E", fontFamily: FONT }}>+{SCORING.jogador.emp}</b></span>
                <span>Derrota <b style={{ color: "#8fa3bd", fontFamily: FONT }}>+{SCORING.jogador.der}</b></span>
                <span>Golo <b style={{ color: "#39E6FF", fontFamily: FONT }}>+{SCORING.jogador.golo}</b></span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 260, background: "#0E162E", border: "1px solid #22304d", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontFamily: FONT, fontSize: 11, letterSpacing: 2, color: "#1BF5A3", marginBottom: 8 }}>PONTOS POR CARTA DE CLUBE</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "#c4d2e6" }}>
                <span>Vitória <b style={{ color: "#1BF5A3", fontFamily: FONT }}>+{SCORING.clube.vit}</b></span>
                <span>Empate <b style={{ color: "#F2C14E", fontFamily: FONT }}>+{SCORING.clube.emp}</b></span>
                <span>Derrota <b style={{ color: "#8fa3bd", fontFamily: FONT }}>+{SCORING.clube.der}</b></span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#6f87a8" }}>
            Cada jornada tem 2 jogos por carta, contra adversários sorteados — vencer equipas do fundo da tabela é mais fácil do que vencer o top 8. Os 9 efeitos de carta (Artilheiro, Vencedor, Consistente, Imparável, Resiliente, Caça-Grandes, Espírito de Clube, Mentor e Fortaleza) somam-se a estes valores e escalam com a raridade. Escolhe ainda um capitão: essa carta vale o dobro dos pontos. As cartas de caster não jogam — valem pelos efeitos únicos de apoio (Hype, Voz da Liga, Analista).
          </div>

          {/* equipa do utilizador */}
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", marginTop: 28 }}>
            {lineupCards.map((card, i) => (
              <div key={i} onClick={() => { setPickClub("todos"); setPickSlot(i); }} style={{ cursor: "pointer", textAlign: "center", width: 190 }}>
                {card ? (
                  <>
                    <div style={{ position: "relative" }}>
                      <Card card={card} width={190} />
                      {captain === i && <div style={{ position: "absolute", top: card.edition ? -22 : -10, left: "50%", transform: "translateX(-50%)", background: "#F2C14E", color: "#3a2a00", fontFamily: FONT, fontWeight: 700, fontSize: 11, letterSpacing: 1, padding: "3px 12px", borderRadius: 99, boxShadow: "0 0 14px rgba(242,193,78,0.6)", zIndex: 5, whiteSpace: "nowrap" }}>★ CAPITÃO ×2</div>}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.45, color: RARITY[card.rarity].color, background: "#0E162E", border: `1px solid ${RARITY[card.rarity].color}44`, borderRadius: 10, padding: "8px 10px" }}>
                      ⚡ {effectOf(card).label}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setCaptain(captain === i ? null : i); }}
                      style={{ marginTop: 8, fontFamily: FONT, fontSize: 11, letterSpacing: 1, padding: "6px 14px", borderRadius: 99, cursor: "pointer", border: `1px solid ${captain === i ? "#F2C14E" : "#22304d"}`, background: captain === i ? "#F2C14E22" : "transparent", color: captain === i ? "#F2C14E" : "#8fa3bd" }}>
                      {captain === i ? "★ Capitão" : "Tornar capitão"}
                    </button>
                  </>
                ) : (
                  <div style={{ width: 190, height: 190 * 1.42, borderRadius: 14, border: "2px dashed #22304d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#44557a" }}>
                    <span style={{ fontSize: 34 }}>＋</span>
                    <span style={{ fontFamily: FONT, fontSize: 12, letterSpacing: 1 }}>ESCOLHER CARTA</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 26 }}>
            <button onClick={simulateJornada} disabled={!lineupFull || captain === null || jHist.length >= JORNADA_LIMIT} style={{ ...btn(lineupFull && captain !== null && jHist.length < JORNADA_LIMIT), opacity: lineupFull && captain !== null && jHist.length < JORNADA_LIMIT ? 1 : 0.35, cursor: lineupFull && captain !== null && jHist.length < JORNADA_LIMIT ? "pointer" : "not-allowed", fontSize: 14, padding: "14px 30px" }}>
              {jHist.length >= JORNADA_LIMIT ? `Limite de ${JORNADA_LIMIT} jornadas atingido` : !lineupFull ? "Escolhe 3 cartas para jogar" : captain === null ? "Escolhe um capitão (×2) primeiro" : `Simular jornada ${jHist.length + 1}`}
            </button>
            {jHist.length >= JORNADA_LIMIT && (
              <div style={{ color: "#8fa3bd", fontSize: 12, textAlign: "center", maxWidth: 360 }}>
                Limite de {JORNADA_LIMIT} jornadas simuladas por jogador, nesta fase de testes (sem integração com a Twitch ainda).
              </div>
            )}
          </div>

          {/* ranking */}
          <div style={{ marginTop: 44 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, margin: 0, color: "#fff" }}>Ranking</h2>
                <span style={{ fontSize: 11, letterSpacing: 1, color: "#6f87a8", fontFamily: FONT }}>JÁ JOGASTE {jHist.length} JORNADA{jHist.length === 1 ? "" : "S"}</span>
              </div>
              {isAdmin && (
                <button onClick={adminResetRanking} style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 1, padding: "6px 12px", borderRadius: 99, cursor: "pointer", background: "transparent", border: "1px dashed #ff7b8a88", color: "#ff7b8a" }}>↻ Limpar jornadas (todos) e ranking (admin)</button>
              )}
            </div>
            {Object.keys(rank.scores).length === 0 ? (
              <div style={{ background: "#0E162E", border: "1px solid #22304d", borderRadius: 14, padding: "24px 20px", textAlign: "center", color: "#6f87a8", fontSize: 13 }}>
                O ranking começa quando a primeira jornada for disputada.
              </div>
            ) : (
              <div style={{ background: "#0E162E", border: "1px solid #22304d", borderRadius: 14, overflow: "hidden" }}>
                {Object.entries(rank.scores).sort((a, b) => b[1] - a[1]).map(([name, pts], i) => {
                  const isMe = name === username;
                  return (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", borderBottom: "1px solid #16203a", background: isMe ? "#1BF5A314" : "transparent" }}>
                      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, width: 30, color: i === 0 ? "#F2C14E" : i === 1 ? "#c0cbd9" : i === 2 ? "#cd8f5a" : "#6f87a8" }}>{i + 1}º</span>
                      <span style={{ flex: 1, fontFamily: FONT, fontSize: 14, color: isMe ? "#1BF5A3" : "#E7EEF8", fontWeight: isMe ? 700 : 400 }}>{name}{isMe ? " (tu)" : ""}</span>
                      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: "#fff" }}>{pts.toLocaleString("pt-PT")} pts</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 11.5, color: "#44557a" }}>
              No protótipo, os restantes jogadores do ranking são simulados e os dados ficam neste dispositivo. Na versão final, o ranking é global e reinicia em cada competição (Etapas, Taça, Finals).
            </div>
          </div>

          {/* histórico pessoal de jornadas */}
          {jHist.length > 0 && (() => {
            const maxT = Math.max(...jHist.map((e) => e.total), 1);
            return (
              <section style={{ marginTop: 34 }}>
                <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "#fff" }}>As tuas jornadas</h2>
                <div style={{ background: "#0E162E", border: "1px solid #22304d", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {jHist.slice(0, 10).map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontFamily: FONT, fontSize: 11, color: "#6f87a8", width: 32, flexShrink: 0 }}>J{e.j}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ height: 10, borderRadius: 99, background: "#1a2440", overflow: "hidden" }}>
                          <div style={{ width: `${(e.total / maxT) * 100}%`, height: "100%", background: "linear-gradient(90deg,#1BF5A3,#39E6FF)", transition: "width 500ms" }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: "#6f87a8", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.cards.join(" · ")} — ★ {e.cap}</div>
                      </div>
                      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: "#1BF5A3", width: 54, textAlign: "right", flexShrink: 0 }}>{e.total}</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}
        </main>
      )}

      {tab === "escolhas" && (
        <main style={{ maxWidth: 940, margin: "0 auto", padding: "36px 20px 80px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, margin: 0 }}>Escolhas</h1>
              <p style={{ color: "#8fa3bd", fontSize: 14, marginTop: 6, maxWidth: 620 }}>
                Três conjuntos de 5 cartas, renovados a cada 6 horas. Em cada conjunto podes gastar 1 Escolha: as cartas juntam-se, baralham, e escolhes uma às cegas. Regeneras 1 Escolha a cada 6h, mais bónus nos objetivos e códigos.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: "#39E6FF", background: "#39E6FF18", border: "1px solid #39E6FF55", borderRadius: 99, padding: "8px 18px" }}>🎯 {escolhas}</span>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#6f87a8", fontFamily: FONT, letterSpacing: 1 }}>
            NOVOS CONJUNTOS EM {fmtCountdown(nextBoardIn).toUpperCase()}
          </div>
          {wonderBoards.map((b, i) => (
            <WonderBoard key={boardKeys[i]} idx={i} board={b} boardKey={boardKeys[i]} used={!!picksUsed[boardKeys[i]]} canUse={escolhas > 0} muted={muted} onPick={wonderPick} nextIn={fmtCountdown(nextBoardIn)} />
          ))}
          <WonderBoard key={premiumKey} premium cost={3} idx={3} board={premiumBoard} boardKey={premiumKey} used={!!picksUsed[premiumKey]} canUse={escolhas >= 3} muted={muted} onPick={wonderPick} nextIn={fmtCountdown(nextBoardIn)} />
        </main>
      )}

      {tab === "previsoes" && (() => {
        const teamOf = (id) => TEAMS.find((t) => t.id === id);
        const realQ = prev.groupResult ? prev.groupResult.realQual : null;
        const tie = (label, a, b, winner, onPick, realWinner) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 1, color: "#6f87a8", width: 32, flexShrink: 0 }}>{label}</span>
            {[a, b].map((id) => {
              const t = teamOf(id);
              const sel = winner === id;
              const isReal = realWinner ? realWinner === id : null;
              const border = sel ? (isReal === null ? "#1BF5A3" : isReal ? "#1BF5A3" : "#ff7b8a") : "#22304d";
              return (
                <button key={id} onClick={() => onPick(id)} disabled={!!prev.resolved}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 99, cursor: prev.resolved ? "default" : "pointer", border: `1px solid ${border}`, background: sel ? (isReal === false ? "#ff7b8a18" : "#1BF5A318") : "#0A1126", flex: 1, minWidth: 120, justifyContent: "center" }}>
                  <ClubLogo team={t} size={18} />
                  <span style={{ fontFamily: FONT, fontSize: 12, color: sel ? "#fff" : "#8fa3bd" }}>{t.short}</span>
                  {sel && prev.resolved && <span style={{ fontSize: 11 }}>{isReal ? "✓" : "✗"}</span>}
                  {!sel && prev.resolved && isReal && <span style={{ fontFamily: FONT, fontSize: 9, color: "#F2C14E" }}>VENCEU</span>}
                </button>
              );
            })}
          </div>
        );
        const qfPairs = prev.bracket ? [[prev.bracket[0], prev.bracket[1]], [prev.bracket[2], prev.bracket[3]], [prev.bracket[4], prev.bracket[5]], [prev.bracket[6], prev.bracket[7]]] : [];
        return (
          <main style={{ maxWidth: 940, margin: "0 auto", padding: "36px 20px 80px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, margin: 0 }}>Previsões</h1>
                <p style={{ color: "#8fa3bd", fontSize: 14, marginTop: 6, maxWidth: 680 }}>
                  Como numa etapa real: sorteia os grupos, prevê os 8 apurados, vê os resultados da fase de grupos, e depois prevê as eliminatórias jogo a jogo. Apurado certo +10 · quarto-de-final certo +10 · meia-final certa +15 · campeão +50. Com 80+ pts ganhas um Pack Base; com 130+ um Pack Finals.
                </p>
              </div>
              {isAdmin && (
                <button onClick={clearPrev} style={{ fontFamily: FONT, fontSize: 11, letterSpacing: 1, padding: "8px 14px", borderRadius: 99, cursor: "pointer", background: "transparent", border: "1px dashed #ff7b8a88", color: "#ff7b8a" }}>Limpar (admin)</button>
              )}
            </div>

            {/* 1 · sorteio dos grupos */}
            {!prev.groups ? (
              <section style={{ marginTop: 26, background: "#0E162E", border: "1px solid #22304d", borderRadius: 16, padding: "30px 20px", textAlign: "center" }}>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 8 }}>1 · Sorteio da fase de grupos</div>
                <div style={{ fontSize: 13, color: "#8fa3bd", marginBottom: 18 }}>As 18 equipas vão ser sorteadas em 3 grupos de 6.</div>
                <button onClick={drawGroups} style={{ ...btn(true), fontSize: 14, padding: "14px 28px" }}>🎲 Sortear grupos</button>
              </section>
            ) : (
              <>
                {/* 2 · previsão de apurados */}
                <section style={{ marginTop: 26 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, letterSpacing: 1.5, color: "#1BF5A3" }}>2 · QUEM PASSA AOS QUARTOS?</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: prev.qual.length === 8 ? "#1BF5A3" : "#8fa3bd" }}>{prev.qual.length}/8</span>
                      {!prev.groupResult && (
                        <button onClick={drawGroups} style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 1, padding: "6px 12px", borderRadius: 99, cursor: "pointer", background: "transparent", border: "1px solid #22304d", color: "#8fa3bd" }}>↻ Sortear grupos de novo</button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#6f87a8", marginBottom: 12 }}>Máximo 3 por grupo — passam os 2 primeiros de cada grupo e os 2 melhores terceiros (3+3+2).</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                    {prev.groups.map((g, gi) => {
                      const nSel = g.filter((id) => prev.qual.includes(id)).length;
                      return (
                        <div key={gi} style={{ background: "#0E162E", border: "1px solid #22304d", borderRadius: 16, padding: "14px 14px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                            <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, letterSpacing: 2, color: "#39E6FF" }}>GRUPO {["A", "B", "C"][gi]}</span>
                            <span style={{ fontFamily: FONT, fontSize: 12, color: nSel >= 2 ? "#1BF5A3" : "#6f87a8" }}>{nSel}/3</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {g.map((id) => {
                              const t = teamOf(id);
                              const sel = prev.qual.includes(id);
                              const passed = realQ ? realQ.includes(id) : null;
                              const border = sel ? (passed === null ? "#1BF5A3" : passed ? "#1BF5A3" : "#ff7b8a") : "#1a2440";
                              return (
                                <button key={id} onClick={() => toggleQual(id, gi)} disabled={!!prev.groupResult}
                                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, cursor: prev.groupResult ? "default" : "pointer", border: `1px solid ${border}`, background: sel ? (passed === false ? "#ff7b8a14" : "#1BF5A314") : "#0A1126", textAlign: "left" }}>
                                  <ClubLogo team={t} size={18} />
                                  <span style={{ fontFamily: FONT, fontSize: 12, color: sel ? "#fff" : "#8fa3bd", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.short}</span>
                                  {sel && (realQ ? <span style={{ fontSize: 11 }}>{passed ? "✓" : "✗"}</span> : <span style={{ color: "#1BF5A3", fontSize: 11 }}>●</span>)}
                                  {realQ && !sel && passed && <span style={{ fontFamily: FONT, fontSize: 9, color: "#F2C14E" }}>PASSOU</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 3 · simular a fase de grupos */}
                  {!prev.groupResult ? (
                    <div style={{ textAlign: "center", marginTop: 18 }}>
                      <button onClick={simulateGroups} disabled={prev.qual.length !== 8} style={{ ...btn(prev.qual.length === 8), opacity: prev.qual.length === 8 ? 1 : 0.35, cursor: prev.qual.length === 8 ? "pointer" : "not-allowed", fontSize: 13, padding: "13px 26px" }}>
                        ▶ Simular fase de grupos
                      </button>
                      <div style={{ fontSize: 11.5, color: "#6f87a8", marginTop: 8 }}>{prev.qual.length === 8 ? "Fecha as tuas previsões e vê quem passou. No jogo final, estes serão os resultados reais das jornadas." : `Escolhe os 8 apurados primeiro (faltam ${8 - prev.qual.length}).`}</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 16, fontSize: 13, color: "#9FB0C8", background: "#0B1226", border: "1px solid #1BF5A344", borderRadius: 12, padding: "12px 16px" }}>
                      ✓ Fase de grupos terminada — acertaste <b style={{ color: "#1BF5A3" }}>{prev.groupResult.qualHits}/8</b> apurados (<b style={{ color: "#1BF5A3" }}>+{prev.groupResult.qualHits * 10} pts</b>). Agora as eliminatórias jogam-se entre os apurados reais.
                    </div>
                  )}
                </section>

                {/* 4 · sorteio das eliminatórias (com os apurados REAIS) */}
                {prev.groupResult && !prev.bracket && (
                  <section style={{ marginTop: 18, background: "#0E162E", border: "1px solid #22304d", borderRadius: 16, padding: "22px 20px", textAlign: "center" }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 6 }}>4 · Sorteio das eliminatórias</div>
                    <div style={{ fontSize: 13, color: "#8fa3bd", marginBottom: 14 }}>Os 8 apurados reais vão a sorteio para a bracket dos quartos.</div>
                    <button onClick={drawBracket} style={{ ...btn(true), fontSize: 13, padding: "12px 24px" }}>🎲 Sortear eliminatórias</button>
                  </section>
                )}

                {/* 5 · previsão das eliminatórias */}
                {prev.bracket && (
                  <section style={{ marginTop: 18, background: "#0E162E", border: "1px solid #22304d", borderRadius: 16, padding: "18px 18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, letterSpacing: 1.5, color: "#F2C14E" }}>5 · ELIMINATÓRIAS — ESCOLHE OS VENCEDORES</span>
                      {!prev.resolved && <button onClick={redoBracket} style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 1, padding: "6px 12px", borderRadius: 99, cursor: "pointer", background: "transparent", border: "1px solid #22304d", color: "#8fa3bd" }}>↻ Refazer sorteio</button>}
                    </div>

                    <div style={{ fontFamily: FONT, fontSize: 11, letterSpacing: 1.5, color: "#6f87a8", marginBottom: 8 }}>QUARTOS DE FINAL · +10 por acerto</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {qfPairs.map((pair, i) => tie(`QF${i + 1}`, pair[0], pair[1], prev.qf[i], (id) => pickQF(i, id), prev.resolved ? prev.resolved.rqf[i] : null))}
                    </div>

                    {prev.qf[0] && prev.qf[1] && prev.qf[2] && prev.qf[3] && (
                      <>
                        <div style={{ fontFamily: FONT, fontSize: 11, letterSpacing: 1.5, color: "#6f87a8", margin: "16px 0 8px" }}>MEIAS-FINAIS · +15 por acerto</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {tie("MF1", prev.qf[0], prev.qf[1], prev.sf[0], (id) => pickSF(0, id), prev.resolved ? prev.resolved.rsf[0] : null)}
                          {tie("MF2", prev.qf[2], prev.qf[3], prev.sf[1], (id) => pickSF(1, id), prev.resolved ? prev.resolved.rsf[1] : null)}
                        </div>
                      </>
                    )}

                    {prev.sf[0] && prev.sf[1] && (
                      <>
                        <div style={{ fontFamily: FONT, fontSize: 11, letterSpacing: 1.5, color: "#F2C14E", margin: "16px 0 8px" }}>🏆 FINAL · +50 pelo campeão</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {tie("FIN", prev.sf[0], prev.sf[1], prev.fin, pickFin, prev.resolved ? prev.resolved.champ : null)}
                        </div>
                      </>
                    )}

                    {/* 6 · simular eliminatórias */}
                    {prev.fin && !prev.resolved && (
                      <div style={{ textAlign: "center", marginTop: 18 }}>
                        <button onClick={resolvePrev} style={{ ...btn(true), fontSize: 13, padding: "13px 26px" }}>▶ Simular eliminatórias</button>
                        <div style={{ fontSize: 11.5, color: "#6f87a8", marginTop: 8 }}>Previsão completa: {teamOf(prev.fin).name} campeão. Vê como correu jogo a jogo.</div>
                      </div>
                    )}
                  </section>
                )}

                {/* resultado final + recompensa por botão */}
                {prev.resolved && (
                  <section style={{ marginTop: 16, background: "#0E162E", border: "1px solid #1BF5A355", borderRadius: 16, padding: "18px 20px" }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 8 }}>Resultado da etapa</div>
                    <div style={{ fontSize: 13, color: "#9FB0C8", lineHeight: 1.9 }}>
                      Apurados: <b style={{ color: "#1BF5A3" }}>{prev.groupResult.qualHits}/8</b> (+{prev.groupResult.qualHits * 10}) · Quartos: <b style={{ color: "#1BF5A3" }}>{prev.resolved.qfHits}/4</b> (+{prev.resolved.qfHits * 10}) · Meias: <b style={{ color: "#1BF5A3" }}>{prev.resolved.sfHits}/2</b> (+{prev.resolved.sfHits * 15}) · Campeão: {prev.resolved.champOk ? <b style={{ color: "#F2C14E" }}>certo! (+50)</b> : <>foi <b style={{ color: "#F2C14E" }}>{teamOf(prev.resolved.champ).name}</b></>}
                    </div>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: prev.resolved.score >= 130 ? "#F2C14E" : prev.resolved.score >= 80 ? "#1BF5A3" : "#8fa3bd", margin: "10px 0 14px" }}>{prev.resolved.score} pts</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {prev.resolved.rewardPack && !prev.rewardClaimed && (
                        <button onClick={claimPrevReward} style={{ ...btn(true), fontSize: 13, padding: "13px 26px" }}>
                          🎁 Abrir recompensa — {prev.resolved.rewardPack === "finals" ? "Pack Finals" : "Pack Base"}
                        </button>
                      )}
                      {prev.resolved.rewardPack && prev.rewardClaimed && <span style={{ fontFamily: FONT, fontSize: 12, color: "#1BF5A3", alignSelf: "center" }}>✓ Recompensa recebida</span>}
                      {!prev.resolved.rewardPack && <span style={{ fontSize: 12.5, color: "#8fa3bd", alignSelf: "center" }}>Precisavas de 80+ pts para ganhar um pack. Para a próxima!</span>}
                      {(prev.rewardClaimed || !prev.resolved.rewardPack) && (
                        <button onClick={clearPrev} style={{ ...btn(false), fontSize: 13 }}>↻ Nova previsão</button>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        );
      })()}

      {tab === "objetivos" && (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px 80px" }}>
          <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, margin: 0 }}>Objetivos</h1>
          <p style={{ color: "#8fa3bd", fontSize: 14, marginTop: 6, maxWidth: 620 }}>
            Completa objetivos para ganhares packs. Os diários renovam todos os dias e os semanais à segunda-feira; os permanentes só podem ser reclamados uma vez.
          </p>

          {/* trivia diária */}
          {(() => {
            const q = triviaOfDay();
            const resp = (meta.trivia || {})[todayStr()];
            return (
              <section style={{ marginTop: 26, background: "#0E162E", border: "1px solid #39E6FF44", borderRadius: 16, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, letterSpacing: 2, color: "#39E6FF" }}>🧠 TRIVIA DO DIA</span>
                  <span style={{ fontFamily: FONT, fontSize: 11, letterSpacing: 1, color: "#6f87a8" }}>ACERTA E GANHA 1 PACK 🎁</span>
                </div>
                <div style={{ fontSize: 15, color: "#E7EEF8", fontWeight: 600, marginBottom: 14 }}>{q.q}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                  {q.opts.map((opt, i) => {
                    const certa = resp && i === q.a;
                    const errada = resp && resp.pick === i && !resp.ok;
                    return (
                      <button key={i} onClick={() => answerTrivia(i)} disabled={!!resp}
                        style={{ fontFamily: FONT, fontSize: 13, padding: "11px 14px", borderRadius: 10, cursor: resp ? "default" : "pointer", textAlign: "left", border: `1px solid ${certa ? "#1BF5A3" : errada ? "#ff7b8a" : "#22304d"}`, background: certa ? "#1BF5A322" : errada ? "#ff7b8a22" : "#0A1126", color: certa ? "#1BF5A3" : errada ? "#ff7b8a" : "#c4d2e6" }}>
                        {certa ? "✓ " : errada ? "✗ " : ""}{opt}
                      </button>
                    );
                  })}
                </div>
                {resp && <div style={{ fontSize: 12, color: resp.ok ? "#1BF5A3" : "#8fa3bd", marginTop: 12 }}>{resp.ok ? "Certa! Ganhaste um Pack Base." : "Não foi desta — nova pergunta amanhã."}</div>}
              </section>
            );
          })()}
          {[["diario", "Diários", "renovam todos os dias"], ["semanal", "Semanais", "renovam à segunda-feira"], ["permanente", "Permanentes", "uma única vez"]].map(([tipo, titulo, sub]) => (
            <section key={tipo} style={{ marginTop: 30 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, margin: 0, color: "#fff" }}>{titulo}</h2>
                <span style={{ fontSize: 11, letterSpacing: 1, color: "#6f87a8", fontFamily: FONT }}>{sub.toUpperCase()}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {objectives.filter((o) => o.tipo === tipo).map((o) => {
                  const claimed = meta.claims[o.id] === o.periodo;
                  const done = o.prog >= o.alvo;
                  const claimable = done && !claimed;
                  const isEscolha = o.reward.startsWith("escolha");
                  const nEsc = isEscolha ? (parseInt(o.reward.slice(7)) || 1) : 0;
                  const rewardPack = isEscolha ? null : (PACKS.find((p) => p.id === o.reward) || PACKS[0]);
                  const rewardLabel = isEscolha ? `🎯 ${nEsc} Escolha${nEsc > 1 ? "s" : ""}` : `🎁 ${rewardPack.name}`;
                  const rewardAccent = isEscolha ? "#39E6FF" : rewardPack.accent;
                  return (
                    <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: "#0E162E", border: `1px solid ${claimable ? "#1BF5A366" : "#22304d"}`, borderRadius: 14, padding: "14px 18px", boxShadow: claimable ? "0 0 20px rgba(27,245,163,0.18)" : "none", opacity: claimed && tipo === "permanente" ? 0.55 : 1 }}>
                      {o.team && <ClubLogo team={TEAMS.find((t) => t.id === o.team)} size={34} />}
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: "#fff" }}>{o.titulo}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                          <div style={{ flex: 1, maxWidth: 260, height: 7, borderRadius: 99, background: "#1a2440", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, (o.prog / o.alvo) * 100)}%`, height: "100%", background: done ? "linear-gradient(90deg,#1BF5A3,#39E6FF)" : "#1BF5A388", transition: "width 400ms" }} />
                          </div>
                          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: done ? "#1BF5A3" : "#8fa3bd" }}>{o.prog}/{o.alvo}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontFamily: FONT, fontSize: 11, letterSpacing: 1, color: rewardAccent, border: `1px solid ${rewardAccent}55`, borderRadius: 99, padding: "4px 12px", whiteSpace: "nowrap" }}>{rewardLabel}</span>
                        {claimed ? (
                          <span style={{ fontFamily: FONT, fontSize: 12, color: "#6f87a8", whiteSpace: "nowrap" }}>✓ Reclamado</span>
                        ) : (
                          <button onClick={() => claimObjective(o)} disabled={!claimable} style={{ ...btn(claimable), padding: "9px 18px", opacity: claimable ? 1 : 0.35, cursor: claimable ? "pointer" : "not-allowed" }}>Reclamar</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </main>
      )}

      {tab === "perfil" && (() => {
        const conquistas = buildAchievements({ collection, meta, jHist });
        const desbloq = conquistas.filter((a) => a.ok).length;
        const totalPacks = Object.values(meta.packs || {}).reduce((s, n) => s + n, 0);
        const totalTrocas = Object.values(meta.trocas || {}).reduce((s, n) => s + n, 0);
        const totalEsc = Object.values(meta.escUso || {}).reduce((s, n) => s + n, 0);
        const lend = POOL.filter((c) => c.rarity === "lendaria" && (collection[c.id] || 0) > 0).length;
        const streak = calcStreak(meta.dias);
        const best = jHist.reduce((m, e) => Math.max(m, e.total), 0);
        const sorted = Object.entries(rank.scores || {}).sort((a, b) => b[1] - a[1]);
        const pos = sorted.findIndex(([n]) => n === username);
        return (
          <main style={{ maxWidth: 940, margin: "0 auto", padding: "36px 20px 80px" }}>
            <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, margin: 0 }}>Perfil de {username}</h1>
            <p style={{ color: "#8fa3bd", fontSize: 14, marginTop: 6 }}>{desbloq}/{conquistas.length} conquistas desbloqueadas · {ownedCount}/{POOL.length} cartas</p>

            {/* estatísticas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 22 }}>
              {[["Packs abertos", totalPacks], ["Trocas feitas", totalTrocas], ["Escolhas usadas", totalEsc], ["Lendárias", `${lend}`], ["Dias seguidos", streak], ["Jornadas jogadas", jHist.length], ["Melhor jornada", best > 0 ? `${best} pts` : "—"], ["Posição no ranking", pos >= 0 ? `${pos + 1}º` : "—"]].map(([k, v]) => (
                <div key={k} style={{ background: "#0E162E", border: "1px solid #22304d", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: "#fff" }}>{v}</div>
                  <div style={{ fontSize: 11, letterSpacing: 1, color: "#6f87a8", marginTop: 4, fontFamily: FONT }}>{k.toUpperCase()}</div>
                </div>
              ))}
            </div>

            {/* vitrine */}
            <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, margin: "32px 0 12px", color: "#fff" }}>A tua vitrine</h2>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
              {vitrine.map((id, i) => {
                const c = id ? POOL.find((x) => x.id === id) : null;
                const owned = c && (collection[c.id] || 0) > 0;
                return (
                  <div key={i} onClick={() => setVitrinePick(i)} style={{ cursor: "pointer", textAlign: "center" }}>
                    {c && owned ? <Card card={c} width={150} showcase /> : (
                      <div style={{ width: 150, height: 150 * 1.42, borderRadius: 12, border: "2px dashed #2a3a5c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#44557a" }}>
                        <span style={{ fontSize: 28 }}>＋</span>
                        <span style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 2 }}>ESCOLHER</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* conquistas */}
            <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, margin: "32px 0 12px", color: "#fff" }}>Conquistas</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {conquistas.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0E162E", border: `1px solid ${a.ok ? "#1BF5A355" : "#1a2440"}`, borderRadius: 14, padding: "12px 14px", opacity: a.ok ? 1 : 0.55, boxShadow: a.ok ? "0 0 18px rgba(27,245,163,0.12)" : "none" }}>
                  <span style={{ fontSize: 26, filter: a.ok ? "none" : "grayscale(1)" }}>{a.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: a.ok ? "#1BF5A3" : "#8fa3bd" }}>{a.titulo}</div>
                    <div style={{ fontSize: 11, color: "#6f87a8" }}>{a.desc}</div>
                  </div>
                  {a.ok && <span style={{ marginLeft: "auto", color: "#1BF5A3", fontSize: 14 }}>✓</span>}
                </div>
              ))}
            </div>
          </main>
        );
      })()}

      {tab === "colecao" && (
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 20px 80px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 22 }}>
            <div>
              <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, margin: 0 }}>Coleção de {username}</h1>
              <div style={{ marginTop: 10, width: 260, height: 6, borderRadius: 99, background: "#1a2440", overflow: "hidden" }}>
                <div style={{ width: `${(ownedCount / POOL.length) * 100}%`, height: "100%", background: "linear-gradient(90deg,#1BF5A3,#39E6FF)", transition: "width 500ms" }} />
              </div>
              <div style={{ fontSize: 12, color: "#8fa3bd", marginTop: 6 }}>{ownedCount} de {POOL.length} cartas</div>
              <div style={{ fontSize: 11, color: "#6f87a8", marginTop: 4 }}>Nas cartas de jogador: <b style={{ color: "#9FB0C8" }}>J</b> jogos · <b style={{ color: "#9FB0C8" }}>%V</b> percentagem de vitórias · <b style={{ color: "#9FB0C8" }}>G/J</b> golos por jogo (época 25/26)</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {[["todas", "Todas"], ["jogadores", "Jogadores"], ["clubes", "Clubes"], ["casters", "Casters"], ["especiais", "Especiais"]].map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)} style={{ fontFamily: FONT, fontSize: 12, padding: "7px 14px", borderRadius: 99, cursor: "pointer", border: `1px solid ${filter === k ? "#1BF5A3" : "#22304d"}`, background: filter === k ? "#1BF5A322" : "transparent", color: filter === k ? "#1BF5A3" : "#9FB0C8" }}>{label}</button>
              ))}
              {clubSelect(clubFilter, setClubFilter)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Pesquisar carta…" aria-label="Pesquisar carta"
              style={{ flex: 1, minWidth: 170, padding: "10px 16px", borderRadius: 99, border: `1px solid ${search ? "#1BF5A3" : "#22304d"}`, background: "#0A1126", color: "#E7EEF8", fontFamily: FONT, outline: "none" }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "0 6px 0 14px", borderRadius: 99, border: "1px solid #22304d", background: "#0A1126" }}>
              <span style={{ fontFamily: FONT, fontSize: 11, letterSpacing: 1, color: "#6f87a8" }}>ORDENAR</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Ordenar cartas"
                style={{ fontFamily: FONT, padding: "10px 4px", cursor: "pointer", border: "none", background: "transparent", color: "#9FB0C8", outline: "none" }}>
                <option value="raridade">Raridade</option>
                <option value="ovr">OVR</option>
                <option value="nome">Nome</option>
                <option value="clube">Clube</option>
              </select>
            </span>
          </div>
          {(() => {
            const cell = (c) => {
              const owned = collection[c.id] > 0;
              return (
                <div key={c.id} onClick={() => owned && setZoom(c)} style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                  <Card card={c} width={150} interactive={owned} dim={!owned} />
                  {owned && collection[c.id] > 1 && (
                    <div style={{ position: "absolute", bottom: -6, right: 6, background: "#0E162E", border: "1px solid #1BF5A366", borderRadius: 99, padding: "2px 9px", fontFamily: FONT, fontSize: 11, color: "#1BF5A3" }}>×{collection[c.id]}</div>
                  )}
                  {!owned && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, opacity: 0.5 }}>🔒</div>}
                </div>
              );
            };
            const albumMode = filter === "todas" && clubFilter === "todos" && !search.trim() && sortBy === "raridade";
            if (!albumMode) {
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 18 }}>
                  {filtered.map(cell)}
                </div>
              );
            }
            // modo álbum: uma "página" por clube + casters + edições especiais
            const rarOrder = { lendaria: 0, epica: 1, rara: 2, comum: 3 };
            const sections = [
              ...TEAMS.map((t) => ({ key: t.id, title: t.name, logo: t, cards: POOL.filter((c) => c.team === t.id && !c.edition).sort((a, b) => (b.isClub ? 1 : 0) - (a.isClub ? 1 : 0) || b.ovr - a.ovr) })),
              { key: "casters", title: "Casters", emoji: "🎙", cards: POOL.filter((c) => c.isCaster && !c.edition).sort((a, b) => b.ovr - a.ovr) },
              { key: "especiais", title: "Edições Especiais", emoji: "✨", cards: POOL.filter((c) => c.edition).sort((a, b) => rarOrder[a.rarity] - rarOrder[b.rarity] || b.ovr - a.ovr) },
            ];
            return sections.map((s) => {
              const got = s.cards.filter((c) => collection[c.id] > 0).length;
              const complete = got === s.cards.length && s.cards.length > 0;
              return (
                <section key={s.key} style={{ marginBottom: 24, background: complete ? "linear-gradient(135deg, #18120a, #0E162E)" : "#0B1226", border: `1px solid ${complete ? "#F2C14E88" : "#1a2440"}`, borderRadius: 18, padding: "16px 16px 20px", boxShadow: complete ? "0 0 26px rgba(242,193,78,0.14)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    {s.logo ? <ClubLogo team={s.logo} size={26} /> : <span style={{ fontSize: 20 }}>{s.emoji}</span>}
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: "#fff" }}>{s.title}</span>
                    <span style={{ fontFamily: FONT, fontSize: 12, color: complete ? "#F2C14E" : "#6f87a8" }}>{got}/{s.cards.length}</span>
                    {complete && <span style={{ marginLeft: "auto", fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: 1.5, color: "#3a2a00", background: "#F2C14E", borderRadius: 99, padding: "3px 10px" }}>✓ COMPLETO</span>}
                    <div style={{ flexBasis: "100%", height: 5, borderRadius: 99, background: "#1a2440", overflow: "hidden" }}>
                      <div style={{ width: `${s.cards.length ? (got / s.cards.length) * 100 : 0}%`, height: "100%", background: complete ? "#F2C14E" : "linear-gradient(90deg,#1BF5A3,#39E6FF)", transition: "width 400ms" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>{s.cards.map(cell)}</div>
                </section>
              );
            });
          })()}
        </main>
      )}

      {pickSlot !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(3,6,12,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setPickSlot(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 860, maxWidth: "100%", maxHeight: "86vh", overflowY: "auto", background: "#0E162E", border: "1px solid #1BF5A344", borderRadius: 18, padding: 24, animation: "pop 300ms ease-out" }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: "#fff", marginBottom: 4 }}>Escolher carta para a posição {pickSlot + 1}</div>
            <div style={{ fontSize: 13, color: "#8fa3bd", marginBottom: 12 }}>Só podes usar cartas que tens na coleção. O efeito de cada carta está indicado por baixo.</div>
            <div style={{ marginBottom: 16 }}>{clubSelect(pickClub, setPickClub)}</div>
            {(() => {
              const idents = new Set(lineup.map((id, ix) => (id && ix !== pickSlot ? cardIdentity(POOL.find((x) => x.id === id)) : null)).filter(Boolean));
              const available = POOL.filter((c) => collection[c.id] > 0 && !lineup.includes(c.id) && !idents.has(cardIdentity(c)) && (pickClub === "todos" || (pickClub === "casters" ? c.isCaster : c.team === pickClub))).sort((a, b) => b.ovr - a.ovr);
              if (!available.length) return <div style={{ textAlign: "center", color: "#6f87a8", fontSize: 13, padding: "30px 0" }}>{pickClub !== "todos" ? "Não tens cartas disponíveis deste clube." : "Não tens cartas disponíveis — abre packs na Loja primeiro."}</div>;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 }}>
                  {available.map((c) => (
                    <div key={c.id} onClick={() => pickCard(c)} style={{ cursor: "pointer", textAlign: "center" }}>
                      <Card card={c} width={140} interactive={false} />
                      <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.4, color: RARITY[c.rarity].color }}>⚡ {effectOf(c).label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
              <button onClick={() => { setLineup((l) => l.map((id, i) => (i === pickSlot ? null : id))); setPickSlot(null); }} style={{ ...btn(false), color: "#ff7b8a", border: "1px solid #ff7b8a55" }}>Esvaziar posição</button>
            </div>
          </div>
        </div>
      )}

      {compResult && (
        <div style={{ position: "fixed", inset: 0, zIndex: 56, background: "rgba(3,6,12,0.93)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setCompResult(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", background: "#0E162E", border: "1px solid #1BF5A344", borderRadius: 18, padding: 24, animation: "pop 320ms ease-out" }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: "#fff", textAlign: "center" }}>Resultado da jornada {compResult.j}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "20px 0" }}>
              {compResult.rows.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: "#0A1126", borderRadius: 12, padding: "12px 14px" }}>
                  <Card card={r.card} width={74} interactive={false} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: "#fff" }}>{r.card.name}{r.captain ? " ★" : ""}</div>
                    <div style={{ fontSize: 11.5, color: "#8fa3bd", marginTop: 3, display: "flex", flexDirection: "column", gap: 2 }}>
                      {r.card.isCaster && <span>🎙 Na cabine de comentário — apoia a equipa com o seu efeito</span>}
                      {r.perf.games.map((g, gi) => (
                        <span key={gi}>
                          <b style={{ color: g.res === "V" ? "#1BF5A3" : g.res === "E" ? "#F2C14E" : "#ff7b8a", fontFamily: FONT }}>
                            {g.res === "V" ? "Vitória" : g.res === "E" ? "Empate" : "Derrota"} {g.g}–{g.og}
                          </b>
                          {" vs "}{g.opp.name}{g.oppRank <= 8 ? " (top 8)" : ""}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: RARITY[r.card.rarity].color, marginTop: 3 }}>
                      base {r.base} {r.bonus > 0 && `· efeito +${r.bonus}`} {r.synergy > 0 && `· sinergia +${r.synergy}`} {r.captain && "· capitão ×2"}
                    </div>
                  </div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: r.captain ? "#F2C14E" : "#1BF5A3", whiteSpace: "nowrap" }}>+{r.subtotal}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", fontFamily: FONT, fontWeight: 700, fontSize: 26, color: "#1BF5A3", textShadow: "0 0 18px rgba(27,245,163,0.5)" }}>+{compResult.total} pontos</div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
              <button onClick={() => setCompResult(null)} style={btn(true)}>Ver ranking</button>
            </div>
          </div>
        </div>
      )}

      {tradePreview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(3,6,12,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setTradePreview(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: "#0E162E", border: `1px solid ${RARITY[tradePreview.rarity].color}55`, borderRadius: 18, padding: 24, animation: "pop 300ms ease-out" }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: "#fff" }}>Confirmar troca</div>
            <div style={{ fontSize: 13, color: "#8fa3bd", marginTop: 6 }}>
              Estes duplicados <span style={{ color: RARITY[tradePreview.rarity].color }}>{RARITY[tradePreview.rarity].label.toLowerCase()}s</span> vão ser usados — ficas sempre com pelo menos 1 cópia de cada carta:
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", margin: "20px 0" }}>
              {Object.entries(tradePreview.picks).map(([id, n]) => {
                const c = POOL.find((x) => x.id === id);
                return (
                  <div key={id} style={{ position: "relative" }}>
                    <Card card={c} width={104} interactive={false} />
                    <div style={{ position: "absolute", top: -7, right: -7, background: "#ff7b8a", color: "#2a060c", fontFamily: FONT, fontWeight: 700, fontSize: 11, borderRadius: 99, padding: "2px 8px", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>−{n}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: FONT, fontSize: 13, color: "#c4d2e6", marginBottom: 20 }}>
              <span>{TRADE_COST}× {RARITY[tradePreview.rarity].label}</span>
              <span style={{ color: "#6f87a8" }}>→</span>
              <span style={{ color: RARITY[RARITY_UP[tradePreview.rarity]].color, fontWeight: 700 }}>1× {RARITY[RARITY_UP[tradePreview.rarity]].label} aleatória</span>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={confirmTrade} style={btn(true)}>Confirmar troca</button>
              <button onClick={() => setTradePreview(null)} style={btn(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(3,6,12,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, cursor: "pointer" }}>
          <div style={{ animation: "pop 350ms ease-out" }}><Card card={zoom} width={300} showcase /></div>
          {!zoom.isClub && zoom.j > 0 && (
            <div style={{ fontSize: 12, color: "#9FB0C8", textAlign: "center", lineHeight: 1.6, maxWidth: 320 }}>
              <b>J</b> {zoom.j} jogos · <b>%V</b> {zoom.v}% de vitórias · <b>G/J</b> {zoom.mg} golos por jogo
              <div style={{ fontSize: 11, color: "#6f87a8" }}>Estatísticas oficiais da época 25/26</div>
            </div>
          )}
          <div style={{ fontSize: 12.5, color: RARITY[zoom.rarity].color, background: "#0E162E", border: `1px solid ${RARITY[zoom.rarity].color}44`, borderRadius: 10, padding: "9px 16px", maxWidth: 330, textAlign: "center", lineHeight: 1.5 }}>
            ⚡ {effectOf(zoom).label}
            <div style={{ fontSize: 10.5, color: "#6f87a8", marginTop: 2 }}>efeito desta carta na Competição</div>
          </div>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 10 }}>
            <button onClick={() => downloadCard(zoom)} disabled={shareBusy} style={{ ...btn(false), padding: "10px 18px", fontSize: 12, opacity: shareBusy ? 0.5 : 1 }}>{shareBusy ? "A gerar…" : "⬇ Descarregar PNG"}</button>
            <button onClick={() => shareCard(zoom)} disabled={shareBusy} style={{ ...btn(true), padding: "10px 18px", fontSize: 12, opacity: shareBusy ? 0.5 : 1 }}>↗ Partilhar</button>
          </div>
          <div style={{ fontSize: 12, color: "#6f87a8" }}>toca fora da carta para fechar</div>
        </div>
      )}

      {opening && (
        <PackOpening
          pack={opening.pack}
          cards={opening.cards}
          ownedBefore={opening.ownedBefore}
          initialPhase={opening.initialPhase}
          muted={muted}
          onShare={shareCard}
          onSharePack={sharePack}
          againLabel={opening.againLabel}
          onAgain={opening.again ? () => { const fn = opening.again; setOpening(null); setTimeout(fn, 60); } : null}
          onDone={() => setOpening(null)}
        />
      )}

      {directTrade && (
        <div onClick={() => setDirectTrade(null)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(3,6,12,0.92)", overflowY: "auto", padding: "30px 16px", cursor: "pointer" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, margin: "0 auto", background: "#0E162E", border: "1px solid #39E6FF44", borderRadius: 18, padding: 22, cursor: "default" }}>
            <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, margin: 0, color: "#fff" }}>Troca à escolha — escolhe a tua carta {RARITY[RARITY_UP[directTrade]].label}</h2>
            <div style={{ fontSize: 13, color: "#8fa3bd", margin: "8px 0 18px" }}>Custa {TRADE_DIRECT} duplicados {RARITY[directTrade].label}. Toca na carta que queres — a troca é imediata.</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {POOL.filter((c) => c.rarity === RARITY_UP[directTrade]).sort((a, b) => b.ovr - a.ovr).map((c) => (
                <div key={c.id} onClick={() => directTradeGo(directTrade, c)} style={{ cursor: "pointer", textAlign: "center" }}>
                  <Card card={c} width={120} interactive={false} dim={!(collection[c.id] > 0) && false} />
                  <div style={{ fontSize: 10.5, color: collection[c.id] > 0 ? "#6f87a8" : "#1BF5A3", marginTop: 4 }}>{collection[c.id] > 0 ? `tens ${collection[c.id]}` : "não tens — NOVA"}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <button onClick={() => setDirectTrade(null)} style={btn(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {vitrinePick !== null && (
        <div onClick={() => setVitrinePick(null)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(3,6,12,0.92)", overflowY: "auto", padding: "30px 16px", cursor: "pointer" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, margin: "0 auto", background: "#0E162E", border: "1px solid #1BF5A344", borderRadius: 18, padding: 22, cursor: "default" }}>
            <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, margin: "0 0 16px", color: "#fff" }}>Escolhe a carta para a vitrine</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {POOL.filter((c) => collection[c.id] > 0 && !vitrine.some((id, ix) => id === c.id && ix !== vitrinePick)).sort((a, b) => b.ovr - a.ovr).map((c) => (
                <div key={c.id} onClick={() => { setVitrine((v) => v.map((id, i) => (i === vitrinePick ? c.id : id))); setVitrinePick(null); }} style={{ cursor: "pointer" }}>
                  <Card card={c} width={110} interactive={false} />
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 18, display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { setVitrine((v) => v.map((id, i) => (i === vitrinePick ? null : id))); setVitrinePick(null); }} style={{ ...btn(false), borderColor: "#ff7b8a66", color: "#ff7b8a" }}>Limpar slot</button>
              <button onClick={() => setVitrinePick(null)} style={btn(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {onboardStep !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(3,6,12,0.94)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: 420, maxWidth: "100%", background: "#0E162E", border: "1px solid #1BF5A344", borderRadius: 18, padding: 28, textAlign: "center", animation: "pop 300ms ease-out" }}>
            {[
              { emoji: "🎴", titulo: "Abre packs, coleciona cartas", texto: "Cada pack tem 3 cartas dos clubes e jogadores da eLiga Portugal. Ganha packs através dos Objetivos e de códigos promocionais. Quanto mais rara a carta, mais espetacular a revelação." },
              { emoji: "🔁", titulo: "Troca e completa objetivos", texto: "Junta 10 duplicados e troca-os por uma carta de raridade superior. Os objetivos diários, semanais e permanentes dão packs extra — volta todos os dias!" },
              { emoji: "🏆", titulo: "Compete com a tua equipa", texto: "Escolhe 3 cartas, define um capitão (vale ×2!) e pontua em cada jornada com os efeitos das cartas. Sobe no ranking contra os outros colecionadores." },
            ].map((s, i) => i === onboardStep && (
              <div key={i}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>{s.emoji}</div>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: "#fff", marginBottom: 10 }}>{s.titulo}</div>
                <div style={{ fontSize: 14, color: "#9FB0C8", lineHeight: 1.6 }}>{s.texto}</div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "20px 0" }}>
              {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i === onboardStep ? "#1BF5A3" : "#22304d" }} />)}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {onboardStep < 2 ? (
                <>
                  <button onClick={() => setOnboardStep(onboardStep + 1)} style={btn(true)}>Seguinte</button>
                  <button onClick={finishOnboard} style={btn(false)}>Saltar</button>
                </>
              ) : (
                <button onClick={finishOnboard} style={btn(true)}>Começar a colecionar!</button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 70, background: "#0E162E", border: "1px solid #1BF5A366", borderRadius: 99, padding: "10px 22px", fontFamily: FONT, fontSize: 13, color: "#1BF5A3", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", animation: "pop 250ms ease-out", maxWidth: "90vw", textAlign: "center" }}>{toast}</div>
      )}

      <footer style={{ textAlign: "center", padding: "20px 0 30px", fontSize: 11, color: "#44557a" }}>
        Protótipo · Cartas da época 25/26 como placeholder até ao arranque da nova época · eLiga Portugal
      </footer>
    </>
  );
}

export default App;
