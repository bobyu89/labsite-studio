// The hourly job that moves sites off Google Sheets (src/site/sheets.js).
// For every site whose latest js/data.js still reads a sheet: copy the sheet
// in, save it as a version, and publish it when nothing else was waiting to
// be published, so visitors see the same news as before, now served from the
// site itself. A site with unpublished work gets the version on its draft and
// goes live with that site's next 發布.
import { moveOffSheets } from "../../src/site/sheets.js";
import { resolveRef, getBlob, commitChanges, publish, logEvent, getSite } from "./repo.js";
import { enc, dec } from "./bytes.js";

export const SHEET_ACTOR = "LabSite 自動搬移";

export async function moveSitesOffSheets(env, fetchImpl = fetch, now = Date.now()) {
  const { results } = await env.DB.prepare("SELECT id FROM sites WHERE draft_commit IS NOT NULL").all();
  const out = [];
  for (const { id } of results) {
    const site = await getSite(env, id);
    const { tree } = await resolveRef(env, site, "draft");
    const entry = tree.get("js/data.js");
    if (!entry) continue;
    const bytes = await getBlob(env, entry.hash);
    if (!bytes) continue;
    const before = dec.decode(bytes);
    let moved;
    try {
      moved = await moveOffSheets(before, fetchImpl);
    } catch (e) {
      out.push({ slug: site.slug, error: String(e.message || e) });
      continue;
    }
    if (!moved) continue;
    if (!moved.text) {
      out.push({ slug: site.slug, error: moved.errors.join("；") });
      continue;
    }
    const parts = [moved.news != null && `最新消息 ${moved.news} 則`, moved.events != null && `重要活動 ${moved.events} 則`].filter(Boolean);
    const wasClean = site.draft_commit === site.published_commit;
    let result;
    try {
      result = await commitChanges(env, id, {
        files: [{ path: "js/data.js", bytes: enc.encode(moved.text) }],
        base: { "js/data.js": entry.hash },
        author: SHEET_ACTOR,
        message: `從 Google 試算表搬進 LabSite：${parts.join("、")}`,
        now,
      });
    } catch (e) {
      // Someone saved js/data.js meanwhile: try again next hour.
      out.push({ slug: site.slug, error: String(e.message || e) });
      continue;
    }
    // Publish only this change: the new version must sit right on top of what is live.
    const published = wasClean && !result.noop && result.commit.parent_id === site.published_commit;
    if (published) await publish(env, id, result.commit.id, { actor: SHEET_ACTOR, now });
    await logEvent(env, id, "sheets_moved", result.commit.id, SHEET_ACTOR, parts.join("、") + (moved.errors.length ? "；" + moved.errors.join("；") : ""), now);
    out.push({ slug: site.slug, news: moved.news, events: moved.events, published, errors: moved.errors });
  }
  return out;
}
