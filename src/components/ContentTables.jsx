// 論文與成員總表: every paper and person on the site in one table, Chinese
// and English together (contentIndex.js). Problems are marked and most can
// be fixed from here: a paper listed twice, missing on the English page, or
// without a DOI (Crossref suggestions, the teacher picks).
import React, { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { pairOf, sectionElements } from "../site/page.js";
import { paperIndex, peopleIndex } from "../site/contentIndex.js";
import { addCitation, addLinkToItem, publicationLists } from "../site/quickAdd.js";
import { publicationPages } from "./AddPublication";
import { removeItem } from "../site/page.js";

const FLAG = {
  duplicate: { label: "重複", tone: "warn" },
  "no-en": { label: "英文頁沒有", tone: "warn" },
  "no-zh": { label: "只有英文頁有", tone: "warn" },
  "no-doi": { label: "沒有 DOI", tone: "info" },
  "no-year": { label: "看不出年份", tone: "info" },
};
const FILTERS = [
  { id: "problem", label: "要處理的" },
  { id: "all", label: "全部" },
  { id: "no-doi", label: "沒有 DOI" },
];

// Share of title words in common (0–1): Crossref always answers something,
// so only titles that really look alike are offered.
const words = (t) => new Set(String(t).toLowerCase().normalize("NFKD").match(/[\p{L}\p{N}]+/gu) || []);
function similar(a, b) {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / Math.max(A.size, B.size);
}

function DoiFinder({ p, paper, onDone }) {
  const [state, setState] = useState({ busy: true, results: null, error: null });
  useEffect(() => {
    let alive = true;
    p.cloudCalls
      .searchPaper(paper.title, paper.year)
      .then((r) => alive && setState({ busy: false, results: r.results.map((x) => ({ ...x, score: similar(paper.title, x.title) })).filter((x) => x.score >= 0.6).sort((a, b) => b.score - a.score), error: null }))
      .catch((e) => alive && setState({ busy: false, results: null, error: e.message }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper.key]);
  const apply = (doi) => {
    const url = "https://doi.org/" + doi;
    const fix = (pl) => (doc) => addLinkToItem(sectionElements(doc)[pl.section], pl.path, pl.index, url, pl.shape);
    for (const pl of [...paper.zh, ...paper.en]) p.editPage(pl.page, fix(pl));
    onDone(`已加上 DOI（${doi}）。`);
  };
  if (state.busy) return <p className="small-note">正在 Crossref 找…</p>;
  if (state.error) return <p className="small-note error-text">{state.error}</p>;
  return (
    <div className="doi-finder">
      <p className="small-note">Crossref 找到的可能是這幾篇，標題、期刊、年份都對才選：</p>
      {state.results.length === 0 && <p className="small-note">Crossref 沒有標題相近的論文。中文期刊或研討會論文常常沒有 DOI，沒關係。</p>}
      {state.results.map((r) => (
        <button key={r.doi} type="button" className="doi-candidate" onClick={() => apply(r.doi)}>
          <strong>{r.title}</strong>
          <span>
            {[r.authors, r.journal, r.year].filter(Boolean).join("．")} · {r.doi}
          </span>
        </button>
      ))}
      <button type="button" className="text-link" onClick={() => onDone(null)}>
        這些都不是
      </button>
    </div>
  );
}

export default function ContentTables({ p, writable, setConfirm, onOpen }) {
  const [view, setView] = useState("papers");
  const [filter, setFilter] = useState("problem");
  const [q, setQ] = useState("");
  const [finding, setFinding] = useState(null);
  const [data, setData] = useState(null);
  const pubPages = publicationPages(p.pages);
  const membersPage = p.pages.find((x) => !x.startsWith("en/") && /(^|\/)(members?|team|people)\.html?$/i.test(x));
  // Recomputed whenever a page in question changes (drafts included).
  const watched = [...pubPages, ...pubPages.map((x) => pairOf(x, p.pages)), membersPage, membersPage && pairOf(membersPage, p.pages)].filter(Boolean);
  const versions = watched.map((x) => p.draftOf?.(x)?.length || 0).join(",");
  useEffect(() => {
    let alive = true;
    (async () => {
      const pages = [];
      for (const path of watched) {
        const html = await p.ensureLoaded(path);
        if (html) pages.push({ path, html });
      }
      const html = (path) => pages.find((x) => x.path === path)?.html || null;
      const papers = paperIndex(pages.filter((x) => x.path !== membersPage && x.path !== pairOf(membersPage || "", p.pages)), p.pages);
      const people = membersPage && html(membersPage) ? peopleIndex(membersPage, html(membersPage), pairOf(membersPage, p.pages), html(pairOf(membersPage, p.pages) || "")) : [];
      if (alive) setData({ ...papers, people });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, p.pages.length]);

  const shown = useMemo(() => {
    if (!data) return [];
    const words = q.trim().toLowerCase();
    return data.papers.filter((x) => {
      if (filter === "problem" && !x.flags.some((f) => FLAG[f].tone === "warn")) return false;
      if (filter === "no-doi" && !x.flags.includes("no-doi")) return false;
      return !words || (x.title + " " + x.journal + " " + x.year + " " + x.doi).toLowerCase().includes(words);
    });
  }, [data, filter, q]);

  if (!data) return <p className="small-note">正在整理網站上的論文與成員…</p>;
  const counts = { problem: data.papers.filter((x) => x.flags.some((f) => FLAG[f].tone === "warn")).length, all: data.papers.length, "no-doi": data.papers.filter((x) => x.flags.includes("no-doi")).length };

  const toEnglish = (paper) => {
    const from = paper.zh[0];
    const en = data.pairs[from.page];
    p.editPage(en, (doc) => {
      const lists = publicationLists(doc);
      const target = lists.find((l) => l.section === from.section && l.path.join(".") === from.path.join(".")) || lists[0];
      if (!target || target.shape !== "citation") return false;
      return addCitation(sectionElements(doc)[target.section], target.path, { text: from.text, bold: target.bold || from.bold, journal: paper.journal, url: "" });
    });
    p.notify("已把這篇加到英文頁清單的最前面（用中文頁的寫法）；英文頁的排序請自己確認。");
  };
  const removeDuplicate = (paper) => {
    const extra = [...paper.zh.slice(1), ...paper.en.slice(1)];
    setConfirm({
      title: "刪掉重複的那一筆？",
      description: `「${paper.title.slice(0, 40)}」出現了 ${paper.zh.length + paper.en.length} 次，中文頁和英文頁各保留第一筆，刪掉其他 ${extra.length} 筆。可以用復原找回。`,
      confirmLabel: "刪掉重複的",
      action: () => {
        // Last first, so earlier positions stay right.
        for (const pl of [...extra].sort((a, b) => b.index - a.index)) p.editPage(pl.page, (doc) => removeItem(sectionElements(doc)[pl.section], pl.path, pl.index));
        p.notify("已刪掉重複的論文，清單重新編號了。");
      },
    });
  };

  return (
    <div className="content-tables">
      <div className="ct-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === "papers"} className={view === "papers" ? "active" : ""} onClick={() => setView("papers")}>
          論文 <span className="tree-count">{data.papers.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={view === "people"} className={view === "people" ? "active" : ""} onClick={() => setView("people")}>
          成員 <span className="tree-count">{data.people.length}</span>
        </button>
      </div>
      {view === "papers" ? (
        <>
          <p className="small-note">網站上所有論文清單（中英文頁一起）整理成一張表。{counts.problem ? `有 ${counts.problem} 篇要處理。` : "沒有重複，中英文頁也都有。"}</p>
          <div className="ct-tools">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={"ct-filter" + (filter === f.id ? " active" : "")} onClick={() => setFilter(f.id)}>
                {f.label}（{counts[f.id]}）
              </button>
            ))}
            <label className="ct-search">
              <MagnifyingGlass size={15} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="找標題、期刊、年份" aria-label="搜尋論文" />
            </label>
          </div>
          {shown.length === 0 && <p className="small-note">{filter === "problem" ? "沒有要處理的論文。" : "沒有符合的論文。"}</p>}
          <ol className="ct-list">
            {shown.slice(0, 200).map((x) => (
              <li key={x.key}>
                <div className="ct-main">
                  <span className="ct-year">{x.year || "—"}</span>
                  <span className="ct-title">
                    {x.title}
                    {x.journal && <em>{x.journal}</em>}
                  </span>
                </div>
                <div className="ct-meta">
                  {x.flags.map((f) => (
                    <span key={f} className={"ct-flag " + FLAG[f].tone}>
                      {FLAG[f].label}
                    </span>
                  ))}
                  <span className="muted">{[x.zh.length && "中文頁", x.en.length && "英文頁"].filter(Boolean).join("、")}</span>
                  <button type="button" className="text-link" onClick={() => onOpen((x.zh[0] || x.en[0]).page, (x.zh[0] || x.en[0]).section)}>
                    去看
                  </button>
                  {writable && x.flags.includes("duplicate") && (
                    <button type="button" className="text-link" onClick={() => removeDuplicate(x)}>
                      刪掉重複的
                    </button>
                  )}
                  {writable && x.flags.includes("no-en") && x.zh[0]?.shape === "citation" && (
                    <button type="button" className="text-link" onClick={() => toEnglish(x)}>
                      加到英文頁
                    </button>
                  )}
                  {writable && x.flags.includes("no-doi") && p.cloudCalls?.searchPaper && (
                    <button type="button" className="text-link" onClick={() => setFinding(finding === x.key ? null : x.key)}>
                      找 DOI
                    </button>
                  )}
                </div>
                {finding === x.key && (
                  <DoiFinder
                    p={p}
                    paper={x}
                    onDone={(msg) => {
                      setFinding(null);
                      if (msg) p.notify(msg + "確認沒問題後，按上方的「發布」。");
                    }}
                  />
                )}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <p className="small-note">成員頁上的每一位，中英文並排。</p>
          {data.people.length === 0 ? (
            <p className="small-note">成員頁上找不到成員清單。</p>
          ) : (
            <table className="ct-people">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>身分</th>
                  <th>英文</th>
                  <th>照片</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.people.map((x, i) => (
                  <tr key={i}>
                    <td>{x.name}</td>
                    <td>{x.role}</td>
                    <td>{x.en ? `${x.en.name}${x.en.role ? "・" + x.en.role : ""}` : <span className="ct-flag warn">英文頁沒有對應</span>}</td>
                    <td>{x.photo === "ok" ? "有" : x.photo === "placeholder" ? <span className="ct-flag warn">範例照片</span> : <span className="muted">沒有</span>}</td>
                    <td>
                      <button type="button" className="text-link" onClick={() => onOpen(x.place.page, x.place.section)}>
                        去看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

