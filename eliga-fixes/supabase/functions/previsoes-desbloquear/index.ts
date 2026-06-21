// supabase/functions/previsoes-desbloquear/index.ts  (NOVA)
//
// Permite ao jogador REABRIR a sua previsão (já fechada/🔒) para a alterar e
// voltar a submeter — APENAS antes do prazo. Depois do prazo, recusa.
//
//   • fase "grupos": só se a previsão dos apurados estiver bloqueada (groupResult.locked)
//     e ainda não revelada pelo admin. Limpa o lock e mantém os 8 apurados escolhidos.
//   • fase "elim":   só se a previsão das eliminatórias estiver bloqueada (bracketLocked)
//     e ainda não validada. Limpa o lock e mantém qf/sf/fin.
//
// body: { fase: "grupos" | "elim" }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { fase?: unknown };
  try { body = await req.json(); } catch { return jsonResponse({ error: "Pedido inválido." }, 400); }
  const fase = body.fase;
  if (fase !== "grupos" && fase !== "elim") return jsonResponse({ error: "fase inválida." }, 400);

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
  const prev = (state.prev ?? {}) as Record<string, unknown>;
  const config = (configRes.data?.data ?? {}) as { modo?: string; prazoGrupos?: string | null; prazoElim?: string | null };

  if (config.modo !== "real") return jsonResponse({ error: "Só disponível em modo real." }, 400);
  if (prev.resolved) return jsonResponse({ error: "Esta previsão já foi avaliada." }, 400);

  if (fase === "grupos") {
    if (config.prazoGrupos) {
      const p = new Date(config.prazoGrupos).getTime();
      if (!isNaN(p) && Date.now() > p) return jsonResponse({ error: "O prazo da previsão dos apurados já terminou." }, 400);
    }
    const gr = (prev.groupResult ?? null) as Record<string, unknown> | null;
    if (!gr || gr.locked !== true) return jsonResponse({ error: "Não há previsão de apurados bloqueada para alterar." }, 400);
    const newPrev = { ...prev, groupResult: null }; // mantém prev.qual
    const { error } = await admin.from("profiles").update({ state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ prev: newPrev });
  } else {
    if (config.prazoElim) {
      const p = new Date(config.prazoElim).getTime();
      if (!isNaN(p) && Date.now() > p) return jsonResponse({ error: "O prazo da previsão das eliminatórias já terminou." }, 400);
    }
    if (prev.bracketLocked !== true) return jsonResponse({ error: "Não há previsão de eliminatórias bloqueada para alterar." }, 400);
    const newPrev = { ...prev, bracketLocked: false }; // mantém qf/sf/fin
    const { error } = await admin.from("profiles").update({ state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ prev: newPrev });
  }
});
