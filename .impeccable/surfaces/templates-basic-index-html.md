---
version: 1
slug: "templates-basic-index-html"
primary_target: "templates/basic/index.html"
related_targets: ["templates/basic"]
---

# Template "導引" (basic) — lab website template

Scope: the whole template site `templates/basic/` (index, research, members, publications, contact; zh + en) and its section library. Mode: Persuade (a prospective student or reviewer decides to read on, apply or collaborate).

Audience and job: prospective students choosing an advisor; collaborators and reviewers confirming capability. They need: who the lab is, what it studies, who the people are, what it published, how to join or contact.

Constraints: LabSite markup convention (body-direct sections, repeated items share tag + class, only src/alt/href/title editable); brand-neutral, re-themable by CSS custom properties; bilingual zh/en pages with identical structure; WCAG 2.1 AA; placeholder content is the fictional 知行研究室 and every placeholder image says it must be replaced.

## Direction contract

THESIS: The lab site is a wayfinding program. Every page answers "where do I go next" with full-width zone bands and bilingual sign typography. It refuses the stock university-lab page: big photo hero, then a grid of identical icon cards.

OWN-WORLD: Signage-white plates on a cool wall gray, near-black ink, and four zone colours (research, team, publications, join) that each own whole bands and colour their own pages; one amber "you are here" mark for the current page and focus. Flat planes only: no shadows, depth by plates overlapping. Sign type: heavy Chinese label with the other language set smaller beneath, as on Taiwanese hospital signs. Arrows are the only icon family; wayfinding pictograms stand in for missing photos.

STORY: The visitor reads the lab name like a building directory, picks a zone, follows its colour onto that page, finds the PI, research, publications and how to join.

FIRST VIEWPORT: Left, the lab name as a large ink sign plate with one sentence of purpose; right, the team photo slot. Below, four stacked full-width zone bands — label, other-language label, one-line descriptor, arrow — the directory is the navigation. Header nav repeats the zones as small colour-keyed plates with the amber current-page mark.

FORM: Hospital and campus wayfinding signage program; position 4 of 7 on the grounded list; seed key bf9ba3eb.

SIGNATURE INTERACTION: hovering or focusing a zone band lights it left to right in its zone colour, each label turning as the fill reaches it, then the arrow advances, like a directional sign switching on. Motion grammar: one load sequence (directory bands settle in order), short exponential ease-out, nothing else moves; reduced motion shows everything static.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Theme editor UI for the zone colours (next phase).
- Real photos: every lab replaces the pictogram plates.
