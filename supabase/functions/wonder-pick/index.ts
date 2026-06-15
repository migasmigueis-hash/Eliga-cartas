// supabase/functions/wonder-pick/index.ts
//
// Substitui a lógica client-side de "Escolhas / Wonder Pick" (src/App.jsx,
// wonderPick): o servidor recalcula o tabuleiro do slot atual (6h), confirma
// que a carta pedida pertence mesmo a esse tabuleiro, que o jogador tem
// Escolhas suficientes e que ainda não usou esta Escolha — e só depois
// entrega a carta.
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

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("state")
    .eq("id", userId)
    .single();
  if (profErr || !profile) return jsonResponse({ error: "Perfil não encontrado." }, 404);

  const state = (profile.state ?? {}) as Record<string, unknown>;
  const escolhas = (state.escolhas as number) || 0;
  if (escolhas < cost) return jsonResponse({ error: "Não tens Escolhas suficientes." }, 400);

  const picksUsed = { ...((state.picksUsed as Record<string, boolean>) ?? {}) };
  if (picksUsed[key]) return jsonResponse({ error: "Já usaste esta Escolha." }, 400);
  picksUsed[key] = true;

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

  const newEscolhas = escolhas - cost;
  const newState = { ...state, escolhas: newEscolhas, picksUsed, collection, meta, hist: histTrimmed };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ escolhas: newEscolhas, picksUsed, collection, meta, hist: histTrimmed, cardId });
});
