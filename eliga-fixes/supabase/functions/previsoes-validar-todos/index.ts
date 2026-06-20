// supabase/functions/previsoes-validar-todos/index.ts v3
//
// MOMENTO de admin #2 ("Avaliar" depois de a eliminatória ser jogada).
//
// Pontua a previsão da ELIMINATÓRIA de TODOS os utilizadores, usando os
// resultados reais inseridos em liga_data (etapaN_qf/sf/final, com golos; ou
// finals_jogos para as Finals).
//
// Pré-requisitos por utilizador:
//   - prev.bracket (8 equipas reais, vindas do Avaliar #1) e prev.fin definido.
//   - prev.resolved ainda null (não pontuado).
//
// FIX v3:
//   - Comparação POSICIONAL limpa: como prev.bracket são as 8 equipas reais (todas
//     iguais entre jogadores, vindas do admin), rqf/rsf são calculados a partir
//     dessa bracket e comparados posição-a-posição com qf/sf do jogador.
//   - qualPts vem de prev.groupResult.qualHits (já revelado no Avaliar #1).
//   - Escreve prev.resolved e limpa prev.bracketLocked.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { scoreToRewardPack } from "../_shared/previsoesEngine.ts";

interface KnockoutMatch { teamA: string; teamB: string; golosA: number; golosB: number; }

function knockoutWinner(matches: KnockoutMatch[], a: string, b: string): string | null {
  const m = matches.find((x) => (x.teamA === a && x.teamB === b) || (x.teamA === b && x.teamB === a));
  if (!m) return null;
  return m.golosA > m.golosB ? m.teamA : m.golosB > m.golosA ? m.teamB : m.teamA;
}

function seriesWinner(jogos: KnockoutMatch[], a: string, b: string): string {
  let wA = 0, wB = 0;
  for (const m of jogos) {
    if ((m.teamA === a && m.teamB === b) || (m.teamA === b && m.teamB === a)) {
      const gA = m.teamA === a ? m.golosA : m.golosB, gB = m.teamA === a ? m.golosB : m.golosA;
      if (gA > gB) wA++; else if (gB > gA) wB++;
    }
  }
  return wA >= wB ? a : b;
}

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
  const etapaKey = config.etapa === "finals" ? "finals" : `etapa${config.etapa}`;
  const isFinals = config.etapa === "finals";

  // carregar resultados reais da eliminatória
  let qfM: KnockoutMatch[] = [], sfM: KnockoutMatch[] = [], finM: KnockoutMatch[] = [], finalsJogos: KnockoutMatch[] = [];
  if (isFinals) {
    const { data: jr } = await admin.from("liga_data").select("data").eq("key", "finals_jogos").single();
    finalsJogos = (jr?.data ?? []) as KnockoutMatch[];
    if (finalsJogos.length === 0) return jsonResponse({ error: "Resultados das Finals ainda não disponíveis." }, 400);
  } else {
    const [qfR, sfR, finR] = await Promise.all([
      admin.from("liga_data").select("data").eq("key", `${etapaKey}_qf`).single(),
      admin.from("liga_data").select("data").eq("key", `${etapaKey}_sf`).single(),
      admin.from("liga_data").select("data").eq("key", `${etapaKey}_final`).single(),
    ]);
    qfM = (qfR.data?.data ?? []) as KnockoutMatch[];
    sfM = (sfR.data?.data ?? []) as KnockoutMatch[];
    finM = (finR.data?.data ?? []) as KnockoutMatch[];
    if (qfM.length < 4 || sfM.length < 2 || finM.length < 1) {
      return jsonResponse({ error: "Resultados das eliminatórias incompletos (precisas de QF, MF e Final com golos). Sincroniza primeiro." }, 400);
    }
  }

  const { data: profiles } = await admin.from("profiles").select("id, state");
  let resolved = 0, skipped = 0;

  for (const profile of profiles ?? []) {
    const state = (profile.state ?? {}) as Record<string, unknown>;
    const prev = (state.prev ?? {}) as Record<string, unknown>;
    const bracket = prev.bracket as string[] | undefined;
    const qfArr = (prev.qf as (string | null)[]) ?? [];
    const sfArr = (prev.sf as (string | null)[]) ?? [];
    const fin = prev.fin as string | undefined;

    if (!Array.isArray(bracket) || bracket.length !== 8 || !fin || prev.resolved) { skipped++; continue; }
    if (qfArr.length !== 4 || qfArr.some((q) => !q) || sfArr.length !== 2 || sfArr.some((s) => !s)) { skipped++; continue; }

    // vencedores reais, calculados sobre a bracket real do jogador (posicional)
    let rqf: string[], rsf: string[], rchamp: string;
    if (isFinals) {
      rqf = [
        seriesWinner(finalsJogos, bracket[0], bracket[1]),
        seriesWinner(finalsJogos, bracket[2], bracket[3]),
        seriesWinner(finalsJogos, bracket[4], bracket[5]),
        seriesWinner(finalsJogos, bracket[6], bracket[7]),
      ];
      rsf = [seriesWinner(finalsJogos, rqf[0], rqf[1]), seriesWinner(finalsJogos, rqf[2], rqf[3])];
      rchamp = seriesWinner(finalsJogos, rsf[0], rsf[1]);
    } else {
      rqf = [
        knockoutWinner(qfM, bracket[0], bracket[1]) ?? bracket[0],
        knockoutWinner(qfM, bracket[2], bracket[3]) ?? bracket[2],
        knockoutWinner(qfM, bracket[4], bracket[5]) ?? bracket[4],
        knockoutWinner(qfM, bracket[6], bracket[7]) ?? bracket[6],
      ];
      rsf = [knockoutWinner(sfM, rqf[0], rqf[1]) ?? rqf[0], knockoutWinner(sfM, rqf[2], rqf[3]) ?? rqf[2]];
      rchamp = knockoutWinner(finM, rsf[0], rsf[1]) ?? rsf[0];
    }

    const qfHits = (qfArr as string[]).filter((w, i) => w === rqf[i]).length;
    const sfHits = (sfArr as string[]).filter((w, i) => w === rsf[i]).length;
    const champOk = fin === rchamp;

    const gr = (prev.groupResult ?? {}) as Record<string, unknown>;
    const isFinalsPrev = gr.isFinals === true;
    const qualPts = isFinalsPrev ? 0 : ((gr.qualHits as number) ?? 0) * 10;
    const score = qualPts + qfHits * 10 + sfHits * 15 + (champOk ? 50 : 0);

    const newPrev = {
      ...prev,
      bracketLocked: false,
      resolved: { rqf, rsf, champ: rchamp, qfHits, sfHits, champOk, score, rewardPack: scoreToRewardPack(score) },
      rewardClaimed: false,
    };
    await admin.from("profiles").update({ state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() }).eq("id", profile.id);
    resolved++;
  }

  return jsonResponse({ ok: true, resolved, skipped });
});
