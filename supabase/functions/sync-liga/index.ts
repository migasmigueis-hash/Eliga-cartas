// supabase/functions/sync-liga/index.ts
//
// Recebe o conteúdo markdown do site (extraído pelo cliente via web_fetch/proxy
// que consegue renderizar JavaScript) e faz parse para escrever em liga_data.
//
// O site usa JavaScript para carregar os resultados — o HTML estático não os tem.
// A solução: o admin usa a extensão Claude no Chrome ou outro método para obter
// o markdown, e envia-o para esta função via body.markdown.
//
// Em alternativa, aceita body.html com o HTML pré-processado.
//
// Formato dos dados no markdown/HTML:
//   "ELiga Portugal 25/26 | Etapa 1 | Grupo A | Jornada 1"
//   "##### Santa Clara\n9 - 2\n##### SC Braga\nTundi\n9 - 2\nRikhard"

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

const TEAM_NAME_MAP: Record<string, string> = {
  "Santa Clara": "santaclara",
  "SL Benfica Esports": "benfica",
  "Sporting CP | IGW": "sporting",
  "FC Porto | Luna": "porto",
  "SC Braga | EGN ESPORTS": "braga",
  "Estrela da Amadora Fluxo W7M": "estrela",
  "Estoril Praia": "estoril",
  "Gil Vicente FC": "gilvicente",
  "FC Arouca By Quest | OGM": "arouca",
  "CD Tondela | Apogee": "tondela",
  "Moreirense FC": "moreirense",
  "FC Famalicão": "famalicao",
  "Vitória SC | ISG": "vitoria",
  "Rio Ave FC": "rioave",
  "Casa Pia AC | Grow uP": "casapia",
  "CD Nacional": "nacional",
  "AFS | TxT Gaming": "afs",
  "FC Alverca | GOAT": "alverca",
};

// Mapeamento verificado jogador→pl-id (do site, confirmado manualmente)
const PLAYER_NAME_MAP: Record<string, string> = {
  "Leks": "pl-leks", "MarQzou": "pl-marqzou", "Tundi": "pl-tundi",
  "GugaFerraz": "pl-gugaferraz", "DiogoPeyroteo9": "pl-diogopeyroteo",
  "bret4o": "pl-bret4o", "Peter16": "pl-peter16", "Diogo Silva": "pl-diogosilva",
  "JPeres99": "pl-jperes99", "Rikhard": "pl-rikhard", "Mike_27": "pl-mike27",
  "Gueric": "pl-gueric", "Luca-NR1": "pl-lucanr1", "Licapu": "pl-licapu",
  "Zitsubasa": "pl-zitsubasa", "Jotapb10": "pl-jotapb10", "Guiddias_14": "pl-guiddias",
  "Darkley11": "pl-darkley11", "Vinagrolih": "pl-vinagrolih", "Rodr7gol": "pl-rodr7gol",
  "Dekass": "pl-dekass", "Skreibar": "pl-skreibar", "phoenix3687": "pl-phoenix",
  "RickyP": "pl-rickyp", "GodRafa": "pl-godrafa", "ggrilo_10": "pl-ggrilo",
  "Canha14": "pl-canha14", "JSilva29_": "pl-jsilva29", "Npena80": "pl-npena80",
  "Giobundyy": "pl-giobundyy",
};

function mapTeam(name: string): { id: string; warn?: string } {
  const clean = name.trim().replace(/\s+/g, " "); // normalizar múltiplos espaços
  const id = TEAM_NAME_MAP[clean];
  if (id) return { id };
  return { id: clean.toLowerCase().replace(/\W+/g, ""), warn: `Equipa não mapeada: "${clean}"` };
}
function mapPlayer(name: string): { id: string; warn?: string } {
  const clean = name.trim();
  if (!clean) return { id: "" };
  const id = PLAYER_NAME_MAP[clean];
  if (id) return { id };
  return { id: clean.toLowerCase().replace(/\W+/g, ""), warn: `Jogador não mapeado: "${clean}"` };
}
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

interface MatchResult {
  teamA: string; playerA: string; golosA: number;
  teamB: string; playerB: string; golosB: number;
}

// Parser que funciona com o markdown produzido pelo web_fetch (##### headings)
// E também com o HTML bruto (h5 tags + tabs)
function parseContent(content: string): { byLabel: Map<string, MatchResult[]>; warnings: string[] } {
  const warnings: string[] = [];
  const byLabel = new Map<string, MatchResult[]>();

  // normalizar: converter h5 HTML para linhas simples
  let text = content
    .replace(/<h5[^>]*>/gi, "\n")
    .replace(/<\/h5>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");

  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const SCORE_RE = /^(\d+)\s*-\s*(\d+)$/;
  const LABEL_RE = /^ELiga Portugal 25\/26 \|[\s\t]*(.+)$/;
  // uma linha é nome de equipa se existir no mapa
  const isTeam = (s: string) => !!TEAM_NAME_MAP[s.trim().replace(/\s+/g, " ")];
  // uma linha é nome de jogador se existir no mapa
  const isPlayer = (s: string) => !!PLAYER_NAME_MAP[s.trim()];
  // uma linha é ##### Equipa (HTML) ou só o nome da equipa (plain text)
  const TEAM_HEADER_RE = /^#{3,5}\s+(.+)$/;

  let i = 0;
  while (i < lines.length) {
    const labelM = lines[i].match(LABEL_RE);
    if (!labelM) { i++; continue; }
    const label = labelM[1].replace(/[\t]+/g, " ").trim();
    i++;

    // teamA: linha com ##### ou nome de equipa directo
    while (i < lines.length && !lines[i].match(LABEL_RE) && !isTeam(lines[i]) && !lines[i].match(TEAM_HEADER_RE)) i++;
    if (i >= lines.length || lines[i].match(LABEL_RE)) continue;
    const teamAM = lines[i].match(TEAM_HEADER_RE);
    const teamAName = teamAM ? teamAM[1].trim() : lines[i].trim(); i++;
    // saltar duplicado (nome de equipa pode aparecer 2x — alt + h5)
    if (i < lines.length && (lines[i].trim() === teamAName || lines[i].trim() === teamAName.replace(/\s*\|.*/, "").trim())) i++;

    // score global (próxima linha com N - N)
    while (i < lines.length && !lines[i].match(SCORE_RE) && !lines[i].match(LABEL_RE) && !isTeam(lines[i])) i++;
    if (i >= lines.length || !lines[i].match(SCORE_RE)) continue;
    const sg = lines[i].match(SCORE_RE)!;
    const golosA = parseInt(sg[1]); const golosB = parseInt(sg[2]); i++;

    // teamB
    while (i < lines.length && !isTeam(lines[i]) && !lines[i].match(TEAM_HEADER_RE) && !lines[i].match(LABEL_RE)) i++;
    if (i >= lines.length || lines[i].match(LABEL_RE)) continue;
    const teamBM = lines[i].match(TEAM_HEADER_RE);
    const teamBName = teamBM ? teamBM[1].trim() : lines[i].trim(); i++;
    // saltar duplicado
    if (i < lines.length && (lines[i].trim() === teamBName || lines[i].trim() === teamBName.replace(/\s*\|.*/, "").trim())) i++;

    // playerA: próxima linha que é nome de jogador (conhecido) ou texto não-score não-equipa
    while (i < lines.length && (lines[i].match(SCORE_RE) || lines[i].match(LABEL_RE) || isTeam(lines[i]) || lines[i].startsWith("!"))) i++;
    if (i >= lines.length || lines[i].match(LABEL_RE)) continue;
    const playerAName = lines[i].trim(); i++;

    // score do playerA (ignorar)
    while (i < lines.length && !lines[i].match(SCORE_RE) && !lines[i].match(LABEL_RE) && !isPlayer(lines[i])) i++;
    if (i < lines.length && lines[i].match(SCORE_RE)) i++;

    // playerB
    while (i < lines.length && (lines[i].match(SCORE_RE) || lines[i].match(LABEL_RE) || isTeam(lines[i]) || lines[i].startsWith("!"))) i++;
    const playerBName = (i < lines.length && !lines[i].match(LABEL_RE)) ? lines[i].trim() : "";
    if (playerBName) i++;

    const ta = mapTeam(teamAName); const tb = mapTeam(teamBName);
    const pa = mapPlayer(playerAName); const pb = mapPlayer(playerBName);
    if (ta.warn) warnings.push(ta.warn);
    if (tb.warn) warnings.push(tb.warn);
    if (pa.warn) warnings.push(pa.warn);
    if (pb.warn) warnings.push(pb.warn);

    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label)!.push({ teamA: ta.id, playerA: pa.id, golosA, teamB: tb.id, playerB: pb.id, golosB });
  }

  return { byLabel, warnings };
}

function computeQualified(groups: string[][], allMatches: MatchResult[]): string[] {
  type Std = { team: string; pts: number; gd: number; gm: number };
  const s: Record<string, Std> = {};
  const add = (id: string) => { if (!s[id]) s[id] = { team: id, pts: 0, gd: 0, gm: 0 }; };
  for (const m of allMatches) {
    add(m.teamA); add(m.teamB);
    const gd = m.golosA - m.golosB;
    if (gd > 0) s[m.teamA].pts += 3;
    else if (gd === 0) { s[m.teamA].pts += 1; s[m.teamB].pts += 1; }
    else s[m.teamB].pts += 3;
    s[m.teamA].gd += gd; s[m.teamA].gm += m.golosA;
    s[m.teamB].gd -= gd; s[m.teamB].gm += m.golosB;
  }
  const sort = (ids: string[]) => ids.map((t) => s[t] || { team: t, pts: 0, gd: 0, gm: 0 })
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gm - a.gm);
  const qual: string[] = [];
  const thirds: Std[] = [];
  for (const g of groups) {
    const sorted = sort(g);
    if (sorted[0]) qual.push(sorted[0].team);
    if (sorted[1]) qual.push(sorted[1].team);
    if (sorted[2]) thirds.push(sorted[2]);
  }
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gm - a.gm);
  thirds.slice(0, 2).forEach((t) => qual.push(t.team));
  return qual;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { html?: string; markdown?: string; etapa?: string | number } = {};
  try { body = await req.json(); } catch { /* faz fetch */ }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!profile?.is_admin) return jsonResponse({ error: "Sem permissão." }, 403);

  // conteúdo: markdown enviado pelo cliente, HTML enviado, ou fetch directo
  let content = body.markdown ?? body.html ?? "";
  // etapa de contexto (usada quando o texto não tem "Etapa N" no label — ex: "Quartos de Final")
  const etapaContexto = body.etapa ? `etapa${body.etapa}` : null;
  if (!content || (content.length < 100 && !content.includes("ELiga Portugal"))) {
    try {
      const res = await fetch("https://esports.ligaportugal.pt/resultados.php?c=6", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-PT,pt;q=0.9",
          "Cache-Control": "no-cache",
        },
      });
      content = await res.text();
    } catch (e) {
      return jsonResponse({ error: `Não foi possível aceder ao site: ${e}` }, 502);
    }
  }

  const { byLabel, warnings } = parseContent(content);

  if (byLabel.size === 0) {
    const labelCount = (content.match(/ELiga Portugal 25\/26 \|/g) || []).length;
    const firstLines = content.split("\n").slice(0, 10).map(l => l.trim());
    return jsonResponse({ ok: false, error: "Nenhum jogo encontrado. O conteúdo pode não incluir resultados de grupo (são carregados via JavaScript no site).", debug: { contentLength: content.length, labelCount, firstLines } }, 200);
  }

  const etapaGrupos: Record<string, Record<string, string[]>> = {};
  // etapaJornadas[etapa][grupo][ronda] = matches
  const etapaJornadas: Record<string, Record<string, Record<string, MatchResult[]>>> = {};
  const knockoutMatches: Record<string, MatchResult[]> = {};

  for (const [label, matches] of byLabel.entries()) {
    const grupoM = label.match(/Etapa\s+(\d+)\s*\|\s*Grupo\s+([ABC])\s*\|\s*Jornada\s+(\d+)/i);
    if (grupoM) {
      const etapa = `etapa${grupoM[1]}`; const grupo = grupoM[2].toUpperCase(); const jornada = `jornada${grupoM[3]}`;
      etapaGrupos[etapa] ??= {}; etapaGrupos[etapa][grupo] ??= [];
      for (const m of matches) {
        if (!etapaGrupos[etapa][grupo].includes(m.teamA)) etapaGrupos[etapa][grupo].push(m.teamA);
        if (!etapaGrupos[etapa][grupo].includes(m.teamB)) etapaGrupos[etapa][grupo].push(m.teamB);
      }
      etapaJornadas[etapa] ??= {};
      etapaJornadas[etapa][grupo] ??= {};
      etapaJornadas[etapa][grupo][jornada] ??= [];
      etapaJornadas[etapa][grupo][jornada].push(...matches); continue;
    }
    const lcM = label.match(/Etapa\s+(\d+)\s*\|\s*Last Chance/i);
    if (lcM) { knockoutMatches[`etapa${lcM[1]}_lastchance`] ??= []; knockoutMatches[`etapa${lcM[1]}_lastchance`].push(...matches); continue; }
    // Finals | Finals | Jornada N — todos os jogos vão para finals_jogos (pool único)
    const finalsJornadaM = label.match(/Finals\s*\|\s*Finals\s*\|\s*Jornada\s+(\d+)/i);
    if (finalsJornadaM) {
      knockoutMatches["finals_jogos"] ??= [];
      knockoutMatches["finals_jogos"].push(...matches); continue;
    }
    const etapaM = label.match(/Etapa\s+(\d+)/i);
    const etapaKey = etapaM ? `etapa${etapaM[1]}` : (etapaContexto ?? "etapa1");
    if (/Quartos/i.test(label)) { knockoutMatches[`${etapaKey}_qf`] ??= []; knockoutMatches[`${etapaKey}_qf`].push(...matches); }
    else if (/Meias/i.test(label)) { knockoutMatches[`${etapaKey}_sf`] ??= []; knockoutMatches[`${etapaKey}_sf`].push(...matches); }
    // usar regex estrito para "Final" — não apanhar "Finals"
    else if (/\bFinal\b/i.test(label) && !/\bFinals\b/i.test(label) && !/Meias/i.test(label)) { knockoutMatches[`${etapaKey}_final`] ??= []; knockoutMatches[`${etapaKey}_final`].push(...matches); }
  }

  const now = new Date().toISOString();
  const upserts: { key: string; data: unknown; updated_at: string }[] = [];

  for (const [etapa, grupos] of Object.entries(etapaGrupos)) {
    // merge com grupos já existentes na BD
    // merge: só adicionar grupos novos, nunca apagar grupos já existentes na BD
    let existingData: Record<string, string[]> = {};
    try {
      const { data: existingRow } = await admin.from("liga_data").select("data").eq("key", `${etapa}_grupos`).single();
      if (existingRow?.data) existingData = existingRow.data as Record<string, string[]>;
    } catch (_) { /* key ainda não existe — começa vazio */ }
    const gruposMerged = { ...existingData };
    for (const [g, equipas] of Object.entries(grupos)) {
      if (!gruposMerged[g] || (gruposMerged[g] as string[]).length === 0) gruposMerged[g] = equipas as string[];
    }
    upserts.push({ key: `${etapa}_grupos`, data: gruposMerged, updated_at: now });
    // resultados por ronda, separados por grupo
    for (const [grupo, jornadas] of Object.entries(etapaJornadas[etapa] ?? {})) {
      for (const [jornada, matches] of Object.entries(jornadas as Record<string, MatchResult[]>)) {
        const rondaNum = jornada.replace("jornada", "");
        upserts.push({ key: `${etapa}_grupo${grupo}_ronda${rondaNum}`, data: matches, updated_at: now });
      }
    }
    const gruposList = Object.values(grupos);
    const allMatches = Object.values(etapaJornadas[etapa] ?? {})
      .flatMap((grupoRondas) => Object.values(grupoRondas as Record<string, MatchResult[]>).flat());
    const qual = computeQualified(gruposList, allMatches);
    if (qual.length === 8) {
      const bracket = [...qual].sort(() => 0.5 - Math.random());
      upserts.push({ key: `${etapa}_grupos_resultado`, data: { realQual: qual, bracket }, updated_at: now });
    }
  }
  for (const [key, matches] of Object.entries(knockoutMatches)) {
    upserts.push({ key, data: matches, updated_at: now });
    // para finals_jogos, extrair as 8 equipas e guardar em finals_grupos
    if (key === "finals_jogos") {
      const equipas = [...new Set(matches.flatMap((m: MatchResult) => [m.teamA, m.teamB]).filter(Boolean))];
      if (equipas.length > 0) upserts.push({ key: "finals_grupos", data: { equipas }, updated_at: now });
    }
  }

  if (upserts.length === 0) {
    return jsonResponse({ ok: false, error: "Parse não encontrou dados estruturados.", debug: { labels: [...byLabel.keys()].slice(0, 10) } }, 200);
  }

  const { error: upsertErr } = await admin.from("liga_data").upsert(upserts, { onConflict: "key" });
  if (upsertErr) return jsonResponse({ error: upsertErr.message }, 500);

  return jsonResponse({
    ok: true,
    upserted: upserts.map((u) => u.key),
    warnings: warnings.slice(0, 20),
    summary: { etapas: Object.keys(etapaGrupos), totalJogos: [...byLabel.values()].reduce((s, m) => s + m.length, 0) },
  });
});
