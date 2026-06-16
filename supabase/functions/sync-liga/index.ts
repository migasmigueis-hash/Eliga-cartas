// supabase/functions/sync-liga/index.ts
//
// Usa classificacao.php (HTML estático, sem JS) para extrair:
//   - Grupos de cada etapa (tabelas ### Grupo A/B/C)
//   - Knockout de cada etapa (árvore com resultados)
//
// Os resultados individuais das jornadas (jogador A vs jogador B com golos)
// continuam a ser inseridos manualmente via SQL porque o site os serve
// via JavaScript dinâmico.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

const TEAM_NAME_MAP: Record<string, string> = {
  "Santa Clara": "santaclara",
  "SL Benfica Esports": "benfica",
  "Sporting CP | IGW": "sporting",
  "Sporting CP \\| IGW": "sporting",
  "FC Porto | Luna": "porto",
  "FC Porto \\| Luna": "porto",
  "SC Braga | EGN ESPORTS": "braga",
  "SC Braga \\| EGN ESPORTS": "braga",
  "Estrela da Amadora Fluxo W7M": "estrela",
  "Estoril Praia": "estoril",
  "Gil Vicente FC": "gilvicente",
  "FC Arouca By Quest | OGM": "arouca",
  "FC Arouca By Quest \\| OGM": "arouca",
  "CD Tondela | Apogee": "tondela",
  "CD Tondela \\| Apogee": "tondela",
  "Moreirense FC": "moreirense",
  "FC Famalicão": "famalicao",
  "Vitória SC | ISG": "vitoria",
  "Vitória SC \\| ISG": "vitoria",
  "Rio Ave FC": "rioave",
  "Casa Pia AC | Grow uP": "casapia",
  "Casa Pia AC \\| Grow uP": "casapia",
  "CD Nacional": "nacional",
  "AFS | TxT Gaming": "afs",
  "AFS \\| TxT Gaming": "afs",
  "FC Alverca | GOAT": "alverca",
  "FC Alverca \\| GOAT": "alverca",
  "FC Alverca": "alverca",
};

function mapTeam(name: string): string | null {
  const clean = name.trim().replace(/\s+/g, " ");
  return TEAM_NAME_MAP[clean] ?? null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// Extrai os grupos de cada etapa da tabela de classificação
// Formato: ### Grupo A\n| # | Equipa | ... |\n| 1 | ...Santa Clara...|
function parseGrupos(html: string): Record<string, Record<string, string[]>> {
  // etapaGrupos[etapa][grupo] = [teamId, ...]
  const result: Record<string, Record<string, string[]>> = {};

  // encontrar cada secção de etapa: "Grupo A", "Grupo B", "Grupo C"
  // no HTML da classificacao.php, os grupos estão dentro de divs com id "competition-etapa-N-groupM"
  // mas no markdown/texto extraído aparecem como "### Grupo A"
  const grupoRe = /#{1,4}\s*Grupo\s+([ABC])/gi;
  const grupoMatches = [...html.matchAll(grupoRe)];

  for (let gi = 0; gi < grupoMatches.length; gi++) {
    const grupoLetra = grupoMatches[gi][1].toUpperCase();
    const start = grupoMatches[gi].index!;
    const end = gi + 1 < grupoMatches.length ? grupoMatches[gi + 1].index! : html.length;
    const block = html.slice(start, end);

    // extrair nomes de equipa das linhas da tabela (alt das imagens ou texto nos td)
    const teams: string[] = [];
    // tentar pelo alt das imagens de logo de equipa
    const altRe = /alt="([^"]+)"/gi;
    for (const m of block.matchAll(altRe)) {
      const id = mapTeam(m[1]);
      if (id && !teams.includes(id)) teams.push(id);
    }
    // fallback: tentar nomes no texto da tabela
    if (teams.length === 0) {
      const lines = block.split("\n").filter((l) => l.trim().startsWith("|") && /\d/.test(l));
      for (const line of lines) {
        const cells = line.split("|").map((c) => stripTags(c).trim()).filter(Boolean);
        for (const cell of cells) {
          const id = mapTeam(cell);
          if (id && !teams.includes(id)) teams.push(id);
        }
      }
    }

    if (teams.length < 2) continue;

    // determinar a etapa pelo contexto — procurar "etapa-N" ou "Etapa N" antes deste grupo
    // no HTML da página, os grupos aparecem por etapa na ordem 1, 2, 3
    // como não temos contexto de etapa aqui, vamos agrupar por ordem de aparição
    // e depois resolver — por agora usar a posição relativa
    const etapaM = html.slice(0, grupoMatches[gi].index!).match(/Etapa\s+(\d+)[^]*$/i);
    const etapa = etapaM ? `etapa${etapaM[etapaM.length - 1]}` : "etapa1";

    // encontrar a etapa mais próxima antes deste grupo
    const etapaAntes = [...html.slice(0, grupoMatches[gi].index!).matchAll(/\[Etapa\s+(\d+)\]/gi)];
    const etapaId = etapaAntes.length > 0 ? `etapa${etapaAntes[etapaAntes.length - 1][1]}` : etapa;

    result[etapaId] ??= {};
    result[etapaId][grupoLetra] = teams.slice(0, 6);
  }

  return result;
}

// Extrai resultados do knockout da árvore na classificação
// Formato no HTML: img alt="TeamA" ... score ... img alt="TeamB"
function parseKnockout(html: string, etapaKey: string): Record<string, { teamA: string; teamB: string; golosA: number; golosB: number }[]> {
  const result: Record<string, { teamA: string; teamB: string; golosA: number; golosB: number }[]> = {};

  // procurar secção knockout para esta etapa
  const knockoutRe = new RegExp(`competition-etapa-\\d+-knockout[\\s\\S]{0,50000}`, "i");
  const knockoutM = html.match(knockoutRe);
  if (!knockoutM) return result;
  const knockBlock = knockoutM[0].slice(0, 8000);

  // pares de equipas com scores: img alt="TeamA" ... N ... img alt="TeamB" ... N
  const pairRe = /alt="([^"]+)"[^]*?(\d+)[^]*?alt="([^"]+)"[^]*?(\d+)/g;
  const pairs: { teamA: string; teamB: string; golosA: number; golosB: number }[] = [];

  for (const m of knockBlock.matchAll(pairRe)) {
    const idA = mapTeam(m[1]);
    const idB = mapTeam(m[3]);
    if (idA && idB && idA !== idB) {
      pairs.push({ teamA: idA, golosA: parseInt(m[2]), teamB: idB, golosB: parseInt(m[4]) });
    }
  }

  // os pares aparecem na ordem: QF1, QF2, QF3, QF4, MF1, MF2, Final
  // com 4 etapas × (4 QF + 2 MF + 1 Final) = 28 jogos no total para as Finals
  // para a Etapa 1: 4 QF + 2 MF + 1 Final = 7 jogos
  if (pairs.length >= 7) {
    result[`${etapaKey}_qf`] = pairs.slice(0, 4);
    result[`${etapaKey}_sf`] = pairs.slice(4, 6);
    result[`${etapaKey}_final`] = pairs.slice(6, 7);
  } else if (pairs.length >= 3) {
    // apenas MF + Final disponíveis
    result[`${etapaKey}_sf`] = pairs.slice(0, 2);
    result[`${etapaKey}_final`] = pairs.slice(2, 3);
  }

  return result;
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
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!profile?.is_admin) return jsonResponse({ error: "Sem permissão." }, 403);

  // fetch à página de classificação (tem grupos + knockout em HTML estático)
  let html: string;
  try {
    const res = await fetch("https://esports.ligaportugal.pt/classificacao.php?c=6", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
    html = await res.text();
  } catch (e) {
    return jsonResponse({ error: `Não foi possível aceder ao site: ${e}` }, 502);
  }

  const grupos = parseGrupos(html);
  const knockout = parseKnockout(html, "etapa1"); // TODO: detectar etapa actual

  const now = new Date().toISOString();
  const upserts: { key: string; data: unknown; updated_at: string }[] = [];

  // grupos
  for (const [etapa, gruposEtapa] of Object.entries(grupos)) {
    upserts.push({ key: `${etapa}_grupos`, data: gruposEtapa, updated_at: now });
  }

  // knockout
  for (const [key, matches] of Object.entries(knockout)) {
    // converter para formato com playerA/playerB vazio (será preenchido manualmente)
    const withPlayers = matches.map((m) => ({ ...m, playerA: "", playerB: "" }));
    upserts.push({ key, data: withPlayers, updated_at: now });
  }

  if (upserts.length === 0) {
    // diagnóstico
    const grupoH4 = (html.match(/#{1,4}\s*Grupo\s+[ABC]/gi) || []).length;
    const altTeams = [...html.matchAll(/alt="([^"]+)"/gi)].map((m) => mapTeam(m[1])).filter(Boolean).slice(0, 10);
    return jsonResponse({ ok: false, error: "Nenhum dado encontrado.", debug: { htmlLength: html.length, grupoH4, altTeams } }, 200);
  }

  const { error: upsertErr } = await admin.from("liga_data").upsert(upserts, { onConflict: "key" });
  if (upsertErr) return jsonResponse({ error: upsertErr.message }, 500);

  return jsonResponse({
    ok: true,
    upserted: upserts.map((u) => u.key),
    warnings: [],
    summary: { grupos: Object.keys(grupos), knockoutKeys: Object.keys(knockout) },
  });
});
