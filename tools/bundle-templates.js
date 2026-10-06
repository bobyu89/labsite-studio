import fs from "node:fs";
import path from "node:path";

// Site templates: templates/<id>/ is a complete static site (with its section
// library in labsite/). The build ships each one as a single JSON bundle,
// templates/<id>.json, plus templates/index.json listing them, so LabSite Cloud
// can create a site from a template with one asset fetch.
const TEXT_EXT = /\.(html?|css|js|mjs|json|svg|txt|xml|md|webmanifest)$/i;
export function bundleTemplates(root = "templates") {
  if (!fs.existsSync(root)) return { index: [], bundles: {} };
  const index = [];
  const bundles = {};
  for (const id of fs.readdirSync(root).sort()) {
    const dir = path.join(root, id);
    if (!fs.statSync(dir).isDirectory() || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) continue;
    const files = [];
    const walk = (rel) => {
      for (const name of fs.readdirSync(path.join(dir, rel)).sort()) {
        const r = rel ? rel + "/" + name : name;
        const full = path.join(dir, r);
        if (fs.statSync(full).isDirectory()) walk(r);
        else if (TEXT_EXT.test(name)) files.push({ path: r, text: fs.readFileSync(full, "utf8") });
        else files.push({ path: r, base64: fs.readFileSync(full).toString("base64") });
      }
    };
    walk("");
    let meta = {};
    try {
      meta = JSON.parse(fs.readFileSync(path.join(dir, "labsite/template.json"), "utf8"));
    } catch {
      /* no metadata: fall back to the id */
    }
    const entry = { id, name: meta.name || id, description: meta.description || "", files: files.length };
    index.push(entry);
    bundles[id] = { ...entry, files };
  }
  return { index, bundles };
}
