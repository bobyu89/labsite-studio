// v4.25: 論文與成員總表 (contentIndex.js), the DOI link fix, 前 10 分鐘 steps.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./dom.js";
const { paperIndex, peopleIndex, titleIn, doiIn } = await import("../src/site/contentIndex.js");
const { addLinkToItem } = await import("../src/site/quickAdd.js");
const { sectionElements, editHtml } = await import("../src/site/page.js");

const list = (items) =>
  `<!DOCTYPE html><html lang="zh-Hant"><head><title>著作</title></head><body><section class="section"><h2>期刊論文</h2><ol class="pub-list">${items
    .map((t, i) => `<li><span class="num">${i + 1}.</span> <span class="cite">${t}</span></li>`)
    .join("")}</ol></section></body></html>`;
const A = '<strong>Sung, C. M.</strong> (2025). A randomized trial of X. <em>Journal of Advanced Nursing</em>, 81, 1-9. <a href="https://doi.org/10.1111/jan.1">DOI</a>';
const B = "<strong>Sung, C. M.</strong> (2023). Cognitive training for older adults. <em>Nurse Education Today</em>, 70, 5-9.";
const C = "宋建美（2022）．專科護理師角色發展．護理雜誌，69(2)，10-18。";

test("titles and DOIs read from APA and Chinese references", () => {
  assert.equal(titleIn("Sung, C. M. (2025). A randomized trial of X. Journal, 1."), "A randomized trial of X");
  assert.equal(titleIn("宋建美（2022）．專科護理師角色發展．護理雜誌，69(2)。"), "專科護理師角色發展");
  assert.equal(doiIn("… 81, 1-9. https://doi.org/10.1111/jan.1"), "10.1111/jan.1");
  assert.equal(doiIn("no doi here"), "");
});

test("總表: duplicates, missing on the English page, no DOI; same place counts as the same paper", () => {
  const pages = [
    { path: "publications.html", html: list([A, B, C, B]) },
    // English list differs in length: matched by DOI / title only; C (Chinese title) is missing.
    { path: "en/publications.html", html: list([A, B]) },
  ];
  const { papers, pairs } = paperIndex(pages, ["publications.html", "en/publications.html"]);
  assert.deepEqual(pairs, { "publications.html": "en/publications.html" });
  const by = Object.fromEntries(papers.map((p) => [p.title, p]));
  assert.deepEqual(by["A randomized trial of X"].flags, []);
  assert.deepEqual(by["Cognitive training for older adults"].flags, ["duplicate", "no-doi"]);
  assert.deepEqual(by["專科護理師角色發展"].flags, ["no-en", "no-doi"]);
  assert.deepEqual(by["Cognitive training for older adults"].zh.map((x) => x.index), [1, 3]);
  // Lists of the same length line up by position, so a translated title still pairs.
  const zhOnly = paperIndex([{ path: "publications.html", html: list([C]) }, { path: "en/publications.html", html: list(["Sung, C. M. (2022). Role development of NPs. Journal of Nursing, 69(2), 10-18."]) }], ["publications.html", "en/publications.html"]);
  assert.equal(zhOnly.papers.length, 1);
  assert.deepEqual(zhOnly.papers[0].flags, ["no-doi"]);
});

test("找 DOI: a link added once after the citation, never twice", () => {
  const html = list([B]);
  const out = editHtml(html, (doc) => addLinkToItem(sectionElements(doc)[0], [1], 0, "10.1016/j.nedt.2023.1", "citation"));
  assert.match(out, /70, 5-9\. <a [^>]*href="https:\/\/doi\.org\/10\.1016\/j\.nedt\.2023\.1"[^>]*>DOI<\/a><\/span>/);
  assert.match(out, /target="_blank"/);
  assert.equal(editHtml(out, (doc) => addLinkToItem(sectionElements(doc)[0], [1], 0, "10.1/other", "citation")), out);
});

test("成員總表 on the template: Chinese and English side by side, sample photos marked", () => {
  const dir = new URL("../templates/basic/", import.meta.url);
  const people = peopleIndex("members.html", readFileSync(new URL("members.html", dir), "utf8"), "en/members.html", readFileSync(new URL("en/members.html", dir), "utf8"));
  assert.deepEqual(
    people.map((x) => [x.name, x.role, x.en?.name, x.photo]),
    [
      ["王小明", "博士生", "Hsiao-Ming Wang", "placeholder"],
      ["陳怡君", "碩士生", "Yi-Chun Chen", "placeholder"],
      ["李佳穎", "碩士生", "Chia-Ying Lee", "placeholder"],
      ["張志豪", "研究助理", "Chih-Hao Chang", "placeholder"],
    ],
  );
});
