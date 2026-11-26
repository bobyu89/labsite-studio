// 在頁面上留言: notes on the selected section for the others who edit the
// site ("這裡的日期請再確認"), marked 已處理 when done.
import React, { useState } from "react";
import { ChatCircleText, Check, Trash } from "@phosphor-icons/react";

const when = (t) => new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(t);
const nameOf = (email) => String(email || "").split("@")[0];

// Where a note is now: its section if the title still matches, else the
// section with that title, else the same position.
export function sectionOf(comment, sections) {
  if (sections[comment.section]?.title === comment.anchor) return comment.section;
  const byTitle = sections.findIndex((s) => s.title && s.title === comment.anchor);
  if (byTitle >= 0) return byTitle;
  return comment.section < sections.length ? comment.section : null;
}

export default function Comments({ p, page, sections, selected, me, teacher }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const all = (p.comments?.list || []).filter((c) => c.page === page && sectionOf(c, sections) === selected);
  const open = all.filter((c) => !c.resolvedAt);
  const done = all.filter((c) => c.resolvedAt);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await p.comments.add({ page, section: selected, anchor: sections[selected]?.title || "", body: text.trim() });
      setText("");
    } catch (err) {
      p.setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="comments">
      <div className="comments-head">
        <ChatCircleText size={16} />
        <strong>留言</strong>
        {open.length > 0 && <span className="comments-count">{open.length}</span>}
      </div>
      {open.map((c) => (
        <div className="comment" key={c.id}>
          <p className="comment-meta">
            <strong>{nameOf(c.author)}</strong> <span className="muted">{when(c.at)}</span>
          </p>
          <p className="comment-body">{c.body}</p>
          <div className="comment-actions">
            <button type="button" className="text-link" onClick={() => p.comments.resolve(c.id, true)}>
              <Check size={13} /> 已處理
            </button>
            {(c.author === me || teacher) && (
              <button type="button" className="text-link muted" onClick={() => p.comments.remove(c.id)} aria-label="刪掉這則留言">
                <Trash size={13} />
              </button>
            )}
          </div>
        </div>
      ))}
      {done.length > 0 && (
        <button type="button" className="text-link muted comments-done-toggle" onClick={() => setShowDone(!showDone)}>
          {showDone ? "收起" : `看已處理的 ${done.length} 則`}
        </button>
      )}
      {showDone &&
        done.map((c) => (
          <div className="comment done" key={c.id}>
            <p className="comment-meta">
              <strong>{nameOf(c.author)}</strong> <span className="muted">{when(c.at)} · {nameOf(c.resolvedBy)} 已處理</span>
            </p>
            <p className="comment-body">{c.body}</p>
            <button type="button" className="text-link muted" onClick={() => p.comments.resolve(c.id, false)}>
              重新打開
            </button>
          </div>
        ))}
      <form className="comment-form" onSubmit={send}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="留言給一起編輯的人，例如：這裡的日期請再確認" aria-label="新增留言" />
        <button type="submit" className="text-link" disabled={busy || !text.trim()}>
          送出留言
        </button>
      </form>
    </div>
  );
}
