-- Who has a site open in the editor right now, and on which page. Each open
-- editor writes its row about every 30 seconds; rows older than 90 seconds
-- are ignored, so a closed tab simply ages out. One row per person and site.
CREATE TABLE presence (
  site_id TEXT NOT NULL,
  email   TEXT NOT NULL,
  page    TEXT,
  at      INTEGER NOT NULL,
  PRIMARY KEY (site_id, email)
);
