# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Editors**: nursing faculty (lab PIs) and their lab members who are not web developers. They keep their own lab website current — research areas, members, publications, news — without git, code or a designer.
- **Visitors of the lab sites** (confirmed 2026-10-06):
  - prospective students (master's, PhD, nurse-practitioner trainees) choosing an advisor: they want the research direction, the people and what joining the lab is like;
  - collaborators and reviewers (other scholars, grant panels, industry partners): they want to confirm capability quickly — publications, projects, the PI's profile.

## Product Purpose

LabSite Studio is a research-lab website platform: a lab starts from a template (or imports an existing static site), edits it visually, keeps versions, and publishes. Long-term goal: offer it to nursing departments as a self-edited lab-site platform — freer than Google Sites, with stronger AI assistance.

## Positioning

Sites are plain static HTML that follows a documented markup convention (`docs/markup-convention.md`). No static-site generator, no schema; saving changes only the nodes that were edited, so the git diff is exactly the edit. Templates and section-library snippets are themselves convention-compliant HTML, edited by the same engine.

## Operating Context

- Editor: LabSite Cloud on Cloudflare Workers + D1 (invite-link sign-in, versions, publish), plus GitHub/folder modes for developers.
- Each lab site carries its own section library at `labsite/library.json` + `labsite/sections/*.html`.
- Sites are bilingual: `x.html` (zh-Hant) and `en/x.html` (English) share the same structure.
- Site-level strings live in `js/data.js` `const SITE = {…}` (double-quoted, single-line values), editable in the editor.

## Capabilities and Constraints

- Editable units: body-direct `<section>`s; repeated items are siblings with the same tag + class; only `src`, `alt`, `href`, `title` attributes are editable.
- Theme must be adjustable per lab through CSS custom properties; templates must look right with any lab's content length (long Chinese titles, many members, long publication lists).
- Animations: light only; must respect `prefers-reduced-motion`. Heavy WebGL/Three.js is optional, never required for content.
- Third-party material must be MIT/BSD/Apache/CC0 or CC BY with attribution; no NC licenses, no paid-template redistribution.

## Brand Commitments

Templates are **brand-neutral** (confirmed 2026-10-06): no school or department identity baked in; each lab adjusts color and type itself. This also keeps the platform sellable to other schools.

## Evidence on Hand

- Two real lab sites (sung-lab-website, ycho-lab-website) imported and live; they are bespoke, not template-based.
- Fictional demo lab "知行研究室" is used for placeholder content. No real testimonials, customers or metrics exist; do not fabricate them.

## Product Principles

1. The visitor's question comes first: who is this lab, what do they study, can I join or work with them.
2. Editing must never break the site: every template element maps to an editable field or a library section.
3. Neutral by default, personal by theme: structure is shared, identity is the lab's.
4. Static, fast and durable: a published site works without the platform.

## Accessibility & Inclusion

WCAG 2.1 AA for templates (confirmed 2026-10-06): contrast, keyboard navigation, alt text, visible focus, reduced-motion support.
