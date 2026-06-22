// supabase/functions/admin-limpar-previsoes/index.ts  (admin)
// Limpa state.prevHist (tabela) E state.prev (previsão a decorrer) de TODOS os perfis.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

const EMPTY_PREV = {
  groups: null, qual: [], groupResult: null, bracket: null,
  qf: [null, null, null, null], sf: [null, null], fin: null,
  resolved: null, rewardClaimed: false, groupReward: null, groupRewardClaimed: false,
};

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
  const { data: adminProfile } = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!adminProfile?.is_admin) return jsonResponse({ error: "Sem permissão." }, 403);

  const { data: profiles } = await admin.from("profiles").select("id, state");
  let cleared = 0;

  for (const profile of profiles ?? []) {
    const state = (profile.state ?? {}) as Record<string, unknown>;
    const temPrevHist = Array.isArray(state.prevHist) && (state.prevHist as unknown[]).length > 0;
    const temPrev = state.prev && Object.keys(state.prev as object).length > 0 &&
      JSON.stringify(state.prev) !== JSON.stringify(EMPTY_PREV);
    if (!temPrevHist && !temPrev) continue;

    const newState = { ...state, prevHist: [], prev: EMPTY_PREV };
    await admin.from("profiles").update({ state: newState, updated_at: new Date().toISOString() }).eq("id", profile.id);
    cleared++;
  }

  return jsonResponse({ ok: true, cleared });
});
