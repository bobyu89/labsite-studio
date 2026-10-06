import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Plus, WarningCircle } from "@phosphor-icons/react";
import { Modal, Field } from "./ui";
import { buildPreview } from "../site/preview.js";
import { groupByCategory, snippetPreviewHtml } from "../site/library.js";

// Picks a section from the site's library and inserts it into the current
// page. The preview renders the snippet inside this very page (same head,
// header, footer, CSS and scripts), so what you see is what you get.
export default function LibraryPanel({ p, sections, selected, open, onClose }) {
  const items = p.library?.sections || [];
  const groups = useMemo(() => groupByCategory(items), [items]);
  const [pick, setPick] = useState(null);
  const [after, setAfter] = useState(selected);
  const [srcdoc, setSrcdoc] = useState("");
  const [error, setError] = useState(null);
  const latest = useRef(0);
  const entry = items.find((s) => s.id === pick) || items[0] || null;

  useEffect(() => {
    if (open) setAfter(Math.min(selected, sections.length - 1));
  }, [open, selected, sections.length]);

  useEffect(() => {
    if (!open || !entry || !p.html) return;
    const id = ++latest.current;
    setError(null);
    (async () => {
      try {
        const snippet = await p.readSnippet(entry, p.current);
        const html = snippetPreviewHtml(p.html, snippet, p.current);
        const out = await buildPreview({ html, pagePath: p.current, source: p.previewSource, cache: p.cache });
        if (id === latest.current) setSrcdoc(out.srcdoc);
      } catch (e) {
        if (id === latest.current) {
          setSrcdoc("");
          setError("無法預覽這個元件：" + e.message);
        }
      }
    })();
  }, [open, entry?.id, p.current]);

  const insert = async () => {
    if (!entry) return;
    if (await p.insertFromLibrary(entry, after)) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="從元件庫新增區塊"
      description={
        p.library?.template
          ? "這些區塊來自網站的模板，樣式和網站其他地方一致。插入後一樣可以改字、換圖、調整順序。"
          : "這些是這個網站存下來的區塊。插入後一樣可以改字、換圖、調整順序。"
      }
    >
      {p.library?.error && (
        <div className="message error" role="alert">
          <WarningCircle size={20} />
          <span>{p.library.error}</span>
        </div>
      )}
      {items.length === 0 ? (
        <p className="small-note">元件庫還是空的。在左側選一個區塊，按「加入元件庫」就能存進來。</p>
      ) : (
        <div className="library-layout">
          <nav className="library-list" aria-label="元件">
            {groups.map((g) => (
              <div key={g.category} className="library-group">
                <h4>{g.category}</h4>
                {g.items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={"library-item" + (entry?.id === s.id ? " active" : "")}
                    aria-pressed={entry?.id === s.id}
                    onClick={() => setPick(s.id)}
                  >
                    <strong>{s.name}</strong>
                    {s.description && <span>{s.description}</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="library-preview">
            <div className="library-frame">
              {error ? (
                <p className="error-text small-note">{error}</p>
              ) : (
                <iframe title={"預覽：" + (entry?.name || "")} srcDoc={srcdoc} sandbox="allow-scripts" />
              )}
            </div>
            <div className="library-actions">
              <label className="page-picker">
                <span>放在</span>
                <select value={after} onChange={(e) => setAfter(Number(e.target.value))}>
                  <option value={-1}>這一頁最前面</option>
                  {sections.map((s, i) => (
                    <option key={i} value={i}>
                      「{s.title}」之後
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={insert} disabled={!entry || p.busy}>
                <Plus size={16} /> 插入「{entry?.name}」
              </Button>
            </div>
            {p.pair && p.mirror && (
              <p className="small-note">
                {p.current.startsWith("en/") ? "中文頁" : "英文頁"}（{p.pair}）結構相同時會一起加入
                {p.current.startsWith("en/") || entry?.en ? "對應語言的版本" : "同一段內容，之後再翻譯"}。
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// Saves the selected section into the library under a name teachers recognise.
export function AddToLibrary({ p, section, index, open, onClose }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    if (open) {
      setName(section?.title || "");
      setCategory("");
    }
  }, [open, section?.title]);
  const categories = [...new Set((p.library?.sections || []).map((s) => s.category))];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="加入元件庫"
      description="把這個區塊存成元件，之後在這個網站的任何頁面都能插入一份。中英文頁結構相同時，英文版也會一起存下來。"
    >
      <form
        className="cloud-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await p.addToLibrary(index, { name, category })) onClose();
        }}
      >
        <Field label="元件名稱" value={name} onChange={setName} required maxLength={40} />
        <Field label="分類（例如：主視覺、團隊、文獻）" value={category} onChange={setCategory} list="library-categories" placeholder="我的元件" maxLength={20} />
        <datalist id="library-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="dialog-actions">
          <Button type="button" variant="surface" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={!name.trim() || p.busy}>
            存成元件
          </Button>
        </div>
      </form>
    </Modal>
  );
}
