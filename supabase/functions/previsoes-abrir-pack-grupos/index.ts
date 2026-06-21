// supabase/functions/previsoes-abrir-pack-grupos/index.ts  (NOVA)
//
// Abre o PACK DA FASE DE GRUPOS das Previsões (prev.groupReward.pack).
//
// Porquê uma função dedicada: o open-pack valida a recompensa contra
// prev.resolved.rewardPack, que só existe DEPOIS das eliminatórias. Por isso, ao
// tentar abrir o pack da fase de grupos, o open-pack devolvia
// "Não há recompensa de Previsões para reclamar." (era o bug do botão Pack Base).
//
// Esta função valida prev.groupReward.pack + prev.groupRewardClaimed e abre o pack
// com a MESMA lógica do jogo (_shared/gameData.ts → applyPackOpening), devolvendo
// as cartas para a animação no cliente.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { PACKS, applyPackOpening } from "../_shared/gameData.ts";

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

  const { data: profileRow, error: profErr } = await admin.from("profiles").select("state").eq("id", userId).single();
  if (profErr || !profileRow) return jsonResponse({ error: "Perfil não encontrado." }, 404);

  const state = (profileRow.state ?? {}) as Record<string, unknown>;
  const prev = (state.prev ?? {}) as Record<string, unknown>;
  const groupReward = (prev.groupReward ?? null) as { pack?: string | null } | null;

  if (!groupReward || !groupReward.pack) {
    return jsonResponse({ error: "Não há pack da fase de grupos para abrir." }, 400);
  }
  if (prev.groupRewardClaimed) {
    return jsonResponse({ error: "Já abriste o pack da fase de grupos." }, 400);
  }

  const pack = PACKS.find((p) => p.id === groupReward.pack) ?? PACKS[0];

  // abre o pack (sorteio + pity + atualização de coleção/meta/histórico)
  const result = applyPackOpening(state, pack);

  const newPrev = { ...prev, groupRewardClaimed: true };
  const newState = {
    ...state,
    collection: result.collection,
    meta: result.meta,
    hist: result.hist,
    prev: newPrev,
  };

  const { error: updErr } = await admin.from("profiles").update({ state: newState, updated_at: new Date().toISOString() }).eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ cardIds: result.cardIds, collection: result.collection, meta: result.meta, hist: result.hist });
});
