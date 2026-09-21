import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  STATE_TTL_SECONDS,
  allowedOrigins,
  originAllowed,
  issueState,
  verifyState,
  redirectUriMatches,
} from "../worker/src/index.js";

const env = {
  GITHUB_CLIENT_ID: "cid",
  GITHUB_CLIENT_SECRET: "shh",
  ALLOWED_ORIGINS: "https://bobyu89.github.io, http://127.0.0.1:4180/,HTTP://localhost:4180",
};
const SITE = "https://bobyu89.github.io";
const REDIRECT = SITE + "/labsite-studio/";

const post = (path, body, origin = SITE) =>
  new Request("https://w.example" + path, {
    method: "POST",
    headers: { ...(origin ? { Origin: origin } : {}), "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

// Replace the global fetch (the GitHub token endpoint) for the duration of `fn`.
async function withGithub(reply, fn) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return { json: async () => reply };
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = real;
  }
}

test("origin allowlist: trimmed, case- and trailing-slash-insensitive, exact otherwise", () => {
  assert.deepEqual(allowedOrigins(env), ["https://bobyu89.github.io", "http://127.0.0.1:4180", "http://localhost:4180"]);
  assert.ok(originAllowed(env, SITE));
  assert.ok(originAllowed(env, "http://localhost:4180"));
  assert.ok(!originAllowed(env, "https://evil.github.io"));
  assert.ok(!originAllowed(env, "https://bobyu89.github.io.evil.com"));
  assert.ok(!originAllowed(env, ""));
  assert.ok(!originAllowed({}, SITE));
});

test("state: signed for one origin, expires after the TTL, rejects tampering", async () => {
  const now = 1_700_000_000_000;
  const state = await issueState(env, SITE, now);
  assert.match(state, /^\d+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(await verifyState(env, SITE, state, now), null);
  assert.equal(await verifyState(env, SITE, state, now + (STATE_TTL_SECONDS - 1) * 1000), null);
  assert.equal(await verifyState(env, SITE, state, now + (STATE_TTL_SECONDS + 1) * 1000), "state expired");
  assert.equal(await verifyState(env, SITE, state, now - 120_000), "state issued in the future");
  assert.equal(await verifyState(env, "http://localhost:4180", state, now), "state signature mismatch");
  assert.equal(await verifyState({ ...env, GITHUB_CLIENT_SECRET: "other" }, SITE, state, now), "state signature mismatch");
  const [ts, nonce, sig] = state.split(".");
  assert.equal(await verifyState(env, SITE, `${ts}.${nonce}.${sig.slice(0, -1)}A`, now), "state signature mismatch");
  assert.equal(await verifyState(env, SITE, `${Number(ts) + 60}.${nonce}.${sig}`, now), "state signature mismatch");
  assert.equal(await verifyState(env, SITE, "nope", now), "malformed state");
  assert.equal(await verifyState(env, SITE, undefined, now), "missing state");
  // Two logins never share a state.
  assert.notEqual(await issueState(env, SITE, now), state);
  // A dedicated STATE_SECRET takes precedence over the client secret.
  const s2 = await issueState({ ...env, STATE_SECRET: "k" }, SITE, now);
  assert.equal(await verifyState({ ...env, STATE_SECRET: "k" }, SITE, s2, now), null);
  assert.equal(await verifyState(env, SITE, s2, now), "state signature mismatch");
});

test("redirect_uri must live on the calling origin", () => {
  assert.ok(redirectUriMatches(REDIRECT, SITE));
  assert.ok(redirectUriMatches("http://localhost:4180/", "http://localhost:4180"));
  assert.ok(!redirectUriMatches("https://evil.example/labsite-studio/", SITE));
  assert.ok(!redirectUriMatches("https://bobyu89.github.io.evil.com/", SITE));
  assert.ok(!redirectUriMatches("not a url", SITE));
  assert.ok(!redirectUriMatches(undefined, SITE));
});

test("preflight and unknown routes", async () => {
  const pre = await worker.fetch(new Request("https://w.example/state", { method: "OPTIONS", headers: { Origin: SITE } }), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), SITE);
  const preBad = await worker.fetch(new Request("https://w.example/state", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }), env);
  assert.equal(preBad.headers.get("Access-Control-Allow-Origin"), "null");
  const health = await worker.fetch(new Request("https://w.example/"), env);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, service: "labsite-oauth" });
  assert.equal(health.headers.get("Cache-Control"), "no-store");
});

test("POST /state: only allowed origins, only a configured worker", async () => {
  const res = await worker.fetch(post("/state"), env);
  assert.equal(res.status, 200);
  const { state, ttl } = await res.json();
  assert.equal(ttl, STATE_TTL_SECONDS);
  assert.equal(await verifyState(env, SITE, state), null);
  assert.equal((await worker.fetch(post("/state", undefined, "https://evil.example"), env)).status, 403);
  assert.equal((await worker.fetch(post("/state", undefined, ""), env)).status, 403);
  assert.equal((await worker.fetch(post("/state"), { ...env, GITHUB_CLIENT_SECRET: "" })).status, 500);
});

test("POST /exchange: full round trip through /state", async () => {
  const state = (await (await worker.fetch(post("/state"), env)).json()).state;
  await withGithub({ access_token: "gho_ok", scope: "public_repo" }, async (calls) => {
    const res = await worker.fetch(post("/exchange", { code: "abc", state, redirect_uri: REDIRECT }), env);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { access_token: "gho_ok", scope: "public_repo" });
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), SITE);
    assert.equal(calls[0].url, "https://github.com/login/oauth/access_token");
    assert.deepEqual(calls[0].body, { client_id: "cid", client_secret: "shh", code: "abc", redirect_uri: REDIRECT });
  });
  // GitHub errors are passed through as 400.
  await withGithub({ error: "bad_verification_code", error_description: "The code passed is incorrect or expired." }, async () => {
    const res = await worker.fetch(post("/exchange", { code: "abc", state, redirect_uri: REDIRECT }), env);
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /incorrect or expired/);
  });
});

test("POST /exchange: every guard fires before GitHub is contacted", async () => {
  const state = (await (await worker.fetch(post("/state"), env)).json()).state;
  const localState = (await (await worker.fetch(post("/state", undefined, "http://localhost:4180"), env)).json()).state;
  await withGithub({ access_token: "never" }, async (calls) => {
    const expect = async (req, status, pattern) => {
      const res = await worker.fetch(req, env);
      assert.equal(res.status, status);
      if (pattern) assert.match((await res.json()).error, pattern);
    };
    await expect(post("/exchange", { code: "abc", state, redirect_uri: REDIRECT }, "https://evil.example"), 403, /origin/);
    await expect(post("/exchange", "{not json"), 400, /bad request/);
    await expect(post("/exchange", { state, redirect_uri: REDIRECT }), 400, /missing code/);
    await expect(post("/exchange", { code: "abc", redirect_uri: REDIRECT }), 400, /missing state/);
    await expect(post("/exchange", { code: "abc", state: "x.y.z", redirect_uri: REDIRECT }), 400, /malformed/);
    await expect(post("/exchange", { code: "abc", state: "1700000000.nonce.badsig", redirect_uri: REDIRECT }), 400, /signature/);
    // A state issued to localhost cannot be spent from the Pages origin.
    await expect(post("/exchange", { code: "abc", state: localState, redirect_uri: REDIRECT }), 400, /signature/);
    await expect(post("/exchange", { code: "abc", state, redirect_uri: "https://evil.example/" }), 400, /redirect_uri/);
    await expect(post("/exchange", { code: "abc", state }), 400, /redirect_uri/);
    assert.equal(calls.length, 0);
  });
});
