// supabase/functions/previsoes-avaliar/index.ts  (NOVA — botão único de admin)
//
// Um só endpoint para os DOIS momentos de avaliação. O servidor decide sozinho:
//
//   • "grupos"  → Avaliar #1: enquanto houver jogadores com a previsão de apurados
//                 fechada e ainda por revelar (e já existir o bracket real em
//                 etapaN_qf), revela os apurados (qualHits) e popula prev.bracket
//                 com as 8 equipas reais para a previsão da eliminatória.
//
//   • "elim"    → Avaliar #2: quando já não há grupos por revelar, pontua as
//                 previsões das eliminatórias com os resultados reais
//                 (etapaN_qf/sf/final com golos, ou finals_jogos).
//
// Prioridade: se houver grupos por revelar, faz primeiro a revelação (mode="grupos").
// Só depois (segundo clique) é que valida as eliminatórias (mode="elim").
//
// Resposta: { ok, mode: "grupos"|"elim", revealed/resolved, skipped, ... }

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
function hasGolos(arr: unknown): boolean {
  return Array.isArray(arr) && arr.length > 0 && arr.some((m: any) => typeof m?.golosA === "number" && typeof m?.golosB === "number");
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
  const isFinals = config.etapa === "finals";
  const etapaKey = isFinals ? "finals" : `etapa${config.etapa}`;

  const { data: profiles } = await admin.from("profiles").select("id, state");
  const allProfiles = profiles ?? [];

  // ---- carregar o bracket real (8 equipas) da etapa, se existir ----
  let bracket: string[] = [];
  if (!isFinals) {
    for (const key of [`${etapaKey}_qf`, `${etapaKey}_bracket`]) {
      const { data: row } = await admin.from("liga_data").select("data").eq("key", key).maybeSingle();
      const jogos = (row?.data ?? []) as { teamA: string; teamB: string }[];
      if (Array.isArray(jogos) && jogos.length >= 4) { bracket = jogos.slice(0, 4).flatMap((m) => [m.teamA, m.teamB]); break; }
    }
  }

  // ---- contar quantos jogadores ainda precisam de REVELAÇÃO de grupos ----
  // (têm 8 apurados escolhidos mas o groupResult ainda não tem realQual)
  const needsReveal = (prev: Record<string, unknown>) => {
    const gr = (prev.groupResult ?? null) as Record<string, unknown> | null;
    return Array.isArray(prev.qual) && (prev.qual as unknown[]).length === 8 &&
      (!gr || gr.realQual == null) && !prev.resolved;
  };
  const pendingReveal = allProfiles.filter((p) => needsReveal((p.state as any)?.prev ?? {})).length;

  // =====================================================================
  // MODO "grupos" — revelar apurados (só etapas normais, não Finals)
  // =====================================================================
  if (!isFinals && pendingReveal > 0) {
    if (bracket.length !== 8) {
      return jsonResponse({ error: `Há ${pendingReveal} previsão(ões) de grupos por revelar, mas o bracket real ainda não está em ${etapaKey}_qf (preciso dos 4 confrontos QF). Insere-o primeiro.` }, 400);
    }
    const realQual = [...new Set(bracket)];
    let revealed = 0, skipped = 0;

    for (const profile of allProfiles) {
      const state = (profile.state ?? {}) as Record<string, unknown>;
      const prev = (state.prev ?? {}) as Record<string, unknown>;
      if (!needsReveal(prev)) { skipped++; continue; }

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
    return jsonResponse({ ok: true, mode: "grupos", revealed, skipped, realQual });
  }

  // =====================================================================
  // MODO "elim" — validar eliminatórias com resultados reais
  // =====================================================================
  let qfM: KnockoutMatch[] = [], sfM: KnockoutMatch[] = [], finM: KnockoutMatch[] = [], finalsJogos: KnockoutMatch[] = [];
  if (isFinals) {
    const { data: jr } = await admin.from("liga_data").select("data").eq("key", "finals_jogos").single();
    finalsJogos = (jr?.data ?? []) as KnockoutMatch[];
    if (!hasGolos(finalsJogos)) return jsonResponse({ error: "Resultados das Finals ainda não disponíveis (finals_jogos sem golos)." }, 400);
  } else {
    const [qfR, sfR, finR] = await Promise.all([
      admin.from("liga_data").select("data").eq("key", `${etapaKey}_qf`).single(),
      admin.from("liga_data").select("data").eq("key", `${etapaKey}_sf`).single(),
      admin.from("liga_data").select("data").eq("key", `${etapaKey}_final`).single(),
    ]);
    qfM = (qfR.data?.data ?? []) as KnockoutMatch[];
    sfM = (sfR.data?.data ?? []) as KnockoutMatch[];
    finM = (finR.data?.data ?? []) as KnockoutMatch[];
    if (!hasGolos(qfM) || !hasGolos(sfM) || !hasGolos(finM)) {
      return jsonResponse({ error: "Resultados das eliminatórias incompletos. Preciso de QF, MF e Final com golos em " + etapaKey + "_qf / _sf / _final." }, 400);
    }
  }

  let resolved = 0, skipped = 0;
  for (const profile of allProfiles) {
    const state = (profile.state ?? {}) as Record<string, unknown>;
    const prev = (state.prev ?? {}) as Record<string, unknown>;
    const br = prev.bracket as string[] | undefined;
    const qfArr = (prev.qf as (string | null)[]) ?? [];
    const sfArr = (prev.sf as (string | null)[]) ?? [];
    const fin = prev.fin as string | undefined;

    if (!Array.isArray(br) || br.length !== 8 || !fin || prev.resolved) { skipped++; continue; }
    if (qfArr.length !== 4 || qfArr.some((q) => !q) || sfArr.length !== 2 || sfArr.some((s) => !s)) { skipped++; continue; }

    let rqf: string[], rsf: string[], rchamp: string;
    if (isFinals) {
      rqf = [
        seriesWinner(finalsJogos, br[0], br[1]), seriesWinner(finalsJogos, br[2], br[3]),
        seriesWinner(finalsJogos, br[4], br[5]), seriesWinner(finalsJogos, br[6], br[7]),
      ];
      rsf = [seriesWinner(finalsJogos, rqf[0], rqf[1]), seriesWinner(finalsJogos, rqf[2], rqf[3])];
      rchamp = seriesWinner(finalsJogos, rsf[0], rsf[1]);
    } else {
      rqf = [
        knockoutWinner(qfM, br[0], br[1]) ?? br[0], knockoutWinner(qfM, br[2], br[3]) ?? br[2],
        knockoutWinner(qfM, br[4], br[5]) ?? br[4], knockoutWinner(qfM, br[6], br[7]) ?? br[6],
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

  return jsonResponse({ ok: true, mode: "elim", resolved, skipped });
});
