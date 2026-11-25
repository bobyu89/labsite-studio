// 中英不同步 note above the fields of the selected section (pairSync.js):
// what is behind, and three ways out — let the assistant translate it, go
// and change the other page by hand, or 不用改 (this wording stays as it is).
import React from "react";
import { Translate } from "@phosphor-icons/react";

function says(x, inEnglish) {
  if (x.reason === "untranslated") return "英文頁這一段有新加的中文還沒翻譯（同步過去的新項目會先帶著原文）。";
  if (x.section === null)
    return x.behind === "en" ? "這一頁的中文改過了，英文頁還沒跟著改。兩頁的段落不一樣，沒辦法逐段對照。" : "英文頁改過了，中文頁還沒跟著改。兩頁的段落不一樣，沒辦法逐段對照。";
  if (x.behind === "en") return inEnglish ? "中文頁的這一段改過了，這裡的英文還沒跟著改。" : "這一段的中文改過了，英文頁還沒跟著改。";
  return inEnglish ? "這一段的英文改過了，中文頁還沒跟著改。" : "英文頁的這一段改過了，這裡的中文還沒跟著改。";
}

function request(x, inEnglish) {
  if (x.reason === "untranslated") return inEnglish ? "把我現在選的這個區塊裡還是中文的地方翻成英文，其他不要動。" : "把英文頁對應這個區塊裡還是中文的地方翻成英文，只改英文頁。";
  if (x.behind === "en") return inEnglish ? "中文頁這個區塊改過了，請照中文更新我現在選的這個英文區塊，只改英文。" : "這個區塊的中文改過了，請翻成英文，更新英文頁對應的位置，只改英文頁。";
  return inEnglish ? "這個英文區塊改過了，請翻成中文，更新中文頁對應的位置，只改中文頁。" : "英文頁對應這個區塊改過了，請照英文更新我現在選的這個中文區塊，只改中文。";
}

export default function SyncNote({ items, onAsk, onDismiss, onOpenPage, aiOn, inEnglish }) {
  if (!items?.length) return null;
  return (
    <div className="sync-notes">
      {items.map((x) => {
        const other = inEnglish ? x.zh : x.en;
        return (
          <div className="sync-note" key={[x.section, x.behind, x.reason].join("|")} role="status">
            <p>
              <Translate size={16} aria-hidden="true" /> {says(x, inEnglish)}
            </p>
            <div className="sync-note-actions">
              {aiOn && x.section !== null && (
                <button type="button" className="sync-ai" onClick={() => onAsk(request(x, inEnglish))}>
                  請 AI 助手翻譯
                </button>
              )}
              {(x.behind === "en") !== inEnglish && (
                <button type="button" className="text-link" onClick={() => onOpenPage(other)}>
                  到{inEnglish ? "中文" : "英文"}頁自己改
                </button>
              )}
              <button type="button" className="text-link muted" onClick={() => onDismiss(x)} title="這次不用改；之後這段又改了才會再提醒">
                不用改
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
