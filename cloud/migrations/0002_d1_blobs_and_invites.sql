-- Run without R2 and without Cloudflare Access.
--
-- File contents in D1: base64 text in chunks of at most 1 MiB raw (D1 rows
-- are capped at 2 MB). A row in `blobs` is written last, so a blob is only
-- visible once every chunk is in place.
CREATE TABLE blobs (
  hash   TEXT PRIMARY KEY,
  size   INTEGER NOT NULL,
  chunks INTEGER NOT NULL
);
CREATE TABLE blob_chunks (
  hash TEXT NOT NULL,
  idx  INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (hash, idx)
);

-- Sign-in by invite link: an admin creates a one-time link for an email; the
-- link is exchanged for a session cookie. Only SHA-256 hashes of the secrets
-- are stored, so a database leak does not leak working links or sessions.
CREATE TABLE invites (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX invites_email ON invites(email);

CREATE TABLE sessions (
  id_hash    TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_email ON sessions(email);
