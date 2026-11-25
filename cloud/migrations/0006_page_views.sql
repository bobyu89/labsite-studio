-- 網站造訪統計: views of each page of a published site, counted per day
-- (Taiwan time) by the public host. No cookies and nothing about the visitor
-- is kept: one counter per site, day and page.
CREATE TABLE page_views (
  site_id TEXT NOT NULL,
  day     TEXT NOT NULL,
  path    TEXT NOT NULL,
  views   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, day, path)
);
