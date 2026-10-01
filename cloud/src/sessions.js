// Sign-in without Cloudflare Access: an admin makes a one-time invite link for
// a teacher's email; opening it exchanges the link for a 30-day session cookie.
// Links and session ids are 256-bit random values; only their SHA-256 hashes
// are stored. A link works once, so a forwarded, already-used link is useless.
import { sha256Hex, randomId } from "./bytes.js";

export const COOKIE = "ls_session";
export const INVITE_TTL = 14 * 24 * 3600 * 1000;
export const SESSION_TTL = 30 * 24 * 3600 * 1000;

export async function createInvite(env, email, createdBy, now = Date.now()) {
  const token = randomId(32);
  const expiresAt = now + INVITE_TTL;
  await env.DB.prepare(
    "INSERT INTO invites (token_hash, email, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(await sha256Hex(token), String(email).trim().toLowerCase(), createdBy, now, expiresAt)
    .run();
  return { token, expiresAt };
}

// → { email, session, expiresAt } or null (unknown, used or expired link).
export async function redeemInvite(env, token, now = Date.now()) {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare("SELECT email, expires_at, used_at FROM invites WHERE token_hash = ?").bind(hash).first();
  if (!row || row.used_at || row.expires_at < now) return null;
  // Claim the link atomically, so two simultaneous clicks cannot both win.
  const claim = await env.DB.prepare("UPDATE invites SET used_at = ? WHERE token_hash = ? AND used_at IS NULL").bind(now, hash).run();
  if (claim.meta.changes !== 1) return null;
  const session = randomId(32);
  const expiresAt = now + SESSION_TTL;
  await env.DB.prepare("INSERT INTO sessions (id_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(session), row.email, now, expiresAt)
    .run();
  return { email: row.email, session, expiresAt };
}

export async function sessionUser(env, session, now = Date.now()) {
  if (typeof session !== "string" || !/^[0-9a-f]{64}$/.test(session)) return null;
  const row = await env.DB.prepare("SELECT email, expires_at FROM sessions WHERE id_hash = ?")
    .bind(await sha256Hex(session))
    .first();
  if (!row || row.expires_at < now) return null;
  return { email: row.email };
}

export async function endSession(env, session) {
  if (typeof session !== "string" || !session) return;
  await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256Hex(session)).run();
}

export function sessionCookie(value, { maxAge, secure }) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function readCookie(request, name) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}
