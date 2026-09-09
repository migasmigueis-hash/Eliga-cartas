// supabase/functions/admin-liga-config/index.ts v6
// Config: modo, etapa, fase, grupo, prazoGrupos, prazoElim, prazoCompGrupos, prazoCompElim
// Invariantes: eliminatorias/finals → grupo=null; grupos sem grupo → "A".

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { CARD_POOL } from "../_shared/cardpool.ts";

const RESERVED_BATCH_IDS = new Set(["base", "finals-2526", "taca-2526", "etapa1-2526", "etapa2-2526", "etapa3-2526", "grande-final-2526"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "JSON inválido." }, 400); }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!profile?.is_admin) return jsonResponse({ error: "Sem permissão." }, 403);

  const { data: current } = await admin.from("liga_data").select("data").eq("key", "config").single();
  const currentData = (current?.data ?? {}) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if ("modo" in body) { if (!["simulacao", "real"].includes(body.modo as string)) return jsonResponse({ error: "modo inválido." }, 400); patch.modo = body.modo; }
  if ("etapa" in body) { if (![1, 2, 3, "finals"].includes(body.etapa as number | string)) return jsonResponse({ error: "etapa inválida." }, 400); patch.etapa = body.etapa; }
  if ("fase" in body) { if (!["grupos", "eliminatorias"].includes(body.fase as string)) return jsonResponse({ error: "fase inválida." }, 400); patch.fase = body.fase; }
  if ("grupo" in body) { if (body.grupo === null || body.grupo === "") patch.grupo = null; else if (!["A", "B", "C"].includes(body.grupo as string)) return jsonResponse({ error: "grupo inválido." }, 400); else patch.grupo = body.grupo; }
  for (const k of ["prazoGrupos", "prazoElim", "prazoCompGrupos", "prazoCompElim"]) {
    if (k in body) { const v = body[k]; if (v === null || v === "") patch[k] = null; else if (typeof v === "string" && !isNaN(new Date(v).getTime())) patch[k] = new Date(v).toISOString(); else return jsonResponse({ error: `${k} inválido.` }, 400); }
  }
  if ("cardImages" in body) {
    if (!body.cardImages || typeof body.cardImages !== "object" || Array.isArray(body.cardImages)) return jsonResponse({ error: "cardImages inválido." }, 400);
    const entries = Object.entries(body.cardImages as Record<string, unknown>);
    if (entries.length > 200) return jsonResponse({ error: "Demasiadas imagens de cartas." }, 400);
    for (const [cardId, image] of entries) {
      if (!/^[a-z0-9-]{1,80}$/.test(cardId) || !image || typeof image !== "object") return jsonResponse({ error: "Imagem de carta inválida." }, 400);
      const { url, path } = image as Record<string, unknown>;
      if (typeof url !== "string" || typeof path !== "string" || url.length > 1000 || path.length > 200) return jsonResponse({ error: "Dados da imagem inválidos." }, 400);
      if (!url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/card-images/`) || !/^(cards|casters)\//.test(path)) return jsonResponse({ error: "Origem da imagem inválida." }, 400);
    }
    patch.cardImages = body.cardImages;
  }
  if ("baseCardOverrides" in body) {
    if (!body.baseCardOverrides || typeof body.baseCardOverrides !== "object" || Array.isArray(body.baseCardOverrides)) return jsonResponse({ error: "baseCardOverrides inválido." }, 400);
    const entries = Object.entries(body.baseCardOverrides as Record<string, unknown>);
    if (entries.length > 100) return jsonResponse({ error: "Demasiadas cartas base personalizadas." }, 400);
    const allowedFields = new Set(["name", "team", "rarity", "isClub", "isCaster", "tag", "ovr", "customColor", "description", "customEffect"]);
    const allowedRarities = ["comum", "rara", "epica", "lendaria"];
    const allowedEffects = ["artilheiro", "vencedor", "consistente", "imparavel", "resiliente", "cacagrandes", "clube", "mentor", "fortaleza", "hype", "vozdaliga", "analista"];
    for (const [cardId, rawOverride] of entries) {
      if (!/^[a-z0-9-]{1,100}$/.test(cardId) || !rawOverride || typeof rawOverride !== "object" || Array.isArray(rawOverride)) return jsonResponse({ error: "Override de carta base inválido." }, 400);
      const override = rawOverride as Record<string, unknown>;
      if (Object.keys(override).some((key) => !allowedFields.has(key))) return jsonResponse({ error: "Campo de carta base não permitido." }, 400);
      if ("name" in override && (typeof override.name !== "string" || !override.name.trim() || override.name.length > 80)) return jsonResponse({ error: "Nome de carta base inválido." }, 400);
      if ("team" in override && override.team !== null && (typeof override.team !== "string" || !/^[a-z0-9-]{1,80}$/.test(override.team))) return jsonResponse({ error: "Clube de carta base inválido." }, 400);
      if ("rarity" in override && !allowedRarities.includes(override.rarity as string)) return jsonResponse({ error: "Raridade de carta base inválida." }, 400);
      if ("isClub" in override && typeof override.isClub !== "boolean") return jsonResponse({ error: "Tipo de carta base inválido." }, 400);
      if ("isCaster" in override && typeof override.isCaster !== "boolean") return jsonResponse({ error: "Tipo de carta base inválido." }, 400);
      if ("tag" in override && (typeof override.tag !== "string" || override.tag.length > 100)) return jsonResponse({ error: "Destaque de carta base inválido." }, 400);
      if ("ovr" in override && (!Number.isFinite(override.ovr) || Number(override.ovr) < 1 || Number(override.ovr) > 99)) return jsonResponse({ error: "Rating de carta base inválido." }, 400);
      if ("customColor" in override && (typeof override.customColor !== "string" || !/^#[0-9a-f]{6}$/i.test(override.customColor))) return jsonResponse({ error: "Cor de carta base inválida." }, 400);
      if ("description" in override && (typeof override.description !== "string" || override.description.length > 220)) return jsonResponse({ error: "Descrição de carta base inválida." }, 400);
      if ("customEffect" in override) {
        const effect = override.customEffect as Record<string, unknown> | null;
        if (!effect || typeof effect !== "object" || !allowedEffects.includes(effect.tipo as string) || !Number.isFinite(effect.mag) || Math.abs(Number(effect.mag)) > 1000) return jsonResponse({ error: "Efeito de carta base inválido." }, 400);
      }
    }
    if (JSON.stringify(body.baseCardOverrides).length > 100_000) return jsonResponse({ error: "Personalização das cartas base demasiado grande." }, 400);
    patch.baseCardOverrides = body.baseCardOverrides;
  }
  if ("customBatches" in body) {
    if (!Array.isArray(body.customBatches)) return jsonResponse({ error: "customBatches inválido." }, 400);
    if (body.customBatches.length > 20) return jsonResponse({ error: "Máximo de 20 batches." }, 400);
    const allowedRarities = ["comum", "rara", "epica", "lendaria"];
    const allowedEffects = ["artilheiro", "vencedor", "consistente", "imparavel", "resiliente", "cacagrandes", "clube", "mentor", "fortaleza", "hype", "vozdaliga", "analista"];
    const batchIds = new Set<string>();
    const cardIds = new Set(CARD_POOL.map((card) => card.id));
    let totalCards = 0;
    for (const rawBatch of body.customBatches) {
      if (!rawBatch || typeof rawBatch !== "object" || Array.isArray(rawBatch)) return jsonResponse({ error: "Batch inválido." }, 400);
      const batch = rawBatch as Record<string, unknown>;
      if (typeof batch.id !== "string" || !/^[a-z0-9-]{1,100}$/.test(batch.id)) return jsonResponse({ error: "ID de batch inválido." }, 400);
      if (RESERVED_BATCH_IDS.has(batch.id)) return jsonResponse({ error: "O ID desta edição está reservado." }, 400);
      if (batchIds.has(batch.id)) return jsonResponse({ error: "Existem edições com o mesmo ID." }, 400);
      batchIds.add(batch.id);
      if (typeof batch.name !== "string" || !batch.name.trim() || batch.name.length > 100) return jsonResponse({ error: "Nome de batch inválido." }, 400);
      if (typeof batch.description !== "string" || batch.description.length > 220) return jsonResponse({ error: "Descrição de batch inválida." }, 400);
      if (!['draft', 'published'].includes(batch.status as string)) return jsonResponse({ error: "Estado de batch inválido." }, 400);
      if (!Array.isArray(batch.cards) || batch.cards.length === 0 || batch.cards.length > 100) return jsonResponse({ error: "Um batch deve ter entre 1 e 100 cartas." }, 400);
      totalCards += batch.cards.length;
      for (const rawCard of batch.cards) {
        if (!rawCard || typeof rawCard !== "object" || Array.isArray(rawCard)) return jsonResponse({ error: "Carta inválida." }, 400);
        const card = rawCard as Record<string, unknown>;
        const effect = card.customEffect as Record<string, unknown> | undefined;
        if (typeof card.id !== "string" || !/^[a-z0-9-]{1,100}$/.test(card.id)) return jsonResponse({ error: "ID de carta inválido." }, 400);
        if (cardIds.has(card.id)) return jsonResponse({ error: "Existem cartas com o mesmo ID." }, 400);
        cardIds.add(card.id);
        if (typeof card.name !== "string" || !card.name.trim() || card.name.length > 80) return jsonResponse({ error: "Nome de carta inválido." }, 400);
        if (!allowedRarities.includes(card.rarity as string)) return jsonResponse({ error: "Raridade inválida." }, 400);
        if (!Number.isFinite(card.ovr) || Number(card.ovr) < 1 || Number(card.ovr) > 99) return jsonResponse({ error: "Rating inválido." }, 400);
        if (typeof card.customColor !== "string" || !/^#[0-9a-f]{6}$/i.test(card.customColor)) return jsonResponse({ error: "Cor de carta inválida." }, 400);
        if (typeof card.description !== "string" || card.description.length > 220) return jsonResponse({ error: "Descrição de carta inválida." }, 400);
        if (!effect || !allowedEffects.includes(effect.tipo as string) || !Number.isFinite(effect.mag) || Math.abs(Number(effect.mag)) > 1000) return jsonResponse({ error: "Efeito de carta inválido." }, 400);
      }
    }
    if (totalCards > 500) return jsonResponse({ error: "Máximo de 500 cartas personalizadas." }, 400);
    if (JSON.stringify(body.customBatches).length > 500_000) return jsonResponse({ error: "Configuração de batches demasiado grande." }, 400);
    patch.customBatches = body.customBatches;
  }

  const newConfig = { ...currentData, ...patch } as Record<string, unknown>;
  if (newConfig.fase === "eliminatorias" || newConfig.etapa === "finals") newConfig.grupo = null;
  else if (newConfig.fase === "grupos" && !["A", "B", "C"].includes(newConfig.grupo as string)) newConfig.grupo = "A";

  const { error: updErr } = await admin.from("liga_data").upsert({ key: "config", data: newConfig, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (updErr) return jsonResponse({ error: updErr.message }, 500);
  return jsonResponse({ ok: true, config: newConfig });
});
