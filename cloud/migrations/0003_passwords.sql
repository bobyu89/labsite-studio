-- Email + password sign-in, next to one-time invite links: after signing in
-- once with a link, a teacher can set a password and sign in on any computer.
-- Only a salted PBKDF2-SHA256 hash is stored: pbkdf2-sha256$<iterations>$<salt>$<hash>.
CREATE TABLE accounts (
  email         TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  updated_at    INTEGER NOT NULL,
  failed_count  INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER
);

-- How a session started (invite | device | password), so a session that just
-- came from a link may set a new password without the old one (forgotten password).
ALTER TABLE sessions ADD COLUMN via TEXT;
