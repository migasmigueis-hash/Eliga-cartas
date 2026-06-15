// supabase/functions/wonder-pick/index.ts
//
// Substitui a lógica client-side de "Escolhas / Wonder Pick" (src/App.jsx,
// wonderPick): o servidor recalcula o tabuleiro do slot atual (6h), confirma
// que a carta pedida pertence mesmo a esse tabuleiro, e só depois entrega a
// carta.
//
// O débito de Escolhas + marcação do tabuleiro como usado é feito de forma
// ATÓMICA pela função SQL apply_wonder_pick (UPDATE ... WHERE ... RETURNING
// numa única instrução) — impede que vários pedidos quase simultâneos gastem
// mais Escolhas do que o jogador tem.
//
// body: { key: string, cardId: string }
//   key = "<pickSlot>-0" | "<pickSlot>-1" | "<pickSlot>-2" | "<pickSlot>-p"
//   (igual ao formato usado no cliente, mas o servidor recalcula <pickSlot>
//   a partir da sua própria hora — ignora qualquer "picksBump" local)

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { PICK_SLOT_MS, buildPickBoard, todayStr } from "../_shared/gameData.ts";
import type { CardRef } from "../_shared/cardpool.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { key?: string; cardId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Pedido inválido (JSON em falta)." }, 400);
  }

  const key = body.key;
  const cardId = body.cardId;
  if (typeof key !== "string" || typeof cardId !== "string") {
    return jsonResponse({ error: "Pedido inválido." }, 400);
  }

  // recalcula o tabuleiro do slot atual (6h) — o servidor é quem decide qual é
  const pickSlotNow = Math.floor(Date.now() / PICK_SLOT_MS);
  const base = String(pickSlotNow);

  let board: CardRef[] | null = null;
  let cost = 1;
  if (key === base + "-0") board = buildPickBoard(pickSlotNow);
  else if (key === base + "-1") board = buildPickBoard(pickSlotNow + 7919);
  else if (key === base + "-2") board = buildPickBoard(pickSlotNow + 2 * 7919);
  else if (key === base + "-p") { board = buildPickBoard(pickSlotNow + 777777, true); cost = 3; }

  if (!board) return jsonResponse({ error: "Tabuleiro desatualizado. Atualiza a página e tenta de novo." }, 400);
  if (!board.some((c) => c.id === cardId)) return jsonResponse({ error: "Carta inválida para este tabuleiro." }, 400);

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

  // ---- passo atómico: debita Escolhas + marca o tabuleiro como usado ----
  // (corre como o próprio utilizador, security definer — impede corridas)
  const { data: stateAfterReserve, error: reserveErr } = await userClient.rpc("apply_wonder_pick", { p_key: key, p_cost: cost });
  if (reserveErr) {
    const msg = reserveErr.message?.includes("WONDER_PICK_REJEITADO")
      ? "Não tens Escolhas suficientes, ou esta Escolha já foi usada."
      : reserveErr.message || "Não foi possível usar esta Escolha.";
    return jsonResponse({ error: msg }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ---- aplica a carta/coleção/histórico a partir do estado já atualizado ----
  const state = (stateAfterReserve ?? {}) as Record<string, unknown>;
  const collection = { ...((state.collection as Record<string, number>) ?? {}) };
  collection[cardId] = (collection[cardId] || 0) + 1;

  const prevMeta = (state.meta as Record<string, unknown>) ?? {};
  const meta: Record<string, unknown> = { ...prevMeta, escUso: { ...((prevMeta.escUso as Record<string, number>) ?? {}) } };
  const today = todayStr();
  const escUso = meta.escUso as Record<string, number>;
  escUso[today] = (escUso[today] || 0) + 1;

  const hist: unknown[] = Array.isArray(state.hist) ? [...(state.hist as unknown[])] : [];
  hist.unshift({ t: Date.now(), pack: "Escolha 🎯", ids: [cardId] });
  const histTrimmed = hist.slice(0, 50);

  const newState = { ...state, collection, meta, hist: histTrimmed };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({
    escolhas: state.escolhas as number,
    picksUsed: state.picksUsed,
    collection,
    meta,
    hist: histTrimmed,
    cardId,
  });
});
