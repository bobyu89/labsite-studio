-- 草稿分享連結: someone without an account can look at a site's unpublished
-- version through /<slug>/_draft/<token>/ until the link expires or is
-- taken back. commit_id NULL follows the latest saved version.
CREATE TABLE preview_links (
  token      TEXT PRIMARY KEY,
  site_id    TEXT NOT NULL,
  commit_id  TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX preview_links_site ON preview_links(site_id);

-- 在頁面上留言: a note on one section of one page, for the people who edit
-- the site. section is the section's position; anchor its title then, so a
-- note can still be found after sections move.
CREATE TABLE comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id     TEXT NOT NULL,
  page        TEXT NOT NULL,
  section     INTEGER NOT NULL,
  anchor      TEXT,
  body        TEXT NOT NULL,
  author      TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  resolved_by TEXT,
  resolved_at INTEGER
);
CREATE INDEX comments_site ON comments(site_id, resolved_at);
