-- LabSite Cloud: a small git-like store.
--   blobs   file contents, in R2 under b/<sha256>, deduplicated by hash
--   trees   one snapshot of a whole site: sorted [path, hash, size] list
--   commits one save: a tree plus who, when, why and which paths changed
--   sites   two moving pointers per site: draft_commit and published_commit

CREATE TABLE sites (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  draft_commit     TEXT,
  published_commit TEXT,
  github_repo      TEXT,          -- owner/name it was imported from and backs up to
  github_branch    TEXT,
  backup_commit    TEXT,          -- last of our commits mirrored to GitHub
  backup_status    TEXT,          -- ok | skipped | error | too_many
  backup_error     TEXT,
  backup_at        INTEGER,
  created_at       INTEGER NOT NULL
);

CREATE TABLE trees (
  id      TEXT PRIMARY KEY,         -- sha256 of the canonical JSON in entries
  entries TEXT NOT NULL             -- JSON [[path, hash, size], ...] sorted by path
);

CREATE TABLE commits (
  id         TEXT PRIMARY KEY,
  site_id    TEXT NOT NULL REFERENCES sites(id),
  parent_id  TEXT,
  tree_id    TEXT NOT NULL REFERENCES trees(id),
  author     TEXT NOT NULL,
  message    TEXT NOT NULL,
  changed    TEXT NOT NULL DEFAULT '[]', -- JSON [[path, "added"|"modified"|"deleted"], ...]
  created_at INTEGER NOT NULL
);
CREATE INDEX commits_site ON commits(site_id, created_at);

CREATE TABLE members (
  site_id TEXT NOT NULL REFERENCES sites(id),
  email   TEXT NOT NULL,
  role    TEXT NOT NULL DEFAULT 'editor',
  added_at INTEGER NOT NULL,
  PRIMARY KEY (site_id, email)
);
CREATE INDEX members_email ON members(email);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,          -- publish | restore | import | member_add | member_remove
  commit_id  TEXT,
  actor      TEXT NOT NULL,
  detail     TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX events_site ON events(site_id, created_at);
