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
  insertSection,
  sectionSnippet,
  setSectionMotion,
} from "../site/page.js";
import { loadLibrary, snippetPath, LIBRARY_PATH } from "../site/library.js";
import { THEME_PATH, readTheme, patchTheme } from "../site/themes.js";
import { SKINS_PATH, SITE_CSS, loadSkins, readSkin, themeForSkin, withCurrent } from "../site/skins.js";
import { prepareImage, formatBytes, isImagePath, referencedImages } from "../site/images.js";
import { readSiteFields, patchSiteField } from "../site/siteData.js";
import { readAlbum, writeAlbum, defaultCaption, albumPath } from "../site/album.js";
import { TEXT_FILE, planRelocation } from "../site/relocate.js";
import { directorySource, detectDevSource, urlSource, normalizePath, stagedSource, resolveFrom } from "../site/source.js";
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
  // The site's section library (labsite/library.json), or null if it has none.
  const [library, setLibrary] = useState(null);
  // css/theme.css of template-based sites: { text, original }, or null.
  const [theme, setThemeState] = useState(null);
  // Skins the site can switch to, and the css/site.css being previewed:
  // { list, current, text, original, pending } or null.
  const [skin, setSkin] = useState(null);
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
  const themeDirty = (!!theme && theme.text !== theme.original) || (!!skin && skin.text !== skin.original);
  const anyDirty = dirtyPages.length > 0 || siteDirty || themeDirty;
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
      const lib = await loadLibrary(source);
      let themeFile = null;
      try {
        const text = await source.readText(THEME_PATH);
        if (readTheme(text)) themeFile = { text, original: text };
      } catch {
        themeFile = null;
      }
      cache.current = createPreviewCache();
      scrolls.current = {};
      let skinState = null;
      const skins = themeFile ? await loadSkins(source) : null;
      if (skins) {
        try {
          const css = await source.readText(SITE_CSS);
          skinState = { list: skins.skins, current: skins.current, text: css, original: css, pending: null };
        } catch {
          skinState = null;
        }
      }
      setLibrary(lib);
      setThemeState(themeFile);
      setSkin(skinState);
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
    setLibrary(null);
    setThemeState(null);
    setSkin(null);
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
    // Presentation, not structure, but applied to the paired page as well so
    // both languages animate alike.
    setMotion: (i, value) => structural((doc) => setSectionMotion(doc, i, value)),
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

  /* ---------------------------------------------------- section library */
  const isEn = (path) => path.startsWith("en/");
  // The snippet file for a page's language; English pages fall back to the
  // Chinese snippet (new content arrives in the original language, as with items).
  const snippetFile = (entry, path) => (isEn(path) && entry.en ? entry.en : entry.file);
  async function readSnippet(entry, path) {
    const file = snippetFile(entry, path);
    try {
      return await project.source.readText(file);
    } catch (e) {
      // An optional English file that does not exist: use the Chinese one.
      if (file !== entry.file) return project.source.readText(entry.file);
      throw e;
    }
  }
  async function insertFromLibrary(entry, afterIndex) {
    if (!project || !current || !state) return false;
    const before = state.present;
    let html;
    try {
      html = await readSnippet(entry, current);
    } catch (e) {
      setError("讀不到元件「" + entry.name + "」：" + e.message);
      return false;
    }
    let ok = false;
    const page = current;
    editHtml(before, (doc) => (ok = insertSection(doc, afterIndex, html, page)));
    if (!ok) {
      setError("元件「" + entry.name + "」不是單一個 <section>，無法插入。");
      return false;
    }
    edit((doc) => insertSection(doc, afterIndex, html, page));
    setSelected(afterIndex + 1);
    setFocus(null);
    if (mirror && pair) {
      const pairHtml = await ensureLoaded(pair);
      if (pairHtml !== null && signature(before) === signature(pairHtml)) {
        const other = await readSnippet(entry, pair).catch(() => html);
        dispatch({ type: "change", update: (h) => editHtml(h, (doc) => insertSection(doc, afterIndex, other, pair)), at: Date.now() }, pair);
      } else if (pairHtml !== null) notify("另一語言頁（" + pair + "）結構不同，新區塊只加在這一頁。");
    }
    return true;
  }
  // Saves the section at `index` (and, when the paired page lines up, its other
  // language) into the site's library as one version.
  async function addToLibrary(index, { name, category, description = "" }) {
    if (!project?.source.writable || !current || !state) return false;
    const label = String(name || "").trim();
    if (!label) return false;
    const id = "custom-" + Date.now().toString(36);
    const zhPage = isEn(current) ? pair : current;
    const enPage = isEn(current) ? current : pair;
    const snippets = {};
    const take = (path) => {
      const html = path === current ? state.present : draftsRef.current[path]?.present;
      return html ? sectionSnippet(parsePage(html).doc, index, path) : null;
    };
    const aligned = pair && draftsRef.current[pair] && signature(state.present) === signature(draftsRef.current[pair].present);
    if (zhPage && (zhPage === current || aligned)) snippets.zh = take(zhPage);
    if (enPage && (enPage === current || aligned)) snippets.en = take(enPage);
    const entry = { id, name: label.slice(0, 40), category: String(category || "我的元件").trim().slice(0, 20) || "我的元件", description };
    if (!snippets.zh) {
      // Only an English page: store it as the main file.
      snippets.zh = snippets.en;
      delete snippets.en;
      entry.en = false;
    } else if (!snippets.en) entry.en = false;
    let manifest = { version: 1, sections: [] };
    try {
      const raw = JSON.parse(await project.source.readText(LIBRARY_PATH));
      if (raw && raw.version === 1 && Array.isArray(raw.sections)) manifest = raw;
    } catch {
      /* first entry: new manifest */
    }
    manifest.sections.push(entry);
    const files = [
      { path: snippetPath(id), text: snippets.zh },
      ...(snippets.en ? [{ path: snippetPath(id, "en"), text: snippets.en }] : []),
      { path: LIBRARY_PATH, text: JSON.stringify(manifest, null, 2) + "\n" },
    ];
    setBusy(true);
    try {
      await project.source.writeFiles(files, "加入元件庫：" + entry.name);
      setLibrary(await loadLibrary(project.source));
      notify("已把「" + entry.name + "」加入元件庫，之後在任何頁面都能插入。");
      if (project.source.kind === "cloud") refreshCloud();
      return true;
    } catch (e) {
      setError("加入元件庫失敗：" + e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  // Picked or dropped image: scaled and re-encoded in the browser, named after
  // its content, staged, and written with the page that references it.
  async function replaceImage(i, path, file, page = current) {
    const source = project?.source;
    if (!source?.writable) {
      setError("目前來源無法寫入圖片，請改用資料夾或開發伺服器模式。");
      return false;
    }
    let img;
    try {
      img = await prepareImage(file);
    } catch (e) {
      setError(e.message); // stays on screen, unlike a toast
      return false;
    }
    invalidatePreviewCache(cache.current, img.path);
    setStaged((st) => ({ ...st, [img.path]: { file: img.blob, page } }));
    api.setAttr(i, path, "src", relFrom(page, img.path), page);
    notify(
      img.converted
        ? `圖片已縮成 ${img.width}×${img.height}、${formatBytes(img.after)}（原本 ${formatBytes(img.before)}），保存頁面時會一起寫入。`
        : `圖片已放入 ${img.path}，保存頁面時會一起寫入。`,
    );
    return true;
  }
  /* ----------------------------------------------------------- relocate */
  // Site moved to a new address: find, then replace, old addresses in every
  // saved text file. Only with nothing unsaved, so the result is one clean
  // version and the open pages can simply be reloaded afterwards.
  async function planAddresses(pairs) {
    const source = project?.source;
    if (!source?.listFiles) throw new Error("這個來源無法列出檔案。");
    const files = [];
    for (const f of (await source.listFiles("")).filter((x) => TEXT_FILE.test(x.path)))
      files.push({ path: f.path, text: await source.readText(f.path).catch(() => null) });
    return planRelocation(files, pairs);
  }
  async function replaceAddresses(pairs) {
    if (!project?.source.writable) return null;
    if (anyDirty) {
      setError("請先保存或還原目前的修改，再更換網址。");
      return null;
    }
    setBusy(true);
    try {
      const plan = await planAddresses(pairs);
      if (!plan.length) {
        notify("沒有找到要更換的網址。");
        return plan;
      }
      const total = plan.reduce((n, f) => n + f.count, 0);
      await project.source.writeFiles(
        plan.map((f) => ({ path: f.path, text: f.text })),
        `更換網址：${pairs.map((x) => x.from + " → " + x.to).join("；")}（${plan.length} 個檔案、${total} 處）`.slice(0, 200),
      );
      setBusy(false);
      await openSource(project.source, current);
      notify(`已在 ${plan.length} 個檔案更換 ${total} 處網址並保存。` + (project.source.kind === "cloud" ? "按「發布」後網站才會更新。" : ""));
      if (project.source.kind === "cloud") refreshCloud();
      return plan;
    } catch (e) {
      setError("更換網址失敗：" + e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------------------------------------- album */
  // The activity photos listed in js/data.js (LOCAL_PHOTOS). New photos are
  // compressed like any image, staged under assets/gallery/, and written
  // together with js/data.js when the album is saved.
  const album = useMemo(() => (siteData ? readAlbum(siteData.text) : null), [siteData]);
  function setAlbumPhotos(photos) {
    setSiteData((s) => {
      const text = writeAlbum(s.text, photos);
      return { ...s, text, fields: readSiteFields(text).fields };
    });
  }
  async function addAlbumPhotos(files) {
    if (!project?.source.writable || !album?.ok) return 0;
    const added = [];
    const failed = [];
    setBusy(true);
    try {
      for (const file of files) {
        try {
          const img = await prepareImage(file);
          const path = albumPath(img.path);
          invalidatePreviewCache(cache.current, path);
          setStaged((st) => ({ ...st, [path]: { file: img.blob, page: SITE_DATA } }));
          added.push({ src: path, caption: defaultCaption(file) });
        } catch (e) {
          failed.push(e.message);
        }
      }
    } finally {
      setBusy(false);
    }
    if (added.length) {
      // Newest first, like the gallery shows them.
      setSiteData((s) => {
        const text = writeAlbum(s.text, [...added, ...readAlbum(s.text).photos]);
        return { ...s, text, fields: readSiteFields(text).fields };
      });
    }
    if (failed.length) setError(failed[0] + (failed.length > 1 ? `（另有 ${failed.length - 1} 張也無法加入）` : ""));
    else if (added.length) notify(`已加入 ${added.length} 張照片。填好說明後按「保存相簿」，再按「發布」。`);
    return added.length;
  }
  const relFrom = (page, target) => "../".repeat((page.match(/\//g) || []).length) + target;
  // Uses an image already on the site (from the photo library).
  function useAsset(i, path, assetPath) {
    api.setAttr(i, path, "src", relFrom(current, assetPath));
  }
  // The site's images, with which pages use them (all pages are read, using
  // unsaved drafts where there are any).
  async function listAssets() {
    const source = project?.source;
    if (!source?.listFiles) return null;
    const files = (await source.listFiles("assets")).filter((f) => isImagePath(f.path));
    const textOf = {};
    for (const page of project.pages) {
      textOf[page] = draftsRef.current[page]?.present ?? (await source.readText(page).catch(() => ""));
    }
    for (const css of (await source.listFiles("css").catch(() => [])).filter((f) => f.path.endsWith(".css")))
      textOf[css.path] = await source.readText(css.path).catch(() => "");
    if (siteData) textOf[SITE_DATA] = siteData.text;
    const used = referencedImages(textOf, resolveFrom);
    const saved = new Set(files.map((f) => f.path));
    // Images picked but not saved yet are listed too, so they can be reused.
    const pending = Object.entries(staged)
      .filter(([p]) => !saved.has(p))
      .map(([p, st]) => ({ path: p, size: st.file.size, used: used.has(p), pending: true }));
    return [...pending, ...files.map((f) => ({ ...f, used: used.has(f.path) }))];
  }
  // Deletes images nothing references, as one saved version.
  async function deleteAssets(paths) {
    if (!project?.source.writable || !paths.length) return false;
    setBusy(true);
    try {
      await project.source.writeFiles(
        paths.map((p) => ({ path: p, delete: true })),
        "刪除未使用的圖片：" + paths.map((p) => p.split("/").pop()).join("、"),
      );
      for (const p of paths) invalidatePreviewCache(cache.current, p);
      notify(`已刪除 ${paths.length} 張沒有使用的圖片。`);
      if (project.source.kind === "cloud") refreshCloud();
      return true;
    } catch (e) {
      setError("刪除圖片失敗：" + e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const readAsset = (p) => (staged[p] ? Promise.resolve(staged[p].file) : project.source.readBlob(p));
  // What the preview reads: the real source with staged images and an
  // unsaved theme laid over it.
  const themeText = theme && theme.text !== theme.original ? theme.text : null;
  const skinText = skin && skin.text !== skin.original ? skin.text : null;
  const siteText = siteData && siteData.text !== siteData.original ? siteData.text : null;
  const previewSource = useMemo(() => {
    if (!project) return null;
    invalidatePreviewCache(cache.current, THEME_PATH);
    invalidatePreviewCache(cache.current, SITE_CSS);
    const over = Object.fromEntries(Object.entries(staged).map(([k, v]) => [k, v.file]));
    if (themeText !== null) over[THEME_PATH] = themeText;
    if (skinText !== null) over[SITE_CSS] = skinText;
    invalidatePreviewCache(cache.current, SITE_DATA);
    if (siteText !== null) over[SITE_DATA] = siteText;
    return stagedSource(project.source, over);
  }, [project, staged, themeText, skinText, siteText]);

  /* -------------------------------------------------------------- theme */
  // Changes theme values in place ({ vars, fontUrl }); saved like any file.
  function setTheme(patch) {
    setThemeState((t) => (t ? { ...t, text: patchTheme(t.text, patch) } : t));
  }
  // AI themes (LabSite Cloud with an API key): one sentence → three themes,
  // already contrast-checked by the server. Applying one is setTheme().
  const aiAvailable = !!cloud.me?.ai && project?.source.kind === "cloud";
  async function generateAiThemes(description) {
    if (!aiAvailable) throw new Error("這個網站沒有開啟 AI 外觀。");
    return cloudCalls.aiTheme(project.source.site.id, description);
  }
  const revertTheme = () => {
    setThemeState((t) => (t ? { ...t, text: t.original } : t));
    setSkin((k) => (k ? { ...k, text: k.original, pending: null } : k));
  };
  // Previews another skin: its site.css and its theme (or the skin's theme
  // with this site's colours kept). Saved together with 保存外觀.
  async function previewSkin(id, { keepColors = false } = {}) {
    if (!project || !skin || !theme) return false;
    try {
      const files = await readSkin(project.source, id);
      setSkin((k) => ({ ...k, text: files.site, pending: id }));
      setThemeState((t) => ({ ...t, text: themeForSkin(files.theme, t.original, { keepColors }) }));
      return true;
    } catch (e) {
      setError("無法載入版型：" + e.message);
      return false;
    }
  }

  /* ------------------------------------------------------------ saving */
  // Every save is one unit: the pages named, the images staged for them and
  // (optionally) js/data.js, written together — a single commit on GitHub.
  async function commitFiles({ pages = [], site = false, themeFile = false }) {
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
    if (site && siteData) {
      files.push({ path: SITE_DATA, text: siteData.text });
      // Album photos still listed in the file go with it; removed ones are dropped.
      const listed = new Set((readAlbum(siteData.text).photos || []).map((x) => x.src));
      for (const [target, st] of Object.entries(staged))
        if (st.page === SITE_DATA && listed.has(target)) {
          files.push({ path: target, blob: st.file });
          assets.push(target);
        }
    }
    const savedTheme = themeFile && theme && theme.text !== theme.original ? theme.text : null;
    if (savedTheme !== null) files.push({ path: THEME_PATH, text: savedTheme });
    const savedSkin = themeFile && skin && skin.text !== skin.original ? skin : null;
    if (savedSkin) {
      files.push({ path: SITE_CSS, text: savedSkin.text });
      if (savedSkin.pending) {
        try {
          files.push({ path: SKINS_PATH, text: withCurrent(await project.source.readText(SKINS_PATH), savedSkin.pending) });
        } catch {
          /* no manifest to update */
        }
      }
    }
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
      if (savedTheme !== null) setThemeState((t) => (t ? { ...t, original: savedTheme } : t));
      if (savedSkin)
        setSkin((k) => (k ? { ...k, original: savedSkin.text, current: savedSkin.pending || k.current, pending: null } : k));
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
  const saveAll = () => commitFiles({ pages: dirtyPages, site: siteDirty, themeFile: themeDirty });
  const saveTheme = () => commitFiles({ themeFile: true });
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
    library,
    theme: theme ? { ...readTheme(theme.text), dirty: themeDirty } : null,
    skins: skin ? { list: skin.list, current: skin.current, pending: skin.pending } : null,
    ai: { available: aiAvailable, generate: generateAiThemes },
    previewSkin,
    setTheme,
    revertTheme,
    saveTheme,
    readSnippet,
    insertFromLibrary,
    addToLibrary,
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
    notify,
    album,
    planAddresses,
    replaceAddresses,
    setAlbumPhotos,
    addAlbumPhotos,
    readStaged: (path) => staged[path]?.file || null,
    useAsset,
    listAssets,
    deleteAssets,
    readAsset,
    canListAssets: !!project?.source.listFiles,
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
