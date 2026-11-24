// 新增一篇論文: one form instead of finding the right block on the right
// page. Paste the reference, check how it will look, and it goes to the top
// of the chosen list on the Chinese and the English page, numbered again.
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Plus } from "@phosphor-icons/react";
import { Modal, Field } from "./ui";
import { parsePage, sectionElements, pairOf } from "../site/page.js";
import { publicationLists, addCitation, addFieldsItem, guessJournal, matchingList, previewCitation } from "../site/quickAdd.js";

// Pages that may hold publication lists, by file name.
export const PUBLICATION_PAGE = /(^|\/)(publications?|conferences?|papers?|pubs)\.html?$/i;
export const publicationPages = (pages) => pages.filter((x) => !x.startsWith("en/") && PUBLICATION_PAGE.test(x));

export default function AddPublication({ p, open, onClose, onAdded }) {
  const [targets, setTargets] = useState(null); // [{ page, list, pair, pairList }]
  const [pick, setPick] = useState(0);
  const [values, setValues] = useState({ text: "", bold: "", journal: "", url: "" });
  const [journalTouched, setJournalTouched] = useState(false);
  const [fieldValues, setFieldValues] = useState([]);
  const [fieldValuesEn, setFieldValuesEn] = useState([]);
  const [both, setBoth] = useState(true);
  const pages = useMemo(() => publicationPages(p.pages), [p.pages]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setTargets(null);
    (async () => {
      const found = [];
      for (const page of pages) {
        const html = await p.ensureLoaded(page);
        if (!html) continue;
        const pair = pairOf(page, p.pages);
        const pairHtml = pair ? await p.ensureLoaded(pair) : null;
        const pairLists = pairHtml ? publicationLists(parsePage(pairHtml).doc) : [];
        for (const list of publicationLists(parsePage(html).doc)) found.push({ page, list, pair, pairList: matchingList(pairLists, list) });
      }
      if (!alive) return;
      setTargets(found);
      // Start on the page being edited, when it has a list.
      const here = found.findIndex((t) => t.page === p.current || t.pair === p.current);
      setPick(here >= 0 ? here : 0);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const target = targets?.[pick] || null;
  useEffect(() => {
    if (!target) return;
    setValues((v) => ({ ...v, bold: target.list.bold || "" }));
    setFieldValues((target.list.fields || []).map(() => ""));
    setFieldValuesEn((target.list.fields || []).map(() => ""));
    setBoth(true);
  }, [pick, targets]);

  const setText = (text) => {
    setValues((v) => ({ ...v, text, journal: journalTouched ? v.journal : guessJournal(text) }));
  };
  const preview = target?.list.shape === "citation" ? previewCitation(values) : null;
  const ready = target && (target.list.shape === "citation" ? values.text.trim().length > 10 : fieldValues.some((v) => v.trim()));
  const missing = (what, value) => value.trim() && values.text.trim() && !values.text.includes(value.trim()) && `引用文字裡找不到「${value.trim()}」，${what}不會套用。`;

  const add = () => {
    const { page, list, pair, pairList } = target;
    const apply = (l, vals) => (doc) => {
      const section = sectionElements(doc)[l.section];
      return list.shape === "citation" ? addCitation(section, l.path, values) : addFieldsItem(section, l.path, l.fields, vals);
    };
    p.editPage(page, apply(list, fieldValues));
    const mirrored = both && pair && pairList;
    if (mirrored) p.editPage(pair, apply(pairList, fieldValues.map((v, i) => fieldValuesEn[i].trim() || v)));
    setValues((v) => ({ ...v, text: "", journal: "", url: "" }));
    setJournalTouched(false);
    onAdded({ page, mirrored: !!mirrored, heading: list.heading });
  };

  return (
    <Modal open={open} onClose={onClose} title="新增一篇論文" description="貼上論文資料，會自動排到清單最前面並重新編號。">
      {targets === null ? (
        <p className="muted">正在找網站上的論文清單…</p>
      ) : !targets.length ? (
        <p className="small-note">
          這個網站沒有找到可以直接新增的論文清單（可能是由其他資料來源自動產生的）。請到「編輯內容」在預覽中點選要修改的地方。
        </p>
      ) : (
        <form
          className="quick-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) add();
          }}
        >
          {targets.length > 1 && (
            <label className="field">
              <span>加到哪一個清單</span>
              <select value={pick} onChange={(e) => setPick(Number(e.target.value))}>
                {targets.map((t, i) => (
                  <option key={i} value={i}>
                    {p.labelOf(t.page)}
                    {t.list.heading && t.list.heading !== p.labelOf(t.page) ? " › " + t.list.heading : ""}（目前 {t.list.count} 篇）
                  </option>
                ))}
              </select>
            </label>
          )}
          {target.list.shape === "citation" ? (
            <>
              <Field
                label="論文資料（整段貼上，例如 APA 格式）"
                area
                rows={5}
                value={values.text}
                onChange={setText}
                placeholder="Wang, X. M., Sung, C. M., & Chou, K. R. (2026). Title of the article. Journal Name, 12(3), 45-67."
                autoFocus
              />
              <div className="quick-add-row">
                <Field label="要加粗的姓名" value={values.bold} onChange={(v) => setValues((s) => ({ ...s, bold: v }))} />
                <Field
                  label="期刊名稱（會變斜體）"
                  value={values.journal}
                  onChange={(v) => {
                    setJournalTouched(true);
                    setValues((s) => ({ ...s, journal: v }));
                  }}
                />
              </div>
              <Field
                label="連結（DOI 或 PubMed 網址，可留白）"
                value={values.url}
                onChange={(v) => setValues((s) => ({ ...s, url: v }))}
                placeholder="https://doi.org/10.…"
              />
              {[missing("粗體", values.bold), missing("斜體", values.journal)].filter(Boolean).map((m) => (
                <span key={m} className="small-note warn-note">
                  {m}
                </span>
              ))}
              {values.text.trim() && (
                <div className="quick-add-preview" aria-label="預覽">
                  <span className="small-note">網站上會顯示成：</span>
                  <p>
                    <b className="quick-add-num">1.</b>{" "}
                    {preview.parts.map((part, i) => (part.tag === "strong" ? <strong key={i}>{part.text}</strong> : part.tag === "em" ? <em key={i}>{part.text}</em> : <span key={i}>{part.text}</span>))}
                    {preview.link && (
                      <>
                        {" "}
                        <a href={preview.link.url} target="_blank" rel="noopener noreferrer">
                          {preview.link.label}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {target.list.fields.map((f, i) => (
                <div className={target.pairList ? "quick-add-row" : ""} key={i}>
                  <Field
                    label={f.label}
                    area={f.long}
                    rows={2}
                    value={fieldValues[i] ?? ""}
                    onChange={(v) => setFieldValues((s) => s.map((x, j) => (j === i ? v : x)))}
                    placeholder={f.example}
                  />
                  {target.pairList && both && f.kind === "text" && (
                    <Field
                      label={f.label + "（英文，留白就用左邊的）"}
                      area={f.long}
                      rows={2}
                      value={fieldValuesEn[i] ?? ""}
                      onChange={(v) => setFieldValuesEn((s) => s.map((x, j) => (j === i ? v : x)))}
                    />
                  )}
                </div>
              ))}
            </>
          )}
          {target.pair &&
            (target.pairList ? (
              <label className="quick-add-check">
                <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} />
                英文頁也一起加入
              </label>
            ) : (
              <span className="small-note warn-note">英文頁的清單和中文頁不一樣，這次只會加到中文頁；英文頁請另外修改。</span>
            ))}
          <div className="quick-add-actions">
            <Button type="submit" size="3" disabled={!ready || p.busy}>
              <Plus size={18} /> 加入
            </Button>
            <Button type="button" variant="soft" color="gray" size="3" onClick={onClose}>
              取消
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
