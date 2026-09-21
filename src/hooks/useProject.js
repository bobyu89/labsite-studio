import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createHistory, historyReducer } from "../domain/history.js";
import { dbGet, dbPut, dbDelete, STORES } from "../domain/db.js";
import {
  editHtml,
  parsePage,
  sectionElements,
  moveSection,
  removeSection,
  duplicateSection,
  setText,
  setAttribute,
  writeHead,
  addItem,
  removeItem,
  moveItem,
  pairOf,
  structureSignature,
} from "../site/page.js";
import { readSiteFields, patchSiteField } from "../site/siteData.js";
import { directorySource, detectDevSource, urlSource, normalizePath } from "../site/source.js";
import { createPreviewCache, invalidatePreviewCache } from "../site/preview.js";
import {
  githubSource,
  githubUser,
  defaultBranch,
  parseRepo,
  loadConfig,
  loginAvailable,
  startLogin,
  finishLogin,
  TOKEN_KEY,
  REPO_KEY,
} from "../site/github.js";

const SITE_DATA = "js/data.js";
const LAST = "last-project";
const local = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

export function pageLabel(path) {
  const file = path.split("/").pop().replace(/\.html$/, "");
  const names = {
    index: "首頁",
    pi: "主持人",
    research: "研究主題",
    projects: "研究計畫",
    publications: "成果發表",
    conferences: "研討會論文",
    awards: "得獎紀錄",
    members: "團隊成員",
    education: "教學資源",
    collaboration: "合作交流",
    resources: "開放資源",
    gallery: "活動花絮",
    patents: "專利",
  };
  return names[file] || file;
}
function sortPages(pages) {
  const rank = (p) => (p.startsWith("en/") ? 1 : 0);
  const order = ["index", "pi", "research", "projects", "publications", "conferences", "awards", "patents", "members", "education", "collaboration", "resources", "gallery"];
  const key = (p) => {
    const i = order.indexOf(p.split("/").pop().replace(/\.html$/, ""));
    return i < 0 ? 99 : i;
  };
  return pages
    .filter((p) => !/^google[0-9a-f]+\.html$/.test(p))
    .sort((a, b) => rank(a) - rank(b) || key(a) - key(b) || a.localeCompare(b));
}

export function useProject(notify) {
  const [project, setProject] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [originals, setOriginals] = useState({});
  const [current, setCurrent] = useState(null);
  const [selected, setSelected] = useState(0);
  const [focus, setFocus] = useState(null);
  const [siteData, setSiteData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [remembered, setRemembered] = useState(null);
  const [devInfo, setDevInfo] = useState(null);
  const cache = useRef(createPreviewCache());
  const scrolls = useRef({});
  const [gh, setGh] = useState({
    token: local.get(TOKEN_KEY) || "",
    user: null,
    config: null,
    busy: true,
    error: null,
    lastRepo: local.get(REPO_KEY) || "",
  });
  const openGithubRef = useRef(null);

  useEffect(() => {
    detectDevSource().then((s) => s && setDevInfo(s));
    if (typeof indexedDB !== "undefined")
      dbGet(STORES.projects, LAST)
        .then((r) => r && r.handle && setRemembered(r))
        .catch(() => {});
    // GitHub: load runtime config, finish a pending OAuth redirect, validate a stored token.
    (async () => {
      const config = await loadConfig();
      let token = local.get(TOKEN_KEY) || "";
      let error = null;
      let fresh = false;
      try {
        const t = await finishLogin(config);
        if (t) {
          token = t;
          fresh = true;
          local.set(TOKEN_KEY, t);
        }
      } catch (e) {
        error = e.message;
      }
      let user = null;
      if (token) {
        try {
          user = await githubUser(token);
        } catch (e) {
          error = e.message;
          token = "";
          local.set(TOKEN_KEY, null);
        }
      }
      setGh((g) => ({ ...g, token, user, config, busy: false, error }));
      const last = local.get(REPO_KEY);
      if (fresh && user && last && openGithubRef.current) openGithubRef.current(last);
    })();
  }, []);

  const dirtyPages = Object.keys(drafts).filter(
    (p) => drafts[p].present !== originals[p],
  );
  const siteDirty = !!siteData && siteData.text !== siteData.original;
  const anyDirty = dirtyPages.length > 0 || siteDirty;
  useEffect(() => {
    const onLeave = (e) => {
      if (anyDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [anyDirty]);

  const openPage = useCallback(
    async (path, source = project?.source) => {
      if (!source) return;
      setFocus(null);
      setSelected(0);
      if (drafts[path]) {
        setCurrent(path);
        return;
      }
      setBusy(true);
      try {
        const html = await source.readText(path);
        parsePage(html);
        setOriginals((o) => ({ ...o, [path]: html }));
        setDrafts((d) => ({ ...d, [path]: createHistory(html) }));
        setCurrent(path);
        setError(null);
      } catch (e) {
        setError("無法讀取頁面 " + path + "：" + e.message);
      } finally {
        setBusy(false);
      }
    },
    [project, drafts],
  );

  async function openSource(source) {
    setBusy(true);
    setError(null);
    try {
      const pages = sortPages(await source.listPages());
      if (!pages.length) throw new Error("這個位置沒有任何 .html 頁面。");
      let data = null;
      try {
        const text = await source.readText(SITE_DATA);
        const parsed = readSiteFields(text);
        if (parsed.ok) data = { text, original: text, fields: parsed.fields };
      } catch {
        data = null;
      }
      cache.current = createPreviewCache();
      scrolls.current = {};
      setDrafts({});
      setOriginals({});
      setSiteData(data);
      setProject({ source, pages });
      if (source.kind === "directory")
        dbPut(STORES.projects, LAST, { handle: source.handle, name: source.name, at: Date.now() }).catch(() => {});
      await openPage(pages.includes("index.html") ? "index.html" : pages[0], source);
      notify("已開啟「" + source.name + "」，共 " + pages.length + " 個頁面。");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function openDirectory() {
    if (!window.showDirectoryPicker) {
      setError("此瀏覽器不支援選擇資料夾，請改用 Chrome 或 Edge，或使用開發伺服器模式。");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite", id: "labsite" });
      await openSource(directorySource(handle));
    } catch (e) {
      if (e.name !== "AbortError") setError("無法開啟資料夾：" + e.message);
    }
  }
  async function reopenRemembered() {
    if (!remembered?.handle) return;
    try {
      const perm = await remembered.handle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") throw new Error("未取得資料夾寫入權限。");
      await openSource(directorySource(remembered.handle));
    } catch (e) {
      setError(e.message);
    }
  }
  function forgetRemembered() {
    dbDelete(STORES.projects, LAST).catch(() => {});
    setRemembered(null);
  }
  const openDev = () => devInfo && openSource(devInfo);
  const openUrl = (base) => openSource(urlSource(base));

  /* ------------------------------------------------------------ GitHub */
  const loginGithub = async () => {
    if (!loginAvailable(gh.config)) {
      setGh((g) => ({ ...g, error: "尚未設定 GitHub 登入服務，請先完成 worker 與 labsite.config.json。" }));
      return;
    }
    setGh((g) => ({ ...g, error: null }));
    try {
      await startLogin(gh.config);
    } catch (e) {
      setGh((g) => ({ ...g, error: e.message }));
    }
  };
  async function setGithubToken(token) {
    const t = String(token || "").trim();
    if (!t) return;
    setGh((g) => ({ ...g, busy: true, error: null }));
    try {
      const user = await githubUser(t);
      local.set(TOKEN_KEY, t);
      setGh((g) => ({ ...g, token: t, user, busy: false }));
    } catch (e) {
      setGh((g) => ({ ...g, busy: false, error: e.message }));
    }
  }
  function logoutGithub() {
    local.set(TOKEN_KEY, null);
    setGh((g) => ({ ...g, token: "", user: null, error: null }));
    if (project?.source.kind === "github") closeProject();
  }
  async function openGithub(repoText, branch, { readOnly = false } = {}) {
    const parsed = parseRepo(repoText);
    if (!parsed) {
      setError("請輸入 owner/repo 或 GitHub 網址。");
      return;
    }
    const token = readOnly ? "" : gh.token;
    setBusy(true);
    try {
      const b = branch?.trim() || (await defaultBranch(parsed.owner, parsed.repo, token));
      const full = parsed.owner + "/" + parsed.repo;
      local.set(REPO_KEY, full);
      setGh((g) => ({ ...g, lastRepo: full }));
      await openSource(githubSource({ ...parsed, branch: b, token }));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  openGithubRef.current = (full) => openGithub(full);
  function closeProject() {
    for (const p of cache.current.urls.keys()) invalidatePreviewCache(cache.current, p);
    setProject(null);
    setDrafts({});
    setOriginals({});
    setCurrent(null);
    setSiteData(null);
    setError(null);
  }

  /* ----------------------------------------------------------- editing */
  const state = current ? drafts[current] : null;
  function dispatch(action, path = current) {
    if (!path) return;
    setDrafts((d) => (d[path] ? { ...d, [path]: historyReducer(d[path], action) } : d));
  }
  function edit(mutate, group, path = current) {
    dispatch(
      {
        type: "change",
        update: (html) => editHtml(html, mutate),
        group,
        at: Date.now(),
      },
      path,
    );
  }
  const section = (doc, i) => sectionElements(doc)[i];

  /* ---------------------------------------------------- language pairs */
  // zh ↔ en/ pages are hand-written copies. Structural edits (sections and
  // items) are mirrored to the paired page while both still share the same
  // structure; text is translated in the 對照 panel.
  const [mirror, setMirror] = useState(true);
  const pair = project && current ? pairOf(current, project.pages) : null;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  // Loads a page into drafts without switching to it. Resolves to its HTML.
  async function ensureLoaded(path) {
    const known = draftsRef.current[path];
    if (known) return known.present;
    try {
      const html = await project.source.readText(path);
      parsePage(html);
      setOriginals((o) => ({ ...o, [path]: html }));
      setDrafts((d) => (d[path] ? d : { ...d, [path]: createHistory(html) }));
      return html;
    } catch (e) {
      setError("無法讀取 " + path + "：" + e.message);
      return null;
    }
  }
  const signature = (html) => structureSignature(parsePage(html).doc);
  async function structural(mutate) {
    const before = state?.present;
    edit(mutate);
    if (!mirror || !pair || !before) return;
    const pairHtml = await ensureLoaded(pair);
    if (pairHtml === null) return;
    if (signature(before) !== signature(pairHtml)) {
      notify("另一語言頁（" + pair + "）結構不同，這次變更沒有同步過去。");
      return;
    }
    dispatch({ type: "change", update: (html) => editHtml(html, mutate), at: Date.now() }, pair);
  }
  const api = {
    setText: (i, path, value, page = current) =>
      edit((doc) => setText(section(doc, i), path, value), `text:${page}:${i}:${path.join(".")}`, page),
    setAttr: (i, path, name, value, page = current) =>
      edit((doc) => setAttribute(section(doc, i), path, name, value), `attr:${page}:${i}:${path.join(".")}:${name}`, page),
    setHead: (patch, page = current) => edit((doc) => writeHead(doc, patch), `head:${page}:${Object.keys(patch)[0]}`, page),
    move: (from, to) => {
      structural((doc) => moveSection(doc, from, to));
      setSelected(to);
    },
    remove: (i) => {
      structural((doc) => removeSection(doc, i));
      setSelected(Math.max(0, i - 1));
    },
    duplicate: (i) => {
      structural((doc) => duplicateSection(doc, i));
      setSelected(i + 1);
    },
    addItem: (i, containerPath, after) => structural((doc) => addItem(section(doc, i), containerPath, after)),
    removeItem: (i, containerPath, index) => structural((doc) => removeItem(section(doc, i), containerPath, index)),
    moveItem: (i, containerPath, from, to) => structural((doc) => moveItem(section(doc, i), containerPath, from, to)),
  };
  // Structure status for every loaded zh/en pair, recomputed from drafts.
  const pairStatus = useMemo(() => {
    if (!project) return {};
    const out = {};
    for (const path of project.pages) {
      if (path.startsWith("en/")) continue;
      const other = pairOf(path, project.pages);
      if (!other || !drafts[path] || !drafts[other]) continue;
      const same = signature(drafts[path].present) === signature(drafts[other].present);
      out[path] = same ? "same" : "diff";
      out[other] = out[path];
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, drafts]);
  async function checkPairs() {
    if (!project) return;
    setBusy(true);
    try {
      for (const path of project.pages) {
        const other = pairOf(path, project.pages);
        if (other && !path.startsWith("en/")) {
          await ensureLoaded(path);
          await ensureLoaded(other);
        }
      }
      notify("已載入所有中英文配對頁，選單中會標示結構不同的頁面。");
    } finally {
      setBusy(false);
    }
  }
  const ensurePair = () => (pair ? ensureLoaded(pair) : Promise.resolve(null));
  async function replaceImage(i, path, file) {
    const source = project?.source;
    if (!source?.writable) {
      setError("目前來源無法寫入圖片，請改用資料夾或開發伺服器模式。");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type)) {
      notify("請使用 JPG、PNG、WebP 或 SVG 圖片。");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      notify("圖片請控制在 4 MB 以內，以免網站載入變慢。");
      return;
    }
    const safe = file.name.replace(/[\\/:*?"<>|]+/g, "-").trim();
    const target = normalizePath("assets/" + safe);
    setBusy(true);
    try {
      await source.writeBlob(target, file);
      invalidatePreviewCache(cache.current, target);
      const rel = current.startsWith("en/") ? "../" + target : target;
      api.setAttr(i, path, "src", rel);
      notify("圖片已寫入 " + target + "，記得保存頁面。");
    } catch (e) {
      setError("圖片寫入失敗：" + e.message);
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------ saving */
  async function savePage(path = current) {
    const html = drafts[path]?.present;
    if (!project || html === undefined) return false;
    if (!project.source.writable) {
      setError("網址來源無法寫回，請用「下載此頁」取得修改後的檔案。");
      return false;
    }
    setBusy(true);
    try {
      await project.source.writeText(path, html);
      setOriginals((o) => ({ ...o, [path]: html }));
      notify("已寫回 " + path + "。請用 git 檢視變更後再提交。");
      return true;
    } catch (e) {
      setError("寫入失敗：" + e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveAll() {
    for (const p of dirtyPages) if (!(await savePage(p))) return;
    if (siteDirty) await saveSiteData();
  }
  function setSiteField(key, value) {
    setSiteData((s) => {
      const text = patchSiteField(s.text, key, value);
      return { ...s, text, fields: readSiteFields(text).fields };
    });
  }
  async function saveSiteData() {
    if (!siteData || !project?.source.writable) return;
    setBusy(true);
    try {
      await project.source.writeText(SITE_DATA, siteData.text);
      invalidatePreviewCache(cache.current, SITE_DATA);
      setSiteData((s) => ({ ...s, original: s.text }));
      notify("已寫回 js/data.js。");
    } catch (e) {
      setError("寫入失敗：" + e.message);
    } finally {
      setBusy(false);
    }
  }
  function revertPage(path = current) {
    if (!path || !originals[path]) return;
    setDrafts((d) => ({ ...d, [path]: createHistory(originals[path]) }));
  }

  return {
    project,
    pages: project?.pages ?? [],
    current,
    html: state?.present ?? null,
    pair,
    pairHtml: pair ? (drafts[pair]?.present ?? null) : null,
    pairStatus,
    mirror,
    setMirror,
    ensurePair,
    checkPairs,
    original: current ? originals[current] : null,
    dirty: !!current && state?.present !== originals[current],
    dirtyPages,
    siteData,
    siteDirty,
    anyDirty,
    busy,
    error,
    setError,
    remembered,
    devInfo,
    selected,
    setSelected,
    focus,
    setFocus,
    cache: cache.current,
    scrolls: scrolls.current,
    openDirectory,
    reopenRemembered,
    forgetRemembered,
    openDev,
    openUrl,
    gh,
    loginGithub,
    logoutGithub,
    setGithubToken,
    openGithub,
    openPage,
    closeProject,
    ...api,
    replaceImage,
    savePage,
    saveAll,
    revertPage,
    setSiteField,
    saveSiteData,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    boundary: () => dispatch({ type: "boundary" }),
    canUndo: !!state?.past.length,
    canRedo: !!state?.future.length,
  };
}
