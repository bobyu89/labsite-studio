---
version: 1
slug: "templates-basic-labsite-skins-atlas-site-css"
primary_target: "templates/basic/labsite/skins/atlas/site.css"
related_targets: []
---

# Skin "圖譜" (atlas) for template basic

Scope: a second skin for the shared `templates/basic` markup — `labsite/skins/atlas/site.css` + `theme.css`. CSS only: the HTML, class names, sections and editable fields are fixed by the LabSite markup convention and must not change. Mode: Persuade (prospective students and reviewers decide to read on, apply or collaborate). Brand-neutral, WCAG 2.1 AA, bilingual zh/en.

## Direction contract

THESIS: Every section is a plate from a medical anatomy atlas: hairline ink, leader-line labels, figure numbers and captions, the book every nursing student studied for four years. It refuses both the stock lab page and the guide skin's solid zone bands.

OWN-WORLD: White plate ground, near-black hairline ink (1px rules), anatomical colour convention for the zones — vein blue (research), lymph green (team), nerve ochre (publications), fascia slate (join) — used as thin keys, labels and one flat field per page, never as heavy fills. Artery red is reserved for one thing: what you are on or pointing at (current page, hover, focus). Condensed label face (Archivo Narrow) for labels and captions, plain sans for reading. Figures are framed and numbered (圖 1 / Fig. 1) by CSS counters. Depth from the plate frame and leader lines, never shadows.

STORY: The visitor opens the lab like an atlas: the title plate names the lab, the main figure is the team, leader-line labels point to research, team, publications and joining; each inner page is a plate with its own captioned figures.

FIRST VIEWPORT: A framed title plate — lab name large at top left, other-language name and one sentence beneath, the team photo as Fig. 1 on the right with its caption. Under it, four label rows, each a zone key, the label, the other-language label, a leader line running to the right edge, and the descriptor; this is the navigation.

FORM: Medical anatomy atlas plates; position 5 of 7 on the grounded list; seed key 70ef569e.

SIGNATURE INTERACTION: pointing at a label row lights the plate from inside (the row ground brightens, the leader line draws out to full length and turns artery red, the label turns red). Motion grammar: only the leader line moves (scaleX, short expo ease-out); reduced motion shows the end state without movement.

RAISES: from the paper automata — red only for the element currently active; from the akari light — hover lights the plate from inside, no shadow; from the session sleeve — one flat field per page absorbs reflow (the page sign and the join section).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
