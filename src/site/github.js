// GitHub as a site source: read and write repository files through the REST
// API, so the editor works from any URL without a local clone. Every save is
// one commit on the chosen branch. Also holds the browser side of the OAuth
// login (the code→token exchange lives in worker/, GitHub forbids doing it
// from a page).
import { normalizePath, isPagePath } from "./source.js";

export const API = "https://api.github.com";
export const TOKEN_KEY = "labsite-github-token";
export const REPO_KEY = "labsite-github-repo";
const STATE_KEY = "labsite-oauth-state";
export const KNOWN_REPOS = [
  ["bobyu89/sung-lab-website", "宋建美老師研究室"],
  ["bobyu89/ycho-lab-website", "賀彥中老師實驗室"],
];

/* ------------------------------------------------------------- encoding */
export function toBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export const textToBase64 = (text) => toBase64(new TextEncoder().encode(text));

/* --------------------------------------------------------------- client */
export function githubSource({ owner, repo, branch, token, fetchImpl = fetch }) {
  const headers = (extra = {}) => ({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: "Bearer " + token } : {}),
    ...extra,
  });
  const shas = new Map();
  const base = `${API}/repos/${owner}/${repo}`;
  const contentsUrl = (path) =>
    base + "/contents/" + normalizePath(path).split("/").map(encodeURIComponent).join("/");
  async function fail(res, what) {
    let detail = "";
    try {
      detail = (await res.json()).message || "";
    } catch {
      /* ignore */
    }
    const hint =
      res.status === 401
        ? "登入已失效，請重新登入。"
        : res.status === 403
          ? "沒有權限或已達 GitHub 速率上限。"
          : res.status === 404
            ? "找不到檔案或儲存庫。"
            : res.status === 409 || res.status === 422
              ? "遠端檔案已被其他人更新，請重新開啟頁面後再改。"
              : "";
    throw new Error(`${what}（${res.status}）${hint}${detail ? " " + detail : ""}`);
  }
  async function raw(path) {
    const res = await fetchImpl(contentsUrl(path) + "?ref=" + encodeURIComponent(branch), {
      headers: headers({ Accept: "application/vnd.github.raw+json" }),
    });
    if (!res.ok) await fail(res, "讀取 " + path + " 失敗");
    return res;
  }
  async function shaOf(path) {
    const key = normalizePath(path);
    if (shas.has(key)) return shas.get(key);
    const res = await fetchImpl(contentsUrl(key) + "?ref=" + encodeURIComponent(branch), {
      headers: headers(),
    });
    if (res.status === 404) return null;
    if (!res.ok) await fail(res, "查詢 " + path + " 失敗");
    const sha = (await res.json()).sha;
    shas.set(key, sha);
    return sha;
  }
  async function put(path, base64, message) {
    const key = normalizePath(path);
    const sha = await shaOf(key);
    const res = await fetchImpl(contentsUrl(key), {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        message: message || `LabSite：更新 ${key}`,
        content: base64,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) await fail(res, "寫入 " + path + " 失敗");
    const data = await res.json();
    if (data.content?.sha) shas.set(key, data.content.sha);
    return data.commit?.sha || null;
  }
  return {
    kind: "github",
    name: `${owner}/${repo}@${branch}`,
    owner,
    repo,
    branch,
    writable: !!token,
    async readText(path) {
      return (await raw(path)).text();
    },
    async readBlob(path) {
      return (await raw(path)).blob();
    },
    writeText: (path, text) => put(path, textToBase64(text)),
    async writeBlob(path, blob) {
      return put(path, toBase64(new Uint8Array(await blob.arrayBuffer())));
    },
    async listPages() {
      const res = await fetchImpl(
        `${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        { headers: headers() },
      );
      if (!res.ok) await fail(res, "讀取檔案清單失敗");
      const tree = (await res.json()).tree || [];
      const pages = [];
      for (const entry of tree) {
        if (entry.type !== "blob") continue;
        shas.set(entry.path, entry.sha);
        if (isPagePath(entry.path)) pages.push(entry.path);
      }
      return pages;
    },
  };
}

export async function githubUser(token, fetchImpl = fetch) {
  const res = await fetchImpl(API + "/user", {
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(res.status === 401 ? "token 無效或已過期" : "無法讀取 GitHub 帳號");
  const u = await res.json();
  return { login: u.login, avatar: u.avatar_url, name: u.name || u.login };
}
export async function defaultBranch(owner, repo, token, fetchImpl = fetch) {
  const res = await fetchImpl(`${API}/repos/${owner}/${repo}`, {
    headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: "Bearer " + token } : {}) },
  });
  if (!res.ok) throw new Error("找不到儲存庫 " + owner + "/" + repo);
  return (await res.json()).default_branch || "main";
}
export function parseRepo(text) {
  const m = String(text).trim().match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/* ---------------------------------------------------------------- OAuth */
// Runtime config next to index.html; missing or empty means "no login button".
export async function loadConfig(fetchImpl = fetch) {
  try {
    const res = await fetchImpl("./labsite.config.json", { cache: "no-store" });
    if (!res.ok) return {};
    const c = await res.json();
    return {
      clientId: c.githubClientId || "",
      workerUrl: (c.oauthWorkerUrl || "").replace(/\/$/, ""),
    };
  } catch {
    return {};
  }
}
export const loginAvailable = (c) => !!(c && c.clientId && c.workerUrl);
export const redirectUri = (loc = location) =>
  loc.origin + loc.pathname.replace(/index\.html$/, "");
export function authorizeUrl(config, state, loc = location) {
  const q = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(loc),
    scope: "public_repo",
    state,
  });
  return "https://github.com/login/oauth/authorize?" + q;
}
// The worker issues the OAuth `state`: a signed nonce bound to this origin
// that expires after a few minutes. We keep a copy in sessionStorage to
// compare on return (browser-side CSRF check), and send it back to the worker
// with the code so it can verify the signature too.
export async function startLogin(config, { storage = sessionStorage, loc = location, fetchImpl = fetch } = {}) {
  if (!loginAvailable(config)) throw new Error("尚未設定 OAuth 服務。");
  let res;
  try {
    res = await fetchImpl(config.workerUrl + "/state", { method: "POST" });
  } catch {
    throw new Error("無法連線到登入服務，請稍後再試。");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.state !== "string" || !data.state)
    throw new Error(
      res.status === 404
        ? "登入服務版本過舊，請重新部署 worker。"
        : "無法開始登入：" + (data.error || res.status),
    );
  storage.setItem(STATE_KEY, data.state);
  loc.assign(authorizeUrl(config, data.state, loc));
}
// Called once on load: checks ?state against the stored copy, then hands code +
// state to the worker (which re-verifies the state) for a token, and cleans the URL.
export async function finishLogin(config, { storage = sessionStorage, loc = location, fetchImpl = fetch, history = window.history } = {}) {
  const params = new URLSearchParams(loc.search);
  const code = params.get("code"),
    state = params.get("state");
  if (!code) return null;
  const clean = () => history.replaceState(null, "", loc.pathname + (loc.hash || ""));
  if (!state || state !== storage.getItem(STATE_KEY)) {
    clean();
    throw new Error("登入狀態不符，請重新登入。");
  }
  storage.removeItem(STATE_KEY);
  clean();
  if (!loginAvailable(config)) throw new Error("尚未設定 OAuth 服務。");
  const res = await fetchImpl(config.workerUrl + "/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state, redirect_uri: redirectUri(loc) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error("GitHub 登入失敗：" + (data.error || res.status));
  return data.access_token;
}
