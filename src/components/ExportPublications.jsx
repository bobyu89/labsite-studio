// 論文清單匯出 dialog: which lists, which years, Chinese or English page →
// a Word file (APA, hanging indent) or text to paste into a report.
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { DownloadSimple, Copy } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { publicationPages } from "./AddPublication";
import { publicationEntries, filterByYear, exportText, exportWord } from "../site/pubExport.js";

const THIS_YEAR = new Date().getFullYear();

export default function ExportPublications({ p, open, onClose }) {
  const [lang, setLang] = useState("zh");
  const [groups, setGroups] = useState(null);
  const [off, setOff] = useState(new Set()); // lists left out
  const [from, setFrom] = useState(String(THIS_YEAR - 4));
  const [to, setTo] = useState(String(THIS_YEAR));
  const [copied, setCopied] = useState(false);
  const hasEn = publicationPages(p.pages).some((x) => p.pages.includes("en/" + x));

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setGroups(null);
    setCopied(false);
    (async () => {
      const out = [];
      for (const zh of publicationPages(p.pages)) {
        const page = lang === "en" && p.pages.includes("en/" + zh) ? "en/" + zh : zh;
        const html = await p.ensureLoaded(page);
        if (html) out.push(...publicationEntries(page, html));
      }
      if (alive) setGroups(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lang]);

  const key = (g, i) => g.page + "#" + i;
  const chosen = useMemo(() => {
    if (!groups) return [];
    const picked = groups.filter((g, i) => !off.has(key(g, i)));
    return filterByYear(picked, Number(from) || null, Number(to) || null);
  }, [groups, off, from, to]);
  const total = chosen.reduce((n, g) => n + g.items.length, 0);
  const title = `${p.cloudSite?.name || p.project?.name || "研究室"} 著作目錄（${from || "…"}–${to || "…"}）`;
  const download = () => {
    const blob = new Blob(["﻿" + exportWord(title, chosen)], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `publications-${from}-${to}.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText(chosen));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="匯出論文清單" description="選年份和清單，下載成 Word 檔或複製文字，給計畫報告、系所評鑑用。">
      <div className="pub-export">
        <div className="pub-export-row">
          <label className="field">
            <span>從</span>
            <input type="number" min="1950" max={THIS_YEAR + 1} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>到</span>
            <input type="number" min="1950" max={THIS_YEAR + 1} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {hasEn && (
            <label className="field">
              <span>用哪一頁的內容</span>
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="zh">中文頁</option>
                <option value="en">英文頁</option>
              </select>
            </label>
          )}
        </div>
        {groups === null ? (
          <p className="muted">正在讀網站上的論文清單…</p>
        ) : !groups.length ? (
          <p className="small-note">這個網站沒有找到論文清單。</p>
        ) : (
          <>
            <fieldset className="pub-export-lists">
              <legend>要匯出的清單</legend>
              {groups.map((g, i) => (
                <label key={key(g, i)} className="quick-add-check">
                  <input
                    type="checkbox"
                    checked={!off.has(key(g, i))}
                    onChange={() =>
                      setOff((s) => {
                        const n = new Set(s);
                        n.has(key(g, i)) ? n.delete(key(g, i)) : n.add(key(g, i));
                        return n;
                      })
                    }
                  />
                  {p.labelOf(g.page)}
                  {g.heading ? " › " + g.heading : ""}（{g.items.length} 篇）
                </label>
              ))}
            </fieldset>
            <p className="small-note">
              符合的有 <strong>{total}</strong> 篇。看不出年份的論文會一起列出，請自己確認。
            </p>
            {chosen.length > 0 && (
              <ol className="pub-export-preview">
                {chosen
                  .flatMap((g) => g.items)
                  .slice(0, 3)
                  .map((x, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: x.html }} />
                  ))}
              </ol>
            )}
            <div className="quick-add-actions">
              <Button size="3" disabled={!total} onClick={download}>
                <DownloadSimple size={18} /> 下載 Word 檔
              </Button>
              <Button size="3" variant="soft" disabled={!total} onClick={copy}>
                <Copy size={18} /> {copied ? "已複製" : "複製文字"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
