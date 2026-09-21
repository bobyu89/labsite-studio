// LabSite OAuth exchange — a Cloudflare Worker with one job: swap the code
// GitHub hands the browser for an access token, using the client secret that
// must never ship inside the page.
//
// Two endpoints, both restricted to the origins listed in ALLOWED_ORIGINS:
//   POST /state     → { state }   a signed, origin-bound, short-lived nonce the
//                                  page must send to GitHub as the OAuth `state`
//   POST /exchange  → { access_token, scope }
//                                  requires { code, state, redirect_uri }; the
//                                  state must verify for the calling origin and
//                                  the redirect_uri must belong to that origin
//
// The page still compares the returned state against sessionStorage (CSRF on
// the browser side); the signature check here means a code can only be
// exchanged by the origin that started the login, within STATE_TTL_SECONDS,
// even if someone reaches the worker directly.

export const STATE_TTL_SECONDS = 600;

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

/* ---------------------------------------------------------- origins */
const normalizeOrigin = (s) => String(s || "").trim().replace(/\/+$/, "").toLowerCase();

export function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "").split(",").map(normalizeOrigin).filter(Boolean);
}

export const originAllowed = (env, origin) =>
  !!origin && allowedOrigins(env).includes(normalizeOrigin(origin));

/* ------------------------------------------------------------- state */
const enc = new TextEncoder();
const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message))));
}

// Constant-time string compare so a forged signature cannot be guessed byte by byte.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const stateSecret = (env) => env.STATE_SECRET || env.GITHUB_CLIENT_SECRET || "";

// state = "<issued-at-seconds>.<nonce>.<signature>", signature over origin|ts|nonce.
export async function issueState(env, origin, now = Date.now()) {
  const ts = Math.floor(now / 1000);
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const sig = await hmac(stateSecret(env), `${normalizeOrigin(origin)}|${ts}|${nonce}`);
  return `${ts}.${nonce}.${sig}`;
}

// Returns null when valid, otherwise a short reason.
export async function verifyState(env, origin, state, now = Date.now()) {
  if (typeof state !== "string") return "missing state";
  const parts = state.split(".");
  if (parts.length !== 3) return "malformed state";
  const [tsText, nonce, sig] = parts;
  if (!/^\d{1,12}$/.test(tsText) || !nonce || !sig) return "malformed state";
  const expected = await hmac(stateSecret(env), `${normalizeOrigin(origin)}|${tsText}|${nonce}`);
  if (!safeEqual(sig, expected)) return "state signature mismatch";
  const age = Math.floor(now / 1000) - Number(tsText);
  if (age < -60) return "state issued in the future";
  if (age > STATE_TTL_SECONDS) return "state expired";
  return null;
}

// The redirect_uri GitHub will accept is fixed on the OAuth App; we only make
// sure the page is not asking us to exchange a code minted for another origin.
export function redirectUriMatches(redirectUri, origin) {
  try {
    return normalizeOrigin(new URL(redirectUri).origin) === normalizeOrigin(origin);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ worker */
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const ok = originAllowed(env, origin);
    const cors = {
      "Access-Control-Allow-Origin": ok ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method === "POST" && (url.pathname === "/state" || url.pathname === "/exchange")) {
      if (!ok) return json({ error: "origin not allowed" }, 403, cors);
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)
        return json({ error: "worker not configured" }, 500, cors);

      if (url.pathname === "/state")
        return json({ state: await issueState(env, origin), ttl: STATE_TTL_SECONDS }, 200, cors);

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "bad request" }, 400, cors);
      }
      if (!body || typeof body.code !== "string" || !body.code)
        return json({ error: "missing code" }, 400, cors);
      const stateError = await verifyState(env, origin, body.state);
      if (stateError) return json({ error: stateError }, 400, cors);
      if (!redirectUriMatches(body.redirect_uri, origin))
        return json({ error: "redirect_uri does not match origin" }, 400, cors);

      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: body.code,
          redirect_uri: body.redirect_uri,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.access_token)
        return json({ error: data.error_description || data.error || "exchange failed" }, 400, cors);
      return json({ access_token: data.access_token, scope: data.scope || "" }, 200, cors);
    }
    return json({ ok: true, service: "labsite-oauth" }, 200, cors);
  },
};
