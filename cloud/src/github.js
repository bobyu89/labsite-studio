// GitHub on the server side, used twice:
//   import  — one tarball download pulls a whole repository into a new site
//   backup  — after each publish, mirror what changed onto the repo as one
//             commit (best effort; the cloud copy is the source of truth)
import { toBase64 } from "./bytes.js";
import { parseTar, stripTopDir, gunzip } from "./tar.js";
import { RepoError, loadTree, getCommit, getBlob, diffTrees, getSite, getSettings, setSetting } from "./repo.js";

/* ------------------------------------------------------- backup token */
// The token that writes backups (and reads private repositories on import):
// the worker's GITHUB_BACKUP_TOKEN secret when set, otherwise the one the
// admin pasted in 平台設定 (stored in D1, never returned by the API).
export async function githubToken(env) {
  if (env.GITHUB_BACKUP_TOKEN) return env.GITHUB_BACKUP_TOKEN;
  return (await getSettings(env, ["github_token"])).github_token || "";
}

const cleanToken = (value) => {
  const t = String(value || "").trim();
  if (!/^(github_pat_[A-Za-z0-9_]{20,255}|gh[pousr]_[A-Za-z0-9]{20,255})$/.test(t))
    throw new RepoError(400, "這看起來不是 GitHub 的存取權杖。權杖以 github_pat_ 或 ghp_ 開頭，請整串貼上。");
  return t;
};

// Checks a token against each site's backup repository: can it write there?
const NO_WRITE = "權杖沒有寫入權限：到 GitHub 編輯這把權杖，Permissions › Contents 改成 Read and write";

export async function testGithubToken(env, candidate, fetchImpl = fetch) {
  const token = candidate ? cleanToken(candidate) : await githubToken(env);
  if (!token) throw new RepoError(400, "還沒有設定權杖。");
  const { results } = await env.DB.prepare("SELECT slug, github_repo FROM sites WHERE github_repo IS NOT NULL ORDER BY slug").all();
  const repos = [];
  for (const r of results) {
    const res = await fetchImpl(`https://api.github.com/repos/${r.github_repo}`, {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "LabSite" },
    }).catch(() => null);
    if (res?.status === 401) return { ok: false, error: "權杖無效或已過期，請重新建立一把。", repos: [] };
    if (!res?.ok) {
      repos.push({ repo: r.github_repo, ok: false, error: "權杖看不到這個儲存庫（Repository access 沒有選它）" });
      continue;
    }
    // The repository's `permissions` field describes the account, not the
    // token: a fine-grained token with Contents "Read-only" still shows
    // push: true. So try what the backup does first — create a blob. The
    // empty blob already exists in nearly every repository, so this leaves
    // nothing behind.
    const probe = await fetchImpl(`https://api.github.com/repos/${r.github_repo}/git/blobs`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "LabSite", "Content-Type": "application/json" },
      body: JSON.stringify({ content: "", encoding: "utf-8" }),
    }).catch(() => null);
    const ok = !!probe?.ok;
    repos.push({ repo: r.github_repo, ok, error: ok ? null : NO_WRITE });
  }
  return { ok: repos.every((r) => r.ok), last4: token.slice(-4), repos };
}

export async function backupAdminView(env) {
  const stored = (await getSettings(env, ["github_token"])).github_token || "";
  const token = env.GITHUB_BACKUP_TOKEN || stored;
  const { results } = await env.DB.prepare("SELECT slug, name, github_repo, backup_status, backup_error, backup_at FROM sites ORDER BY name").all();
  return {
    configured: !!token,
    source: env.GITHUB_BACKUP_TOKEN ? "env" : stored ? "settings" : null,
    last4: token ? token.slice(-4) : null,
    sites: results.map((s) => ({ slug: s.slug, name: s.name, repo: s.github_repo, status: s.backup_status, error: s.backup_error, at: s.backup_at })),
  };
}

export async function saveGithubToken(env, value, actor) {
  if (value === null) return setSetting(env, "github_token", null);
  await setSetting(env, "github_token", cleanToken(value), actor);
  // Sites marked "skipped" for want of a token get backed up on the next run.
  await env.DB.prepare("UPDATE sites SET backup_status = NULL WHERE backup_status = 'skipped'").run();
}

const API = "https://api.github.com";
const MAX_IMPORT_FILE = 20 * 1024 * 1024;
// Workers on the free plan may make 50 outbound requests per invocation; a
// backup needs 5 plus one per changed file.
export const BACKUP_BATCH = 40;

const headers = (token, extra = {}) => ({
  "User-Agent": "labsite-cloud",
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: "Bearer " + token } : {}),
  ...extra,
});

export function parseRepo(text) {
  const m = String(text || "")
    .trim()
    .match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (!m) throw new RepoError(400, "GitHub 儲存庫格式應為 owner/name：" + text);
  return { owner: m[1], repo: m[2] };
}

// Why GitHub said no, in words a teacher-admin can act on.
async function explain(res, what) {
  let detail = "";
  try {
    detail = (await res.json()).message || "";
  } catch {
    /* not JSON */
  }
  if (res.status === 404) return new RepoError(404, `找不到 GitHub 儲存庫 ${what}，請確認名稱，私人儲存庫需要先設定 GITHUB_BACKUP_TOKEN。`);
  if (res.status === 403 || res.status === 429)
    return new RepoError(503, `GitHub 暫時拒絕下載 ${what}（${res.status}，多半是流量限制），請幾分鐘後再試。${detail ? " " + detail : ""}`);
  return new RepoError(502, `下載 ${what} 失敗（${res.status}）${detail ? " " + detail : ""}`);
}

// The default branch, read the way `git ls-remote` does: one plain HTTP
// request that is not counted against the (tiny, shared-IP) REST API quota.
export async function defaultBranch({ owner, repo, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://github.com/${owner}/${repo}.git/info/refs?service=git-upload-pack`, {
    headers: { "User-Agent": "git/2.45.0 (labsite-cloud)" },
  });
  if (!res.ok) throw await explain(res, `${owner}/${repo}`);
  const m = (await res.text()).match(/symref=HEAD:refs\/heads\/([^\s\0]+)/);
  return m ? m[1] : "main";
}

// Whole repository in one download. Public repos go through codeload (no API
// quota); with a token we use the REST API, which also reaches private repos.
export async function fetchRepoFiles({ owner, repo, branch, token, fetchImpl = fetch }) {
  let ref = branch;
  let res;
  if (token) {
    if (!ref) {
      const meta = await fetchImpl(`${API}/repos/${owner}/${repo}`, { headers: headers(token) });
      if (!meta.ok) throw await explain(meta, `${owner}/${repo}`);
      ref = (await meta.json()).default_branch || "main";
    }
    res = await fetchImpl(`${API}/repos/${owner}/${repo}/tarball/${encodeURIComponent(ref)}`, {
      headers: headers(token),
      redirect: "follow",
    });
  } else {
    if (!ref) ref = await defaultBranch({ owner, repo, fetchImpl });
    const path = ref.split("/").map(encodeURIComponent).join("/");
    res = await fetchImpl(`https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${path}`, {
      headers: { "User-Agent": "labsite-cloud" },
      redirect: "follow",
    });
  }
  if (!res.ok || !res.body) throw await explain(res, `${owner}/${repo}@${ref}`);
  const files = stripTopDir(parseTar(await gunzip(res.body))).filter((f) => {
    if (f.bytes.length > MAX_IMPORT_FILE) return false;
    return !/(^|\/)\.git(\/|$)/.test(f.path);
  });
  if (!files.length) throw new RepoError(400, "這個儲存庫沒有檔案。");
  return { ref, files };
}

/* -------------------------------------------------------------- backup */
async function call(fetchImpl, token, method, url, body) {
  const res = await fetchImpl(url, {
    method,
    headers: headers(token, body ? { "Content-Type": "application/json" } : {}),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).message || "";
    } catch {
      /* ignore */
    }
    const hint = res.status === 403 && /not accessible/i.test(detail) ? NO_WRITE + "（" : "";
    throw new Error(`${hint}${method} ${url.replace(API, "")} → ${res.status} ${detail}`.trim() + (hint ? "）" : ""));
  }
  return res.json();
}

async function recordBackup(env, siteId, fields) {
  await env.DB.prepare(
    "UPDATE sites SET backup_status = ?, backup_error = ?, backup_at = ?, backup_commit = COALESCE(?, backup_commit) WHERE id = ?",
  )
    .bind(fields.status, fields.error || null, Date.now(), fields.commit || null, siteId)
    .run();
}

// Mirrors the published tree onto site.github_repo. Returns the status string.
// Where a site is backed up: its own GitHub repository (sites imported from
// GitHub), or a folder in the shared backup repository (BACKUP_REPO) for sites
// made from a template. → { owner, repo, branch, prefix } or null
export function backupTarget(env, site) {
  if (site.github_repo) return { ...parseRepo(site.github_repo), branch: site.github_branch || "main", prefix: "" };
  if (env.BACKUP_REPO) return { ...parseRepo(env.BACKUP_REPO), branch: env.BACKUP_BRANCH || "main", prefix: `sites/${site.slug}/` };
  return null;
}

// Git's own name for a file's content, to compare with what GitHub already has.
async function gitBlobSha(bytes) {
  const head = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const all = new Uint8Array(head.length + bytes.byteLength);
  all.set(head);
  all.set(bytes, head.length);
  const digest = await crypto.subtle.digest("SHA-1", all);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Mirrors the site's latest saved version (so unpublished work is safe too)
// to GitHub as one ordinary commit (never forced). Only files whose content
// differs from GitHub are uploaded, at most BACKUP_BATCH per run, because a
// Worker may make only 50 outside requests per run on the free plan; the
// rest follow on the next run. A site that has not changed costs nothing.
// → "ok" | "partial" | "skipped" | "error"
export async function backupToGitHub(env, siteId, fetchImpl = fetch, { batch = BACKUP_BATCH } = {}) {
  const site = await getSite(env, siteId);
  const token = await githubToken(env);
  const target = site && backupTarget(env, site);
  if (!site || !target || !token || !site.draft_commit) {
    if (site) await recordBackup(env, site.id, { status: "skipped" });
    return "skipped";
  }
  if (site.backup_commit === site.draft_commit) return "ok";
  try {
    const { owner, repo, branch, prefix } = target;
    const base = `${API}/repos/${owner}/${repo}`;
    const ref = encodeURIComponent(branch);
    const draft = await getCommit(env, site.draft_commit);
    const local = await loadTree(env, draft.tree_id);
    const head = (await call(fetchImpl, token, "GET", `${base}/git/ref/heads/${ref}`)).object.sha;
    const baseTree = (await call(fetchImpl, token, "GET", `${base}/git/commits/${head}`)).tree.sha;
    const listing = await call(fetchImpl, token, "GET", `${base}/git/trees/${baseTree}?recursive=1`);
    const remote = new Map((listing.tree || []).filter((e) => e.type === "blob").map((e) => [e.path, e.sha]));
    // Only files changed since the last complete backup are read and compared
    // (all of them the first time); a file GitHub already has with the same
    // content (an earlier batch) is not sent again.
    const since = site.backup_commit ? await loadTree(env, (await getCommit(env, site.backup_commit))?.tree_id) : new Map();
    const upload = [];
    for (const [path, e] of local) {
      if (since.get(path)?.hash === e.hash && remote.has(prefix + path)) continue;
      const bytes = await getBlob(env, e.hash);
      if (remote.get(prefix + path) !== (await gitBlobSha(bytes))) upload.push([path, bytes]);
    }
    // Files removed from the site are removed from the backup too (never
    // GitHub's own settings under .github/, and only inside the site's folder).
    const removed = listing.truncated
      ? []
      : [...remote.keys()].filter((p) => p.startsWith(prefix) && !local.has(p.slice(prefix.length)) && !p.startsWith(".github/"));
    if (!upload.length && !removed.length) {
      await recordBackup(env, site.id, { status: "ok", commit: site.draft_commit });
      return "ok";
    }
    const now = upload.slice(0, Math.max(1, batch));
    const left = upload.length - now.length;
    const entries = removed.map((p) => ({ path: p, mode: "100644", type: "blob", sha: null }));
    for (const [path, bytes] of now) {
      const blob = await call(fetchImpl, token, "POST", `${base}/git/blobs`, { content: toBase64(bytes), encoding: "base64" });
      entries.push({ path: prefix + path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const tree = await call(fetchImpl, token, "POST", `${base}/git/trees`, { base_tree: baseTree, tree: entries });
    const commit = await call(fetchImpl, token, "POST", `${base}/git/commits`, {
      message:
        `LabSite 備份：${draft.message}（${draft.author}，版本 ${site.draft_commit.slice(0, 7)}）` +
        (left ? `，這批 ${now.length} 個檔案，還有 ${left} 個` : ""),
      tree: tree.sha,
      parents: [head],
    });
    await call(fetchImpl, token, "PATCH", `${base}/git/refs/heads/${ref}`, { sha: commit.sha });
    if (left) {
      await recordBackup(env, site.id, { status: "partial", error: `還有 ${left} 個檔案，下次自動備份會接著傳。` });
      return "partial";
    }
    await recordBackup(env, site.id, { status: "ok", commit: site.draft_commit });
    return "ok";
  } catch (e) {
    await recordBackup(env, site.id, { status: "error", error: String(e.message || e).slice(0, 500) });
    return "error";
  }
}

// The hourly run: every site whose latest version is not backed up yet,
// least recently backed up first, within one run's request budget.
export async function backupAll(env, fetchImpl = fetch, { budget = 45 } = {}) {
  if (!(await githubToken(env))) return [];
  const { results } = await env.DB.prepare(
    "SELECT id, slug FROM sites WHERE draft_commit IS NOT NULL AND (backup_commit IS NULL OR backup_commit != draft_commit) ORDER BY COALESCE(backup_at, 0)",
  ).all();
  const done = [];
  let calls = 0;
  const counted = (...a) => {
    calls++;
    return fetchImpl(...a);
  };
  for (const s of results) {
    const left = budget - calls;
    if (left < 10) break; // 3 reads + 3 writes + some files
    done.push([s.slug, await backupToGitHub(env, s.id, counted, { batch: Math.min(BACKUP_BATCH, left - 6) })]);
  }
  return done;
}
