// v4.27 網站體檢: findings from what the editor knows, most important first.
import test from "node:test";
import assert from "node:assert/strict";
const { healthFindings, healthScore } = await import("../src/site/health.js");
const NOW = Date.parse("2026-11-26T12:00:00Z");

test("a neglected site: old news, sample text, duplicates, unpublished work — ordered by weight", () => {
  const f = healthFindings(
    {
      news: [{ date: "2026-03-01" }, { date: "2025-12-01" }],
      papers: { total: 30, latestYear: 2023, duplicates: 2, noEnglish: 1, noDoi: 12 },
      people: { total: 4, placeholderPhotos: 2, noEnglish: 1 },
      checks: [{ kind: "sample", total: 3 }, { kind: "broken", total: 1 }, { kind: "a11y", total: 2 }],
      sync: 2,
      unpublishedDays: 12,
      views30: 0,
      comments: 1,
    },
    NOW,
  );
  assert.deepEqual(f.slice(0, 3).map((x) => x.id), ["sample", "news-old", "papers-duplicate"]);
  assert.ok(f.find((x) => x.id === "news-old").title.includes("9 個月"));
  assert.ok(f.find((x) => x.id === "papers-old").title.includes("2023"));
  assert.deepEqual(
    ["unpublished", "comments", "views", "people-photos", "sync", "links", "papers-doi"].map((id) => !!f.find((x) => x.id === id)),
    [true, true, true, true, true, true, true],
  );
  assert.equal(f.find((x) => x.id === "a11y"), undefined, "a couple of small accessibility notes are not worth a finding");
  assert.ok(healthScore(f) < 40);
});

test("a looked-after site: nothing to report, full marks", () => {
  const f = healthFindings(
    { news: [{ date: "2026-11-20" }], papers: { total: 30, latestYear: 2026, duplicates: 0, noEnglish: 0, noDoi: 2 }, people: { total: 5, placeholderPhotos: 0, noEnglish: 0 }, checks: [], sync: 0, unpublishedDays: null, views30: 120, comments: 0 },
    NOW,
  );
  assert.deepEqual(f, []);
  assert.equal(healthScore(f), 100);
});
