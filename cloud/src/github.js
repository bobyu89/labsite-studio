// GitHub on the server side, used twice:
//   import  — one tarball download pulls a whole repository into a new site
//   backup  — after each publish, mirror what changed onto the repo as one
//             commit (best effort; the cloud copy is the source of truth)
import { toBase64 } from "./bytes.js";
import { parseTar, stripTopDir, gunzip } from "./tar.js";
import { RepoError, loadTree, getCommit, getBlob, diffTrees, getSite } from "./repo.js";

const API = "https://api.github.com";
const MAX_IMPORT_FILE = 20 * 1024 * 1024;
// Workers on the free plan may make 50 outbound requests per invocation; a
// backup needs 5 plus one per changed file.
export const BACKUP_MAX_FILES = 40;

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

export async function fetchRepoFiles({ owner, repo, branch, token, fetchImpl = fetch }) {
  let ref = branch;
  if (!ref) {
    const res = await fetchImpl(`${API}/repos/${owner}/${repo}`, { headers: headers(token) });
    if (!res.ok) throw new RepoError(404, `找不到 GitHub 儲存庫 ${owner}/${repo}（${res.status}）`);
    ref = (await res.json()).default_branch || "main";
  }
  const res = await fetchImpl(`${API}/repos/${owner}/${repo}/tarball/${encodeURIComponent(ref)}`, {
    headers: headers(token),
    redirect: "follow",
  });
  if (!res.ok || !res.body) throw new RepoError(502, `下載 ${owner}/${repo}@${ref} 失敗（${res.status}）`);
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
    throw new Error(`${method} ${url.replace(API, "")} → ${res.status} ${detail}`.trim());
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
export async function backupToGitHub(env, siteId, fetchImpl = fetch) {
  const site = await getSite(env, siteId);
  const token = env.GITHUB_BACKUP_TOKEN;
  if (!site?.github_repo || !token || !site.published_commit) {
    if (site) await recordBackup(env, site.id, { status: "skipped" });
    return "skipped";
  }
  if (site.backup_commit === site.published_commit) return "ok";
  try {
    const { owner, repo } = parseRepo(site.github_repo);
    const base = `${API}/repos/${owner}/${repo}`;
    const branch = encodeURIComponent(site.github_branch || "main");
    const fromCommit = await getCommit(env, site.backup_commit);
    const toCommit = await getCommit(env, site.published_commit);
    const from = await loadTree(env, fromCommit?.tree_id);
    const to = await loadTree(env, toCommit.tree_id);
    const changed = diffTrees(from, to);
    if (!changed.length) {
      await recordBackup(env, site.id, { status: "ok", commit: site.published_commit });
      return "ok";
    }
    if (changed.length > BACKUP_MAX_FILES) {
      await recordBackup(env, site.id, {
        status: "too_many",
        error: `這次有 ${changed.length} 個檔案變更，超過自動備份上限 ${BACKUP_MAX_FILES}，請用「下載整站」手動備份。`,
      });
      return "too_many";
    }
    const head = (await call(fetchImpl, token, "GET", `${base}/git/ref/heads/${branch}`)).object.sha;
    const baseTree = (await call(fetchImpl, token, "GET", `${base}/git/commits/${head}`)).tree.sha;
    const entries = [];
    for (const [path, kind] of changed) {
      if (kind === "deleted") {
        entries.push({ path, mode: "100644", type: "blob", sha: null });
        continue;
      }
      const bytes = await getBlob(env, to.get(path).hash);
      const blob = await call(fetchImpl, token, "POST", `${base}/git/blobs`, { content: toBase64(bytes), encoding: "base64" });
      entries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const tree = await call(fetchImpl, token, "POST", `${base}/git/trees`, { base_tree: baseTree, tree: entries });
    const commit = await call(fetchImpl, token, "POST", `${base}/git/commits`, {
      message: `LabSite 發布備份：${toCommit.message}（${toCommit.author}）`,
      tree: tree.sha,
      parents: [head],
    });
    await call(fetchImpl, token, "PATCH", `${base}/git/refs/heads/${branch}`, { sha: commit.sha });
    await recordBackup(env, site.id, { status: "ok", commit: site.published_commit });
    return "ok";
  } catch (e) {
    await recordBackup(env, site.id, { status: "error", error: String(e.message || e).slice(0, 500) });
    return "error";
  }
}
