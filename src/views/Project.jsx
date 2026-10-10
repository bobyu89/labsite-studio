import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Badge } from "@radix-ui/themes";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  FloppyDisk,
  DownloadSimple,
  FolderOpen,
  WarningCircle,
  X,
  RocketLaunch,
  ArrowSquareOut,
  Images,
  Question,
} from "@phosphor-icons/react";
import { IconButton, Field, download } from "../components/ui";
import ProjectOpen from "../components/ProjectOpen";
import SectionList from "../components/SectionList";
import FieldInspector from "../components/FieldInspector";
import SitePreview from "../components/SitePreview";
import SiteDataPanel from "../components/SiteDataPanel";
import PairPanel from "../components/PairPanel";
import CloudHistory from "../components/CloudHistory";
import LibraryPanel, { AddToLibrary } from "../components/LibraryPanel";
import SiteThemePanel from "../components/SiteThemePanel";
import PhotoLibrary from "../components/PhotoLibrary";
import AlbumPanel from "../components/AlbumPanel";
import RelocatePanel from "../components/RelocatePanel";
import EditorGuide, { guideDismissed } from "../components/EditorGuide";
import { parsePage, listSections, readHead, sectionMotion } from "../site/page.js";
import { pageLabel } from "../hooks/useProject";

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
  const [photos, setPhotos] = useState(null);
  const [guide, setGuide] = useState(() => !guideDismissed());
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
  const unsavedCount = p.dirtyPages.length + (p.siteDirty ? 1 : 0) + (p.theme?.dirty ? 1 : 0);
  const onPublish = () =>
    setConfirm(
      p.anyDirty
        ? {
            title: "先保存，再發布？",
            description: `有 ${unsavedCount} 個檔案尚未保存。會先把它們存成一個版本，再把網站更新成這個版本。`,
            confirmLabel: "保存並發布",
            action: async () => {
              if (await p.saveAll()) await p.publishCloud();
            },
          }
        : {
            title: "發布到網站？",
            description: "網站會在幾秒內更新成目前最新的版本，所有人都看得到。之後仍可在「版本紀錄」還原舊版本。",
            confirmLabel: "發布",
            action: () => p.publishCloud(),
          },
    );

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
  const option = (path) => (
    <option key={path} value={path}>
      {pageLabel(path)}
      {p.dirtyPages.includes(path) ? " ●" : ""}
      {p.pairStatus[path] === "diff" ? " ⚠" : ""}
      {"　" + path}
    </option>
  );
  const switchPage = (path) => {
    p.boundary();
    p.openPage(path);
  };
  return (
    <>
      <div className="editor-heading project-heading">
        <div>
          <h1>
            {p.project.source.name}
            <Badge color={writable ? "teal" : "gray"} variant="soft" className="project-badge">
              {isCloud
                ? "雲端"
                : p.project.source.kind === "directory"
                ? "本機資料夾"
                : p.project.source.kind === "dev"
                  ? "開發伺服器"
                  : p.project.source.kind === "github"
                    ? writable
                      ? "GitHub"
                      : "GitHub 唯讀"
                    : "線上唯讀"}
            </Badge>
          </h1>
          <p>
            {isCloud ? (
              unsavedCount > 0 ? (
                <span className="edit-state dirty">有 {unsavedCount} 個檔案改了還沒保存</span>
              ) : p.cloudSite?.unpublished ? (
                <span className="edit-state pending">已保存，還沒發布：大家看到的還是舊網站</span>
              ) : (
                <span className="edit-state live">大家看到的就是目前這個版本</span>
              )
            ) : !writable
              ? "此來源無法寫回，可下載修改後的頁面。"
              : p.project.source.kind === "github"
                ? "每次保存是一個 commit（含這一頁換的圖片）；網站的 GitHub Pages 一兩分鐘後自動更新。"
                : "保存會直接改寫原始檔；用 git 檢視變更後再提交與推送。"}
          </p>
          {isCloud && p.cloudSite?.url && (
            <p className="site-address">
              網站網址：
              <a href={p.cloudSite.url} target="_blank" rel="noopener">
                {p.cloudSite.url.replace(/^https?:\/\//, "")}
              </a>
            </p>
          )}
        </div>
        <div className="button-row">
          {p.pair && (
            <Button
              variant="ghost"
              className="lang-switch-btn"
              disabled={p.busy}
              onClick={() => switchPage(p.pair)}
              title={"切換到 " + p.pair}
            >
              {p.current.startsWith("en/") ? "中文版" : "English"}
            </Button>
          )}
          <label className="page-picker">
            <span>頁面</span>
            <select value={p.current || ""} onChange={(e) => switchPage(e.target.value)} disabled={p.busy}>
              <optgroup label="中文">{zh.map(option)}</optgroup>
              {en.length > 0 && <optgroup label="English">{en.map(option)}</optgroup>}
            </select>
          </label>
          <IconButton label="復原" onClick={p.undo} disabled={!p.canUndo}>
            <ArrowCounterClockwise size={19} />
          </IconButton>
          <IconButton label="重做" onClick={p.redo} disabled={!p.canRedo}>
            <ArrowClockwise size={19} />
          </IconButton>
          <Button variant="soft" color="gray" onClick={() => setGuide((g) => !g)} aria-expanded={guide}>
            <Question size={18} />
            使用說明
          </Button>
          <Button onClick={() => p.savePage()} disabled={!p.dirty || !writable || p.busy} title="保存這一頁的修改">
            <FloppyDisk size={18} />
            {p.busy ? "處理中" : "保存"}
          </Button>
          {unsavedCount > 1 && (
            <Button variant="surface" onClick={p.saveAll} disabled={!writable || p.busy}>
              全部保存（{unsavedCount}）
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
          {p.canListAssets && (
            <Button variant="surface" onClick={() => setPhotos({ target: null })} title="網站裡所有的照片">
              <Images size={18} />
              照片庫
            </Button>
          )}
          {isCloud && p.cloudSite?.url && (
            <Button variant="surface" onClick={() => window.open(p.cloudSite.url, "_blank", "noopener")} title={"在新分頁打開 " + p.cloudSite.url}>
              <ArrowSquareOut size={18} />
              看網站
            </Button>
          )}
          <IconButton
            label="下載此頁 HTML"
            onClick={() => download(p.html, p.current.split("/").pop(), "text/html")}
          >
            <DownloadSimple size={18} />
          </IconButton>
          <IconButton
            label="關閉專案"
            onClick={() =>
              p.anyDirty
                ? setConfirm({
                    title: "關閉專案？",
                    description: "有 " + unsavedCount + " 個檔案尚未保存，關閉後修改會遺失。",
                    action: p.closeProject,
                  })
                : p.closeProject()
            }
          >
            <X size={18} />
          </IconButton>
        </div>
      </div>
      {p.error && (
        <ErrorMessage text={p.error} onClose={() => p.setError(null)} />
      )}
      {guide && <EditorGuide onClose={() => setGuide(false)} isCloud={isCloud} hasAlbum={!!p.album?.ok} />}
      <div className={"editor-layout project" + (tab === "pair" ? " wide-inspector" : "")}>
        <aside className="inspector">
          <div className="inspector-tabs">
            {[
              ["blocks", "編輯內容"],
              ...(p.album?.ok ? [["album", "活動相簿"]] : []),
              ["site", "研究室資料"],
              ...(p.theme ? [["theme", "外觀"]] : []),
              ["pair", "中英對照"],
              ["head", "分享設定"],
              ...(isCloud ? [["history", "版本紀錄"]] : []),
            ].map(([id, label]) => (
              <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                {label}
                {(id === "site" || id === "album") && p.siteDirty && <span className="unsaved-dot" aria-label="未保存" />}
                {id === "theme" && p.theme?.dirty && <span className="unsaved-dot" aria-label="未保存" />}
                {id === "pair" && p.pairStatus[p.current] === "diff" && <span className="unsaved-dot" aria-label="結構不同" />}
              </button>
            ))}
          </div>
          {tab === "history" && isCloud ? (
            <div className="inspector-body">
              <CloudHistory p={p} setConfirm={setConfirm} />
            </div>
          ) : tab === "theme" && p.theme ? (
            <div className="inspector-body">
              <SiteThemePanel p={p} />
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
              />
              {p.canListAssets && writable && <RelocatePanel p={p} writable={writable} setConfirm={setConfirm} />}
            </div>
          ) : tab === "pair" ? (
            <>
              <SectionList
                sections={sections}
                selected={selected}
                onSelect={(i) => {
                  p.setSelected(i);
                  p.setFocus(null);
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
              />
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
                </>
              )}
            </div>
          ) : (
            <>
              <div className="page-label">
                <FolderOpen size={17} />
                <strong>{pageLabel(p.current)}</strong>
                <span>{p.current}{p.dirty ? " · 未保存" : ""}</span>
              </div>
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
              <div className="inspector-body">
                <h3 className="inspector-subtitle">
                  {sections[selected]?.title}
                  <span className="muted">{sections[selected]?.kind}</span>
                </h3>
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
                <FieldInspector
                  html={p.html}
                  index={selected}
                  focus={p.focus}
                  setFocus={p.setFocus}
                  setText={p.setText}
                  setAttr={p.setAttr}
                  replaceImage={p.replaceImage}
                  openLibrary={p.canListAssets ? (index, path) => setPhotos({ target: { index, path } }) : null}
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
        <PhotoLibrary p={p} open={!!photos} target={photos?.target || null} onClose={() => setPhotos(null)} setConfirm={setConfirm} />
        <SitePreview
          html={p.html}
          pagePath={p.current}
          source={p.previewSource}
          cache={p.cache}
          scrolls={p.scrolls}
          pages={p.pages}
          selected={selected}
          focus={p.focus}
          onSelect={(i, path) => {
            setTab("blocks");
            p.setSelected(i);
            p.setFocus(path);
          }}
          onNavigate={switchPage}
          onDropImage={writable ? (i, path, file) => p.replaceImage(i, path, file) : null}
          canPlayMotion={!!p.theme?.vars["--motion"]}
          device={device}
          setDevice={setDevice}
        />
      </div>
    </>
  );
}
