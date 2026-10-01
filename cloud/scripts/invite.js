// Make a one-time sign-in link from the command line — the way in for the
// first admin, before anyone can make links in the editor.
//
//   node scripts/invite.js you@example.com              remote D1 (deployed)
//   node scripts/invite.js you@example.com --local      local dev server data
//   node scripts/invite.js you@example.com --base https://studio.example.com
//
// Only the SHA-256 of the link's secret is written to the database.
import { randomBytes, createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE = "https://labsite-studio-cloud.shiftguard-navicare.workers.dev";
const TTL = 14 * 24 * 3600 * 1000;
const cloud = fileURLToPath(new URL("..", import.meta.url));

const args = process.argv.slice(2);
const email = String(args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--base") || "").trim().toLowerCase();
const local = args.includes("--local");
const base = (args.includes("--base") ? args[args.indexOf("--base") + 1] : local ? "http://127.0.0.1:8787" : DEFAULT_BASE).replace(/\/+$/, "");
if (!/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(email)) {
  console.error("用法：node scripts/invite.js <email> [--local] [--base <網址>]");
  process.exit(1);
}

const token = randomBytes(32).toString("hex");
const hash = createHash("sha256").update(token).digest("hex");
const now = Date.now();

if (local) {
  const { sqliteD1 } = await import("../dev/bindings.js");
  const db = sqliteD1(join(cloud, ".wrangler/node-dev/labsite.sqlite"));
  db.raw
    .prepare("INSERT INTO invites (token_hash, email, created_by, created_at, expires_at) VALUES (?, ?, 'cli', ?, ?)")
    .run(hash, email, now, now + TTL);
} else {
  const sql = `INSERT INTO invites (token_hash, email, created_by, created_at, expires_at) VALUES ('${hash}', '${email}', 'cli', ${now}, ${now + TTL});\n`;
  const file = join(tmpdir(), `labsite-invite-${process.pid}.sql`);
  writeFileSync(file, sql);
  try {
    // One fixed command string; the only variable part is our own temp-file path.
    execSync(`npx wrangler d1 execute labsite --remote -c wrangler.api.toml --file "${file}" -y`, {
      cwd: cloud,
      stdio: ["ignore", "ignore", "inherit"],
    });
  } finally {
    rmSync(file, { force: true });
  }
}
console.log(`\n給 ${email} 的登入連結（只能用一次，14 天內有效）：\n\n${base}/?invite=${token}\n`);
