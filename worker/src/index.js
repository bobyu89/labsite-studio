// LabSite OAuth exchange — a Cloudflare Worker with one job: swap the code
// GitHub hands the browser for an access token, using the client secret that
// must never ship inside the page. Only the editor's origin may call it.
const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ok = allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": ok ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/exchange") {
      if (!ok) return json({ error: "origin not allowed" }, 403, cors);
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)
        return json({ error: "worker not configured" }, 500, cors);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "bad request" }, 400, cors);
      }
      if (!body.code) return json({ error: "missing code" }, 400, cors);
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: body.code,
          redirect_uri: body.redirect_uri,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.access_token)
        return json({ error: data.error_description || data.error || "exchange failed" }, 400, cors);
      return json({ access_token: data.access_token, scope: data.scope || "" }, 200, cors);
    }
    return json({ ok: true, service: "labsite-oauth" }, 200, cors);
  },
};
