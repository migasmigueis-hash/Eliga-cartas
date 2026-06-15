// supabase/functions/twitch-link-start/index.ts
//
// Chamada pelo cliente (autenticado) quando o jogador clica em "Ligar conta
// Twitch". Gera um "state" assinado (ver _shared/twitchState.ts) que
// identifica este utilizador, e devolve o URL de autorização da Twitch para
// onde o browser deve ser redirecionado.
//
// Esta função NÃO precisa de --no-verify-jwt (é chamada pelo cliente, com o
// token de sessão normal).

import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { signState } from "../_shared/twitchState.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID");

  if (!TWITCH_CLIENT_ID) {
    return jsonResponse({ error: "Integração Twitch ainda não está configurada (TWITCH_CLIENT_ID em falta)." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Não autenticado." }, 401);

  const origin = req.headers.get("Origin");
  const state = await signState(userData.user.id, origin);
  const redirectUri = `${SUPABASE_URL}/functions/v1/twitch-link-callback`;

  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.set("client_id", TWITCH_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "");
  url.searchParams.set("state", state);

  return jsonResponse({ url: url.toString() });
});
