// One-off fixes to a site's files, shipped like database migrations.
//
// Each patch names one file of one site and the exact version it was written
// for (the file's SHA-256). The hourly job applies a patch only to that exact
// version: once anyone has changed the file, the patch is skipped rather than
// guessed at. An applied patch is a normal version in the site's history
// (author "LabSite 自動修正"), published when nothing else was waiting, and
// can be undone from 舊版本 like any other.
import { resolveRef, getBlob, commitChanges, publish, logEvent, getSite } from "./repo.js";
import { enc, dec } from "./bytes.js";

export const PATCH_ACTOR = "LabSite 自動修正";

// Exact, checked text replacement: throws unless `from` occurs exactly once.
export function replaceOnce(text, from, to) {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error("找不到要修改的位置：" + from.slice(0, 40));
  return text.slice(0, at) + to + text.slice(at + from.length);
}

const YCHO_LOCAL_PHOTOS = `/* 活動照片清單 — 在 LabSite 編輯器的「活動相簿」新增、排序、寫說明。
   照片放在 assets/gallery/；這個清單是空的時候顯示下方的佔位照片。 */
const LOCAL_PHOTOS = [];

`;

const YCHO_FETCH_PHOTOS = `/* 活動照片：LabSite「活動相簿」管理的 LOCAL_PHOTOS；空的時候顯示佔位照片。
   英文頁在 en/ 底下，網站內的照片路徑要先回到上一層。 */
function localPhotos() {
  const root = /\\/en\\//.test(location.pathname) ? "../" : "";
  const rooted = (src) => (/^(https?:|\\/|data:|\\.\\.\\/)/.test(src) ? src : root + src);
  return LOCAL_PHOTOS.map((p) => ({ src: rooted(p.src), thumb: rooted(p.thumb || p.src), caption: p.caption || "" }));
}

async function fetchPhotos(limit) {
  let photos = localPhotos();
  if (!photos.length) return limit ? FALLBACK_PHOTOS.slice(0, limit) : FALLBACK_PHOTOS;
  photos = sortPhotosByCaptionDate(photos);
  return limit ? photos.slice(0, limit) : photos;
}`;

export const PATCHES = [
  {
    // 賀老師網站：照片牆原本讀 Google 雲端硬碟資料夾（資料夾是空的，正式站的
    // 請求也被 Google 拒絕，所以一直顯示佔位照片）。改成讀 LabSite 管理的
    // LOCAL_PHOTOS，並把寫在公開檔案裡的 Google API 金鑰拿掉。
    id: "2026-11-ycho-photos-off-drive",
    slug: "ycho-lab-website",
    path: "js/data.js",
    from: "cd542dc555e735fc8ea0922e67363747f17a3c61283f4daea85ea7d9bc01c68a",
    message: "活動照片改由 LabSite「活動相簿」管理，不再讀 Google 雲端硬碟",
    apply(text) {
      let t = text;
      t = replaceOnce(
        t,
        '  DRIVE_FOLDER_ID: "1Vi93_Xw7oruDRUguRs4q-mFFfYGNtbAD",            // 雲端「實驗室網站/活動照片」資料夾\n  DRIVE_API_KEY: "AIzaSyD6XJELxWdiiCTPNgHiJrT-09n-X6clCYc"         // 限制 referrer：bobyu89.github.io、localhost:8788\n',
        '  DRIVE_FOLDER_ID: "",  // 活動照片改在 LabSite「活動相簿」管理（原雲端硬碟資料夾 1Vi93_Xw7oruDRUguRs4q-mFFfYGNtbAD）\n  DRIVE_API_KEY: ""\n',
      );
      t = replaceOnce(t, "/* 佔位照片 — 尚未串接 Drive 或雲端相簿為空時顯示 */\n", YCHO_LOCAL_PHOTOS + "/* 佔位照片 — 活動相簿還沒有照片時顯示 */\n");
      t = replaceOnce(t, 'caption: "實驗室活動照片（雲端串接後自動更新）"', 'caption: "實驗室活動照片（在 LabSite 活動相簿加入照片後更新）"');
      const start = t.indexOf("async function fetchPhotos(limit) {");
      const end = t.indexOf("\n}\n", start) + 2;
      if (start < 0 || end < 2 || !t.slice(start, end).includes("googleapis.com/drive")) throw new Error("fetchPhotos 和預期的不同。");
      t = t.slice(0, start) + YCHO_FETCH_PHOTOS + t.slice(end);
      return t;
    },
  },
];

// The hourly run. → [{ id, slug, status: "applied" | "skipped" | "error", … }]
export async function applyPatches(env, patches = PATCHES, now = Date.now()) {
  const out = [];
  for (const patch of patches) {
    const site = await getSite(env, patch.slug);
    if (!site?.draft_commit) continue;
    const done = await env.DB.prepare("SELECT 1 AS ok FROM events WHERE site_id = ? AND kind = 'patch' AND detail = ?").bind(site.id, patch.id).first();
    if (done) continue;
    const { tree } = await resolveRef(env, site, "draft");
    const entry = tree.get(patch.path);
    if (!entry || entry.hash !== patch.from) {
      out.push({ id: patch.id, slug: patch.slug, status: "skipped", reason: entry ? "檔案已經改過" : "沒有這個檔案" });
      continue;
    }
    try {
      const bytes = await getBlob(env, entry.hash);
      const text = patch.apply(dec.decode(bytes));
      const wasClean = site.draft_commit === site.published_commit;
      const result = await commitChanges(env, site.id, {
        files: [{ path: patch.path, bytes: enc.encode(text) }],
        base: { [patch.path]: entry.hash },
        author: PATCH_ACTOR,
        message: patch.message,
        now,
      });
      const published = wasClean && !result.noop && result.commit.parent_id === site.published_commit;
      if (published) await publish(env, site.id, result.commit.id, { actor: PATCH_ACTOR, now });
      await logEvent(env, site.id, "patch", result.commit.id, PATCH_ACTOR, patch.id, now);
      out.push({ id: patch.id, slug: patch.slug, status: "applied", published });
    } catch (e) {
      out.push({ id: patch.id, slug: patch.slug, status: "error", reason: String(e.message || e) });
    }
  }
  return out;
}
