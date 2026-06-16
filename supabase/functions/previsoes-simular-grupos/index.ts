// supabase/functions/previsoes-simular-grupos/index.ts
//
// Modo simulacao: simula os resultados da fase de grupos via RNG.
// Modo real: lê os apurados reais de liga_data (etapa1_grupos_resultado).
//            Se não disponível, simula com fallback.
//
// body: { qual: string[] } — 8 ids de equipas, máx. 3 por grupo

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { EMPTY_PREV, simulateGroups } from "../_shared/previsoesEngine.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { qual?: unknown };
  try { body = await req.json(); } catch { return jsonResponse({ error: "Pedido inválido (JSON em falta)." }, 400); }

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
  const prev = { ...EMPTY_PREV, ...((state.prev as Record<string, unknown>) ?? {}) };
  const config = (configRes.data?.data ?? { modo: "simulacao", etapa: 1 }) as { modo: string; etapa: number | string };

  const groups = prev.groups;
  if (!Array.isArray(groups) || groups.length !== 3 || groups.some((g) => !Array.isArray(g) || g.length !== 6)) {
    return jsonResponse({ error: "Sorteia os grupos primeiro." }, 400);
  }
  if (prev.groupResult) return jsonResponse({ error: "Já simulaste a fase de grupos desta previsão." }, 400);

  const qual = body.qual;
  if (!Array.isArray(qual) || qual.length !== 8 || qual.some((id) => typeof id !== "string") || new Set(qual).size !== 8) {
    return jsonResponse({ error: "Escolhe exatamente 8 apurados diferentes." }, 400);
  }
  const flat = (groups as string[][]).flat();
  if (!(qual as string[]).every((id) => flat.includes(id))) {
    return jsonResponse({ error: "Apurado inválido para estes grupos." }, 400);
  }
  for (const g of groups as string[][]) {
    if ((qual as string[]).filter((id) => g.includes(id)).length > 3) {
      return jsonResponse({ error: "Máximo de 3 apurados por grupo." }, 400);
    }
  }

  let realQual: string[];
  let bracket: string[];
  let modoUsado = config.modo;

  if (config.modo === "real") {
    const etapaKey = config.etapa === "finals" ? "finals" : `etapa${config.etapa}`;
    const { data: resultRow } = await admin.from("liga_data").select("data").eq("key", `${etapaKey}_grupos_resultado`).single();
    const resultData = resultRow?.data as { realQual: string[]; bracket: string[] } | null;
    if (resultData?.realQual?.length === 8) {
      realQual = resultData.realQual;
      bracket = resultData.bracket?.length === 8 ? resultData.bracket : [...realQual].sort(() => Math.random() - 0.5);
    } else {
      modoUsado = "simulacao_fallback";
      const r = simulateGroups(groups as string[][]);
      realQual = r.realQual;
      bracket = r.bracket;
    }
  } else {
    const r = simulateGroups(groups as string[][]);
    realQual = r.realQual;
    bracket = r.bracket;
  }

  const qualHits = (qual as string[]).filter((id) => realQual.includes(id)).length;
  const newPrev = {
    ...prev, qual,
    groupResult: { realQual, qualHits },
    bracket,
    qf: [null, null, null, null], sf: [null, null], fin: null,
    resolved: null, rewardClaimed: false,
  };

  const { error: updErr } = await admin.from("profiles").update({ state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() }).eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ prev: newPrev, modo: modoUsado });
});
