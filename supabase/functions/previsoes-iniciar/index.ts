// supabase/functions/previsoes-iniciar/index.ts
//
// Modo real + Finals: carrega as 8 equipas de finals_grupos e salta directamente
//                     para a fase de eliminatórias (sem fase de grupos).
// Modo real + etapa N: carrega os grupos reais da etapa.
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
  const config = (configRes.data?.data ?? { modo: "simulacao", etapa: 1 }) as { modo: string; etapa: number | string };

  // Finals em modo real: saltar fase de grupos — bracket extraído dos finals_jogos
  if (config.modo === "real" && config.etapa === "finals") {
    const [finalsGruposRow, finalsJogosRow] = await Promise.all([
      admin.from("liga_data").select("data").eq("key", "finals_grupos").single(),
      admin.from("liga_data").select("data").eq("key", "finals_jogos").single(),
    ]);
    const equipas = ((finalsGruposRow?.data as any)?.data ?? (finalsGruposRow?.data as any))?.equipas ?? [];
    const jogos = ((finalsJogosRow?.data as any)?.data ?? []) as { teamA: string; teamB: string }[];

    // extrair os 4 confrontos QF pela ordem de aparição no texto
    // cada confronto é um par único de equipas (teamA, teamB) — aparecem pela ordem do bracket
    const pairs: [string, string][] = [];
    const seen = new Set<string>();
    for (const j of jogos) {
      const key = [j.teamA, j.teamB].sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([j.teamA, j.teamB]);
      }
      if (pairs.length === 4) break; // só os 4 primeiros pares = QF
    }

    if (pairs.length < 4) return jsonResponse({ error: `Finals: só encontrei ${pairs.length} confrontos em finals_jogos. Sincroniza os dados completos.` }, 400);

    // bracket: [QF1_A, QF1_B, QF2_A, QF2_B, QF3_A, QF3_B, QF4_A, QF4_B]
    const bracket = pairs.flat();
    const allEquipas = [...new Set(bracket)];

    const prev = {
      ...EMPTY_PREV,
      groups: null,
      groupResult: { realQual: allEquipas, qualHits: 8, isFinals: true },
      bracket,
    };
    const newState = { ...state, prev };
    const { error: updErr } = await admin.from("profiles").update({ state: newState, updated_at: new Date().toISOString() }).eq("id", userId);
    if (updErr) return jsonResponse({ error: updErr.message }, 500);
    return jsonResponse({ prev, modo: "real_finals" });
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
  const newState = { ...state, prev };

  const { error: updErr } = await admin.from("profiles").update({ state: newState, updated_at: new Date().toISOString() }).eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ prev, modo: modoUsado });
});
