-- Platform settings the admin changes from the editor (the AI assistant's
-- API key, its daily cap, which sites may use it). One row per setting.
-- The key is only ever read by the worker; the API returns its last 4 characters.
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

-- Autosaved versions. NULL for a version someone saved on purpose; for an
-- autosave, when its run of autosaves began. A newer autosave by the same
-- person replaces the previous one of the same run, so the history keeps one
-- entry per sitting instead of one every half minute.
ALTER TABLE commits ADD COLUMN auto_since INTEGER;
