// supabase/functions/open-pack/index.ts
//
// Substitui a lógica client-side de "abrir pack" (src/App.jsx, openPack):
// sorteia as cartas (com garantia/pity), atualiza a coleção, meta e
// histórico do utilizador autenticado, e devolve o resultado.
//
// O jogador nunca decide o resultado — só o servidor sabe as probabilidades
// e só o servidor escreve em profiles.state (via service_role).
//
// Toda a abertura de pack (incluindo admin) tem de ter pelo menos um destes
// marcadores — não há "aberturas grátis":
//   - claim:      { id, periodo } — recompensa de objetivo, validada no
//                  servidor (prog >= alvo, período certo, ainda não
//                  reclamado, e que este pack é mesmo a recompensa desse
//                  objetivo) — ver _shared/objectives.ts
//   - prevReward: true            — recompensa das Previsões
//   - trivia:     { day, pick, ok } — recompensa da Pergunta do dia (uma vez por dia)
//   - spendTwitchPoints: true     — debita pack.twitchCost de twitch_points (Fase 5.3)
//
// (O "Pack Admin" — ferramenta de testes que dá 1 de cada carta — não passa
// por esta função; continua só client-side para a conta admin.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { PACKS, applyPackOpening, todayStr, type CardRef, type PackDef } from "../_shared/gameData.ts";
import { validateObjectiveClaim } from "../_shared/objectives.ts";
import { configuredCardPool, publishedCardBatches } from "../_shared/configuredCardPool.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: {
    packId?: string;
    claim?: { id?: string; periodo?: string };
    prevReward?: boolean;
    trivia?: { day?: string; pick?: number; ok?: boolean };
    spendTwitchPoints?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Pedido inválido (JSON em falta)." }, 400);
  }

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
  const { data: configRow } = await admin.from("liga_data").select("data").eq("key", "config").single();
  const config = (configRow?.data ?? {}) as Record<string, unknown>;
  const cardPool = configuredCardPool(config);

  let pack = PACKS.find((item) => item.id === body.packId);
  let customPool: CardRef[] | undefined;
  if (body.packId?.startsWith("custom:")) {
    const publishedBatches = publishedCardBatches(config);
    const requestedBatchId = body.packId.slice("custom:".length);
    const published = publishedBatches.find((batch) => batch.id === requestedBatchId);
    const cards = published?.cards || [];
    if (published && cards.length) {
      pack = { id: body.packId, name: published.name, locked: false, specialBoost: 0, twitchCost: 150 } as PackDef;
      customPool = cards;
    }
  }
  if (!pack) return jsonResponse({ error: "Pack desconhecido." }, 400);
  if (pack.locked || (!customPool && (pack.id === "etapa1" || pack.id.startsWith("custom:")))) return jsonResponse({ error: "Este pack ainda não está disponível." }, 400);

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("state")
    .eq("id", userId)
    .single();
  if (profErr || !profile) return jsonResponse({ error: "Perfil não encontrado." }, 404);

  const state = (profile.state ?? {}) as Record<string, unknown>;
  const prevMeta = (state.meta as Record<string, unknown>) ?? {};
  const collectionBefore = (state.collection as Record<string, number>) ?? {};

  // valida a recompensa de objetivo (se aplicável): recalcula prog/alvo no
  // servidor e confirma que este "pack" é mesmo a recompensa desse objetivo
  let claimPatch: { id: string; periodo: string } | null = null;
  if (body.claim) {
    const result = validateObjectiveClaim(body.claim.id, body.claim.periodo, prevMeta, collectionBefore, cardPool);
    if (result.ok === false) return jsonResponse({ error: result.error }, 400);
    if (result.reward !== pack.id) {
      return jsonResponse({ error: "Este objetivo dá um pack diferente." }, 400);
    }
    claimPatch = { id: body.claim.id as string, periodo: body.claim.periodo as string };
  }

  // valida a recompensa de Previsões (se aplicável): confirma que há um
  // resultado resolvido, com recompensa, ainda não reclamada, e que é mesmo
  // este pack
  let prevRewardPatch = false;
  if (body.prevReward) {
    const prevState = (state.prev as Record<string, unknown>) ?? {};
    const resolved = prevState.resolved as { rewardPack?: string | null } | null;
    if (!resolved || !resolved.rewardPack) return jsonResponse({ error: "Não há recompensa de Previsões para reclamar." }, 400);
    if (prevState.rewardClaimed) return jsonResponse({ error: "Recompensa de Previsões já reclamada." }, 400);
    if (resolved.rewardPack !== pack.id) return jsonResponse({ error: "Este não é o pack da recompensa de Previsões." }, 400);
    prevRewardPatch = true;
  }

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

  // gastar pontos Twitch (débito atómico, falha se o saldo for insuficiente)
  let newTwitchPoints: number | undefined;
  let spentPoints = false;
  if (body.spendTwitchPoints) {
    if (!pack.twitchCost) return jsonResponse({ error: "Este pack não pode ser aberto com pontos Twitch." }, 400);
    const { data: pts, error: debitErr } = await userClient.rpc("debit_twitch_points", { p_amount: pack.twitchCost });
    if (debitErr) {
      const msg = debitErr.message?.includes("PONTOS_INSUFICIENTES")
        ? "Não tens pontos Twitch suficientes para abrir este pack."
        : debitErr.message || "Não foi possível debitar os pontos Twitch.";
      return jsonResponse({ error: msg }, 400);
    }
    newTwitchPoints = pts as number;
    spentPoints = true;
  }

  const earned = !!claimPatch || prevRewardPatch || !!triviaPatch || spentPoints;
  if (!earned) {
    return jsonResponse({ error: "As aberturas grátis estão temporariamente desativadas. Liga a tua conta Twitch para trocar pontos por packs." }, 403);
  }

  const { collection, meta, hist, cardIds } = applyPackOpening(state, pack, customPool);

  // marca o objetivo como reclamado (já validado acima), na mesma escrita
  // — evita a corrida entre o "claim" local e este pedido
  if (claimPatch) {
    const claims = { ...((prevMeta.claims as Record<string, string>) ?? {}) };
    claims[claimPatch.id] = claimPatch.periodo;
    meta.claims = claims;
  }

  // regista a resposta da Trivia (mesma escrita — evita a mesma classe de corrida)
  if (triviaPatch) {
    const prevTrivia = (prevMeta.trivia as Record<string, unknown>) ?? {};
    meta.trivia = { ...prevTrivia, [triviaPatch.day]: { pick: triviaPatch.pick, ok: triviaPatch.ok } };
  }

  const newState: Record<string, unknown> = { ...state, collection, meta, hist };
  if (prevRewardPatch) {
    newState.prev = { ...((state.prev as Record<string, unknown>) ?? {}), rewardClaimed: true };
  }

  const { data: updatedProfile, error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("state", JSON.stringify(state))
    .select("id")
    .maybeSingle();
  if (updErr || !updatedProfile) {
    // a escrita do pack falhou depois de já termos debitado pontos — repõe
    // os pontos de forma aditiva para não sobrescrever movimentos concorrentes
    if (spentPoints && pack.twitchCost && newTwitchPoints !== undefined) {
      const { error: refundErr } = await admin.rpc("refund_twitch_points", { p_user_id: userId, p_amount: pack.twitchCost });
      if (refundErr) return jsonResponse({ error: "O pack não foi entregue e não foi possível devolver os pontos automaticamente. Contacta o suporte." }, 500);
    }
    if (updErr) return jsonResponse({ error: updErr.message }, 500);
    return jsonResponse({ error: "O teu progresso mudou entretanto. Os pontos foram devolvidos; tenta novamente." }, 409);
  }

  return jsonResponse({ cardIds, collection, meta, hist, twitchPoints: newTwitchPoints });
});
