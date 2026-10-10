// 網站搬家: old addresses replaced in every text file.
import test from "node:test";
import assert from "node:assert/strict";
import { githubAddresses, replaceAddresses, planRelocation } from "../src/site/relocate.js";

const NEW = "https://labsite-sites.example.workers.dev/";

test("githubAddresses: GitHub Pages address → public address, for sites imported from GitHub", () => {
  assert.deepEqual(
    githubAddresses([
      { name: "宋", github: "BobYu89/sung-lab-website", url: NEW + "sung-lab-website" },
      { name: "模板", github: null, url: NEW + "x/" },
    ]),
    [{ from: "https://bobyu89.github.io/sung-lab-website/", to: NEW + "sung-lab-website/", name: "宋" }],
  );
});

test("replaceAddresses: every occurrence, http spelling too, deeper paths kept", () => {
  const pairs = [
    { from: "https://bobyu89.github.io/sung-lab-website/", to: NEW + "sung-lab-website/" },
    { from: "https://bobyu89.github.io/ycho-lab-website/", to: NEW + "ycho-lab-website/" },
  ];
  const html = `<link rel="canonical" href="https://bobyu89.github.io/sung-lab-website/en/pi.html">
<meta property="og:image" content="http://bobyu89.github.io/sung-lab-website/assets/hero.png">
<a href="https://bobyu89.github.io/ycho-lab-website/en/">友站</a> bobyu89.github.io 限制 referrer`;
  const r = replaceAddresses(html, pairs);
  assert.equal(r.count, 3);
  assert.match(r.text, /href="https:\/\/labsite-sites\.example\.workers\.dev\/sung-lab-website\/en\/pi\.html"/);
  assert.match(r.text, /content="https:\/\/labsite-sites\.example\.workers\.dev\/sung-lab-website\/assets\/hero\.png"/);
  assert.match(r.text, /ycho-lab-website\/en\/">友站/);
  assert.ok(r.text.endsWith("bobyu89.github.io 限制 referrer"), "a bare host name in a comment is left alone");
});

test("planRelocation: only changed text files", () => {
  const plan = planRelocation(
    [
      { path: "index.html", text: "<a href='https://old.example/'>x</a>" },
      { path: "sitemap.xml", text: "<loc>https://old.example/pi.html</loc>" },
      { path: "about.html", text: "nothing" },
      { path: "assets/a.png", text: "https://old.example/" },
    ],
    [{ from: "https://old.example/", to: NEW }],
  );
  assert.deepEqual(plan.map((f) => [f.path, f.count]), [["index.html", 1], ["sitemap.xml", 1]]);
  assert.equal(planRelocation([{ path: "a.html", text: "x" }], [{ from: "x", to: "x" }]).length, 0);
});
