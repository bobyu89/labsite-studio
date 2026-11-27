// v4.30 從我的資料帶入: a Word file's text, an old website's text, and where
// each part of a CV goes on the site.
import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import "./dom.js";
const { zipEntry, documentText, docxText } = await import("../src/site/docxText.js");
const { htmlText, wantedLinks, checkUrl, oldSiteText } = await import("../cloud/src/webText.js");
const { importTargets, importRequest, paperEntries } = await import("../src/site/profileImport.js");

// A minimal zip: entries [name, bytes, deflate?].
function makeZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const [name, data, deflate] of entries) {
    const body = deflate ? deflateRawSync(data) : data;
    const n = enc.encode(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    parts.push(local, n, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(deflate ? 8 : 0, 10);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}

test("docx: the paragraphs of word/document.xml, stored or deflated", async () => {
  const xml = Buffer.from('<w:document><w:body><w:p><w:r><w:t>王小明 副教授</w:t></w:r></w:p><w:p><w:r><w:t>Wang &amp; Lin</w:t><w:tab/><w:t>2025</w:t></w:r></w:p></w:body></w:document>');
  for (const deflate of [false, true]) {
    const zip = makeZip([["[Content_Types].xml", Buffer.from("<x/>"), deflate], ["word/document.xml", xml, deflate]]);
    assert.equal(documentText(new TextDecoder().decode(await zipEntry(zip, "word/document.xml"))), "王小明 副教授\nWang & Lin 2025");
    assert.equal(await docxText({ arrayBuffer: async () => zip.buffer }), "王小明 副教授\nWang & Lin 2025");
  }
  assert.equal(await zipEntry(makeZip([["a.txt", Buffer.from("x"), false]]), "word/document.xml"), null);
  await assert.rejects(docxText({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }), /Word/);
});

test("old website: readable text, same-site CV / paper pages, public http(s) only", async () => {
  assert.equal(htmlText("<html><head><style>x{}</style><script>alert(1)</script></head><body><h1>王小明</h1><p>護理&amp;健康<br>研究</p><!-- c --></body></html>"), "王小明\n護理&健康\n研究");
  const base = new URL("https://www.example.edu.tw/~wang/");
  const html = '<a href="pub.html">Publications</a><a href="https://other.org/cv">CV</a><a href="news.html">消息</a><a href="cv.pdf">CV PDF</a><a href="/~wang/about.html">簡介</a>';
  assert.deepEqual(wantedLinks(html, base), ["https://www.example.edu.tw/~wang/pub.html", "https://www.example.edu.tw/~wang/about.html"]);
  for (const bad of ["ftp://x.org", "http://localhost/", "http://10.0.0.1/", "http://intranet/", "javascript:alert(1)", "not a url"]) assert.equal(checkUrl(bad), null, bad);
  const pages = {
    "https://www.example.edu.tw/~wang/": '<h1>王小明</h1><a href="pub.html">論文</a>',
    "https://www.example.edu.tw/~wang/pub.html": "<li>Wang (2025). A paper.</li>",
  };
  const fetchImpl = async (url) => (pages[url] ? new Response(pages[url], { headers: { "Content-Type": "text/html; charset=utf-8" } }) : new Response("no", { status: 404 }));
  const got = await oldSiteText("https://www.example.edu.tw/~wang/", fetchImpl);
  assert.deepEqual(got.pages, Object.keys(pages));
  assert.match(got.text, /王小明[\s\S]*Wang \(2025\)\. A paper\./);
  await assert.rejects(oldSiteText("https://www.example.edu.tw/missing", fetchImpl), /找不到這個網頁/);
});

test("each part goes to the page that has it, as a request the assistant can act on", () => {
  assert.deepEqual(importTargets(["index.html", "research.html", "members.html", "publications.html", "contact.html", "en/index.html"]), {
    person: "members.html",
    research: "research.html",
    projects: "research.html",
    home: "index.html",
    contact: "contact.html",
  });
  assert.equal(importTargets(["index.html", "pi.html", "projects.html"]).person, "pi.html");
  assert.equal(importTargets(["index.html", "pi.html", "projects.html"]).projects, "projects.html");
  const p = (zh, en) => ({ zh, en });
  const data = {
    person: { name_zh: "王小明", name_en: "Xiao-Ming Wang", title: p("副教授", "Associate Professor"), department: p("", "") },
    bio: p("專長高齡照護。", "Studies ageing."),
    education: [p("2015 博士", "2015 PhD")],
    positions: [],
    awards: ["2023 優良教師"],
    topics: [{ title: p("讓長輩不跌倒", "Falls"), desc: p("介入研究。", "Interventions.") }],
    projects: [{ title: "計畫A", funder: "國科會", years: "2024–2026", role: "主持人" }],
    contact: { email: "wang@x.edu.tw", phone: "", office: "301" },
  };
  const person = importRequest("person", data);
  assert.match(person, /不要編造/);
  assert.match(person, /姓名：王小明 \/ Xiao-Ming Wang\n職稱：副教授 \/ Associate Professor\n簡介（中）：專長高齡照護。/);
  assert.match(person, /學歷：\n- 2015 博士 \/ 2015 PhD/);
  assert.doesNotMatch(person, /系所|經歷/, "empty parts are left out");
  assert.match(importRequest("research", data), /- 讓長輩不跌倒 \/ Falls：介入研究。｜Interventions\./);
  assert.match(importRequest("home", data), /\[W-01\]/);
  assert.equal(importRequest("contact", data), "把網站的聯絡資料改成下面這些（研究室資料）。\nEmail：wang@x.edu.tw\n地址／辦公室：301");
  const long = { ...data, topics: Array.from({ length: 5 }, () => ({ title: p("x".repeat(40), "y"), desc: p("z".repeat(2000), "w") })) };
  assert.ok(importRequest("research", long).length <= 3800, "fits the assistant's 4000 characters");
  const [paper] = paperEntries([{ authors: ["Wang, X.-M.", "林雅婷"], year: 2025, title: "T", journal: "J", volume: "1", issue: "2", pages: "3-4", doi: "10.1111/jan.1" }]);
  assert.deepEqual(paper.meta.authors, [{ family: "Wang", given: "X.-M." }, { literal: "林雅婷" }]);
  assert.equal(paper.meta.doi, "10.1111/jan.1");
});
