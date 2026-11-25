// DOI / PMID → a reference in the lab's style.
import test from "node:test";
import assert from "node:assert/strict";
const { parseIdentifier, fromCsl, fromPubmed, formatReference, fieldValuesFor } = await import("../src/site/cite.js");

test("identifiers: DOI in any common form, PMID as number or PubMed link", () => {
  assert.deepEqual(parseIdentifier("https://doi.org/10.1111/jan.15599"), { type: "doi", id: "10.1111/jan.15599" });
  assert.deepEqual(parseIdentifier("doi: 10.6224/JN.202410_71(5).07."), { type: "doi", id: "10.6224/JN.202410_71(5).07" });
  assert.deepEqual(parseIdentifier("PMID: 39889522"), { type: "pmid", id: "39889522" });
  assert.deepEqual(parseIdentifier("https://pubmed.ncbi.nlm.nih.gov/36345185/"), { type: "pmid", id: "36345185" });
  assert.equal(parseIdentifier("不是編號"), null);
  assert.equal(parseIdentifier(""), null);
});

const EN = {
  author: [{ given: "Chien-Mei", family: "Sung" }, { given: "X. M.", family: "Wang" }, { given: "Kuei‐Ru", family: "Chou" }],
  issued: { "date-parts": [[2026, 3]] },
  title: "Effects of a nurse-led programme on self-care: A randomized controlled trial",
  "container-title": "Journal of Advanced Nursing",
  volume: "82",
  issue: "3",
  page: "1234–1245",
  DOI: "10.1111/jan.99999",
};

test("English reference in APA 7, with the lab's way of writing initials", () => {
  const r = formatReference(fromCsl(EN));
  assert.equal(r.text, "Sung, C. M., Wang, X. M., & Chou, K. R. (2026). Effects of a nurse-led programme on self-care: A randomized controlled trial. Journal of Advanced Nursing, 82(3), 1234-1245.");
  assert.equal(r.journal, "Journal of Advanced Nursing");
  assert.equal(r.url, "https://doi.org/10.1111/jan.99999");
  assert.match(formatReference(fromCsl(EN), { hyphen: true }).text, /^Sung, C\.-M\., Wang, X\. M\., & Chou, K\.-R\./);
  // Article numbers, one author, a question mark title, 21+ authors.
  const one = formatReference(fromCsl({ ...EN, author: [EN.author[0]], page: "105012", "article-number": "105012", issue: "", title: "Does it work?" })).text;
  assert.equal(one, "Sung, C. M. (2026). Does it work? Journal of Advanced Nursing, 82, Article 105012.");
  const many = Array.from({ length: 23 }, (_, i) => ({ family: "A" + i, given: "B" }));
  assert.match(formatReference(fromCsl({ ...EN, author: many })).text, /A17, B\., A18, B\., \. \. \. A22, B\. \(2026\)/);
});

test("Chinese reference in 中文 APA (華藝 DOIs give the first page only)", () => {
  const zh = fromCsl({
    author: [{ literal: "宋建美" }, { literal: "林瑩滋" }],
    issued: { "date-parts": [["2024", "10", "1"]] },
    title: "專科護理師組織氣候、領導風格與工作滿意度關係之初探",
    "container-title": "護理雜誌",
    volume: "71",
    issue: "5",
    "page-first": "46",
    DOI: "10.6224/JN.202410_71(5).07",
  });
  assert.deepEqual(formatReference(zh), {
    text: "宋建美、林瑩滋（2024）．專科護理師組織氣候、領導風格與工作滿意度關係之初探．護理雜誌，71(5)，46。",
    journal: "護理雜誌",
    url: "https://doi.org/10.6224/JN.202410_71(5).07",
  });
});

test("PubMed summary: names, journal title, DOI", () => {
  const meta = fromPubmed(
    {
      uid: "39889522",
      pubdate: "2025 Apr",
      fulljournalname: "Journal of clinical neuroscience : official journal of the Neurosurgical Society of Australasia",
      authors: [{ name: "Chelepy W", authtype: "Author" }, { name: "Van der Berg JA", authtype: "Author" }, { name: "Study Group", authtype: "CollectiveName" }],
      title: "Evaluating the brain injury guidelines.",
      volume: "134",
      issue: "",
      pages: "111092",
      articleids: [{ idtype: "doi", value: "10.1016/j.jocn.2025.111092" }],
    },
    "39889522",
  );
  assert.equal(meta.journal, "Journal of Clinical Neuroscience");
  assert.equal(meta.doi, "10.1016/j.jocn.2025.111092");
  assert.equal(formatReference(meta).text, "Chelepy, W., & Van der Berg, J. A. (2025). Evaluating the brain injury guidelines. Journal of Clinical Neuroscience, 134, 111092.");
});

test("template lists: one value per field", () => {
  const fields = [{ kind: "text", label: "年份" }, { kind: "text", label: "標題" }, { kind: "text", label: "作者" }, { kind: "text", label: "期刊或出處" }, { kind: "link", label: "連結網址" }, { kind: "text", label: "備註" }];
  assert.deepEqual(fieldValuesFor(fields, fromCsl(EN)), [
    "2026",
    "Effects of a nurse-led programme on self-care: A randomized controlled trial",
    "Sung, C. M., Wang, X. M., Chou, K. R.",
    "Journal of Advanced Nursing, 82(3), 1234–1245",
    "https://doi.org/10.1111/jan.99999",
    "",
  ]);
});
