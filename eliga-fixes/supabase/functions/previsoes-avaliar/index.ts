// supabase/functions/previsoes-avaliar/index.ts v2 (botão único de admin)
//
// Um só endpoint para os DOIS momentos de avaliação. O servidor decide sozinho:
//   • "grupos" → Avaliar #1: revela apurados (qualHits) + popula a bracket real.
//   • "elim"   → Avaliar #2: pontua a eliminatória com resultados reais.
//
// Recompensa por fase (pack + pontos Twitch creditados automaticamente).

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

// ---------------------------------------------------------------------------
// TIERS DE RECOMPENSA (pack + pontos Twitch) — ajusta os valores à vontade.
function groupRewardFor(qualHits: number): { pack: string | null; twitch: number } {
  if (qualHits >= 7) return { pack: "finals", twitch: 150 };
  if (qualHits >= 5) return { pack: "finals", twitch: 100 };
  if (qualHits >= 3) return { pack: "base", twitch: 50 };
  if (qualHits >= 1) return { pack: "base", twitch: 20 };
  return { pack: null, twitch: 0 };
}
function elimRewardFor(elimPts: number): { pack: string | null; twitch: number } {
  if (elimPts >= 100) return { pack: "finals", twitch: 200 };
  if (elimPts >= 60) return { pack: "finals", twitch: 120 };
  if (elimPts >= 30) return { pack: "base", twitch: 60 };
  if (elimPts >= 10) return { pack: "base", twitch: 25 };
  return { pack: null, twitch: 0 };
}
// ---------------------------------------------------------------------------

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

  // soma "pontos eLiga" ao ranking partilhado (mesma escala da Competição).
  // idempotente: cada fase só credita uma vez (reveal/validate só processam quem ainda não foi).
  async function addEligaPoints(uname: string | null, uid: string, pts: number) {
    if (!uname || pts <= 0) return;
    const { data: row } = await admin.from("leaderboard").select("score, jornadas").eq("username", uname).maybeSingle();
    const newScore = ((row?.score as number) ?? 0) + pts;
    await admin.from("leaderboard").upsert(
      { username: uname, user_id: uid, score: newScore, jornadas: (row?.jornadas as number) ?? 0, updated_at: new Date().toISOString() },
      { onConflict: "username" }
    );
  }

  const { data: profiles } = await admin.from("profiles").select("id, state, twitch_points, username");
  const allProfiles = profiles ?? [];

  // bracket real (8 equipas) da etapa, se existir
  let bracket: string[] = [];
  if (!isFinals) {
    for (const key of [`${etapaKey}_qf`, `${etapaKey}_bracket`]) {
      const { data: row } = await admin.from("liga_data").select("data").eq("key", key).maybeSingle();
      const jogos = (row?.data ?? []) as { teamA: string; teamB: string }[];
      if (Array.isArray(jogos) && jogos.length >= 4) { bracket = jogos.slice(0, 4).flatMap((m) => [m.teamA, m.teamB]); break; }
    }
  }

  const needsReveal = (prev: Record<string, unknown>) => {
    const gr = (prev.groupResult ?? null) as Record<string, unknown> | null;
    return Array.isArray(prev.qual) && (prev.qual as unknown[]).length === 8 &&
      (!gr || gr.realQual == null) && !prev.resolved;
  };
  const pendingReveal = allProfiles.filter((p) => needsReveal((p.state as any)?.prev ?? {})).length;

  // =================== MODO "grupos" ===================
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
      const reward = groupRewardFor(qualHits);
      const newPrev = {
        ...prev,
        groupResult: { realQual, qualHits },
        bracket,
        qf: [null, null, null, null], sf: [null, null], fin: null,
        resolved: null, bracketLocked: false, rewardClaimed: false,
        groupReward: { pack: reward.pack, twitch: reward.twitch },
        groupRewardClaimed: false,
      };
      const curTwitch = (profile.twitch_points as number) ?? 0;
      const upd: Record<string, unknown> = { state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() };
      if (reward.twitch > 0) upd.twitch_points = curTwitch + reward.twitch;
      await admin.from("profiles").update(upd).eq("id", profile.id);
      // pontos eLiga (ranking): apurados certos × 10
      await addEligaPoints((profile.username as string) ?? null, profile.id as string, qualHits * 10);
      revealed++;
    }
    return jsonResponse({ ok: true, mode: "grupos", revealed, skipped, realQual });
  }

  // =================== MODO "elim" ===================
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
    const elimPts = qfHits * 10 + sfHits * 15 + (champOk ? 50 : 0);
    const score = qualPts + elimPts;
    const reward = elimRewardFor(elimPts);

    const newPrev = {
      ...prev,
      bracketLocked: false,
      resolved: { rqf, rsf, champ: rchamp, qfHits, sfHits, champOk, score, rewardPack: reward.pack, twitch: reward.twitch },
      rewardClaimed: false,
    };
    const curTwitch = (profile.twitch_points as number) ?? 0;
    const upd: Record<string, unknown> = { state: { ...state, prev: newPrev }, updated_at: new Date().toISOString() };
    if (reward.twitch > 0) upd.twitch_points = curTwitch + reward.twitch;
    await admin.from("profiles").update(upd).eq("id", profile.id);
    // pontos eLiga (ranking): pontos da eliminatória (QF×10 + MF×15 + Campeão×50)
    await addEligaPoints((profile.username as string) ?? null, profile.id as string, elimPts);
    resolved++;
  }

  return jsonResponse({ ok: true, mode: "elim", resolved, skipped });
});
