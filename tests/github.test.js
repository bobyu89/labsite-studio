import test from "node:test";
import assert from "node:assert/strict";
import {
  githubSource,
  textToBase64,
  parseRepo,
  authorizeUrl,
  finishLogin,
  startLogin,
  loginAvailable,
  redirectUri,
} from "../src/site/github.js";

// Minimal fetch double that records requests and answers from a script.
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", headers: init.headers || {}, body: init.body });
    for (const [match, reply] of routes) {
      if ((typeof match === "string" && String(url).includes(match)) || (match instanceof RegExp && match.test(String(url)))) {
        const r = typeof reply === "function" ? reply(init) : reply;
        return {
          ok: r.status ? r.status < 400 : true,
          status: r.status || 200,
          json: async () => r.json ?? {},
          text: async () => r.text ?? "",
          blob: async () => new Blob([r.text ?? ""]),
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({ message: "no route" }), text: async () => "" };
  };
  fn.calls = calls;
  return fn;
}

test("base64 handles UTF-8 text", () => {
  assert.equal(textToBase64("研究室 A&B"), Buffer.from("研究室 A&B", "utf8").toString("base64"));
});

test("listPages reads the branch tree, keeps html at root and en/, and remembers blob shas", async () => {
  const f = fakeFetch([
    [
      /git\/trees\/master\?recursive=1/,
      {
        json: {
          tree: [
            { path: "index.html", type: "blob", sha: "s1" },
            { path: "en/index.html", type: "blob", sha: "s2" },
            { path: "js/data.js", type: "blob", sha: "s3" },
            { path: "docs/x/y.html", type: "blob", sha: "s4" },
            { path: "en", type: "tree", sha: "t" },
          ],
        },
      },
    ],
    ["/contents/index.html", (init) => ({ json: { content: { sha: "s1-new" }, commit: { sha: "c1" } } })],
  ]);
  const s = githubSource({ owner: "o", repo: "r", branch: "master", token: "tok", fetchImpl: f });
  assert.deepEqual(await s.listPages(), ["index.html", "en/index.html"]);
  assert.ok(s.writable);
  assert.equal(s.name, "o/r@master");
  // Writing uses the remembered sha without an extra lookup.
  const commit = await s.writeText("index.html", "<p>hi</p>");
  assert.equal(commit, "c1");
  const put = f.calls.find((c) => c.method === "PUT");
  const body = JSON.parse(put.body);
  assert.equal(body.sha, "s1");
  assert.equal(body.branch, "master");
  assert.equal(Buffer.from(body.content, "base64").toString("utf8"), "<p>hi</p>");
  assert.match(put.headers.Authorization, /^Bearer tok$/);
  assert.equal(f.calls.filter((c) => c.url.includes("/contents/index.html")).length, 1);
});

test("readText asks for the raw media type on the right branch; unknown files are created without sha", async () => {
  const f = fakeFetch([
    ["/contents/assets/new.png?ref=main", { status: 404, json: { message: "Not Found" } }],
    ["/contents/assets/new.png", { json: { content: { sha: "n1" }, commit: { sha: "c2" } } }],
    ["/contents/en/pi.html?ref=main", { text: "<html>en</html>" }],
  ]);
  const s = githubSource({ owner: "o", repo: "r", branch: "main", token: "t", fetchImpl: f });
  assert.equal(await s.readText("en/pi.html"), "<html>en</html>");
  assert.equal(f.calls[0].headers.Accept, "application/vnd.github.raw+json");
  await s.writeBlob("assets/new.png", new Blob([new Uint8Array([1, 2, 3])]));
  const put = f.calls.find((c) => c.method === "PUT");
  assert.equal("sha" in JSON.parse(put.body), false);
});

test("conflicting writes and missing tokens surface clear errors", async () => {
  const f = fakeFetch([
    ["?ref=master", { json: { sha: "old" } }],
    ["/contents/index.html", { status: 409, json: { message: "sha mismatch" } }],
  ]);
  const s = githubSource({ owner: "o", repo: "r", branch: "master", token: "t", fetchImpl: f });
  await assert.rejects(() => s.writeText("index.html", "x"), /已被其他人更新/);
  assert.equal(githubSource({ owner: "o", repo: "r", branch: "master", token: "" }).writable, false);
});

// The Git Data API sequence for one multi-file commit, scripted as fetch replies.
function gitDataRoutes({ headSha = "h1", remote = {}, refStatus = 200 } = {}) {
  return [
    ["/git/ref/heads/master", { json: { object: { sha: headSha } } }],
    [`/git/commits/${headSha}`, { json: { tree: { sha: "t0" } } }],
    ["/git/trees/t0?recursive=1", { json: { tree: Object.entries(remote).map(([path, sha]) => ({ path, type: "blob", sha })) } }],
    ["/git/blobs", (init) => ({ json: { sha: "b-" + JSON.parse(init.body).content.length } })],
    ["/git/trees", { json: { sha: "t1" } }],
    ["/git/commits", { json: { sha: "c-new" } }],
    ["/git/refs/heads/master", refStatus === 200 ? { json: { object: { sha: "c-new" } } } : { status: refStatus, json: { message: "not a fast forward" } }],
  ];
}

test("writeFiles: one commit for pages and images, in the right order", async () => {
  const f = fakeFetch(gitDataRoutes({ remote: { "index.html": "s1", "js/data.js": "s3" } }));
  const s = githubSource({ owner: "o", repo: "r", branch: "master", token: "t", fetchImpl: f });
  const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
  const sha = await s.writeFiles(
    [
      { path: "index.html", text: "<p>hi</p>" },
      { path: "./assets/pi.png", blob: png },
      { path: "js/data.js", text: "const SITE = {}" },
    ],
    "LabSite：更新 3 個檔案",
  );
  assert.equal(sha, "c-new");
  const steps = f.calls.map((c) => c.method + " " + c.url.replace(/^.*\/repos\/o\/r\//, ""));
  assert.deepEqual(steps, [
    "GET git/ref/heads/master",
    "GET git/commits/h1",
    "GET git/trees/t0?recursive=1",
    "POST git/blobs",
    "POST git/blobs",
    "POST git/blobs",
    "POST git/trees",
    "POST git/commits",
    "PATCH git/refs/heads/master",
  ]);
  const blobs = f.calls.filter((c) => c.url.endsWith("/git/blobs")).map((c) => JSON.parse(c.body));
  assert.equal(blobs[0].encoding, "base64");
  assert.equal(blobs[0].content, textToBase64("<p>hi</p>"));
  assert.equal(blobs[1].content, "iVBORw==");
  const tree = JSON.parse(f.calls[6].body);
  assert.equal(tree.base_tree, "t0");
  assert.deepEqual(
    tree.tree.map((e) => [e.path, e.mode, e.type]),
    [["index.html", "100644", "blob"], ["assets/pi.png", "100644", "blob"], ["js/data.js", "100644", "blob"]],
  );
  const commit = JSON.parse(f.calls[7].body);
  assert.deepEqual(commit, { message: "LabSite：更新 3 個檔案", tree: "t1", parents: ["h1"] });
  const ref = JSON.parse(f.calls[8].body);
  assert.deepEqual(ref, { sha: "c-new" }); // no force: GitHub refuses non-fast-forward moves
  assert.equal(await s.writeFiles([], "x"), null);
});

test("writeFiles: a page changed remotely since open is refused before anything is uploaded", async () => {
  const f = fakeFetch([
    [/git\/trees\/master\?recursive=1/, { json: { tree: [{ path: "index.html", type: "blob", sha: "s1" }] } }],
    ...gitDataRoutes({ remote: { "index.html": "s1-changed" } }),
  ]);
  const s = githubSource({ owner: "o", repo: "r", branch: "master", token: "t", fetchImpl: f });
  await s.listPages(); // remembers index.html@s1
  await assert.rejects(
    () => s.writeFiles([{ path: "index.html", text: "x" }, { path: "assets/new.png", blob: new Blob(["z"]) }], "m"),
    /index\.html.*已被其他人更新/,
  );
  assert.ok(!f.calls.some((c) => c.url.endsWith("/git/blobs")), "no blob was uploaded");
  // A file we never saw (new asset) is never a conflict.
  const g = fakeFetch(gitDataRoutes({ remote: { "index.html": "s1-changed" } }));
  const s2 = githubSource({ owner: "o", repo: "r", branch: "master", token: "t", fetchImpl: g });
  assert.equal(await s2.writeFiles([{ path: "assets/new.png", blob: new Blob(["z"]) }], "m"), "c-new");
});

test("writeFiles: a commit that lands in between makes the ref update fail loudly", async () => {
  const f = fakeFetch(gitDataRoutes({ refStatus: 422 }));
  const s = githubSource({ owner: "o", repo: "r", branch: "master", token: "t", fetchImpl: f });
  await assert.rejects(() => s.writeFiles([{ path: "index.html", text: "x" }], "m"), /更新分支失敗.*已被其他人更新/);
});

test("repo strings and OAuth helpers", async () => {
  assert.deepEqual(parseRepo("https://github.com/bobyu89/sung-lab-website/"), { owner: "bobyu89", repo: "sung-lab-website" });
  assert.deepEqual(parseRepo("bobyu89/ycho-lab-website.git"), { owner: "bobyu89", repo: "ycho-lab-website" });
  assert.equal(parseRepo("nonsense"), null);
  const loc = { origin: "https://bobyu89.github.io", pathname: "/labsite-studio/index.html", search: "", hash: "" };
  assert.equal(redirectUri(loc), "https://bobyu89.github.io/labsite-studio/");
  const cfg = { clientId: "cid", workerUrl: "https://w.example" };
  assert.ok(loginAvailable(cfg));
  assert.ok(!loginAvailable({ clientId: "cid", workerUrl: "" }));
  const url = new URL(authorizeUrl(cfg, "st", loc));
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("redirect_uri"), "https://bobyu89.github.io/labsite-studio/");
  assert.equal(url.searchParams.get("scope"), "public_repo");
  // Start: the worker issues the state, we store it and send the user to GitHub.
  const storage = new Map();
  const store = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const assigned = [];
  const startLoc = { ...loc, assign: (u) => assigned.push(u) };
  const fs = fakeFetch([["/state", { json: { state: "st" } }]]);
  await startLogin(cfg, { storage: store, loc: startLoc, fetchImpl: fs });
  assert.equal(fs.calls[0].url, "https://w.example/state");
  assert.equal(fs.calls[0].method, "POST");
  assert.equal(storage.get("labsite-oauth-state"), "st");
  assert.equal(new URL(assigned[0]).searchParams.get("state"), "st");
  // An old worker without /state must fail loudly instead of sending a stateless login.
  await assert.rejects(
    () => startLogin(cfg, { storage: store, loc: startLoc, fetchImpl: fakeFetch([]) }),
    /版本過舊/,
  );
  await assert.rejects(
    () => startLogin(cfg, { storage: store, loc: startLoc, fetchImpl: fakeFetch([["/state", { status: 403, json: { error: "origin not allowed" } }]]) }),
    /origin not allowed/,
  );
  // Callback: state must match, then the worker exchanges code + state.
  const replaced = [];
  const history = { replaceState: (_, __, u) => replaced.push(u) };
  const f = fakeFetch([["/exchange", { json: { access_token: "gho_x" } }]]);
  const cb = { ...loc, search: "?code=abc&state=st" };
  assert.equal(await finishLogin(cfg, { storage: store, loc: cb, fetchImpl: f, history }), "gho_x");
  assert.deepEqual(replaced, ["/labsite-studio/index.html"]);
  assert.deepEqual(JSON.parse(f.calls[0].body), {
    code: "abc",
    state: "st",
    redirect_uri: "https://bobyu89.github.io/labsite-studio/",
  });
  assert.equal(storage.has("labsite-oauth-state"), false);
  storage.set("labsite-oauth-state", "st");
  await assert.rejects(
    () => finishLogin(cfg, { storage: store, loc: { ...loc, search: "?code=abc&state=bad" }, fetchImpl: f, history }),
    /狀態不符/,
  );
  assert.equal(await finishLogin(cfg, { storage: store, loc, fetchImpl: f, history }), null);
});
