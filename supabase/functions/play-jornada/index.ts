// supabase/functions/play-jornada/index.ts
//
// Substitui a lógica client-side de "Simular jornada" (src/App.jsx,
// simulateJornada): confirma que o jogador tem mesmo as 3 cartas escolhidas,
// corre a simulação (com a aleatoriedade do servidor) e regista os pontos via
// register_jornada (que já impõe o limite de 10 jornadas/jogador).
//
// O cliente nunca decide os pontos — só o servidor faz os sorteios dos jogos
// e calcula o total; register_jornada confirma e grava o ranking.
//
// body: { lineup: [string, string, string], captain: 0 | 1 | 2 }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { JORNADA_CARDS, scoreLineup } from "../_shared/jornadaScore.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { lineup?: unknown; captain?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Pedido inválido (JSON em falta)." }, 400);
  }

  const lineup = body.lineup;
  const captain = body.captain;
  if (!Array.isArray(lineup) || lineup.length !== 3 || lineup.some((id) => typeof id !== "string")) {
    return jsonResponse({ error: "Equipa inválida." }, 400);
  }
  if (typeof captain !== "number" || ![0, 1, 2].includes(captain)) {
    return jsonResponse({ error: "Capitão inválido." }, 400);
  }

  const cards = (lineup as string[]).map((id) => JORNADA_CARDS.find((c) => c.id === id));
  if (cards.some((c) => !c)) return jsonResponse({ error: "Carta desconhecida na equipa." }, 400);

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
  const collection = (state.collection as Record<string, number>) ?? {};

  // confirma que o jogador tem mesmo as 3 cartas escolhidas
  for (const id of lineup as string[]) {
    if (!(collection[id] > 0)) return jsonResponse({ error: "Não tens essa carta na coleção." }, 400);
  }

  // ---- simulação (única parte aleatória) ----
  const { rows, total } = scoreLineup(cards as NonNullable<typeof cards[number]>[], captain);

  // ---- regista no ranking partilhado (impõe o limite de 10 jornadas) ----
  const { data: lb, error: rpcErr } = await userClient.rpc("register_jornada", { p_points: total });
  if (rpcErr) return jsonResponse({ error: rpcErr.message }, 400);

  // ---- atualiza "As tuas jornadas" (jHist) ----
  const jHist: unknown[] = Array.isArray(state.jHist) ? [...(state.jHist as unknown[])] : [];
  const jornadaNum = jHist.length + 1;
  const capCard = cards[captain]!;
  jHist.unshift({
    j: jornadaNum,
    t: Date.now(),
    total,
    cards: (cards as NonNullable<typeof cards[number]>[]).map((c) => c.name),
    cap: capCard.name,
    capRarity: capCard.rarity,
    hasCaster: (cards as NonNullable<typeof cards[number]>[]).some((c) => c.isCaster),
  });
  const jHistTrimmed = jHist.slice(0, 30);

  const newState = { ...state, jHist: jHistTrimmed };
  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ total, rows, jHist: jHistTrimmed, leaderboard: lb, j: jornadaNum });
});
