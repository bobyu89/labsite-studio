import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

// library/people.js: DiceBear core + three CC0 styles as one ES module.
export async function bundlePeople() {
  const out = await build({ entryPoints: ["tools/people-entry.js"], bundle: true, format: "esm", minify: true, write: false, platform: "browser", target: "es2020" });
  return out.outputFiles[0].text;
}

// 素材庫: library/healthicons/ holds the curated Health Icons (outline and
// filled SVGs, index.json with Chinese names). The build ships them as one
// JSON file, library/healthicons.json, fetched by the editor when the
// 素材庫 opens.
export function bundleIcons(root = "library/healthicons") {
  const indexFile = path.join(root, "index.json");
  if (!fs.existsSync(indexFile)) return null;
  const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
  const read = (style, id) => {
    const f = path.join(root, style, id + ".svg");
    return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim() : null;
  };
  return {
    source: index.source,
    license: index.license,
    commit: index.commit,
    icons: index.icons.map((i) => ({ ...i, outline: read("outline", i.id), filled: read("filled", i.id) })).filter((i) => i.outline || i.filled),
  };
}
