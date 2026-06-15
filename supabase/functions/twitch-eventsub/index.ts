// supabase/functions/twitch-eventsub/index.ts
//
// Endpoint chamado pela Twitch (EventSub webhook) sempre que alguém resgata
// uma recompensa de Channel Points no canal. Filtra pelo TÍTULO da
// recompensa (TWITCH_REWARD_TITLE) e credita TWITCH_POINTS_PER_REDEMPTION
// pontos ao perfil cujo twitch_user_id corresponda a quem resgatou.
//
// IMPORTANTE: publicar com --no-verify-jwt (é a Twitch que chama isto, sem
// sessão Supabase):
//   supabase functions deploy twitch-eventsub --no-verify-jwt --use-api
//
// Configuração necessária (supabase secrets set ...):
//   TWITCH_EVENTSUB_SECRET    — segredo escolhido por nós, usado para assinar
//                               as notificações (definido também ao criar a
//                               subscrição EventSub)
//   TWITCH_REWARD_TITLE       — título exato da recompensa de Channel Points
//                               (default: "Pontos eLiga Cartas")
//   TWITCH_POINTS_PER_REDEMPTION — pontos creditados por cada resgate
//                               (default: 10)

import { createClient } from "npm:@supabase/supabase-js@2";

const HDR_TYPE = "Twitch-Eventsub-Message-Type";
const HDR_ID = "Twitch-Eventsub-Message-Id";
const HDR_TIMESTAMP = "Twitch-Eventsub-Message-Timestamp";
const HDR_SIGNATURE = "Twitch-Eventsub-Message-Signature";

const REWARD_TITLE = (Deno.env.get("TWITCH_REWARD_TITLE") || "Pontos eLiga Cartas").trim().toLowerCase();
const POINTS_PER_REDEMPTION = parseInt(Deno.env.get("TWITCH_POINTS_PER_REDEMPTION") || "10", 10);

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(secret: string, messageId: string, timestamp: string, body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(messageId + timestamp + body));
  return "sha256=" + toHex(sig) === signature;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("método não permitido", { status: 405 });

  const body = await req.text();
  const messageType = req.headers.get(HDR_TYPE) || "";
  const messageId = req.headers.get(HDR_ID) || "";
  const timestamp = req.headers.get(HDR_TIMESTAMP) || "";
  const signature = req.headers.get(HDR_SIGNATURE) || "";

  const secret = Deno.env.get("TWITCH_EVENTSUB_SECRET");
  if (!secret) return new Response("eventsub não configurado", { status: 500 });

  const validSig = await verifySignature(secret, messageId, timestamp, body, signature);
  if (!validSig) return new Response("assinatura inválida", { status: 403 });

  let payload: { challenge?: string; subscription?: { type?: string }; event?: Record<string, unknown> };
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("json inválido", { status: 400 });
  }

  // 1) verificação da subscrição (acontece ao criá-la)
  if (messageType === "webhook_callback_verification") {
    return new Response(payload.challenge ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // 2) subscrição revogada (ex.: secret/condições deixaram de ser válidas)
  if (messageType === "revocation") {
    console.error("EventSub revogado:", payload.subscription);
    return new Response("ok", { status: 200 });
  }

  // 3) notificação de resgate de Channel Points
  if (messageType === "notification" && payload.subscription?.type === "channel.channel_points_custom_reward_redemption.add") {
    const event = payload.event as Record<string, unknown> | undefined;
    const reward = event?.reward as Record<string, unknown> | undefined;
    const title = String(reward?.title ?? "").trim().toLowerCase();
    const userId = String(event?.user_id ?? "");
    const redemptionId = String(event?.id ?? "");

    if (title === REWARD_TITLE && userId && redemptionId) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error } = await admin.rpc("credit_twitch_points", {
        p_twitch_user_id: userId,
        p_amount: POINTS_PER_REDEMPTION,
        p_redemption_id: redemptionId,
      });
      if (error) console.error("credit_twitch_points falhou:", error.message);
    }
    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
});
