// The site's latest news (FALLBACK_NEWS in js/data.js): add, edit, remove,
// save. A site that still reads its news from a Google Sheet first gets one
// button that copies the sheet in and stops reading it.
import React, { useState } from "react";
import { Button } from "@radix-ui/themes";
import { Plus, Trash, FloppyDisk, CaretDown, CaretRight, ArrowSquareOut } from "@phosphor-icons/react";
import { Field } from "./ui";
import { NEWS_CATEGORIES, sortNews, normalizeDate } from "../site/news.js";

const today = () => normalizeDate(new Date().toISOString());
const blank = () => ({ date: today(), category: "公告", content: "", content_en: "", link: "" });

function NewsFields({ item, onChange }) {
  const set = (k) => (v) => onChange({ ...item, [k]: v });
  return (
    <div className="news-fields">
      <div className="news-row-2">
        <label className="field">
          <span>日期</span>
          <input type="date" value={item.date} onChange={(e) => set("date")(e.target.value)} />
        </label>
        <label className="field">
          <span>分類</span>
          <select value={item.category} onChange={(e) => set("category")(e.target.value)}>
            {[...new Set([...NEWS_CATEGORIES, item.category].filter(Boolean))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <Field label="內容" area rows={3} value={item.content} onChange={set("content")} placeholder="例如：研究生王小明論文口試將於 12 月 5 日舉行。" />
      <Field label="英文內容（英文頁顯示，可留白）" area rows={2} value={item.content_en} onChange={set("content_en")} />
      <Field label="相關連結（可留白）" value={item.link} onChange={set("link")} placeholder="https://" />
    </div>
  );
}

export default function NewsPanel({ p, writable, setConfirm }) {
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(-1);
  const news = p.news;
  if (!news?.ok)
    return (
      <p className="small-note">
        {news?.reason === "unparsed"
          ? "這個網站 js/data.js 裡的 FALLBACK_NEWS 寫法比較特別，編輯器無法安全地修改，請改用原本的方式更新最新消息。"
          : "這個網站沒有可編輯的最新消息清單（js/data.js 的 FALLBACK_NEWS）。"}
      </p>
    );

  if (news.sheetId)
    return (
      <div className="news-panel">
        <div className="news-callout">
          <strong>這個網站的最新消息目前來自 Google 試算表</strong>
          <p>
            搬進編輯器之後，就在這裡新增、修改消息，按「保存消息」再按「發布」網站就會更新，不用再開試算表。
            會先把試算表裡現有的消息複製過來，試算表本身不會被刪除或修改。
          </p>
          <Button size="3" disabled={!writable || p.busy} onClick={() => p.importSheetNews()}>
            從試算表搬進來
          </Button>
          <a className="small-note" href={`https://docs.google.com/spreadsheets/d/${news.sheetId}/edit`} target="_blank" rel="noopener">
            <ArrowSquareOut size={14} /> 先看看試算表
          </a>
        </div>
        <button
          className="link-button small-note"
          disabled={!writable || p.busy}
          onClick={() =>
            setConfirm({
              title: "不搬試算表，直接在這裡管理？",
              description: `網站會改成顯示 js/data.js 裡目前的 ${news.items.length} 則消息，試算表裡比較新的消息不會出現。`,
              action: p.detachNewsSheet,
            })
          }
        >
          不搬，直接在這裡管理（從網站目前的 {news.items.length} 則消息開始）
        </button>
      </div>
    );

  const items = news.items;
  // Saving re-sorts by date; keep the edited item open where it lands.
  const update = (i, next) => {
    const list = items.map((x, j) => (j === i ? next : x));
    p.setNewsItems(list);
    setOpen(sortNews(list).indexOf(next));
  };
  const remove = (i) =>
    setConfirm({
      title: "刪除這則消息？",
      description: items[i].content.slice(0, 60) || "（沒有內容）",
      action: () => {
        p.setNewsItems(items.filter((_, j) => j !== i));
        setOpen(-1);
      },
    });
  const add = () => {
    p.setNewsItems([...items, { ...draft, content: draft.content.trim() }]);
    setDraft(null);
    setOpen(-1);
  };

  return (
    <div className="news-panel">
      <p className="small-note">
        首頁會顯示最新的 3 則，其他的按「查看全部」才看得到。改完按「保存消息」，再按上方的「發布」，網站才會更新。
      </p>
      {draft ? (
        <div className="news-new">
          <strong>新增一則消息</strong>
          <NewsFields item={draft} onChange={setDraft} />
          <div className="news-actions">
            <Button disabled={!draft.content.trim() || !draft.date} onClick={add}>
              <Plus size={16} /> 加入
            </Button>
            <Button variant="soft" color="gray" onClick={() => setDraft(null)}>
              取消
            </Button>
          </div>
        </div>
      ) : (
        <Button size="3" disabled={!writable || p.busy} onClick={() => setDraft(blank())}>
          <Plus size={18} /> 新增一則消息
        </Button>
      )}
      <ul className="news-list">
        {items.map((n, i) => (
          <li key={i} className={open === i ? "open" : ""}>
            <button className="news-summary" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              {open === i ? <CaretDown size={14} /> : <CaretRight size={14} />}
              <span className="news-date">{n.date || "沒有日期"}</span>
              <span className="news-cat">{n.category}</span>
              <span className="news-text">{n.content || "（沒有內容，網站不會顯示）"}</span>
            </button>
            {open === i && (
              <div className="news-edit">
                <NewsFields item={n} onChange={(next) => update(i, next)} />
                <Button variant="soft" color="red" disabled={!writable} onClick={() => remove(i)}>
                  <Trash size={16} /> 刪除這則
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="small-note">還沒有任何消息。</p>}
      <Button disabled={!p.siteDirty || !writable || p.busy} onClick={p.saveSiteData}>
        <FloppyDisk size={18} /> 保存消息
      </Button>
    </div>
  );
}
