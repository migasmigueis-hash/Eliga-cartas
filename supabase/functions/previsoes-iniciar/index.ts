// supabase/functions/previsoes-iniciar/index.ts
//
// Substitui drawGroups (src/App.jsx): sorteia as 18 equipas em 3 grupos de 6
// no servidor (para que o jogador não possa "encomendar" um agrupamento que
// favoreça as suas previsões) e reinicia profiles.state.prev.

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

  const groups = drawGroups();
  const prev = { ...EMPTY_PREV, groups };
  const newState = { ...state, prev };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ prev });
});
