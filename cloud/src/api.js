// Editor host: the LabSite editor (static assets) plus /api/*, all behind
// Cloudflare Access. Bindings: DB (D1), BLOBS (R2), ASSETS (editor build).
import { Hono } from "hono";
import { currentUser } from "./auth.js";
import {
  COOKIE,
  SESSION_TTL,
  DEVICE_LINK_TTL,
  RESET_WINDOW,
  createInvite,
  redeemInvite,
  endSession,
  sessionCookie,
  readCookie,
  passwordLogin,
  passwordProblem,
  setPassword,
  hasPassword,
  checkPassword,
  sessionInfo,
} from "./sessions.js";
import { fromBase64, enc } from "./bytes.js";
import { contentType } from "./mime.js";
import { zip } from "./zip.js";
import { fetchRepoFiles, backupToGitHub, backupAll, parseRepo, githubToken, testGithubToken, backupAdminView, saveGithubToken } from "./github.js";
import { moveSitesOffSheets } from "./sheets.js";
import { applyPatches } from "./patches.js";
import { lookupReference, lookupOrcid, searchByTitle } from "./lookup.js";
import { parseOrcid } from "../../src/site/bibImport.js";
import { checkLinks } from "./links.js";
import { setSchedule, cancelSchedule, runSchedules } from "./schedule.js";
import { templateFiles, personalize, applySkin } from "./templates.js";
import { buildWizardSite } from "../../src/site/wizard.js";
import { enc as utf8enc, dec as utf8dec } from "./bytes.js";
import { adminOverview } from "./overview.js";
import { aiThemes, aiAssist, aiDescribePhoto, aiQuickNews, aiSitePlan, aiUsage, aiConfig, aiEnabledFor, aiAdminView, saveAiSettings, removeAiKey, testAiKey } from "./ai.js";
import {
  RepoError,
  isAdmin,
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
  getCommit,
  diffTrees,
  cleanPath,
  logEvent,
  getSettings,
  setSetting,
  roleOf,
  setMemberRole,
  ROLES,
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

// Applies the wizard's choices to template files (bytes ↔ text for the text ones).
const TEXT_FILE = /\.(html?|js|css|json|svg|txt|xml|md)$/i;
function wizardFiles(files, wizard) {
  const meta = files.find((f) => f.path === "labsite/template.json");
  let template = {};
  try {
    template = meta ? JSON.parse(utf8dec.decode(meta.bytes)) : {};
  } catch {
    template = {};
  }
  const texts = new Map(files.filter((f) => TEXT_FILE.test(f.path)).map((f) => [f.path, utf8dec.decode(f.bytes)]));
  const out = buildWizardSite(texts, template, wizard);
  return files.filter((f) => !TEXT_FILE.test(f.path) || out.has(f.path)).map((f) => (out.has(f.path) && out.get(f.path) !== texts.get(f.path) ? { ...f, bytes: utf8enc.encode(out.get(f.path)) } : f));
}

// An editor that has not written its presence row for this long has left.
const PRESENCE_TTL = 90 * 1000;

const commitView = (c, site) =>
  c && {
    id: c.id,
    short: c.id.slice(0, 7),
    parent: c.parent_id,
    author: c.author,
    message: c.message,
    changed: c.changed,
    at: c.created_at,
    auto: c.auto_since != null,
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
    if (!r)
      return c.json(
        { error: "這個登入連結無效、已經用過或已過期。如果你在別的電腦或手機已經登入，請在那裡按右上角「其他裝置登入」產生新的連結；否則請向管理者索取。" },
        401,
      );
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", sessionCookie(r.session, { maxAge: Math.floor(SESSION_TTL / 1000), secure }));
    return c.json({ email: r.email });
  });

  // Email + password, for people who set a password after their first link.
  app.post("/api/login/password", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const r = await passwordLogin(c.env, body.email, body.password);
    if (r.locked)
      return c.json({ error: "密碼錯太多次，這個帳號暫停 15 分鐘。忘記密碼的話，請管理者傳一條登入連結，登入後可以重設。" }, 429);
    if (!r.ok) return c.json({ error: "Email 或密碼不正確。還沒設定過密碼的話，請先用管理者傳的登入連結登入。" }, 401);
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", sessionCookie(r.session, { maxAge: Math.floor(SESSION_TTL / 1000), secure }));
    return c.json({ email: r.email });
  });

  app.use("/api/*", async (c, next) => {
    const user = await currentUser(c.req.raw, c.env, fetchImpl);
    if (!user) return c.json({ error: "請先登入。" }, 401);
    // A session used today keeps going for another 90 days: refresh the cookie too.
    if (user.renewedSession) {
      const secure = new URL(c.req.url).protocol === "https:";
      c.header("Set-Cookie", sessionCookie(user.renewedSession, { maxAge: Math.floor(SESSION_TTL / 1000), secure }));
      delete user.renewedSession;
    }
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
    const role = await roleOf(c.env, site, c.get("user").email);
    if (!role) return c.json({ error: "你沒有這個網站的編輯權限。" }, 403);
    c.set("site", site);
    c.set("role", role);
    await next();
  };
  app.use("/api/sites/:id", siteAccess);
  app.use("/api/sites/:id/*", siteAccess);

  /* ------------------------------------------------------------ me */
  app.get("/api/me", async (c) => {
    const user = c.get("user");
    const sites = await sitesFor(c.env, user.email);
    const ai = await aiConfig(c.env);
    return c.json({
      email: user.email,
      admin: user.admin,
      via: user.via,
      hasPassword: user.via === "session" ? await hasPassword(c.env, user.email) : false,
      ai: !!ai.key,
      aiOff: sites.filter((s) => ai.off.has(s.id)).map((s) => s.id),
      sites: await (async () => {
        const keys = sites.flatMap((s) => ["review:" + s.id, "schedule:" + s.id]);
        const extra = keys.length ? await getSettings(c.env, keys) : {};
        return sites.map((s) => ({
          ...siteView(c.env, s),
          role: ROLES.includes(s.role) ? s.role : "editor",
          review: JSON.parse(extra["review:" + s.id] || "null"),
          schedule: JSON.parse(extra["schedule:" + s.id] || "null"),
        }));
      })(),
    });
  });

  // DOI / PMID → reference metadata for 新增論文 (any signed-in editor).
  app.get("/api/lookup/reference", async (c) => c.json(await lookupReference(c.req.query("q"), fetchImpl)));
  app.get("/api/lookup/orcid", async (c) => c.json(await lookupOrcid(c.req.query("id"), fetchImpl)));
  app.get("/api/lookup/search", async (c) => c.json({ results: await searchByTitle(c.req.query("title"), c.req.query("year"), fetchImpl) }));

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

  // Set or change your password. Changing needs the current one, except right
  // after signing in with a link (that is how a forgotten password is reset).
  app.post("/api/password", async (c) => {
    const user = c.get("user");
    if (user.via !== "session") throw new RepoError(400, "這個網站用 Cloudflare Access 登入，不需要設定密碼。");
    const body = await c.req.json().catch(() => ({}));
    const problem = passwordProblem(body.password);
    if (problem) throw new RepoError(400, problem);
    if (await hasPassword(c.env, user.email)) {
      const info = await sessionInfo(c.env, readCookie(c.req.raw, COOKIE));
      const fromLink = info && ["invite", "device"].includes(info.via) && Date.now() - info.created_at < RESET_WINDOW;
      if (!fromLink) {
        const r = await checkPassword(c.env, user.email, body.current);
        if (r.locked) throw new RepoError(429, "目前的密碼錯太多次，請 15 分鐘後再試。");
        if (!r.ok) throw new RepoError(400, "目前的密碼不正確。忘記的話，請用登入連結登入後再重設。");
      }
    }
    await setPassword(c.env, user.email, body.password);
    return c.json({ ok: true });
  });

  // Sign in on another device: a 15-minute one-time link for yourself.
  app.post("/api/invites/self", async (c) => {
    const user = c.get("user");
    if (user.via === "access") throw new RepoError(400, "這個網站用 Cloudflare Access 登入，請在新裝置直接用 Email 登入。");
    const { token, expiresAt } = await createInvite(c.env, user.email, user.email, Date.now(), DEVICE_LINK_TTL);
    return c.json({ email: user.email, url: new URL(c.req.url).origin + "/?invite=" + token, expiresAt });
  });

  // 總覽: every site's state, the people, recent activity (admins only).
  app.get("/api/admin/overview", requireAdmin, async (c) => c.json(await adminOverview(c.env, siteView)));

  // AI 助手設定. The key goes in and never comes back out: every reply
  // carries only its last four characters.
  app.get("/api/admin/ai", requireAdmin, async (c) => c.json(await aiAdminView(c.env)));
  app.put("/api/admin/ai", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body.key !== undefined && c.env.ANTHROPIC_API_KEY)
      throw new RepoError(409, "金鑰目前由 Cloudflare 的 ANTHROPIC_API_KEY 設定提供，請到 Cloudflare 更換。");
    await saveAiSettings(c.env, { key: body.key, dailyLimit: body.dailyLimit, off: body.off }, c.get("user").email);
    return c.json(await aiAdminView(c.env));
  });
  app.delete("/api/admin/ai", requireAdmin, async (c) => {
    if (c.env.ANTHROPIC_API_KEY) throw new RepoError(409, "金鑰目前由 Cloudflare 的 ANTHROPIC_API_KEY 設定提供，請到 Cloudflare 移除。");
    await removeAiKey(c.env);
    return c.json(await aiAdminView(c.env));
  });
  // GitHub 備份: same pattern as the AI key (write-only, last 4 only).
  app.get("/api/admin/backup", requireAdmin, async (c) => c.json(await backupAdminView(c.env)));
  app.put("/api/admin/backup", requireAdmin, async (c) => {
    if (c.env.GITHUB_BACKUP_TOKEN) throw new RepoError(409, "權杖目前由 Cloudflare 的 GITHUB_BACKUP_TOKEN 設定提供，請到 Cloudflare 更換。");
    const body = await c.req.json().catch(() => ({}));
    await saveGithubToken(c.env, body.token, c.get("user").email);
    return c.json(await backupAdminView(c.env));
  });
  app.delete("/api/admin/backup", requireAdmin, async (c) => {
    if (c.env.GITHUB_BACKUP_TOKEN) throw new RepoError(409, "權杖目前由 Cloudflare 的 GITHUB_BACKUP_TOKEN 設定提供，請到 Cloudflare 移除。");
    await saveGithubToken(c.env, null);
    return c.json(await backupAdminView(c.env));
  });
  app.post("/api/admin/backup/test", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json(await testGithubToken(c.env, body.token, fetchImpl));
  });
  app.post("/api/admin/backup/run", requireAdmin, async (c) => {
    const done = await backupAll(c.env, fetchImpl);
    return c.json({ done, view: await backupAdminView(c.env) });
  });

  app.post("/api/admin/ai/test", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json(await testAiKey(c.env, body.key, fetchImpl));
  });

  /* ------------------------------------------- 建立網站精靈 (AI) */
  const wizardKey = async (c) => {
    const config = await aiConfig(c.env);
    if (!config.key) throw new RepoError(503, "AI 功能尚未設定（管理者需要在「平台設定」放入 API 金鑰）。");
    return config.key;
  };
  app.post("/api/admin/wizard/plan", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json(await aiSitePlan(c.env, body, fetchImpl, await wizardKey(c)));
  });
  app.post("/api/admin/wizard/themes", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({ themes: await aiThemes(c.env, body.description, fetchImpl, await wizardKey(c)) });
  });

  /* --------------------------------------------------------- sites */
  app.post("/api/sites", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body.template) {
      let files = personalize(applySkin(await templateFiles(c.env, c.req.url, body.template), body.skin), { name: body.name });
      // 建立網站精靈: the AI drafts, chosen pages, 研究室資料 and colours (wizard.js).
      if (body.wizard) files = wizardFiles(files, body.wizard);
      const site = await createSite(c.env, {
        slug: body.slug,
        name: body.name || body.slug,
        files,
        author: c.get("user").email,
        message: `從模板「${body.template}」建立網站` + (body.skin ? `（版型 ${body.skin}）` : ""),
        live: false,
        source: "template:" + body.template,
      });
      return c.json({ site: siteView(c.env, site), files: files.length }, 201);
    }
    const { owner, repo } = parseRepo(body.github);
    const { ref, files } = await fetchRepoFiles({
      owner,
      repo,
      branch: body.branch || "",
      token: await githubToken(c.env),
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
      auto: body.auto === true,
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

  // What 發布 would put live: the saved versions since the published one
  // (newest first, who made them and what they changed) and the files that differ.
  app.get("/api/sites/:id/pending", async (c) => {
    const site = c.get("site");
    if (!site.draft_commit || site.draft_commit === site.published_commit) return c.json({ commits: [], files: [] });
    const commits = [];
    for (let id = site.draft_commit, n = 0; id && id !== site.published_commit && n < 100; n++) {
      const commit = await getCommit(c.env, id);
      if (!commit) break;
      commits.push({ id: commit.id, short: commit.id.slice(0, 7), author: commit.author, message: commit.message, at: commit.created_at, changed: commit.changed });
      id = commit.parent_id;
    }
    const draft = await getCommit(c.env, site.draft_commit);
    const live = site.published_commit ? await getCommit(c.env, site.published_commit) : null;
    const files = diffTrees(await loadTree(c.env, live?.tree_id), await loadTree(c.env, draft.tree_id));
    return c.json({ commits, files });
  });

  app.post("/api/sites/:id/publish", async (c) => {
    const site = c.get("site");
    if (c.get("role") !== "editor") throw new RepoError(403, "這個網站要由老師核准後發布。請按「請老師發布」。");
    const body = await c.req.json().catch(() => ({}));
    await publish(c.env, site.id, body.commit, { actor: c.get("user").email });
    await setSetting(c.env, "review:" + site.id, null);
    await setSetting(c.env, "schedule:" + site.id, null);
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

  // Both AI features share one key, one daily cap per site and one on/off
  // switch per site (the admin's 「AI 助手設定」 page).
  const aiGate = async (c) => {
    const site = c.get("site");
    const config = await aiConfig(c.env);
    if (!config.key) throw new RepoError(503, "AI 功能尚未設定（管理者需要在「AI 助手設定」放入 API 金鑰）。");
    if (!aiEnabledFor(config, site.id)) throw new RepoError(403, "管理者沒有為這個網站開啟 AI 功能。");
    const used = await aiUsage(c.env, site.id);
    if (used >= config.dailyLimit)
      throw new RepoError(429, `這個網站今天的 AI 次數用完了（${used} 次），明天自動恢復。其他功能照常使用。`);
    return { site, config, remaining: config.dailyLimit - used - 1 };
  };

  // One sentence in, three contrast-checked themes out.
  app.post("/api/sites/:id/ai-theme", async (c) => {
    const { site, config, remaining } = await aiGate(c);
    const body = await c.req.json().catch(() => ({}));
    const themes = await aiThemes(c.env, body.description, fetchImpl, config.key);
    await logEvent(c.env, site.id, "ai_theme", null, c.get("user").email, String(body.description || "").slice(0, 300));
    return c.json({ themes, remaining });
  });

  // The editing assistant: proposals only; the editor applies what the teacher accepts.
  app.post("/api/sites/:id/assistant", async (c) => {
    const { site, config, remaining } = await aiGate(c);
    const body = await c.req.json().catch(() => ({}));
    const result = await aiAssist(c.env, body, fetchImpl, config.key);
    await logEvent(c.env, site.id, "ai_assist", null, c.get("user").email, String(body.message || "").slice(0, 300));
    return c.json({ ...result, remaining });
  });

  // 請老師發布: someone who may not publish asks the site's teachers to look
  // and publish; a teacher may send it back with a note. One request per
  // site, cleared when the site is published.
  app.post("/api/sites/:id/review", async (c) => {
    const site = c.get("site");
    const body = await c.req.json().catch(() => ({}));
    if (!site.draft_commit || site.draft_commit === site.published_commit) throw new RepoError(400, "沒有還沒發布的修改。");
    const review = { status: "waiting", by: c.get("user").email, note: String(body.note || "").slice(0, 500), at: Date.now(), draft: site.draft_commit };
    await setSetting(c.env, "review:" + site.id, JSON.stringify(review), c.get("user").email);
    await logEvent(c.env, site.id, "review_request", site.draft_commit, c.get("user").email, review.note);
    return c.json({ review });
  });
  app.post("/api/sites/:id/review/return", async (c) => {
    const site = c.get("site");
    if (c.get("role") !== "editor") throw new RepoError(403, "只有老師可以退回。");
    const key = "review:" + site.id;
    const current = JSON.parse((await getSettings(c.env, [key]))[key] || "null");
    if (!current) throw new RepoError(404, "沒有等待核准的修改。");
    const body = await c.req.json().catch(() => ({}));
    const review = { ...current, status: "returned", reply: String(body.note || "").slice(0, 500), replyBy: c.get("user").email, replyAt: Date.now() };
    await setSetting(c.env, key, JSON.stringify(review), c.get("user").email);
    await logEvent(c.env, site.id, "review_return", site.draft_commit, c.get("user").email, review.reply);
    return c.json({ review });
  });

  // 排程發布 (schedule.js): teachers only, like 發布.
  app.put("/api/sites/:id/schedule", async (c) => {
    if (c.get("role") !== "editor") throw new RepoError(403, "這個網站要由老師核准後發布。");
    const body = await c.req.json().catch(() => ({}));
    return c.json({ schedule: await setSchedule(c.env, c.get("site"), body.at, c.get("user").email) });
  });
  app.delete("/api/sites/:id/schedule", async (c) => {
    if (c.get("role") !== "editor") throw new RepoError(403, "只有老師可以取消預約。");
    await cancelSchedule(c.env, c.get("site"), c.get("user").email);
    return c.json({ schedule: null });
  });

  // 網站造訪統計: daily views and the most visited pages (sites.js countView).
  app.get("/api/sites/:id/stats", async (c) => {
    const site = c.get("site");
    const days = Math.min(Math.max(Number(c.req.query("days")) || 30, 7), 365);
    const day = (ms) => new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);
    const now = Date.now();
    const from = day(now - (days - 1) * 86400000);
    const prevFrom = day(now - (2 * days - 1) * 86400000);
    const daily = (await c.env.DB.prepare("SELECT day, SUM(views) AS views FROM page_views WHERE site_id = ? AND day >= ? GROUP BY day ORDER BY day").bind(site.id, from).all()).results;
    const pages = (
      await c.env.DB.prepare("SELECT path, SUM(views) AS views FROM page_views WHERE site_id = ? AND day >= ? GROUP BY path ORDER BY views DESC LIMIT 10").bind(site.id, from).all()
    ).results;
    const prev = await c.env.DB.prepare("SELECT COALESCE(SUM(views), 0) AS views FROM page_views WHERE site_id = ? AND day >= ? AND day < ?").bind(site.id, prevFrom, from).first();
    return c.json({ days, from, daily, pages, total: daily.reduce((n, d) => n + d.views, 0), previous: prev?.views || 0 });
  });

  // Who else is editing: the caller's heartbeat in, everyone else seen in the
  // last 90 seconds out. page null means the caller left.
  app.post("/api/sites/:id/presence", async (c) => {
    const site = c.get("site");
    const me = c.get("user").email;
    const body = await c.req.json().catch(() => ({}));
    const now = Date.now();
    const page = body.page == null ? null : String(body.page).slice(0, 200);
    if (body.leave) await c.env.DB.prepare("DELETE FROM presence WHERE site_id = ? AND email = ?").bind(site.id, me).run();
    else
      await c.env.DB.prepare(
        "INSERT INTO presence (site_id, email, page, at) VALUES (?, ?, ?, ?) ON CONFLICT(site_id, email) DO UPDATE SET page = excluded.page, at = excluded.at",
      )
        .bind(site.id, me, page, now)
        .run();
    const { results } = await c.env.DB.prepare("SELECT email, page, at FROM presence WHERE site_id = ? AND email != ? AND at > ? ORDER BY email")
      .bind(site.id, me, now - PRESENCE_TTL)
      .all();
    return c.json({ others: results });
  });

  // 發布前檢查: outside links on the changed pages (links.js).
  app.post("/api/sites/:id/check-links", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json({ results: await checkLinks(body.urls, fetchImpl) });
  });

  // The lab's ORCID iD, shared by everyone who edits the site: the editor
  // compares the ORCID record with the publication pages.
  app.get("/api/sites/:id/orcid", async (c) => {
    const key = "orcid:" + c.get("site").id;
    return c.json({ orcid: (await getSettings(c.env, [key]))[key] || null });
  });
  app.put("/api/sites/:id/orcid", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const raw = String(body.orcid ?? "").trim();
    const orcid = raw ? parseOrcid(raw) : null;
    if (raw && !orcid) throw new RepoError(400, "看不懂這個 ORCID。格式像 0000-0002-1825-0097，可以直接貼 ORCID 網址。");
    await setSetting(c.env, "orcid:" + c.get("site").id, orcid, c.get("user").email);
    return c.json({ orcid });
  });

  // 活動快報: a sentence (and a photo) → a news draft in both languages.
  app.post("/api/sites/:id/quick-news", async (c) => {
    const { site, config, remaining } = await aiGate(c);
    const body = await c.req.json().catch(() => ({}));
    const result = await aiQuickNews(c.env, body, fetchImpl, config.key);
    await logEvent(c.env, site.id, "ai_news", null, c.get("user").email, String(body.text || "").slice(0, 200));
    return c.json({ ...result, remaining });
  });

  // 照片說明與替代文字 (vision): suggestions only.
  app.post("/api/sites/:id/describe-photo", async (c) => {
    const { site, config, remaining } = await aiGate(c);
    const body = await c.req.json().catch(() => ({}));
    const result = await aiDescribePhoto(c.env, body, fetchImpl, config.key);
    await logEvent(c.env, site.id, "ai_photo", null, c.get("user").email, String(body.note || "").slice(0, 200));
    return c.json({ ...result, remaining });
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

  app.put("/api/sites/:id/members/:email", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    await setMemberRole(c.env, c.get("site").id, decodeURIComponent(c.req.param("email")), body.role, c.get("user").email);
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

// Workers entry: the API and editor, plus the hourly backup (wrangler.api.toml [triggers]).
const app = createApp();
export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
  // Every 10 minutes: 排程發布 (schedule.js). Hourly (minute 17) also: move
  // sites off Google Sheets, apply one-off site fixes (patches.js), then back up to GitHub.
  scheduled: (event, env, ctx) =>
    ctx.waitUntil(
      event.cron === "*/10 * * * *"
        ? runSchedules(env).catch(() => [])
        : runSchedules(env)
            .catch(() => [])
            .then(() => moveSitesOffSheets(env).catch(() => []))
            .then(() => applyPatches(env).catch(() => []))
            .then(() => backupAll(env)),
    ),
};
