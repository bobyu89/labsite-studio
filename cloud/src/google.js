// Sign in with Google: a teacher clicks one button, picks their Google account
// and is in, with no password to forget and no link to ask the admin for.
// Plain OpenID Connect authorization-code flow. The ID token comes straight
// from Google's token endpoint over TLS (our client secret authenticates the
// exchange), so per OIDC Core 3.1.3.7 we check its claims, not its signature.
// Only the admin and site members get in; everyone else is told to ask.
import { randomId } from "./bytes.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const STATE_COOKIE = "ls_google";
export const STATE_TTL = 10 * 60; // seconds to finish picking an account

export const googleEnabled = (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const callbackUrl = (requestUrl) => new URL(requestUrl).origin + "/api/auth/google/callback";

// → { url, cookie value } for the redirect to Google's account picker.
export function googleStart(env, requestUrl) {
  const state = randomId(16);
  const nonce = randomId(16);
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(requestUrl),
    response_type: "code",
    scope: "openid email",
    state,
    nonce,
    prompt: "select_account",
  });
  return { url: AUTH_URL + "?" + q, value: state + "." + nonce };
}

function decodePayload(idToken) {
  const part = String(idToken || "").split(".")[1];
  if (!part) throw new Error("malformed id_token");
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))));
}

// → verified, lower-cased email; throws with a short reason otherwise.
export async function googleFinish(env, requestUrl, { code, state, cookie }, fetchImpl, now = Date.now()) {
  const [want, nonce] = String(cookie || "").split(".");
  if (!want || !nonce || state !== want) throw new Error("state");
  if (!code) throw new Error("code");
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(requestUrl),
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) throw new Error("token " + res.status);
  const p = decodePayload((await res.json()).id_token);
  if (!ISSUERS.includes(p.iss)) throw new Error("iss");
  if ((Array.isArray(p.aud) ? p.aud : [p.aud]).indexOf(env.GOOGLE_CLIENT_ID) < 0) throw new Error("aud");
  if (typeof p.exp !== "number" || p.exp * 1000 < now) throw new Error("exp");
  if (p.nonce !== nonce) throw new Error("nonce");
  if (!p.email || (p.email_verified !== true && p.email_verified !== "true")) throw new Error("email");
  return String(p.email).trim().toLowerCase();
}
