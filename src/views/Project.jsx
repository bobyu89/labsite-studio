import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@radix-ui/themes";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  FloppyDisk,
  DownloadSimple,
  WarningCircle,
  X,
  RocketLaunch,
  ArrowSquareOut,
  Question,
  Eye,
  CaretLeft,
} from "@phosphor-icons/react";
import { IconButton, Field, Modal, download } from "../components/ui";
import ProjectOpen from "../components/ProjectOpen";
import SectionList from "../components/SectionList";
import FieldInspector from "../components/FieldInspector";
import SitePreview from "../components/SitePreview";
import SiteDataPanel from "../components/SiteDataPanel";
import PairPanel from "../components/PairPanel";
import CloudHistory from "../components/CloudHistory";
import LibraryPanel, { AddToLibrary } from "../components/LibraryPanel";
import SiteThemePanel from "../components/SiteThemePanel";
import CloudAlbums from "../components/CloudAlbums";
import { InsertAlbumDialog, AlbumBlockSettings } from "../components/AlbumBlock";
import { Thumb } from "../components/AlbumPanel";
import NewsPanel from "../components/NewsPanel";
import AddPublication, { publicationPages } from "../components/AddPublication";
import Assistant from "../components/Assistant";
import PromptBank from "../components/PromptBank";
import AssistantDock from "../components/AssistantDock";
import AlbumPanel from "../components/AlbumPanel";
import RelocatePanel from "../components/RelocatePanel";
import TextSizePanel from "../components/TextSizePanel";
import ColorPanel from "../components/ColorPanel";
import { applyColorMap } from "../site/palette.js";
import PublishSummary, { PublishChecks } from "../components/PublishSummary";
import AnimationLibrary from "../components/AnimationLibrary";
import EmbedDialog from "../components/EmbedDialog";
import PagesPanel from "../components/PagesPanel";
import { ENTRANCES } from "../site/blockCatalog.js";
import EditorGuide, { guideDismissed } from "../components/EditorGuide";
import { parsePage, listSections, readHead, sectionMotion, sectionElements, pathOf } from "../site/page.js";
import { pageLabel } from "../hooks/useProject";

// 進場動畫 for one section, on sites without the template's own motion system.
// "項目依序出現" only where the section has items to stagger (動畫元件).
function EntrancePicker({ section, disabled, onChange }) {
  const value = section?.getAttribute("data-ls-anim") || "";
  const canStagger = !!section?.querySelector(".ls-stagger");
  return (
    <label className="page-picker motion-picker">
      <span>進場動畫</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {ENTRANCES.filter(([id]) => id !== "stagger" || canStagger || value === "stagger").map(([id, label]) => (
          <option key={id || "none"} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Shown above the editor; brought into view when a new error appears, since
// the field that caused it may be far down the page.
function ErrorMessage({ text, onClose }) {
  const ref = useRef(null);
  useEffect(() => ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), [text]);
  return (
    <div className="message error" role="alert" ref={ref}>
      <WarningCircle size={20} />
      <span>{text}</span>
      <button onClick={onClose}>關閉</button>
    </div>
  );
}

export default function Project({ p, device, setDevice, setConfirm }) {
  const [tab, setTab] = useState("blocks");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(null);
  // Photo library: null (closed), { target: null } to manage, or
  // { target: { index, path } } to pick an image for one field.
  // 雲端相簿: null (closed), {} to manage, or { pick, title } to choose a photo.
  const [photos, setPhotos] = useState(null);
  const [insertAlbum, setInsertAlbum] = useState(false);
  const [animOpen, setAnimOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  // Off while the user types in the preview: the inspector shows the field
  // but leaves the keyboard focus in the page.
  const [grabFocus, setGrabFocus] = useState(true);
  const [guide, setGuide] = useState(() => !guideDismissed());
  const [addPub, setAddPub] = useState(false);
  // The side columns stick right under the bar, whatever height it wraps to.
  const studioRef = useRef(null);
  const barRef = useRef(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const set = () => {
      const top = parseFloat(getComputedStyle(bar).top) || 0;
      // offsetHeight is in the page's own (unzoomed) pixels, like `top`.
      studioRef.current?.style.setProperty("--studio-top", Math.round(top + bar.offsetHeight) + "px");
      // The floating assistant opens beside the right column, not over it.
      const right = studioRef.current?.querySelector(".studio-right");
      const beside = right && right.offsetLeft > (studioRef.current.offsetWidth || 0) / 2;
      studioRef.current?.style.setProperty("--inspector-w", (beside ? right.offsetWidth : 0) + "px");
    };
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    const right = studioRef.current?.querySelector(".studio-right");
    if (right) ro.observe(right);
    set();
    return () => ro.disconnect();
  });
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [aiSeed, setAiSeed] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  // After publishing: { previous } — the version visitors saw before, so it can be put back.
  const [published, setPublished] = useState(null);
  // A photo dropped anywhere else would make the browser open the file and
  // leave the editor; catch it and say where photos go instead.
  useEffect(() => {
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    const over = (e) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e) => {
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      p.notify("照片請拖到左邊的照片欄位、右邊預覽中的圖片上" + (p.album?.ok ? "，或「活動相簿」分頁。" : "。"));
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [p.album?.ok]);
  const parsed = useMemo(() => (p.html ? parsePage(p.html) : null), [p.html]);
  const sections = useMemo(() => (parsed ? listSections(parsed.doc) : []), [parsed]);
  const head = useMemo(() => (parsed ? readHead(parsed.doc) : null), [parsed]);
  const selected = Math.min(p.selected, Math.max(0, sections.length - 1));
  const writable = !!p.project?.source.writable;
  const isCloud = p.project?.source.kind === "cloud";
  const unsavedCount =
    p.dirtyPages.length + (p.siteDirty ? 1 : 0) + (p.textSize?.dirty ? 1 : 0) + (p.albumsDirty ? 1 : 0) + (p.nav?.dirty && p.nav.file !== "js/data.js" ? 1 : 0);
  // The album block in the selected section, if any.
  const albumEl = parsed ? sectionElements(parsed.doc)[selected]?.querySelector(".ls-album[data-album]") : null;
  const albumBlockInfo = albumEl
    ? { album: albumEl.getAttribute("data-album"), layout: albumEl.getAttribute("data-layout") || "grid", path: pathOf(albumEl, sectionElements(parsed.doc)[selected]) }
    : null;
  const insertAfter = sections.length ? selected : -1;
  const pickPhoto = (title, pick) => setPhotos({ title, pick });
  // Site path of an image URL (share images are absolute URLs).
  const assetOf = (url) => {
    const at = String(url).indexOf("assets/");
    return at >= 0 ? decodeURI(String(url).slice(at).split(/[?#]/)[0]) : String(url);
  };
  const shareUrl = (assetPath) => (p.cloudSite?.url ? p.cloudSite.url.replace(/\/?$/, "/") + assetPath : assetPath);
  // Before publishing, list every saved change that would go live (by whom),
  // plus anything still unsaved here, so nobody publishes work by surprise.
  const unsavedNames = () => [
    ...p.dirtyPages.map((x) => p.labelOf(x.replace(/^en\//, "")) +(x.startsWith("en/") ? "（英文）" : "")),
    ...(p.nav?.dirty && p.nav.file !== "js/data.js" ? ["選單"] : []),
    ...(p.siteDirty ? ["網站資料／活動相簿"] : []),
    ...(p.textSize?.dirty ? ["外觀"] : []),
    ...(p.albumsDirty ? ["雲端相簿"] : []),
  ];
  const onPublish = async () => {
    const [pending, checks] = await Promise.all([
      p.cloudCalls.pending(p.cloudSite.id).catch(() => null),
      p.prepublishCheck().catch(() => null),
    ]);
    const openCheck = (page) => {
      setConfirm(null);
      if (page) {
        setTab("blocks");
        if (page !== p.current) switchPage(page);
      } else setTab("site");
    };
    const warn = !!checks?.some((c) => c.level === "warn");
    const body = (
      <>
        <PublishChecks checks={checks} onOpen={openCheck} />
        <PublishSummary pending={pending} unsaved={p.anyDirty ? unsavedNames() : []} me={p.cloud.me?.email} />
      </>
    );
    const previous = p.cloudSite?.published || null;
    const done = (ok) => ok && setPublished({ previous });
    setConfirm(
      p.anyDirty
        ? {
            title: "發布到網站？",
            description: "會先把剛改的內容存好，再把網站更新成最新版本。這次會上線的修改：",
            body,
            confirmLabel: warn ? "仍要發布" : "發布",
            confirmColor: "orange",
            cancelLabel: "先不要",
            action: async () => {
              if (await p.saveAll()) done(await p.publishCloud(undefined, { message: false }));
            },
          }
        : {
            title: "發布到網站？",
            description: "網站會在幾秒內更新，所有人都看得到。這次會上線的修改：",
            body,
            confirmLabel: warn ? "仍要發布" : "發布",
            confirmColor: "orange",
            cancelLabel: "先不要",
            action: async () => done(await p.publishCloud(undefined, { message: false })),
          },
    );
  };

  if (!p.project)
    return (
      <>
        <div className="page-heading compact">
          <div>
            <h1>真實網站</h1>
            <p>直接開啟研究室網站的原始檔，拖拉區塊、改文字與圖片，寫回原檔。</p>
          </div>
        </div>
        {p.error && (
          <div className="message error" role="alert">
            <WarningCircle size={20} />
            <span>{p.error}</span>
            <button onClick={() => p.setError(null)}>關閉</button>
          </div>
        )}
        <ProjectOpen p={p} />
        <p className="small-note">
          支援的網站結構：根目錄與 <code>en/</code> 下的 .html 頁面、<code>css/main.css</code>、<code>js/data.js</code>。修改只動你選的文字、圖片與區塊順序，其餘原始碼一字不改。
        </p>
      </>
    );

  if (!p.current)
    return (
      <div className="page-heading compact">
        <div>
          <h1>{p.project.source.name}</h1>
          <p>{p.error ? p.error : "正在讀取頁面…"}</p>
        </div>
        {p.error && (
          <Button variant="surface" onClick={p.closeProject}>
            關閉專案
          </Button>
        )}
      </div>
    );
  const zh = p.pages.filter((x) => !x.startsWith("en/"));
  const en = p.pages.filter((x) => x.startsWith("en/"));
  const switchPage = (path) => {
    p.boundary();
    p.openPage(path);
  };
  const enter = (toTab, page) => {
    setTab(toTab);
    if (page && page !== p.current) switchPage(page);
  };
  const hasNews = !!p.news && p.news.reason !== "missing";
  const membersPage = p.pages.find((x) => !x.startsWith("en/") && /(^|\/)(members?|team|people)\.html?$/i.test(x));
  const openPhotos = () => (p.album?.ok ? setTab("album") : setPhotos({}));
  // 快速新增: the things a lab adds again and again, one click from anywhere.
  const quick = [
    publicationPages(p.pages).length > 0 && { id: "pub", title: "論文", run: () => setAddPub(true) },
    hasNews && { id: "news", title: "最新消息", run: () => setTab("news") },
    membersPage && {
      id: "members",
      title: "成員",
      run: () => {
        enter("blocks", membersPage);
        p.notify("在預覽點要改的成員；要新增成員，在右邊的成員清單按「新增」。");
      },
    },
    (p.album?.ok || p.canListAssets) && { id: "photos", title: "活動照片", run: openPhotos },
  ].filter(Boolean);
  const dot = (label) => <span className="unsaved-dot" aria-label={label} />;
  const more = [
    hasNews && { id: "news", title: "最新消息", mark: p.siteDirty && dot("未保存") },
    { id: "pages", title: "頁面與選單", mark: p.nav?.dirty && dot("未保存") },
    { id: "site", title: "研究室資料", mark: p.siteDirty && dot("未保存") },
    (p.theme || p.textSize?.available) && { id: "theme", title: "外觀與字體大小", mark: p.textSize?.dirty && dot("未保存") },
    { id: "pair", title: "中英對照", mark: p.pairStatus[p.current] === "diff" && dot("結構不同") },
    { id: "head", title: "分享設定" },
  ].filter(Boolean);
  const PANEL_TITLES = { news: "最新消息", pages: "頁面與選單", site: "研究室資料", theme: "外觀與字體大小", pair: "中英對照", head: "分享設定", album: "活動相簿", history: "舊版本" };
  const inEnglish = p.current?.startsWith("en/");
  const pageList = inEnglish ? en : zh;
  const state = unsavedCount > 0 ? "dirty" : isCloud && p.cloudSite?.unpublished ? "pending" : "live";
  const auto = p.autosave;
  // On LabSite Cloud edits save themselves; only looks (colours, type) wait for 保存.
  const stateText =
    auto.on && auto.status === "saving"
      ? "正在自動保存…"
      : auto.on && auto.pending
        ? auto.status === "error"
          ? "自動保存沒有成功，請按「保存」"
          : "修改會自動保存"
        : state === "dirty"
          ? auto.on
            ? "外觀的修改尚未保存"
            : `${unsavedCount} 處修改尚未保存`
          : state === "pending"
            ? auto.on
              ? "已自動保存，尚未發布"
              : "已保存，尚未發布"
            : isCloud
              ? "網站是最新的"
              : !writable
                ? "這個來源不能寫回"
                : "";
  const aiOn = isCloud && writable && !!p.ai?.available;
  const close = async () => {
    // Store what was just typed before leaving; only unsaved looks still need a decision.
    const stored = auto.on && auto.pending ? await p.flushAutosave() : true;
    const left = auto.on ? (stored ? (p.textSize?.dirty ? 1 : 0) : unsavedCount) : unsavedCount;
    if (left > 0) setConfirm({ title: "離開這個網站？", description: "有 " + left + " 處修改尚未保存，離開後會遺失。", action: p.closeProject });
    else p.closeProject();
  };
  return (
    <div className="studio" ref={studioRef}>
      <div className="studio-bar" ref={barRef}>
        <button type="button" className="studio-site" onClick={close} title="回到網站列表">
          <CaretLeft size={16} />
          <strong>{p.project.source.name}</strong>
        </button>
        <IconButton label="復原" onClick={p.undo} disabled={!p.canUndo}>
          <ArrowCounterClockwise size={19} />
        </IconButton>
        <IconButton label="重做" onClick={p.redo} disabled={!p.canRedo}>
          <ArrowClockwise size={19} />
        </IconButton>
        <span className="studio-page">
          <strong>{p.labelOf(p.current)}</strong>
          <span>{p.current}</span>
        </span>
        <span className={"studio-state " + (auto.on && auto.pending && auto.status === "error" ? "dirty" : auto.on && auto.pending ? "pending" : state)} role="status">
          {stateText}
        </span>
        {writable && (unsavedCount > 0 || !isCloud) && (
          <Button
            variant={isCloud ? "surface" : "solid"}
            color={isCloud ? "gray" : undefined}
            onClick={p.saveAll}
            disabled={unsavedCount === 0 || p.busy}
            title={auto.on ? "現在就存成草稿（平常會自動保存）" : undefined}
          >
            <FloppyDisk size={18} />
            {p.busy ? "處理中" : auto.on ? "保存" : unsavedCount > 1 ? `保存（${unsavedCount}）` : "保存"}
          </Button>
        )}
        {isCloud && p.cloudSite?.url && (
          <Button variant="surface" color="gray" onClick={() => window.open(p.cloudSite.url, "_blank", "noopener")} title={"在新分頁打開 " + p.cloudSite.url}>
            <ArrowSquareOut size={18} />
            看網站
          </Button>
        )}
        {isCloud && (
          <Button
            color="orange"
            onClick={onPublish}
            disabled={p.busy || (!p.cloudSite?.unpublished && !p.anyDirty)}
            title={!p.cloudSite?.unpublished && !p.anyDirty ? "沒有需要發布的修改" : "把網站更新成最新版本"}
          >
            <RocketLaunch size={18} />
            發布
          </Button>
        )}
        <Button
          variant="surface"
          color="gray"
          className="phone-only"
          onClick={() => document.querySelector(".editor-canvas")?.scrollIntoView({ behavior: "smooth" })}
        >
          <Eye size={18} />
          看預覽
        </Button>
        <IconButton label="使用說明" onClick={() => setGuide((g) => !g)}>
          <Question size={19} />
        </IconButton>
        <IconButton label="下載此頁 HTML" onClick={() => download(p.html, p.current.split("/").pop(), "text/html")}>
          <DownloadSimple size={18} />
        </IconButton>
      </div>
      {p.error && (
        <ErrorMessage text={p.error} onClose={() => p.setError(null)} />
      )}
      <AddPublication
        p={p}
        open={addPub}
        onClose={() => setAddPub(false)}
        onAdded={({ page, mirrored, heading }) => {
          setAddPub(false);
          enter("blocks", page);
          p.notify(
            `已加到「${heading || p.labelOf(page)}」最前面並重新編號${mirrored ? "，英文頁也加了" : ""}。確認沒問題後，按上方的${isCloud ? "「發布」" : "「保存」"}。`,
          );
        }}
      />
      <Modal
        open={!!published}
        onClose={() => setPublished(null)}
        title="已經發布"
        description="訪客現在看到的是最新的網站（幾秒內更新）。"
      >
        <div className="published-actions">
          {p.cloudSite?.url && (
            <Button
              onClick={() => {
                window.open(p.cloudSite.url, "_blank", "noopener");
                setPublished(null);
              }}
            >
              <ArrowSquareOut size={18} /> 看網站
            </Button>
          )}
          <Button variant="surface" color="gray" onClick={() => setPublished(null)}>
            繼續修改
          </Button>
        </div>
        {published?.previous && published.previous !== p.cloudSite?.published && (
          <div className="published-undo">
            <span>發現改錯了？可以讓網站回到發布前的樣子；你剛才的修改會留在草稿裡。</span>
            <Button
              variant="surface"
              color="gray"
              disabled={p.busy}
              onClick={async () => {
                const previous = published.previous;
                setPublished(null);
                await p.publishCloud(previous, { message: "網站已回到發布前的樣子。你的修改還在草稿裡，改好後再按「發布」。" });
              }}
            >
              回到上一版
            </Button>
          </div>
        )}
      </Modal>
      {guide && <EditorGuide onClose={() => setGuide(false)} isCloud={isCloud} hasAlbum={!!p.album?.ok} hasNews={hasNews} hasAi={aiOn} />}
      <div className={"studio-body" + (tab === "pair" ? " wide-inspector" : "")}>
        <aside className="studio-left" aria-label="網站結構">
          {writable && quick.length > 0 && (
            <p className="tree-quick">
              <span>新增</span>
              {quick.map((q, i) => (
                <React.Fragment key={q.id}>
                  {i > 0 && <span aria-hidden="true">・</span>}
                  <button type="button" onClick={q.run}>
                    {q.title}
                  </button>
                </React.Fragment>
              ))}
            </p>
          )}
          <section className="tree-group">
            <h2>
              網站
              {p.pair && (
                <span className="tree-lang" role="group" aria-label="語言">
                  <button type="button" className={inEnglish ? "" : "active"} disabled={p.busy} onClick={() => inEnglish && switchPage(p.pair)}>
                    中文
                  </button>
                  <span aria-hidden="true">｜</span>
                  <button type="button" className={inEnglish ? "active" : ""} disabled={p.busy} onClick={() => !inEnglish && switchPage(p.pair)}>
                    English
                  </button>
                </span>
              )}
            </h2>
            <ul className="tree" role="tree" aria-label="頁面">
              {pageList.map((path) => {
                const open = path === p.current;
                return (
                  <li key={path} role="treeitem" aria-expanded={open} aria-selected={open && tab === "blocks"}>
                    <button
                      type="button"
                      className={"tree-page" + (open ? " open" : "")}
                      disabled={p.busy}
                      title={path}
                      onClick={() => {
                        if (!open) switchPage(path);
                        setTab("blocks");
                      }}
                    >
                      <span className="tree-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
                      {p.labelOf(path)}
                      {p.dirtyPages.includes(path) && dot("未保存")}
                    </button>
                    {open && (
                      <div className="tree-children">
                        {sections.length === 0 && (
                          <div className="message" role="status">
                            <WarningCircle size={20} />
                            <span>
                              這一頁沒有可編輯的區塊。LabSite 只辨識 <code>&lt;body&gt;</code> 直屬的 <code>&lt;section&gt;</code>
                              ；包在 <code>&lt;main&gt;</code> 或 <code>&lt;div&gt;</code> 裡的區塊目前不會列出。頁面標題與描述仍可在「頁面資訊」修改。
                            </span>
                          </div>
                        )}
                        <SectionList
                          sections={sections}
                          selected={selected}
                          onSelect={(i) => {
                            p.setSelected(i);
                            p.setFocus(null);
                            setTab("blocks");
                          }}
                          onMove={p.move}
                          onDuplicate={p.duplicate}
                          onRemove={(i) =>
                            setConfirm({
                              title: "刪除「" + sections[i].title + "」？",
                              description: "會從這一頁移除整個區塊與相鄰分隔線；可用復原找回。",
                              action: () => p.remove(i),
                            })
                          }
                          onAdd={p.library?.sections.length && sections.length ? () => setLibraryOpen(true) : null}
                          onSave={writable ? (i) => setSaving(i) : null}
                        />
                        {writable && (
                          <div className="insert-blocks">
                            <span>{sections.length ? "在選取的區塊後面加入：" : "加入："}</span>
                            {aiOn && (
                              <Button size="1" color="orange" variant="soft" onClick={() => setPromptsOpen(true)}>
                                ＋ 用 AI 寫一段
                              </Button>
                            )}
                            <Button
                              size="1"
                              variant="soft"
                              disabled={!p.canListAssets}
                              onClick={() =>
                                pickPhoto("選一張照片放到這一頁", (src) => {
                                  const all = [...(p.albums?.albums || []).flatMap((a) => a.photos), ...(p.album?.photos || [])];
                                  const caption = all.find((x) => x.src === src)?.caption || "";
                                  p.insertBlock(insertAfter, "photo", { src, caption });
                                })
                              }
                            >
                              ＋ 照片
                            </Button>
                            <Button size="1" variant="soft" disabled={!p.albums} onClick={() => setInsertAlbum(true)}>
                              ＋ 相簿展示
                            </Button>
                            <Button size="1" variant="soft" onClick={() => p.insertBlock(insertAfter, "text", {})}>
                              ＋ 標題與文字
                            </Button>
                            <Button size="1" variant="soft" onClick={() => setEmbedOpen(true)}>
                              ＋ 影片／地圖
                            </Button>
                            <Button size="1" onClick={() => setAnimOpen(true)}>
                              ＋ 動畫元件
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="tree-group">
            <h2>資料</h2>
            <ul className="tree tree-flat">
              {hasNews && (
                <li>
                  <button type="button" className={tab === "news" ? "active" : ""} onClick={() => setTab("news")}>
                    最新消息 <span className="tree-count">{p.news?.items?.length || ""}</span>
                    {p.siteDirty && dot("未保存")}
                  </button>
                </li>
              )}
              {(p.album?.ok || p.canListAssets) && (
                <li>
                  <button type="button" className={tab === "album" ? "active" : ""} onClick={openPhotos}>
                    活動照片 <span className="tree-count">{p.album?.ok ? p.album.photos.length : ""}</span>
                  </button>
                </li>
              )}
              <li>
                <button type="button" className={tab === "site" ? "active" : ""} onClick={() => setTab("site")}>
                  研究室資料
                </button>
              </li>
              {p.canListAssets && p.albums && (
                <li>
                  <button type="button" onClick={() => setPhotos({})}>
                    雲端相簿與素材庫
                    {p.albumsDirty && dot("未保存")}
                  </button>
                </li>
              )}
            </ul>
          </section>
          <section className="tree-group">
            <h2>設定</h2>
            <ul className="tree tree-flat">
              {more
                .filter((m) => m.id !== "news" && m.id !== "site")
                .map((m) => (
                  <li key={m.id}>
                    <button type="button" className={tab === m.id ? "active" : ""} onClick={() => setTab(m.id)}>
                      {m.title}
                      {m.mark}
                    </button>
                  </li>
                ))}
              {isCloud && (
                <li>
                  <button type="button" className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
                    舊版本
                  </button>
                </li>
              )}
            </ul>
          </section>
        </aside>
        <aside className="studio-right inspector" aria-label="修改選到的內容">
          {tab !== "blocks" && (
            <div className="studio-panel-head">
              <button type="button" onClick={() => setTab("blocks")}>
                <CaretLeft size={14} /> 回到內容
              </button>
              <strong>{PANEL_TITLES[tab]}</strong>
            </div>
          )}
          {tab === "pages" ? (
            <div className="inspector-body">
              <PagesPanel p={p} writable={writable} openPage={switchPage} setConfirm={setConfirm} />
            </div>
          ) : tab === "history" && isCloud ? (
            <div className="inspector-body">
              <CloudHistory p={p} setConfirm={setConfirm} />
            </div>
          ) : tab === "theme" && (p.theme || p.textSize?.available) ? (
            <div className="inspector-body">
              <ColorPanel p={p} writable={writable} />
              <TextSizePanel p={p} writable={writable} />
              {p.theme && <SiteThemePanel p={p} />}
            </div>
          ) : tab === "news" && p.news ? (
            <div className="inspector-body">
              <NewsPanel p={p} writable={writable} setConfirm={setConfirm} />
            </div>
          ) : tab === "album" && p.album?.ok ? (
            <div className="inspector-body">
              <AlbumPanel
                p={p}
                writable={writable}
                galleryPage={p.pages.find((x) => /(^|\/)gallery\.html$/.test(x) && x.startsWith("en/") === p.current.startsWith("en/"))}
                openPage={switchPage}
                setConfirm={setConfirm}
              />
            </div>
          ) : tab === "site" ? (
            <div className="inspector-body">
              <SiteDataPanel
                siteData={p.siteData}
                siteDirty={p.siteDirty}
                setSiteField={p.setSiteField}
                saveSiteData={p.saveSiteData}
                writable={writable}
                busy={p.busy}
                autosave={p.autosave.on}
              />
              {p.canListAssets && writable && <RelocatePanel p={p} writable={writable} setConfirm={setConfirm} />}
            </div>
          ) : tab === "pair" ? (
            <>
              <div className="inspector-body">
                <PairPanel p={p} selected={selected} />
              </div>
            </>
          ) : tab === "head" ? (
            <div className="inspector-body">
              {head && (
                <>
                  <Field label="頁面標題（瀏覽器分頁與分享標題）" value={head.title} onChange={(title) => p.setHead({ title })} />
                  <Field
                    label="頁面描述（搜尋引擎與分享摘要）"
                    value={head.description}
                    area
                    rows={3}
                    onChange={(description) => p.setHead({ description })}
                  />
                  <p className="small-note">同步更新 og 與 twitter 的對應標籤。</p>
                  {p.canListAssets && (
                    <div className="share-image">
                      <span className="field-label">分享預覽圖（貼到 LINE、Facebook 時出現的圖）</span>
                      {head.image ? (
                        <div className="share-image-row">
                          <Thumb p={p} src={assetOf(head.image)} />
                          <code title={head.image}>{head.image.split("/").pop()}</code>
                        </div>
                      ) : (
                        <p className="small-note">這一頁還沒有分享預覽圖。</p>
                      )}
                      <Button
                        size="1"
                        variant="soft"
                        disabled={!writable}
                        onClick={() => pickPhoto("選分享預覽圖", (path) => p.setHead({ image: shareUrl(path) }))}
                      >
                        從雲端相簿選
                      </Button>
                      <p className="small-note">建議用橫式照片（約 1200×630）。每一頁可以不同。</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="inspector-body">
                <h3 className="inspector-subtitle">
                  {sections[selected]?.title}
                  <span className="muted">{sections[selected]?.kind}</span>
                </h3>
                {!p.theme?.vars["--motion"] && parsed && sections[selected] && (
                  <EntrancePicker section={sectionElements(parsed.doc)[selected]} disabled={!writable} onChange={(v) => p.setEntrance(selected, v)} />
                )}
                {p.theme?.vars["--motion"] && parsed && sections[selected] && (
                  <label className="page-picker motion-picker">
                    <span>進場動畫</span>
                    <select value={sectionMotion(parsed.doc, selected)} onChange={(e) => p.setMotion(selected, e.target.value)} disabled={!writable}>
                      <option value="">跟隨全站設定</option>
                      <option value="fade">淡入</option>
                      <option value="rise">上升</option>
                      <option value="slide">從左滑入</option>
                      <option value="stagger">項目依序出現</option>
                      <option value="none">不要動畫</option>
                    </select>
                  </label>
                )}
                {albumBlockInfo && (
                  <AlbumBlockSettings
                    p={p}
                    block={albumBlockInfo}
                    writable={writable}
                    openManager={() => setPhotos({})}
                    onChange={(name, value) => p.setAttr(selected, albumBlockInfo.path, name, value)}
                  />
                )}
                <FieldInspector
                  html={p.html}
                  index={selected}
                  focus={p.focus}
                  grabFocus={grabFocus}
                  setFocus={p.setFocus}
                  setText={p.setText}
                  setAttr={p.setAttr}
                  setFx={writable ? p.setButtonMotion : null}
                  describe={aiOn ? (src) => p.ai.describePhoto(src, { page: p.current }) : null}
                  lang={inEnglish ? "en" : "zh"}
                  replaceImage={p.replaceImage}
                  openLibrary={p.canListAssets ? (index, path) => pickPhoto("選一張照片放進這個欄位", (asset) => p.useAsset(index, path, asset)) : null}
                  writable={writable}
                  busy={p.busy}
                  addItem={p.addItem}
                  removeItem={p.removeItem}
                  moveItem={p.moveItem}
                  setConfirm={setConfirm}
                />
              </div>
            </>
          )}
        </aside>
        <LibraryPanel p={p} sections={sections} selected={selected} open={libraryOpen} onClose={() => setLibraryOpen(false)} />
        <AddToLibrary p={p} section={sections[saving]} index={saving} open={saving !== null} onClose={() => setSaving(null)} />
        <CloudAlbums p={p} open={!!photos} onPick={photos?.pick} pickTitle={photos?.title} onClose={() => setPhotos(null)} setConfirm={setConfirm} />
        <EmbedDialog
          open={embedOpen}
          onClose={() => setEmbedOpen(false)}
          where={sections.length ? "插在「" + (sections[selected]?.title || "") + "」後面" : "插在頁面開頭"}
          onInsert={(opts) => p.insertBlock(insertAfter, "embed", opts)}
        />
        {aiOn && (
          <AssistantDock
            open={aiOpen}
            onOpen={() => setAiOpen(true)}
            onClose={() => setAiOpen(false)}
            where={[p.labelOf(p.current), sections[selected]?.title].filter(Boolean).join(" › ")}
          >
            <Assistant p={p} selected={selected} sectionCount={sections.length} open={aiOpen} seed={aiSeed} onOpen={() => setAiOpen(true)} />
          </AssistantDock>
        )}
        <PromptBank
          open={promptsOpen}
          onClose={() => setPromptsOpen(false)}
          where={sections.length ? "放在「" + (sections[selected]?.title || "") + "」後面" : "放在頁面開頭"}
          onPick={(text) => setAiSeed({ text, n: Date.now() })}
        />
        <AnimationLibrary
          open={animOpen}
          onClose={() => setAnimOpen(false)}
          where={sections.length ? "插在「" + (sections[selected]?.title || "") + "」後面" : "插在頁面開頭"}
          onInsert={(id) => p.insertBlock(insertAfter, "catalog", { id })}
        />
        <InsertAlbumDialog
          p={p}
          open={insertAlbum}
          onClose={() => setInsertAlbum(false)}
          openManager={() => setPhotos({})}
          onInsert={(opts) => p.insertBlock(insertAfter, "album", opts)}
        />
        <SitePreview
          html={p.colors?.previewing ? applyColorMap(p.html, p.colors.map).text : p.html}
          pagePath={p.current}
          source={p.previewSource}
          cache={p.cache}
          scrolls={p.scrolls}
          pages={p.pages}
          selected={selected}
          focus={p.focus}
          onSelect={(i, path, typing) => {
            setGrabFocus(!typing);
            setTab("blocks");
            p.setSelected(i);
            p.setFocus(path);
            // On a phone the editor sits above the preview: bring the field into view.
            if (!typing && window.matchMedia("(max-width: 767px)").matches)
              document.querySelector(".inspector")?.scrollIntoView({ behavior: "smooth" });
          }}
          onNavigate={switchPage}
          onDropImage={writable ? (i, path, file) => p.replaceImage(i, path, file) : null}
          onInline={writable ? (i, path, changes) => p.inlineEdit(i, path, changes) : null}
          onInlineBroken={() => p.notify("這段文字裡有粗體、連結之類的格式被刪掉了，已還原。請改在左邊的欄位修改。")}
          canPlayMotion={!!p.theme?.vars["--motion"]}
          // 中英對照 takes the room of the second preview.
          device={tab === "pair" && device === "both" ? "desktop" : device}
          setDevice={setDevice}
        />
      </div>
    </div>
  );
}
