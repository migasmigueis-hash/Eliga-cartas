// supabase/functions/previsoes-resolver/index.ts v3
//
// MOMENTO 2 do jogador: "Fechar previsão das eliminatórias" (bracket).
//
// Modo simulacao: resolve a bracket via RNG e revela logo a pontuação.
//
// Modo real: NÃO resolve nem revela resultados. Valida a consistência das
//            escolhas com a bracket, guarda qf/sf/fin e BLOQUEIA
//            (prev.bracketLocked = true, prev.resolved = null). As escolhas ficam
//            fixas. A pontuação é feita pelo admin (Avaliar #2 =
//            previsoes-validar-todos) depois de a eliminatória ser jogada.
//
// FIX v3 (Bug 4 — "fechar bracket revela resultados"):
//   - em modo real deixámos de ler etapaN_qf/sf/final e de calcular score aqui.
//     O cliente mostra "🔒 Previsão fechada — aguarda validação do admin" quando
//     prev.bracketLocked === true && !prev.resolved.
//
// body: { qf: string[4], sf: string[2], fin: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { EMPTY_PREV, resolveBracket, scoreToRewardPack } from "../_shared/previsoesEngine.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: { qf?: unknown; sf?: unknown; fin?: unknown };
  try { body = await req.json(); }
  catch { return jsonResponse({ error: "Pedido inválido (JSON em falta)." }, 400); }

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

  const bracket = prev.bracket;
  const groupResult = prev.groupResult as Record<string, unknown> | null;
  if (!Array.isArray(bracket) || bracket.length !== 8 || !groupResult) {
    return jsonResponse({ error: "Fecha a previsão dos apurados primeiro." }, 400);
  }
  if (prev.resolved) return jsonResponse({ error: "Já resolveste esta previsão." }, 400);
  if ((prev as Record<string, unknown>).bracketLocked) return jsonResponse({ error: "Previsão já fechada — aguarda a validação do admin." }, 400);

  const qf = body.qf, sf = body.sf, fin = body.fin;
  if (!Array.isArray(qf) || qf.length !== 4 || qf.some((id) => typeof id !== "string"))
    return jsonResponse({ error: "Escolhas dos quartos de final inválidas." }, 400);
  if (!Array.isArray(sf) || sf.length !== 2 || sf.some((id) => typeof id !== "string"))
    return jsonResponse({ error: "Escolhas das meias-finais inválidas." }, 400);
  if (typeof fin !== "string")
    return jsonResponse({ error: "Escolha do campeão inválida." }, 400);

  const bracketArr = bracket as string[];
  const qfArr = qf as string[];
  const sfArr = sf as string[];
  for (let i = 0; i < 4; i++) {
    if (qfArr[i] !== bracketArr[2 * i] && qfArr[i] !== bracketArr[2 * i + 1])
      return jsonResponse({ error: "Essa equipa não está nesse confronto dos quartos." }, 400);
  }
  if (sfArr[0] !== qfArr[0] && sfArr[0] !== qfArr[1]) return jsonResponse({ error: "Meia-final 1 inconsistente com os teus quartos." }, 400);
  if (sfArr[1] !== qfArr[2] && sfArr[1] !== qfArr[3]) return jsonResponse({ error: "Meia-final 2 inconsistente com os teus quartos." }, 400);
  if (fin !== sfArr[0] && fin !== sfArr[1]) return jsonResponse({ error: "Campeão inconsistente com as tuas meias-finais." }, 400);

  // MODO REAL: bloquear sem revelar. Quem pontua é o admin (Avaliar #2).
  if (config.modo === "real") {
    const newPrev = { ...prev, qf, sf, fin, bracketLocked: true, resolved: null, rewardClaimed: false };
    const { error: updErr } = await admin
      .from("profiles")
      .update({ state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updErr) return jsonResponse({ error: updErr.message }, 500);
    return jsonResponse({ prev: newPrev, bracketLocked: true });
  }

  // MODO SIMULAÇÃO: resolve via RNG e revela logo.
  const result = resolveBracket(bracketArr);
  const rqf = result.rqf, rsf = result.rsf, rchamp = result.rchamp;

  const qfHits = qfArr.filter((w, i) => w === rqf[i]).length;
  const sfHits = sfArr.filter((w, i) => w === rsf[i]).length;
  const champOk = fin === rchamp;
  const isFinals = (groupResult as Record<string, unknown>).isFinals === true;
  const qualPts = isFinals ? 0 : ((groupResult as Record<string, unknown>).qualHits as number ?? 0) * 10;
  const score = qualPts + qfHits * 10 + sfHits * 15 + (champOk ? 50 : 0);
  const rewardPack = scoreToRewardPack(score);

  const resolved = { rqf, rsf, champ: rchamp, qfHits, sfHits, champOk, score, rewardPack };
  const newPrev = { ...prev, qf, sf, fin, resolved, bracketLocked: false, rewardClaimed: false };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ prev: newPrev });
});
