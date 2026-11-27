// 從舊網站帶入: the readable text of a teacher's old website. crawlSite reads
// the whole site — the page they give and up to 20 pages under the same
// folder of the same host, papers / CV / research pages first — and the CV
// PDFs it links to. Only http(s) on a public host name.
const UA = "Mozilla/5.0 (compatible; LabSite profile import; +https://labsite-sites.shiftguard-navicare.workers.dev/)";
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_TEXT = 150_000;
const MAX_PDF = 8 * 1024 * 1024;
const WANTED = /publication|paper|journal|cv|vita|about|bio|research|profile|論文|著作|發表|簡歷|履歷|簡介|研究|經歷/i;

export function checkUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || /^\[|^\d+\.\d+\.\d+\.\d+$/.test(host) || /\.(local|internal|lan)$/.test(host)) return null;
  u.hash = "";
  return u;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function htmlText(html) {
  return String(html || "")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|dd|dt)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) =>
      e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? m,
    )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Links on the page that go to the same site and look like CV / papers pages.
export function wantedLinks(html, base) {
  const out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    if (u.host !== base.host || !/^https?:$/.test(u.protocol) || /\.(pdf|jpe?g|png|gif|zip|docx?)$/i.test(u.pathname)) continue;
    if (!WANTED.test(u.pathname + " " + htmlText(m[2]))) continue;
    u.hash = "";
    if (u.href !== base.href && !out.includes(u.href)) out.push(u.href);
  }
  return out.slice(0, 3);
}

async function getHtml(url, fetchImpl) {
  const res = await fetchImpl(url, { redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.5" }, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(res.status === 404 ? "找不到這個網頁" : "網站回應 " + res.status);
  const type = res.headers.get("Content-Type") || "";
  if (!/html|text\/plain/i.test(type)) throw new Error("這個網址不是網頁");
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error("網頁太大");
  return new TextDecoder("utf-8").decode(buf);
}

// → { text, pages: [url] }
export async function oldSiteText(raw, fetchImpl = fetch) {
  const url = checkUrl(raw);
  if (!url) throw Object.assign(new Error("請貼上完整的網址，例如 https://www.example.edu.tw/~wang/"), { status: 400 });
  let html;
  try {
    html = await getHtml(url.href, fetchImpl);
  } catch (e) {
    throw Object.assign(new Error("讀不到這個網址：" + (e.name === "TimeoutError" ? "網站太久沒有回應" : e.message)), { status: 400 });
  }
  const pages = [url.href];
  let text = `# ${url.href}\n${htmlText(html)}`;
  for (const link of wantedLinks(html, url)) {
    if (text.length > MAX_TEXT) break;
    try {
      text += `\n\n# ${link}\n${htmlText(await getHtml(link, fetchImpl))}`;
      pages.push(link);
    } catch {
      /* a page that does not open is skipped */
    }
  }
  return { text: text.slice(0, MAX_TEXT), pages };
}

/* ------------------------------------------------------- the whole site */
// The folder a site lives in: /~wang/ for https://u.edu.tw/~wang/index.html,
// so a teacher's pages on a university host do not lead into the whole university.
export function scopeOf(url) {
  const path = url.pathname.endsWith("/") ? url.pathname : url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1);
  return url.host + (path || "/");
}
const inScope = (u, scope) => (u.host + u.pathname).startsWith(scope);
const CV_LINK = /cv|vita|resume|履歷|簡歷|curriculum/i;

// Every same-scope link on a page: { pages: [href], pdfs: [href] }, pages
// that look like papers / CV / research first.
export function siteLinks(html, base, scope) {
  const pages = [];
  const pdfs = [];
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = "";
    const words = htmlText(m[2]);
    if (/\.pdf$/i.test(u.pathname)) {
      if (u.host === base.host && CV_LINK.test(u.pathname + " " + words) && !pdfs.includes(u.href)) pdfs.push(u.href);
      continue;
    }
    if (!inScope(u, scope) || /\.(jpe?g|png|gif|svg|webp|zip|docx?|pptx?|xlsx?|mp4|mp3)$/i.test(u.pathname)) continue;
    if (!pages.some((x) => x.href === u.href)) pages.push({ href: u.href, wanted: WANTED.test(u.pathname + " " + words) });
  }
  return { pages: [...pages.filter((x) => x.wanted), ...pages.filter((x) => !x.wanted)].map((x) => x.href), pdfs };
}

async function getPdf(url, fetchImpl) {
  const res = await fetchImpl(url, { redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok || !/pdf/i.test(res.headers.get("Content-Type") || "")) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_PDF || buf.byteLength < 200) return null;
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

// → { text, pages: [url], pdfs: [{ url, base64 }] }
// starts: one or more addresses (the teacher's, or the ones they ticked
// from a web search); the page budget is shared between them.
export async function crawlSite(starts, fetchImpl = fetch, { maxPages = 20, maxPdfs = 2 } = {}) {
  const list = (Array.isArray(starts) ? starts : [starts]).map(checkUrl).filter(Boolean).slice(0, 6);
  if (!list.length) throw Object.assign(new Error("請貼上完整的網址，例如 https://www.example.edu.tw/~wang/"), { status: 400 });
  const seen = new Set();
  const queue = list.map((u) => ({ href: u.href, scope: scopeOf(u), start: true }));
  const pages = [];
  const pdfLinks = [];
  let text = "";
  let firstError = null;
  while (queue.length && pages.length < maxPages && text.length < MAX_TEXT) {
    const batch = [];
    while (queue.length && batch.length < 4 && pages.length + batch.length < maxPages) {
      const next = queue.shift();
      if (seen.has(next.href)) continue;
      seen.add(next.href);
      batch.push(next);
    }
    const got = await Promise.all(
      batch.map(async (item) => {
        try {
          if (/\.pdf$/i.test(new URL(item.href).pathname)) {
            if (!pdfLinks.includes(item.href)) pdfLinks.unshift(item.href);
            return null;
          }
          return { item, html: await getHtml(item.href, fetchImpl) };
        } catch (e) {
          if (item.start && !firstError) firstError = e;
          return null;
        }
      }),
    );
    for (const r of got) {
      if (!r) continue;
      pages.push(r.item.href);
      text += `\n\n# ${r.item.href}\n${htmlText(r.html)}`;
      const links = siteLinks(r.html, new URL(r.item.href), r.item.scope);
      for (const href of links.pages) if (!seen.has(href)) queue.push({ href, scope: r.item.scope });
      for (const href of links.pdfs) if (!pdfLinks.includes(href)) pdfLinks.push(href);
    }
  }
  if (!pages.length && !pdfLinks.length) {
    const e = firstError;
    throw Object.assign(new Error("讀不到這個網址：" + (e?.name === "TimeoutError" ? "網站太久沒有回應" : e?.message || "沒有內容")), { status: 400 });
  }
  const pdfs = [];
  for (const href of pdfLinks.slice(0, maxPdfs)) {
    const base64 = await getPdf(href, fetchImpl).catch(() => null);
    if (base64) pdfs.push({ url: href, base64 });
  }
  return { text: text.trim().slice(0, MAX_TEXT), pages, pdfs };
}
