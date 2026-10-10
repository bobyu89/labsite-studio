// Moving a site to a new address: every text file (pages, sitemap.xml,
// robots.txt, scripts, styles) has its old address replaced by the new one,
// as one saved version. Typical use: sites imported from GitHub Pages
// (https://owner.github.io/repo/) now served by LabSite Cloud.

export const TEXT_FILE = /\.(html?|xml|txt|js|mjs|css|json|webmanifest|svg|md)$/i;

const slash = (u) => String(u || "").trim().replace(/\/*$/, "/");

// Old GitHub Pages address → current public address, for every site the user
// can see that came from GitHub. → [{ from, to, name }]
export function githubAddresses(sites = []) {
  const out = [];
  for (const s of sites) {
    const m = /^([\w.-]+)\/([\w.-]+)$/.exec(s.github || "");
    if (!m || !s.url) continue;
    out.push({ from: `https://${m[1].toLowerCase()}.github.io/${m[2]}/`, to: slash(s.url), name: s.name || s.slug });
  }
  return out;
}

const countOf = (text, find) => (find ? text.split(find).length - 1 : 0);

// Applies the pairs in order. http:// spellings of an https:// address are
// replaced too. → { text, count }
export function replaceAddresses(text, pairs) {
  let out = String(text);
  let count = 0;
  for (const { from, to } of pairs) {
    if (!from || from === to) continue;
    const spellings = /^https:\/\//i.test(from) ? [from, from.replace(/^https:/i, "http:")] : [from];
    for (const f of spellings) {
      const n = countOf(out, f);
      if (!n) continue;
      count += n;
      out = out.split(f).join(to);
    }
  }
  return { text: out, count };
}

// files: [{ path, text }] → changed files only: [{ path, text, count }]
export function planRelocation(files, pairs) {
  const plan = [];
  for (const f of files) {
    if (!TEXT_FILE.test(f.path) || typeof f.text !== "string") continue;
    const r = replaceAddresses(f.text, pairs);
    if (r.count) plan.push({ path: f.path, text: r.text, count: r.count });
  }
  return plan;
}
