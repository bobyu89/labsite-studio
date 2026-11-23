// 總覽 for admins: every site's state (unpublished saves, last save and
// publish, members, size, backup), every person (sites, password, last seen)
// and recent activity, in one request. Read-only.
import { isAdmin } from "./repo.js";
import { SESSION_TTL } from "./sessions.js";

const DAY = 24 * 3600 * 1000;
const STALE_DRAFT = 7 * DAY; // unpublished saves older than this get a note
const ACTIVITY = 40;

const changedCount = (text) => {
  try {
    return JSON.parse(text || "[]").length;
  } catch {
    return 0;
  }
};

export async function adminOverview(env, siteView, now = Date.now()) {
  const db = env.DB;
  const all = async (sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
  const [sites, members, heads, publishes, sessions, accounts, commits, events] = await Promise.all([
    all("SELECT * FROM sites ORDER BY name"),
    all("SELECT site_id, email, added_at FROM members ORDER BY email"),
    // The draft and published commits of each site, with the draft's tree.
    all(
      `SELECT s.id AS site_id, d.author, d.message, d.created_at AS draft_at, p.created_at AS published_at, t.entries
       FROM sites s
       LEFT JOIN commits d ON d.id = s.draft_commit
       LEFT JOIN commits p ON p.id = s.published_commit
       LEFT JOIN trees t ON t.id = d.tree_id`,
    ),
    all("SELECT site_id, actor, MAX(created_at) AS at FROM events WHERE kind = 'publish' GROUP BY site_id"),
    all(
      "SELECT email, MAX(expires_at) AS last_expiry, SUM(CASE WHEN expires_at > ? THEN 1 ELSE 0 END) AS active FROM sessions GROUP BY email",
      now,
    ),
    all("SELECT email FROM accounts"),
    all("SELECT site_id, author, message, changed, created_at FROM commits ORDER BY created_at DESC LIMIT ?", ACTIVITY),
    all("SELECT site_id, kind, actor, detail, created_at FROM events ORDER BY created_at DESC LIMIT ?", ACTIVITY),
  ]);
  // Saves since the last publish, per site that has unpublished changes.
  const pendingRows = await all(
    `SELECT s.id AS site_id, COUNT(c.id) AS n FROM sites s
     JOIN commits c ON c.site_id = s.id
     WHERE s.draft_commit IS NOT s.published_commit
       AND c.created_at > COALESCE((SELECT created_at FROM commits p WHERE p.id = s.published_commit), 0)
     GROUP BY s.id`,
  );
  const by = (rows, key = "site_id") => new Map(rows.map((r) => [r[key], r]));
  const headOf = by(heads);
  const pubOf = by(publishes);
  const pendingOf = by(pendingRows);
  const names = new Map(sites.map((s) => [s.id, s.name]));

  const siteRows = sites.map((s) => {
    const h = headOf.get(s.id) || {};
    let files = 0;
    let bytes = 0;
    try {
      for (const [, , size] of JSON.parse(h.entries || "[]")) {
        files++;
        bytes += size || 0;
      }
    } catch {
      /* unreadable tree: sizes stay 0 */
    }
    const view = siteView(env, s);
    const pending = view.unpublished ? pendingOf.get(s.id)?.n || 1 : 0;
    const flags = [];
    if (view.unpublished && h.draft_at && now - h.draft_at > STALE_DRAFT) flags.push("stale");
    if (s.backup_status === "error" || s.backup_status === "too_many") flags.push("backup");
    if (!members.some((m) => m.site_id === s.id)) flags.push("nobody");
    const pub = pubOf.get(s.id);
    return {
      ...view,
      created: s.created_at,
      members: members.filter((m) => m.site_id === s.id).map((m) => m.email),
      pending,
      lastSave: h.draft_at ? { by: h.author, message: h.message, at: h.draft_at } : null,
      lastPublish: pub ? { by: pub.actor, at: pub.at } : h.published_at ? { by: null, at: h.published_at } : null,
      files,
      bytes,
      flags,
    };
  });

  // Last seen: the newest session's expiry minus its lifetime (renewed at most daily).
  const sessionOf = by(sessions, "email");
  const withPassword = new Set(accounts.map((a) => a.email));
  const emails = new Set([...members.map((m) => m.email), ...sessions.map((s) => s.email), ...withPassword]);
  const people = [...emails]
    .map((email) => {
      const s = sessionOf.get(email);
      const lastSeen = s ? Math.min(now, s.last_expiry - SESSION_TTL) : null;
      return {
        email,
        admin: isAdmin(env, email),
        sites: members
          .filter((m) => m.email === email)
          .map((m) => names.get(m.site_id))
          .filter(Boolean),
        hasPassword: withPassword.has(email),
        lastSeen: lastSeen && lastSeen > 0 ? lastSeen : null,
        signedIn: s ? Number(s.active) > 0 : false,
      };
    })
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0) || a.email.localeCompare(b.email));

  const activity = [
    ...commits.map((c) => ({ kind: "save", site: names.get(c.site_id) || c.site_id, by: c.author, text: c.message, files: changedCount(c.changed), at: c.created_at })),
    ...events.map((e) => ({ kind: e.kind, site: names.get(e.site_id) || e.site_id, by: e.actor, text: e.detail || "", at: e.created_at })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, ACTIVITY);

  return { now, sites: siteRows, people, activity };
}
