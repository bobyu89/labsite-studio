// Public host: serves each site's *published* version, read-only. It shares
// D1 and R2 with the editor but has no write code at all.
//   <slug>.<SITE_DOMAIN>/path   when SITE_DOMAIN is set and matches the host
//   <host>/<slug>/path          otherwise (e.g. on workers.dev)
import { getSite, loadTree, getCommit, blobStream } from "./repo.js";
import { contentType, isHtml } from "./mime.js";

const notFound = (text = "找不到這個頁面。") =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>404</title><body style="font-family:system-ui;padding:3rem;color:#334">` +
      `<h1>404</h1><p>${text}</p></body>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

export function route(url, env) {
  const host = url.hostname.toLowerCase();
  const domain = String(env.SITE_DOMAIN || "").toLowerCase();
  if (domain && host.endsWith("." + domain)) {
    return { slug: host.slice(0, -(domain.length + 1)), path: url.pathname.slice(1), prefix: "/" };
  }
  const m = url.pathname.match(/^\/([a-z0-9-]+)(\/.*)?$/);
  if (!m) return null;
  if (!m[2]) return { redirect: `/${m[1]}/${url.search}` };
  return { slug: m[1], path: m[2].slice(1), prefix: `/${m[1]}/` };
}

async function publishedTree(env, slug) {
  const site = await getSite(env, slug);
  if (!site || site.slug !== slug || !site.published_commit) return null;
  const commit = await getCommit(env, site.published_commit);
  return loadTree(env, commit.tree_id);
}

export async function serve(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  const url = new URL(request.url);
  const r = route(url, env);
  if (!r) return notFound("這裡沒有網站。");
  if (r.redirect) return Response.redirect(url.origin + r.redirect, 301);

  const tree = await publishedTree(env, r.slug);
  if (!tree) return notFound("這個網站不存在或尚未發布。");

  let path;
  try {
    path = decodeURIComponent(r.path);
  } catch {
    return notFound();
  }
  if (path === "" || path.endsWith("/")) path += "index.html";
  // The editor's own files (section library) are not part of the website.
  if (path.startsWith("labsite/")) return notFound();
  let entry = tree.get(path);
  if (!entry && tree.has(path + "/index.html"))
    return Response.redirect(url.origin + r.prefix + r.path + "/" + url.search, 301);
  let status = 200;
  if (!entry && tree.has("404.html")) {
    entry = tree.get("404.html");
    path = "404.html";
    status = 404;
  }
  if (!entry) return notFound();

  const etag = `"${entry.hash}"`;
  const headers = {
    "Content-Type": contentType(path),
    ETag: etag,
    "Cache-Control": isHtml(path) ? "public, max-age=0, must-revalidate" : "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };
  if (status === 200 && request.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers });
  const body = request.method === "HEAD" ? null : await blobStream(env, entry.hash);
  if (request.method !== "HEAD" && !body) return new Response("內容遺失", { status: 500 });
  return new Response(body, { status, headers });
}

export default { fetch: serve };
