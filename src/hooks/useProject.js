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
import { directorySource, detectDevSource, urlSource, normalizePath, stagedSource } from "../site/source.js";
import { createPreviewCache, invalidatePreviewCache } from "../site/preview.js";
import { detectCloud, cloudApi, cloudSource, redeemInviteFromUrl } from "../site/cloud.js";
import { pageLabel, saveMessage } from "../site/labels.js";
export { pageLabel, saveMessage };
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
  // Images picked but not yet saved: site path → { file, page }. They are
  // written in the same commit as the page that references them.
  const [staged, setStaged] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [remembered, setRemembered] = useState(null);
  const [devInfo, setDevInfo] = useState(null);
  // LabSite Cloud: "checking" until /api/me answers; "ready" when this page is
  // served by the cloud editor and someone is signed in; "off" elsewhere.
  const [cloud, setCloud] = useState({ status: "checking", me: null, error: null });
  const cloudCalls = useMemo(() => cloudApi(), []);
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
    (async () => {
      const invite = await redeemInviteFromUrl();
      const c = await detectCloud();
      setCloud({ me: null, ...c, error: invite && !invite.ok ? invite.error : c.error || null });
    })();
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
      // Reuse a loaded draft only for the project already open; a freshly
      // opened source (new project, or a reload after restore) always reads.
      if (source === project?.source && drafts[path]) {
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

  async function openSource(source, startPage) {
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
      setStaged({});
      setSiteData(data);
      setProject({ source, pages });
      if (source.kind === "directory")
        dbPut(STORES.projects, LAST, { handle: source.handle, name: source.name, at: Date.now() }).catch(() => {});
      const first = pages.includes(startPage) ? startPage : pages.includes("index.html") ? "index.html" : pages[0];
      await openPage(first, source);
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

  /* ------------------------------------------------------------- cloud */
  async function refreshCloud() {
    try {
      const me = await cloudCalls.me();
      setCloud({ status: "ready", me, error: null });
      return me;
    } catch (e) {
      setCloud((c) => ({ ...c, error: e.message }));
      return null;
    }
  }
  const openCloud = (site) => openSource(cloudSource(site));
  const cloudSiteId = project?.source.kind === "cloud" ? project.source.site.id : null;
  const cloudSite = cloudSiteId ? cloud.me?.sites.find((x) => x.id === cloudSiteId) || project.source.site : null;
  async function publishCloud(commitId) {
    if (!cloudSiteId) return false;
    setBusy(true);
    try {
      const { site } = await cloudCalls.publish(cloudSiteId, commitId);
      await refreshCloud();
      notify(
        site.backup?.status === "error"
          ? "已發布，網站幾秒內就會更新。GitHub 備份失敗：" + site.backup.error
          : "已發布，網站幾秒內就會更新。",
      );
      return true;
    } catch (e) {
      setError("發布失敗：" + e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function restoreCloud(commitId) {
    if (!cloudSiteId) return false;
    setBusy(true);
    try {
      const r = await cloudCalls.restore(cloudSiteId, commitId);
      await refreshCloud();
      await openSource(cloudSource(r.site), current);
      notify(r.noop ? "目前內容已經和這一版相同。" : "已還原成這一版（另存為新版本），按「發布」後網站才會更新。");
      return true;
    } catch (e) {
      setError("還原失敗：" + e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

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
    setStaged({});
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
    invalidatePreviewCache(cache.current, target);
    setStaged((st) => ({ ...st, [target]: { file, page: current } }));
    const rel = current.startsWith("en/") ? "../" + target : target;
    api.setAttr(i, path, "src", rel);
    notify("圖片已放入 " + target + "，保存頁面時會一起寫入。");
  }
  // What the preview reads: the real source with staged images laid over it.
  const previewSource = useMemo(
    () =>
      project
        ? stagedSource(project.source, Object.fromEntries(Object.entries(staged).map(([k, v]) => [k, v.file])))
        : null,
    [project, staged],
  );

  /* ------------------------------------------------------------ saving */
  // Every save is one unit: the pages named, the images staged for them and
  // (optionally) js/data.js, written together — a single commit on GitHub.
  async function commitFiles({ pages = [], site = false }) {
    if (!project) return false;
    if (!project.source.writable) {
      setError("網址來源無法寫回，請用「下載此頁」取得修改後的檔案。");
      return false;
    }
    const files = [];
    const assets = [];
    for (const path of pages) {
      const html = drafts[path]?.present;
      if (html === undefined) continue;
      files.push({ path, text: html });
      for (const [target, st] of Object.entries(staged))
        if (st.page === path) {
          files.push({ path: target, blob: st.file });
          assets.push(target);
        }
    }
    if (site && siteData) files.push({ path: SITE_DATA, text: siteData.text });
    if (!files.length) return false;
    const names = files.map((f) => f.path);
    const message = saveMessage(files);
    setBusy(true);
    try {
      const commit = await project.source.writeFiles(files, message);
      setOriginals((o) => {
        const next = { ...o };
        for (const path of pages) if (drafts[path]) next[path] = drafts[path].present;
        return next;
      });
      if (assets.length)
        setStaged((st) => {
          const next = { ...st };
          for (const t of assets) delete next[t];
          return next;
        });
      if (site && siteData) {
        invalidatePreviewCache(cache.current, SITE_DATA);
        setSiteData((sd) => ({ ...sd, original: sd.text }));
      }
      const what = names.length === 1 ? names[0] : names.length + " 個檔案";
      const kind = project.source.kind;
      notify(
        kind === "cloud"
          ? `已保存 ${what}（版本 ${String(commit || "").slice(0, 7)}）。按「發布」後網站才會更新。`
          : kind === "github"
            ? `已提交 ${what} 到 GitHub（commit ${String(commit || "").slice(0, 7)}），網站一兩分鐘後更新。`
            : `已寫回 ${what}。請用 git 檢視變更後再提交。`,
      );
      if (kind === "cloud") refreshCloud();
      return true;
    } catch (e) {
      setError("寫入失敗：" + e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const savePage = (path = current) => commitFiles({ pages: [path] });
  const saveAll = () => commitFiles({ pages: dirtyPages, site: siteDirty });
  function setSiteField(key, value) {
    setSiteData((s) => {
      const text = patchSiteField(s.text, key, value);
      return { ...s, text, fields: readSiteFields(text).fields };
    });
  }
  const saveSiteData = () => commitFiles({ site: true });
  function revertPage(path = current) {
    if (!path || !originals[path]) return;
    setDrafts((d) => ({ ...d, [path]: createHistory(originals[path]) }));
    setStaged((st) => Object.fromEntries(Object.entries(st).filter(([, v]) => v.page !== path)));
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
    previewSource,
    cloud,
    cloudCalls,
    cloudSite,
    refreshCloud,
    openCloud,
    publishCloud,
    restoreCloud,
    stagedCount: Object.keys(staged).length,
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
