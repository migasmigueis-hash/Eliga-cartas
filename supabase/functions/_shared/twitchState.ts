// supabase/functions/_shared/twitchState.ts
//
// O parâmetro "state" do fluxo OAuth da Twitch serve dois propósitos aqui:
// 1. Proteção CSRF padrão do OAuth.
// 2. Transportar (de forma assinada, para não poder ser falsificado) qual
//    utilizador da eLiga Cartas iniciou o pedido — já que o callback da
//    Twitch não envia o token de sessão do Supabase.
//
// Reaproveita a SUPABASE_SERVICE_ROLE_KEY como segredo de assinatura (HMAC):
// já é um segredo longo e aleatório só acessível pelas Edge Functions, e
// evita ter de configurar mais um segredo só para isto.

function b64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const TEN_MINUTES = 10 * 60 * 1000;

// gera um "state" assinado que codifica o user_id e uma validade de 10 minutos
export async function signState(userId: string): Promise<string> {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + TEN_MINUTES });
  const payloadBytes = new TextEncoder().encode(payload);
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes);
  return b64url(payloadBytes) + "." + b64url(new Uint8Array(sig));
}

// verifica o "state" recebido no callback; devolve o user_id ou null se inválido/expirado
export async function verifyState(state: string): Promise<string | null> {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, sigPart] = parts;
  try {
    const payloadBytes = b64urlToBytes(payloadPart);
    const key = await hmacKey();
    const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sigPart) as BufferSource, payloadBytes as BufferSource);
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload.uid;
  } catch {
    return null;
  }
}
