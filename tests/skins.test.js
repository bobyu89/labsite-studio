// Skins: whole looks (site.css + theme.css) for the shared template markup.
import test from "node:test";
import assert from "node:assert/strict";
import { parseSkins, loadSkins, readSkin, themeForSkin, withCurrent, skinFile } from "../src/site/skins.js";
import { readTheme, contrastIssues } from "../src/site/themes.js";
import { bundleTemplates } from "../tools/bundle-templates.js";

test("parseSkins: validated manifest, current must be listed", () => {
  const s = parseSkins(JSON.stringify({ version: 1, current: "b", skins: [{ id: "a", name: "A" }, { id: "b" }, { id: "Bad" }, { id: "a" }] }));
  assert.deepEqual(s.skins.map((x) => x.id), ["a", "b"]);
  assert.equal(s.current, "b");
  assert.equal(parseSkins(JSON.stringify({ version: 1, current: "zzz", skins: [{ id: "a" }] })).current, null);
  assert.equal(parseSkins("{"), null);
  assert.equal(parseSkins(JSON.stringify({ version: 1, skins: [] })), null);
});

test("themeForSkin: the skin's own tokens, or the site's colours kept", () => {
  const skin = ':root {\n  --zone-research: #111111;\n  --font: "A";\n  --radius: 0px;\n}\n';
  const site = ':root {\n  --zone-research: #0b6e69;\n  --font: "B";\n  --radius: 4px;\n}\n';
  assert.equal(themeForSkin(skin, site), skin);
  const kept = readTheme(themeForSkin(skin, site, { keepColors: true })).vars;
  assert.equal(kept["--zone-research"], "#0b6e69");
  assert.equal(kept["--font"], '"A"', "type stays the skin's");
  assert.equal(kept["--radius"], "0px");
  // The mark belongs to the skin.
  const k2 = readTheme(themeForSkin(":root {\n  --mark: #b3261e;\n}\n", ":root {\n  --mark: #f2a900;\n}\n", { keepColors: true })).vars;
  assert.equal(k2["--mark"], "#b3261e");
});

test("withCurrent and readSkin", async () => {
  assert.equal(JSON.parse(withCurrent('{"version":1,"current":"a","skins":[{"id":"a"},{"id":"b"}]}', "b")).current, "b");
  const files = { [skinFile("x", "site.css")]: "body{}", [skinFile("x", "theme.css")]: ":root{--ink:#000;}" };
  const source = { readText: async (p) => (p in files ? files[p] : Promise.reject(new Error("404 " + p))) };
  assert.deepEqual(await readSkin(source, "x"), { site: "body{}", theme: ":root{--ink:#000;}" });
  await assert.rejects(() => readSkin(source, "y"), /404/);
  assert.equal(await loadSkins(source), null);
});

for (const [id, bundle] of Object.entries(bundleTemplates().bundles)) {
  test(`${id}: every listed skin ships both stylesheets and passes WCAG AA`, () => {
    const files = new Map(bundle.files.map((f) => [f.path, f.text]));
    const skins = parseSkins(files.get("labsite/skins.json"));
    assert.ok(skins, "template lists its skins");
    assert.ok(skins.current, "a current skin");
    for (const s of skins.skins) {
      const site = files.get(skinFile(s.id, "site.css"));
      const theme = files.get(skinFile(s.id, "theme.css"));
      assert.ok(site && theme, s.id + " files");
      assert.deepEqual(contrastIssues(readTheme(theme).vars), [], s.id + " contrast");
    }
    // The current skin is what css/ holds.
    assert.equal(files.get(skinFile(skins.current, "site.css")), files.get("css/site.css"));
    assert.equal(files.get(skinFile(skins.current, "theme.css")), files.get("css/theme.css"));
  });
}
