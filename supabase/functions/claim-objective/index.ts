// supabase/functions/claim-objective/index.ts
//
// Substitui a parte "escolhaN" de claimObjective (src/App.jsx): confirma no
// servidor que o objetivo está mesmo cumprido (prog >= alvo, periodo certo,
// ainda não reclamado) recalculando-o a partir de profiles.state — e só
// depois marca meta.claims[id] = periodo e soma as Escolhas, tudo numa
// escrita atómica.
//
// body: { id: string, periodo: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { validateObjectiveClaim } from "../_shared/objectives.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { id?: string; periodo?: string };
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
  const prevMeta = (state.meta as Record<string, unknown>) ?? {};
  const collection = (state.collection as Record<string, number>) ?? {};

  const result = validateObjectiveClaim(body.id, body.periodo, prevMeta, collection);
  if (result.ok === false) return jsonResponse({ error: result.error }, 400);
  if (!result.reward.startsWith("escolha")) {
    return jsonResponse({ error: "Este objetivo dá um pack, não Escolhas — abre-o na Loja/Objetivos." }, 400);
  }
  const amount = parseInt(result.reward.slice("escolha".length), 10);

  const id = body.id as string;
  const periodo = body.periodo as string;
  const claims = { ...((prevMeta.claims as Record<string, string>) ?? {}) };
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
