import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
import { youtubeEmbed, mapEmbed, embedFromInput, isAllowedEmbed, embedBlock, embedLabel } from "../src/site/embeds.js";
import { parsePage, sectionElements, collectFields, setAttribute, insertSection, editHtml, structureSignature } from "../src/site/page.js";

const ID = "dQw4w9WgXcQ";
const NC = "https://www.youtube-nocookie.com/embed/" + ID;

test("every common YouTube link becomes a privacy-enhanced embed", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=" + ID,
    "https://youtube.com/watch?v=" + ID + "&feature=share",
    "https://m.youtube.com/watch?v=" + ID,
    "https://youtu.be/" + ID,
    "youtu.be/" + ID,
    "https://www.youtube.com/shorts/" + ID,
    "https://www.youtube.com/live/" + ID,
    "https://www.youtube.com/embed/" + ID,
    "https://www.youtube-nocookie.com/embed/" + ID,
  ])
    assert.equal(youtubeEmbed(url), NC, url);
  assert.equal(youtubeEmbed("https://youtu.be/" + ID + "?t=90"), NC + "?start=90");
  assert.equal(youtubeEmbed("https://www.youtube.com/watch?v=" + ID + "&t=1m30s"), NC + "?start=90");
  assert.equal(youtubeEmbed("https://www.youtube.com/playlist?list=PL0123456789abcdef"), "https://www.youtube-nocookie.com/embed/videoseries?list=PL0123456789abcdef");
  assert.equal(youtubeEmbed("https://www.youtube.com/watch?v=short"), null);
  assert.equal(youtubeEmbed("https://vimeo.com/123"), null);
  assert.equal(youtubeEmbed("https://evil.example/watch?v=" + ID), null);
});

test("maps accept place links, search links, embed code and plain addresses", () => {
  const q = (s, z = 16) => "https://maps.google.com/maps?q=" + encodeURIComponent(s) + "&z=" + z + "&output=embed";
  assert.equal(mapEmbed("國防醫學大學護理學院").src, q("國防醫學大學護理學院"));
  assert.equal(
    mapEmbed("https://www.google.com/maps/place/%E5%9C%8B%E9%98%B2%E9%86%AB%E5%AD%B8%E5%A4%A7%E5%AD%B8/@25.0717,121.5871,17z/data=!3m1").src,
    q("國防醫學大學", 17),
  );
  assert.equal(mapEmbed("https://www.google.com/maps/search/coffee+near+me/@25.03,121.56,14z").src, q("coffee near me", 14));
  assert.equal(mapEmbed("https://www.google.com.tw/maps?q=Taipei+101").src, q("Taipei 101"));
  assert.equal(mapEmbed("https://www.google.com/maps/@25.0330,121.5654,15z").src, q("25.0330,121.5654", 15));
  const code = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3613.9!2d121.58!3d25.07" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>';
  assert.equal(mapEmbed(code).src, "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3613.9!2d121.58!3d25.07");
  assert.equal(mapEmbed("https://maps.app.goo.gl/AbCdEf123").short, true);
  assert.equal(mapEmbed("https://evil.example/maps/embed?pb=x"), null);
});

test("input is routed by the chosen kind with readable errors", () => {
  assert.deepEqual(embedFromInput("https://youtu.be/" + ID, "video"), { ok: true, kind: "video", src: NC });
  assert.equal(embedFromInput("台北車站", "video").ok, false);
  assert.match(embedFromInput("台北車站", "video").error, /YouTube/);
  assert.equal(embedFromInput("台北車站", "map").kind, "map");
  assert.match(embedFromInput("https://maps.app.goo.gl/x", "map").error, /短網址/);
  assert.equal(embedFromInput("", "map").ok, false);
  assert.equal(embedFromInput("https://youtu.be/" + ID).kind, "video");
});

test("only video and map embeds are allowed as iframe sources", () => {
  assert.ok(isAllowedEmbed(NC));
  assert.ok(isAllowedEmbed("https://www.youtube.com/embed/" + ID + "?start=3"));
  assert.ok(isAllowedEmbed("https://www.youtube-nocookie.com/embed/videoseries?list=PLabcdefghij"));
  assert.ok(isAllowedEmbed("https://www.google.com/maps/embed?pb=!1m18"));
  assert.ok(isAllowedEmbed("https://maps.google.com/maps?q=x&output=embed"));
  for (const bad of [
    "http://www.youtube-nocookie.com/embed/" + ID,
    "https://www.youtube-nocookie.com.evil.example/embed/" + ID,
    "https://evil@www.youtube.com/embed/" + ID,
    "https://www.google.com/maps/embed",
    "https://maps.google.com/maps?q=x",
    "javascript:alert(1)",
    "https://example.com/",
    "",
  ])
    assert.equal(isAllowedEmbed(bad), false, bad);
  assert.throws(() => embedBlock({ kind: "video", src: "https://example.com/" }));
  assert.equal(embedLabel(NC + "?start=90"), "https://youtu.be/" + ID + "?t=90");
  assert.equal(embedLabel("https://maps.google.com/maps?q=%E5%8F%B0%E5%8C%97&z=16&output=embed"), "台北");
});

const PAGE = '<!DOCTYPE html>\n<html><head><title>t</title></head>\n<body>\n  <section class="section" id="a"><h2>A</h2></section>\n</body>\n</html>\n';

test("an embed block is one editable field, and its address can only change to another allowed embed", () => {
  const block = embedBlock({ kind: "video", src: NC, title: "研究室介紹影片" });
  const html = editHtml(PAGE, (doc) => insertSection(doc, 0, block, "index.html"));
  const { doc } = parsePage(html);
  const section = sectionElements(doc)[1];
  const fields = collectFields(section);
  assert.deepEqual(
    fields.map((f) => [f.kind, f.label]),
    [
      ["text", "標題"],
      ["text", "段落"],
      ["embed", "影片"],
    ],
  );
  const f = fields[2];
  assert.equal(f.src, NC);
  assert.equal(f.title, "研究室介紹影片");
  assert.equal(f.embed, "video");
  assert.equal(setAttribute(section, f.path, "src", "https://example.com/"), false);
  assert.equal(setAttribute(section, f.path, "src", NC + "?start=5"), true);
  assert.equal(section.querySelector("iframe").getAttribute("src"), NC + "?start=5");
  // Map blocks read as maps; the iframe never shows up as text or link fields.
  const map = embedBlock({ kind: "map", src: "https://maps.google.com/maps?q=x&output=embed" });
  const m = parsePage(editHtml(PAGE, (d) => insertSection(d, 0, map, "index.html"))).doc;
  assert.equal(collectFields(sectionElements(m)[1]).at(-1).embed, "map");
  assert.ok(structureSignature(m).includes("e"));
});
