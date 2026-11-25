// Checks a site before it is published: template sample text and pictures
// left in, links without an address or to a page that does not exist, photos
// without alt text. Nothing here blocks publishing; it is a list to look at.
import { SITE_FIELDS, isSampleValue } from "./siteData.js";

const SKIP = new Set(["script", "style", "noscript", "template", "svg"]);
const SAMPLE_TEXT = /範例|\(sample\b[^)]*\)|lorem ipsum|Zhixing/i;
const PLACEHOLDER = /placeholder/i;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const short = (s) => {
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > 28 ? t.slice(0, 28) + "…" : t;
};

// The site path a link on `page` points to, or null when it leaves the site.
export function resolveLink(page, href) {
  const path = String(href).split(/[?#]/)[0];
  if (!path) return null;
  const dir = page.includes("/") ? page.slice(0, page.lastIndexOf("/") + 1) : "";
  const parts = [];
  for (const seg of (path.startsWith("/") ? path.slice(1) : dir + path).split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(decodeURIComponent(seg));
  }
  let out = parts.join("/");
  if (!out || path.endsWith("/")) out = (out ? out + "/" : "") + "index.html";
  return out;
}

// → { sample, placeholder, alt, empty, broken }: short examples for one page.
const VAGUE = /^(點這裡|按這裡|這裡|點此|更多|看更多|詳見|click here|here|more|read more|link|連結)$/i;
const FIXED = /(?:^|;)\s*(?:min-)?width\s*:\s*(\d{3,4})px/i;

// 無障礙與手機版: what makes a page hard to read with a screen reader or on a
// phone. Only what can be told from the HTML itself.
function readability(doc, found) {
  if (!doc.querySelector('meta[name="viewport"]')) found.viewport.push("缺少 viewport 設定，手機會顯示成縮小的電腦版");
  if (!doc.documentElement) return;
  if (!doc.documentElement.getAttribute("lang")) found.a11y.push("沒有標示網頁語言（lang）");
  const h1 = doc.querySelectorAll("body h1").length;
  if (h1 === 0) found.a11y.push("沒有主標題（h1）");
  else if (h1 > 1) found.a11y.push(`有 ${h1} 個主標題（h1），建議只留一個`);
  let last = 0;
  for (const h of doc.querySelectorAll("body h1, body h2, body h3, body h4, body h5, body h6")) {
    const level = Number(h.tagName[1]);
    if (last && level > last + 1) {
      found.a11y.push(`標題層級跳過了：「${short(h.textContent)}」是 h${level}，前一個是 h${last}`);
      break;
    }
    last = level;
  }
  for (const a of doc.querySelectorAll("body a[href]")) {
    const words = short(a.textContent);
    const label = a.getAttribute("aria-label") || a.getAttribute("title") || [...a.querySelectorAll("img[alt]")].map((i) => i.getAttribute("alt")).join("").trim();
    if (!words && !label) found.a11y.push("只有圖示、沒有文字的連結（" + (a.getAttribute("href") || "").slice(0, 30) + "）");
    else if (words && VAGUE.test(words)) found.a11y.push(`連結文字「${words}」看不出要去哪裡`);
  }
  for (const f of doc.querySelectorAll("body iframe")) if (!f.getAttribute("title")) found.a11y.push("影片或地圖沒有標題（title）");
  for (const el of doc.querySelectorAll("body [style], body table[width]")) {
    const m = (el.getAttribute("style") || "").match(FIXED);
    const w = m ? Number(m[1]) : Number(el.getAttribute("width")) || 0;
    if (w > 480 && el.tagName !== "IMG") found.mobile.push(`<${el.tagName.toLowerCase()}> 寬度固定 ${w}px，手機上會超出畫面`);
  }
}

export function checkPage(page, html, files) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found = { sample: [], placeholder: [], alt: [], empty: [], broken: [], viewport: [], mobile: [], a11y: [] };
  readability(doc, found);
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        if (SAMPLE_TEXT.test(child.nodeValue)) found.sample.push(short(child.nodeValue));
      } else if (child.nodeType === 1 && !SKIP.has(child.tagName.toLowerCase())) walk(child);
    }
  };
  if (doc.body) walk(doc.body);
  for (const img of doc.querySelectorAll("body img")) {
    const src = img.getAttribute("src") || "";
    const alt = img.getAttribute("alt");
    if (PLACEHOLDER.test(src)) found.placeholder.push(src.split("/").pop());
    if (alt === null) found.alt.push(src.split("/").pop() || "（沒有檔名）");
    else if (SAMPLE_TEXT.test(alt)) found.sample.push("照片說明：" + short(alt));
  }
  for (const a of doc.querySelectorAll("body a[href]")) {
    const href = (a.getAttribute("href") || "").trim();
    const text = short(a.textContent) || "（沒有文字的連結）";
    if (!href || href === "#") {
      found.empty.push(text);
      continue;
    }
    if (/^mailto:/i.test(href) && isSampleValue(href)) {
      found.sample.push("Email 連結：" + href.slice(7));
      continue;
    }
    if (href.startsWith("#") || EXTERNAL.test(href) || !files) continue;
    const target = resolveLink(page, href);
    if (target && /\.html?$/i.test(target) && !files.has(target)) found.broken.push(text + " → " + href);
  }
  return found;
}

export const CHECKS = [
  { kind: "sample", level: "warn", title: "還有範本的範例文字", hint: "把「範例」的內容換成研究室自己的資料，或刪掉用不到的段落。" },
  { kind: "placeholder", level: "warn", title: "還在用範本的示意圖", hint: "點預覽裡的圖片，按「換一張照片」放上真的照片。" },
  { kind: "empty", level: "warn", title: "連結還沒設定網址", hint: "點這個連結，在左邊的「網址」欄填上要連去的地方；用不到就刪掉。" },
  { kind: "broken", level: "warn", title: "連到不存在的頁面", hint: "網址打錯，或那一頁已經刪掉了。" },
  { kind: "sync", level: "warn", title: "中英文沒有一起更新", hint: "一種語言改了，另一種還沒跟著改。到那一頁按「請 AI 助手翻譯」，或確定不用改就按「不用改」。" },
  { kind: "deadlink", level: "warn", title: "外部連結打不開", hint: "對方網站說找不到這一頁，或這個 DOI 不存在。請確認網址，或換成新的連結。" },
  { kind: "viewport", level: "warn", title: "手機版會跑版", hint: "這一頁少了手機用的設定（viewport），手機會看到縮得很小的畫面。請管理者協助在頁面開頭加上 viewport。" },
  { kind: "mobile", level: "info", title: "手機上可能超出畫面", hint: "有固定寬度的區塊，手機的畫面比較窄，可能要左右滑。可以改用相簿、影片等元件，或請管理者調整。" },
  { kind: "a11y", level: "info", title: "無障礙：看不到畫面的讀者會卡住", hint: "用螢幕報讀軟體的讀者靠標題和連結文字瀏覽。連結文字請寫出要去哪裡（例如「下載招生簡章」），標題按層級排列。" },
  { kind: "alt", level: "info", title: "照片沒有替代文字", hint: "用一句話描述照片內容，看不到圖的讀者和搜尋引擎會讀這段文字。" },
];

// pages: [{ path, html }]; files: Set of the site's paths (null skips broken
// links); siteFields: readSiteFields(...).fields. → the checks that found
// something, each with { items: [{ page, count, examples }], total }.
// extra: { kind: [{ page, count, examples }] } found elsewhere (中英不同步,
// outside links checked by the server).
export function checkSite({ pages, files = null, siteFields = null, extra = {} }) {
  const byKind = Object.fromEntries(CHECKS.map((c) => [c.kind, [...(extra[c.kind] || [])]]));
  for (const { path, html } of pages) {
    if (!html) continue;
    for (const [kind, list] of Object.entries(checkPage(path, html, files)))
      if (list.length) byKind[kind].push({ page: path, count: list.length, examples: [...new Set(list)].slice(0, 3) });
  }
  const samples = (siteFields || []).filter((f) => !SITE_FIELDS[f.key]?.unused && isSampleValue(f.value));
  if (samples.length)
    byKind.sample.unshift({ page: null, count: samples.length, examples: samples.slice(0, 3).map((f) => f.label + "：" + short(f.value)) });
  return CHECKS.map((c) => ({ ...c, items: byKind[c.kind], total: byKind[c.kind].reduce((n, x) => n + x.count, 0) })).filter(
    (c) => c.total > 0,
  );
}

// Outside links on a page (http/https, not this site's own address) →
// [{ url, text }], for the server's link check.
export function externalLinks(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = [];
  for (const a of doc.querySelectorAll("body a[href]")) {
    const url = (a.getAttribute("href") || "").trim();
    if (/^https?:\/\//i.test(url)) out.push({ url, text: short(a.textContent) || url });
  }
  return out;
}
