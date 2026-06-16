// supabase/functions/previsoes-simular-grupos/index.ts
//
// Substitui simulateGroups (src/App.jsx): valida os 8 apurados previstos
// pelo jogador, simula a fase de grupos no servidor (apurados reais +
// bracket dos quartos) e calcula quantos apurados o jogador acertou.
//
// body: { qual: string[] } — 8 ids de equipas, máx. 3 por grupo

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { EMPTY_PREV, simulateGroups } from "../_shared/previsoesEngine.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { qual?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Pedido inválido (JSON em falta)." }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("state")
    .eq("id", userId)
    .single();
  if (profErr || !profile) return jsonResponse({ error: "Perfil não encontrado." }, 404);

  const state = (profile.state ?? {}) as Record<string, unknown>;
  const prev = { ...EMPTY_PREV, ...((state.prev as Record<string, unknown>) ?? {}) };

  const groups = prev.groups;
  if (!Array.isArray(groups) || groups.length !== 3 || groups.some((g) => !Array.isArray(g) || g.length !== 6)) {
    return jsonResponse({ error: "Sorteia os grupos primeiro." }, 400);
  }
  if (prev.groupResult) {
    return jsonResponse({ error: "Já simulaste a fase de grupos desta previsão." }, 400);
  }

  const qual = body.qual;
  if (!Array.isArray(qual) || qual.length !== 8 || qual.some((id) => typeof id !== "string") || new Set(qual).size !== 8) {
    return jsonResponse({ error: "Escolhe exatamente 8 apurados diferentes." }, 400);
  }
  const flat = (groups as string[][]).flat();
  if (!(qual as string[]).every((id) => flat.includes(id))) {
    return jsonResponse({ error: "Apurado inválido para estes grupos." }, 400);
  }
  for (const g of groups as string[][]) {
    if ((qual as string[]).filter((id) => g.includes(id)).length > 3) {
      return jsonResponse({ error: "Máximo de 3 apurados por grupo." }, 400);
    }
  }

  const { realQual, bracket } = simulateGroups(groups as string[][]);
  const qualHits = (qual as string[]).filter((id) => realQual.includes(id)).length;

  const newPrev = {
    ...prev,
    qual,
    groupResult: { realQual, qualHits },
    bracket,
    qf: [null, null, null, null],
    sf: [null, null],
    fin: null,
    resolved: null,
    rewardClaimed: false,
  };
  const newState = { ...state, prev: newPrev };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ prev: newPrev });
});
