// supabase/functions/previsoes-simular-grupos/index.ts v4
//
// MOMENTO 1 do jogador: "Fechar previsão dos apurados".
// Modo simulacao: simula via RNG e revela qualHits + bracket.
// Modo real: bloqueia (🔒) sem revelar. Respeita prazoGrupos.
//
// body: { qual: string[] } — 8 ids, máx. 3 por grupo

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
  const config = (configRes.data?.data ?? { modo: "simulacao", etapa: 1 }) as { modo: string; etapa: number | string; prazoGrupos?: string | null };

  // prazo da fase de grupos (só em modo real)
  if (config.modo === "real" && config.prazoGrupos) {
    const prazo = new Date(config.prazoGrupos).getTime();
    if (!isNaN(prazo) && Date.now() > prazo) {
      return jsonResponse({ error: "O prazo para fechar a previsão dos apurados já terminou." }, 400);
    }
  }

  const groups = prev.groups;
  if (!Array.isArray(groups) || groups.length !== 3 || groups.some((g) => !Array.isArray(g) || g.length !== 6)) {
    return jsonResponse({ error: "Sorteia os grupos primeiro." }, 400);
  }
  if (prev.groupResult) return jsonResponse({ error: "Já fechaste a previsão dos apurados." }, 400);

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

  let newPrev: Record<string, unknown>;

  if (config.modo === "real") {
    newPrev = {
      ...prev, qual,
      groupResult: { locked: true, realQual: null, qualHits: null },
      bracket: null,
      qf: [null, null, null, null], sf: [null, null], fin: null,
      resolved: null, bracketLocked: false, rewardClaimed: false,
    };
  } else {
    const r = simulateGroups(groups as string[][]);
    const qualHits = (qual as string[]).filter((id) => r.realQual.includes(id)).length;
    newPrev = {
      ...prev, qual,
      groupResult: { realQual: r.realQual, qualHits },
      bracket: r.bracket,
      qf: [null, null, null, null], sf: [null, null], fin: null,
      resolved: null, bracketLocked: false, rewardClaimed: false,
    };
  }

  const { error: updErr } = await admin.from("profiles").update({ state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() }).eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ prev: newPrev, modo: config.modo });
});
