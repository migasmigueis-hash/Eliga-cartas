import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

type Player = { id: string; name: string };
type Club = { id: string; name: string; short: string; logo: string; players: Player[] };
type MatchResult = { round?: number; teamA: string; playerA: string; golosA: number; teamB: string; playerB: string; golosB: number };

const idPattern = /^[a-z0-9-]{1,80}$/;

function validateCatalog(value: unknown): Club[] | string {
  if (!Array.isArray(value) || value.length < 2 || value.length > 40) return "O catálogo deve ter entre 2 e 40 clubes.";
  const clubs = value as Club[];
  const clubIds = new Set<string>();
  const playerIds = new Set<string>();
  for (const club of clubs) {
    if (!club || typeof club !== "object" || !idPattern.test(club.id)) return "ID de clube inválido.";
    if (clubIds.has(club.id)) return `ID de clube repetido: ${club.id}.`;
    clubIds.add(club.id);
    if (typeof club.name !== "string" || !club.name.trim() || club.name.length > 100) return `Nome inválido no clube ${club.id}.`;
    if (typeof club.short !== "string" || !club.short.trim() || club.short.length > 12) return `Sigla inválida no clube ${club.name}.`;
    if (typeof club.logo !== "string" || club.logo.length > 1000) return `Logo inválido no clube ${club.name}.`;
    if (club.logo && !club.logo.startsWith("http://") && !club.logo.startsWith("https://") && !/^[a-zA-Z0-9._-]{1,200}$/.test(club.logo)) return `Logo inválido no clube ${club.name}.`;
    if (!Array.isArray(club.players) || club.players.length < 1 || club.players.length > 10) return `${club.name} deve ter entre 1 e 10 jogadores.`;
    for (const player of club.players) {
      if (!player || !idPattern.test(player.id) || typeof player.name !== "string" || !player.name.trim() || player.name.length > 80) return `Jogador inválido no clube ${club.name}.`;
      if (playerIds.has(player.id)) return `ID de jogador repetido: ${player.id}.`;
      playerIds.add(player.id);
    }
  }
  return clubs.map((club) => ({ ...club, name: club.name.trim(), short: club.short.trim().toUpperCase(), players: club.players.map((player) => ({ ...player, name: player.name.trim() })) }));
}

function validateMatches(value: unknown, catalog: Club[], groups: boolean): MatchResult[] | string {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return "Adiciona entre 1 e 100 jogos.";
  const clubMap = new Map(catalog.map((club) => [club.id, club]));
  const matches = value as MatchResult[];
  for (const [index, match] of matches.entries()) {
    const clubA = clubMap.get(match.teamA), clubB = clubMap.get(match.teamB);
    if (!clubA || !clubB || match.teamA === match.teamB) return `Clubes inválidos no jogo ${index + 1}.`;
    if (!clubA.players.some((player) => `pl-${player.id}` === match.playerA) || !clubB.players.some((player) => `pl-${player.id}` === match.playerB)) return `Jogador fora do clube no jogo ${index + 1}.`;
    if (!Number.isInteger(match.golosA) || !Number.isInteger(match.golosB) || match.golosA < 0 || match.golosB < 0 || match.golosA > 99 || match.golosB > 99) return `Resultado inválido no jogo ${index + 1}.`;
    if (groups && (!Number.isInteger(match.round) || Number(match.round) < 1 || Number(match.round) > 5)) return `Ronda inválida no jogo ${index + 1}.`;
  }
  return matches.map((match) => ({ ...match, ...(groups ? { round: Number(match.round) } : {}) }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "JSON inválido." }, 400); }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!profile?.is_admin) return jsonResponse({ error: "Sem permissão." }, 403);

  const action = String(body.action || "load");
  const { data: catalogRow } = await admin.from("liga_data").select("data").eq("key", "competition_catalog").maybeSingle();
  const currentCatalog = Array.isArray(catalogRow?.data) ? catalogRow.data as Club[] : [];

  if (action === "load") return jsonResponse({ ok: true, catalog: currentCatalog });

  if (action === "loadResults") {
    const etapa = body.etapa === "finals" ? "finals" : Number(body.etapa);
    const phase = String(body.phase || "groups");
    const group = String(body.group || "A");
    if (etapa !== "finals" && ![1, 2, 3].includes(etapa)) return jsonResponse({ error: "Etapa inválida." }, 400);
    if (phase === "groups") {
      if (etapa === "finals" || !["A", "B", "C"].includes(group)) return jsonResponse({ error: "Grupo inválido." }, 400);
      const etapaKey = `etapa${etapa}`;
      const rows = await Promise.all([1, 2, 3, 4, 5].map((round) => admin.from("liga_data").select("data").eq("key", `${etapaKey}_grupo${group}_ronda${round}`).maybeSingle()));
      const matches = rows.flatMap((row, index) => Array.isArray(row.data?.data) ? (row.data.data as MatchResult[]).map((match) => ({ ...match, round: index + 1 })) : []);
      return jsonResponse({ ok: true, matches });
    }
    const key = etapa === "finals" ? "finals_jogos" : `etapa${etapa}_${phase}`;
    const { data: row } = await admin.from("liga_data").select("data").eq("key", key).maybeSingle();
    return jsonResponse({ ok: true, matches: Array.isArray(row?.data) ? row.data : [] });
  }

  if (action === "saveCatalog") {
    const validated = validateCatalog(body.catalog);
    if (typeof validated === "string") return jsonResponse({ error: validated }, 400);
    const { error } = await admin.from("liga_data").upsert({ key: "competition_catalog", data: validated, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, catalog: validated });
  }

  if (action !== "saveResults") return jsonResponse({ error: "Ação desconhecida." }, 400);
  if (!currentCatalog.length) return jsonResponse({ error: "Guarda primeiro o catálogo de clubes e jogadores." }, 400);

  const etapa = body.etapa === "finals" ? "finals" : Number(body.etapa);
  if (etapa !== "finals" && ![1, 2, 3].includes(etapa)) return jsonResponse({ error: "Etapa inválida." }, 400);
  const phase = String(body.phase || "groups");
  const isGroups = phase === "groups";
  if (etapa === "finals" && phase !== "finals") return jsonResponse({ error: "As Finals usam a fase Finals." }, 400);
  if (etapa !== "finals" && !["groups", "qf", "sf", "final"].includes(phase)) return jsonResponse({ error: "Fase inválida." }, 400);
  const group = String(body.group || "A");
  if (isGroups && !["A", "B", "C"].includes(group)) return jsonResponse({ error: "Grupo inválido." }, 400);

  const validatedMatches = validateMatches(body.matches, currentCatalog, isGroups);
  if (typeof validatedMatches === "string") return jsonResponse({ error: validatedMatches }, 400);
  const cleanMatches = validatedMatches.map(({ round: _round, ...match }) => match);
  const etapaKey = etapa === "finals" ? "finals" : `etapa${etapa}`;
  const upserts: { key: string; data: unknown; updated_at: string }[] = [];
  const updatedAt = new Date().toISOString();

  if (isGroups) {
    const { data: groupsRow } = await admin.from("liga_data").select("data").eq("key", `${etapaKey}_grupos`).maybeSingle();
    const groups = (groupsRow?.data && typeof groupsRow.data === "object" ? groupsRow.data : {}) as Record<string, string[]>;
    groups[group] = [...new Set(validatedMatches.flatMap((match) => [match.teamA, match.teamB]))];
    upserts.push({ key: `${etapaKey}_grupos`, data: groups, updated_at: updatedAt });
    for (let round = 1; round <= 5; round++) {
      const roundMatches = validatedMatches.filter((match) => match.round === round).map(({ round: _round, ...match }) => match);
      upserts.push({ key: `${etapaKey}_grupo${group}_ronda${round}`, data: roundMatches, updated_at: updatedAt });
    }
  } else {
    const key = etapa === "finals" ? "finals_jogos" : `${etapaKey}_${phase}`;
    upserts.push({ key, data: cleanMatches, updated_at: updatedAt });
    if (etapa === "finals") {
      upserts.push({ key: "finals_grupos", data: { equipas: [...new Set(cleanMatches.flatMap((match) => [match.teamA, match.teamB]))] }, updated_at: updatedAt });
    }
  }

  const { error } = await admin.from("liga_data").upsert(upserts, { onConflict: "key" });
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ ok: true, keys: upserts.map((item) => item.key), matches: validatedMatches.length });
});
