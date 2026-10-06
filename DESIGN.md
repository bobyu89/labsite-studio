---
name: LabSite Studio — template basic, skins "導引" (guide) and "圖譜" (atlas)
description: One shared markup contract for research-lab websites, dressed by interchangeable skins; each skin is its own visual world over the same class names and theme variables.
colors:
  guide-zone-research: "#0b6e69"
  guide-zone-team: "#1f4e8c"
  guide-zone-publications: "#a8352b"
  guide-zone-join: "#8e2a5e"
  guide-on-zone: "#ffffff"
  guide-on-join: "#ffffff"
  guide-mark: "#f2a900"
  guide-ink: "#14181c"
  guide-ink-soft: "#46525c"
  guide-wall: "#e6eaec"
  guide-plate: "#ffffff"
  guide-rule: "#c5cdd3"
  atlas-zone-research: "#24589e"
  atlas-zone-team: "#2e6a3c"
  atlas-zone-publications: "#7a5a10"
  atlas-zone-join: "#44505c"
  atlas-on-zone: "#ffffff"
  atlas-on-join: "#ffffff"
  atlas-mark: "#b3261e"
  atlas-ink: "#1b1d1f"
  atlas-ink-soft: "#4d5560"
  atlas-wall: "#f3f4f5"
  atlas-plate: "#ffffff"
  atlas-rule: "#c9ced3"
typography:
  guide-display:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(2.5rem, 1.1rem + 4.8vw, 4.75rem)"
    fontWeight: 900
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  guide-page-title:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(2.5rem, 1.4rem + 4vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 1.1
  guide-headline:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(1.9rem, 1.2rem + 2.6vw, 3rem)"
    fontWeight: 900
    lineHeight: 1.15
  guide-title:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(1.3rem, 1rem + 1vw, 1.8rem)"
    fontWeight: 900
    lineHeight: 1.2
  guide-lead:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(1.35rem, 1.05rem + 1.2vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.55
  guide-other-language:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(0.95rem, 0.85rem + 0.4vw, 1.15rem)"
    fontWeight: 600
    lineHeight: 1.75
  guide-body:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.75
  guide-label:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 800
    lineHeight: 1.3
  atlas-display:
    fontFamily: "Archivo Narrow, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(2.6rem, 1.2rem + 5vw, 5rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  atlas-page-title:
    fontFamily: "Archivo Narrow, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(2.6rem, 1.4rem + 4.4vw, 4.75rem)"
    fontWeight: 700
    lineHeight: 1.05
  atlas-headline:
    fontFamily: "Public Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(1.8rem, 1.2rem + 2.2vw, 2.75rem)"
    fontWeight: 800
    lineHeight: 1.15
  atlas-title:
    fontFamily: "Archivo Narrow, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(1.3rem, 1rem + 1vw, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.2
  atlas-lead:
    fontFamily: "Public Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(1.3rem, 1rem + 1.1vw, 1.85rem)"
    fontWeight: 600
    lineHeight: 1.55
  atlas-other-language:
    fontFamily: "Archivo Narrow, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    letterSpacing: "0.06em"
  atlas-body:
    fontFamily: "Public Sans, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.75
  atlas-label:
    fontFamily: "Archivo Narrow, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 700
    letterSpacing: "0.06em"
  atlas-figure-number:
    fontFamily: "Archivo Narrow, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 700
    letterSpacing: "0.02em"
rounded:
  guide-sign: "4px"
  guide-key: "2px"
  atlas-square: "0px"
  atlas-key: "50%"
spacing:
  gutter: "clamp(16px, 4vw, 40px)"
  max: "1200px"
  guide-band-gap: "6px"
  guide-plate-gap: "2px"
  guide-sign-gap: "clamp(28px, 4vw, 48px)"
  guide-section: "clamp(56px, 8vw, 104px)"
  atlas-plate-gap: "4px"
  atlas-sign-gap: "clamp(28px, 4vw, 44px)"
  atlas-section: "clamp(56px, 7vw, 96px)"
  atlas-row: "18px 12px"
components:
  guide-button-primary:
    backgroundColor: "{colors.guide-ink}"
    textColor: "{colors.guide-plate}"
    typography: "{typography.guide-label}"
    rounded: "{rounded.guide-sign}"
    padding: "10px 20px"
    height: "48px"
  guide-button-primary-hover:
    backgroundColor: "transparent"
    textColor: "{colors.guide-ink}"
  guide-button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.guide-ink}"
    rounded: "{rounded.guide-sign}"
    padding: "10px 20px"
    height: "48px"
  guide-button-ghost-hover:
    backgroundColor: "{colors.guide-ink}"
    textColor: "{colors.guide-plate}"
  guide-zone-band:
    backgroundColor: "{colors.guide-plate}"
    textColor: "{colors.guide-ink}"
    typography: "{typography.guide-title}"
    rounded: "{rounded.guide-sign}"
    padding: "20px clamp(16px, 2.5vw, 28px)"
  guide-zone-band-lit:
    backgroundColor: "{colors.guide-zone-research}"
    textColor: "{colors.guide-on-zone}"
  guide-zone-plate:
    backgroundColor: "{colors.guide-plate}"
    textColor: "{colors.guide-ink}"
    padding: "10px 14px"
  guide-zone-plate-hover:
    backgroundColor: "{colors.guide-wall}"
  guide-page-sign:
    backgroundColor: "{colors.guide-zone-research}"
    textColor: "{colors.guide-on-zone}"
    typography: "{typography.guide-page-title}"
  guide-tag:
    backgroundColor: "transparent"
    textColor: "{colors.guide-ink}"
    rounded: "{rounded.guide-sign}"
    padding: "2px 10px"
  guide-link-plate:
    backgroundColor: "transparent"
    textColor: "{colors.guide-ink}"
    typography: "{typography.guide-label}"
    rounded: "{rounded.guide-sign}"
    padding: "4px 10px"
  guide-link-plate-hover:
    backgroundColor: "{colors.guide-ink}"
    textColor: "{colors.guide-plate}"
  atlas-button:
    backgroundColor: "transparent"
    textColor: "{colors.atlas-ink}"
    rounded: "{rounded.atlas-square}"
    padding: "8px 18px"
    height: "46px"
  atlas-button-hover:
    backgroundColor: "transparent"
    textColor: "{colors.atlas-mark}"
  atlas-label-row:
    backgroundColor: "{colors.atlas-plate}"
    textColor: "{colors.atlas-ink}"
    typography: "{typography.atlas-title}"
    rounded: "{rounded.atlas-square}"
    padding: "{spacing.atlas-row}"
  atlas-label-row-lit:
    backgroundColor: "color-mix(in srgb, #24589e 7%, #ffffff)"
    textColor: "{colors.atlas-mark}"
  atlas-zone-plate:
    backgroundColor: "{colors.atlas-plate}"
    textColor: "{colors.atlas-ink}"
    padding: "10px 12px"
  atlas-zone-plate-current:
    backgroundColor: "{colors.atlas-plate}"
    textColor: "{colors.atlas-mark}"
  atlas-page-sign:
    backgroundColor: "color-mix(in srgb, #24589e 9%, #ffffff)"
    textColor: "{colors.atlas-ink}"
    typography: "{typography.atlas-page-title}"
  atlas-plate-mark:
    backgroundColor: "transparent"
    textColor: "{colors.atlas-ink}"
    typography: "{typography.atlas-label}"
    rounded: "{rounded.atlas-square}"
    padding: "4px 12px"
  atlas-figure-tab:
    backgroundColor: "{colors.atlas-plate}"
    textColor: "{colors.atlas-ink}"
    typography: "{typography.atlas-figure-number}"
    padding: "2px 8px"
  atlas-tag:
    backgroundColor: "transparent"
    textColor: "{colors.atlas-ink}"
    rounded: "{rounded.atlas-square}"
    padding: "1px 9px"
  atlas-link-plate:
    backgroundColor: "transparent"
    textColor: "{colors.atlas-ink}"
    rounded: "{rounded.atlas-square}"
    padding: "2px 10px"
  atlas-link-plate-hover:
    backgroundColor: "transparent"
    textColor: "{colors.atlas-mark}"
---

# Design System: LabSite Studio — template basic, skins "導引" and "圖譜"

## Overview

**Creative North Star: "One markup, many sign programs" — 導引 is "The Hospital Directory Board", 圖譜 is "The Anatomy Atlas Plate".**

LabSite Studio is a template platform, so the system has two layers. The **shared structure** is fixed and every skin obeys it: the markup contract, the class names, the four zones, the theme variable names, the contrast gate. A **skin** is a whole visual world laid over that structure: its own `site.css` (layout and components) and `theme.css` (colour, type and corner tokens plus its web-font `@import`). Switching skins rewrites those two files and nothing else; not one word of a page changes. Two skins ship today: 導引 (guide, the default) and 圖譜 (atlas). Neither may borrow the other's signature devices; they share bones, not looks.

**導引 (guide).** A lab website read the way a visitor reads a Taiwanese hospital or campus sign program: find the building directory, pick a zone, follow its colour. Every page answers "where do I go next." Four zone colours each own whole full-width bands and colour their own page; signage-white plates sit on a cool wall grey; near-black ink carries the type. One amber mark means "you are here," and nothing else on the site is amber. The type is sign type: a heavy Chinese label with the other language set smaller and lighter beneath it, in one sans family. Depth is flat: plates meet and overlap, nothing casts a shadow. The only icon family is the arrow. Where a photo is missing, a flat wayfinding pictogram plate stands in and says it must be replaced.

**圖譜 (atlas).** Every section is a plate from a medical anatomy atlas, the book every nursing student studied for four years. White plate ground, near-black hairline ink, leader-line labels, numbered and captioned figures. The zones follow the anatomical colour convention (vein blue, lymph green, nerve ochre, fascia slate) and appear only as small key dots, coloured text and one pale flat field per page, never as solid fills. Artery red marks one thing: what the visitor is on or pointing at. A condensed label face sets labels, names, captions and numbers; a plain sans sets reading text. Depth is the plate frame and the leader line; nothing casts a shadow.

### Shared structure (every skin)

- **Markup contract.** `docs/markup-convention.md` and the class names in `templates/basic` (`.site-header`, `.masthead`, `.zones`, `.zone-plate`, `.directory`, `.directory__zones`, `.zone-band`, `.page-sign`, `.sign`, `.split`, `.btn`, `.tag`, the list blocks `.area-list` / `.pub-list` / `.news-list` / `.contact-list` / `.alumni-list`, `.member-grid`, `.photo-grid`, `.join`, `.next-zones`, `.site-footer`). A skin restyles them; it never renames, adds or removes markup.
- **Zones.** `data-zone` takes exactly `research`, `team`, `publications`, `join`; each skin maps it to `--zone` (and, in the guide, `--on`). `data-page` takes `index`, `research`, `members`, `publications`, `contact`.
- **Theme variable names** every skin's `theme.css` defines in `:root`: `--zone-research`, `--zone-team`, `--zone-publications`, `--zone-join`, `--on-zone`, `--on-join`, `--mark`, `--ink`, `--ink-soft`, `--wall`, `--plate`, `--rule`, `--font`, `--radius`, `--max`. A skin may add its own (atlas adds `--font-label`; its `site.css` falls back to `--font` when it is missing).
- **Contrast pairs.** `CONTRAST_PAIRS` in `src/site/themes.js`, each at 4.5:1: on-zone on each of the three zones, on-join on join, ink on plate and wall, ink-soft on plate and wall, zone-team on wall, zone-publications on plate. Both shipped skins pass all ten.
- **Theme generator.** `src/site/themes.js` (`makeTheme` / `generateThemes`) builds guide-shaped token sets: OKLCH zone hues per scheme (wayfinding, analogous, mono, duo) darkened until 4.6:1 against white and wall (join included, white text on every zone), no `--mark` (the mark stays the skin's own; a join hue within 40 degrees of the guide's amber hue 75 is moved away), radius 0 / 4 / 10px, Latin-first `FONT_PAIRS`. `patchTheme` only rewrites variables a file already declares.
- **Skin switching.** `labsite/skins.json` lists the skins (`id`, `name`, `description`; a skin marked `"from": "css"` in the template repo is copied from `css/` by `tools/bundle-templates.js`). `themeForSkin` in `src/site/skins.js` with "keep colours" carries only the colour variables (`--zone-*`, `--on-*`, `--ink*`, `--wall`, `--plate`, `--rule`) into the new skin's `theme.css`; `--mark`, fonts and radius come from the new skin, because each skin uses the mark differently (an amber bar with an ink keyline in 導引, red text and focus outlines in 圖譜). Note: 圖譜 does not read `--radius`.
- **Common bones.** Centred column `min(100% - 2 × gutter, --max)`, sections direct in `body`, 4:8 heading/content split, 7:5 directory head, rule-ruled lists with fixed tabular label columns, bilingual headings with the translation beneath, the keep-all wrapping set, breakpoints at 1024 / 860 / 640px, 96px scroll padding, `prefers-reduced-motion` honoured.

**Key Characteristics:**
- One markup contract, one set of theme variable names, one contrast gate; each skin a separate world.
- Four zones (research, team, publications, join) carry identity in every skin; how they appear is the skin's choice.
- One reserved mark colour per skin for location and focus: amber in 導引, artery red in 圖譜.
- Bilingual headings with the other language beneath, never a label above.
- Flat in both skins: depth from overlapping plates (導引) or plate frames and leader lines (圖譜).
- Rule-ruled lists instead of cards.

## Colors

### Shared theme surface

**The Theme Surface Rule.** Only the `:root` custom properties in a skin's `theme.css` and its font `@import` are swappable. Every skin defines the full shared variable set; every pair in `CONTRAST_PAIRS` must pass 4.5:1 before a theme ships. A skin's `site.css` may derive tints from theme variables with `color-mix()` but may not introduce a colour a theme cannot reach.

**The One Mark Rule.** Each skin reserves `--mark` for location and focus and uses it for nothing else.

### 導引 (guide)

A cool, low-chroma sign palette where four saturated-dark zone colours do all the talking and one amber marks location.

#### Primary
- **Research Teal** (guide-zone-research): owns the research band on the directory and colours the research page sign; also the small key square before each research area title.
- **Team Blue** (guide-zone-team): owns the team band and page; used as text for member and PI roles on plate and wall.
- **Publications Brick** (guide-zone-publications): owns the publications band and page; used as text for featured publication years.
- **Join Plum** (guide-zone-join): owns the join band and the full-bleed join section on inner pages.
- **On-zone / On-join White** (guide-on-zone, guide-on-join): text on any zone fill.

#### Secondary
- **You-Are-Here Amber** (guide-mark): the current-page bar under the active header plate, the outer ring of keyboard focus, the skip link, and text selection. Never a fill for content, never a zone.

#### Neutral
- **Sign Ink** (guide-ink): body text, the ink sign plate of the directory, primary buttons, 3px heading rules, the footer ground. On-ink tints in the footer and on the directory sign are mixed from white and `--ink` with `color-mix()` (68–92% white), so a generated theme carries them along.
- **Soft Ink** (guide-ink-soft): other-language lines, descriptors, authors and venues, secondary list text.
- **Wall Grey** (guide-wall): the page ground and alternating section ground; header plate hover.
- **Sign Plate** (guide-plate): white plates, the header, zone bands at rest, alternating section ground.
- **Rule Grey** (guide-rule): 1px list dividers and the header's bottom edge.

#### Named Rules
**The You-Are-Here Rule.** Amber marks only location and focus: the current page, the focused element, selection, the skip link. A generated theme moves any zone hue within 40 degrees of amber away from it.

**The Dark Zone Rule.** All four zones are dark enough to carry white text at 4.5:1, and dark enough to read as text on plate and wall at 4.5:1. `--on-zone` and `--on-join` stay white; a theme that needs dark text on a zone is outside the system.

### 圖譜 (atlas)

The anatomical colour convention at low weight: four muted mid-dark zone hues used as keys and pale fields on a white plate, near-black hairline ink, and one artery red.

#### Primary
- **Vein Blue** (atlas-zone-research): research key dots and the key before each research area title; the research page's pale field and its uppercase other-language line.
- **Lymph Green** (atlas-zone-team): team key dot; text colour for PI and member roles.
- **Nerve Ochre** (atlas-zone-publications): publications key dot; text colour for publication years.
- **Fascia Slate** (atlas-zone-join): join key dot and the pale join field on the home page.
- **On-zone / On-join White** (atlas-on-zone, atlas-on-join): declared for the shared contract and the contrast gate; atlas never sets text on a solid zone fill.

#### Secondary
- **Artery Red** (atlas-mark): the current header plate's label and its 3px bar, hover and focus on every link (label rows, header plates, buttons, link plates, the language switch), the drawn-out leader line and its 6px pin, the 2px focus outline, and a pale 22% tint for text selection.

#### Neutral
- **Plate Ink** (atlas-ink): text, every 1px frame and structural rule (header base, list tops, figure frames, plate marks), leader lines at rest, the skip link ground.
- **Soft Ink** (atlas-ink-soft): other-language lines, descriptors, captions, ledes, authors and venues, footer text.
- **Specimen Grey** (atlas-wall): only the ground behind figure frames while an image loads or is missing; atlas pages are white.
- **Plate White** (atlas-plate): the page and section ground, the header, the figure-number tabs, the contact page's join section.
- **Hairline Grey** (atlas-rule): 1px dividers between rows and sections, ghost button and tag borders, the lede's top rule.

#### Named Rules
**The Artery Rule.** Red marks only what the visitor is on or pointing at: the current page, hover, focus, the drawn leader and its pin, selection. Nothing at rest is red.

**The One Field Rule.** Each page has exactly one pale zone field, a 9% `color-mix()` of the zone into plate: the page sign on inner pages, the join section on the home page. On the contact page the join section returns to plate white so the page sign stays the only field. Label rows on hover take a 7% tint, which is state, not a field.

**The Key, Not Fill Rule.** Zone colours appear as small key dots, as text, and in the one pale field; never as a solid band or button fill.

## Typography

### 導引 (guide)

**Display Font:** Overpass (with Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif)
**Body Font:** the same stack
**Label/Mono Font:** none distinct; numerals use tabular figures.

**Character:** One highway-signage sans for Latin with a CJK sans falling through for Chinese; hierarchy comes from weight (400 to 900) and size, not from a second face. Latin is listed first so English sets in Overpass and Chinese falls through to the CJK face; generated pairings (`FONT_PAIRS`) keep that Latin-first order.

#### Hierarchy
- **Display** (guide-display): the lab name on the directory's ink sign plate. Once per site.
- **Page title** (guide-page-title): the inner-page zone sign.
- **Headline** (guide-headline): section sign headings.
- **Title** (guide-title): zone band labels, research area titles; PI name and featured publication titles sit in this weight class.
- **Lead** (guide-lead): statement and join leads, max 28–30em.
- **Other-language line** (guide-other-language, soft ink): the second language beneath every sign heading.
- **Body** (guide-body): prose, max 38–40em.
- **Label** (guide-label): table heads, link plates, the language switch. Header plate second lines drop to 0.72rem at 600.

#### Named Rules
**The Bilingual Sign Rule.** Every section heading is a pair: the page language as a heavy label, the other language smaller, 600 weight, soft ink, directly beneath, marked with its `lang`. The second line is a translation, never a category tag or a teaser.

### 圖譜 (atlas)

**Display Font:** Archivo Narrow (with Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif), through `--font-label`
**Body Font:** Public Sans (with Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif), through `--font`
**Label Font:** Archivo Narrow, the same as display.

**Character:** The atlas splits the work the way a textbook plate does: a condensed label face for everything that names or numbers (lab name, page titles, label rows, PI and member names, captions' figure numbers, years, dates, table heads, buttons), and a plain humanist sans for reading. Section headings are the one heavy Public Sans voice (800). Both stacks keep Latin first.

#### Hierarchy
- **Display** (atlas-display): the lab name on the title plate. Once per site.
- **Page title** (atlas-page-title): the inner-page plate title.
- **Headline** (atlas-headline): section headings, followed by a leader line.
- **Title** (atlas-title): label-row labels; area titles, PI name (to 2.6rem) and member names (1.3rem) share the face at 700.
- **Lead** (atlas-lead): statement lead, max 30em; the join lead runs slightly smaller (to 1.6rem).
- **Other-language line** (atlas-other-language): uppercase, tracked 0.06em, soft ink, beneath every heading; on the page sign it takes the zone colour.
- **Body** (atlas-body): prose, max 38–40em.
- **Label** (atlas-label): plate marks (tracked 0.08em), PI column heads and table heads (uppercase, 0.06em), the language switch.
- **Figure number** (atlas-figure-number): "圖 n" / "Fig. n" run into captions or set as frame tabs.

#### Named Rules
**The Counted Figure Rule.** Figures are numbered by a CSS counter reset on `body` and incremented on the directory photo, the PI photo, each member and each gallery photo. Captioned figures run the number in ("圖 1　" / "Fig. 1  "); uncaptioned ones (PI, members) carry it as a white tab in the frame's top-left corner, with a 1px ink right and bottom edge. Numbers are never typed into content.

**The Plate Mark Rule.** Each inner page is a numbered plate: 圖版 I research, 圖版 II members, 圖版 III publications, 圖版 IV contact (PLATE I–IV on English pages), set in the label face in a 1px ink box at the page sign's top right, beside the title, not above it.

### Both skins

**The Keep-All Rule.** Short sign labels (band descriptors, PI list items, tags, member roles, alumni destinations) use `word-break: keep-all` with `overflow-wrap: anywhere`, so Chinese breaks only at spaces and 、，, never inside a word. Headings balance; paragraphs and list items wrap pretty.

## Layout

**Shared.** A single centred column, `min(100% - 2 × gutter, 1200px)`, with a fluid gutter (16–40px). Sections sit directly in `body`. Content sections use a 4:8 split: heading left, content right. The directory head is 7:5 (lab-name plate, team photo). Lists are rule-ruled rows with fixed label columns (year 5rem, date 7.5rem, contact label 7rem, alumni year 4.5rem in atlas) and tabular numerals. Member and gallery grids auto-fill (12.5rem and 16rem minimums). At 1024px and below the header zones move to their own full-width, horizontally scrolling row with a rule above it (fading out at the right edge below 640px). At 860px and below the content collapses to one column. The sticky header reserves 96px of scroll padding.

**導引.** Sections alternate wall and plate grounds, each padded 56–104px fluidly. The four zone bands stack full width beneath the directory head at a 6px gap; each band is a four-column grid (label, other-language, descriptor, arrow). At 860px zone bands become label stack plus arrow, and the page-sign arrow is hidden. The favicon SVG still hard-codes the default research colour.

**圖譜.** All sections are white, padded 56–96px, separated by a 1px rule. The title plate is one 1px ink frame split by an ink hairline, the photo cell on specimen grey with a captioned foot. Beneath it the label rows share one five-column grid through `subgrid` (label, other-language, leader, descriptor up to 22rem, arrow), so every leader starts and rests at the same x. At 1024px the descriptor drops to a second row indented to the label text; at 860px rows become label / leader / arrow with the other-language line and descriptor beneath, and the section-heading leader returns inside the collapsed split. The inner-page arrow is not shown; the plate mark takes its column.

**The Shared Column Rule (圖譜).** Rows of one plate align to one grid: label rows use `subgrid`, so leaders never start at different x.

## Elevation & Depth

Both skins are flat. No surface casts an elevation shadow.

**導引.** Depth is made by plates meeting and overlapping: on inner pages, the first section's content plate rides up over the zone-coloured page sign by the section padding plus 48px, with square-topped radius corners. The only `box-shadow` is the 7px amber ring in the focus indicator (`outline: 3px solid ink; outline-offset: 3px; box-shadow: 0 0 0 7px mark`), which is a focus mark, not elevation.

**圖譜.** Depth is the plate frame and the leader line: 1px ink frames around the title plate and figures, a 1px ink base under the header and the page sign. Hover "lights the plate from inside": the row ground warms to a 7% zone tint; nothing lifts. Focus is a 2px artery-red outline at 3px offset. The only `box-shadow` is a 1px inset stroke drawing the hollow key on a header plate that has no zone; it is a line, not a shadow.

### Named Rules
**The Overlapping Plate Rule (導引).** If something needs to read as in front, it overlaps the plane behind it; it never floats on a shadow.

**The Hairline Rule (圖譜).** Structure is drawn, never shaded: 1px ink for frames and the top of every list, 1px hairline grey between rows. No line is heavier than 1px except the 3px current-page bar.

## Shapes

**導引.** Gently squared sign corners (`--radius`, 4px in this theme; generated themes use 0, 4 or 10px) on plates, bands, buttons, tags, photos and link plates. Joined plates round only their outer corners (the directory sign and photo share one rounded rectangle; the overlapping content plate rounds only its top). Zone key squares are small fixed-radius squares (2–3px) before labels. Borders are ink strokes: 2px on buttons and link plates, 1.5px on tags; lists use a 3px ink top rule and 1px rule-grey dividers. The arrow is drawn with a 2.6 stroke and square caps.

**圖譜.** Square everywhere (`--radius: 0px`; the atlas `site.css` draws square corners directly and does not read `--radius`). The only round shapes are the zone key dots (8px in the header, 0.5–0.55em before labels), the 6px red leader pin and the small ink pin at the end of a section-heading leader. All borders are 1px. The button chevron is thin and open (1.8 stroke, butt caps, 24-unit viewBox); label-row arrows are the shared markup arrow, drawn in ink at 22px. Join list items use a short 1px leader dash in place of a bullet.

## Components

### 導引 (guide)

#### Buttons
Solid ink sign buttons that invert on hover.
- **Shape:** sign radius, 2px ink border, 48px minimum height.
- **Primary:** ink fill, white label at 800, 10px 20px padding, followed by a masked arrow.
- **Hover / Focus:** fill drops to transparent with ink text; the arrow advances 4px on a 0.35s exponential ease-out. Focus is the shared ink outline plus amber ring.
- **Ghost:** transparent with ink border and text; fills ink on hover. On the join band, hover border and text switch to on-join white.

#### Chips (tags)
- **Style:** transparent, 1.5px ink border, sign radius, 0.85rem at 600, 2px 10px padding. Static research keywords; not interactive.

#### Link plates
- Small bordered plates (2px ink, 4px 10px, label type) for publication links and the language switch; fill ink with white text on hover.

#### Cards / Containers
There are no cards. Repeated items (areas, publications, news, contact, alumni, PI lists) are rows on a rule: a 3px ink top rule over the list, 1px rule-grey dividers between items. Photos are plain plates with the sign radius on a wall or plate ground.

#### Navigation
The header is a white plate with a 1px rule edge, sticky. The lab name sits left as a two-line sign (1.2rem at 900, other language at 0.78rem). The zones repeat as small header plates separated by 2px: a zone-coloured key square, label at 700, other-language line beneath. Hover lays wall grey behind the plate. The current page carries the amber you-are-here bar: a 7px amber strip with a 2px ink base along the plate's bottom. A bordered language switch closes the row.

#### Zone Band (signature)
The directory is the navigation. Each band is a white plate holding a zone key square, the label, the other-language line, a one-line descriptor and an arrow in the zone colour. On hover or focus the zone colour sweeps in left to right (0.5s ease-out), each text part turning white as the fill reaches it (staggered 0.04–0.34s), then the arrow advances 8px. On leave all delays reset to zero. On first load the key squares and arrows switch on in order (90ms stagger), with labels readable from the first frame. Reduced motion shows everything static. The same bands repeat at the end of inner pages as the next-zone directory.

#### Page Sign
Each inner page opens with a full-bleed band in its zone colour: page title, other-language line, one-sentence lede, and a large arrow on the right. The next section's plate overlaps it from below.

#### Placeholder Pictograms
Missing photos are flat wayfinding pictograms (grey figures on pale grey) whose alt text and caption say they must be replaced. They are part of the template, not of any lab's identity.

### 圖譜 (atlas)

#### Buttons
Hairline outline buttons that turn red when pointed at.
- **Shape:** square, 1px ink border, 46px minimum height, 8px 18px padding.
- **Primary:** transparent, ink label in the label face at 700 (1rem, tracked 0.04em), followed by the thin chevron.
- **Hover / Focus:** border and text turn artery red (0.15s colour change, nothing moves); focus adds the 2px red outline.
- **Ghost:** the same with a hairline-grey border.

#### Chips (tags)
- **Style:** transparent, 1px hairline-grey border, square, label face 0.88rem tracked 0.03em, 1px 9px padding. Static.

#### Link plates
- Publication links and the language switch: 1px ink box, label face at 700, square; border and text turn red on hover.

#### Cards / Containers
No cards. Lists open on a 1px ink rule with 1px hairline-grey dividers. Photos sit in 1px ink frames on specimen grey.

#### Navigation
The header is white, sticky, with a 1px ink base. The lab name is a two-line label (1.25rem at 700, other language 0.8rem tracked). Header plates, 4px apart, hold an 8px zone key dot (a hollow ink ring when the plate has no zone), the label at 600 and a tracked 0.72rem other-language line. Hover turns the label red; the current page's label is red and a 3px red bar sits on the header's base line.

#### Section Label with Leader
Section headings are atlas labels: the heading, then a 1px ink leader running to the right edge ending in a small ink pin, then the uppercase other-language line beneath. The leader is static. Inside the desktop 4:8 split the leader is hidden; it returns when the split collapses.

#### Label Row (signature)
The home navigation. Each row holds a zone key dot, the label, the uppercase other-language label, a 1px ink leader drawn to 60% of its column, the descriptor and the ink arrow, all on the shared subgrid. On hover or focus the row ground takes a 7% zone tint (0.2s), the leader draws out to full length and turns red (scaleX 0.6 to 1, 0.45s `cubic-bezier(0.16, 1, 0.3, 1)`), the label and arrow turn red, and a 6px red pin fades in at the leader's end after 0.25s. The same rows repeat at the end of inner pages as the next-zone directory. Reduced motion shows the end state without movement.

#### Page Sign and Plate Mark
Each inner page opens on its one pale zone field with a 1px ink base: page title in the label face, uppercase other-language line in the zone colour, soft-ink lede, and the plate mark box at top right.

#### Figure
A 1px ink frame on specimen grey, numbered by the figure counter: captions run "圖 n" in the label face, or a corner tab carries it when there is no caption.

## Do's and Don'ts

### Do:
- **Do** give every new page or section a zone through `data-zone` (research, team, publications, join) and let the skin's `--zone` colour it.
- **Do** set every section heading as a bilingual pair: the page language as the heading, the other-language line beneath with `lang`.
- **Do** define every shared theme variable in a new skin's `theme.css`, keep the class names, and run the colours through `contrastIssues()` before shipping.
- **Do** change a skin's look through its `theme.css` tokens and font `@import`; change `site.css` only as a whole skin that keeps the markup contract.
- **Do** honour `prefers-reduced-motion` in every skin.
- **Do** (導引) make depth by overlapping plates over bands.
- **Do** (導引) use the arrow (24-unit viewBox, 2.6 stroke, square caps) as the only icon.
- **Do** (導引) keep amber for the current page, focus, selection and the skip link only; all four zones dark, white text on all of them.
- **Do** (導引) keep motion to the directory power-up and the band sweep, with exponential ease-outs.
- **Do** (圖譜) draw structure with 1px lines: ink for frames and list tops, hairline grey between rows.
- **Do** (圖譜) number figures with the CSS counter and mark inner pages with 圖版 I–IV / PLATE I–IV.
- **Do** (圖譜) keep one pale zone field per page and align label rows on one subgrid.
- **Do** (圖譜) keep red for current, hover, focus and selection; let only the label-row leader move, and only on hover or focus.

### Don't:
- **Don't** rename, add or remove markup or class names in a skin, or bake any school or department identity into a template.
- **Don't** add a small label above a heading; the other-language line goes beneath, and it is a translation.
- **Don't** introduce colours in `site.css` that a theme cannot reach.
- **Don't** use shadows for elevation in either skin.
- **Don't** add a big photo hero or a grid of identical icon cards; the directory is the home page.
- **Don't** (導引) add icon families, glyph icons or decorative illustrations; arrows and replaceable pictograms only.
- **Don't** (導引) use amber, or any hue within 40 degrees of it, as a zone colour, or put dark text on a zone fill.
- **Don't** (圖譜) fill a band, button or block with a solid zone colour, or round a corner.
- **Don't** (圖譜) use red for anything at rest, or move anything but the label-row leader (colour and the pin's fade are the only other transitions).
- **Don't** (圖譜) borrow the guide's solid zone bands, amber, or overlapping plates.
