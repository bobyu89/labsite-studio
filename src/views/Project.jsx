import React, { useMemo, useState } from "react";
import { Button, Badge } from "@radix-ui/themes";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  FloppyDisk,
  DownloadSimple,
  FolderOpen,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { IconButton, Field, download } from "../components/ui";
import ProjectOpen from "../components/ProjectOpen";
import SectionList from "../components/SectionList";
import FieldInspector from "../components/FieldInspector";
import SitePreview from "../components/SitePreview";
import SiteDataPanel from "../components/SiteDataPanel";
import { parsePage, listSections, readHead } from "../site/page.js";
import { pageLabel } from "../hooks/useProject";

export default function Project({ p, device, setDevice, setConfirm }) {
  const [tab, setTab] = useState("blocks");
  const parsed = useMemo(() => (p.html ? parsePage(p.html) : null), [p.html]);
  const sections = useMemo(() => (parsed ? listSections(parsed.doc) : []), [parsed]);
  const head = useMemo(() => (parsed ? readHead(parsed.doc) : null), [parsed]);
  const selected = Math.min(p.selected, Math.max(0, sections.length - 1));
  const writable = !!p.project?.source.writable;

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
              {p.project.source.kind === "directory"
                ? "本機資料夾"
                : p.project.source.kind === "dev"
                  ? "開發伺服器"
                  : "線上唯讀"}
            </Badge>
          </h1>
          <p>
            {writable
              ? "保存會直接改寫原始檔；用 git 檢視變更後再提交與推送。"
              : "此來源無法寫回，可下載修改後的頁面。"}
          </p>
        </div>
        <div className="button-row">
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
          <Button onClick={() => p.savePage()} disabled={!p.dirty || !writable || p.busy}>
            <FloppyDisk size={18} />
            {p.busy ? "處理中" : "保存此頁"}
          </Button>
          {p.dirtyPages.length + (p.siteDirty ? 1 : 0) > 1 && (
            <Button variant="surface" onClick={p.saveAll} disabled={!writable || p.busy}>
              全部保存（{p.dirtyPages.length + (p.siteDirty ? 1 : 0)}）
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
                    description: "有 " + (p.dirtyPages.length + (p.siteDirty ? 1 : 0)) + " 個檔案尚未保存，關閉後修改會遺失。",
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
        <div className="message error" role="alert">
          <WarningCircle size={20} />
          <span>{p.error}</span>
          <button onClick={() => p.setError(null)}>關閉</button>
        </div>
      )}
      <div className="editor-layout project">
        <aside className="inspector">
          <div className="inspector-tabs">
            {[
              ["blocks", "頁面區塊"],
              ["head", "頁面資訊"],
              ["site", "網站資料"],
            ].map(([id, label]) => (
              <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                {label}
                {id === "site" && p.siteDirty && <span className="unsaved-dot" aria-label="未保存" />}
              </button>
            ))}
          </div>
          {tab === "site" ? (
            <div className="inspector-body">
              <SiteDataPanel
                siteData={p.siteData}
                siteDirty={p.siteDirty}
                setSiteField={p.setSiteField}
                saveSiteData={p.saveSiteData}
                writable={writable}
                busy={p.busy}
              />
            </div>
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
                <h3 className="inspector-subtitle">
                  {sections[selected]?.title}
                  <span className="muted">{sections[selected]?.kind}</span>
                </h3>
                <FieldInspector
                  html={p.html}
                  index={selected}
                  focus={p.focus}
                  setFocus={p.setFocus}
                  setText={p.setText}
                  setAttr={p.setAttr}
                  replaceImage={p.replaceImage}
                  writable={writable}
                  busy={p.busy}
                />
              </div>
            </>
          )}
        </aside>
        <SitePreview
          html={p.html}
          pagePath={p.current}
          source={p.project.source}
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
          device={device}
          setDevice={setDevice}
        />
      </div>
    </>
  );
}
