// supabase/functions/previsoes-iniciar/index.ts
//
// Modo simulacao: sorteia os grupos aleatoriamente (comportamento original).
// Modo real: lê os grupos reais da etapa atual em liga_data (ex: "etapa1_grupos").
//            Se os dados ainda não estiverem disponíveis, sorteia e assinala.

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

  let groups: string[][];
  let modoUsado = config.modo;

  if (config.modo === "real") {
    const etapaKey = config.etapa === "finals" ? "finals" : `etapa${config.etapa}`;
    const { data: gruposRow } = await admin.from("liga_data").select("data").eq("key", `${etapaKey}_grupos`).single();
    const gruposData = gruposRow?.data as Record<string, string[]> | null;
    if (gruposData && gruposData.A && gruposData.B && gruposData.C) {
      groups = [gruposData.A, gruposData.B, gruposData.C];
    } else {
      // fallback: sortear
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
