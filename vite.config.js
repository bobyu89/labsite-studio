import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import fs from "node:fs";
import path from "node:path";

// Dev-only bridge: serves a local website folder (the lab site repo) at
// /__labsite/ so the editor can read and write its files without the
// File System Access API. Configure with labsite.local.json { "siteDir": ".." }
// or the LABSITE_SITE_DIR environment variable. Never part of the build.
function labsiteDevSite() {
  return {
    name: "labsite-dev-site",
    apply: "serve",
    configureServer(server) {
      const root = resolveSiteDir();
      const inside = (p) => {
        const full = path.resolve(root, p);
        if (full !== root && !full.startsWith(root + path.sep)) throw new Error("outside");
        return full;
      };
      server.middlewares.use("/__labsite", (req, res, next) => {
        if (!root) {
          res.statusCode = 404;
          return res.end("no site dir");
        }
        const url = new URL(req.url, "http://localhost");
        const send = (code, body, type = "application/json") => {
          res.statusCode = code;
          res.setHeader("Content-Type", type);
          res.end(typeof body === "string" ? body : JSON.stringify(body));
        };
        try {
          if (url.pathname === "/info")
            return send(200, { name: path.basename(root), writable: true, root });
          if (url.pathname === "/list") {
            const pages = [];
            for (const f of fs.readdirSync(root))
              if (f.endsWith(".html")) pages.push(f);
            const en = path.join(root, "en");
            if (fs.existsSync(en))
              for (const f of fs.readdirSync(en))
                if (f.endsWith(".html")) pages.push("en/" + f);
            return send(200, pages);
          }
          if (url.pathname.startsWith("/file/")) {
            const rel = decodeURIComponent(url.pathname.slice(6));
            const full = inside(rel);
            if (req.method === "GET") {
              if (!fs.existsSync(full)) return send(404, "not found", "text/plain");
              const ext = path.extname(full).toLowerCase();
              const types = {
                ".html": "text/html; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".js": "text/javascript; charset=utf-8",
                ".json": "application/json; charset=utf-8",
                ".xml": "application/xml; charset=utf-8",
                ".svg": "image/svg+xml",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".webp": "image/webp",
                ".gif": "image/gif",
              };
              res.statusCode = 200;
              res.setHeader("Content-Type", types[ext] || "application/octet-stream");
              return fs.createReadStream(full).pipe(res);
            }
            if (req.method === "PUT") {
              const chunks = [];
              req.on("data", (c) => chunks.push(c));
              req.on("end", () => {
                fs.mkdirSync(path.dirname(full), { recursive: true });
                fs.writeFileSync(full, Buffer.concat(chunks));
                send(200, { ok: true });
              });
              return;
            }
          }
          next();
        } catch (e) {
          send(e.message === "outside" ? 403 : 500, { error: e.message });
        }
      });
      if (root) server.config.logger.info("[labsite] site folder: " + root);
    },
  };
}
function resolveSiteDir() {
  let dir = process.env.LABSITE_SITE_DIR;
  if (!dir) {
    try {
      dir = JSON.parse(fs.readFileSync("labsite.local.json", "utf8")).siteDir;
    } catch {
      return null;
    }
  }
  return dir ? path.resolve(dir) : null;
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), labsiteDevSite()],
  base: "./",
});
