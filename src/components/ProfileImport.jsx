// 從我的資料帶入: the teacher gives what they already have — a CV (PDF or
// Word) or the address of their old website — and the AI sorts it (server
// aiProfileImport). Each part then goes where it belongs: papers through the
// paper import (looked up by DOI, ticked before adding), and the texts as a
// request to the AI assistant on the right page, whose proposals are applied
// one by one as usual. Nothing is changed until the teacher says so.
import React, { useRef, useState } from "react";
import { Button } from "@radix-ui/themes";
import { FileArrowUp, Globe, Check, Sparkle } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { docxText } from "../site/docxText.js";
import { importTargets, importRequest, paperEntries } from "../site/profileImport.js";
import { publicationPages } from "./AddPublication";

const MAX_PDF = 10 * 1024 * 1024;
const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("讀不到這個檔案。"));
    r.readAsDataURL(file);
  });
export default function ProfileImport({ p, open, onClose, data, setData, done, onAsk, onPapers }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const siteId = p.cloudSite?.id;
  const targets = importTargets(p.pages || []);

  const read = async (body) => {
    setBusy("AI 正在讀你的資料，大約需要半分鐘到一分鐘…");
    setError(null);
    try {
      setData(await p.cloudCalls.importProfile(siteId, body));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const onFile = async (file) => {
    if (!file) return;
    setError(null);
    try {
      if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
        if (file.size > MAX_PDF) throw new Error("PDF 超過 10 MB，請只存履歷那幾頁。");
        return read({ pdf: await toBase64(file) });
      }
      if (/\.docx$/i.test(file.name)) return read({ text: await docxText(file) });
      if (/\.doc$/i.test(file.name)) throw new Error("舊版 Word（.doc）讀不到，請另存成 .docx 或 PDF。");
      if (/\.(txt|md)$/i.test(file.name)) return read({ text: await file.text() });
      throw new Error("請選 PDF 或 Word（.docx）檔。");
    } catch (e) {
      setError(e.message);
    }
  };

  const parts = data
    ? [
        (data.person.name_zh || data.person.name_en || data.bio.zh || data.education.length) && {
          id: "person",
          title: "主持人介紹",
          detail: [data.person.name_zh || data.person.name_en, data.person.title.zh, data.education.length && `學歷 ${data.education.length} 筆`, data.positions.length && `經歷 ${data.positions.length} 筆`, data.awards.length && `獲獎 ${data.awards.length} 項`].filter(Boolean).join("・"),
          page: targets.person,
        },
        data.topics.length > 0 && { id: "research", title: `研究主題 ${data.topics.length} 個`, detail: data.topics.map((t) => t.title.zh || t.title.en).join("、"), page: targets.research },
        (data.bio.zh || data.topics.length > 0) && { id: "home", title: "首頁的研究室介紹", detail: "依簡介和研究主題重寫首頁那一句和介紹段落", page: targets.home },
        data.projects.length > 0 && { id: "projects", title: `研究計畫 ${data.projects.length} 件`, detail: data.projects.slice(0, 2).map((x) => x.title).join("；") + (data.projects.length > 2 ? "…" : ""), page: targets.projects },
        data.publications.length > 0 && {
          id: "papers",
          title: `論文 ${data.publications.length} 篇`,
          detail: publicationPages(p.pages || []).length
            ? `${data.publications.filter((x) => x.doi).length} 篇有 DOI，會自動查完整資料；已經在網站上的不會重複加入`
            : "這個網站還沒有論文頁。請先在左邊「網站」新增一頁論文發表，再回來放進去。",
          page: null,
          off: !publicationPages(p.pages || []).length,
        },
        (data.contact.email || data.contact.phone || data.contact.office) && { id: "contact", title: "聯絡資料", detail: [data.contact.email, data.contact.phone, data.contact.office].filter(Boolean).join("・"), page: targets.contact },
      ].filter(Boolean)
    : [];

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="從我的資料帶入" description="給 AI 你已經有的履歷或舊網站，它會整理好，再由你決定放進哪一頁。每一項都會先給你看，按「套用」才會改。" wide>
      {!data && (
        <div className="pi-sources">
          <button type="button" className="pi-source" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            <FileArrowUp size={30} />
            <strong>上傳履歷</strong>
            <span>PDF 或 Word（.docx），10 MB 以內</span>
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <form
            className="pi-source pi-url"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) read({ url: url.trim() });
            }}
          >
            <Globe size={30} />
            <strong>舊網站的網址</strong>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" disabled={!!busy} aria-label="舊網站的網址" />
            <Button type="submit" size="2" variant="soft" disabled={!!busy || !url.trim()}>
              讀取
            </Button>
            <span>也會一起看網站上的論文、簡歷頁</span>
          </form>
          <p className="small-note pi-orcid">
            只有論文要帶入？用 ORCID 或 DOI 清單更快：
            <button type="button" className="text-link" onClick={() => onPapers(null)}>
              一次匯入多篇論文
            </button>
          </p>
        </div>
      )}
      {busy && (
        <p className="wizard-busy" role="status">
          <Sparkle size={16} /> {busy}
        </p>
      )}
      {error && <p className="small-note error-text">{error}</p>}
      {data && (
        <div className="pi-review">
          <p>
            AI 找到這些，按「放進網站」會打開那一頁，請 AI 助手提出修改，你看過再按「套用」：
            {data.notes && <span className="small-note"> {data.notes}</span>}
          </p>
          <ul className="pi-parts">
            {parts.map((x) => (
              <li key={x.id} className={done[x.id] ? "done" : ""}>
                <div>
                  <strong>
                    {done[x.id] && <Check size={15} weight="bold" />} {x.title}
                  </strong>
                  <span>{x.detail}</span>
                  {x.page && <span className="small-note">放到：{p.labelOf(x.page)}</span>}
                </div>
                <Button
                  size="2"
                  disabled={x.off}
                  variant={done[x.id] ? "soft" : "solid"}
                  color={done[x.id] ? "gray" : "orange"}
                  onClick={() => (x.id === "papers" ? onPapers(paperEntries(data.publications), "papers") : onAsk(x.page, importRequest(x.id, data), x.id))}
                >
                  {done[x.id] ? "再放一次" : "放進網站"}
                </Button>
              </li>
            ))}
          </ul>
          {parts.length === 0 && <p>這份資料裡沒有找到可以放的內容，請換一份檔案或網址。</p>}
          <p className="small-note">
            每放一項會用掉 1 次 AI 次數（論文不用）。{data.remaining !== undefined ? `今天還可以用 ${data.remaining} 次。` : ""}
            <button type="button" className="text-link" onClick={() => setData(null)}>
              換一份資料
            </button>
          </p>
        </div>
      )}
    </Modal>
  );
}
