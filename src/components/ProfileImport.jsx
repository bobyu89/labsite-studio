// 從我的資料帶入: the teacher gives what they already have — a CV (PDF or
// Word), the address of their old website (read whole, up to 20 pages and
// the CV PDFs it links to), or just their name and school, for the AI to
// find their pages on the web (they tick which are theirs) — and the AI
// sorts it (server aiProfileImport). Each part then goes where it belongs: papers through the
// paper import (looked up by DOI, ticked before adding), and the texts as a
// request to the AI assistant on the right page, whose proposals are applied
// one by one as usual. Nothing is changed until the teacher says so.
import React, { useRef, useState } from "react";
import { Button } from "@radix-ui/themes";
import { FileArrowUp, Globe, Check, Sparkle, MagnifyingGlass, ArrowSquareOut } from "@phosphor-icons/react";
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
const KIND_NAMES = { faculty: "教師介紹頁", lab: "研究室網站", personal: "個人網站", cv: "履歷", orcid: "ORCID", department: "系所網頁", other: "其他" };

export default function ProfileImport({ p, open, onClose, data, setData, done, onAsk, onPapers }) {
  const [url, setUrl] = useState("");
  const [who, setWho] = useState({ name: "", school: "" });
  const [found, setFound] = useState(null); // { candidates, orcid, pick: { url: bool } }
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const siteId = p.cloudSite?.id;
  const targets = importTargets(p.pages || []);

  const read = async (body) => {
    setBusy(body.url || body.urls ? "正在讀整個網站（最多 20 頁），AI 再整理，大約需要一到兩分鐘…" : "AI 正在讀你的資料，大約需要半分鐘到一分鐘…");
    setError(null);
    try {
      const r = await p.cloudCalls.importProfile(siteId, body);
      setData({ ...r, orcid: found?.orcid || "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const search = async (e) => {
    e.preventDefault();
    setBusy("AI 正在上網找你的網頁，大約需要一分鐘…");
    setError(null);
    try {
      const r = await p.cloudCalls.findTeacher(siteId, { name: who.name.trim(), school: who.school.trim() });
      setFound({ ...r, pick: Object.fromEntries(r.candidates.map((c) => [c.url, c.confidence === "high" && !/scholar\.google|researchgate|linkedin/i.test(c.url)])) });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };
  const picked = found ? found.candidates.filter((c) => found.pick[c.url] && c.kind !== "orcid") : [];
  const orcidPapers = async () => {
    try {
      const r = await p.cloudCalls.lookupOrcid(data.orcid);
      onPapers({ works: r.works, orcid: data.orcid }, "orcid");
    } catch (e) {
      setError(e.message);
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
        data.orcid && {
          id: "orcid",
          title: "論文（從 ORCID）",
          detail: publicationPages(p.pages || []).length ? `找到 ORCID ${data.orcid}，從那裡匯入論文最完整` : "這個網站還沒有論文頁。請先在左邊「網站」新增一頁論文發表。",
          page: null,
          off: !publicationPages(p.pages || []).length,
        },
        (data.contact.email || data.contact.phone || data.contact.office) && { id: "contact", title: "聯絡資料", detail: [data.contact.email, data.contact.phone, data.contact.office].filter(Boolean).join("・"), page: targets.contact },
      ].filter(Boolean)
    : [];

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="從我的資料帶入" description="給 AI 你已經有的履歷或舊網站，它會整理好，再由你決定放進哪一頁。每一項都會先給你看，按「套用」才會改。" wide>
      {!data && !found && (
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
            <span>會讀整個網站（最多 20 頁），連同網站上的履歷 PDF</span>
          </form>
          <form className="pi-source pi-url" onSubmit={search}>
            <MagnifyingGlass size={30} />
            <strong>沒有網址？請 AI 上網找</strong>
            <input value={who.name} onChange={(e) => setWho((w) => ({ ...w, name: e.target.value }))} placeholder="姓名，例如 王小明" disabled={!!busy} aria-label="姓名" />
            <input value={who.school} onChange={(e) => setWho((w) => ({ ...w, school: e.target.value }))} placeholder="學校／系所" disabled={!!busy} aria-label="學校或系所" />
            <Button type="submit" size="2" variant="soft" disabled={!!busy || who.name.trim().length < 2 || who.school.trim().length < 2}>
              上網找
            </Button>
            <span>會找學校的教師頁、研究室網站、ORCID，你勾選是自己的再讀</span>
          </form>
          <p className="small-note pi-orcid">
            只有論文要帶入？用 ORCID 或 DOI 清單更快：
            <button type="button" className="text-link" onClick={() => onPapers(null)}>
              一次匯入多篇論文
            </button>
          </p>
        </div>
      )}
      {!data && found && (
        <div className="pi-found">
          {found.candidates.length === 0 ? (
            <p>沒有找到可靠的網頁。可以換個寫法（例如加上英文名字、系所全名），或改用上傳履歷。</p>
          ) : (
            <>
              <p>AI 找到這些網頁，<strong>請勾選真的是你的</strong>（同名的人很常見），平台會讀勾選的網頁：</p>
              <ul className="pi-candidates">
                {found.candidates.map((c) => (
                  <li key={c.url}>
                    <label>
                      <input type="checkbox" checked={!!found.pick[c.url]} disabled={!!busy || c.kind === "orcid"} onChange={(e) => setFound((f) => ({ ...f, pick: { ...f.pick, [c.url]: e.target.checked } }))} />
                      <span>
                        <strong>
                          {KIND_NAMES[c.kind]}
                          {c.confidence !== "high" && <span className="pi-unsure">（不確定）</span>}
                        </strong>
                        <span>{c.title}</span>
                        <span className="small-note">{c.why}</span>
                      </span>
                    </label>
                    <a href={c.url} target="_blank" rel="noreferrer" className="pi-open">
                      打開看看 <ArrowSquareOut size={13} />
                    </a>
                  </li>
                ))}
              </ul>
              {found.orcid && <p className="small-note">也找到 ORCID {found.orcid}：讀完網頁後，論文可以從 ORCID 匯入。</p>}
              <p className="small-note">Google 學術、ResearchGate、LinkedIn 擋程式讀取，勾了也讀不到。</p>
            </>
          )}
          <div className="pi-found-actions">
            <Button color="orange" disabled={!!busy || picked.length === 0} onClick={() => read({ urls: picked.map((c) => c.url) })}>
              讀取勾選的 {picked.length} 個網頁
            </Button>
            <button type="button" className="text-link" disabled={!!busy} onClick={() => setFound(null)}>
              換個方式
            </button>
          </div>
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
          {data.pages?.length > 0 && (
            <p className="small-note">
              讀了 {data.pages.length} 個網頁{data.pdfs?.length ? `、${data.pdfs.length} 份 PDF` : ""}。
            </p>
          )}
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
                  onClick={() => (x.id === "papers" ? onPapers(paperEntries(data.publications), "papers") : x.id === "orcid" ? orcidPapers() : onAsk(x.page, importRequest(x.id, data), x.id))}
                >
                  {done[x.id] ? "再放一次" : "放進網站"}
                </Button>
              </li>
            ))}
          </ul>
          {parts.length === 0 && <p>這份資料裡沒有找到可以放的內容，請換一份檔案或網址。</p>}
          <p className="small-note">
            每放一項會用掉 1 次 AI 次數（論文不用）。{data.remaining !== undefined ? `今天還可以用 ${data.remaining} 次。` : ""}
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setData(null);
                setFound(null);
              }}
            >
              換一份資料
            </button>
          </p>
        </div>
      )}
    </Modal>
  );
}
