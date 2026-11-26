// v4.26 建立網站精靈: template slots, pages left out, English name, colours.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const { buildWizardSite, fillSlots, dropPages } = await import("../src/site/wizard.js");

const ROOT = new URL("../templates/basic/", import.meta.url).pathname;
function readTemplate() {
  const files = new Map();
  const walk = (dir, rel = "") => {
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      const r = rel ? rel + "/" + f : f;
      if (statSync(full).isDirectory()) walk(full, r);
      else if (/\.(html|js|css|json|xml)$/.test(f)) files.set(r, readFileSync(full, "utf8"));
    }
  };
  walk(ROOT);
  return files;
}
const template = JSON.parse(readFileSync(join(ROOT, "labsite/template.json"), "utf8"));

test("every slot's sample wording is on both the Chinese and the English pages", () => {
  const files = readTemplate();
  const pages = [...files].filter(([p]) => p.endsWith(".html"));
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  for (const s of template.slots) {
    assert.ok(pages.some(([p, t]) => !p.startsWith("en/") && t.includes(">" + esc(s.zh) + "<")), "zh " + s.key);
    assert.ok(pages.some(([p, t]) => p.startsWith("en/") && t.includes(">" + esc(s.en) + "<")), "en " + s.key);
  }
});

test("slots: whole elements only, both languages, HTML escaped", () => {
  const files = readTemplate();
  const out = fillSlots(files, template.slots, {
    lede: { zh: "長輩與照顧者 <都> 被好好照顧", en: "Care for elders & carers" },
    area1_tag2: { zh: "慢性腎病", en: "CKD" },
  });
  assert.match(out.get("index.html"), />長輩與照顧者 &lt;都&gt; 被好好照顧</);
  assert.match(out.get("en/index.html"), />Care for elders &amp; carers</);
  assert.match(out.get("research.html"), /<li class="tag">慢性腎病<\/li>/);
  assert.match(out.get("members.html"), /心衰竭病人的遠距追蹤/, "the same word inside a longer sentence is left alone");
});

test("pages left out: files, NAV entry and the bands linking to them are gone", () => {
  const out = dropPages(readTemplate(), ["publications.html"]);
  assert.equal(out.has("publications.html") || out.has("en/publications.html"), false);
  assert.doesNotMatch(out.get("js/data.js"), /page: "publications"/);
  for (const [p, t] of out) if (p.endsWith(".html")) assert.doesNotMatch(t, /href="(\.\.\/)?publications\.html"/, p);
  assert.match(out.get("index.html"), /href="research\.html"/, "other bands stay");
});

test("the whole build: drafts, English name, 研究室資料, colours; only optional pages can be dropped", () => {
  const out = buildWizardSite(readTemplate(), template, {
    fill: { about_lead: { zh: "我們關心長輩。", en: "We care for older people." } },
    drop: ["research.html", "members.html"],
    fields: { nameEn: "Elder Care Lab", email: "lab@example.edu.tw" },
    theme: { vars: { "--zone-research": "#123456" } },
  });
  assert.equal(out.has("research.html"), false);
  assert.equal(out.has("members.html"), true, "members is not optional");
  assert.match(out.get("index.html"), />我們關心長輩。</);
  assert.match(out.get("index.html"), /Elder Care Lab/);
  assert.doesNotMatch(out.get("en/index.html"), /Zhixing Nursing Research Lab/);
  assert.match(out.get("js/data.js"), /lab@example\.edu\.tw/);
  assert.match(out.get("css/theme.css"), /--zone-research:\s*#123456/);
});
