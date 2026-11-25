// 看改了什麼: the changes between two versions, page by page and section by
// section, with the changed words marked (diff.js). from / to are commit
// ids, "published" or "draft"; files: [[path, "added" | "modified" | "deleted"]].
import React, { useEffect, useState } from "react";
import { pageLines, textLines, changes, inlineDiff, fileKind } from "../site/diff.js";
import { pageLabel } from "../hooks/useProject";

const MAX_FILES = 15;

function Marked({ parts, cls }) {
  return parts.map((x, i) =>
    x.changed ? (
      <mark key={i} className={cls}>
        {x.text}
      </mark>
    ) : (
      <span key={i}>{x.text}</span>
    ),
  );
}

function Rows({ groups }) {
  return groups.map((g, gi) => (
    <div className="diff-group" key={gi}>
      {g.where && <div className="diff-where">{g.where}</div>}
      {g.rows.map((r, i) => {
        if (r.op === "change") {
          const d = inlineDiff(r.before, r.after);
          return (
            <div className="diff-row change" key={i}>
              <p className="diff-before">
                <span className="diff-sign">改前</span>
                <Marked parts={d.before} cls="diff-out" />
              </p>
              <p className="diff-after">
                <span className="diff-sign">改後</span>
                <Marked parts={d.after} cls="diff-in" />
              </p>
            </div>
          );
        }
        return (
          <p className={"diff-row " + r.op} key={i}>
            <span className="diff-sign">{r.op === "add" ? "新增" : "刪除"}</span>
            {r.op === "add" ? r.after : r.before}
          </p>
        );
      })}
    </div>
  ));
}

const fileName = (path) => {
  const kind = fileKind(path);
  if (kind === "page") return pageLabel(path) + (path.startsWith("en/") ? "（英文）" : "");
  if (path === "js/data.js") return "研究室資料與最新消息";
  return path;
};

export default function DiffView({ p, from, to, files }) {
  const siteId = p.cloudSite?.id;
  const [state, setState] = useState(null); // [{ path, kind, status, groups }] or { error }
  const key = [from, to, files.map((f) => f.join(":")).join(",")].join("|");
  useEffect(() => {
    if (!siteId) return;
    let alive = true;
    setState(null);
    (async () => {
      const list = files.slice(0, MAX_FILES);
      const out = await Promise.all(
        list.map(async ([path, status]) => {
          const kind = fileKind(path);
          if (kind === "file" || kind === "style") return { path, kind, status };
          const [a, b] = await Promise.all([
            status === "added" || !from ? null : p.cloudCalls.readAt(siteId, path, from),
            status === "deleted" ? null : p.cloudCalls.readAt(siteId, path, to),
          ]);
          const lines = kind === "page" ? pageLines : textLines;
          return { path, kind, status, groups: changes(lines(a), lines(b)) };
        }),
      ).catch((e) => ({ error: e.message }));
      if (alive) setState(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, key]);

  if (!state) return <p className="small-note">正在比對…</p>;
  if (state.error) return <p className="small-note error-text">{state.error}</p>;
  const others = state.filter((x) => x.kind === "file" || x.kind === "style");
  const shown = state.filter((x) => x.groups);
  return (
    <div className="diff-view">
      {shown.map((f) => (
        <section key={f.path} className="diff-file">
          <h4>
            {fileName(f.path)}
            {f.status !== "modified" && <span className={"chg chg-" + f.status}>{f.status === "added" ? "新頁面" : "刪除"}</span>}
          </h4>
          {f.groups.length ? <Rows groups={f.groups} /> : <p className="small-note">文字沒有變，可能只改了排版或樣式。</p>}
        </section>
      ))}
      {others.length > 0 && (
        <p className="small-note diff-others">
          另外{others.some((x) => x.kind === "style") ? "改了外觀設定、" : ""}
          {others.filter((x) => x.kind === "file").length > 0 &&
            `${others.filter((x) => x.status === "added" && x.kind === "file").length ? "加了 " + others.filter((x) => x.status === "added" && x.kind === "file").length + " 個檔案（照片等）、" : ""}${
              others.filter((x) => x.status === "deleted").length ? "刪了 " + others.filter((x) => x.status === "deleted").length + " 個檔案、" : ""
            }`}
          其他不是文字的變更不列出。
        </p>
      )}
      {files.length > MAX_FILES && <p className="small-note">只列出前 {MAX_FILES} 個檔案，還有 {files.length - MAX_FILES} 個。</p>}
    </div>
  );
}
