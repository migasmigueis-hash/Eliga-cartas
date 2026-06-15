// supabase/functions/redeem-code/index.ts
//
// Substitui a lógica client-side de "Resgatar código" (src/App.jsx, redeemCode):
// confirma no servidor que o código existe e que esta conta ainda não o usou
// (state.codesUsed), e aplica a recompensa (Escolhas ou um pack).
//
// body: { code: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { PACKS, REDEEM_CODES, applyPackOpening } from "../_shared/gameData.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Pedido inválido (JSON em falta)." }, 400);
  }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) return jsonResponse({ error: "Código em falta." }, 400);

  const entry = REDEEM_CODES[code];
  if (!entry) return jsonResponse({ error: "Código inválido." }, 400);

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
  const codesUsed: string[] = Array.isArray(state.codesUsed) ? [...(state.codesUsed as string[])] : [];
  if (codesUsed.includes(code)) return jsonResponse({ error: "Esse código já foi usado nesta conta." }, 400);
  codesUsed.push(code);

  let newState: Record<string, unknown>;
  let responseBody: Record<string, unknown>;

  if (entry.escolhas) {
    const escolhas = ((state.escolhas as number) || 0) + entry.escolhas;
    newState = { ...state, codesUsed, escolhas };
    responseBody = { type: "escolhas", amount: entry.escolhas, escolhas, codesUsed };
  } else {
    const pack = PACKS.find((p) => p.id === entry.pack);
    if (!pack) return jsonResponse({ error: "Recompensa inválida (pack desconhecido)." }, 500);
    const { collection, meta, hist, cardIds } = applyPackOpening(state, pack);
    newState = { ...state, collection, meta, hist, codesUsed };
    responseBody = { type: "pack", cardIds, collection, meta, hist, codesUsed };
  }

  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse(responseBody);
});
