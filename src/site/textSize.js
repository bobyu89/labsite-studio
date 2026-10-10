// A site's overall text size. These sites size their type in rem, so one
// root font-size scales every heading and paragraph together. The setting is
// a marked block at the end of one stylesheet (css/theme.css when the site has
// one, else its main stylesheet); 標準 removes the block, leaving the file
// exactly as it was.

export const TEXT_SIZES = [
  { pct: 93.75, label: "小" },
  { pct: 100, label: "標準" },
  { pct: 112.5, label: "大" },
  { pct: 125, label: "特大" },
];
// Stylesheets tried, in order, for sites without css/theme.css.
export const TEXT_SIZE_FILES = ["css/main.css", "css/site.css", "css/style.css", "css/styles.css"];

const START = "/* labsite:text-size */";
const END = "/* labsite:text-size:end */";
const BLOCK = /\n*\/\* labsite:text-size \*\/[\s\S]*?\/\* labsite:text-size:end \*\/\n?/;

export function readTextSize(css) {
  const m = BLOCK.exec(String(css || ""));
  const pct = m && /font-size:\s*([\d.]+)%/.exec(m[0]);
  return pct ? Number(pct[1]) : 100;
}

export function writeTextSize(css, pct) {
  const base = String(css || "").replace(BLOCK, "\n");
  const clean = BLOCK.test(String(css || "")) ? base.replace(/\n+$/, "\n") : String(css || "");
  if (!pct || Number(pct) === 100) return clean;
  return clean.replace(/\n*$/, "\n") + `\n${START}\nhtml { font-size: ${Number(pct)}%; }\n${END}\n`;
}

// Carries the setting from one stylesheet text to another (switching skins
// replaces css/theme.css wholesale).
export const carryTextSize = (from, to) => writeTextSize(to, readTextSize(from));
