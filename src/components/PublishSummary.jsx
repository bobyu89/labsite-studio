// Shown in the 發布 confirmation: every saved change that would go live, by
// person, so nobody publishes someone else's half-finished work by surprise.
import React from "react";
import { CheckCircle, Warning, Info } from "@phosphor-icons/react";
import { pageLabel } from "../hooks/useProject";

const when = (t) => new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(t);

export default function PublishSummary({ pending, unsaved = [], me }) {
  if (pending === null) return <p className="small-note">（讀不到待發布的清單，仍可以發布。）</p>;
  const byAuthor = new Map();
  for (const c of pending.commits) {
    if (!byAuthor.has(c.author)) byAuthor.set(c.author, []);
    byAuthor.get(c.author).push(c);
  }
  const others = [...byAuthor.keys()].filter((a) => a !== me);
  return (
    <div className="publish-summary">
      {unsaved.length > 0 && (
        <section>
          <strong>你還沒保存的（會先保存）</strong>
          <ul>
            <li>{unsaved.join("、")}</li>
          </ul>
        </section>
      )}
      {[...byAuthor].map(([author, commits]) => (
        <section key={author}>
          <strong>{author === me ? "你保存的" : author + " 保存的"}</strong>
          <ul>
            {commits.slice(0, 6).map((c) => (
              <li key={c.id}>
                {c.message} <span className="muted">{when(c.at)}</span>
              </li>
            ))}
            {commits.length > 6 && <li className="muted">還有 {commits.length - 6} 筆較早的修改</li>}
          </ul>
        </section>
      ))}
      {pending.commits.length === 0 && unsaved.length === 0 && <p className="small-note">沒有新的修改。</p>}
      {others.length > 0 && (
        <p className="warn-note small-note">
          這次也會發布 {others.join("、")} 的修改。如果對方還在改，可以先問一下再發布。
        </p>
      )}
      {pending.files.length > 0 && <p className="small-note">共 {pending.files.length} 個檔案會更新。</p>}
    </div>
  );
}

const checkPlace = (page) => (page ? pageLabel(page) + (page.startsWith("en/") ? "（英文）" : "") : "研究室資料");

// The pre-publish check (publishCheck.js): what still looks unfinished. It
// never blocks publishing; "去修改" jumps to the page (or the site data tab).
export function PublishChecks({ checks, onOpen }) {
  if (checks === null) return <p className="small-note">（發布前檢查沒有完成，仍可以發布。）</p>;
  if (!checks.length)
    return (
      <p className="check-ok">
        <CheckCircle size={18} weight="fill" /> 發布前檢查：沒有發現範例文字、示意圖或壞掉的連結。
      </p>
    );
  const warns = checks.filter((c) => c.level === "warn");
  return (
    <div className="publish-checks">
      <strong className="publish-checks-title">
        {warns.length ? `發布前檢查：有 ${warns.reduce((n, c) => n + c.total, 0)} 處看起來還沒完成` : "發布前檢查：有幾個小建議"}
      </strong>
      {checks.map((c) => (
        <details key={c.kind} className={"check-group " + c.level} open={c.level === "warn" && checks.length <= 2}>
          <summary>
            {c.level === "warn" ? <Warning size={17} /> : <Info size={17} />}
            <span>
              {c.title}
              <b>{c.total} 處</b>
            </span>
          </summary>
          <p className="small-note">{c.hint}</p>
          <ul>
            {c.items.map((it) => (
              <li key={it.page || "site"}>
                <span className="check-page">
                  {checkPlace(it.page)}
                  <span className="muted">（{it.count}）</span>
                </span>
                <span className="check-examples">{it.examples.join("、")}</span>
                {onOpen && (
                  <button type="button" className="text-link" onClick={() => onOpen(it.page)}>
                    去修改
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
      <p className="small-note">這些不會擋住發布；如果是刻意保留的，可以直接發布。</p>
    </div>
  );
}
