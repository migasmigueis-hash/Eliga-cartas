// supabase/functions/twitch-link-callback/index.ts
//
// URL de redirecionamento configurado na app Twitch (Developer Console).
// A Twitch chama isto diretamente no browser do jogador (sem token de
// sessão do Supabase) com ?code=...&state=... (ou ?error=... se recusado).
//
// IMPORTANTE: esta função tem de ser publicada com --no-verify-jwt, senão o
// gateway do Supabase rejeita o pedido da Twitch antes de chegar aqui:
//   supabase functions deploy twitch-link-callback --no-verify-jwt --use-api
//
// Fluxo:
//   1. Verifica o "state" assinado -> obtém o user_id da eLiga Cartas.
//   2. Troca o "code" por um access token da Twitch.
//   3. Obtém o utilizador Twitch (id + login) com esse token.
//   4. Grava twitch_user_id/twitch_login no perfil (via service_role).
//   5. Redireciona de volta para a app com ?twitch=linked|denied|taken|error

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyState } from "../_shared/twitchState.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://eligaportugal.vercel.app";

// só voltamos para origens "razoáveis" (produção/Vercel/local) — o valor vem
// do header Origin (controlado pelo browser, não pelo utilizador) capturado
// em twitch-link-start, por isso já não é arbitrário, mas mantemos esta
// lista como defesa extra.
const ALLOWED_ORIGIN_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$|^https:\/\/eligaportugal\.vercel\.app$|^https?:\/\/localhost(:\d+)?$|^https?:\/\/127\.0\.0\.1(:\d+)?$/;

function redirectTo(status: string, origin?: string | null): Response {
  const base = origin && ALLOWED_ORIGIN_RE.test(origin) ? origin : APP_URL;
  return new Response(null, {
    status: 302,
    headers: { Location: `${base}/?twitch=${status}` },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) return redirectTo("denied");
  if (!code || !state) return redirectTo("error");

  const verified = await verifyState(state);
  if (!verified) return redirectTo("error");
  const userId = verified.uid;
  const returnOrigin = verified.origin;

  const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID");
  const TWITCH_CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return redirectTo("error", returnOrigin);

  const redirectUri = `${SUPABASE_URL}/functions/v1/twitch-link-callback`;

  // 1) troca o código por um access token
  let accessToken: string;
  try {
    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) return redirectTo("error", returnOrigin);
    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
    if (!accessToken) return redirectTo("error", returnOrigin);
  } catch {
    return redirectTo("error", returnOrigin);
  }

  // 2) obtém o utilizador Twitch autenticado
  let twitchUserId: string, twitchLogin: string;
  try {
    const usersRes = await fetch("https://api.twitch.tv/helix/users", {
      headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": TWITCH_CLIENT_ID },
    });
    if (!usersRes.ok) return redirectTo("error", returnOrigin);
    const usersData = await usersRes.json();
    const u = usersData?.data?.[0];
    if (!u?.id || !u?.login) return redirectTo("error", returnOrigin);
    twitchUserId = u.id;
    twitchLogin = u.login;
  } catch {
    return redirectTo("error", returnOrigin);
  }

  // 3) grava no perfil
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error: updErr } = await admin
    .from("profiles")
    .update({ twitch_user_id: twitchUserId, twitch_login: twitchLogin, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (updErr) {
    // unique_violation: esta conta Twitch já está ligada a outro perfil
    if ((updErr as { code?: string }).code === "23505") return redirectTo("taken", returnOrigin);
    return redirectTo("error", returnOrigin);
  }

  return redirectTo("linked", returnOrigin);
});
