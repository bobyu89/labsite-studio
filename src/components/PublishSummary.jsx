// Shown in the 發布 confirmation: every saved change that would go live, by
// person, so nobody publishes someone else's half-finished work by surprise.
import React from "react";

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
