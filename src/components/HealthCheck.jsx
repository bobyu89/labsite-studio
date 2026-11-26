// 網站體檢: one click, the whole site looked over — the findings come from
// what the editor knows (health.js); with the AI on, it picks the five that
// matter most, words them, and points out clumsy English on the home page.
import React, { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { Heartbeat, Sparkle } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { pairOf } from "../site/page.js";
import { paperIndex, peopleIndex } from "../site/contentIndex.js";
import { memberLists } from "../site/semester.js";
import { parsePage } from "../site/page.js";
import { healthFindings, healthScore } from "../site/health.js";
import { publicationPages } from "./AddPublication";

const textOf = (html) =>
  String(html || "")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function gather(p) {
  const siteId = p.cloudSite?.id;
  const pages = [];
  const load = async (path) => {
    const html = path ? await p.ensureLoaded(path) : null;
    if (html) pages.push({ path, html });
    return html;
  };
  for (const zh of publicationPages(p.pages)) {
    await load(zh);
    await load(pairOf(zh, p.pages));
  }
  const papers = paperIndex(pages, p.pages).papers;
  const membersPage = p.pages.find((x) => !x.startsWith("en/") && /(^|\/)(members?|team|people)\.html?$/i.test(x));
  const membersEn = membersPage ? pairOf(membersPage, p.pages) : null;
  const zhMembers = membersPage ? await load(membersPage) : null;
  const enMembers = membersEn ? await load(membersEn) : null;
  const people = zhMembers ? peopleIndex(membersPage, zhMembers, membersEn, enMembers) : null;
  const [checks, sync, pending, stats] = await Promise.all([
    p.prepublishCheck([]).catch(() => []),
    p.syncReport(p.pages).catch(() => []),
    siteId ? p.cloudCalls.pending(siteId).catch(() => null) : null,
    siteId ? p.cloudCalls.stats(siteId, 30).catch(() => null) : null,
  ]);
  const oldest = pending?.commits?.length ? Math.min(...pending.commits.map((c) => c.at)) : null;
  const enHome = p.pages.includes("en/index.html") ? textOf(await p.ensureLoaded("en/index.html")).slice(0, 2500) : "";
  return {
    signals: {
      news: p.news?.ok ? p.news.items : null,
      papers: papers.length
        ? {
            total: papers.length,
            latestYear: Math.max(0, ...papers.map((x) => x.year || 0)) || null,
            duplicates: papers.filter((x) => x.flags.includes("duplicate")).length,
            noEnglish: papers.filter((x) => x.flags.includes("no-en")).length,
            noDoi: papers.filter((x) => x.flags.includes("no-doi")).length,
          }
        : null,
      people: people
        ? {
            total: people.length,
            placeholderPhotos: people.filter((x) => x.photo === "placeholder").length,
            // People the English page is missing (by count: names differ between languages).
            noEnglish: enMembers ? Math.max(0, people.length - memberLists(parsePage(enMembers).doc).current.reduce((n, l) => n + l.items.filter((i) => i.name).length, 0)) : 0,
          }
        : null,
      checks: (checks || []).map((c) => ({ kind: c.kind, level: c.level, total: c.total })),
      sync: (sync || []).length,
      unpublishedDays: oldest ? Math.floor((Date.now() - oldest) / 86400000) : null,
      views30: stats ? stats.total : null,
      comments: (p.comments?.list || []).filter((c) => !c.resolvedAt).length,
    },
    enHome,
  };
}

export default function HealthCheck({ p, open, onClose, onAction }) {
  const [state, setState] = useState(null); // { findings, score, ai?, aiBusy, error }
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setState(null);
    (async () => {
      const { signals, enHome } = await gather(p);
      const findings = healthFindings(signals);
      if (!alive) return;
      setState({ findings, score: healthScore(findings), aiBusy: !!p.ai?.available && findings.length > 0 });
      if (!p.ai?.available || !findings.length) return;
      try {
        const ai = await p.cloudCalls.health(p.cloudSite.id, { findings: findings.map(({ id, title, why }) => ({ id, title, why })), english: enHome });
        if (alive) setState((s) => ({ ...s, ai, aiBusy: false }));
      } catch (e) {
        if (alive) setState((s) => ({ ...s, aiBusy: false, error: e.message }));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const byId = Object.fromEntries((state?.findings || []).map((f) => [f.id, f]));
  const shown = state?.ai?.items?.length ? state.ai.items.map((x) => ({ ...byId[x.id], why: x.why })).filter((x) => x.id) : (state?.findings || []).slice(0, 5);
  const rest = state ? state.findings.filter((f) => !shown.some((x) => x.id === f.id)) : [];
  return (
    <Modal open={open} onClose={onClose} title="網站體檢" description="看一遍整個網站，列出最值得先處理的事。" wide>
      {!state ? (
        <p className="muted health-wait">
          <Heartbeat size={18} /> 正在看整個網站：最新消息、論文、成員、連結、中英文…
        </p>
      ) : (
        <div className="health">
          <div className="health-top">
            <div className={"health-score" + (state.score >= 85 ? " good" : state.score >= 60 ? " ok" : "")}>
              <strong>{state.score}</strong>
              <span>分</span>
            </div>
            <p>{state.ai?.summary || (state.findings.length ? `找到 ${state.findings.length} 件可以改善的事，先從最上面開始。` : "網站狀態很好，沒有發現要處理的事。")}</p>
          </div>
          {state.aiBusy && (
            <p className="small-note health-ai">
              <Sparkle size={14} /> AI 正在排出最該先處理的事…
            </p>
          )}
          {state.error && <p className="small-note">（AI 這次沒有回應，先照系統的順序列出：{state.error}）</p>}
          {shown.length > 0 && (
            <ol className="health-list">
              {shown.map((f) => (
                <li key={f.id}>
                  <div>
                    <strong>{f.title}</strong>
                    <span>{f.why}</span>
                  </div>
                  <Button size="2" variant="soft" onClick={() => onAction(f.action)}>
                    去處理
                  </Button>
                </li>
              ))}
            </ol>
          )}
          {state.ai?.english?.length > 0 && (
            <div className="health-english">
              <strong>英文首頁可以再順一點</strong>
              {state.ai.english.map((x, i) => (
                <div key={i} className="health-en">
                  <p className="muted">
                    <del>{x.quote}</del>
                  </p>
                  <p>{x.better}</p>
                </div>
              ))}
              <button type="button" className="text-link" onClick={() => onAction("english")}>
                到英文首頁修改
              </button>
            </div>
          )}
          {rest.length > 0 && (
            <details className="health-rest">
              <summary>其他 {rest.length} 件小事</summary>
              <ul>
                {rest.map((f) => (
                  <li key={f.id}>
                    {f.title}
                    <button type="button" className="text-link" onClick={() => onAction(f.action)}>
                      去處理
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="small-note">分數只是讓你看到進度，不是評分。體檢只讀網站，不會改任何東西。</p>
        </div>
      )}
    </Modal>
  );
}
