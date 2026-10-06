---
name: LabSite Studio — template "導引" (basic)
description: A wayfinding sign program for research-lab websites; one shared markup contract, re-themed by tokens.
colors:
  zone-research: "#0b6e69"
  zone-team: "#1f4e8c"
  zone-publications: "#a8352b"
  zone-join: "#8e2a5e"
  on-zone: "#ffffff"
  on-join: "#ffffff"
  mark: "#f2a900"
  ink: "#14181c"
  ink-soft: "#46525c"
  wall: "#e6eaec"
  plate: "#ffffff"
  rule: "#c5cdd3"
typography:
  display:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(2.5rem, 1.1rem + 4.8vw, 4.75rem)"
    fontWeight: 900
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  page-title:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(2.5rem, 1.4rem + 4vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 1.1
  headline:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(1.9rem, 1.2rem + 2.6vw, 3rem)"
    fontWeight: 900
    lineHeight: 1.15
  title:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(1.3rem, 1rem + 1vw, 1.8rem)"
    fontWeight: 900
    lineHeight: 1.2
  lead:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(1.35rem, 1.05rem + 1.2vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.55
  other-language:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(0.95rem, 0.85rem + 0.4vw, 1.15rem)"
    fontWeight: 600
    lineHeight: 1.75
  body:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Overpass, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 800
    lineHeight: 1.3
rounded:
  sign: "4px"
  key: "2px"
spacing:
  band-gap: "6px"
  plate-gap: "2px"
  gutter: "clamp(16px, 4vw, 40px)"
  sign-gap: "clamp(28px, 4vw, 48px)"
  section: "clamp(56px, 8vw, 104px)"
  max: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plate}"
    typography: "{typography.label}"
    rounded: "{rounded.sign}"
    padding: "10px 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sign}"
    padding: "10px 20px"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plate}"
  zone-band:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.sign}"
    padding: "20px clamp(16px, 2.5vw, 28px)"
  zone-band-lit:
    backgroundColor: "{colors.zone-research}"
    textColor: "{colors.on-zone}"
  zone-plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    padding: "10px 14px"
  zone-plate-hover:
    backgroundColor: "{colors.wall}"
  page-sign:
    backgroundColor: "{colors.zone-research}"
    textColor: "{colors.on-zone}"
    typography: "{typography.page-title}"
  tag:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sign}"
    padding: "2px 10px"
  link-plate:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sign}"
    padding: "4px 10px"
  link-plate-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plate}"
---

# Design System: LabSite Studio — template "導引" (basic)

## Overview

**Creative North Star: "The Hospital Directory Board"**

A lab website read the way a visitor reads a Taiwanese hospital or campus sign program: find the building directory, pick a zone, follow its colour. Every page answers "where do I go next." Four zone colours (research, team, publications, join) each own whole full-width bands and colour their own page; signage-white plates sit on a cool wall grey; near-black ink carries the type. One amber mark means "you are here," and nothing else on the site is amber.

The type is sign type: a heavy Chinese label with the other language set smaller and lighter beneath it, in one sans family. Depth is flat: plates meet and overlap, nothing casts a shadow. The only icon family is the arrow. Where a photo is missing, a flat wayfinding pictogram plate stands in and says it must be replaced.

This is a template platform, so the system has two layers. **Structure** (the markup contract in `docs/markup-convention.md` and the class names of `templates/basic`, the four-zone model, the layout, the motion, the focus construction) is shared by every template. **Theme** (the custom properties in `css/theme.css` plus its web-font `@import`) is the swappable surface; `src/site/themes.js` generates new contrast-safe token sets against it. A skin may restyle `site.css`, but it keeps the class names and the rules below.

**Key Characteristics:**
- Four zones, each a dark colour carrying white text; the zone colour is the page's identity.
- One amber "you are here" mark, shared with keyboard focus.
- Bilingual sign headings: heavy primary-language label, smaller other-language line beneath.
- Flat planes; depth from plates overlapping bands.
- Arrows are the only icons.
- Rule-ruled lists (3px ink top rule, 1px rule dividers) instead of cards.

## Colors

A cool, low-chroma sign palette where four saturated-dark zone colours do all the talking and one amber marks location.

### Primary
- **Research Teal** (zone-research): owns the research band on the directory and colours the research page sign; also the small key square before each research area title.
- **Team Blue** (zone-team): owns the team band and page; used as text for member and PI roles on plate and wall.
- **Publications Brick** (zone-publications): owns the publications band and page; used as text for featured publication years.
- **Join Plum** (zone-join): owns the join band and the full-bleed join section on inner pages.
- **On-zone / On-join White** (on-zone, on-join): text on any zone fill.

### Secondary
- **You-Are-Here Amber** (mark): the current-page bar under the active header plate, the outer ring of keyboard focus, the skip link, and text selection. Never a fill for content, never a zone.

### Neutral
- **Sign Ink** (ink): body text, the ink sign plate of the directory, primary buttons, 3px heading rules, the footer ground.
- **Soft Ink** (ink-soft): other-language lines, descriptors, authors and venues, secondary list text.
- **Wall Grey** (wall): the page ground and alternating section ground; header plate hover.
- **Sign Plate** (plate): white plates, the header, zone bands at rest, alternating section ground.
- **Rule Grey** (rule): 1px list dividers and the header's bottom edge.

### Named Rules
**The You-Are-Here Rule.** Amber marks only location and focus: the current page, the focused element, selection, the skip link. A generated theme moves any zone hue within 40 degrees of amber away from it.

**The Dark Zone Rule.** All four zones are dark enough to carry white text at 4.5:1, and dark enough to read as text on plate and wall at 4.5:1. `--on-zone` and `--on-join` stay white; a theme that needs dark text on a zone is outside the system.

**The Theme Surface Rule.** Only the `:root` custom properties in `css/theme.css` (zone-research, zone-team, zone-publications, zone-join, on-zone, on-join, mark, ink, ink-soft, wall, plate, rule, font, radius, max) and the font `@import` are swappable. Every pair in `CONTRAST_PAIRS` (`src/site/themes.js`) must pass 4.5:1 before a theme ships. Nothing in `site.css` may introduce a new colour that a theme cannot reach.

## Typography

**Display Font:** Overpass (with Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif)
**Body Font:** the same stack
**Label/Mono Font:** none distinct; numerals use tabular figures.

**Character:** One highway-signage sans for Latin with a CJK sans falling through for Chinese; hierarchy comes from weight (400 to 900) and size, not from a second face. Latin is listed first so English sets in Overpass and Chinese falls through to the CJK face; generated pairings (`FONT_PAIRS`) keep that Latin-first order.

### Hierarchy
- **Display** (900, fluid 2.5–4.75rem, 1.08, -0.01em): the lab name on the directory's ink sign plate. Once per site.
- **Page title** (900, fluid 2.5–4.5rem, 1.1): the inner-page zone sign.
- **Headline** (900, fluid 1.9–3rem, 1.15): section sign headings.
- **Title** (900, fluid 1.3–1.8rem, 1.2): zone band labels, research area titles; PI name and featured publication titles sit in this weight class.
- **Lead** (700, fluid 1.35–2rem, 1.55): statement and join leads, max 28–30em.
- **Other-language line** (600, fluid 0.95–1.15rem, soft ink): the second language beneath every sign heading.
- **Body** (400, 1.0625rem, 1.75): prose, max 38–40em.
- **Label** (800, 0.85rem): table heads, link plates, the language switch. Header plate second lines drop to 0.72rem at 600.

### Named Rules
**The Bilingual Sign Rule.** Every section heading is a pair: the page language as a heavy label, the other language smaller, 600 weight, soft ink, directly beneath, marked with its `lang`. The second line is a translation, never a category tag or a teaser.

**The Keep-All Rule.** Short sign labels (band descriptors, PI list items, tags, member roles, alumni destinations) use `word-break: keep-all` with `overflow-wrap: anywhere`, so Chinese breaks only at spaces and 、，, never inside a word. Headings balance; paragraphs and list items wrap pretty.

## Layout

A single centred column, `min(100% - 2 × gutter, 1200px)`, with a fluid gutter (16–40px). Sections sit directly in `body` and alternate wall and plate grounds, each padded 56–104px fluidly. Content sections use a 4:8 split: the sign heading left, content right. The directory head is 7:5 (ink sign plate, team photo slot) with four zone bands stacked full width beneath it at a 6px gap. Zone bands are a four-column grid (label, other-language, descriptor, arrow). Lists are rule-ruled rows with fixed label columns (year 5rem, date 7.5rem, contact label 7rem) and tabular numerals. Member and gallery grids auto-fill (12.5rem and 16rem minimums).

Breakpoints: at 1024px and below the header plates move to their own full-width, horizontally scrolling row (fading out at the right edge below 640px). At 860px and below the content collapses to one column: zone bands become label stack plus arrow, and the page-sign arrow is hidden. On-ink tints in the footer and the directory sign are derived from `--ink` with `color-mix()`, so a generated theme carries them along; the favicon SVG still hard-codes the default research colour. The sticky header reserves 96px of scroll padding.

## Elevation & Depth

Flat. No surface casts a shadow. Depth is made by plates meeting and overlapping: on inner pages, the first section's content plate rides up over the zone-coloured page sign by the section padding plus 48px, with square-topped radius corners. The only `box-shadow` in the system is the 7px amber ring in the focus indicator, which is a focus mark, not elevation.

### Named Rules
**The Overlapping Plate Rule.** If something needs to read as in front, it overlaps the plane behind it; it never floats on a shadow.

## Shapes

Gently squared sign corners (`--radius`, 4px in this theme; generated themes use 0, 4 or 10px) on plates, bands, buttons, tags, photos and link plates. Joined plates round only their outer corners (the directory sign and photo share one rounded rectangle; the overlapping content plate rounds only its top). Zone key squares are small fixed-radius squares (2–3px) before labels. Borders are ink strokes: 2px on buttons and link plates, 1.5px on tags; lists use a 3px ink top rule and 1px rule-grey dividers. The arrow is drawn with a 2.6 stroke and square caps.

## Components

### Buttons
Solid ink sign buttons that invert on hover.
- **Shape:** sign radius, 2px ink border, 48px minimum height.
- **Primary:** ink fill, white label at 800, 10px 20px padding, followed by a masked arrow.
- **Hover / Focus:** fill drops to transparent with ink text; the arrow advances 4px on a 0.35s exponential ease-out. Focus is the shared ink outline plus amber ring.
- **Ghost:** transparent with ink border and text; fills ink on hover. On the join band, hover border and text switch to on-join white.

### Chips (tags)
- **Style:** transparent, 1.5px ink border, sign radius, 0.85rem at 600, 2px 10px padding. Static research keywords; not interactive.

### Link plates
- Small bordered plates (2px ink, 4px 10px, label type) for publication links and the language switch; fill ink with white text on hover.

### Cards / Containers
There are no cards. Repeated items (areas, publications, news, contact, alumni, PI lists) are rows on a rule: a 3px ink top rule over the list, 1px rule-grey dividers between items. Photos are plain plates with the sign radius on a wall or plate ground.

### Navigation
The header is a white plate with a 1px rule edge, sticky. The lab name sits left as a two-line sign (1.2rem at 900, other language at 0.78rem). The zones repeat as small header plates separated by 2px: a zone-coloured key square, label at 700, other-language line beneath. Hover lays wall grey behind the plate. The current page carries the amber you-are-here bar: a 7px amber strip with a 2px ink base along the plate's bottom. A bordered language switch closes the row.

### Zone Band (signature)
The directory is the navigation. Each band is a white plate holding a zone key square, the label, the other-language line, a one-line descriptor and an arrow in the zone colour. On hover or focus the zone colour sweeps in left to right (0.5s ease-out), each text part turning white as the fill reaches it (staggered 0.04–0.34s), then the arrow advances 8px. On leave all delays reset to zero. On first load the key squares and arrows switch on in order (90ms stagger), with labels readable from the first frame. Reduced motion shows everything static. The same bands repeat at the end of inner pages as the next-zone directory.

### Page Sign
Each inner page opens with a full-bleed band in its zone colour: page title, other-language line, one-sentence lede, and a large arrow on the right. The next section's plate overlaps it from below.

### Placeholder Pictograms
Missing photos are flat wayfinding pictograms (grey figures on pale grey) whose alt text and caption say they must be replaced. They are part of the template, not of any lab's identity.

## Do's and Don'ts

### Do:
- **Do** give every new page or section a zone through `data-zone` (research, team, publications, join) and let `--zone` / `--on` colour it.
- **Do** set every section heading as a bilingual sign: heavy label, other-language line beneath with `lang`.
- **Do** make depth by overlapping plates over bands.
- **Do** use the arrow (24-unit viewBox, 2.6 stroke, square caps) as the only icon.
- **Do** keep amber for the current page, focus, selection and the skip link only.
- **Do** run every generated theme through `contrastIssues()`; all four zones dark, white text on all of them.
- **Do** change a template's look through `css/theme.css` tokens and the font `@import`; change `site.css` only as a skin that keeps the class names.
- **Do** keep motion to the directory power-up and the band sweep, with exponential ease-outs, and honour `prefers-reduced-motion`.

### Don't:
- **Don't** use shadows for elevation; the focus ring is the only `box-shadow`.
- **Don't** add icon families, glyph icons or decorative illustrations; arrows and replaceable pictograms only.
- **Don't** add a big photo hero or a grid of identical icon cards; the directory board is the home page.
- **Don't** use amber, or any hue within 40 degrees of it, as a zone colour.
- **Don't** put dark text on a zone fill or light a zone too pale to carry white text.
- **Don't** add a small label above a heading; the second sign line goes beneath, and it is a translation.
- **Don't** introduce colours in `site.css` that a theme cannot reach, or bake any school or department identity into a template.
