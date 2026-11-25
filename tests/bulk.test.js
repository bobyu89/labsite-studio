// v4.22: 一次匯入多篇論文 (bibImport.js), 中英不同步 (pairSync.js) and the
// outside-link part of 發布前檢查 (publishCheck.js).
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
const { parseBibtex, parseRis, readImport, parseOrcid, orcidWorks, siteIndex, isListed, newestFirst, splitName } = await import("../src/site/bibImport.js");
const { outOfSync, textHash } = await import("../src/site/pairSync.js");
const { checkSite, externalLinks } = await import("../src/site/publishCheck.js");
const { formatReference } = await import("../src/site/cite.js");

const BIB = String.raw`% exported from Zotero
@article{sung2024,
  title = {Effects of {Simulation}-based learning on nurse practitioners' clinical reasoning: A randomized controlled trial},
  author = {Sung, Chien-Mei and Wang, Xiao-Ming and M{\"u}ller, Hans},
  journal = {Journal of Advanced Nursing},
  volume = {80}, number = {3}, pages = {1234--1245}, year = {2024},
  doi = {10.1111/jan.15599},
}
@comment{ignored}
@inproceedings{chou2023, title = "A conference talk", author = "Kuei-Ru Chou", booktitle = "ICN Congress", year = 2023}`;

test("BibTeX: Zotero / Google Scholar exports, LaTeX accents, names in both orders", () => {
  const [a, b] = parseBibtex(BIB);
  assert.deepEqual(a.authors, [
    { family: "Sung", given: "Chien-Mei" },
    { family: "Wang", given: "Xiao-Ming" },
    { family: "Müller", given: "Hans" },
  ]);
  assert.equal(a.title, "Effects of Simulation-based learning on nurse practitioners' clinical reasoning: A randomized controlled trial");
  assert.deepEqual([a.journal, a.volume, a.issue, a.pages, a.year, a.doi], ["Journal of Advanced Nursing", "80", "3", "1234-1245", 2024, "10.1111/jan.15599"]);
  assert.deepEqual([b.title, b.journal, b.year, b.authors[0]], ["A conference talk", "ICN Congress", 2023, { family: "Chou", given: "Kuei-Ru" }]);
  // Formats like a hand-typed reference.
  assert.equal(
    formatReference(a).text,
    "Sung, C. M., Wang, X. M., & Müller, H. (2024). Effects of Simulation-based learning on nurse practitioners' clinical reasoning: A randomized controlled trial. Journal of Advanced Nursing, 80(3), 1234-1245.",
  );
  assert.deepEqual(splitName("宋 建美"), { literal: "宋建美" });
});

const RIS = `TY  - JOUR
AU  - Sung, Chien-Mei
AU  - Chou, Kuei-Ru
TI  - Cognitive training for older adults.
T2  - International Journal of Nursing Studies
PY  - 2025///
VL  - 150
SP  - 104655
DO  - https://doi.org/10.1016/j.ijnurstu.2023.104655
ER  -
TY  - JOUR
AU  - 宋建美
TI  - 專科護理師角色發展
JO  - 護理雜誌
PY  - 2022
VL  - 69
IS  - 2
SP  - 10
EP  - 18
ER  - `;

test("RIS: EndNote / Zotero / Mendeley exports, Chinese references", () => {
  const [a, b] = parseRis(RIS);
  assert.deepEqual([a.title, a.journal, a.year, a.pages, a.doi], ["Cognitive training for older adults", "International Journal of Nursing Studies", 2025, "104655", "10.1016/j.ijnurstu.2023.104655"]);
  assert.equal(a.authors.length, 2);
  assert.deepEqual([b.authors, b.pages, b.issue], [[{ literal: "宋建美" }], "10-18", "2"]);
  assert.equal(formatReference(b).text, "宋建美（2022）．專科護理師角色發展．護理雜誌，69(2)，10-18。");
});

test("pasted text: the format is recognised; a DOI / PMID list loses duplicates and junk", () => {
  assert.equal(readImport(BIB).format, "bibtex");
  assert.equal(readImport(RIS).format, "ris");
  const ids = readImport("10.1111/jan.15599\nhttps://doi.org/10.1016/j.ijnurstu.2023.104655.\nPMID: 39889522\n10.1111/JAN.15599\n不是編號");
  assert.equal(ids.format, "ids");
  assert.deepEqual(ids.ids, [
    { type: "doi", id: "10.1111/jan.15599" },
    { type: "doi", id: "10.1016/j.ijnurstu.2023.104655" },
    { type: "pmid", id: "39889522" },
  ]);
  assert.equal(readImport("隨便一段話").format, null);
});

test("ORCID: iD with its check digit, works with their DOIs", () => {
  assert.equal(parseOrcid("https://orcid.org/0000-0002-1825-0097"), "0000-0002-1825-0097");
  assert.equal(parseOrcid("0000-0002-1694-233x"), "0000-0002-1694-233X");
  assert.equal(parseOrcid("0000-0002-1825-0098"), null, "wrong check digit");
  assert.equal(parseOrcid("12345"), null);
  const works = orcidWorks({
    group: [
      {
        "external-ids": { "external-id": [{ "external-id-type": "doi", "external-id-value": "10.1111/JAN.15599" }] },
        "work-summary": [{ title: { title: { value: "A paper" } }, "publication-date": { year: { value: "2024" } }, "journal-title": { value: "JAN" }, type: "journal-article" }],
      },
      { "work-summary": [{ title: { title: { value: "No DOI here" } }, "external-ids": { "external-id": [{ "external-id-type": "pmid", "external-id-value": "PMID 123456" }] } }] },
      { "work-summary": [{ title: null }] },
    ],
  });
  assert.deepEqual(works, [
    { title: "A paper", year: 2024, journal: "JAN", doi: "10.1111/JAN.15599", pmid: "", type: "journal-article" },
    { title: "No DOI here", year: null, journal: "", doi: "", pmid: "123456", type: "" },
  ]);
});

test("already on the site: by DOI (any case) or by title, ignoring punctuation and quotes", () => {
  const index = siteIndex([
    '<li>Sung, C.-M. (2024). Effects of simulation-based learning on nurse practitioners’ clinical reasoning: A randomized controlled trial. <a href="https://doi.org/10.1111/JAN.15599">doi</a></li>',
    "<li>宋建美（2022）．專科護理師角色發展．護理雜誌。</li>",
  ]);
  assert.equal(isListed({ doi: "10.1111/jan.15599", title: "" }, index), true);
  assert.equal(isListed({ doi: "", title: "Effects of Simulation-based learning on nurse practitioners' clinical reasoning" }, index), true);
  assert.equal(isListed({ doi: "", title: "專科護理師角色發展的歷程與挑戰之探討" }, index), false);
  assert.equal(isListed({ doi: "10.1/other", title: "Short" }, index), false, "short titles are not matched by text");
  assert.deepEqual(
    newestFirst([{ year: 2020, title: "b" }, { year: 2024, title: "a" }, { year: null, title: "c" }]).map((x) => x.title),
    ["a", "b", "c"],
  );
});

/* ------------------------------------------------------- 中英不同步 */
const page = (sections) => `<!DOCTYPE html><html><head><title>t</title></head><body>${sections.map((s) => `<section class="section"><h2>${s[0]}</h2><p>${s[1]}</p></section>`).join("")}</body></html>`;
const ZH = [
  ["關於我們", "我們研究高齡照護。"],
  ["研究方向", "認知訓練。"],
];
const EN = [
  ["About", "We study ageing care."],
  ["Research", "Cognitive training."],
];

test("中英不同步: one language changed since publishing, the other not", () => {
  const zhBase = page(ZH);
  const enBase = page(EN);
  assert.deepEqual(outOfSync({ zhNow: zhBase, zhBase, enNow: enBase, enBase }), [], "nothing changed");
  const zhNow = page([ZH[0], ["研究方向", "認知訓練與遠距照護。"]]);
  const r = outOfSync({ zhNow, zhBase, enNow: enBase, enBase });
  assert.deepEqual(
    r.map((x) => [x.section, x.behind, x.reason]),
    [[1, "en", "changed"]],
  );
  assert.equal(r[0].hash, textHash("研究方向\n認知訓練與遠距照護。"));
  // Both changed: in step.
  const enNow = page([EN[0], ["Research", "Cognitive training and telecare."]]);
  assert.deepEqual(outOfSync({ zhNow, zhBase, enNow, enBase }), []);
  // English changed alone.
  assert.deepEqual(
    outOfSync({ zhNow: zhBase, zhBase, enNow, enBase }).map((x) => [x.section, x.behind]),
    [[1, "zh"]],
  );
  // Never published: nothing to compare with.
  assert.deepEqual(outOfSync({ zhNow, zhBase: null, enNow: enBase, enBase: null }), []);
});

test("中英不同步: Chinese copied onto the English page by 同步 is caught; pages that no longer line up compare as a whole", () => {
  const zhBase = page(ZH);
  const enBase = page(EN);
  const zhNow = page([...ZH, ["新段落", "新的內容。"]]);
  const enNow = page([...EN, ["新段落", "新的內容。"]]);
  assert.deepEqual(
    outOfSync({ zhNow, zhBase, enNow, enBase }).map((x) => [x.section, x.behind, x.reason]),
    [[2, "en", "untranslated"]],
  );
  // Different structure on the two pages: whole-page comparison.
  const zhOnly = page([...ZH, ["只有中文", "內容。"]]);
  assert.deepEqual(
    outOfSync({ zhNow: zhOnly, zhBase, enNow: enBase, enBase }).map((x) => [x.section, x.behind]),
    [[null, "en"]],
  );
});

/* ------------------------------------------------------ 發布前檢查 */
test("發布前檢查: outside links listed for the server; extra findings merged in", () => {
  const html = '<!DOCTYPE html><html><body><a href="https://doi.org/10.1/x">DOI</a><a href="members.html">成員</a><a href="mailto:a@b.c">信</a><a href="http://example.org/p">  外部  </a></body></html>';
  assert.deepEqual(externalLinks(html), [
    { url: "https://doi.org/10.1/x", text: "DOI" },
    { url: "http://example.org/p", text: "外部" },
  ]);
  const checks = checkSite({
    pages: [],
    extra: { sync: [{ page: "en/index.html", count: 1, examples: ["「研究方向」英文還沒跟上"] }], deadlink: [{ page: "index.html", count: 2, examples: ["DOI（這個 DOI 不存在）"] }] },
  });
  assert.deepEqual(
    checks.map((c) => [c.kind, c.level, c.total]),
    [
      ["sync", "warn", 1],
      ["deadlink", "warn", 2],
    ],
  );
});
