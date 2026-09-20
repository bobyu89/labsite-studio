import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button, Badge, AlertDialog } from "@radix-ui/themes";
import {
  SquaresFour,
  GlobeHemisphereWest,
  Stack,
  Images,
  ClockCounterClockwise,
  GraduationCap,
  GearSix,
  ArrowRight,
  Check,
  Desktop,
  DeviceMobile,
  DownloadSimple,
  GithubLogo,
  WarningCircle,
  CheckCircle,
  BookOpen,
  Play,
  X,
  SidebarSimple,
  FolderOpen,
} from "@phosphor-icons/react";
import { validate } from "./model";
import { serializeProject } from "./domain/project";
import { useDraft } from "./hooks/useDraft";
import { useProject } from "./hooks/useProject";
import { download, IconButton, Modal } from "./components/ui";
import ImportProject from "./components/ImportProject";
import Overview from "./views/Overview";
import Editor from "./views/Editor";
import Collections from "./views/Collections";
import MediaLibrary from "./views/MediaLibrary";
import Versions from "./views/Versions";
import Academy from "./views/Academy";
import Settings from "./views/Settings";
import Project from "./views/Project";

import { siteDocument } from "./Site";

const sections = [
  ["overview", "工作台", SquaresFour],
  ["project", "真實網站", FolderOpen],
  ["editor", "範例編輯", GlobeHemisphereWest],
  ["content", "內容集合", Stack],
  ["media", "素材庫", Images],
  ["history", "版本紀錄", ClockCounterClockwise],
  ["academy", "建站教室", GraduationCap],
  ["settings", "網站設定", GearSix],
];
export default function App() {
  const [view, setView] = useState("overview");
  const [notice, setNotice] = useState("");
  const {
    draft,
    saved,
    dirty,
    error,
    conflict,
    saving,
    change,
    save,
    loadLatest,
    boundary,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDraft((m) => setNotice(m));
  const p = useProject((m) => setNotice(m));
  const [importOpen, setImportOpen] = useState(false);
  const requestImport = () => setImportOpen(true);
  const [preview, setPreview] = useState(false);
  const [device, setDevice] = useState("desktop");
  const [publish, setPublish] = useState(false);
  const [publishStep, setPublishStep] = useState(-1);
  const [snapshot, setSnapshot] = useState(null);
  const [connection, setConnection] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [selected, setSelected] = useState("hero");
  const [tab, setTab] = useState("blocks");
  const [collection, setCollection] = useState("news");
  const [query, setQuery] = useState("");
  const [lesson, setLesson] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [menu, setMenu] = useState(false);

  const upload = useRef();

  const problems = useMemo(() => validate(draft), [draft]);
  const doc = useMemo(() => siteDocument(draft), [draft]);
  const notify = (m) => setNotice(m);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (publishStep < 0 || publishStep >= 3) return;
    const t = setTimeout(() => setPublishStep((s) => s + 1), 850);
    return () => clearTimeout(t);
  }, [publishStep]);
  function goto(v) {
    boundary();
    setView(v);
    setMenu(false);
    setQuery("");
  }
  function exportBackup() {
    download(serializeProject(draft), "labsite-draft.json", "application/json");
    notify("已下載目前草稿備份。");
  }
  function editCollection(type) {
    setCollection(type);
    goto("content");
  }
  function selectBlock(id) {
    setSelected(id);
    setTab("blocks");
    goto("editor");
  }
  async function addAssets(files) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    for (const file of files) {
      if (!allowed.includes(file.type) || file.size > 2 * 1024 * 1024) {
        notify("請使用 2 MB 以下的 JPG、PNG 或 WebP 圖片。");
        continue;
      }
      if (draft.assets.length >= 8) {
        notify("初版最多保存 8 張圖片，請先移除不需要的素材。");
        break;
      }
      const src = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(file);
      });
      const valid = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
      });
      if (!valid) {
        notify("無法讀取這張圖片，請換一個檔案。");
        continue;
      }
      const assetId = crypto.randomUUID();
      change((d) => {
        if (d.assets.length < 8)
          d.assets.push({
            id: assetId,
            name: file.name,
            src,
            alt: "",
          });
        return d;
      });
      notify("圖片已加入草稿。請填寫替代文字並保存。");
    }
  }
  return (
    <div className="app-shell" onBlurCapture={boundary}>
      <a href="#main" className="skip">
        跳至主要內容
      </a>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            goto("overview");
          }}
        >
          <span className="brand-mark">
            <Stack size={24} weight="bold" />
          </span>
          <span>
            LabSite<span className="brand-studio">STUDIO</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">知</span>
          <div>
            <strong>{draft.name}</strong>
            <span>我的工作區</span>
          </div>
          <Badge variant="soft" color="gray">
            示範
          </Badge>
        </div>
        <p className="nav-label">網站管理</p>
        <nav aria-label="主要導覽">
          {sections.slice(0, 6).map(([id, name, Icon]) => (
            <button
              className={view === id ? "nav-item active" : "nav-item"}
              key={id}
              onClick={() => goto(id)}
            >
              <Icon size={20} weight={view === id ? "duotone" : "regular"} />
              {name}
              {((id === "editor" && dirty) || (id === "project" && p.anyDirty)) && (
                <span className="unsaved-dot" aria-label="有未保存修改" />
              )}
            </button>
          ))}
        </nav>
        <p className="nav-label second">學習與設定</p>
        <nav aria-label="其他功能">
          {sections.slice(6).map(([id, name, Icon]) => (
            <button
              className={view === id ? "nav-item active" : "nav-item"}
              key={id}
              onClick={() => goto(id)}
            >
              <Icon size={20} />
              {name}
              {id === "academy" && <span className="nav-new">入門</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <BookOpen size={22} />
            <strong>第一次建立研究室網站？</strong>
            <p>
              從一段研究室介紹開始，
              <br />
              按照自己的步調完成。
            </p>
            <button onClick={() => goto("academy")}>
              開始第一堂課 <ArrowRight size={16} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">研</span>
            <div>
              <strong>研究室管理者</strong>
              <small>本機示範工作區</small>
            </div>
            <span className="owner">Owner</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              label="開啟導覽"
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
            >
              <SidebarSimple size={22} />
            </IconButton>
            <span>我的工作區</span>
            <span className="slash">/</span>
            <strong>{sections.find((x) => x[0] === view)?.[1]}</strong>
          </div>
          <div className="top-actions">
            <span className={"save-status " + (dirty ? "unsaved" : "")}>
              <span />
              {saving
                ? "正在保存…"
                : dirty
                  ? "有未保存的修改"
                  : saved
                    ? "已保存至本機"
                    : "示範草稿"}
            </span>
            <Badge color="gray" variant="surface">
              前端初版
            </Badge>
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className={"main-content " + (view === "editor" || (view === "project" && p.project) ? "editor-main" : "")}
        >
          {error && (
            <div className="message error" role="alert">
              <WarningCircle size={20} />
              <span>{error}</span>
              <button onClick={exportBackup}>下載備份</button>
            </div>
          )}
          {conflict && (
            <div className="message error" role="alert">
              <WarningCircle size={20} />
              <span>
                另一個分頁已保存新版本。目前修改仍保留，請先下載備份，再載入最新草稿。
              </span>
              <button onClick={exportBackup}>備份我的修改</button>
              <button
                onClick={() =>
                  setConfirm({
                    title: "載入最新草稿？",
                    description: "目前畫面的未保存修改會被取代，請先下載備份。",
                    action: loadLatest,
                  })
                }
              >
                載入最新版本
              </button>
            </div>
          )}
          {view === "overview" && (
            <Overview
              draft={draft}
              saved={saved}
              goto={goto}
              setPreview={setPreview}
              doc={doc}
              selectBlock={selectBlock}
              editCollection={editCollection}
              setConnection={setConnection}
            />
          )}
          {view === "project" && (
            <Project p={p} device={device} setDevice={setDevice} setConfirm={setConfirm} />
          )}
          {view === "editor" && (
            <Editor
              draft={draft}
              change={change}
              save={save}
              saving={saving}
              conflict={conflict}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              setPreview={setPreview}
              openPublish={() => {
                setPublishStep(-1);
                setPublish(true);
              }}
              selected={selected}
              setSelected={setSelected}
              tab={tab}
              setTab={setTab}
              setConfirm={setConfirm}
              editCollection={editCollection}
              device={device}
              setDevice={setDevice}
              doc={doc}
            />
          )}
          {view === "content" && (
            <Collections
              draft={draft}
              change={change}
              collection={collection}
              setCollection={setCollection}
              query={query}
              setQuery={setQuery}
              setConfirm={setConfirm}
              dirty={dirty}
              save={save}
              saving={saving}
              conflict={conflict}
            />
          )}
          {view === "media" && (
            <MediaLibrary
              draft={draft}
              change={change}
              upload={upload}
              addAssets={addAssets}
              setConfirm={setConfirm}
              save={save}
              saving={saving}
              conflict={conflict}
            />
          )}
          {view === "history" && (
            <Versions
              saved={saved}
              exportBackup={exportBackup}
              setConfirm={setConfirm}
              change={change}
              notify={notify}
              goto={goto}
            />
          )}
          {view === "academy" && (
            <Academy completed={completed} setLesson={setLesson} />
          )}
          {view === "settings" && (
            <Settings
              draft={draft}
              change={change}
              save={save}
              saving={saving}
              conflict={conflict}
              setConnection={setConnection}
              exportBackup={exportBackup}
              doc={doc}
              notify={notify}
              requestImport={requestImport}
            />
          )}
        </main>
      </div>
      <ImportProject
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onBackup={exportBackup}
        onApply={(doc) => {
          change(() => doc);
          setSelected(doc.pages[0].blocks[0].id);
          setTab("blocks");
          goto("editor");
          notify("備份已載入為草稿，請確認後保存。");
        }}
      />
      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        title="網站預覽"
        description="這是目前畫面的草稿內容，尚未發布。"
        wide
      >
        <div className="preview-toolbar">
          <div className="device-picker">
            <Button
              variant={device === "desktop" ? "soft" : "ghost"}
              onClick={() => setDevice("desktop")}
            >
              <Desktop size={18} />
              桌面
            </Button>
            <Button
              variant={device === "mobile" ? "soft" : "ghost"}
              onClick={() => setDevice("mobile")}
            >
              <DeviceMobile size={18} />
              手機
            </Button>
          </div>
          <Button
            variant="surface"
            onClick={() => download(doc, "labsite-website.html", "text/html")}
          >
            <DownloadSimple size={17} />
            匯出網站
          </Button>
        </div>
        <div className={"full-preview " + device}>
          <iframe
            title="完整網站預覽"
            srcDoc={doc}
            sandbox="allow-same-origin"
          />
        </div>
      </Modal>
      <Modal
        open={connection}
        onClose={() => setConnection(false)}
        title="連接你的 GitHub"
        description="初版尚未接上授權服務，不會要求你輸入密碼或權杖。"
      >
        <div className="connection-explainer">
          <GithubLogo size={38} />
          <p>
            正式版會引導你前往 GitHub 官方授權頁面，只授權這個網站需要的儲存庫。
          </p>
          <ul>
            <li>先完成平台帳號與 Email 驗證。</li>
            <li>使用研究室自己的 GitHub 帳號授權。</li>
            <li>確認指定儲存庫與 GitHub Pages 設定。</li>
            <li>正式網址驗證通過後，才顯示發布成功。</li>
          </ul>
        </div>
        <div className="dialog-actions">
          <Button
            variant="surface"
            onClick={() => {
              setConnection(false);
              goto("editor");
            }}
          >
            繼續編輯草稿
          </Button>
          <Button
            onClick={() => {
              setConnection(false);
              setPublish(true);
              setPublishStep(-1);
            }}
          >
            先查看發布檢查
          </Button>
        </div>
      </Modal>
      <Modal
        open={publish}
        onClose={() => setPublish(false)}
        title="發布前檢查"
        description="目前為前端示範，尚無可公開的線上版本。"
      >
        <div className="publish-checks">
          {[
            [
              !dirty && !!saved,
              "草稿已保存至本機",
              dirty
                ? "請先保存目前的修改。"
                : saved
                  ? "已保存 v" + saved.revision
                  : "請先保存第一份草稿。",
            ],
            [
              problems.length === 0,
              "內容完整性檢查",
              problems.length
                ? problems.join("；")
                : "標題、聯絡資訊與圖片說明已通過。",
            ],
            [
              false,
              "連接 GitHub 與發布服務",
              "正式帳號驗證、雲端保存及部署服務尚未串接。",
            ],
          ].map(([ok, title, desc]) => (
            <div className="check-row" key={title}>
              {ok ? (
                <CheckCircle size={23} className="accent" />
              ) : (
                <WarningCircle size={23} className="muted" />
              )}
              <div>
                <strong>{title}</strong>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
        {publishStep >= 0 && (
          <div className="rehearsal" role="status">
            <Badge color="gray">流程演練，不會對外發布</Badge>
            <ol>
              {["固定目前草稿快照", "檢查內容格式", "準備本機預覽"].map(
                (label, i) => (
                  <li key={label}>
                    {publishStep > i ? (
                      <Check size={17} />
                    ) : (
                      <span className="step-dot" />
                    )}
                    {label}
                    {publishStep === i && "…"}
                  </li>
                ),
              )}
            </ol>
            {publishStep === 3 && (
              <p>
                <strong>演練完成，網站尚未上線。</strong>
                <br />
                已固定草稿 v{snapshot?.revision}。正式發布仍需串接後端與
                GitHub。
              </p>
            )}
          </div>
        )}
        <div className="dialog-actions">
          <Button
            variant="surface"
            onClick={() => {
              setPublish(false);
              setConnection(true);
            }}
          >
            查看連接需求
          </Button>
          <Button
            disabled={
              dirty ||
              !saved ||
              problems.length > 0 ||
              conflict ||
              (publishStep >= 0 && publishStep < 3)
            }
            onClick={() => {
              setSnapshot(structuredClone(saved));
              setPublishStep(0);
            }}
          >
            <Play size={17} />
            演練發布流程
          </Button>
        </div>
      </Modal>
      <Modal
        open={lesson !== null}
        onClose={() => setLesson(null)}
        title={
          [
            "寫下研究室的第一段介紹",
            "整理內容，認識共用集合",
            "分清草稿、預覽與發布",
          ][lesson ?? 0]
        }
        description="閱讀提示後，到工作台完成一個小練習。"
      >
        <div className="lesson-body">
          {lesson === 0 ? (
            <>
              <h3>先回答三個問題</h3>
              <ol>
                <li>你們想解決什麼問題？</li>
                <li>你們如何研究這個問題？</li>
                <li>這份研究可能幫助誰？</li>
              </ol>
              <blockquote>
                我們關心〔對象〕在〔情境〕中的需要，透過〔方法〕探索〔研究主題〕，希望讓〔具體改變〕成為可能。
              </blockquote>
              <p>練習：將首頁介紹改成 2 至 3 句容易理解的文字，再保存。</p>
            </>
          ) : lesson === 1 ? (
            <>
              <h3>內容與版型分開管理</h3>
              <p>
                「最新消息」是共用集合。如果同時放入兩個消息區塊，修改一則消息會同步更新兩處。
              </p>
              <p>練習：新增一則消息，填入標題、日期與內文，再打開預覽。</p>
            </>
          ) : (
            <>
              <h3>三個不同的動作</h3>
              <p>
                <strong>保存：</strong>
                留下可繼續編輯的草稿。此初版僅保存在本機。
              </p>
              <p>
                <strong>預覽：</strong>查看目前的網站外觀，不會公開內容。
              </p>
              <p>
                <strong>發布：</strong>
                正式服務需建立固定版本，部署後驗證網址，才算成功。
              </p>
              <p>練習：開啟發布檢查，了解目前尚缺哪些條件。</p>
            </>
          )}
        </div>
        <div className="dialog-actions">
          <Button
            variant="surface"
            onClick={() => {
              setCompleted((v) => [...new Set([...v, lesson])]);
              setLesson(null);
            }}
          >
            標記已讀
          </Button>
          <Button
            onClick={() => {
              const n = lesson;
              setLesson(null);
              if (n === 0) selectBlock("hero");
              else if (n === 1) editCollection("news");
              else {
                setPublishStep(-1);
                setPublish(true);
              }
            }}
          >
            前往練習 <ArrowRight size={17} />
          </Button>
        </div>
      </Modal>
      <AlertDialog.Root
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
      >
        <AlertDialog.Content maxWidth="460px">
          <AlertDialog.Title>{confirm?.title}</AlertDialog.Title>
          <AlertDialog.Description>
            {confirm?.description}
          </AlertDialog.Description>
          <div className="dialog-actions">
            <AlertDialog.Cancel>
              <Button variant="surface">取消</Button>
            </AlertDialog.Cancel>
            <Button
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              確認
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Root>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle size={21} />
          {notice}
          <button aria-label="關閉通知" onClick={() => setNotice("")}>
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
