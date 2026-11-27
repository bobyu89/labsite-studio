// 從舊網站帶入: the readable text of a teacher's old website — the page they
// give, plus up to three pages on the same site whose links look like a
// CV, publications or research page. Only http(s) on a public host name.
const UA = "Mozilla/5.0 (compatible; LabSite profile import; +https://labsite-sites.shiftguard-navicare.workers.dev/)";
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_TEXT = 120_000;
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
  const res = await fetchImpl(url, { redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.5" }, signal: AbortSignal.timeout(10_000) });
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
