// supabase/functions/previsoes-iniciar/index.ts v2
//
// Modo real + Finals: bracket extraído de finals_jogos (sem grupos).
// Modo real + etapa N (grupos): carrega os grupos reais.
// Modo real + etapa N (eliminatorias): bracket directo; NUNCA cai para grupos.
// Modo simulação: sorteia grupos aleatoriamente.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { drawGroups, EMPTY_PREV } from "../_shared/previsoesEngine.ts";

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
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const [profileRes, configRes] = await Promise.all([
    admin.from("profiles").select("state").eq("id", userId).single(),
    admin.from("liga_data").select("data").eq("key", "config").single(),
  ]);
  if (profileRes.error || !profileRes.data) return jsonResponse({ error: "Perfil não encontrado." }, 404);

  const state = (profileRes.data.state ?? {}) as Record<string, unknown>;
  const config = (configRes.data?.data ?? { modo: "simulacao", etapa: 1 }) as { modo: string; etapa: number | string; fase?: string };

  if (config.modo === "real" && config.etapa === "finals") {
    const [, finalsJogosRow] = await Promise.all([
      admin.from("liga_data").select("data").eq("key", "finals_grupos").single(),
      admin.from("liga_data").select("data").eq("key", "finals_jogos").single(),
    ]);
    const jogos = ((finalsJogosRow?.data as any)?.data ?? []) as { teamA: string; teamB: string }[];

    const pairs: [string, string][] = [];
    const seen = new Set<string>();
    for (const j of jogos) {
      const key = [j.teamA, j.teamB].sort().join("|");
      if (!seen.has(key)) { seen.add(key); pairs.push([j.teamA, j.teamB]); }
      if (pairs.length === 4) break;
    }
    if (pairs.length < 4) return jsonResponse({ error: `Finals: só encontrei ${pairs.length} confrontos em finals_jogos. Sincroniza os dados completos.` }, 400);

    const bracket = pairs.flat();
    const allEquipas = [...new Set(bracket)];
    const prev = { ...EMPTY_PREV, groups: null, groupResult: { realQual: allEquipas, qualHits: 8, isFinals: true }, bracket };
    const { error: updErr } = await admin.from("profiles").update({ state: { ...state, prev }, updated_at: new Date().toISOString() }).eq("id", userId);
    if (updErr) return jsonResponse({ error: updErr.message }, 500);
    return jsonResponse({ prev, modo: "real_finals" });
  }

  if (config.modo === "real" && config.fase === "eliminatorias") {
    const etapaKey = `etapa${config.etapa}`;
    let bracket: string[] = [];
    for (const key of [`${etapaKey}_qf`, `${etapaKey}_bracket`]) {
      try {
        const { data: row } = await admin.from("liga_data").select("data").eq("key", key).single();
        const jogos = (row?.data ?? []) as { teamA: string; teamB: string }[];
        if (jogos.length >= 4) { bracket = jogos.slice(0, 4).flatMap((m) => [m.teamA, m.teamB]); break; }
      } catch (_) { /* tentar próxima */ }
    }

    if (bracket.length === 8) {
      const realQual = [...new Set(bracket)];
      const newPrev = { ...EMPTY_PREV, groups: null, groupResult: { realQual, qualHits: 0, skipGroups: true }, bracket, qf: [null, null, null, null], sf: [null, null], fin: null };
      const { error: updErr } = await admin.from("profiles").update({ state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() }).eq("id", userId);
      if (updErr) return jsonResponse({ error: updErr.message }, 500);
      return jsonResponse({ prev: newPrev, modo: "real_elim" });
    }

    return jsonResponse({
      error: "O bracket das eliminatórias ainda não está disponível. O admin precisa de sincronizar os quartos-de-final (QF) desta etapa primeiro.",
    }, 400);
  }

  let groups: string[][];
  let modoUsado = config.modo;

  if (config.modo === "real") {
    const etapaKey = `etapa${config.etapa}`;
    const { data: gruposRow } = await admin.from("liga_data").select("data").eq("key", `${etapaKey}_grupos`).single();
    const gruposData = gruposRow?.data as Record<string, string[]> | null;
    if (gruposData && gruposData.A && gruposData.B && gruposData.C) {
      groups = [gruposData.A, gruposData.B, gruposData.C];
    } else {
      modoUsado = "simulacao_fallback";
      groups = drawGroups();
    }
  } else {
    groups = drawGroups();
  }

  const prev = { ...EMPTY_PREV, groups };
  const { error: updErr } = await admin.from("profiles").update({ state: { ...state, prev }, updated_at: new Date().toISOString() }).eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ prev, modo: modoUsado });
});
