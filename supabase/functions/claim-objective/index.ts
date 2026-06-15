// supabase/functions/claim-objective/index.ts
//
// Substitui a parte "escolhaN" de claimObjective (src/App.jsx): marca
// meta.claims[id] = periodo e soma as Escolhas correspondentes, tudo numa
// escrita atómica — fecha a mesma classe de corrida que o "claim" do
// open-pack fechou para os objetivos com recompensa em pack.
//
// Nota: isto valida que o "id" é um objetivo conhecido com recompensa em
// Escolhas, e que ainda não foi reclamado neste período — mas não recalcula
// se o objetivo está mesmo cumprido (prog >= alvo). Essa validação completa
// fica para uma sub-fase de hardening futura.
//
// body: { id: string, periodo: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { OBJECTIVE_ESCOLHA_REWARDS } from "../_shared/gameData.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { id?: string; periodo?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Pedido inválido (JSON em falta)." }, 400);
  }

  const id = body.id;
  const periodo = body.periodo;
  if (typeof id !== "string" || typeof periodo !== "string" || periodo.length > 20) {
    return jsonResponse({ error: "Pedido inválido." }, 400);
  }
  const amount = OBJECTIVE_ESCOLHA_REWARDS[id];
  if (!amount) return jsonResponse({ error: "Objetivo desconhecido." }, 400);

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
  const prevMeta = (state.meta as Record<string, unknown>) ?? {};
  const claims = { ...((prevMeta.claims as Record<string, string>) ?? {}) };

  if (claims[id] === periodo) return jsonResponse({ error: "Objetivo já reclamado." }, 400);
  claims[id] = periodo;
  const meta = { ...prevMeta, claims };
  const escolhas = ((state.escolhas as number) || 0) + amount;

  const newState = { ...state, meta, escolhas };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ escolhas, meta, amount });
});
