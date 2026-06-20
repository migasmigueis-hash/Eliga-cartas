// supabase/functions/previsoes-revelar-grupos/index.ts  (NOVA)
//
// MOMENTO de admin #1 ("Avaliar" depois de terminada a fase de grupos).
//
// O que faz, para TODOS os utilizadores que fecharam a previsão dos apurados
// (groupResult.locked === true):
//   1. Lê o bracket REAL das eliminatórias da etapa (as 8 equipas que passaram),
//      a partir de liga_data: etapaN_qf (ou etapaN_bracket como fallback).
//   2. Pontua os apurados de cada jogador: qualHits = |qual ∩ 8 reais|.
//   3. Revela: groupResult = { realQual:[8], qualHits } (deixa de estar locked)
//      e popula prev.bracket com as 8 equipas na ordem dos confrontos QF reais.
//   4. Limpa qf/sf/fin para o jogador poder agora prever a eliminatória.
//
// NÃO calcula vencedores nem score final aqui — isso é o "Avaliar #2"
// (previsoes-validar-todos), depois de a eliminatória ser jogada.
//
// Pré-requisito do admin: ter avançado a fase para "eliminatorias" e inserido o
// bracket real em etapaN_qf.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

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

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: adminProfile } = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!adminProfile?.is_admin) return jsonResponse({ error: "Sem permissão." }, 403);

  const { data: configRow } = await admin.from("liga_data").select("data").eq("key", "config").single();
  const config = (configRow?.data ?? { etapa: 1 }) as { etapa: number | string };
  if (config.etapa === "finals") {
    return jsonResponse({ error: "As Finals não têm fase de grupos para revelar." }, 400);
  }
  const etapaKey = `etapa${config.etapa}`;

  // bracket real: 8 equipas na ordem dos confrontos QF
  let bracket: string[] = [];
  for (const key of [`${etapaKey}_qf`, `${etapaKey}_bracket`]) {
    const { data: row } = await admin.from("liga_data").select("data").eq("key", key).maybeSingle();
    const jogos = (row?.data ?? []) as { teamA: string; teamB: string }[];
    if (Array.isArray(jogos) && jogos.length >= 4) {
      bracket = jogos.slice(0, 4).flatMap((m) => [m.teamA, m.teamB]);
      break;
    }
  }
  if (bracket.length !== 8) {
    return jsonResponse({ error: `Bracket das eliminatórias incompleto para a Etapa ${config.etapa}. Insere os 4 confrontos QF em ${etapaKey}_qf primeiro.` }, 400);
  }
  const realQual = [...new Set(bracket)];

  const { data: profiles } = await admin.from("profiles").select("id, state");
  let revealed = 0, skipped = 0;

  for (const profile of profiles ?? []) {
    const state = (profile.state ?? {}) as Record<string, unknown>;
    const prev = (state.prev ?? {}) as Record<string, unknown>;
    const gr = (prev.groupResult ?? null) as Record<string, unknown> | null;

    // só revelar quem fechou os apurados e ainda está locked
    if (!gr || gr.locked !== true || !Array.isArray(prev.qual) || (prev.qual as unknown[]).length !== 8) {
      skipped++; continue;
    }

    const qualArr = prev.qual as string[];
    const qualHits = qualArr.filter((id) => realQual.includes(id)).length;

    const newPrev = {
      ...prev,
      groupResult: { realQual, qualHits },
      bracket,
      qf: [null, null, null, null], sf: [null, null], fin: null,
      resolved: null, bracketLocked: false, rewardClaimed: false,
    };
    await admin.from("profiles").update({ state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() }).eq("id", profile.id);
    revealed++;
  }

  return jsonResponse({ ok: true, revealed, skipped, realQual });
});
