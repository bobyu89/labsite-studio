// The cloud backend: git-like repo, auth, GitHub import/backup, API and the
// public site host — all run against node:sqlite (real migrations) + a Map R2.
import test from "node:test";
import assert from "node:assert/strict";
import { fakeEnv, scriptedFetch, makeTar, gzip } from "./cloud-fakes.js";
import { enc, dec, sha256Hex } from "../cloud/src/bytes.js";
import {
  cleanPath,
  cleanSlug,
  createSite,
  commitChanges,
  restoreCommit,
  publish,
  history,
  resolveRef,
  getSite,
  addMember,
  sitesFor,
  canEdit,
} from "../cloud/src/repo.js";
import { parseTar, stripTopDir } from "../cloud/src/tar.js";
import { zip, crc32 } from "../cloud/src/zip.js";
import { verifyAccessJwt, currentUser, _resetCertCache } from "../cloud/src/auth.js";
import { fetchRepoFiles, backupToGitHub, backupAll } from "../cloud/src/github.js";
import { createApp } from "../cloud/src/api.js";
import { serve, route } from "../cloud/src/sites.js";

const T0 = 1_780_000_000_000;
const file = (path, text) => ({ path, bytes: enc.encode(text) });
const text = async (env, site, path, ref = "draft") => {
  const { tree } = await resolveRef(env, await getSite(env, site.id), ref);
  const e = tree.get(path);
  if (!e) return null;
  return dec.decode(env.BLOBS.store.get("b/" + e.hash));
};
const hashOf = async (env, site, path) =>
  (await resolveRef(env, await getSite(env, site.id), "draft")).tree.get(path)?.hash ?? null;

async function seed(env, extra = {}) {
  return createSite(env, {
    slug: "sung",
    name: "宋老師研究室",
    files: [file("index.html", "<h1>首頁</h1>"), file("en/index.html", "<h1>Home</h1>"), file("css/main.css", "body{}")],
    author: "admin@lab.tw",
    message: "初始匯入",
    now: T0,
    ...extra,
  });
}

/* ================================================================= repo */
test("paths and slugs are validated", () => {
  assert.equal(cleanPath("./assets/a.png"), "assets/a.png");
  assert.equal(cleanPath("en\\index.html"), "en/index.html");
  for (const bad of ["", "/etc/passwd", "../x", "a/../b", "a//b", "a/./b", "x\u0000"])
    assert.throws(() => cleanPath(bad), /不合法/);
  assert.equal(cleanSlug(" Sung-Lab "), "sung-lab");
  for (const bad of ["api", "-x", "x-", "a_b", "中文", "a".repeat(41)]) assert.throws(() => cleanSlug(bad), /網址代稱/);
});

test("createSite: first commit is draft and published; blobs are content-addressed and deduplicated", async () => {
  const env = fakeEnv();
  const site = await seed(env, { githubRepo: "bobyu89/sung-lab-website", githubBranch: "master" });
  assert.ok(site.draft_commit);
  assert.equal(site.published_commit, site.draft_commit);
  assert.equal(site.backup_commit, site.draft_commit, "imported from GitHub = already backed up");
  assert.equal(await text(env, site, "index.html"), "<h1>首頁</h1>");
  assert.equal(env.BLOBS.store.size, 3);
  const h = await sha256Hex("<h1>首頁</h1>");
  assert.ok(env.BLOBS.store.has("b/" + h));
  // Same content under another path: no new blob.
  await commitChanges(env, site.id, { files: [file("copy.html", "<h1>首頁</h1>")], author: "a", message: "m" });
  assert.equal(env.BLOBS.store.size, 3);
  await assert.rejects(() => seed(env), /已經有人使用/);
});

test("commitChanges: edits move the draft only; history is newest first with changed paths", async () => {
  const env = fakeEnv();
  const site = await seed(env);
  const base = { "index.html": await hashOf(env, site, "index.html"), "assets/pi.png": null };
  const r = await commitChanges(env, site.id, {
    files: [file("index.html", "<h1>新首頁</h1>"), { path: "assets/pi.png", bytes: new Uint8Array([1, 2, 3]) }],
    base,
    author: "teacher@lab.tw",
    message: "改首頁標題、換照片",
    now: T0 + 1000,
  });
  assert.deepEqual(r.changed, [["assets/pi.png", "added"], ["index.html", "modified"]]);
  const fresh = await getSite(env, site.id);
  assert.equal(fresh.draft_commit, r.commit.id);
  assert.equal(fresh.published_commit, site.published_commit, "publishing is a separate step");
  assert.equal(await text(env, site, "index.html", "published"), "<h1>首頁</h1>");
  assert.equal(await text(env, site, "index.html", "draft"), "<h1>新首頁</h1>");
  const h = await history(env, fresh);
  assert.deepEqual(h.map((c) => c.message), ["改首頁標題、換照片", "初始匯入"]);
  assert.equal(h[0].parent_id, h[1].id);
  assert.equal(h[0].author, "teacher@lab.tw");
  // Saving the same content again is a no-op, not a new version.
  const again = await commitChanges(env, site.id, { files: [file("index.html", "<h1>新首頁</h1>")], author: "a", message: "m" });
  assert.equal(again.noop, true);
  assert.equal((await history(env, fresh)).length, 2);
  // Deleting.
  const del = await commitChanges(env, site.id, { files: [{ path: "assets/pi.png", delete: true }], author: "a", message: "刪圖" });
  assert.deepEqual(del.changed, [["assets/pi.png", "deleted"]]);
});

test("conflicts: a stale base is refused by name; other files and identical writes merge", async () => {
  const env = fakeEnv();
  const site = await seed(env);
  const start = { "index.html": await hashOf(env, site, "index.html"), "en/index.html": await hashOf(env, site, "en/index.html") };
  // Teacher A saves the Chinese page.
  await commitChanges(env, site.id, { files: [file("index.html", "A")], base: { "index.html": start["index.html"] }, author: "a", message: "A" });
  // Teacher B, who opened before A saved, edits the same page → refused.
  await assert.rejects(
    () => commitChanges(env, site.id, { files: [file("index.html", "B")], base: { "index.html": start["index.html"] }, author: "b", message: "B" }),
    (e) => e.status === 409 && e.extra.conflicts.join() === "index.html",
  );
  assert.equal(await text(env, site, "index.html"), "A");
  // …but B's edit to the English page goes through on top of A's.
  await commitChanges(env, site.id, { files: [file("en/index.html", "B-en")], base: { "en/index.html": start["en/index.html"] }, author: "b", message: "B en" });
  assert.equal(await text(env, site, "index.html"), "A");
  assert.equal(await text(env, site, "en/index.html"), "B-en");
  // Writing exactly what is already there is never a conflict.
  const same = await commitChanges(env, site.id, { files: [file("index.html", "A")], base: { "index.html": start["index.html"] }, author: "b", message: "same" });
  assert.equal(same.noop, true);
  // A new file that someone else created meanwhile is a conflict when we expected it absent.
  await commitChanges(env, site.id, { files: [file("new.html", "x")], author: "a", message: "new" });
  await assert.rejects(
    () => commitChanges(env, site.id, { files: [file("new.html", "y")], base: { "new.html": null }, author: "b", message: "new" }),
    (e) => e.status === 409,
  );
});

test("racing saves on different files both land, in a single linear history", async () => {
  const env = fakeEnv();
  const site = await seed(env);
  const results = await Promise.all(
    ["a.html", "b.html", "c.html", "d.html"].map((p, i) =>
      commitChanges(env, site.id, { files: [file(p, p)], author: "u" + i, message: "add " + p }),
    ),
  );
  assert.ok(results.every((r) => !r.noop));
  const fresh = await getSite(env, site.id);
  const h = await history(env, fresh);
  assert.equal(h.length, 5, "four saves + import, none lost");
  for (const p of ["a.html", "b.html", "c.html", "d.html"]) assert.equal(await text(env, site, p), p);
  for (let i = 0; i < h.length - 1; i++) assert.equal(h[i].parent_id, h[i + 1].id);
});

test("restore makes a new version with an old tree; publish moves the published pointer", async () => {
  const env = fakeEnv();
  const site = await seed(env);
  const v1 = site.draft_commit;
  await commitChanges(env, site.id, { files: [file("index.html", "v2"), file("extra.html", "x")], author: "a", message: "v2" });
  const r = await restoreCommit(env, site.id, v1, { author: "b" });
  assert.match(r.commit.message, /^還原到 [0-9a-f]{7}（初始匯入）$/);
  assert.equal(await text(env, site, "index.html"), "<h1>首頁</h1>");
  assert.equal(await text(env, site, "extra.html"), null);
  assert.equal((await history(env, await getSite(env, site.id))).length, 3, "history is kept, not rewritten");
  const p = await publish(env, site.id, null, { actor: "b" });
  assert.equal(p.published_commit, r.commit.id);
  await assert.rejects(() => publish(env, site.id, "nope", { actor: "b" }), /找不到這個版本/);
  const other = await createSite(env, { slug: "ycho", name: "Y", files: [file("index.html", "y")], author: "a", message: "m" });
  await assert.rejects(() => publish(env, site.id, other.draft_commit, { actor: "b" }), /找不到這個版本/, "commits from another site are refused");
});

test("membership decides which sites a teacher sees and can edit", async () => {
  const env = fakeEnv();
  const sung = await seed(env);
  const ycho = await createSite(env, { slug: "ycho", name: "賀老師實驗室", files: [file("index.html", "y")], author: "a", message: "m" });
  await addMember(env, sung.id, " Sung@Lab.TW ", "admin@lab.tw");
  assert.deepEqual((await sitesFor(env, "sung@lab.tw")).map((s) => s.slug), ["sung"]);
  assert.deepEqual((await sitesFor(env, "admin@lab.tw")).map((s) => s.slug).sort(), ["sung", "ycho"]);
  assert.equal(await canEdit(env, sung, "SUNG@lab.tw"), true);
  assert.equal(await canEdit(env, ycho, "sung@lab.tw"), false);
  await assert.rejects(() => addMember(env, sung.id, "not-an-email", "a"), /Email/);
});

/* ============================================================ tar & zip */
test("tar: regular files, pax long names, GitHub's top directory and global header", () => {
  const long = "assets/" + "很長的檔名".repeat(12) + ".png";
  const tar = makeTar([
    { path: "pax_global_header", type: "g", data: "52 comment=0123456789abcdef0123456789abcdef01234567\n" },
    { path: "owner-repo-0123456/", type: "5" },
    { path: "owner-repo-0123456/index.html", data: "<h1>hi</h1>" },
    { path: "owner-repo-0123456/" + long, data: new Uint8Array([9, 8, 7]) },
  ]);
  const files = stripTopDir(parseTar(tar));
  assert.deepEqual(files.map((f) => f.path), ["index.html", long]);
  assert.equal(dec.decode(files[0].bytes), "<h1>hi</h1>");
  assert.deepEqual([...files[1].bytes], [9, 8, 7]);
});

test("zip: CRC-32 reference value and a well-formed central directory with UTF-8 names", () => {
  assert.equal(crc32(enc.encode("123456789")), 0xcbf43926);
  const out = zip([file("index.html", "<h1>hi</h1>"), file("圖片/a.txt", "abc")], new Date(2026, 0, 2, 3, 4, 6));
  const v = new DataView(out.buffer);
  const end = out.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  assert.equal(v.getUint16(end + 10, true), 2);
  const cd = v.getUint32(end + 16, true);
  assert.equal(v.getUint32(cd, true), 0x02014b50);
  assert.equal(v.getUint16(cd + 8, true) & 0x0800, 0x0800, "UTF-8 flag");
  const nameLen = v.getUint16(cd + 28, true);
  assert.equal(dec.decode(out.subarray(cd + 46, cd + 46 + nameLen)), "index.html");
  assert.equal(v.getUint32(cd + 16, true), crc32(enc.encode("<h1>hi</h1>")));
});

/* ================================================================= auth */
async function accessFixture() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1", alg: "RS256" };
  const b64u = (bytes) => Buffer.from(bytes).toString("base64url");
  const sign = async (payload, { kid = "k1", key = privateKey } = {}) => {
    const h = b64u(enc.encode(JSON.stringify({ alg: "RS256", kid })));
    const p = b64u(enc.encode(JSON.stringify(payload)));
    const s = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(h + "." + p)));
    return h + "." + p + "." + b64u(s);
  };
  const certs = scriptedFetch([["/cdn-cgi/access/certs", { json: { keys: [jwk] } }]]);
  return { sign, certs };
}
const TEAM = "lab.cloudflareaccess.com";
const AUD = "aud-123";

test("Access JWT: signature, audience, issuer and expiry are all enforced", async () => {
  _resetCertCache();
  const { sign, certs } = await accessFixture();
  const now = T0;
  const good = { aud: [AUD], iss: "https://" + TEAM, email: "Teacher@Lab.tw", exp: now / 1000 + 600 };
  const opts = { team: TEAM, aud: AUD, now, fetchImpl: certs };
  assert.equal((await verifyAccessJwt(await sign(good), opts)).email, "Teacher@Lab.tw");
  await assert.rejects(async () => verifyAccessJwt(await sign({ ...good, aud: ["other"] }), opts), /audience/);
  await assert.rejects(async () => verifyAccessJwt(await sign({ ...good, iss: "https://evil" }), opts), /issuer/);
  await assert.rejects(async () => verifyAccessJwt(await sign({ ...good, exp: now / 1000 - 1 }), opts), /expired/);
  const forged = (await sign(good)).split(".");
  forged[1] = Buffer.from(JSON.stringify({ ...good, email: "admin@lab.tw" })).toString("base64url");
  await assert.rejects(() => verifyAccessJwt(forged.join("."), opts), /signature/);
  const { privateKey: stranger } = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign"],
  );
  await assert.rejects(async () => verifyAccessJwt(await sign(good, { key: stranger }), opts), /signature/);
  await assert.rejects(async () => verifyAccessJwt(await sign(good, { kid: "nope" }), opts), /unknown key/);
  await assert.rejects(() => verifyAccessJwt("a.b", opts), /malformed/);
});

test("currentUser fails closed and dev sign-in only works on localhost", async () => {
  _resetCertCache();
  const { sign, certs } = await accessFixture();
  const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
  const token = await sign({ aud: AUD, iss: "https://" + TEAM, email: "T@Lab.tw", exp: Date.now() / 1000 + 600 });
  const req = (url, headers = {}) => new Request(url, { headers });
  assert.deepEqual(await currentUser(req("https://studio.x/api/me", { "Cf-Access-Jwt-Assertion": token }), env, certs), { email: "t@lab.tw", via: "access" });
  assert.deepEqual(await currentUser(req("https://studio.x/api/me", { Cookie: "a=1; CF_Authorization=" + token }), env, certs), { email: "t@lab.tw", via: "access" });
  assert.deepEqual(
    await currentUser(req("https://studio.x/api/me", { "Cf-Access-Jwt-Assertion": token }), { ...env, ACCESS_TEAM_DOMAIN: "https://" + TEAM + "/" }, certs),
    { email: "t@lab.tw", via: "access" },
    "team domain pasted with https:// from the dashboard",
  );
  assert.equal(await currentUser(req("https://studio.x/api/me"), env, certs), null, "no token");
  assert.equal(await currentUser(req("https://studio.x/api/me", { "Cf-Access-Jwt-Assertion": token }), {}, certs), null, "Access not configured");
  assert.equal(await currentUser(req("https://studio.x/api/me", { "Cf-Access-Authenticated-User-Email": "admin@lab.tw" }), env, certs), null, "plain email header is not trusted");
  const dev = { DEV_AUTH: "on", DEV_USER_EMAIL: "Dev@Lab.tw" };
  assert.deepEqual(await currentUser(req("http://127.0.0.1:8787/api/me"), dev), { email: "dev@lab.tw", via: "dev" });
  assert.deepEqual(await currentUser(req("http://localhost:8787/api/me", { "X-Dev-Email": "b@lab.tw" }), dev), { email: "b@lab.tw", via: "dev" });
  assert.equal(await currentUser(req("https://studio.x/api/me"), dev), null, "dev sign-in never applies off localhost");
});

/* ======================================================== GitHub import */
async function tarball(files, top = "bobyu89-sung-lab-website-abc1234") {
  return gzip(makeTar([{ path: top + "/", type: "5" }, ...files.map(([p, d]) => ({ path: top + "/" + p, data: d }))]));
}

test("fetchRepoFiles without a token: branch via git smart-HTTP, tarball via codeload, no REST API calls", async () => {
  const gz = await tarball([["index.html", "<h1>hi</h1>"], ["assets/a.png", new Uint8Array([1])], [".git/config", "x"], [".github/workflows/x.yml", "y"]]);
  const refs = "001e# service=git-upload-pack\n0000015b3c1e" + "a".repeat(36) + " HEAD\0multi_ack symref=HEAD:refs/heads/master agent=git/github\n0000";
  const f = scriptedFetch([
    ["/sung-lab-website.git/info/refs?service=git-upload-pack", { body: refs }],
    ["codeload.github.com/bobyu89/sung-lab-website/tar.gz/refs/heads/master", { body: gz }],
  ]);
  const { ref, files } = await fetchRepoFiles({ owner: "bobyu89", repo: "sung-lab-website", fetchImpl: f });
  assert.equal(ref, "master");
  assert.deepEqual(files.map((x) => x.path), ["index.html", "assets/a.png", ".github/workflows/x.yml"]);
  assert.equal(f.calls.length, 2);
  assert.ok(!f.calls.some((c) => c.url.includes("api.github.com")), "the shared-IP REST quota is never touched");
  // A branch with a slash keeps its slash.
  const g = scriptedFetch([["/tar.gz/refs/heads/feature/new-site", { body: gz }]]);
  assert.equal((await fetchRepoFiles({ owner: "o", repo: "r", branch: "feature/new-site", fetchImpl: g })).ref, "feature/new-site");
});

test("fetchRepoFiles with a token uses the REST API (private repos); GitHub refusals become clear messages", async () => {
  const gz = await tarball([["index.html", "x"]]);
  const f = scriptedFetch([
    [/\/repos\/o\/private$/, { json: { default_branch: "main" } }],
    ["/repos/o/private/tarball/main", { body: gz }],
  ]);
  const r = await fetchRepoFiles({ owner: "o", repo: "private", token: "t", fetchImpl: f });
  assert.equal(r.ref, "main");
  assert.equal(f.calls[0].headers.Authorization, "Bearer t");
  const limited = scriptedFetch([["/info/refs", { body: "" }], ["codeload", { status: 403, json: { message: "rate limited" } }]]);
  await assert.rejects(
    () => fetchRepoFiles({ owner: "o", repo: "r", fetchImpl: limited }),
    (e) => e.status === 503 && /流量限制/.test(e.message) && /rate limited/.test(e.message),
  );
  const missing = scriptedFetch([["/info/refs", { status: 404, body: "Not Found" }]]);
  await assert.rejects(() => fetchRepoFiles({ owner: "o", repo: "nope", fetchImpl: missing }), (e) => e.status === 404 && /找不到/.test(e.message));
});

/* ======================================================== GitHub backup */
// Git's blob name, as GitHub reports it in a tree listing.
async function gitSha(text) {
  const { createHash } = await import("node:crypto");
  const bytes = enc.encode(text);
  return createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), Buffer.from(bytes)])).digest("hex");
}
// A GitHub repository holding `files` ({ path: text }) on `branch`.
async function githubRepoRoutes(files, branch = "master") {
  let blobs = 0;
  const listing = await Promise.all(Object.entries(files).map(async ([path, text]) => ({ path, type: "blob", sha: await gitSha(text) })));
  return scriptedFetch([
    [`/git/ref/heads/${branch}`, { json: { object: { sha: "gh-head" } } }],
    ["/git/commits/gh-head", { json: { tree: { sha: "gh-tree" } } }],
    ["/git/trees/gh-tree?recursive=1", { json: { tree: listing, truncated: false } }],
    ["/git/blobs", () => ({ json: { sha: "gh-blob-" + ++blobs } })],
    ["/git/trees", { json: { sha: "gh-tree-2" } }],
    ["/git/commits", { json: { sha: "gh-commit-2" } }],
    [`/git/refs/heads/${branch}`, { json: {} }],
  ]);
}
const SEED_FILES = { "index.html": "<h1>首頁</h1>", "en/index.html": "<h1>Home</h1>", "css/main.css": "body{}" };

test("backup mirrors the latest saved version as one GitHub commit: only changed files, never forced", async () => {
  const env = fakeEnv({ GITHUB_BACKUP_TOKEN: "ghp_test" });
  const site = await seed(env, { githubRepo: "bobyu89/sung-lab-website", githubBranch: "master" });
  await commitChanges(env, site.id, {
    files: [file("index.html", "v2"), { path: "css/main.css", delete: true }, file("assets/n.png", "png")],
    author: "teacher@lab.tw",
    message: "改首頁",
  });
  // Not published yet: the saved work is backed up anyway.
  const gh = await githubRepoRoutes(SEED_FILES);
  assert.equal(await backupToGitHub(env, site.id, gh), "ok");
  const steps = gh.calls.map((c) => c.method + " " + c.url.replace("https://api.github.com/repos/bobyu89/sung-lab-website/", ""));
  assert.deepEqual(steps, [
    "GET git/ref/heads/master",
    "GET git/commits/gh-head",
    "GET git/trees/gh-tree?recursive=1",
    "POST git/blobs",
    "POST git/blobs",
    "POST git/trees",
    "POST git/commits",
    "PATCH git/refs/heads/master",
  ]);
  const tree = JSON.parse(gh.calls[5].body);
  assert.equal(tree.base_tree, "gh-tree");
  assert.deepEqual(tree.tree.map((e) => [e.path, e.sha]), [["css/main.css", null], ["assets/n.png", "gh-blob-1"], ["index.html", "gh-blob-2"]]);
  assert.deepEqual(JSON.parse(gh.calls[7].body), { sha: "gh-commit-2" }, "fast-forward only, no force");
  assert.match(JSON.parse(gh.calls[6].body).message, /改首頁.*teacher@lab\.tw/);
  const after = await getSite(env, site.id);
  assert.equal(after.backup_status, "ok");
  assert.equal(after.backup_commit, after.draft_commit);
  // Nothing new: no GitHub calls at all.
  const idle = await githubRepoRoutes(SEED_FILES);
  assert.equal(await backupToGitHub(env, site.id, idle), "ok");
  assert.equal(idle.calls.length, 0);
});

test("backup: skipped without a token, errors recorded, big changes go in batches, template sites go to BACKUP_REPO", async () => {
  const env = fakeEnv();
  const site = await seed(env, { githubRepo: "o/r", githubBranch: "master" });
  await commitChanges(env, site.id, { files: [file("index.html", "v2")], author: "a", message: "m" });
  assert.equal(await backupToGitHub(env, site.id, scriptedFetch([])), "skipped");
  env.GITHUB_BACKUP_TOKEN = "t";
  assert.equal(await backupToGitHub(env, site.id, scriptedFetch([["/git/ref/", { status: 401, json: { message: "Bad credentials" } }]])), "error");
  assert.match((await getSite(env, site.id)).backup_error, /401 Bad credentials/);
  // 5 changed files, 2 per run: three runs; files GitHub already has are not sent again.
  const many = Array.from({ length: 5 }, (_, i) => file(`p${i}.html`, String(i)));
  await commitChanges(env, site.id, { files: many, author: "a", message: "big" });
  const remote = { ...SEED_FILES };
  const sent = [];
  for (let run = 0; run < 3; run++) {
    const gh = await githubRepoRoutes(remote);
    const r = await backupToGitHub(env, site.id, gh, { batch: 2 });
    const t = gh.calls.find((c) => c.method === "POST" && c.url.endsWith("/git/trees"));
    const paths = JSON.parse(t.body).tree.filter((e) => e.sha).map((e) => e.path);
    sent.push(paths);
    for (const p of paths) remote[p] = p === "index.html" ? "v2" : String(p.match(/\d/)[0]);
    assert.equal(r, run < 2 ? "partial" : "ok");
  }
  assert.deepEqual(sent.flat().sort(), ["index.html", "p0.html", "p1.html", "p2.html", "p3.html", "p4.html"]);
  assert.match((await getSite(env, site.id)).backup_status, /^ok$/);

  // A site made from a template: its own folder in the shared backup repository.
  env.BACKUP_REPO = "bobyu89/labsite-backups";
  const tpl = await createSite(env, { slug: "lin", name: "林老師", files: [file("index.html", "x")], author: "a", message: "模板", live: false });
  const gh = await githubRepoRoutes({ "README.md": "backups", "sites/other/index.html": "keep" }, "main");
  assert.equal(await backupToGitHub(env, tpl.id, gh), "ok");
  const t = JSON.parse(gh.calls.find((c) => c.method === "POST" && c.url.endsWith("/git/trees")).body);
  assert.deepEqual(t.tree.map((e) => e.path), ["sites/lin/index.html"], "other sites and the README are left alone");
  assert.match(gh.calls[0].url, /bobyu89\/labsite-backups\/git\/ref\/heads\/main/);
});

test("hourly backup: only changed sites, oldest first, within one run's request budget", async () => {
  const env = fakeEnv({ GITHUB_BACKUP_TOKEN: "t" });
  const a = await seed(env, { githubRepo: "o/a", githubBranch: "master" });
  await commitChanges(env, a.id, { files: [file("index.html", "a2")], author: "x", message: "a" });
  const gh = await githubRepoRoutes(SEED_FILES);
  const done = await backupAll(env, gh);
  assert.deepEqual(done, [["sung", "ok"]]);
  const again = await githubRepoRoutes(SEED_FILES);
  assert.deepEqual(await backupAll(env, again), [], "nothing changed: no work, no requests");
  assert.equal(again.calls.length, 0);
  assert.deepEqual(await backupAll({ ...env, GITHUB_BACKUP_TOKEN: "" }, again), []);
});

/* ================================================================== API */
function api(env, fetchImpl = scriptedFetch([])) {
  const app = createApp({ fetchImpl });
  return async (method, path, { body, as, headers = {} } = {}) => {
    const res = await app.fetch(
      new Request("http://localhost:8787" + path, {
        method,
        headers: { ...(as ? { "X-Dev-Email": as } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
    const type = res.headers.get("Content-Type") || "";
    const data = type.includes("json") ? await res.json() : new Uint8Array(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  };
}

test("API: pending lists what 發布 would put live, by person, and the files that differ", async () => {
  const env = fakeEnv();
  const site = await seed(env);
  await addMember(env, site.id, "teacher@lab.tw", "admin@lab.tw");
  const call = api(env);
  assert.deepEqual((await call("GET", `/api/sites/${site.id}/pending`, { as: "teacher@lab.tw" })).data, { commits: [], files: [] });
  await commitChanges(env, site.id, { files: [file("index.html", "v2")], author: "teacher@lab.tw", message: "修改 首頁" });
  await commitChanges(env, site.id, { files: [file("assets/a.png", "png"), { path: "css/main.css", delete: true }], author: "admin@lab.tw", message: "換 1 張圖片" });
  const r = await call("GET", `/api/sites/${site.id}/pending`, { as: "teacher@lab.tw" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.commits.map((c) => [c.author, c.message]), [["admin@lab.tw", "換 1 張圖片"], ["teacher@lab.tw", "修改 首頁"]]);
  assert.deepEqual(r.data.files, [["assets/a.png", "added"], ["css/main.css", "deleted"], ["index.html", "modified"]]);
  await publish(env, site.id, null, { actor: "teacher@lab.tw" });
  assert.deepEqual((await call("GET", `/api/sites/${site.id}/pending`, { as: "teacher@lab.tw" })).data.commits, []);
  assert.equal((await call("GET", `/api/sites/${site.id}/pending`, { as: "stranger@lab.tw" })).status, 403);
});

test("API: import, read, save with conflict detection, history, publish, restore, export", async () => {
  const gz = await tarball([["index.html", "<h1>宋</h1>"], ["en/index.html", "<h1>Sung</h1>"], ["assets/a.png", new Uint8Array([1, 2])]]);
  const gh = scriptedFetch([["/tar.gz/refs/heads/master", { body: gz }]]);
  const env = fakeEnv();
  const call = api(env, gh);

  const created = await call("POST", "/api/sites", { body: { github: "https://github.com/bobyu89/sung-lab-website", branch: "master", slug: "sung", name: "宋老師研究室" } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.files, 3);
  const id = created.data.site.id;
  assert.equal(created.data.site.url, "https://sites.example/sung/");
  assert.equal(created.data.site.unpublished, false);

  const me = await call("GET", "/api/me");
  assert.equal(me.data.admin, true);
  assert.deepEqual(me.data.sites.map((s) => s.slug), ["sung"]);

  const tree = await call("GET", `/api/sites/${id}/tree`);
  assert.deepEqual(tree.data.entries.map((e) => e.path), ["assets/a.png", "en/index.html", "index.html"]);
  const hash = Object.fromEntries(tree.data.entries.map((e) => [e.path, e.hash]));

  const page = await call("GET", `/api/sites/${id}/files/en/index.html`);
  assert.equal(dec.decode(page.data), "<h1>Sung</h1>");
  assert.equal(page.headers.get("Content-Type"), "text/html; charset=utf-8");
  assert.equal(page.headers.get("ETag"), `"${hash["en/index.html"]}"`);
  assert.equal((await call("GET", `/api/sites/${id}/files/en/index.html`, { headers: { "If-None-Match": `"${hash["en/index.html"]}"` } })).status, 304);
  assert.equal((await call("GET", `/api/sites/${id}/files/nope.html`)).status, 404);
  assert.equal((await call("GET", `/api/sites/${id}/files/..%2Fsecret`)).status, 400);

  const saved = await call("POST", `/api/sites/${id}/commits`, {
    body: {
      message: "改中文首頁並換圖",
      base: { "index.html": hash["index.html"], "assets/b.png": null },
      files: [{ path: "index.html", text: "<h1>宋（新）</h1>" }, { path: "assets/b.png", base64: "AQID" }],
    },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.site.unpublished, true);
  assert.equal(saved.data.hashes["assets/b.png"], await sha256Hex(new Uint8Array([1, 2, 3])));
  assert.deepEqual(saved.data.changed, [["assets/b.png", "added"], ["index.html", "modified"]]);

  const stale = await call("POST", `/api/sites/${id}/commits`, {
    body: { message: "x", base: { "index.html": hash["index.html"] }, files: [{ path: "index.html", text: "old base" }] },
  });
  assert.equal(stale.status, 409);
  assert.deepEqual(stale.data.conflicts, ["index.html"]);

  const hist = await call("GET", `/api/sites/${id}/history`);
  assert.deepEqual(hist.data.commits.map((c) => [c.message, c.published, c.draft]), [
    ["改中文首頁並換圖", false, true],
    ["從 GitHub 匯入 bobyu89/sung-lab-website@master", true, false],
  ]);
  assert.equal(hist.data.commits[0].author, "admin@lab.tw");

  const pub = await call("POST", `/api/sites/${id}/publish`, { body: {} });
  assert.equal(pub.status, 200);
  assert.equal(pub.data.site.unpublished, false);
  assert.equal(pub.data.site.backup.status, "skipped", "no backup token in this env");

  const restored = await call("POST", `/api/sites/${id}/restore`, { body: { commit: hist.data.commits[1].id } });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.site.unpublished, true);
  assert.equal(dec.decode((await call("GET", `/api/sites/${id}/files/index.html`)).data), "<h1>宋</h1>");
  assert.equal(dec.decode((await call("GET", `/api/sites/${id}/files/index.html?ref=published`)).data), "<h1>宋（新）</h1>");

  const exp = await call("GET", `/api/sites/${id}/export?ref=published`);
  assert.equal(exp.headers.get("Content-Type"), "application/zip");
  assert.match(exp.headers.get("Content-Disposition"), /sung-[0-9a-f]{7}\.zip/);
  assert.equal(new DataView(exp.data.buffer).getUint32(0, true), 0x04034b50);
});

test("API: permissions — sign-in required, teachers see and edit only their sites, admin-only actions", async () => {
  const env = fakeEnv();
  const sung = await seed(env);
  const ycho = await createSite(env, { slug: "ycho", name: "賀", files: [file("index.html", "y")], author: "a", message: "m" });
  const call = api(env);

  // Not signed in (Access configured but no token, dev sign-in off).
  const locked = api({ ...env, DEV_AUTH: "off", ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD });
  assert.equal((await locked("GET", "/api/me")).status, 401);

  assert.equal((await call("POST", `/api/sites/${sung.id}/members`, { body: { email: "sung@lab.tw" } })).status, 200);
  const t = { as: "sung@lab.tw" };
  const me = await call("GET", "/api/me", t);
  assert.equal(me.data.admin, false);
  assert.deepEqual(me.data.sites.map((s) => s.slug), ["sung"]);
  assert.equal((await call("GET", `/api/sites/${ycho.id}/tree`, t)).status, 403);
  assert.equal((await call("GET", `/api/sites/${sung.id}/tree`, t)).status, 200);
  assert.equal((await call("POST", `/api/sites/${sung.id}/publish`, { ...t, body: {} })).status, 200, "teachers publish their own site");
  assert.equal((await call("POST", `/api/sites/${sung.id}/members`, { ...t, body: { email: "x@lab.tw" } })).status, 403);
  assert.equal((await call("POST", "/api/sites", { ...t, body: { github: "o/r" } })).status, 403);
  assert.equal((await call("GET", `/api/sites/${sung.id}`, t)).data.members, undefined, "member list is admin-only");
  assert.equal((await call("GET", `/api/sites/${sung.id}`)).data.members.length, 1);
  assert.equal((await call("DELETE", `/api/sites/${sung.id}/members/sung%40lab.tw`)).status, 200);
  assert.equal((await call("GET", `/api/sites/${sung.id}/tree`, t)).status, 403, "removed member loses access");
  assert.equal((await call("GET", "/api/nope")).status, 404);
  // Cross-origin writes (another site, or a sandboxed preview with Origin: null) are refused.
  for (const origin of ["null", "https://evil.example"])
    assert.equal(
      (await call("POST", `/api/sites/${sung.id}/publish`, { body: {}, headers: { Origin: origin } })).status,
      403,
      origin,
    );
  assert.equal((await call("POST", `/api/sites/${sung.id}/publish`, { body: {}, headers: { Origin: "http://localhost:8787" } })).status, 200);
  assert.equal((await call("GET", "/api/me", { headers: { Origin: "https://evil.example" } })).status, 200, "reads are not blocked");
});

/* ================================================================ sites */
test("public host: routes by path or subdomain and serves only the published version", async () => {
  assert.deepEqual(route(new URL("https://x.workers.dev/sung/en/"), {}), { slug: "sung", path: "en/", prefix: "/sung/" });
  assert.deepEqual(route(new URL("https://x.workers.dev/sung"), {}), { redirect: "/sung/" });
  assert.deepEqual(route(new URL("https://sung.labs.tw/a.css"), { SITE_DOMAIN: "labs.tw" }), { slug: "sung", path: "a.css", prefix: "/" });
  assert.equal(route(new URL("https://x.workers.dev/"), {}), null);

  const env = fakeEnv();
  const site = await seed(env);
  await commitChanges(env, site.id, { files: [file("index.html", "<h1>草稿</h1>"), file("docs/index.html", "docs")], author: "a", message: "draft" });
  const get = (path, init) => serve(new Request("https://x.workers.dev" + path, init), env);

  const home = await get("/sung/");
  assert.equal(home.status, 200);
  assert.equal(await home.text(), "<h1>首頁</h1>", "draft is not public until published");
  assert.equal(home.headers.get("Content-Type"), "text/html; charset=utf-8");
  assert.equal(home.headers.get("Cache-Control"), "public, max-age=0, must-revalidate");
  const css = await get("/sung/css/main.css");
  assert.equal(css.headers.get("Content-Type"), "text/css; charset=utf-8");
  assert.equal((await get("/sung/css/main.css", { headers: { "If-None-Match": css.headers.get("ETag") } })).status, 304);
  assert.equal((await get("/sung")).status, 301);
  assert.equal((await get("/sung/missing.html")).status, 404);
  assert.equal((await get("/nobody/")).status, 404);
  assert.equal((await get("/sung/", { method: "POST" })).status, 405);

  await publish(env, site.id, null, { actor: "a" });
  assert.equal(await (await get("/sung/")).text(), "<h1>草稿</h1>");
  const dir = await get("/sung/docs");
  assert.equal(dir.status, 301);
  assert.equal(dir.headers.get("Location"), "https://x.workers.dev/sung/docs/");
  assert.equal(await (await get("/sung/docs/")).text(), "docs");
  assert.equal((await get("/" + site.id + "/")).status, 404, "sites are reachable by slug only");
});

/* ===================================================== D1-only storage */
test("without R2, file contents live in D1 chunks and behave the same", async () => {
  const env = fakeEnv({ BLOB_CHUNK_BYTES: "4" }); // tiny chunks to exercise reassembly
  delete env.BLOBS;
  const { blobStore } = await import("../cloud/src/blobs.js");
  const store = blobStore(env);
  assert.equal(store.kind, "d1");
  const site = await seed(env);
  const tree = (await resolveRef(env, site, "draft")).tree;
  const home = tree.get("index.html");
  const bytes = await store.get(home.hash);
  assert.equal(dec.decode(bytes), "<h1>首頁</h1>");
  const rows = env.DB.raw.prepare("SELECT COUNT(*) AS n FROM blob_chunks WHERE hash = ?").get(home.hash).n;
  assert.equal(rows, Math.ceil(enc.encode("<h1>首頁</h1>").length / 4));
  // A blob whose chunks exist but whose header row does not is invisible (half-written).
  env.DB.raw.prepare("INSERT INTO blob_chunks (hash, idx, data) VALUES ('x', 0, 'AA==')").run();
  assert.equal(await store.has("x"), false);
  assert.equal(await store.get("x"), null);
  // Dedup: writing the same content again adds nothing.
  const before = env.DB.raw.prepare("SELECT COUNT(*) AS n FROM blob_chunks").get().n;
  await commitChanges(env, site.id, { files: [file("copy.html", "<h1>首頁</h1>")], author: "a", message: "m" });
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM blob_chunks").get().n, before);
  // Binary round trip through the API and the public host.
  const png = new Uint8Array(1000).map((_, i) => (i * 37) % 256);
  await commitChanges(env, site.id, { files: [{ path: "assets/p.png", bytes: png }], author: "a", message: "img" });
  await publish(env, site.id, null, { actor: "a" });
  const res = await serve(new Request("https://x.workers.dev/sung/assets/p.png"), env);
  assert.equal(res.headers.get("Content-Type"), "image/png");
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), png);
  const head = await serve(new Request("https://x.workers.dev/sung/assets/p.png", { method: "HEAD" }), env);
  assert.equal(head.status, 200);
});

/* ======================================================== invite links */
test("invite links: one use, expiry, 90-day session renewed while used, logout", async () => {
  const s = await import("../cloud/src/sessions.js");
  const env = fakeEnv();
  const now = T0;
  const { token, expiresAt } = await s.createInvite(env, " Teacher@Lab.TW ", "admin@lab.tw", now);
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(expiresAt, now + s.INVITE_TTL);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM invites WHERE token_hash = ?").get(token).n, 0, "only the hash is stored");
  const r = await s.redeemInvite(env, token, now + 1000);
  assert.equal(r.email, "teacher@lab.tw");
  assert.equal(await s.redeemInvite(env, token, now + 2000), null, "a link works once");
  assert.deepEqual(await s.sessionUser(env, r.session, now + 5000), { email: "teacher@lab.tw" }, "fresh: no renewal write");
  // Used 60 days later: extended to 90 days from then.
  const later = now + 60 * 24 * 3600 * 1000;
  assert.deepEqual(await s.sessionUser(env, r.session, later), { email: "teacher@lab.tw", renewed: later + s.SESSION_TTL });
  const again = now + s.SESSION_TTL + 1000;
  assert.ok(await s.sessionUser(env, r.session, again), "still valid past the first 90 days (and renewed again)");
  assert.equal(await s.sessionUser(env, r.session, again + s.SESSION_TTL + 1), null, "90 days without use: expired");
  await s.endSession(env, r.session);
  assert.equal(await s.sessionUser(env, r.session, now + 5000), null, "logout ends the session");
  const old = await s.createInvite(env, "t2@lab.tw", "a", now);
  assert.equal(await s.redeemInvite(env, old.token, now + s.INVITE_TTL + 1), null, "links expire");
  for (const bad of [undefined, "", "abc", "x".repeat(64), "A".repeat(64)]) assert.equal(await s.redeemInvite(env, bad, now), null);
  // Two clicks at the same time: exactly one session.
  const race = await s.createInvite(env, "t3@lab.tw", "a", now);
  const both = await Promise.all([s.redeemInvite(env, race.token, now), s.redeemInvite(env, race.token, now)]);
  assert.equal(both.filter(Boolean).length, 1);
});

test("API sign-in by invite link: admin makes a link, teacher opens it, cookie session works", async () => {
  const env = fakeEnv({ DEV_AUTH: "off" });
  const sung = await seed(env);
  await addMember(env, sung.id, "teacher@lab.tw", "admin@lab.tw");
  const app = createApp({ fetchImpl: scriptedFetch([]) });
  const req = (method, path, { body, cookie, origin = "https://studio.example" } = {}) =>
    app.fetch(
      new Request("https://studio.example" + path, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(method !== "GET" ? { Origin: origin } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
  assert.equal((await req("GET", "/api/me")).status, 401);

  // Bootstrap the admin the way the CLI script does, then sign in.
  const { createInvite } = await import("../cloud/src/sessions.js");
  const boot = await createInvite(env, "admin@lab.tw", "cli");
  const login = await req("POST", "/api/login", { body: { invite: boot.token } });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("Set-Cookie");
  assert.match(setCookie, /^ls_session=[0-9a-f]{64}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=7776000; Secure$/);
  const admin = setCookie.split(";")[0];
  const me = await (await req("GET", "/api/me", { cookie: admin })).json();
  assert.deepEqual([me.email, me.admin, me.via], ["admin@lab.tw", true, "session"]);

  // Admin makes a link for the teacher.
  const inv = await req("POST", "/api/invites", { cookie: admin, body: { email: "Teacher@Lab.tw" } });
  assert.equal(inv.status, 200);
  const { url, email } = await inv.json();
  assert.equal(email, "teacher@lab.tw");
  assert.match(url, /^https:\/\/studio\.example\/\?invite=[0-9a-f]{64}$/);
  const teacherLogin = await req("POST", "/api/login", { body: { invite: new URL(url).searchParams.get("invite") } });
  const teacher = teacherLogin.headers.get("Set-Cookie").split(";")[0];
  const tme = await (await req("GET", "/api/me", { cookie: teacher })).json();
  assert.deepEqual([tme.email, tme.admin, tme.sites.map((x) => x.slug)], ["teacher@lab.tw", false, ["sung"]]);
  assert.equal((await req("POST", "/api/invites", { cookie: teacher, body: { email: "x@lab.tw" } })).status, 403, "teachers cannot invite");

  // The teacher signs in on a phone with a link they make themselves.
  const dev = await req("POST", "/api/invites/self", { cookie: teacher, body: {} });
  assert.equal(dev.status, 200);
  const d = await dev.json();
  assert.equal(d.email, "teacher@lab.tw", "always for yourself");
  assert.ok(d.expiresAt - Date.now() <= 15 * 60 * 1000 && d.expiresAt > Date.now());
  const phone = await req("POST", "/api/login", { body: { invite: new URL(d.url).searchParams.get("invite") } });
  assert.equal(phone.status, 200);
  const phoneMe = await (await req("GET", "/api/me", { cookie: phone.headers.get("Set-Cookie").split(";")[0] })).json();
  assert.equal(phoneMe.email, "teacher@lab.tw");
  assert.equal((await req("POST", "/api/invites/self", { body: {} })).status, 401, "only when signed in");

  // Used link, cross-site login attempt, logout.
  assert.equal((await req("POST", "/api/login", { body: { invite: new URL(url).searchParams.get("invite") } })).status, 401);
  const other = await createInvite(env, "teacher@lab.tw", "a");
  assert.equal((await req("POST", "/api/login", { body: { invite: other.token }, origin: "https://evil.example" })).status, 403);
  const out = await req("POST", "/api/logout", { cookie: teacher });
  assert.match(out.headers.get("Set-Cookie"), /^ls_session=; .*Max-Age=0/);
  assert.equal((await req("GET", "/api/me", { cookie: teacher })).status, 401);
  assert.equal((await req("GET", "/api/me", { cookie: "ls_session=" + "0".repeat(64) })).status, 401);
});

/* ============================================================ templates */
test("create from a template: admin only, unpublished, lab name in js/data.js, editor files hidden", async () => {
  const env = fakeEnv();
  const bundle = {
    id: "basic",
    name: "清朗",
    files: [
      { path: "index.html", text: "<h1>知行研究室</h1>" },
      { path: "js/data.js", text: 'const SITE = {\n  nameZh: "知行研究室",\n  email: "lab@example.edu.tw",\n};\n' },
      { path: "assets/dot.png", base64: "iVBORw0KGgo=" },
      { path: "labsite/library.json", text: '{"version":1,"sections":[]}' },
    ],
  };
  env.ASSETS = {
    async fetch(req) {
      const u = new URL(req.url);
      if (u.pathname === "/templates/basic.json") return new Response(JSON.stringify(bundle), { headers: { "Content-Type": "application/json" } });
      return new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } }); // SPA fallback
    },
  };
  const app = createApp();
  const call = (method, path, body, email = "admin@lab.tw") =>
    app.request(
      path,
      {
        method,
        headers: { "Content-Type": "application/json", Origin: "http://localhost", Host: "localhost" },
        body: body ? JSON.stringify(body) : undefined,
      },
      { ...env, DEV_USER_EMAIL: email },
    );
  const made = await call("POST", "http://localhost/api/sites", { template: "basic", slug: "wang-lab", name: "王老師研究室" });
  assert.equal(made.status, 201);
  const { site, files } = await made.json();
  assert.equal(files, 4);
  assert.equal(site.unpublished, true);
  assert.equal(site.published, null);
  const row = await getSite(env, "wang-lab");
  assert.equal(await text(env, row, "index.html"), "<h1>知行研究室</h1>");
  assert.match(await text(env, row, "js/data.js"), /nameZh: "王老師研究室"/);
  const { tree } = await resolveRef(env, row, "draft");
  assert.deepEqual([...env.BLOBS.store.get("b/" + tree.get("assets/dot.png").hash)], [...Buffer.from("iVBORw0KGgo=", "base64")]);
  // Not public until published; the editor's library files never are.
  assert.equal((await serve(new Request("https://sites.example/wang-lab/"), env)).status, 404);
  await publish(env, row.id, null, { actor: "admin@lab.tw" });
  assert.equal((await serve(new Request("https://sites.example/wang-lab/"), env)).status, 200);
  assert.equal((await serve(new Request("https://sites.example/wang-lab/labsite/library.json"), env)).status, 404);
  // Unknown template, bad id, teacher.
  assert.equal((await call("POST", "http://localhost/api/sites", { template: "nope", slug: "x1", name: "x" })).status, 404);
  assert.equal((await call("POST", "http://localhost/api/sites", { template: "../x", slug: "x2", name: "x" })).status, 400);
  assert.equal((await call("POST", "http://localhost/api/sites", { template: "basic", slug: "x3", name: "x" }, "t@lab.tw")).status, 403);
  assert.equal((await call("POST", "http://localhost/api/sites", { template: "basic", slug: "wang-lab", name: "x" })).status, 409);
});

/* ============================================================ AI themes */
const aiReply = (themes, stop = "end_turn") => ({
  json: {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text: JSON.stringify({ themes }) }],
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  },
});
const proposal = (over = {}) => ({
  name: "海港晨光",
  rationale: "以海藍為主，沉穩可信。",
  research: "#1d5c8a",
  team: "#2f6b4f",
  publications: "#9a3b2e",
  join: "#5a4a8a",
  ink: "#15191d",
  wall: "#eef1f3",
  font: "legible",
  radius: 4,
  ...over,
});

test("AI themes: structured request, contrast-checked results, refusal, rate limit, daily cap, no key", async () => {
  const { contrastIssues } = await import("../src/site/themes.js");
  let mode = "ok";
  const fetchImpl = scriptedFetch([
    [
      "api.anthropic.com/v1/messages",
      () =>
        mode === "refusal"
          ? aiReply([], "refusal")
          : mode === "busy"
            ? { status: 429, json: { type: "error", error: { type: "rate_limit_error", message: "slow down" } } }
            : aiReply([proposal(), proposal({ name: "淡彩", research: "#9fd3e6", team: "#ffd166", publications: "#f4a6a6", wall: "#b0b0b0" }), proposal({ name: "第三組", font: "nope", radius: 7 })]),
    ],
  ]);
  const env = fakeEnv({ ANTHROPIC_API_KEY: "test-key" });
  const site = await seed(env);
  const app = createApp({ fetchImpl });
  const call = (body, email = "admin@lab.tw", e = env) =>
    app.request(
      `http://localhost/api/sites/${site.id}/ai-theme`,
      { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" }, body: JSON.stringify(body) },
      { ...e, DEV_USER_EMAIL: email },
    );

  const ok = await call({ description: "沉穩、像海邊的醫院" });
  assert.equal(ok.status, 200);
  const { themes, remaining } = await ok.json();
  assert.equal(themes.length, 3);
  assert.equal(remaining, 19);
  for (const t of themes) {
    assert.deepEqual(contrastIssues(t.vars), [], t.name);
    assert.ok(t.fontUrl.startsWith("https://fonts.googleapis.com/"));
  }
  assert.ok(themes[1].adjusted.includes("--zone-research"), "too-light colours are darkened and reported");
  assert.equal(themes[2].font, "signage", "unknown font falls back");
  assert.equal(themes[2].vars["--radius"], "4px", "unknown radius falls back");
  const sent = fetchImpl.calls.find((c) => c.url.includes("api.anthropic.com"));
  const body = JSON.parse(sent.body);
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.output_config.format.type, "json_schema");
  assert.equal(body.fallbacks, "default");
  const beta = typeof sent.headers.get === "function" ? sent.headers.get("anthropic-beta") : sent.headers["anthropic-beta"];
  assert.match(String(beta), /server-side-fallback-2026-07-01/);
  assert.match(body.messages[0].content, /沉穩、像海邊的醫院/);

  mode = "refusal";
  assert.equal((await call({ description: "something" })).status, 422);
  mode = "busy";
  assert.equal((await call({ description: "something" })).status, 503);
  mode = "ok";
  assert.equal((await call({ description: "x" })).status, 400, "too short");
  assert.equal((await call({ description: "好" }, "stranger@lab.tw")).status, 403, "not a member");

  // Daily cap: only successful requests count.
  for (let i = 0; i < 19; i++) assert.equal((await call({ description: "第 " + i + " 次" })).status, 200);
  const capped = await call({ description: "再一次" });
  assert.equal(capped.status, 429);
  assert.match((await capped.json()).error, /今天已經用了 20 次/);

  // No key: the feature reports itself as off.
  const bare = fakeEnv();
  const site2 = await seed(bare);
  const off = await app.request(
    `http://localhost/api/sites/${site2.id}/ai-theme`,
    { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" }, body: JSON.stringify({ description: "沉穩" }) },
    bare,
  );
  assert.equal(off.status, 503);
  const me = await app.request("http://localhost/api/me", {}, bare);
  assert.equal((await me.json()).ai, false);
  assert.equal((await (await app.request("http://localhost/api/me", {}, env)).json()).ai, true);
});
