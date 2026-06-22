// supabase/functions/submeter-jornada/index.ts  (NOVA)
// Jogador SUBMETE a equipa (3 cartas + capitão). Não calcula pontos. Lock por prazo.
// body: { lineup:[id,id,id], captain:0|1|2 }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { JORNADA_CARDS } from "../_shared/jornadaScore.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { lineup?: unknown; captain?: unknown };
  try { body = await req.json(); } catch { return jsonResponse({ error: "Pedido inválido." }, 400); }
  const lineup = body.lineup, captain = body.captain;
  if (!Array.isArray(lineup) || lineup.length !== 3 || lineup.some((id) => typeof id !== "string")) return jsonResponse({ error: "Equipa inválida." }, 400);
  if (typeof captain !== "number" || ![0, 1, 2].includes(captain)) return jsonResponse({ error: "Capitão inválido." }, 400);
  if ((lineup as string[]).map((id) => JORNADA_CARDS.find((c) => c.id === id)).some((c) => !c)) return jsonResponse({ error: "Carta desconhecida." }, 400);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const [profileRes, configRes] = await Promise.all([
    admin.from("profiles").select("state").eq("id", userId).single(),
    admin.from("liga_data").select("data").eq("key", "config").single(),
  ]);
  if (profileRes.error || !profileRes.data) return jsonResponse({ error: "Perfil não encontrado." }, 404);

  const state = (profileRes.data.state ?? {}) as Record<string, unknown>;
  const collection = (state.collection as Record<string, number>) ?? {};
  for (const id of lineup as string[]) if (!(collection[id] > 0)) return jsonResponse({ error: "Não tens essa carta na coleção." }, 400);

  const config = (configRes.data?.data ?? { modo: "simulacao", etapa: 1, fase: "grupos", grupo: "A" }) as {
    modo: string; etapa: number | string; fase: string; grupo?: string; prazoCompGrupos?: string | null; prazoCompElim?: string | null;
  };

  if (config.modo === "real") {
    const prazoIso = config.fase === "grupos" ? config.prazoCompGrupos : config.prazoCompElim;
    if (prazoIso) { const p = new Date(prazoIso).getTime(); if (!isNaN(p) && Date.now() > p) return jsonResponse({ error: "O prazo para submeter a equipa desta fase já terminou." }, 400); }
  }

  const jHist = Array.isArray(state.jHist) ? state.jHist as Record<string, unknown>[] : [];
  const jaAvaliou = config.modo === "real" && jHist.some((j) =>
    String(j.etapa) === String(config.etapa) &&
    (config.fase === "grupos" ? (j.grupo || "A") === (config.grupo || "A") && j.fase === "grupos" : j.fase === "eliminatorias") && j.modo !== "simulacao_fallback");
  if (jaAvaliou) return jsonResponse({ error: "Esta fase já foi avaliada — não podes submeter outra vez." }, 400);

  const compSubmit = { etapa: config.etapa, fase: config.fase, grupo: config.fase === "grupos" ? (config.grupo || "A") : null, lineup, captain, t: Date.now() };
  const { error: updErr } = await admin.from("profiles").update({ state: { ...state, compSubmit }, updated_at: new Date().toISOString() }).eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);
  return jsonResponse({ ok: true, compSubmit });
});
