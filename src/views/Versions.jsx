import React from "react";
import { Button, Badge } from "@radix-ui/themes";
import {
  ClockCounterClockwise,
  ArrowCounterClockwise,
  DownloadSimple,
} from "@phosphor-icons/react";

import { heroTitle } from "../domain/project";
import { clone } from "../model";
const time = (s) =>
  new Date(s).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Versions({
  saved,
  exportBackup,
  setConfirm,
  change,
  notify,
  goto,
}) {
  return (
    <>
      <div className="page-heading compact">
        <div>
          <h1>版本紀錄</h1>
          <p>回到過去的內容，再作為一份新的草稿繼續。</p>
        </div>
        <Button variant="surface" onClick={exportBackup}>
          <DownloadSimple size={18} />
          下載目前草稿
        </Button>
      </div>
      <div className="message">
        <ClockCounterClockwise size={20} />
        <span>恢復草稿不會發布網站。本機保留最近 15 次保存。</span>
      </div>
      {saved?.history.length ? (
        <div className="history-list">
          {saved.history.map((h, i) => (
            <article className="history-row" key={h.revision}>
              <span className="version">v{h.revision}</span>
              <div>
                <h3>
                  {h.draft.name}
                  {i === 0 && <Badge>最新保存</Badge>}
                </h3>
                <p>{heroTitle(h.draft)}</p>
                <small>{time(h.savedAt)} · 本機草稿</small>
              </div>
              <Button
                variant="surface"
                onClick={() =>
                  setConfirm({
                    title: "將 v" + h.revision + " 恢復為草稿？",
                    description:
                      "目前未保存的編輯會被取代。恢復後仍需手動保存，不會影響正式網站。",
                    action: () => {
                      change(clone(h.draft));
                      notify("已恢復為可編輯草稿，請確認後保存。");
                      goto("editor");
                    },
                  })
                }
              >
                <ArrowCounterClockwise size={17} />
                恢復草稿
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <ClockCounterClockwise size={44} />
          <h3>尚未建立版本紀錄</h3>
          <p>第一次保存草稿後，版本就會出現在這裡。</p>
          <Button onClick={() => goto("editor")}>開始編輯</Button>
        </div>
      )}
    </>
  );
}
