// supabase/functions/admin-liga-config/index.ts v6
// Config: modo, etapa, fase, grupo, prazoGrupos, prazoElim, prazoCompGrupos, prazoCompElim
// Invariantes: eliminatorias/finals → grupo=null; grupos sem grupo → "A".

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

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

  const newConfig = { ...currentData, ...patch } as Record<string, unknown>;
  if (newConfig.fase === "eliminatorias" || newConfig.etapa === "finals") newConfig.grupo = null;
  else if (newConfig.fase === "grupos" && !["A", "B", "C"].includes(newConfig.grupo as string)) newConfig.grupo = "A";

  const { error: updErr } = await admin.from("liga_data").upsert({ key: "config", data: newConfig, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (updErr) return jsonResponse({ error: updErr.message }, 500);
  return jsonResponse({ ok: true, config: newConfig });
});
