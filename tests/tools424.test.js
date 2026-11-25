// v4.24: 論文清單匯出, QR Code, 學期更新.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./dom.js";
const { parsePage, editHtml } = await import("../src/site/page.js");
const { publicationEntries, filterByYear, exportText, exportWord, yearOf } = await import("../src/site/pubExport.js");
const { qrMatrix, qrSvg, publicPageUrl } = await import("../src/site/qr.js");
const { memberLists, bumpYear, degreeOf, applySemester, parseNewMembers } = await import("../src/site/semester.js");

const PUBS = `<!DOCTYPE html><html><head><title>著作</title></head><body><section class="section"><h2>期刊論文</h2><ol class="pub-list">
<li><span class="num">1.</span> <span class="cite"><strong>Sung, C. M.</strong>, &amp; Wang, X. M. (2025). A trial. <em>Journal of Advanced Nursing</em>, 81(2), 1-10. <a href="https://doi.org/10.1111/jan.1">doi</a></span></li>
<li><span class="num">2.</span> <span class="cite"><strong>Sung, C. M.</strong> (2019). Older work. <em>Nurse Education Today</em>, 70, 5-9.</span></li>
<li><span class="num">3.</span> <span class="cite">宋建美（2023）．中文論文．護理雜誌，70(1)，1-9。</span></li>
</ol></section></body></html>`;

test("論文清單匯出: years read, filtered, numbered again; bold, italics and DOI kept", () => {
  const groups = publicationEntries("publications.html", PUBS);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].items.map((x) => x.year), [2025, 2019, 2023]);
  assert.equal(groups[0].heading, "期刊論文");
  const recent = filterByYear(groups, 2021, 2026);
  assert.deepEqual(
    exportText(recent),
    "期刊論文\n1. Sung, C. M., & Wang, X. M. (2025). A trial. Journal of Advanced Nursing, 81(2), 1-10. https://doi.org/10.1111/jan.1\n2. 宋建美（2023）．中文論文．護理雜誌，70(1)，1-9。\n",
  );
  const word = exportWord("著作目錄", recent);
  assert.match(word, /<b>Sung, C\. M\.<\/b>/);
  assert.match(word, /<i>Journal of Advanced Nursing<\/i>/);
  assert.match(word, /text-indent: -0\.5in/);
  assert.doesNotMatch(word, /<script/);
  assert.equal(yearOf("Wang (n.d.) 2017 reprint"), 2017);
  assert.equal(yearOf("沒有年份"), null);
});

test("QR Code: a square matrix with finder patterns; public address of a page", () => {
  const m = qrMatrix("https://labsite-sites.example/sung-lab-website/");
  assert.ok(m.length >= 21 && m.every((row) => row.length === m.length));
  // Finder pattern corners are dark.
  assert.equal(m[0][0] && m[0][6] && m[6][0] && m[0][m.length - 1], true);
  const svg = qrSvg("x");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 29 29"/);
  assert.equal(publicPageUrl("https://h.example/lab/", "index.html"), "https://h.example/lab/");
  assert.equal(publicPageUrl("https://h.example/lab", "en/research.html"), "https://h.example/lab/en/research.html");
  assert.equal(publicPageUrl("https://h.example/lab/", "en/index.html"), "https://h.example/lab/en/");
});

test("學期更新: years go up, degrees guessed, new-member lines read", () => {
  assert.deepEqual(["碩一", "博士班二年級", "大三", "1st-year PhD student", "Year 2 MSN", "碩士班研究生"].map(bumpYear), ["碩二", "博士班三年級", "大四", "2nd-year PhD student", "Year 3 MSN", null]);
  assert.deepEqual(["博士生", "碩士班研究生", "大學部專題生", "研究助理"].map(degreeOf), ["博士", "碩士", "學士", ""]);
  assert.deepEqual(parseNewMembers("林新生、碩士班一年級\nAmy Chen, PhD student\n\n陳同學"), [
    { name: "林新生", role: "碩士班一年級" },
    { name: "Amy Chen", role: "PhD student" },
    { name: "陳同學", role: "" },
  ]);
});

test("學期更新 on the template: graduate to 畢業成員, role updated, newcomer added with empty extras", () => {
  const html = readFileSync(new URL("../templates/basic/members.html", import.meta.url), "utf8");
  const before = memberLists(parsePage(html).doc);
  assert.deepEqual(before.current[0].items.map((x) => x.name), ["王小明", "陳怡君", "李佳穎", "張志豪"]);
  assert.equal(before.alumni.heading, "畢業成員");
  const out = editHtml(html, (doc) =>
    applySemester(doc, {
      roles: [{ list: 0, index: 1, value: "碩士生（二年級）" }],
      graduates: [{ list: 0, index: 0, values: ["2026", "王小明（博士）", ""] }],
      add: [{ list: 0, name: "林新生", role: "碩士班一年級" }],
    }),
  );
  const after = memberLists(parsePage(out).doc);
  assert.deepEqual(
    after.current[0].items.map((x) => [x.name, x.role]),
    [
      ["陳怡君", "碩士生（二年級）"],
      ["李佳穎", "碩士生"],
      ["張志豪", "研究助理"],
      ["林新生", "碩士班一年級"],
    ],
  );
  const doc = parsePage(out).doc;
  const alumniText = [...doc.querySelectorAll("section")].find((s) => /畢業成員/.test(s.textContent)).textContent.replace(/\s+/g, " ");
  assert.match(alumniText, /2026 王小明（博士） 2025 黃雅婷/);
  // The newcomer copy does not keep the previous person's research topic.
  assert.doesNotMatch(out.slice(out.indexOf("林新生")), /^林新生[\s\S]{0,200}研究主題：社區/);
});
