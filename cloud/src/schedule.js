// 排程發布: a teacher picks a time; the cron (every 10 minutes) publishes the
// site's latest saved version once that time has passed — as if the teacher
// had pressed 發布 then. One schedule per site, in settings `schedule:<id>`.
import { getSite, publish, getSettings, setSetting, logEvent, RepoError } from "./repo.js";

export const SCHEDULE_ACTOR = "LabSite 排程發布";
const DAY = 86400000;

export async function setSchedule(env, site, at, by, now = Date.now()) {
  const when = Number(at);
  if (!Number.isFinite(when) || when < now + 60_000) throw new RepoError(400, "請選一個未來的時間（至少一分鐘後）。");
  if (when > now + 90 * DAY) throw new RepoError(400, "最多只能預約 90 天內。");
  const value = { at: when, by, setAt: now };
  await setSetting(env, "schedule:" + site.id, JSON.stringify(value), by, now);
  await logEvent(env, site.id, "schedule_set", null, by, new Date(when).toISOString(), now);
  return value;
}

export async function cancelSchedule(env, site, by, now = Date.now()) {
  await setSetting(env, "schedule:" + site.id, null);
  await logEvent(env, site.id, "schedule_cancel", null, by, null, now);
}

// Every due schedule: publish, then clear it (and any 請老師發布 request).
// A failure is kept on the schedule with its reason and not retried.
export async function runSchedules(env, now = Date.now()) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings WHERE key LIKE 'schedule:%'").all();
  const done = [];
  for (const row of results) {
    let s;
    try {
      s = JSON.parse(row.value);
    } catch {
      continue;
    }
    if (!s || s.error || s.at > now) continue;
    const siteId = row.key.slice("schedule:".length);
    const site = await getSite(env, siteId);
    if (!site) {
      await setSetting(env, row.key, null);
      continue;
    }
    try {
      if (site.draft_commit && site.draft_commit !== site.published_commit) {
        await publish(env, site.id, site.draft_commit, { actor: `${SCHEDULE_ACTOR}（${s.by}）`, now });
        await setSetting(env, "review:" + site.id, null);
      }
      await setSetting(env, row.key, null);
      done.push({ slug: site.slug, status: "published" });
    } catch (e) {
      await setSetting(env, row.key, JSON.stringify({ ...s, error: e.message || "發布失敗" }), SCHEDULE_ACTOR, now);
      done.push({ slug: site.slug, status: "error" });
    }
  }
  return done;
}
