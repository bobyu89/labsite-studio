// 新增一篇論文: finding the publication lists, adding at the top, numbering.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
const { parsePage, serializePage, sectionElements, describeNode, addItem, removeItem } = await import("../src/site/page.js");
const { publicationLists, addCitation, addFieldsItem, guessJournal, matchingList, normalizeUrl, previewCitation } = await import("../src/site/quickAdd.js");

const page = (body) => `<!DOCTYPE html>\n<html lang="zh-Hant">\n<head><title>t</title></head>\n<body>\n${body}\n</body>\n</html>\n`;
// 宋老師's shape: one paragraph per reference, two lists numbered as one run.
const CITATIONS = page(`  <section class="section">
    <h2>期刊論文</h2>
    <ol class="pub-list">
      <li class="pub-item">
        <span class="pub-item__index">1.</span>
        <p class="pub-item__text">Aini, N., <strong>Sung, C. M.</strong>, &amp; Chou, K. R. (2026). Comparative effectiveness of recreational therapies. <em>Ageing Research Reviews</em>, 12, 1-9. <a class="doi" href="https://pubmed.ncbi.nlm.nih.gov/1/" target="_blank" rel="noopener noreferrer">PubMed</a></p>
      </li>
      <li class="pub-item">
        <span class="pub-item__index">2.</span>
        <p class="pub-item__text"><strong>Sung, C. M.</strong>, &amp; Chou, K. R. (2023). The effect of cognitive training on older adults. <em>Journal of Advanced Nursing</em>, 79(2), 1-12.</p>
      </li>
    </ol>
    <h3>中文期刊</h3>
    <ol class="pub-list" start="3">
      <li class="pub-item">
        <span class="pub-item__index">3.</span>
        <p class="pub-item__text"><strong>宋建美</strong>、林瑩滋（2024）．專科護理師組織氣候、領導風格與工作滿意度關係之初探．<em>護理雜誌</em>，71(5)，46-57。</p>
      </li>
    </ol>
  </section>`);
// The templates' shape: one element per part, a year first.
const FIELDS = page(`  <section class="pubs">
    <h2>代表著作</h2>
    <ol class="pub-list">
      <li class="pub">
        <p class="pub__year">2026</p>
        <p class="pub__title">（範例）遠距追蹤改善心衰竭病人自我照顧</p>
        <p class="pub__authors">Lin CH, Wang HM</p>
        <p class="pub__venue">Journal of Advanced Nursing</p>
        <a class="pub__link" href="#">全文</a>
      </li>
      <li class="pub">
        <p class="pub__year">2025</p>
        <p class="pub__title">（範例）情境模擬對新進護理師臨床推理的影響</p>
        <p class="pub__authors">Chen YC</p>
        <p class="pub__venue">Nurse Education Today</p>
        <a class="pub__link" href="#">全文</a>
      </li>
    </ol>
  </section>`);
const indexes = (html) => [...html.matchAll(/pub-item__index">([^<]+)</g)].map((m) => m[1]);

test("publicationLists: both shapes, headings, the name the lab puts in bold", () => {
  const lists = publicationLists(parsePage(CITATIONS).doc);
  assert.deepEqual(lists.map((l) => [l.heading, l.shape, l.count, l.bold]), [["期刊論文", "citation", 2, "Sung, C. M."], ["中文期刊", "citation", 1, "宋建美"]]);
  const fields = publicationLists(parsePage(FIELDS).doc);
  assert.deepEqual(fields.map((l) => [l.heading, l.shape, l.count]), [["代表著作", "fields", 2]]);
  assert.deepEqual(fields[0].fields.map((f) => f.label), ["年份", "標題", "作者", "期刊或出處", "連結網址（DOI 或全文，可留白）"]);
  assert.deepEqual(publicationLists(parsePage(page("<section><h2>聯絡</h2><p>沒有清單</p></section>")).doc), []);
});

test("addCitation: on top, marked up like its neighbours, both lists numbered again", () => {
  const parsed = parsePage(CITATIONS);
  const [list] = publicationLists(parsed.doc);
  const text = "Wang, X. M., Sung, C. M., & Chou, K. R. (2026). Effects of a <nurse-led> programme. Journal of Advanced Nursing, 82(3), 1234-1245.";
  assert.equal(addCitation(sectionElements(parsed.doc)[list.section], list.path, { text, bold: list.bold, journal: guessJournal(text), url: "10.1111/jan.99999" }), true);
  const out = serializePage(parsed);
  assert.deepEqual(indexes(out), ["1.", "2.", "3.", "4."]);
  assert.match(out, /<ol class="pub-list" start="4">/);
  assert.match(
    out,
    /<span class="pub-item__index">1\.<\/span>\s*<p class="pub-item__text">Wang, X\. M\., <strong>Sung, C\. M\.<\/strong>, &amp; Chou, K\. R\. \(2026\)\. Effects of a &lt;nurse-led&gt; programme\. <em>Journal of Advanced Nursing<\/em>, 82\(3\), 1234-1245\. <a class="doi" href="https:\/\/doi\.org\/10\.1111\/jan\.99999" target="_blank" rel="noopener noreferrer">DOI<\/a><\/p>/,
  );
  // The old first reference is untouched, now second.
  assert.match(out, /<span class="pub-item__index">2\.<\/span>\s*<p class="pub-item__text">Aini, N\., <strong>Sung, C\. M\.<\/strong>/);
  // Nothing typed: nothing added.
  assert.equal(addCitation(sectionElements(parsed.doc)[list.section], list.path, { text: "  " }), false);
  // No link, no marks found: plain text only.
  const again = parsePage(CITATIONS);
  addCitation(sectionElements(again.doc)[0], list.path, { text: "Somebody (2020). A title with no journal known here at all.", bold: "Nobody", journal: "", url: "" });
  assert.match(serializePage(again), /<p class="pub-item__text">Somebody \(2020\)\. A title with no journal known here at all\.<\/p>/);
});

test("lists that continue a count keep it when an earlier or their own list changes", () => {
  const parsed = parsePage(CITATIONS);
  const section = sectionElements(parsed.doc)[0];
  const [first, second] = describeNode(section).lists;
  assert.deepEqual([first.numbered, second.numbered], [true, true]);
  addItem(section, second.path); // 中文期刊: 3., 4.
  assert.deepEqual(indexes(serializePage(parsed)), ["1.", "2.", "3.", "4."]);
  removeItem(section, first.path, 0); // one fewer above: 1., then 2., 3.
  const out = serializePage(parsed);
  assert.deepEqual(indexes(out), ["1.", "2.", "3."]);
  assert.match(out, /start="2"/);
});

test("a year at the start of each entry is not a list number", () => {
  const parsed = parsePage(FIELDS);
  const section = sectionElements(parsed.doc)[0];
  const [list] = describeNode(section).lists;
  assert.equal(list.numbered, false);
  addItem(section, list.path);
  assert.deepEqual([...serializePage(parsed).matchAll(/pub__year">([^<]+)</g)].map((m) => m[1]), ["2026", "2025", "2025"]);
});

test("addFieldsItem: one value per part, on top; an empty link stays #", () => {
  const parsed = parsePage(FIELDS);
  const [list] = publicationLists(parsed.doc);
  const section = sectionElements(parsed.doc)[list.section];
  assert.equal(addFieldsItem(section, list.path, list.fields, ["2027", "新的研究", "Wang XM", "護理雜誌", ""]), true);
  const out = serializePage(parsed);
  assert.match(out, /<li class="pub">\s*<p class="pub__year">2027<\/p>\s*<p class="pub__title">新的研究<\/p>\s*<p class="pub__authors">Wang XM<\/p>\s*<p class="pub__venue">護理雜誌<\/p>\s*<a class="pub__link" href="#">全文<\/a>\s*<\/li>\s*<li class="pub">\s*<p class="pub__year">2026<\/p>/);
  assert.equal(addFieldsItem(section, list.path, list.fields, ["", "", "", "", ""]), false);
  // The English page lines up with the Chinese one until one of them changes.
  const en = publicationLists(parsePage(FIELDS).doc);
  assert.equal(matchingList(en, list), en[0]);
  assert.equal(matchingList(publicationLists(parsed.doc), list), null);
});

test("guessJournal, normalizeUrl, previewCitation", () => {
  assert.equal(guessJournal("Wang, X. (2026). Effects of care: A trial. Journal of Advanced Nursing, 82(3), 1-9."), "Journal of Advanced Nursing");
  assert.equal(guessJournal("Arifin, H. (2026). Effect of therapies in patients. Dysphagia."), "Dysphagia");
  assert.equal(guessJournal("宋建美、林瑩滋（2024）．專科護理師組織氣候之初探．護理雜誌，71(5)，46-57。"), "護理雜誌");
  assert.equal(guessJournal("沒有年份的一段文字"), "");
  assert.equal(normalizeUrl("10.1111/jan.1"), "https://doi.org/10.1111/jan.1");
  assert.equal(normalizeUrl("pubmed.ncbi.nlm.nih.gov/123/"), "https://pubmed.ncbi.nlm.nih.gov/123/");
  assert.equal(normalizeUrl("  "), "");
  const pv = previewCitation({ text: "A, Sung, C. M. (2026). T. Nursing Journal, 1.", bold: "Sung, C. M.", journal: "Nursing Journal", url: "https://pubmed.ncbi.nlm.nih.gov/1/" });
  assert.deepEqual(pv.parts.map((x) => x.tag || "-"), ["-", "strong", "-", "em", "-"]);
  assert.equal(pv.link.label, "PubMed");
});
