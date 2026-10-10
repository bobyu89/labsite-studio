// LabSite Cloud as a site source. Same interface as the folder and GitHub
// sources, so the editor does not care where files live. Every save is one
// version (commit) on the site's draft; publishing is a separate call.
//
// Each file's content hash is remembered when it is listed or read and sent
// back as the "base" when saving, so the server can refuse a save that would
// overwrite someone else's newer version of the same file.
import { normalizePath, isPagePath } from "./source.js";
import { toBase64 } from "./github.js";

export class CloudError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(fetchImpl, method, url, body) {
  let res;
  try {
    res = await fetchImpl(url, {
      method,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new CloudError(0, "無法連線到 LabSite 雲端，請檢查網路。");
  }
  const isJson = (res.headers.get("Content-Type") || "").includes("json");
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok)
    throw new CloudError(
      res.status,
      data.error || (res.status === 401 ? "登入已過期，請重新整理頁面再登入。" : `雲端回應錯誤（${res.status}）`),
      data,
    );
  return data;
}

export function cloudApi(fetchImpl = (...a) => fetch(...a)) {
  const call = (method, path, body) => request(fetchImpl, method, "/api" + path, body);
  const site = (id) => "/sites/" + encodeURIComponent(id);
  return {
    me: () => call("GET", "/me"),
    logout: () => call("POST", "/logout", {}),
    createInvite: (email) => call("POST", "/invites", { email }),
    deviceLink: () => call("POST", "/invites/self", {}),
    importSite: (body) => call("POST", "/sites", body),
    site: (id) => call("GET", site(id)),
    history: (id, limit = 50) => call("GET", site(id) + "/history?limit=" + limit),
    publish: (id, commit) => call("POST", site(id) + "/publish", commit ? { commit } : {}),
    restore: (id, commit) => call("POST", site(id) + "/restore", { commit }),
    addMember: (id, email) => call("POST", site(id) + "/members", { email }),
    removeMember: (id, email) => call("DELETE", site(id) + "/members/" + encodeURIComponent(email)),
    backup: (id) => call("POST", site(id) + "/backup", {}),
    aiTheme: (id, description) => call("POST", site(id) + "/ai-theme", { description }),
    exportUrl: (id, ref = "draft") => "/api" + site(id) + "/export?ref=" + ref,
    fetchImpl,
  };
}

// Opens a one-time invite link (?invite=… in the address bar): trades it for a
// session cookie and removes it from the URL so it is not left in history.
export async function redeemInviteFromUrl(loc = location, hist = history, fetchImpl = (...a) => fetch(...a)) {
  const params = new URLSearchParams(loc.search);
  const invite = params.get("invite");
  if (!invite) return null;
  params.delete("invite");
  const rest = params.toString();
  hist.replaceState(null, "", loc.pathname + (rest ? "?" + rest : "") + (loc.hash || ""));
  try {
    const data = await request(fetchImpl, "POST", "/api/login", { invite });
    return { ok: true, email: data.email };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Is this page served by LabSite Cloud, and who is signed in?
// → { status: "ready", me } | { status: "signed-out", error } | { status: "off" }
export async function detectCloud(fetchImpl = (...a) => fetch(...a)) {
  let res;
  try {
    res = await fetchImpl("/api/me", { headers: { Accept: "application/json" }, cache: "no-store", credentials: "same-origin" });
  } catch {
    return { status: "off" };
  }
  if (!(res.headers.get("Content-Type") || "").includes("json")) return { status: "off" };
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) return { status: "signed-out", error: data.error || "請先登入。" };
  if (!res.ok) return { status: "off" };
  return { status: "ready", me: data };
}

export function cloudSource(site, fetchImpl = (...a) => fetch(...a)) {
  const hashes = new Map();
  const base = "/api/sites/" + encodeURIComponent(site.id);
  const fileUrl = (path) => base + "/files/" + normalizePath(path).split("/").map(encodeURIComponent).join("/");
  async function raw(path) {
    let res;
    try {
      res = await fetchImpl(fileUrl(path), { cache: "no-store", credentials: "same-origin" });
    } catch {
      throw new CloudError(0, "無法連線到 LabSite 雲端。");
    }
    if (!res.ok) throw new CloudError(res.status, "讀取失敗：" + path);
    const h = res.headers.get("X-Content-Hash");
    if (h) hashes.set(normalizePath(path), h);
    return res;
  }
  const source = {
    kind: "cloud",
    name: site.name,
    writable: true,
    site,
    async listPages() {
      const data = await request(fetchImpl, "GET", base + "/tree");
      hashes.clear();
      for (const e of data.entries) hashes.set(e.path, e.hash);
      return data.entries.map((e) => e.path).filter(isPagePath);
    },
    async listFiles(prefix = "") {
      const data = await request(fetchImpl, "GET", base + "/tree");
      for (const e of data.entries) hashes.set(e.path, e.hash);
      const p = normalizePath(prefix);
      return data.entries.filter((e) => !p || e.path.startsWith(p + "/")).map((e) => ({ path: e.path, size: e.size }));
    },
    readText: async (path) => (await raw(path)).text(),
    readBlob: async (path) => (await raw(path)).blob(),
    async writeFiles(files, message) {
      const baseHashes = {};
      const body = [];
      for (const f of files) {
        const path = normalizePath(f.path);
        baseHashes[path] = hashes.has(path) ? hashes.get(path) : null;
        body.push(
          f.delete
            ? { path, delete: true }
            : f.text !== undefined
              ? { path, text: f.text }
              : { path, base64: toBase64(new Uint8Array(await f.blob.arrayBuffer())) },
        );
      }
      const data = await request(fetchImpl, "POST", base + "/commits", { message, base: baseHashes, files: body });
      for (const [path, hash] of Object.entries(data.hashes || {}))
        if (hash === null) hashes.delete(path);
        else hashes.set(path, hash);
      source.lastSite = data.site;
      return data.commit?.id || null;
    },
    writeText: (path, text) => source.writeFiles([{ path, text }]),
    writeBlob: (path, blob) => source.writeFiles([{ path, blob }]),
  };
  return source;
}
