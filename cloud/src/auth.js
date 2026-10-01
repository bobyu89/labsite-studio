// Who is calling? Cloudflare Access sits in front of the editor host, emails
// the teacher a one-time code, and forwards every request with a signed JWT
// (Cf-Access-Jwt-Assertion). We verify that JWT ourselves against the team's
// public keys; we never trust a plain email header.
//
// Fails closed: if ACCESS_TEAM_DOMAIN / ACCESS_AUD are not configured, nobody
// is signed in. DEV_AUTH=on (local .dev.vars only) signs everyone in as
// DEV_USER_EMAIL, and only for requests to localhost.
import { dec, enc, base64UrlToBytes } from "./bytes.js";

let certCache = { team: null, at: 0, keys: new Map() };
const CERT_TTL = 60 * 60 * 1000;

async function accessKeys(team, fetchImpl, force = false) {
  if (!force && certCache.team === team && Date.now() - certCache.at < CERT_TTL) return certCache.keys;
  const res = await fetchImpl(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("無法取得 Access 公鑰（" + res.status + "）");
  const { keys = [] } = await res.json();
  const map = new Map();
  for (const jwk of keys)
    map.set(
      jwk.kid,
      await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]),
    );
  certCache = { team, at: Date.now(), keys: map };
  return map;
}

export function _resetCertCache() {
  certCache = { team: null, at: 0, keys: new Map() };
}

const json = (part) => JSON.parse(dec.decode(base64UrlToBytes(part)));

// Returns the verified payload or throws with a short reason.
export async function verifyAccessJwt(token, { team, aud, now = Date.now(), fetchImpl = fetch }) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [h, p, s] = parts;
  const header = json(h);
  const payload = json(p);
  if (header.alg !== "RS256") throw new Error("unexpected alg");
  let keys = await accessKeys(team, fetchImpl);
  if (!keys.has(header.kid)) keys = await accessKeys(team, fetchImpl, true); // key rotation
  const key = keys.get(header.kid);
  if (!key) throw new Error("unknown key");
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlToBytes(s), enc.encode(h + "." + p));
  if (!ok) throw new Error("bad signature");
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error("wrong audience");
  if (payload.iss !== `https://${team}`) throw new Error("wrong issuer");
  const t = Math.floor(now / 1000);
  if (typeof payload.exp !== "number" || payload.exp < t) throw new Error("expired");
  if (typeof payload.nbf === "number" && payload.nbf > t + 60) throw new Error("not yet valid");
  if (!payload.email) throw new Error("no email");
  return payload;
}

function cookie(request, name) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}

const isLocal = (request) => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(request.url).hostname);

export async function currentUser(request, env, fetchImpl = fetch) {
  if (env.DEV_AUTH === "on" && env.DEV_USER_EMAIL && isLocal(request))
    return { email: String(request.headers.get("X-Dev-Email") || env.DEV_USER_EMAIL).toLowerCase() };
  // Accept the team domain as shown in the dashboard ("https://x.cloudflareaccess.com") or bare.
  const team = String(env.ACCESS_TEAM_DOMAIN || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const aud = String(env.ACCESS_AUD || "").trim();
  if (!team || !aud) return null;
  const token = request.headers.get("Cf-Access-Jwt-Assertion") || cookie(request, "CF_Authorization");
  if (!token) return null;
  try {
    const payload = await verifyAccessJwt(token, { team, aud, fetchImpl });
    return { email: String(payload.email).toLowerCase() };
  } catch {
    return null;
  }
}
