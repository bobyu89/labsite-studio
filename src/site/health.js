// 網站體檢: what on the site most needs attention, from facts the editor
// already knows (news dates, the paper and people tables, 發布前檢查,
// 中英不同步, visits). Each finding says why and where to go; the AI only
// orders them and words them for the teacher (cloud/src/ai.js aiHealth).

import { antiPattern } from "./design.js";

const DAY = 86400000;
const daysSince = (date, now) => {
  const t = Date.parse(String(date || "").replace(/\./g, "-"));
  return Number.isFinite(t) ? Math.floor((now - t) / DAY) : null;
};

// signals: {
//   news: [{ date }] | null, papers: { latestYear, duplicates, noEnglish, noDoi, total } | null,
//   people: { total, placeholderPhotos, noEnglish } | null,
//   checks: [{ kind, level, total }], sync: number, unpublishedDays: number | null,
//   views30: number | null, comments: number }
// → [{ id, title, why, action, weight }] (highest weight first)
export function healthFindings(signals, now = Date.now()) {
  const out = [];
  const add = (id, weight, title, why, action) => out.push({ id, weight, title, why, action });
  const s = signals || {};
  const year = new Date(now).getFullYear();

  if (s.news) {
    const latest = s.news.map((n) => daysSince(n.date, now)).filter((d) => d !== null && d >= 0).sort((a, b) => a - b)[0];
    if (latest === undefined) add("news-empty", 70, "還沒有最新消息", "首頁的最新消息是訪客最先看的地方之一。", "news");
    else if (latest > 180) add("news-old", 80, `最新消息已經 ${Math.floor(latest / 30)} 個月沒更新`, "訪客會以為研究室不活躍了；一則活動或口試的消息就夠。", "news");
    else if (latest > 90) add("news-quiet", 40, `最新消息 ${Math.floor(latest / 30)} 個月沒更新`, "可以補上最近的活動、口試或獲獎。", "news");
  }
  if (s.papers) {
    if (s.papers.duplicates) add("papers-duplicate", 65, `有 ${s.papers.duplicates} 篇論文重複列出`, "同一篇出現兩次，看起來像沒整理過。", "data");
    if (s.papers.noEnglish) add("papers-english", 55, `有 ${s.papers.noEnglish} 篇論文英文頁沒有`, "國外學者會看英文頁。", "data");
    if (s.papers.latestYear && s.papers.latestYear < year - 1) add("papers-old", 60, `論文清單最新的是 ${s.papers.latestYear} 年`, "可以用 ORCID 或 DOI 一次匯入最近的論文。", "papers");
    else if (s.papers.latestYear === year - 1 && new Date(now).getMonth() >= 5) add("papers-year", 30, `今年（${year}）還沒有新論文`, "有今年發表的論文，可以加上去。", "papers");
    if (s.papers.noDoi > 5) add("papers-doi", 15, `${s.papers.noDoi} 篇論文沒有 DOI 連結`, "有 DOI，讀者一點就能找到全文。", "data");
  }
  if (s.people) {
    if (s.people.placeholderPhotos) add("people-photos", 50, `${s.people.placeholderPhotos} 位成員還是範例照片`, "換上真的照片，研究室看起來更有溫度。", "members");
    if (s.people.noEnglish) add("people-english", 35, `英文頁少了 ${s.people.noEnglish} 位成員`, "中文頁的成員比英文頁多，新加入的人可能還沒放到英文頁。", "members");
  }
  const check = (kind) => (s.checks || []).find((c) => c.kind === kind)?.total || 0;
  if (check("sample")) add("sample", 90, `還有 ${check("sample")} 處範本的範例文字`, "標著「（範例）」的內容會讓網站看起來還沒完成。", "start");
  if (check("placeholder")) add("placeholder", 75, `還有 ${check("placeholder")} 張範例照片`, "換成研究室真的照片。", "start");
  if (check("broken") || check("empty")) add("links", 60, `${check("broken") + check("empty")} 個連結點了沒反應`, "連到不存在的頁面，或還沒填網址。", "publish");
  if (check("viewport")) add("mobile", 70, "有頁面在手機上會跑版", "大部分訪客用手機看網站。", "publish");
  if (check("alt") + check("a11y") > 5) add("a11y", 20, "有幾處對看不到畫面的讀者不友善", "照片的替代文字、連結文字可以再補。", "publish");
  // 設計規範 anti-patterns the checks found (publishCheck DESIGN_KINDS).
  const DESIGN_WEIGHT = { "AP-19": 60, "AP-12": 50, "AP-08": 40, "AP-11": 35, "AP-01": 35, "AP-02": 30, "AP-16": 25, "AP-21": 25 };
  for (const c of s.checks || []) {
    const ap = /^AP-\d+$/.test(c.kind) ? antiPattern(c.kind) : null;
    if (ap && c.total) {
      out.push({ id: ap.id, weight: DESIGN_WEIGHT[ap.id] || 20, title: ap.title + (c.total > 1 ? `（${c.total} 處）` : ""), why: ap.fix, action: "publish", rule: ap.rule });
    }
  }
  if (s.sync) add("sync", 55, `${s.sync} 段中英文沒有一起更新`, "中文改了、英文還是舊的。", "sync");
  if (s.unpublishedDays !== null && s.unpublishedDays !== undefined && s.unpublishedDays > 7)
    add("unpublished", 65, `有修改放了 ${s.unpublishedDays} 天還沒發布`, "訪客看到的還是舊的網站。", "publish");
  if (s.comments) add("comments", 45, `有 ${s.comments} 則留言還沒處理`, "一起編輯的人留了話。", "comments");
  if (s.views30 === 0) add("views", 10, "最近 30 天還沒有人來看網站", "可以把網址放進信件簽名、系網或海報（上方有 QR Code）。", "share");
  return out.sort((a, b) => b.weight - a.weight);
}

// 0–100, for a sense of progress (not a grade): 100 minus the weights, gently.
export function healthScore(findings) {
  const cost = findings.reduce((n, f) => n + f.weight / 6, 0);
  return Math.max(10, Math.round(100 - cost));
}
