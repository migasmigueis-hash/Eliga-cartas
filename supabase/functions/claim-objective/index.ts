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
import { configuredCardPool } from "../_shared/configuredCardPool.ts";

const ESCOLHAS_CAP = 10;

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

  const [profileResult, configResult] = await Promise.all([
    admin.from("profiles").select("state").eq("id", userId).single(),
    admin.from("liga_data").select("data").eq("key", "config").single(),
  ]);
  const { data: profile, error: profErr } = profileResult;
  if (profErr || !profile) return jsonResponse({ error: "Perfil não encontrado." }, 404);

  const state = (profile.state ?? {}) as Record<string, unknown>;
  const prevMeta = (state.meta as Record<string, unknown>) ?? {};
  const collection = (state.collection as Record<string, number>) ?? {};

  const cardPool = configuredCardPool((configResult.data?.data ?? {}) as Record<string, unknown>);
  const result = validateObjectiveClaim(body.id, body.periodo, prevMeta, collection, cardPool);
  if (result.ok === false) return jsonResponse({ error: result.error }, 400);
  if (!result.reward.startsWith("escolha")) {
    return jsonResponse({ error: "Este objetivo dá um pack, não Escolhas — abre-o na Loja/Objetivos." }, 400);
  }
  const amount = parseInt(result.reward.slice("escolha".length), 10);
  const currentEscolhas = (state.escolhas as number) || 0;
  if (currentEscolhas + amount > ESCOLHAS_CAP) {
    return jsonResponse({ error: `Só podes acumular ${ESCOLHAS_CAP} Escolhas. Usa algumas antes de reclamar este objetivo.` }, 400);
  }

  const id = body.id as string;
  const periodo = body.periodo as string;
  const claims = { ...((prevMeta.claims as Record<string, string>) ?? {}) };
  claims[id] = periodo;
  const meta = { ...prevMeta, claims };
  const escolhas = currentEscolhas + amount;

  const newState = { ...state, meta, escolhas };

  const { data: updatedProfile, error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("state", JSON.stringify(state))
    .select("id")
    .maybeSingle();
  if (updErr) return jsonResponse({ error: updErr.message }, 500);
  if (!updatedProfile) return jsonResponse({ error: "O teu progresso mudou entretanto. Atualiza e tenta novamente." }, 409);

  return jsonResponse({ escolhas, meta, amount });
});
