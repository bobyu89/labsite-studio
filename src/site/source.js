// Site sources: where a real website's files come from and where edits go.
// Every source exposes the same small interface so the editor stays agnostic.
//   { kind, name, writable, readText(path), readBlob(path), writeText(path, text),
//     writeBlob(path, blob), writeFiles(files, message), listPages() }
// writeFiles takes [{ path, text }] / [{ path, blob }] and saves them as one
// unit (one commit on GitHub; plain sequential writes elsewhere).
// Paths are POSIX-style, relative to the site root, never starting with "/".

export function normalizePath(path) {
  const parts = [];
  for (const part of String(path).replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) throw new Error("路徑超出網站資料夾：" + path);
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}
// Resolves a relative URL found in a page against that page's own path.
export function resolveFrom(pagePath, ref) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//") || ref.startsWith("#"))
    return null;
  const clean = ref.split("#")[0].split("?")[0];
  if (!clean) return null;
  const dir = pagePath.includes("/") ? pagePath.slice(0, pagePath.lastIndexOf("/") + 1) : "";
  try {
    return normalizePath(decodeURIComponent(clean.startsWith("/") ? clean.slice(1) : dir + clean));
  } catch {
    return null;
  }
}
export const isPagePath = (p) => /^(?:[^/]+\/)?[^/]+\.html$/.test(p);

// Default writeFiles for sources without atomic multi-file writes.
export const sequentialWriter = (writeText, writeBlob) => async (files) => {
  for (const f of files) {
    if (f.text !== undefined) await writeText(f.path, f.text);
    else await writeBlob(f.path, f.blob);
  }
  return null;
};

// Lays not-yet-saved files over a source for previewing: `staged` maps a site
// path to a Blob (an image the user picked) or a string. Everything else falls
// through to the real source; writes are not affected.
export function stagedSource(source, staged) {
  if (!staged || !Object.keys(staged).length) return source;
  const get = (path) => staged[normalizePath(path)];
  return {
    ...source,
    async readText(path) {
      const v = get(path);
      if (v === undefined) return source.readText(path);
      return typeof v === "string" ? v : v.text();
    },
    async readBlob(path) {
      const v = get(path);
      if (v === undefined) return source.readBlob(path);
      return typeof v === "string" ? new Blob([v]) : v;
    },
  };
}

/* ------------------------------------------------------- directory handle */
export function directorySource(handle) {
  async function fileHandle(path, create = false) {
    const parts = normalizePath(path).split("/");
    let dir = handle;
    for (const part of parts.slice(0, -1))
      dir = await dir.getDirectoryHandle(part, { create });
    return dir.getFileHandle(parts.at(-1), { create });
  }
  async function write(path, data) {
    const fh = await fileHandle(path, true);
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
  }
  return {
    kind: "directory",
    name: handle.name,
    writable: true,
    handle,
    async readText(path) {
      return (await (await fileHandle(path)).getFile()).text();
    },
    async readBlob(path) {
      return (await fileHandle(path)).getFile();
    },
    writeText: write,
    writeBlob: write,
    writeFiles: sequentialWriter(write, write),
    async listPages() {
      const pages = [];
      for await (const [name, entry] of handle.entries()) {
        if (entry.kind === "file" && name.endsWith(".html")) pages.push(name);
        if (entry.kind === "directory" && name === "en")
          for await (const [sub, e] of entry.entries())
            if (e.kind === "file" && sub.endsWith(".html")) pages.push("en/" + sub);
      }
      return pages;
    },
  };
}

/* ---------------------------------------------------- vite dev middleware */
export async function detectDevSource() {
  try {
    const res = await fetch("/__labsite/info", { cache: "no-store" });
    if (!res.ok) return null;
    const info = await res.json();
    return devSource(info);
  } catch {
    return null;
  }
}
export function devSource(info) {
  const url = (path) => "/__labsite/file/" + normalizePath(path).split("/").map(encodeURIComponent).join("/");
  const get = async (path) => {
    const res = await fetch(url(path), { cache: "no-store" });
    if (!res.ok) throw new Error("讀取失敗：" + path);
    return res;
  };
  const put = async (path, body) => {
    const res = await fetch(url(path), { method: "PUT", body });
    if (!res.ok) throw new Error("寫入失敗：" + path);
  };
  return {
    kind: "dev",
    name: info.name,
    writable: !!info.writable,
    readText: async (path) => (await get(path)).text(),
    readBlob: async (path) => (await get(path)).blob(),
    writeText: put,
    writeBlob: put,
    writeFiles: sequentialWriter(put, put),
    async listPages() {
      const res = await fetch("/__labsite/list", { cache: "no-store" });
      return res.ok ? res.json() : [];
    },
  };
}

/* ------------------------------------------------------------ public URL */
export function urlSource(base) {
  const root = new URL(base.endsWith("/") ? base : base + "/");
  const name = root.hostname + root.pathname.replace(/\/$/, "");
  const get = async (path) => {
    const res = await fetch(new URL(normalizePath(path), root), { cache: "no-store" });
    if (!res.ok) throw new Error("讀取失敗：" + path);
    return res;
  };
  return {
    kind: "url",
    name,
    writable: false,
    base: root.href,
    readText: async (path) => (await get(path)).text(),
    readBlob: async (path) => (await get(path)).blob(),
    async writeText() {
      throw new Error("網址來源無法寫入，請下載修改後的檔案。");
    },
    async writeBlob() {
      throw new Error("網址來源無法寫入，請下載修改後的檔案。");
    },
    async writeFiles() {
      throw new Error("網址來源無法寫入，請下載修改後的檔案。");
    },
    async listPages() {
      try {
        const xml = await (await get("sitemap.xml")).text();
        const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
        const pages = new Set();
        for (const loc of locs) {
          const u = new URL(loc);
          if (!u.href.startsWith(root.href)) continue;
          let rel = u.href.slice(root.href.length);
          if (rel === "" || rel.endsWith("/")) rel += "index.html";
          if (isPagePath(rel)) pages.add(rel);
        }
        if (pages.size) return [...pages];
      } catch {
        /* fall through to defaults */
      }
      return ["index.html"];
    },
  };
}
