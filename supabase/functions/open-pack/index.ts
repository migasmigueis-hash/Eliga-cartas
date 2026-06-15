// supabase/functions/open-pack/index.ts
//
// Substitui a lógica client-side de "abrir pack" (src/App.jsx, openPack):
// sorteia as cartas (com garantia/pity), atualiza a coleção, meta e
// histórico do utilizador autenticado, e devolve o resultado.
//
// O jogador nunca decide o resultado — só o servidor sabe as probabilidades
// e só o servidor escreve em profiles.state (via service_role).
//
// "Aberturas grátis" (sem nenhum dos marcadores abaixo) ficam reservadas à
// conta admin enquanto não houver troca de pontos da Twitch por packs.
// Continuam disponíveis para todos os jogadores:
//   - claim:      { id, periodo } — recompensa de objetivo (3b.3)
//   - prevReward: true            — recompensa das Previsões
//   - trivia:     { day, pick, ok } — recompensa da Pergunta do dia (uma vez por dia)

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { PACKS, applyPackOpening, todayStr } from "../_shared/gameData.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: {
    packId?: string;
    claim?: { id?: string; periodo?: string };
    prevReward?: boolean;
    trivia?: { day?: string; pick?: number; ok?: boolean };
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Pedido inválido (JSON em falta)." }, 400);
  }

  const pack = PACKS.find((p) => p.id === body.packId);
  if (!pack) return jsonResponse({ error: "Pack desconhecido." }, 400);
  if (pack.locked) return jsonResponse({ error: "Este pack ainda não está disponível." }, 400);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // identifica o utilizador a partir do token de sessão (enviado automaticamente
  // pelo supabase-js em supabase.functions.invoke)
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);
  const userId = userData.user.id;

  // cliente com privilégios de serviço — lê/escreve o progresso, ignorando RLS
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("state, is_admin")
    .eq("id", userId)
    .single();
  if (profErr || !profile) return jsonResponse({ error: "Perfil não encontrado." }, 404);

  const state = (profile.state ?? {}) as Record<string, unknown>;
  const prevMeta = (state.meta as Record<string, unknown>) ?? {};

  // valida a recompensa da Trivia (no máximo uma vez por dia, e só para "hoje")
  let triviaPatch: { day: string; pick: number; ok: boolean } | null = null;
  const trivia = body.trivia;
  if (
    trivia && typeof trivia.day === "string" && trivia.day === todayStr() &&
    typeof trivia.pick === "number" && typeof trivia.ok === "boolean"
  ) {
    const prevTrivia = (prevMeta.trivia as Record<string, unknown>) ?? {};
    if (!prevTrivia[trivia.day]) triviaPatch = { day: trivia.day, pick: trivia.pick, ok: trivia.ok };
  }

  const earned = !!body.claim || !!body.prevReward || !!triviaPatch;
  if (!earned && !profile.is_admin) {
    return jsonResponse({ error: "As aberturas grátis estão temporariamente desativadas. Em breve vais poder trocar pontos da Twitch por packs." }, 403);
  }

  const { collection, meta, hist, cardIds } = applyPackOpening(state, pack);

  // marca o objetivo como reclamado (se aplicável), na mesma escrita
  // — evita a corrida entre o "claim" local e este pedido
  const claim = body.claim;
  if (claim && typeof claim.id === "string" && typeof claim.periodo === "string" && claim.id.length <= 40 && claim.periodo.length <= 20) {
    const claims = { ...((prevMeta.claims as Record<string, string>) ?? {}) };
    claims[claim.id] = claim.periodo;
    meta.claims = claims;
  }

  // regista a resposta da Trivia (mesma escrita — evita a mesma classe de corrida)
  if (triviaPatch) {
    const prevTrivia = (prevMeta.trivia as Record<string, unknown>) ?? {};
    meta.trivia = { ...prevTrivia, [triviaPatch.day]: { pick: triviaPatch.pick, ok: triviaPatch.ok } };
  }

  const newState = { ...state, collection, meta, hist };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ cardIds, collection, meta, hist });
});
