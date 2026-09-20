import React from "react";
import { Button, Badge } from "@radix-ui/themes";
import {
  Stack,
  Images,
  ClockCounterClockwise,
  GraduationCap,
  ArrowUpRight,
  ArrowRight,
  Check,
  Eye,
  PencilSimple,
  FileText,
  Signpost,
  FolderOpen,
} from "@phosphor-icons/react";

const time = (s) =>
  new Date(s).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Overview({
  draft,
  saved,
  goto,
  setPreview,
  doc,
  selectBlock,
  editCollection,
  setConnection,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR RESEARCH, CONNECTED.</div>
          <h1>讓好研究，被看見。</h1>
          <p>從這裡照顧你的網站，把時間留給真正重要的研究。</p>
        </div>
        <Button size="3" onClick={() => goto("editor")}>
          <PencilSimple size={18} />
          繼續編輯網站
          <ArrowRight size={18} />
        </Button>
      </div>
      <div className="overview-grid">
        <section className="site-card">
          <div className="card-heading">
            <div>
              <h2>我的研究室網站</h2>
              <span className="muted">
                {draft.name} <span className="separator">·</span> 學術研究模板
              </span>
            </div>
            <Badge color="gray">尚未發布</Badge>
          </div>
          <button
            className="site-thumbnail"
            onClick={() => setPreview(true)}
            aria-label="開啟網站預覽"
          >
            <iframe
              srcDoc={doc}
              title="研究室網站縮圖"
              tabIndex={-1}
              sandbox=""
            />
            <span className="preview-float">
              <Eye size={18} />
              查看完整預覽
            </span>
          </button>
          <div className="site-card-footer">
            <div className="draft-meta">
              <span className="status-icon">
                <FileText size={19} />
              </span>
              <div>
                <strong>
                  {saved
                    ? "本機草稿 v" + saved.revision
                    : "準備好你的第一份草稿"}
                </strong>
                <span>
                  {saved
                    ? "最近保存於 " + time(saved.savedAt)
                    : "範例內容可自由修改"}
                </span>
              </div>
            </div>
            <Button variant="surface" onClick={() => setPreview(true)}>
              <Eye size={17} />
              預覽
            </Button>
          </div>
        </section>
        <aside className="setup-panel">
          <span className="label-icon">
            <Signpost size={18} />
            你的建站路徑
          </span>
          <h2>
            離公開分享，
            <br />
            再近一步。
          </h2>
          <p>
            可以先完成內容，
            <br />
            準備好後再設定發布。
          </p>
          <ol className="setup-list">
            <li className="done">
              <span>
                <Check size={16} />
              </span>
              <div>
                <strong>選擇網站模板</strong>
                <small>已載入學術研究範例</small>
              </div>
            </li>
            <li className={saved ? "done" : "current"}>
              <span>{saved ? <Check size={16} /> : 2}</span>
              <div>
                <strong>編輯並保存草稿</strong>
                <small>
                  {saved ? "已保存至此瀏覽器" : "寫下你們的研究故事"}
                </small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>連接 GitHub</strong>
                <small>首次發布前再完成</small>
              </div>
            </li>
            <li>
              <span>4</span>
              <div>
                <strong>發布研究室網站</strong>
                <small>確認正式網址後才算上線</small>
              </div>
            </li>
          </ol>
          <button className="text-link" onClick={() => setConnection(true)}>
            了解發布設定 <ArrowUpRight size={17} />
          </button>
        </aside>
      </div>
      <div className="section-heading">
        <h2>今天，想更新什麼？</h2>
        <span>小小的更新，讓網站持續生長。</span>
      </div>
      <div className="quick-grid">
        {[
          [
            FolderOpen,
            "真實網站",
            "開啟研究室網站原始檔，直接修改",
            () => goto("project"),
          ],
          [
            PencilSimple,
            "研究室介紹",
            "讓訪客認識你們正在做的事",
            () => selectBlock("hero"),
          ],
          [
            Stack,
            "最新消息",
            "分享近期活動與研究動態",
            () => editCollection("news"),
          ],
          [Images, "照片與素材", "整理網站會用到的圖片", () => goto("media")],
        ].map(([Icon, title, desc, action]) => (
          <button className="quick-action" key={title} onClick={action}>
            <span className="quick-icon">
              <Icon size={24} />
            </span>
            <strong>{title}</strong>
            <span>{desc}</span>
            <ArrowUpRight className="quick-arrow" size={20} />
          </button>
        ))}
      </div>
      <div className="bottom-grid">
        <section className="recent">
          <div className="section-heading">
            <h2>最近的草稿</h2>
            <button className="text-link" onClick={() => goto("history")}>
              版本紀錄 <ArrowRight size={16} />
            </button>
          </div>
          {saved ? (
            saved.history.slice(0, 2).map((h) => (
              <div className="recent-row" key={h.revision}>
                <span className="history-icon">
                  <ClockCounterClockwise size={20} />
                </span>
                <div>
                  <strong>網站草稿 v{h.revision}</strong>
                  <small>{h.draft.name} · 已保存至本機</small>
                </div>
                <time>{time(h.savedAt)}</time>
              </div>
            ))
          ) : (
            <div className="recent-row">
              <span className="history-icon">
                <FileText size={22} />
              </span>
              <div>
                <strong>一切從第一份草稿開始</strong>
                <small>保存後，你可以在這裡找到過去的版本。</small>
              </div>
            </div>
          )}
        </section>
        <button className="academy-banner" onClick={() => goto("academy")}>
          <GraduationCap size={30} />
          <div>
            <span>LABSITE ACADEMY</span>
            <h3>你專心研究，建站我們一起學。</h3>
            <p>3 個小練習，熟悉你的網站工作台。</p>
          </div>
          <ArrowUpRight size={24} />
        </button>
      </div>
      <div className="local-note">
        <span>示範資料，非真實研究室資訊。</span>
        <span>草稿僅存於此瀏覽器，尚未連接雲端服務。</span>
      </div>
    </>
  );
}
