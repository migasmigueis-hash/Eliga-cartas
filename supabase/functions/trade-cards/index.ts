// supabase/functions/trade-cards/index.ts
//
// Substitui a lógica client-side de "Trocas" (src/App.jsx, confirmTrade e
// directTradeGo): confirma que o utilizador tem mesmo os duplicados,
// consome-os, e dá a carta nova — tudo no servidor.
//
// body:
//   { mode: "rand",   rarity: "comum"|"rara"|"epica" }
//   { mode: "direct", rarity: "comum"|"rara"|"epica", targetId: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import {
  CARD_POOL,
  RARITY_UP,
  RARITY_LABEL,
  TRADE_COST,
  TRADE_DIRECT,
  duplicatesOf,
  pickDuplicates,
  randomOfRarity,
  todayStr,
} from "../_shared/gameData.ts";
import type { Rarity } from "../_shared/cardpool.ts";

const TRADABLE: Rarity[] = ["comum", "rara", "epica"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { mode?: string; rarity?: string; targetId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Pedido inválido (JSON em falta)." }, 400);
  }

  const rarity = body.rarity as Rarity;
  if (!TRADABLE.includes(rarity)) return jsonResponse({ error: "Raridade inválida para troca." }, 400);
  if (body.mode !== "rand" && body.mode !== "direct") return jsonResponse({ error: "Tipo de troca inválido." }, 400);

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
  const collection: Record<string, number> = { ...((state.collection as Record<string, number>) ?? {}) };
  const prevMeta = (state.meta as Record<string, unknown>) ?? {};
  const meta: Record<string, unknown> = { ...prevMeta, trocas: { ...((prevMeta.trocas as Record<string, number>) ?? {}) } };
  const hist: unknown[] = Array.isArray(state.hist) ? [...(state.hist as unknown[])] : [];

  let rewardId: string;

  if (body.mode === "rand") {
    if (duplicatesOf(rarity, collection) < TRADE_COST) {
      return jsonResponse({ error: "Não tens duplicados suficientes para esta troca." }, 400);
    }
    const picks = pickDuplicates(rarity, collection, TRADE_COST);
    Object.entries(picks).forEach(([id, n]) => {
      collection[id] = Math.max(1, (collection[id] || 0) - n);
    });
    const reward = randomOfRarity(RARITY_UP[rarity], Math.random() < 0.5);
    rewardId = reward.id;
    collection[rewardId] = (collection[rewardId] || 0) + 1;
    hist.unshift({
      t: Date.now(),
      pack: `Troca (${RARITY_LABEL[rarity]} → ${RARITY_LABEL[RARITY_UP[rarity]]})`,
      ids: [rewardId],
    });
  } else {
    const targetId = body.targetId;
    const target = CARD_POOL.find((c) => c.id === targetId);
    if (!target || target.rarity !== RARITY_UP[rarity]) {
      return jsonResponse({ error: "Carta de destino inválida." }, 400);
    }
    if (duplicatesOf(rarity, collection) < TRADE_DIRECT) {
      return jsonResponse({ error: "Não tens duplicados suficientes para esta troca." }, 400);
    }
    let need = TRADE_DIRECT;
    for (const c of CARD_POOL.filter((x) => x.rarity === rarity)) {
      if (need <= 0) break;
      const spare = (collection[c.id] || 0) - 1;
      if (spare > 0) {
        const take = Math.min(spare, need);
        collection[c.id] -= take;
        need -= take;
      }
    }
    if (need > 0) return jsonResponse({ error: "Não tens duplicados suficientes para esta troca." }, 400);
    rewardId = target.id;
    collection[rewardId] = (collection[rewardId] || 0) + 1;
    hist.unshift({
      t: Date.now(),
      pack: `Troca à escolha (${TRADE_DIRECT}× ${RARITY_LABEL[rarity]})`,
      ids: [rewardId],
    });
  }

  const today = todayStr();
  const trocas = meta.trocas as Record<string, number>;
  trocas[today] = (trocas[today] || 0) + 1;
  const histTrimmed = hist.slice(0, 50);

  const newState = { ...state, collection, meta, hist: histTrimmed };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ cardId: rewardId, collection, meta, hist: histTrimmed });
});
