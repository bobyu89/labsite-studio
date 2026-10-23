// 嵌入：YouTube videos and Google Maps, as one more LabSite block.
//
//   <section class="ls-block ls-embed-section">
//     <div class="ls-wrap">
//       <h2 class="ls-title">…</h2><p class="ls-text">…</p>
//       <div class="ls-embed ls-embed--video|map"><iframe src="…" title="…" …></iframe></div>
//
// Teachers paste whatever they have (a YouTube link, a Google Maps link, the
// map's "嵌入地圖" code, or just an address); embedFromInput turns it into one
// of a few allowed embed addresses. Nothing else can become an iframe source:
// isAllowedEmbed is also checked when the editor writes an iframe's src.

export const EMBED_KINDS = {
  video: { name: "YouTube 影片", title: "影片", text: "在這裡寫一段影片的說明。" },
  map: { name: "Google 地圖", title: "交通方式", text: "在這裡寫地址、怎麼搭車或停車。" },
};
const YT_ID = /^[\w-]{11}$/;
const YT_LIST = /^[\w-]{10,64}$/;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function parseUrl(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  try {
    return new URL(/^https?:\/\//i.test(t) ? t : /^(www\.|m\.)?(youtube|youtu\.be|google|maps\.)/i.test(t) ? "https://" + t : t);
  } catch {
    return null;
  }
}
// "1h2m3s", "90s", "90" → seconds
function seconds(v) {
  if (!v) return 0;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
}

export function youtubeEmbed(input) {
  const u = parseUrl(input);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
  let id = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = (u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/) || [])[1];
  } else return null;
  const list = u.searchParams.get("list");
  const start = seconds(u.searchParams.get("t") || u.searchParams.get("start"));
  if (id && YT_ID.test(id)) return "https://www.youtube-nocookie.com/embed/" + id + (start ? "?start=" + start : "");
  if (list && YT_LIST.test(list)) return "https://www.youtube-nocookie.com/embed/videoseries?list=" + list;
  return null;
}

const mapQuery = (q, z) => "https://maps.google.com/maps?q=" + encodeURIComponent(q) + "&z=" + (z || 16) + "&output=embed";
export function mapEmbed(input) {
  let text = String(input || "").trim();
  if (!text) return null;
  // The "嵌入地圖" code from Google Maps: take its src.
  const code = text.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  if (code) text = code[1].replace(/&amp;/g, "&");
  const u = /^https?:\/\//i.test(text) || /^(www\.|maps\.)?google\./i.test(text) ? parseUrl(text) : null;
  if (!u) return { short: false, src: mapQuery(text) }; // an address or place name
  const host = u.hostname.toLowerCase();
  if (/(^|\.)goo\.gl$/.test(host)) return { short: true, src: null };
  if (!/^(www\.)?google\.[a-z.]+$|^maps\.google\.[a-z.]+$/.test(host)) return null;
  const path = decodeURIComponent(u.pathname);
  if (path.startsWith("/maps/embed")) {
    const pb = u.searchParams.get("pb");
    return pb ? { src: "https://www.google.com/maps/embed?pb=" + encodeURIComponent(pb).replace(/%21/g, "!") } : null;
  }
  const at = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/);
  const zoom = at ? Math.round(Number(at[3])) : null;
  const place = path.match(/^\/maps\/(?:place|search)\/([^/]+)/);
  if (place) return { src: mapQuery(place[1].replace(/\+/g, " "), zoom) };
  const q = u.searchParams.get("q") || u.searchParams.get("query");
  if (q) return { src: mapQuery(q, zoom || Number(u.searchParams.get("z")) || null) };
  if (at) return { src: mapQuery(at[1] + "," + at[2], zoom) };
  return null;
}

// → { ok: true, kind, src } or { ok: false, error }
export function embedFromInput(input, kind) {
  const text = String(input || "").trim();
  if (!text) return { ok: false, error: kind === "map" ? "貼上 Google 地圖的網址，或直接輸入地址。" : "貼上 YouTube 影片的網址。" };
  if (kind !== "map") {
    const src = youtubeEmbed(text);
    if (src) return { ok: true, kind: "video", src };
    if (kind === "video") return { ok: false, error: "看不出是哪一支 YouTube 影片，請貼上影片頁面的網址（youtube.com/watch?v=… 或 youtu.be/…）。" };
  }
  const map = mapEmbed(text);
  if (map?.short) return { ok: false, error: "地圖的短網址（maps.app.goo.gl）無法直接使用。請在 Google 地圖按「分享 › 嵌入地圖」複製程式碼貼上，或直接輸入地址。" };
  if (map?.src) return { ok: true, kind: "map", src: map.src };
  return { ok: false, error: "看不懂這個網址。請貼上 YouTube 影片網址、Google 地圖網址，或直接輸入地址。" };
}

export function isAllowedEmbed(src) {
  let u;
  try {
    u = new URL(String(src));
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  if ((u.hostname === "www.youtube-nocookie.com" || u.hostname === "www.youtube.com") && /^\/embed\/(?:[\w-]{11}|videoseries)$/.test(u.pathname)) return true;
  if (u.hostname === "www.google.com" && u.pathname === "/maps/embed" && u.searchParams.has("pb")) return true;
  if (u.hostname === "maps.google.com" && u.pathname === "/maps" && u.searchParams.get("output") === "embed") return true;
  return false;
}
export const embedKindOf = (src) => (/youtube/.test(String(src)) ? "video" : "map");

// What a teacher recognises in the field: the video link or the place.
export function embedLabel(src) {
  try {
    const u = new URL(src);
    if (/youtube/.test(u.hostname)) {
      const id = u.pathname.split("/").pop();
      if (id === "videoseries") return "https://www.youtube.com/playlist?list=" + u.searchParams.get("list");
      const start = u.searchParams.get("start");
      return "https://youtu.be/" + id + (start ? "?t=" + start : "");
    }
    return u.searchParams.get("q") || src;
  } catch {
    return String(src || "");
  }
}

// The editor preview is sandboxed, so players and maps cannot run in it; it
// shows this card instead (the saved page keeps the real iframe).
export function previewCard(src) {
  const kind = embedKindOf(src);
  const id = kind === "video" ? (String(src).match(/\/embed\/([\w-]{11})/) || [])[1] : null;
  const thumb = id ? `background:#1f2a26 center/cover no-repeat url(https://i.ytimg.com/vi/${id}/hqdefault.jpg);` : "background:#dfe8e3;";
  const badge =
    kind === "video"
      ? '<span style="width:68px;height:48px;border-radius:14px;background:#d9302c;display:grid;place-items:center"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>'
      : '<svg width="40" height="40" viewBox="0 0 24 24" fill="#c0392b" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>';
  const text = kind === "video" ? "YouTube 影片・發布後在網站上播放" : "Google 地圖：" + embedLabel(src) + "・發布後在網站上顯示";
  return (
    `<div data-ls-embed-preview style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;${thumb}color:#fff;font:600 14px/1.5 system-ui,sans-serif;text-align:center;padding:12px">` +
    badge +
    `<span style="background:rgba(20,30,26,.72);padding:4px 12px;border-radius:6px;max-width:90%">${esc(text)}</span></div>`
  );
}

function frame(kind, src, title) {
  return kind === "video"
    ? `<iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
    : `<iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;
}
export function embedBlock({ kind = "video", src, title = "", text = "" }) {
  if (!isAllowedEmbed(src)) throw new Error("這個網址不能嵌入。");
  const k = EMBED_KINDS[kind] || EMBED_KINDS.video;
  const heading = title || k.title;
  return `<section class="ls-block ls-embed-section">
  <div class="ls-wrap">
    <h2 class="ls-title">${esc(heading)}</h2>
    <p class="ls-text">${esc(text || k.text)}</p>
    <div class="ls-embed ls-embed--${kind === "map" ? "map" : "video"}">
      ${frame(kind, src, heading)}
    </div>
  </div>
</section>`;
}
