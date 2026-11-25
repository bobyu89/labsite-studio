// 活動快報: after an event, from a phone — pick the photos, write one
// sentence, and the AI writes the news item in Chinese and English and a
// caption for the photos. Everything stays editable; 加入 puts the news at
// the top of 最新消息 and the photos in 活動相簿. Nothing is published.
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Camera, Sparkle, Plus } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { PICKER_ACCEPT } from "../site/images.js";
import { readNews, NEWS_CATEGORIES } from "../site/news.js";
import { newsItem } from "../site/assistant.js";

const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function QuickPost({ p, open, onClose, onDone }) {
  const [files, setFiles] = useState([]);
  const [date, setDate] = useState(today());
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(null); // { category, zh, en, caption, caption_en }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [previews, setPreviews] = useState([]);
  const input = useRef(null);
  const albumOk = !!p.album?.ok;

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setDate(today());
    setText("");
    setDraft(null);
    setError(null);
  }, [open]);
  useEffect(() => {
    const urls = files.slice(0, 8).map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const write = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await p.ai.quickNews({ text, date, photo: files[0] || null });
      setDraft({ category: r.category, zh: r.zh, en: r.en, caption: r.caption, caption_en: r.caption_en });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    const news = p.siteData ? readNews(p.siteData.text) : null;
    if (!news?.ok || news.sheetId) return setError("這個網站的最新消息現在不能直接新增。");
    p.setNewsItems([newsItem({ date, category: draft.category, zh: draft.zh, en: draft.en }), ...news.items]);
    let photos = 0;
    if (files.length && albumOk) photos = await p.addAlbumPhotos(files, { caption: `${date} ${draft.caption}`.trim(), quiet: true });
    onDone({ photos });
  };

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  return (
    <Modal open={open} onClose={onClose} title="活動快報" description="選照片、寫一句發生了什麼，AI 幫你寫好中英文消息。">
      <div className="quick-post">
        <div className="quick-post-photos">
          <input
            ref={input}
            type="file"
            accept={PICKER_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              setFiles([...(e.target.files || [])]);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="surface" color="gray" onClick={() => input.current?.click()}>
            <Camera size={18} /> {files.length ? `已選 ${files.length} 張，重選` : "選照片（可以不選）"}
          </Button>
          {previews.length > 0 && (
            <div className="quick-post-thumbs">
              {previews.map((u) => (
                <img key={u} src={u} alt="" />
              ))}
            </div>
          )}
          {files.length > 0 && !albumOk && <span className="small-note">這個網站沒有「活動相簿」，照片只給 AI 參考，請另外到雲端相簿加入。</span>}
        </div>
        <div className="quick-post-row">
          <label className="field">
            <span>日期</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>發生了什麼？一句話就好</span>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="例如：今天舉辦實證護理工作坊，30 位臨床護理師參加" />
        </label>
        <div className="quick-add-actions">
          <Button type="button" color="orange" disabled={busy || text.trim().length < 4} onClick={write}>
            <Sparkle size={16} /> {busy ? "AI 正在寫…" : draft ? "重新寫一次" : "請 AI 寫"}
          </Button>
          {error && <span className="small-note error-text">{error}</span>}
        </div>
        {draft && (
          <div className="quick-post-draft">
            <div className="quick-post-row">
              <label className="field">
                <span>分類</span>
                <select value={draft.category} onChange={set("category")}>
                  {NEWS_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>中文消息</span>
              <textarea rows={3} value={draft.zh} onChange={set("zh")} />
            </label>
            <label className="field">
              <span>英文消息</span>
              <textarea rows={3} value={draft.en} onChange={set("en")} lang="en" />
            </label>
            {files.length > 0 && albumOk && (
              <label className="field">
                <span>照片說明（{files.length} 張都用這一句，之後可以在活動相簿個別改）</span>
                <input value={draft.caption} onChange={set("caption")} />
              </label>
            )}
            <p className="small-note">AI 只會用你寫的內容；人名、數字請再確認。加入後是草稿，按「發布」才會上線。</p>
            <div className="quick-add-actions">
              <Button type="button" size="3" disabled={p.busy || !draft.zh.trim()} onClick={add}>
                <Plus size={18} /> 加入最新消息{files.length && albumOk ? `和 ${files.length} 張照片` : ""}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
