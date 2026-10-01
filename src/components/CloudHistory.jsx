// Version history for a cloud site: every save, who made it, which files it
// touched, which one the public site shows — and "restore this version".
import React, { useEffect, useState } from "react";
import { Button, Badge } from "@radix-ui/themes";
import { ArrowCounterClockwise, DownloadSimple } from "@phosphor-icons/react";

const fmt = (t) => new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(t);
const KIND = { added: "新增", modified: "修改", deleted: "刪除" };

export default function CloudHistory({ p, setConfirm }) {
  const site = p.cloudSite;
  const [state, setState] = useState({ loading: true, commits: [], error: null });
  useEffect(() => {
    if (!site) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    p.cloudCalls
      .history(site.id, 100)
      .then((d) => alive && setState({ loading: false, commits: d.commits, error: null }))
      .catch((e) => alive && setState({ loading: false, commits: [], error: e.message }));
    return () => {
      alive = false;
    };
  }, [site?.id, site?.draft, site?.published]);
  if (!site) return null;
  return (
    <div className="cloud-history">
      <div className="cloud-history-top">
        <p className="small-note">
          每次保存都是一個版本。標示「網站目前版本」的是大家現在看到的內容。
        </p>
        <Button size="1" variant="surface" asChild>
          <a href={p.cloudCalls.exportUrl(site.id, "draft")} download>
            <DownloadSimple size={14} /> 下載最新版本
          </a>
        </Button>
      </div>
      {state.loading && <p className="small-note">讀取中…</p>}
      {state.error && <p className="small-note error-text">{state.error}</p>}
      <ol className="history-list">
        {state.commits.map((c) => (
          <li key={c.id} className={"history-item" + (c.published ? " is-published" : "")}>
            <div className="history-head">
              <strong>{c.message}</strong>
              {c.published && (
                <Badge color="teal" variant="soft">
                  網站目前版本
                </Badge>
              )}
              {c.draft && !c.published && (
                <Badge color="amber" variant="soft">
                  最新，尚未發布
                </Badge>
              )}
            </div>
            <div className="history-meta">
              {fmt(c.at)} · {c.author} · <code>{c.short}</code>
            </div>
            {c.changed.length > 0 && (
              <details>
                <summary>{c.changed.length} 個檔案</summary>
                <ul>
                  {c.changed.map(([path, kind]) => (
                    <li key={path}>
                      <span className={"chg chg-" + kind}>{KIND[kind] || kind}</span> {path}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!c.draft && (
              <Button
                size="1"
                variant="ghost"
                disabled={p.busy}
                onClick={() =>
                  setConfirm({
                    title: "還原成這一版？",
                    description: `網站內容會變回「${c.message}」（${fmt(c.at)}）的樣子，存成一個新版本；之後的版本仍保留在紀錄裡，隨時可以再還原。${
                      p.anyDirty ? "目前尚未保存的修改會遺失。" : ""
                    }還原後要按「發布」，網站才會更新。`,
                    confirmLabel: "還原",
                    action: () => p.restoreCloud(c.id),
                  })
                }
              >
                <ArrowCounterClockwise size={14} /> 還原成這一版
              </Button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
