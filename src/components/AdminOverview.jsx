// 總覽 (admins only): every site's state, who can edit, recent activity, and
// what needs attention (unpublished saves, failed backups, sites nobody edits).
// Data comes from GET /api/admin/overview (cloud/src/overview.js).
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { WarningCircle, ArrowClockwise, ArrowSquareOut, PencilSimple } from "@phosphor-icons/react";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
export function ago(t, now = Date.now()) {
  if (!t) return "";
  const d = now - t;
  if (d < 2 * MINUTE) return "剛剛";
  if (d < HOUR) return Math.floor(d / MINUTE) + " 分鐘前";
  if (d < DAY) return Math.floor(d / HOUR) + " 小時前";
  if (d < 30 * DAY) return Math.floor(d / DAY) + " 天前";
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(t);
}
const size = (b) => (b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
const who = (email) => (email ? email.split("@")[0] : "");

// Things worth the admin's attention, errors first.
export function overviewNotes(sites, now = Date.now()) {
  const notes = [];
  for (const s of sites) {
    if (s.flags.includes("stale"))
      notes.push({
        title: s.name,
        tag: "待發布",
        level: "warn",
        text: `有 ${s.pending} 個保存的版本還沒發布，最後一次保存是 ${ago(s.lastSave?.at, now)}（${who(s.lastSave?.by)}）。老師可能忘了按「發布」。`,
      });
    if (s.flags.includes("backup"))
      notes.push({ title: s.name, tag: "備份", level: "error", text: "GitHub 備份失敗：" + (s.backup?.error || "原因不明") + "。" });
  }
  const nobody = sites.filter((s) => s.flags.includes("nobody"));
  if (nobody.length)
    notes.push({
      title: nobody.length === 1 ? nobody[0].name : nobody.length + " 個網站",
      tag: "沒有成員",
      level: "info",
      text:
        (nobody.length > 1 ? nobody.map((s) => s.name).join("、") + " " : "") +
        "還沒有成員，只有管理者能編輯。要讓老師編輯，到網站卡片的「成員」加入他的 Email。",
    });
  const rank = { error: 0, warn: 1, info: 2 };
  return notes.sort((a, b) => rank[a.level] - rank[b.level]);
}

const ACTIVITY = {
  save: (a) => a.text + (a.files ? `（${a.files} 個檔案）` : ""),
  publish: () => "發布到網站",
  restore: () => "還原到舊版本",
  import: (a) => "建立網站" + (a.text ? "：" + a.text : ""),
  member_add: (a) => "加入成員 " + a.text,
  member_remove: (a) => "移除成員 " + a.text,
};

export default function AdminOverview({ p }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await p.cloudCalls.overview());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  if (error)
    return (
      <div className="message error" role="alert">
        <WarningCircle size={20} />
        <span>讀不到總覽：{error}</span>
        <button onClick={load}>再試一次</button>
      </div>
    );
  if (!data) return <p className="muted">讀取中…</p>;
  const { sites, people, activity, now } = data;
  const notes = overviewNotes(sites, now);
  const pendingSites = sites.filter((s) => s.pending).length;
  const withPassword = people.filter((x) => x.hasPassword).length;
  const editors = people.filter((x) => x.sites.length);
  const open = (id) => {
    const site = p.cloud.me.sites.find((s) => s.id === id);
    if (site) p.openCloud(site);
  };
  return (
    <div className="admin-overview">
      <div className="ov-summary" role="list">
        <div role="listitem">
          <b>{sites.length}</b>
          <span>個網站</span>
        </div>
        <div role="listitem" className={pendingSites ? "is-warn" : ""}>
          <b>{pendingSites}</b>
          <span>個網站有修改待發布</span>
        </div>
        <div role="listitem">
          <b>{editors.length}</b>
          <span>位編輯者，{withPassword} 位設了密碼</span>
        </div>
        <div role="listitem" className={notes.some((n) => n.level === "error") ? "is-error" : ""}>
          <b>{notes.filter((n) => n.level !== "info").length}</b>
          <span>件需要處理</span>
        </div>
      </div>

      <section className="ov-section">
        <div className="ov-head">
          <h2>需要注意</h2>
          <Button variant="ghost" size="2" onClick={load} disabled={loading}>
            <ArrowClockwise size={16} /> 重新整理
          </Button>
        </div>
        {notes.length ? (
          <ul className="ov-notes">
            {notes.map((n, i) => (
              <li key={i} className={"ov-note " + n.level}>
                <span className="ov-note-head">
                  <span className="ov-tag">{n.tag}</span>
                  <strong>{n.title}</strong>
                </span>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">目前沒有需要處理的事：每個網站都已發布、備份正常、也都有成員。</p>
        )}
      </section>

      <section className="ov-section">
        <h2>網站</h2>
        <div className="ov-table ov-sites" role="table" aria-label="網站">
          <div className="ov-row ov-th" role="row">
            <span role="columnheader">網站</span>
            <span role="columnheader">狀態</span>
            <span role="columnheader">最後保存</span>
            <span role="columnheader">最後發布</span>
            <span role="columnheader">成員</span>
            <span role="columnheader">大小</span>
            <span role="columnheader" className="sr-only">
              操作
            </span>
          </div>
          {sites.map((s) => (
            <div key={s.id} className="ov-row" role="row">
              <span role="cell" className="ov-name">
                <strong>{s.name}</strong>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="ov-url">
                    /{s.slug}/ <ArrowSquareOut size={12} />
                  </a>
                )}
              </span>
              <span role="cell" data-label="狀態">
                {s.pending ? <span className="ov-pill warn">{s.pending} 個版本待發布</span> : <span className="ov-pill ok">已發布</span>}
              </span>
              <span role="cell" data-label="最後保存">
                {s.lastSave ? (
                  <>
                    {ago(s.lastSave.at, now)}
                    <small>{who(s.lastSave.by)}</small>
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span role="cell" data-label="最後發布">
                {s.lastPublish ? (
                  <>
                    {ago(s.lastPublish.at, now)}
                    {s.lastPublish.by && <small>{who(s.lastPublish.by)}</small>}
                  </>
                ) : (
                  "還沒發布過"
                )}
              </span>
              <span role="cell" data-label="成員">
                {s.members.length ? s.members.map(who).join("、") : <span className="muted">（無）</span>}
              </span>
              <span role="cell" data-label="大小" className="ov-num">
                {size(s.bytes)}
                <small>{s.files} 個檔案</small>
              </span>
              <span role="cell" className="ov-act">
                <Button size="1" variant="surface" onClick={() => open(s.id)} disabled={p.busy}>
                  <PencilSimple size={14} /> 編輯
                </Button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="ov-section">
        <h2>成員</h2>
        {people.length ? (
          <div className="ov-table ov-people" role="table" aria-label="成員">
            <div className="ov-row ov-th" role="row">
              <span role="columnheader">Email</span>
              <span role="columnheader">可以編輯</span>
              <span role="columnheader">密碼</span>
              <span role="columnheader">最近使用</span>
            </div>
            {people.map((x) => (
              <div key={x.email} className="ov-row" role="row">
                <span role="cell" className="ov-name">
                  <strong>{x.email}</strong>
                  {x.admin && <small>管理者</small>}
                </span>
                <span role="cell" data-label="可以編輯">
                  {x.sites.length ? x.sites.join("、") : <span className="muted">{x.admin ? "全部網站" : "（沒有網站）"}</span>}
                </span>
                <span role="cell" data-label="密碼">
                  {x.hasPassword ? <span className="ov-pill ok">已設定</span> : <span className="ov-pill">未設定</span>}
                </span>
                <span role="cell" data-label="最近使用">
                  {x.lastSeen ? ago(x.lastSeen, now) : <span className="muted">還沒登入過</span>}
                  {x.signedIn && <small>登入中</small>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">還沒有任何成員。在網站卡片的「成員」加入老師的 Email。</p>
        )}
        <p className="small-note">「最近使用」以登入狀態推算，誤差在一天以內。沒設密碼的老師換電腦就要重新要登入連結，可以提醒他們設定。</p>
      </section>

      <section className="ov-section">
        <h2>近期動態</h2>
        {activity.length ? (
          <ol className="ov-activity">
            {activity.map((a, i) => (
              <li key={i} className={"ov-act-" + a.kind}>
                <time dateTime={new Date(a.at).toISOString()} title={new Date(a.at).toLocaleString("zh-TW")}>
                  {ago(a.at, now)}
                </time>
                <span>
                  <strong>{a.site}</strong>・{who(a.by)}・{(ACTIVITY[a.kind] || ((x) => x.kind))(a)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">還沒有任何動態。</p>
        )}
      </section>
    </div>
  );
}
