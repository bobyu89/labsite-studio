// Editor host: the LabSite editor (static assets) plus /api/*, all behind
// Cloudflare Access. Bindings: DB (D1), BLOBS (R2), ASSETS (editor build).
import { Hono } from "hono";
import { currentUser } from "./auth.js";
import { COOKIE, SESSION_TTL, createInvite, redeemInvite, endSession, sessionCookie, readCookie } from "./sessions.js";
import { fromBase64, enc } from "./bytes.js";
import { contentType } from "./mime.js";
import { zip } from "./zip.js";
import { fetchRepoFiles, backupToGitHub, parseRepo } from "./github.js";
import {
  RepoError,
  isAdmin,
  canEdit,
  sitesFor,
  getSite,
  resolveRef,
  blobStream,
  getBlob,
  commitChanges,
  restoreCommit,
  publish,
  history,
  createSite,
  addMember,
  removeMember,
  membersOf,
  loadTree,
  cleanPath,
} from "./repo.js";

export const publicUrl = (env, slug) =>
  env.SITE_URL_TEMPLATE ? env.SITE_URL_TEMPLATE.replace("{slug}", slug) : null;

export const siteView = (env, s) => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  draft: s.draft_commit,
  published: s.published_commit,
  unpublished: !!s.draft_commit && s.draft_commit !== s.published_commit,
  url: publicUrl(env, s.slug),
  github: s.github_repo,
  backup: { status: s.backup_status, error: s.backup_error, at: s.backup_at },
});

const commitView = (c, site) =>
  c && {
    id: c.id,
    short: c.id.slice(0, 7),
    parent: c.parent_id,
    author: c.author,
    message: c.message,
    changed: c.changed,
    at: c.created_at,
    published: site ? c.id === site.published_commit : undefined,
    draft: site ? c.id === site.draft_commit : undefined,
  };

const MAX_MESSAGE = 200;
const message = (m, fallback) => String(m || fallback).replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE);

// Runs `p` after the response when the platform allows it (Workers), inline otherwise (tests).
function later(c, p) {
  try {
    c.executionCtx.waitUntil(p);
  } catch {
    return p;
  }
}

export function createApp({ fetchImpl = (...a) => fetch(...a) } = {}) {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof RepoError) return c.json({ error: err.message, ...err.extra }, err.status);
    console.error(err);
    return c.json({ error: "伺服器發生錯誤：" + (err.message || err) }, 500);
  });

  /* ---------------------------------------------------------- auth */
  app.use("/api/*", async (c, next) => {
    // Changes must come from the editor page itself: a browser always sends
    // Origin on POST/DELETE, and a site preview (sandboxed, "null") or any
    // other website sends something else.
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      const origin = c.req.header("Origin");
      if (origin && origin !== new URL(c.req.url).origin)
        return c.json({ error: "拒絕來自其他網頁的修改請求。" }, 403);
    }
    c.header("Cache-Control", "no-store");
    await next();
  });

  // The one route that works signed out: trade a one-time invite link for a session.
  app.post("/api/login", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const r = await redeemInvite(c.env, body.invite);
    if (!r) return c.json({ error: "這個登入連結無效、已經用過或已過期，請向管理者索取新的連結。" }, 401);
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", sessionCookie(r.session, { maxAge: Math.floor(SESSION_TTL / 1000), secure }));
    return c.json({ email: r.email });
  });

  app.use("/api/*", async (c, next) => {
    const user = await currentUser(c.req.raw, c.env, fetchImpl);
    if (!user) return c.json({ error: "請先登入。" }, 401);
    user.admin = isAdmin(c.env, user.email);
    c.set("user", user);
    c.header("Cache-Control", "no-store");
    await next();
  });

  const requireAdmin = async (c, next) => {
    if (!c.get("user").admin) return c.json({ error: "只有管理者可以做這件事。" }, 403);
    await next();
  };

  const siteAccess = async (c, next) => {
    const site = await getSite(c.env, c.req.param("id"));
    if (!site) return c.json({ error: "找不到這個網站。" }, 404);
    if (!(await canEdit(c.env, site, c.get("user").email))) return c.json({ error: "你沒有這個網站的編輯權限。" }, 403);
    c.set("site", site);
    await next();
  };
  app.use("/api/sites/:id", siteAccess);
  app.use("/api/sites/:id/*", siteAccess);

  /* ------------------------------------------------------------ me */
  app.get("/api/me", async (c) => {
    const user = c.get("user");
    const sites = await sitesFor(c.env, user.email);
    return c.json({ email: user.email, admin: user.admin, via: user.via, sites: sites.map((s) => siteView(c.env, s)) });
  });

  app.post("/api/logout", async (c) => {
    await endSession(c.env, readCookie(c.req.raw, COOKIE));
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", sessionCookie("", { maxAge: 0, secure }));
    return c.json({ via: c.get("user").via });
  });

  app.post("/api/invites", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RepoError(400, "Email 格式不正確：" + (body.email || ""));
    const { token, expiresAt } = await createInvite(c.env, email, c.get("user").email);
    const url = new URL(c.req.url).origin + "/?invite=" + token;
    return c.json({ email, url, expiresAt });
  });

  /* --------------------------------------------------------- sites */
  app.post("/api/sites", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { owner, repo } = parseRepo(body.github);
    const { ref, files } = await fetchRepoFiles({
      owner,
      repo,
      branch: body.branch || "",
      token: c.env.GITHUB_BACKUP_TOKEN,
      fetchImpl,
    });
    const site = await createSite(c.env, {
      slug: body.slug || repo,
      name: body.name || repo,
      files,
      author: c.get("user").email,
      message: `從 GitHub 匯入 ${owner}/${repo}@${ref}`,
      githubRepo: `${owner}/${repo}`,
      githubBranch: ref,
    });
    return c.json({ site: siteView(c.env, site), files: files.length }, 201);
  });

  app.get("/api/sites/:id", async (c) => {
    const site = c.get("site");
    const out = { site: siteView(c.env, site) };
    if (c.get("user").admin) out.members = await membersOf(c.env, site.id);
    return c.json(out);
  });

  app.get("/api/sites/:id/tree", async (c) => {
    const site = c.get("site");
    const { commit, tree } = await resolveRef(c.env, site, c.req.query("ref") || "draft");
    return c.json({
      commit: commitView(commit, site),
      entries: [...tree].map(([path, e]) => ({ path, hash: e.hash, size: e.size })),
    });
  });

  app.get("/api/sites/:id/files/*", async (c) => {
    const site = c.get("site");
    const raw = new URL(c.req.url).pathname.split("/files/").slice(1).join("/files/");
    const path = cleanPath(decodeURIComponent(raw));
    const { tree } = await resolveRef(c.env, site, c.req.query("ref") || "draft");
    const entry = tree.get(path);
    if (!entry) return c.json({ error: "找不到檔案：" + path }, 404);
    const etag = `"${entry.hash}"`;
    if (c.req.header("If-None-Match") === etag) return c.body(null, 304);
    const body = await blobStream(c.env, entry.hash);
    if (!body) return c.json({ error: "檔案內容遺失：" + path }, 500);
    return new Response(body, {
      headers: {
        "Content-Type": contentType(path),
        ETag: etag,
        "X-Content-Hash": entry.hash,
        "Cache-Control": "private, no-cache",
      },
    });
  });

  app.post("/api/sites/:id/commits", async (c) => {
    const site = c.get("site");
    const body = await c.req.json().catch(() => null);
    if (!body || !Array.isArray(body.files)) throw new RepoError(400, "保存內容格式不正確。");
    const files = body.files.map((f) => {
      if (f.delete) return { path: f.path, delete: true };
      if (typeof f.text === "string") return { path: f.path, bytes: enc.encode(f.text) };
      if (typeof f.base64 === "string") return { path: f.path, bytes: fromBase64(f.base64) };
      throw new RepoError(400, "檔案缺少內容：" + f.path);
    });
    const result = await commitChanges(c.env, site.id, {
      files,
      base: body.base || {},
      author: c.get("user").email,
      message: message(body.message, `更新 ${files.length} 個檔案`),
    });
    const fresh = await getSite(c.env, site.id);
    const tree = await loadTree(c.env, result.commit.tree_id);
    const hashes = Object.fromEntries(files.map((f) => [cleanPath(f.path), tree.get(cleanPath(f.path))?.hash ?? null]));
    return c.json({
      commit: commitView(result.commit, fresh),
      changed: result.changed,
      noop: result.noop,
      hashes,
      site: siteView(c.env, fresh),
    });
  });

  app.get("/api/sites/:id/history", async (c) => {
    const site = c.get("site");
    const limit = Number(c.req.query("limit") || 50);
    const commits = site.draft_commit ? await history(c.env, site, limit) : [];
    return c.json({ commits: commits.map((x) => commitView(x, site)), site: siteView(c.env, site) });
  });

  app.post("/api/sites/:id/publish", async (c) => {
    const site = c.get("site");
    const body = await c.req.json().catch(() => ({}));
    await publish(c.env, site.id, body.commit, { actor: c.get("user").email });
    const inline = later(c, backupToGitHub(c.env, site.id, fetchImpl));
    if (inline) await inline;
    return c.json({ site: siteView(c.env, await getSite(c.env, site.id)) });
  });

  app.post("/api/sites/:id/restore", async (c) => {
    const site = c.get("site");
    const body = await c.req.json().catch(() => ({}));
    if (!body.commit) throw new RepoError(400, "請指定要還原的版本。");
    const result = await restoreCommit(c.env, site.id, body.commit, { author: c.get("user").email });
    const fresh = await getSite(c.env, site.id);
    return c.json({ commit: commitView(result.commit, fresh), changed: result.changed, noop: result.noop, site: siteView(c.env, fresh) });
  });

  app.get("/api/sites/:id/export", async (c) => {
    const site = c.get("site");
    const { commit, tree } = await resolveRef(c.env, site, c.req.query("ref") || "draft");
    const files = [];
    for (const [path, e] of tree) files.push({ path, bytes: await getBlob(c.env, e.hash) });
    const name = `${site.slug}-${commit ? commit.id.slice(0, 7) : "empty"}.zip`;
    return new Response(zip(files), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  });

  /* ------------------------------------------------- admin per site */
  app.post("/api/sites/:id/members", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    await addMember(c.env, c.get("site").id, body.email, c.get("user").email);
    return c.json({ members: await membersOf(c.env, c.get("site").id) });
  });

  app.delete("/api/sites/:id/members/:email", requireAdmin, async (c) => {
    await removeMember(c.env, c.get("site").id, decodeURIComponent(c.req.param("email")), c.get("user").email);
    return c.json({ members: await membersOf(c.env, c.get("site").id) });
  });

  app.post("/api/sites/:id/backup", requireAdmin, async (c) => {
    const status = await backupToGitHub(c.env, c.get("site").id, fetchImpl);
    return c.json({ status, site: siteView(c.env, await getSite(c.env, c.get("site").id)) });
  });

  app.all("/api/*", (c) => c.json({ error: "沒有這個 API。" }, 404));

  /* ------------------------------------------------------ the editor */
  app.all("*", (c) => (c.env.ASSETS ? c.env.ASSETS.fetch(c.req.raw) : c.text("LabSite Cloud API", 200)));

  return app;
}

export default createApp();
