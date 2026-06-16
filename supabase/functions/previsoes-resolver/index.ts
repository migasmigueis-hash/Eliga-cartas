// supabase/functions/previsoes-resolver/index.ts
//
// Modo real: lê QF/MF/Final de liga_data (etapa1_qf, etapa1_sf, etapa1_final)
// e usa esses resultados para avaliar as previsões do jogador.
// Modo simulação: mantém o resolveBracket (RNG).
//
// body: { qf: string[4], sf: string[2], fin: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { EMPTY_PREV, resolveBracket, scoreToRewardPack } from "../_shared/previsoesEngine.ts";

interface KnockoutMatch {
  teamA: string; teamB: string; golosA: number; golosB: number;
}

// determina o vencedor real de uma lista de jogos de knockout para dois adversários
function knockoutWinner(matches: KnockoutMatch[], teamA: string, teamB: string): string | null {
  const m = matches.find(
    (x) => (x.teamA === teamA && x.teamB === teamB) || (x.teamA === teamB && x.teamB === teamA)
  );
  if (!m) return null;
  if (m.golosA > m.golosB) return m.teamA;
  if (m.golosB > m.golosA) return m.teamB;
  // empate — vence o teamA do jogo (casa) por convenção
  return m.teamA;
}

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
  const groupResult = prev.groupResult as { realQual: string[]; qualHits: number } | null;
  if (!Array.isArray(bracket) || bracket.length !== 8 || !groupResult) {
    return jsonResponse({ error: "Simula a fase de grupos primeiro." }, 400);
  }
  if (prev.resolved) return jsonResponse({ error: "Já resolveste esta previsão." }, 400);

  const qf = body.qf, sf = body.sf, fin = body.fin;
  if (!Array.isArray(qf) || qf.length !== 4 || qf.some((id) => typeof id !== "string"))
    return jsonResponse({ error: "Escolhas dos quartos de final inválidas." }, 400);
  if (!Array.isArray(sf) || sf.length !== 2 || sf.some((id) => typeof id !== "string"))
    return jsonResponse({ error: "Escolhas das meias-finais inválidas." }, 400);
  if (typeof fin !== "string")
    return jsonResponse({ error: "Escolha do campeão inválida." }, 400);

  // validar consistência das escolhas com a bracket
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

  let rqf: string[], rsf: string[], rchamp: string;

  if (config.modo === "real") {
    const etapaKey = config.etapa === "finals" ? "finals" : `etapa${config.etapa}`;
    const [qfRes, sfRes, finalRes] = await Promise.all([
      admin.from("liga_data").select("data").eq("key", `${etapaKey}_qf`).single(),
      admin.from("liga_data").select("data").eq("key", `${etapaKey}_sf`).single(),
      admin.from("liga_data").select("data").eq("key", `${etapaKey}_final`).single(),
    ]);

    const qfMatches = (qfRes.data?.data ?? []) as KnockoutMatch[];
    const sfMatches = (sfRes.data?.data ?? []) as KnockoutMatch[];
    const finalMatches = (finalRes.data?.data ?? []) as KnockoutMatch[];

    if (qfMatches.length === 0) {
      return jsonResponse({ error: "Resultados das eliminatórias ainda não disponíveis." }, 400);
    }

    // QF: bracket[0]vsb[1], b[2]vsb[3], b[4]vsb[5], b[6]vsb[7]
    rqf = [
      knockoutWinner(qfMatches, bracketArr[0], bracketArr[1]) ?? bracketArr[0],
      knockoutWinner(qfMatches, bracketArr[2], bracketArr[3]) ?? bracketArr[2],
      knockoutWinner(qfMatches, bracketArr[4], bracketArr[5]) ?? bracketArr[4],
      knockoutWinner(qfMatches, bracketArr[6], bracketArr[7]) ?? bracketArr[6],
    ];

    rsf = [
      knockoutWinner(sfMatches, rqf[0], rqf[1]) ?? rqf[0],
      knockoutWinner(sfMatches, rqf[2], rqf[3]) ?? rqf[2],
    ];

    rchamp = knockoutWinner(finalMatches, rsf[0], rsf[1]) ?? rsf[0];
  } else {
    const result = resolveBracket(bracketArr);
    rqf = result.rqf;
    rsf = result.rsf;
    rchamp = result.rchamp;
  }

  const qfHits = qfArr.filter((w, i) => w === rqf[i]).length;
  const sfHits = sfArr.filter((w, i) => w === rsf[i]).length;
  const champOk = fin === rchamp;
  const score = groupResult.qualHits * 10 + qfHits * 10 + sfHits * 15 + (champOk ? 50 : 0);
  const rewardPack = scoreToRewardPack(score);

  const resolved = { rqf, rsf, champ: rchamp, qfHits, sfHits, champOk, score, rewardPack };
  const newPrev = { ...prev, qf, sf, fin, resolved, rewardClaimed: false };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ prev: newPrev });
});
