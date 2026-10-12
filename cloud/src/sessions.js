// Sign-in without Cloudflare Access: an admin makes a one-time invite link for
// a teacher's email; opening it exchanges the link for a session cookie. A
// signed-in teacher can make a short-lived link for themselves to sign in on
// another device (phone, home computer) without asking the admin. Sessions
// last 90 days and are extended (at most once a day) while they are used.
// Links and session ids are 256-bit random values; only their SHA-256 hashes
// are stored. A link works once, so a forwarded, already-used link is useless.
//
// Passwords (optional, set after signing in once): salted PBKDF2-SHA256, the
// iteration count stored with each hash so it can be raised later. Five wrong
// passwords lock the account for 15 minutes; the answer never says whether an
// account exists.
import { sha256Hex, randomId } from "./bytes.js";

export const COOKIE = "ls_session";
export const INVITE_TTL = 14 * 24 * 3600 * 1000;
export const DEVICE_LINK_TTL = 15 * 60 * 1000;
export const SESSION_TTL = 90 * 24 * 3600 * 1000;
const RENEW_EVERY = 24 * 3600 * 1000;

export const PASSWORD_MIN = 8;
export const PASSWORD_ITERATIONS = 100000; // Workers' PBKDF2 maximum
export const LOCK_AFTER = 5;
export const LOCK_FOR = 15 * 60 * 1000;
// A session this young that came from a link may set a password without the old one.
export const RESET_WINDOW = 30 * 60 * 1000;

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
export async function hashPassword(password, iterations = PASSWORD_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${iterations}$${b64(salt)}$${b64(await pbkdf2(password, salt, iterations))}`;
}
export async function verifyPassword(password, stored) {
  const [kind, iter, salt, hash] = String(stored || "").split("$");
  if (kind !== "pbkdf2-sha256" || !salt || !hash) return false;
  const got = await pbkdf2(password, unb64(salt), Number(iter));
  const want = unb64(hash);
  let diff = got.length ^ want.length;
  for (let i = 0; i < Math.min(got.length, want.length); i++) diff |= got[i] ^ want[i];
  return diff === 0;
}
// → null when fine, otherwise the reason in Chinese.
export function passwordProblem(password) {
  const p = String(password ?? "");
  if (p.length < PASSWORD_MIN) return `密碼至少要 ${PASSWORD_MIN} 個字元。`;
  if (p.length > 128) return "密碼太長了（最多 128 個字元）。";
  if (/^(.)\1*$/.test(p) || /^(?:0123456789|1234567890|12345678|87654321|password|qwertyui)/i.test(p)) return "這個密碼太容易被猜到，請換一個。";
  return null;
}
const normEmail = (email) => String(email || "").trim().toLowerCase();
export async function hasPassword(env, email) {
  return !!(await env.DB.prepare("SELECT 1 AS x FROM accounts WHERE email = ?").bind(normEmail(email)).first());
}
export async function setPassword(env, email, password, now = Date.now()) {
  const hash = await hashPassword(password, Number(env.PASSWORD_ITERATIONS) || PASSWORD_ITERATIONS);
  await env.DB.prepare(
    "INSERT INTO accounts (email, password_hash, updated_at, failed_count, locked_until) VALUES (?, ?, ?, 0, NULL) " +
      "ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at, failed_count = 0, locked_until = NULL",
  )
    .bind(normEmail(email), hash, now)
    .run();
}
// A hash nobody has, so an unknown email takes as long as a known one.
let decoy = null;
// → { ok: true } | { ok: false, locked?: until }
export async function checkPassword(env, email, password, now = Date.now()) {
  const e = normEmail(email);
  const row = await env.DB.prepare("SELECT password_hash, failed_count, locked_until FROM accounts WHERE email = ?").bind(e).first();
  if (!row) {
    decoy ||= await hashPassword("decoy-" + Math.random(), Number(env.PASSWORD_ITERATIONS) || PASSWORD_ITERATIONS);
    await verifyPassword(String(password ?? ""), decoy);
    return { ok: false };
  }
  if (row.locked_until && row.locked_until > now) return { ok: false, locked: row.locked_until };
  if (await verifyPassword(String(password ?? ""), row.password_hash)) {
    if (row.failed_count) await env.DB.prepare("UPDATE accounts SET failed_count = 0, locked_until = NULL WHERE email = ?").bind(e).run();
    return { ok: true };
  }
  const failed = (row.locked_until && row.locked_until <= now ? 0 : row.failed_count) + 1;
  const lock = failed >= LOCK_AFTER ? now + LOCK_FOR : null;
  await env.DB.prepare("UPDATE accounts SET failed_count = ?, locked_until = ? WHERE email = ?").bind(lock ? 0 : failed, lock, e).run();
  return lock ? { ok: false, locked: lock } : { ok: false };
}
export async function passwordLogin(env, email, password, now = Date.now()) {
  const r = await checkPassword(env, email, password, now);
  if (!r.ok) return r;
  return { ok: true, ...(await createSession(env, normEmail(email), "password", now)) };
}
export async function createSession(env, email, via, now = Date.now()) {
  const session = randomId(32);
  const expiresAt = now + SESSION_TTL;
  await env.DB.prepare("INSERT INTO sessions (id_hash, email, created_at, expires_at, via) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256Hex(session), email, now, expiresAt, via)
    .run();
  return { email, session, expiresAt };
}
// How and when a session started (for the forgotten-password rule).
export async function sessionInfo(env, session) {
  if (typeof session !== "string" || !/^[0-9a-f]{64}$/.test(session)) return null;
  return env.DB.prepare("SELECT email, via, created_at FROM sessions WHERE id_hash = ?").bind(await sha256Hex(session)).first();
}

export async function createInvite(env, email, createdBy, now = Date.now(), ttl = INVITE_TTL) {
  const token = randomId(32);
  const expiresAt = now + ttl;
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
  // Links a teacher made for themselves are "device" links; the rest are invites.
  const created = await env.DB.prepare("SELECT created_by FROM invites WHERE token_hash = ?").bind(hash).first();
  return createSession(env, row.email, created?.created_by === row.email ? "device" : "invite", now);
}

// → { email } or null; { email, renewed: expiresAt } when this use extended it.
export async function sessionUser(env, session, now = Date.now()) {
  if (typeof session !== "string" || !/^[0-9a-f]{64}$/.test(session)) return null;
  const hash = await sha256Hex(session);
  const row = await env.DB.prepare("SELECT email, expires_at FROM sessions WHERE id_hash = ?").bind(hash).first();
  if (!row || row.expires_at < now) return null;
  if (row.expires_at > now + SESSION_TTL - RENEW_EVERY) return { email: row.email };
  const expiresAt = now + SESSION_TTL;
  await env.DB.prepare("UPDATE sessions SET expires_at = ? WHERE id_hash = ?").bind(expiresAt, hash).run();
  return { email: row.email, renewed: expiresAt };
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
