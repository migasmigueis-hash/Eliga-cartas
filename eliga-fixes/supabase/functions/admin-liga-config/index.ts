// supabase/functions/admin-liga-config/index.ts v3
//
// Atualiza a configuração do modo de jogo em liga_data.config:
//   - modo: "simulacao" | "real"
//   - etapa: 1 | 2 | 3 | "finals"
//   - fase: "grupos" | "eliminatorias"
//   - grupo: "A" | "B" | "C" | null  (fase de grupos — qual grupo joga hoje)
//
// body: qualquer subconjunto de { modo, etapa, fase, grupo }
//
// FIX v3 (Bug 1 — "Já jogaste o Grupo C" em eliminatórias):
//   - grupo passa a aceitar `null` para LIMPAR o grupo ao sair da fase de grupos.
//   - invariante garantida no servidor: em "eliminatorias" ou "finals" o grupo é
//     sempre forçado a null, mesmo que o cliente o envie. Isto evita que um grupo
//     antigo (ex.: "C") fique colado e o play-jornada continue a achar que ainda
//     se está a jogar a fase de grupos.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "JSON inválido." }, 400); }

  if (body.__debug) return jsonResponse({ receivedBody: body, keys: Object.keys(body) });

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
  if ("modo" in body) {
    if (!["simulacao", "real"].includes(body.modo as string)) return jsonResponse({ error: "modo inválido." }, 400);
    patch.modo = body.modo;
  }
  if ("etapa" in body) {
    if (![1, 2, 3, "finals"].includes(body.etapa as number | string)) return jsonResponse({ error: "etapa inválida." }, 400);
    patch.etapa = body.etapa;
  }
  if ("fase" in body) {
    if (!["grupos", "eliminatorias"].includes(body.fase as string)) return jsonResponse({ error: "fase inválida." }, 400);
    patch.fase = body.fase;
  }
  if ("grupo" in body) {
    if (body.grupo === null || body.grupo === "") {
      patch.grupo = null; // limpar o grupo (saída da fase de grupos)
    } else if (!["A", "B", "C"].includes(body.grupo as string)) {
      return jsonResponse({ error: "grupo inválido (A, B, C ou null)." }, 400);
    } else {
      patch.grupo = body.grupo;
    }
  }

  const newConfig = { ...currentData, ...patch } as Record<string, unknown>;

  // INVARIANTE: fora da fase de grupos não pode existir grupo "ativo".
  if (newConfig.fase === "eliminatorias" || newConfig.etapa === "finals") {
    newConfig.grupo = null;
  }

  const { error: updErr } = await admin.from("liga_data").upsert(
    { key: "config", data: newConfig, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (updErr) return jsonResponse({ error: updErr.message }, 500);

  return jsonResponse({ ok: true, config: newConfig });
});
