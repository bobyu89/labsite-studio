// Skins: whole looks for the shared template markup. A skin is a pair of
// stylesheets — css/site.css (layout and components) and css/theme.css
// (colour, type and corner tokens) — so switching one never touches a page.
// Each site carries the skins it can switch to:
//   labsite/skins.json                { "version": 1, "current": "guide",
//                                       "skins": [{ "id", "name", "description" }] }
//   labsite/skins/<id>/site.css
//   labsite/skins/<id>/theme.css
import { readTheme, patchTheme } from "./themes.js";

export const SKINS_PATH = "labsite/skins.json";
export const SITE_CSS = "css/site.css";
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const skinFile = (id, name) => `labsite/skins/${id}/${name}`;

export function parseSkins(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || raw.version !== 1 || !Array.isArray(raw.skins)) return null;
  const seen = new Set();
  const skins = [];
  for (const s of raw.skins) {
    if (!s || !ID.test(String(s.id)) || seen.has(s.id)) continue;
    seen.add(s.id);
    skins.push({ id: s.id, name: String(s.name || s.id).slice(0, 30), description: String(s.description || "").slice(0, 160) });
  }
  if (!skins.length) return null;
  return { current: skins.some((s) => s.id === raw.current) ? raw.current : null, skins };
}

export async function loadSkins(source) {
  try {
    return parseSkins(await source.readText(SKINS_PATH));
  } catch {
    return null;
  }
}

// Reads a skin's two stylesheets.
export async function readSkin(source, id) {
  const [site, theme] = await Promise.all([source.readText(skinFile(id, "site.css")), source.readText(skinFile(id, "theme.css"))]);
  if (!readTheme(theme)) throw new Error("版型「" + id + "」的 theme.css 沒有可用的設計變數。");
  return { site, theme };
}

// The theme.css to use when switching skins. By default the skin's own
// tokens; with keepColors, the skin's file with the site's current colours
// (and only colours) carried over, so a lab keeps its identity.
// --mark is not carried: each skin uses it differently (an amber bar with an
// ink keyline in 導引, red text and focus outlines in 圖譜), so it stays the
// skin's own.
const COLOR_VARS = /^--(zone-|on-|ink|wall$|plate$|rule$)/;
export function themeForSkin(skinTheme, currentTheme, { keepColors = false } = {}) {
  if (!keepColors || !currentTheme) return skinTheme;
  const current = readTheme(currentTheme);
  if (!current) return skinTheme;
  const vars = Object.fromEntries(Object.entries(current.vars).filter(([k]) => COLOR_VARS.test(k)));
  return patchTheme(skinTheme, { vars });
}

export function withCurrent(skinsText, id) {
  const raw = JSON.parse(skinsText);
  raw.current = id;
  return JSON.stringify(raw, null, 2) + "\n";
}
