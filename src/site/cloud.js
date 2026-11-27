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
    setPassword: (password, current) => call("POST", "/password", { password, current: current || undefined }),
    passwordLogin: (email, password) => call("POST", "/login/password", { email, password }),
    importSite: (body) => call("POST", "/sites", body),
    wizardPlan: (answers) => call("POST", "/admin/wizard/plan", answers),
    wizardThemes: (description) => call("POST", "/admin/wizard/themes", { description }),
    site: (id) => call("GET", site(id)),
    history: (id, limit = 50) => call("GET", site(id) + "/history?limit=" + limit),
    pending: (id) => call("GET", site(id) + "/pending"),
    overview: () => call("GET", "/admin/overview"),
    lookupReference: (q) => call("GET", "/lookup/reference?q=" + encodeURIComponent(q)),
    lookupOrcid: (orcid) => call("GET", "/lookup/orcid?id=" + encodeURIComponent(orcid)),
    searchPaper: (title, year) => call("GET", "/lookup/search?title=" + encodeURIComponent(title) + (year ? "&year=" + year : "")),
    getOrcid: (id) => call("GET", site(id) + "/orcid"),
    checkLinks: (id, urls) => call("POST", site(id) + "/check-links", { urls }),
    stats: (id, days = 30) => call("GET", site(id) + "/stats?days=" + days),
    previewLinks: (id) => call("GET", site(id) + "/preview-links"),
    comments: (id) => call("GET", site(id) + "/comments"),
    addComment: (id, body) => call("POST", site(id) + "/comments", body),
    resolveComment: (id, cid, resolved) => call("PUT", site(id) + "/comments/" + cid, { resolved }),
    deleteComment: (id, cid) => call("DELETE", site(id) + "/comments/" + cid),
    makePreviewLink: (id, days, snapshot) => call("POST", site(id) + "/preview-links", { days, snapshot }),
    revokePreviewLink: (id, token) => call("DELETE", site(id) + "/preview-links/" + encodeURIComponent(token)),
    presence: (id, page, leave = false) => call("POST", site(id) + "/presence", leave ? { leave: true } : { page }),
    setOrcid: (id, orcid) => call("PUT", site(id) + "/orcid", { orcid }),
    getLab: (id) => call("GET", site(id) + "/lab"),
    team: (id) => call("GET", site(id) + "/team"),
    addToTeam: (id, email) => call("POST", site(id) + "/team", { email }),
    removeFromTeam: (id, email) => call("DELETE", site(id) + "/team/" + encodeURIComponent(email)),
    teamLink: (id, email) => call("POST", site(id) + "/team/" + encodeURIComponent(email) + "/link", {}),
    setLab: (id, profile) => call("PUT", site(id) + "/lab", { profile }),
    // A file as it is in one version (a commit id, "published" or "draft"); null when absent.
    readAt: async (id, path, ref) => {
      const res = await fetchImpl("/api" + site(id) + "/files/" + path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(ref), { credentials: "same-origin" });
      return res.ok ? res.text() : null;
    },
    readPublished(id, path) {
      return this.readAt(id, path, "published");
    },
    publish: (id, commit) => call("POST", site(id) + "/publish", commit ? { commit } : {}),
    schedulePublish: (id, at) => call("PUT", site(id) + "/schedule", { at }),
    cancelSchedule: (id) => call("DELETE", site(id) + "/schedule"),
    restore: (id, commit) => call("POST", site(id) + "/restore", { commit }),
    addMember: (id, email) => call("POST", site(id) + "/members", { email }),
    removeMember: (id, email) => call("DELETE", site(id) + "/members/" + encodeURIComponent(email)),
    setMemberRole: (id, email, role) => call("PUT", site(id) + "/members/" + encodeURIComponent(email), { role }),
    requestReview: (id, note) => call("POST", site(id) + "/review", { note }),
    returnReview: (id, note) => call("POST", site(id) + "/review/return", { note }),
    backup: (id) => call("POST", site(id) + "/backup", {}),
    aiTheme: (id, description) => call("POST", site(id) + "/ai-theme", { description }),
    assistant: (id, body) => call("POST", site(id) + "/assistant", body),
    describePhoto: (id, body) => call("POST", site(id) + "/describe-photo", body),
    quickNews: (id, body) => call("POST", site(id) + "/quick-news", body),
    health: (id, body) => call("POST", site(id) + "/health", body),
    saveHealthReport: (id, report) => call("PUT", site(id) + "/health-report", report),
    importProfile: (id, body) => call("POST", site(id) + "/import-profile", body),
    findTeacher: (id, body) => call("POST", site(id) + "/find-teacher", body),
    aiSettings: () => call("GET", "/admin/ai"),
    saveAiSettings: (patch) => call("PUT", "/admin/ai", patch),
    removeAiKey: () => call("DELETE", "/admin/ai"),
    testAiKey: (key) => call("POST", "/admin/ai/test", key ? { key } : {}),
    backupSettings: () => call("GET", "/admin/backup"),
    saveBackupToken: (token) => call("PUT", "/admin/backup", { token }),
    removeBackupToken: () => call("DELETE", "/admin/backup"),
    testBackupToken: (token) => call("POST", "/admin/backup/test", token ? { token } : {}),
    runBackup: () => call("POST", "/admin/backup/run", {}),
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
    // opts.auto marks an autosave: the server keeps one history entry per sitting.
    async writeFiles(files, message, opts = {}) {
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
      const data = await request(fetchImpl, "POST", base + "/commits", { message, base: baseHashes, files: body, ...(opts.auto ? { auto: true } : {}) });
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
