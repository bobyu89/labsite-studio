// 一次匯入多篇論文: a DOI / PMID list, a Zotero / EndNote / Google Scholar
// export (BibTeX or RIS), or the lab's ORCID record. Every paper is shown
// in the list's own style before anything is added; papers already on the
// site are found and left unticked. The chosen ones go to the top of the
// list, newest first, on the Chinese and (when it lines up) the English page.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Plus, MagnifyingGlass, UploadSimple } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { sectionElements } from "../site/page.js";
import { addCitation, addFieldsItem } from "../site/quickAdd.js";
import { formatReference, fieldValuesFor } from "../site/cite.js";
import { readImport, parseOrcid, siteIndex, isListed, newestFirst } from "../site/bibImport.js";
import { usePublicationTargets, publicationPages } from "./AddPublication";

const SOURCES = [
  { id: "ids", label: "DOI／PMID 清單" },
  { id: "file", label: "Zotero／EndNote 匯出檔" },
  { id: "orcid", label: "ORCID" },
];

// Lookups one after another, a few at a time, so a long list does not trip
// the services' rate limits.
async function eachLimited(items, limit, run) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      await run(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

const emptyMeta = (w) => ({ authors: [], year: w.year, title: w.title, journal: w.journal, volume: "", issue: "", pages: "", article: "", doi: w.doi || "", pmid: w.pmid || "" });

export default function ImportPublications({ p, open, onClose, onAdded, start }) {
  const { targets, pick, setPick } = usePublicationTargets(p, open);
  const target = targets?.[pick] || null;
  const [source, setSource] = useState("ids");
  const [text, setText] = useState("");
  const [orcid, setOrcid] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(null); // { done, total } while looking up
  const [error, setError] = useState(null);
  const [rows, setRows] = useState(null); // [{ key, meta, listed, note, pick }]
  const [both, setBoth] = useState(true);
  const fileRef = useRef(null);
  const siteId = p.project?.source.kind === "cloud" ? p.project.source.site.id : null;
  const calls = p.cloudCalls;

  // What is already on the site, to leave those papers unticked.
  const [index, setIndex] = useState(null);
  useEffect(() => {
    if (!open) return;
    setRows(null);
    setError(null);
    setBoth(true);
    let alive = true;
    (async () => {
      const texts = [];
      for (const page of publicationPages(p.pages)) {
        texts.push((await p.ensureLoaded(page)) || "");
        const en = page.startsWith("en/") ? null : "en/" + page;
        if (en && p.pages.includes(en)) texts.push((await p.ensureLoaded(en)) || "");
      }
      if (alive) setIndex(siteIndex(texts));
    })();
    if (siteId && calls?.getOrcid)
      calls
        .getOrcid(siteId)
        .then((r) => alive && r.orcid && setOrcid((o) => o || r.orcid))
        .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Opened from the ORCID reminder (works) or 從我的資料帶入 (entries: papers
  // read from a CV): go straight to the list.
  useEffect(() => {
    if (!open || !(start?.works || start?.entries) || !index) return;
    if (start.entries) {
      complete(start.entries);
      return;
    }
    setSource("orcid");
    if (start.orcid) setOrcid(start.orcid);
    complete(start.works.map((w) => ({ work: w })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, start?.n, index]);

  const finish = (list) => {
    const seen = new Set();
    const out = [];
    for (const r of newestFirst(list.map((x) => x.meta)).map((m) => list.find((x) => x.meta === m))) {
      const key = (r.meta.doi || r.meta.title).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const listed = index ? isListed(r.meta, index) : false;
      const thin = !r.meta.authors.length;
      out.push({ key, meta: r.meta, listed, note: r.note || (thin ? "查不到作者，加入後請自己補上" : ""), pick: !listed && !r.failed && !thin, failed: !!r.failed });
    }
    setRows(out);
  };

  // [{ id } | { meta } | { work }] → full metadata, looking up DOIs / PMIDs.
  async function complete(entries) {
    setError(null);
    const todo = entries.filter((e) => e.id || (e.work && (e.work.doi || e.work.pmid)) || (e.meta && e.meta.doi));
    setBusy({ done: 0, total: todo.length });
    const done = [];
    let n = 0;
    await eachLimited(entries, 3, async (e) => {
      // A paper read from a CV: its DOI gives the full record; if that fails, keep what the CV said.
      if (e.meta && e.meta.doi) {
        try {
          const meta = await calls.lookupReference(e.meta.doi);
          done.push({ meta: meta.year ? meta : { ...meta, year: e.meta.year } });
        } catch {
          done.push({ meta: e.meta, note: "DOI 查不到，先用履歷上的寫法" });
        }
        setBusy({ done: ++n, total: todo.length });
        return;
      }
      if (e.meta) return done.push({ meta: e.meta });
      const id = e.id ? e.id.id : e.work.doi || (e.work.pmid ? "PMID " + e.work.pmid : "");
      if (!id) return done.push({ meta: emptyMeta(e.work) });
      try {
        const meta = await calls.lookupReference(id);
        done.push({ meta: e.work && !meta.year ? { ...meta, year: e.work.year } : meta });
      } catch (err) {
        if (e.work) done.push({ meta: emptyMeta(e.work), note: "查不到完整資料，加入後請自己補上作者" });
        else done.push({ meta: { ...emptyMeta({ title: id, year: null, journal: "" }) }, note: err.message, failed: true });
      }
      setBusy({ done: ++n, total: todo.length });
    });
    setBusy(null);
    finish(done);
  }

  async function read() {
    setRows(null);
    if (source === "orcid") {
      const id = parseOrcid(orcid);
      if (!id) return setError("看不懂這個 ORCID。格式像 0000-0002-1825-0097，可以直接貼 ORCID 網址。");
      setBusy({ done: 0, total: 0 });
      try {
        const r = await calls.lookupOrcid(id);
        if (remember && siteId) calls.setOrcid(siteId, id).catch(() => {});
        if (!r.works.length) {
          setBusy(null);
          return setError("這個 ORCID 沒有公開的論文。");
        }
        await complete(r.works.map((w) => ({ work: w })));
      } catch (e) {
        setBusy(null);
        setError(e.message);
      }
      return;
    }
    const got = readImport(text);
    if (!got.format) return setError(source === "file" ? "讀不到論文。請選 .bib 或 .ris 檔，或把檔案內容貼上。" : "沒有找到 DOI 或 PubMed 編號。每行一個，例如 10.1111/jan.15599。");
    if (got.format === "ids") return complete(got.ids.map((id) => ({ id })));
    // A file: entries with a DOI get their full record (journal names,
    // given names); the rest are used as exported.
    return complete(got.items.map((meta) => (meta.doi && !meta.authors.length ? { id: { type: "doi", id: meta.doi } } : { meta })));
  }

  const hyphen = /\.-[A-Z]\./.test(target?.list.bold || "");
  const shown = useMemo(
    () =>
      (rows || []).map((r) => ({
        ...r,
        preview:
          target?.list.shape === "citation"
            ? formatReference(r.meta, { hyphen }).text
            : [r.meta.title, [r.meta.journal, r.meta.year].filter(Boolean).join("，")].filter(Boolean).join(" — "),
      })),
    [rows, target, hyphen],
  );
  const chosen = shown.filter((r) => r.pick && !r.failed);
  const mirrored = both && target?.pair && target?.pairList;

  const add = () => {
    const { page, list, pair, pairList } = target;
    // Oldest first, each to the top: the newest ends up first.
    const items = newestFirst(chosen.map((r) => r.meta)).reverse();
    const apply = (l) => (doc) => {
      const section = sectionElements(doc)[l.section];
      let changed = false;
      for (const meta of items) {
        if (list.shape === "citation") {
          const ref = formatReference(meta, { hyphen });
          changed = addCitation(section, l.path, { text: ref.text, bold: list.bold || "", journal: ref.journal, url: ref.url }) || changed;
        } else changed = addFieldsItem(section, l.path, l.fields, fieldValuesFor(l.fields, meta, { hyphen })) || changed;
      }
      return changed;
    };
    p.editPage(page, apply(list));
    if (mirrored) p.editPage(pair, apply(pairList));
    onAdded({ page, mirrored: !!mirrored, heading: list.heading, count: items.length });
  };

  const toggle = (key) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, pick: !r.pick } : r)));
  const onFile = async (file) => {
    if (!file) return;
    setText(await file.text());
    setError(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="一次匯入多篇論文" description="從 DOI 清單、Zotero／EndNote 的匯出檔或 ORCID 帶入，先看過再加入。" wide>
      {targets === null ? (
        <p className="muted">正在找網站上的論文清單…</p>
      ) : !targets.length ? (
        <p className="small-note">這個網站沒有找到可以直接新增的論文清單。</p>
      ) : (
        <div className="bulk-import">
          <div className="bulk-sources" role="tablist" aria-label="從哪裡匯入">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={source === s.id}
                className={source === s.id ? "active" : ""}
                onClick={() => {
                  setSource(s.id);
                  setError(null);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {source === "orcid" ? (
            <div className="bulk-input">
              <label className="field">
                <span>研究室主持人的 ORCID</span>
                <input value={orcid} placeholder="例如 0000-0002-1825-0097 或 https://orcid.org/…" onChange={(e) => setOrcid(e.target.value)} />
              </label>
              {siteId && (
                <label className="quick-add-check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  記住這個 ORCID：之後打開編輯器時，ORCID 上有網站還沒放的論文會提醒
                </label>
              )}
            </div>
          ) : (
            <div className="bulk-input">
              {source === "file" && (
                <div className="bulk-file">
                  <input ref={fileRef} type="file" accept=".bib,.ris,.txt,.bibtex,.nbib" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                  <Button type="button" variant="surface" color="gray" onClick={() => fileRef.current?.click()}>
                    <UploadSimple size={16} /> 選擇 .bib 或 .ris 檔
                  </Button>
                  <span className="small-note">Zotero：選取論文 → 右鍵「匯出項目」→ BibTeX 或 RIS。EndNote：File → Export → RefMan (RIS)。</span>
                </div>
              )}
              <label className="field">
                <span>{source === "ids" ? "每行一個 DOI 或 PubMed 編號" : "或把檔案內容貼在這裡"}</span>
                <textarea
                  rows={source === "ids" ? 5 : 6}
                  value={text}
                  placeholder={source === "ids" ? "10.1111/jan.15599\n10.1016/j.ijnurstu.2023.104655\nPMID 39889522" : "@article{…} 或 TY  - JOUR …"}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(null);
                  }}
                />
              </label>
            </div>
          )}
          <div className="bulk-actions">
            <Button type="button" variant="surface" disabled={!!busy || (source === "orcid" ? !orcid.trim() : !text.trim())} onClick={read}>
              <MagnifyingGlass size={16} /> {busy ? (busy.total ? `查詢中…（${busy.done}／${busy.total}）` : "查詢中…") : "讀取論文"}
            </Button>
            {error && <span className="small-note error-text">{error}</span>}
          </div>

          {rows && (
            <>
              <div className="bulk-head">
                <strong>找到 {rows.length} 篇</strong>
                <span className="small-note">
                  {rows.filter((r) => r.listed).length > 0 && `其中 ${rows.filter((r) => r.listed).length} 篇網站上已經有了，預設不勾。`}
                  格式和清單現有的一樣，加入前可以取消勾選。
                </span>
              </div>
              <ul className="bulk-list">
                {shown.map((r) => (
                  <li key={r.key} className={r.failed ? "failed" : r.listed ? "listed" : ""}>
                    <label>
                      <input type="checkbox" checked={r.pick && !r.failed} disabled={r.failed} onChange={() => toggle(r.key)} />
                      <span className="bulk-ref">
                        {r.preview}
                        {(r.listed || r.note) && (
                          <span className="bulk-tags">
                            {r.listed && <span className="bulk-tag">網站上已經有</span>}
                            {r.note && <span className="bulk-tag warn">{r.note}</span>}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="bulk-target">
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
                {target.pair &&
                  (target.pairList ? (
                    <label className="quick-add-check">
                      <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} />
                      英文頁也一起加入
                    </label>
                  ) : (
                    <span className="small-note warn-note">英文頁的清單和中文頁不一樣，這次只會加到中文頁。</span>
                  ))}
              </div>
              <div className="quick-add-actions">
                <Button type="button" size="3" disabled={!chosen.length || p.busy} onClick={add}>
                  <Plus size={18} /> 加入 {chosen.length} 篇
                </Button>
                <Button type="button" variant="soft" color="gray" size="3" onClick={onClose}>
                  取消
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
