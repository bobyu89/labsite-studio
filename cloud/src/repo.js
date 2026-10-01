// A small git: content-addressed blobs in R2, trees and commits in D1, and two
// pointers per site (draft, published). Every save is a commit on top of the
// current draft; publishing moves the published pointer; restoring makes a new
// commit whose tree is an older one, so history is never rewritten.
//
// Concurrency: a save names, per file, the hash it started from. If the draft
// has a different hash for that file now, the save is refused and the paths
// are reported. Saves touching different files merge naturally. The pointer
// move is a compare-and-swap (UPDATE … WHERE draft_commit IS <head we read>),
// retried when another save slipped in between.
import { enc, sha256Hex, randomId } from "./bytes.js";

export class RepoError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/* -------------------------------------------------------------- paths */
export function cleanPath(path) {
  const p = String(path || "").replace(/\\/g, "/").replace(/^\.\//, "");
  const parts = p.split("/");
  if (
    !p ||
    p.startsWith("/") ||
    parts.some((s) => s === "" || s === "." || s === "..") ||
    /[\u0000-\u001f]/.test(p) ||
    p.length > 400
  )
    throw new RepoError(400, "不合法的檔案路徑：" + path);
  return p;
}

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const RESERVED = new Set(["api", "www", "studio", "admin", "assets", "static", "cdn", "mail"]);
export function cleanSlug(slug) {
  const s = String(slug || "").trim().toLowerCase();
  if (!SLUG_RE.test(s) || RESERVED.has(s))
    throw new RepoError(400, "網址代稱只能用小寫英文、數字與連字號，且不能是保留字：" + slug);
  return s;
}

/* -------------------------------------------------------------- blobs */
const blobKey = (hash) => "b/" + hash;

export async function putBlob(env, bytes) {
  const hash = await sha256Hex(bytes);
  if (!(await env.BLOBS.head(blobKey(hash)))) await env.BLOBS.put(blobKey(hash), bytes);
  return { hash, size: bytes.byteLength };
}

export async function getBlob(env, hash) {
  const obj = await env.BLOBS.get(blobKey(hash));
  return obj ? new Uint8Array(await obj.arrayBuffer()) : null;
}

export const getBlobObject = (env, hash) => env.BLOBS.get(blobKey(hash));

/* -------------------------------------------------------------- trees */
// Trees are immutable, so a per-isolate cache is always correct.
const treeCache = new Map();
const TREE_CACHE_MAX = 64;

export async function saveTree(env, map) {
  const entries = [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, e]) => [path, e.hash, e.size]);
  const json = JSON.stringify(entries);
  const id = await sha256Hex(json);
  await env.DB.prepare("INSERT OR IGNORE INTO trees (id, entries) VALUES (?, ?)").bind(id, json).run();
  return id;
}

export async function loadTree(env, id) {
  if (!id) return new Map();
  if (treeCache.has(id)) return new Map(treeCache.get(id));
  const row = await env.DB.prepare("SELECT entries FROM trees WHERE id = ?").bind(id).first();
  if (!row) throw new RepoError(500, "找不到版本資料 " + id.slice(0, 7));
  const map = new Map(JSON.parse(row.entries).map(([path, hash, size]) => [path, { hash, size }]));
  if (treeCache.size >= TREE_CACHE_MAX) treeCache.delete(treeCache.keys().next().value);
  treeCache.set(id, map);
  return new Map(map);
}

export function diffTrees(from, to) {
  const changed = [];
  for (const [path, e] of to) {
    const old = from.get(path);
    if (!old) changed.push([path, "added"]);
    else if (old.hash !== e.hash) changed.push([path, "modified"]);
  }
  for (const path of from.keys()) if (!to.has(path)) changed.push([path, "deleted"]);
  return changed.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/* ------------------------------------------------------ sites/commits */
const parseCommit = (row) => row && { ...row, changed: JSON.parse(row.changed || "[]") };

export async function getSite(env, idOrSlug) {
  return env.DB.prepare("SELECT * FROM sites WHERE id = ? OR slug = ?").bind(idOrSlug, idOrSlug).first();
}

export async function getCommit(env, id) {
  if (!id) return null;
  return parseCommit(await env.DB.prepare("SELECT * FROM commits WHERE id = ?").bind(id).first());
}

export async function commitTree(env, siteId, commitId) {
  const commit = await getCommit(env, commitId);
  if (!commit || commit.site_id !== siteId) throw new RepoError(404, "找不到這個版本。");
  return { commit, tree: await loadTree(env, commit.tree_id) };
}

// Resolves "draft", "published" or a commit id to { commit, tree }.
export async function resolveRef(env, site, ref = "draft") {
  const id = ref === "draft" ? site.draft_commit : ref === "published" ? site.published_commit : ref;
  if (!id) return { commit: null, tree: new Map() };
  return commitTree(env, site.id, id);
}

// Moves the draft forward. `build(tree, head)` returns the new tree (a Map)
// or throws; it is re-run against the fresh head if another save won the race.
async function advanceDraft(env, siteId, { author, message, now }, build) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const site = await getSite(env, siteId);
    if (!site) throw new RepoError(404, "找不到這個網站。");
    const head = site.draft_commit;
    const base = head ? (await getCommit(env, head)).tree_id : null;
    const before = await loadTree(env, base);
    const after = await build(new Map(before), head);
    const changed = diffTrees(before, after);
    if (!changed.length) return { commit: await getCommit(env, head), changed, noop: true };
    const treeId = await saveTree(env, after);
    const at = now ?? Date.now();
    const id = await sha256Hex(JSON.stringify([siteId, head, treeId, author, message, at, randomId()]));
    const [, update] = await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO commits (id, site_id, parent_id, tree_id, author, message, changed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(id, siteId, head, treeId, author, message, JSON.stringify(changed), at),
      env.DB.prepare("UPDATE sites SET draft_commit = ? WHERE id = ? AND draft_commit IS ?").bind(id, siteId, head),
    ]);
    if (update.meta.changes === 1) return { commit: await getCommit(env, id), changed, noop: false };
  }
  throw new RepoError(503, "目前太多人同時保存，請再試一次。");
}

// files: [{ path, bytes } | { path, delete: true }]
// base:  { [path]: hash | null } — what the editor loaded; null means "did not exist".
export async function commitChanges(env, siteId, { files, base = {}, author, message, now }) {
  if (!Array.isArray(files) || !files.length) throw new RepoError(400, "沒有要保存的檔案。");
  const prepared = [];
  for (const f of files) {
    const path = cleanPath(f.path);
    if (f.delete) prepared.push({ path, delete: true });
    else prepared.push({ path, ...(await putBlob(env, f.bytes)) });
  }
  const expected = new Map(Object.entries(base).map(([p, h]) => [cleanPath(p), h ?? null]));
  return advanceDraft(env, siteId, { author, message, now }, (tree) => {
    const conflicts = [];
    for (const f of prepared) {
      if (!expected.has(f.path)) continue;
      const current = tree.get(f.path)?.hash ?? null;
      // Someone else already wrote exactly what we are writing: not a conflict.
      if (current !== expected.get(f.path) && current !== (f.delete ? null : f.hash)) conflicts.push(f.path);
    }
    if (conflicts.length)
      throw new RepoError(409, "這些檔案已被其他人更新，請重新開啟後再改：" + conflicts.join("、"), { conflicts });
    for (const f of prepared) {
      if (f.delete) tree.delete(f.path);
      else tree.set(f.path, { hash: f.hash, size: f.size });
    }
    return tree;
  });
}

export async function restoreCommit(env, siteId, commitId, { author, now }) {
  const { commit, tree } = await commitTree(env, siteId, commitId);
  const result = await advanceDraft(
    env,
    siteId,
    { author, message: `還原到 ${commit.id.slice(0, 7)}（${commit.message}）`, now },
    () => tree,
  );
  await logEvent(env, siteId, "restore", result.commit?.id, author, commit.id, now);
  return result;
}

export async function publish(env, siteId, commitId, { actor, now }) {
  const site = await getSite(env, siteId);
  if (!site) throw new RepoError(404, "找不到這個網站。");
  const id = commitId || site.draft_commit;
  if (!id) throw new RepoError(400, "這個網站還沒有任何版本。");
  await commitTree(env, siteId, id); // must belong to this site
  await env.DB.prepare("UPDATE sites SET published_commit = ? WHERE id = ?").bind(id, siteId).run();
  await logEvent(env, siteId, "publish", id, actor, null, now);
  return getSite(env, siteId);
}

export async function history(env, site, limit = 50) {
  const { results } = await env.DB.prepare(
    `WITH RECURSIVE chain(id, n) AS (
       SELECT ?, 0
       UNION ALL
       SELECT c.parent_id, chain.n + 1 FROM commits c JOIN chain ON c.id = chain.id
       WHERE c.parent_id IS NOT NULL AND chain.n + 1 < ?
     )
     SELECT commits.* FROM chain JOIN commits ON commits.id = chain.id ORDER BY chain.n`,
  )
    .bind(site.draft_commit, Math.min(Math.max(limit, 1), 200))
    .all();
  return results.map(parseCommit);
}

/* ------------------------------------------------------- create/import */
export async function createSite(env, { slug, name, files, author, message, githubRepo, githubBranch, now }) {
  const s = cleanSlug(slug);
  if (await getSite(env, s)) throw new RepoError(409, "這個網址代稱已經有人使用：" + s);
  const id = randomId(6);
  const at = now ?? Date.now();
  await env.DB.prepare(
    "INSERT INTO sites (id, slug, name, github_repo, github_branch, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, s, String(name || s).slice(0, 80), githubRepo || null, githubBranch || null, at)
    .run();
  const { commit } = await commitChanges(env, id, { files, author, message, now: at });
  // An imported site is already live elsewhere and already on GitHub.
  await env.DB.prepare(
    "UPDATE sites SET published_commit = ?, backup_commit = ?, backup_status = ?, backup_at = ? WHERE id = ?",
  )
    .bind(commit.id, githubRepo ? commit.id : null, githubRepo ? "ok" : null, githubRepo ? at : null, id)
    .run();
  await logEvent(env, id, "import", commit.id, author, githubRepo || null, at);
  return getSite(env, id);
}

/* ------------------------------------------------------------- members */
export const isAdmin = (env, email) =>
  String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(String(email || "").toLowerCase());

export async function canEdit(env, site, email) {
  if (isAdmin(env, email)) return true;
  const row = await env.DB.prepare("SELECT 1 AS ok FROM members WHERE site_id = ? AND email = ?")
    .bind(site.id, String(email).toLowerCase())
    .first();
  return !!row;
}

export async function sitesFor(env, email) {
  const q = isAdmin(env, email)
    ? env.DB.prepare("SELECT * FROM sites ORDER BY name")
    : env.DB.prepare(
        "SELECT sites.* FROM sites JOIN members ON members.site_id = sites.id WHERE members.email = ? ORDER BY sites.name",
      ).bind(String(email).toLowerCase());
  return (await q.all()).results;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function addMember(env, siteId, email, actor, now) {
  const e = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(e)) throw new RepoError(400, "Email 格式不正確：" + email);
  await env.DB.prepare("INSERT OR IGNORE INTO members (site_id, email, role, added_at) VALUES (?, ?, 'editor', ?)")
    .bind(siteId, e, now ?? Date.now())
    .run();
  await logEvent(env, siteId, "member_add", null, actor, e, now);
}

export async function removeMember(env, siteId, email, actor, now) {
  const e = String(email || "").trim().toLowerCase();
  await env.DB.prepare("DELETE FROM members WHERE site_id = ? AND email = ?").bind(siteId, e).run();
  await logEvent(env, siteId, "member_remove", null, actor, e, now);
}

export async function membersOf(env, siteId) {
  return (await env.DB.prepare("SELECT email, role, added_at FROM members WHERE site_id = ? ORDER BY email").bind(siteId).all())
    .results;
}

/* -------------------------------------------------------------- events */
export async function logEvent(env, siteId, kind, commitId, actor, detail, now) {
  await env.DB.prepare(
    "INSERT INTO events (site_id, kind, commit_id, actor, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(siteId, kind, commitId || null, actor, detail || null, now ?? Date.now())
    .run();
}

export const utf8 = (text) => enc.encode(text);
