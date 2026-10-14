---
name: TCN Scholarly Editorial System
description: A restrained, high-legibility editorial system for an international scholarly association.
colors:
  ink: '#171310'
  ink-soft: '#2e2a22'
  body: '#2e2a22'
  body-muted: '#5d5647'
  canvas: '#ffffff'
  canvas-soft: '#f7f5f0'
  surface: '#f7f5f0'
  canvas-band: '#f2efe7'
  hairline: '#ddd9d0'
  hairline-strong: '#171310'
  accent: '#0b3d6b'
  accent-hover: '#09507f'
  link: '#0b3d6b'
  link-hover: '#09507f'
  on-primary: '#ffffff'
  footer: '#171310'
  on-footer: '#ffffff'
  danger: '#8a2b1f'
  danger-soft: '#f8ece9'
typography:
  display-hero:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: 60px
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: -0.5px
  display-lg:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: 44px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.01em
  display-md:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  display-sm:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  eyebrow:
    fontFamily: '"Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif'
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 1.2px
  lead:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: 21px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0
  body-serif:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: 0
  body-sans:
    fontFamily: '"Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif'
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontFamily: '"Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif'
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  byline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: 0
  caption:
    fontFamily: '"Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  button:
    fontFamily: '"Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif'
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.2px
rounded:
  none: 0px
  sm: 4px
  full: 9999px
containers:
  prose: 68ch
  page: 75rem
shadows:
  overlay: '0 4px 14px -6px rgb(23 19 16 / 0.14), 0 1px 4px rgb(23 19 16 / 0.08)'
  overlay-dark: '0 4px 14px -6px rgb(0 0 0 / 0.55), 0 1px 4px rgb(0 0 0 / 0.4)'
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button}'
    rounded: '{rounded.sm}'
    padding: '16px 24px'
    height: 48px
  button-outline:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.sm}'
    padding: '16px 24px'
    height: 48px
  text-input:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.body}'
    borderColor: '{colors.hairline-strong}'
    hoverBorderColor: '{colors.ink-soft}'
    focusBorderColor: '{colors.accent}'
    errorBorderColor: '{colors.danger}'
    typography: '{typography.body-sans}'
    rounded: '{rounded.sm}'
    padding: '12px 16px'
    height: 48px
  site-header:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.none}'
    padding: '12px 20px'
    paddingCompact: '12px 16px'
    compactBelow: 1152px
  section-band:
    backgroundColor: '{colors.canvas-band}'
    textColor: '{colors.body}'
    rounded: '{rounded.none}'
    padding: '96px 20px'
    paddingCompact: '48px 16px'
    compactBelow: 640px
  profile-card:
    backgroundColor: '{colors.canvas}'
    textColor: '{colors.body}'
    rounded: '{rounded.none}'
    padding: '32px'
    paddingCompact: '24px 20px 28px'
    compactBelow: 640px
  footer:
    backgroundColor: '{colors.footer}'
    textColor: '{colors.on-footer}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.none}'
    padding: '64px 20px'
    paddingCompact: '48px 16px'
    compactBelow: 640px
---

# Design System: Transcultural Network

## 0. How to use this document

This document has three readers and one order.

The YAML frontmatter above (lines 1-163) is a machine contract. The impeccable skill parses it for its
live design panel and derives `.impeccable/design.json` from it. Do not add keys to it by hand, and do
not change its values except as part of a deliberate token decision recorded in Section 1. Sections 0
through 10 are for people and agents.

Read in order. Sections 1 and 2 come before the token and component sections deliberately. They carry
the decisions and the prohibitions, and a reader who meets the palette first has already absorbed the
defaults before reaching the rules meant to constrain them.

**The Normative Separation Rule.** Sections 1 through 8 and 10 state what must be true. Section 9 states
what is currently true in the code. Never promote a sentence from Section 9 into a normative section
without deciding that it should become a rule. This file was originally generated from the codebase,
which turned every implementation default into a rule; Section 9 exists so that cannot happen again.

**The Regeneration Rule.** `$impeccable document` regenerates this file from code. When it runs,
Sections 0, 1, 2, and 10 must be preserved verbatim: they are hand-authored decisions that cannot be
derived from code. Only Section 9 may be refreshed wholesale. To refresh the sidecar without touching
this file, write `.impeccable/design.json` alone.

## 1. Decisions

Each entry records what was decided, on what evidence, and what was rejected. A choice that is not
recorded here is not a decision; it is an inherited default.

### 1.1 The site has no section labels (2026-08-27)

**Decision.** No eyebrow labels anywhere. The `.eyebrow` class and the `SectionTile` `eyebrow` prop are
removed from the codebase so the pattern cannot return by accident.

**Evidence.** The pattern had 25 render sites across 12 pages, every one of them uppercase, letterspaced,
and set in institutional blue. Individually each label was defensible; together they produced a fixed
label-heading-body cadence that read as rhythm rather than information. An earlier prohibition already
existed in this document and the homepage violated it in six places, which showed that a prose rule
without an enforcement path does not hold.

**What replaced it.** Labels that carried real information were promoted, not deleted. A label that
functioned as a section identifier became an `h2`; a label that described the site rather than a section
became a subtitle. Only labels that repeated their own heading were removed outright.

**Rejected: a cap of one label per page.** It leaves the loudest device in place, requires counting to
enforce, and preserves the underlying error. The labels that justified keeping turned out to be headings
that had been demoted to labels, so promoting them removed the need for a cap at all.

### 1.2 Section surfaces are canvas and soft only (2026-08-27)

**Decision.** `SectionTile` offers two surfaces, `canvas` and `soft`. The `band` variant is removed from
the component. The `--color-canvas-band` token stays, because it serves UI surfaces elsewhere.

**Evidence.** Measured contrast between the three surfaces, computed from the token values with the WCAG
relative luminance formula:

| Pair           | Light  | Dark   |
| -------------- | ------ | ------ |
| canvas to soft | 1.09:1 | 1.13:1 |
| canvas to band | 1.15:1 | 1.07:1 |
| soft to band   | 1.05:1 | 1.05:1 |

Three findings follow. First, soft and band differ by 1.05:1 in both themes, which is not perceptible
across adjacent large areas; the system held two surfaces and a duplicate, not three surfaces. Second,
the ordering inverts between themes: band sits further from canvas in light, soft sits further in dark,
so a section reads as more recessed in one theme and less recessed in the other. Third, none of these
values approaches any contrast threshold, so surface tone cannot carry section separation for the older
readers this site is built for, while still being sufficient to register as alternation during a scroll.
Tone was doing no informational work and all of the rhythmic work.

**Consequence.** Sections are separated by spacing, hairlines, and heading hierarchy. `soft` marks a
genuine exception, never an alternating beat.

**Rejected: keeping three variants and prohibiting alternation in prose.** Removing the tool is more
reliable than adding a rule about it, which 1.1 demonstrated.

### 1.3 The signature element is the record reference (2026-08-27)

**Decision.** Every record carries a reference that names its kind and its key. This is the one place
where the design is allowed to be conspicuous; everything around it stays quiet.

**Why this and not something else.** The North Star already claims this site is a scholarly record, yet
nothing on it identified a record. Referring to a seminar required prose. The reference closes the gap
between what this document declares and what the site does, and it is drawn from what the organisation
actually does rather than from a visual style borrowed elsewhere.

It also replaces a false device. The homepage numbered its Core Activities `01` through `04` from an
array index, imposing sequence on four parallel categories. The reference gives identifiers to things
that have them and removes numbers from things that do not.

**Scope.** References belong to records: seminars, the founding declaration, bylaw articles, and history
entries. They do not belong to categories, activity lists, or member rosters. Applying a reference to a
non-record is the failure mode of this decision.

**Rejected: multilingual pairing.** The strongest link to the subject of the network, but Georgia covers
neither Lao script nor Han characters and Pretendard does not cover Lao, so it requires a webfont
decision that has not been made, and without real translated content it would be decoration.

**Rejected: a place index.** Member countries, seminar locations, and the secretariat exist as data, but
a roster of countries is a common device whose value would rest entirely on execution.

### 1.4 References are spelled out, slash separated, and contextually abbreviated (2026-08-27)

**Decision.** `Seminar / 2025-12-26`, `Founding Declaration / 2025`, `Bylaws / Article 14`,
`History / 2024-11-30`. No three-letter codes in content.

The kind name follows the vocabulary the site shows readers, not internal file names. The history
section is called History on screen, so the reference says History even though the data file is
`organization-milestones.ts`.

**The Contextual Reference Rule.** Do not repeat the kind name where context already supplies it. Inside
a seminar page the reference is `2025-12-26`; the kind appears only in listings and cross-references.
Inside the bylaws the reference is `Article 14`; `Bylaws / Article 14` is the citation form used from
elsewhere. Without this rule the spelled-out kind name repeats on every row and recreates the problem
1.1 removed.

**The Reference Follows the Key Rule.** A reference never invents an identifier. It exposes the key the
system already uses, so uniqueness is inherited rather than designed. Seminars are keyed by date because
their canonical URL is, and a same-day collision would break routing before it broke the reference.
Bylaw articles are keyed by article number and have no date; renumbering on amendment is correct
behaviour for a governing document, and a citation that must be fixed in time carries the amendment
date. Where a data shape allows two records to share a key, the hierarchy must appear in the reference
or the nested record does not get one.

**Typography.** References are set in the sans face with tabular figures in a muted neutral. They are
never set in institutional blue. A blue uppercase identifier is the label of 1.1 returning under a new
name; the signature comes from consistency and coverage, not from colour.

**Rejected: `TCN` prefixed call numbers with middle dots.** More distinctive and better suited to
external citation, but the separator is awkward to type, survives copy and search poorly, and lengthens
every row.

**Rejected: bracketed and colon forms.** Brackets suit scholarly citation but crowd the left edge of a
list; the colon form is the quietest and therefore fails the one requirement this element exists to
meet.

### 1.5 The palette and the display face are undecided

**Status.** Open. Recorded here so that neither is treated as settled.

The warm paper surfaces and the high-contrast serif display face were never chosen; they are what the
code contained when this document was first generated from it. Both are also the most common defaults in
machine-generated editorial design, which means keeping them requires a reason and not merely an absence
of objection.

The stated justification for Georgia, that it avoids another font download, is a cost argument rather
than a design one. A replacement must be evaluated against at least two named candidates with reasons
specific to this association before the current face is kept.

Until this entry is resolved, Section 4 and Section 5 describe the current values without claiming they
are decisions, and no new work may cite them as intent.

## 2. Anti-Defaults

Prohibitions. Section 1 records what this system chose; this section records what it refuses. Every rule
here exists because the refused option is what a competent but unbriefed contributor would produce.

**The Default Test.** If the same brief given to another designer or agent would produce the same
result, that result is a default rather than a choice. Rebuild that part. This test governs the rest of
this section and applies to any decision this document does not cover.

**No section labels.** Covered by 1.1. Neither the class nor the prop exists. Do not reintroduce a small
uppercase label above a heading under any name.

**No inherited palette or display face.** Covered by 1.5. Warm paper surfaces and a serif display face
are current values, not settled intent. Do not cite them as the system's identity, and do not extend
them to new surfaces on the assumption that they are permanent.

**No ordinal markers on unordered content.** Numbers are permitted only where order carries information
the reader needs, such as bylaw articles or a dated sequence. An array index is not a sequence. This
applies regardless of styling: a muted caption ordinal is the same device as a blue one.

**No alternating section surfaces.** Covered by 1.2. Section height and structure follow their content.
A page whose sections all repeat one label-heading-body shape at one interval has failed, even when
every individual section is defensible.

**One conspicuous element.** The record reference of 1.3 is that element. Everything else stays quiet.
Cut decoration that does not serve the content, and do not add a second device competing for the same
attention.

**The One Blue Rule.** Do not introduce a second brand hue. Institutional blue marks links, active
state, focus, and selection; its restraint is the identity. It never marks metadata, identifiers, or
section labels.

**The Two Voices Rule.** Serif carries scholarship and narrative. Sans-serif carries wayfinding,
metadata, status, and controls. Never create a third display voice.

**The Honest Floor Rule.** New readable copy uses 14px or larger. The existing 11px to 13px labels are
short, bold, and local; do not copy them into paragraphs, navigation, captions, or form help.

**The Flat-by-Default Rule.** A surface in document flow stays flat. Shadows are reserved for layers that
physically overlap other content.

**The Grounded Component Rule.** A component in document flow earns separation through spacing, tone, or
a hairline. Do not turn every section, profile, or list item into a rounded card.

**The Record, Not Dashboard Rule.** Public pages read as edited scholarship, never as a SaaS dashboard, a
marketing template, or a set of interchangeable cards.

**The Public Theme Boundary Rule.** Dark-mode guidance applies to public pages only, until the admin
layout gains its own theme bootstrap and control.

**No invented tokens.** Do not add tokens or components that are absent from the codebase. Cite the
actual utility or pixel value rather than a named step that does not exist. Spacing comes from
Tailwind's numeric scale; there are no `--spacing-*` tokens.

**No gradients, glassmorphism, or decorative background effects.** No decorative blobs, wavy dividers, or
floating shapes. A section that feels empty needs better content, not ornament.

## 3. North Star

**"The Scholarly Record."**

TCN reads as a carefully edited institutional record: calm enough for sustained reading, formal without
ceremony, and contemporary without looking like a software product. Hierarchy comes from ruled divisions,
whitespace, and type scale rather than decorative chrome. Records are identifiable, which is what the
reference of 1.3 provides.

The public site serves an international scholarly association and is intentionally English-first. Its
large body type, strong contrast, generous line height, and broad touch targets support older readers
without turning accessibility into a separate visual mode. The authoring interface uses the same type,
colour, and border vocabulary at a denser rhythm. Danger colours belong to failure and validation
feedback, in authoring states and public form errors, and never to public branding or decoration.

The system is responsive where its content changes, not at three artificial device classes. The type
scale and section spacing compact below 640px; navigation becomes a menu below 896px; content grids
reorganise primarily at 1024px; and the header gains its most spacious treatment at 1152px. Two narrower
thresholds belong to specific galleries rather than the whole layout: the milestone gallery takes a
second column at 576px, and the director grid and event record grid take an extra column at 768px. No
single threshold governs every component.

Public pages cap at 1200px. The standard narrative measure is 68ch; leads and hero paragraphs tighten to
60ch to 62ch and full academic documents widen to 74ch to 76ch, so the shipped range is 60ch to 76ch with
68ch as the default. Document pages use the shared two-column shell only when they supply an aside; a
document without an aside remains a centred reading column.

Public pages support a warm dark theme. Scroll-entry motion is progressive enhancement: content is
visible without JavaScript, moves only four pixels when enhanced, and becomes immediate when the reader
requests reduced motion.

Note on scope: this section describes the system's posture. It does not fix the palette or the display
face, which are open under 1.5.

## 4. Colours

Current values. Not a decision until 1.5 is resolved.

The palette is ink on paper with one institutional blue. Colour never substitutes for hierarchy or
meaning.

### Primary

- **Institutional Blue** (`{colors.accent}`): links, active navigation, selection, and default focus
  rings. Hover and pressed states use `{colors.accent-hover}`. It no longer marks section labels, which
  do not exist, and it must not mark record references.
- **Warm Ink** (`{colors.ink}`): headings, wordmark, primary buttons, and strong structural rules.

### Neutral

- **Reading Canvas** (`{colors.canvas}`): the default page and field surface, and the default
  `SectionTile` surface.
- **Soft Paper** (`{colors.canvas-soft}`): the one exceptional section surface, plus quiet grouping,
  hover feedback, and grounded callouts. `{colors.surface}` is its CSS alias, reserved for media
  placeholder surfaces such as gallery figures while images load.
- **Band Paper** (`{colors.canvas-band}`): UI surfaces only. Hover and disabled fills, progress tracks,
  badges, placeholders, and notice boxes. It is no longer a section surface, per 1.2.
- **Body Ink** (`{colors.body}`): long-form copy. `{colors.ink-soft}` is the matching softened strong
  neutral for active or hover surfaces.
- **Muted Umber** (`{colors.body-muted}`): dates, captions, countries, secondary metadata, and record
  references.
- **Warm Hairline** (`{colors.hairline}`): subtle dividers and field boundaries.
  `{colors.hairline-strong}` marks sticky headers, emphasised rules, and outline controls.
- **Permanent Footer Ink** (`{colors.footer}`): the always-dark footer surface. `{colors.on-footer}`
  remains white in both public themes.

### Authoring State

- **Oxblood Danger** (`{colors.danger}`): failed publishing states, the post-level destructive action,
  and public form validation errors.
- **Danger Wash** (`{colors.danger-soft}`): the background of failure feedback.

### Public Dark Theme

| Role                      | Light     | Dark      |
| ------------------------- | --------- | --------- |
| canvas                    | `#ffffff` | `#181715` |
| canvas-soft               | `#f7f5f0` | `#24221f` |
| canvas-band               | `#f2efe7` | `#1f1e1b` |
| ink                       | `#171310` | `#e6e2da` |
| ink-soft / body           | `#2e2a22` | `#d1cbbd` |
| body-muted                | `#5d5647` | `#928b7d` |
| accent / link             | `#0b3d6b` | `#8bb2d9` |
| accent-hover / link-hover | `#09507f` | `#a3c5e8` |
| hairline                  | `#ddd9d0` | `#383530` |
| hairline-strong           | `#171310` | `#e6e2da` |
| on-primary                | `#ffffff` | `#181715` |
| footer                    | `#171310` | `#12110f` |
| danger                    | `#8a2b1f` | `#e79a8c` |
| danger-soft               | `#f8ece9` | `#2b201d` |

**Interactive State Hierarchy.** Current navigation and selected tabs use institutional blue with an
accent underline. Pointer hover stays neutral: warm ink on Soft Paper, with a strong-ink underline where
the control has a tab edge. This keeps hover distinct from selection in both themes instead of making
every interactive state look current. Icon-only theme controls follow the same neutral hover treatment;
their pointer cursor, surface change, and persistent boundary provide the affordance.

**Link Affordance by Context.** Persistent underlines are reserved for links embedded in prose, contact
values, downloadable filenames, and literal URLs. These links remain identifiable without relying on
colour alone. Structured navigation, tables of contents, tabs, cards, and standalone actions do not use
resting text underlines. Their affordance comes from grouping, position, labels, neutral hover surfaces,
focus rings, and current-state indicators. Header and tab bottom borders are structural state indicators,
not text decoration. Standalone text actions may reveal an underline on hover, while buttons and
administrative action controls never use underlines.

## 5. Typography

Current values. The display face is open under 1.5.

**Display and Narrative Font:** Georgia, with Times New Roman and generic serif fallbacks.

**Structure and Interface Font:** Pretendard Variable, with Pretendard and system UI fallbacks.

**Character.** Pretendard keeps navigation, metadata, controls, and dense authoring surfaces direct and
legible. The contrast between the families is functional, not decorative. The serif face currently in use
carries scholarship and narrative; its selection is unresolved under 1.5, and the argument that it avoids
a font download is a cost argument recorded there rather than a reason belonging here.

### Hierarchy

- **Display Hero** (600, 60px, 1.12): standard interior-page covers at 640px and above.
- **Display Large** (600, 44px, 1.15): major page and section headings. Compacts to 36px below 640px.
- **Display Medium** (600, 32px, 1.2): subsection and feature headings. Compacts to 28px below 640px.
- **Display Small** (600, 26px, 1.25): card and profile names. Compacts to 22px below 640px.
- **Lead** (400, 21px, 1.7): introductory narrative. Compacts to 19px below 640px.
- **Body Serif** (400, 18px, 1.75): default public body and academic prose. Compacts to 17px/1.7 below
  640px, both size and line height, so the utility and the `body` element agree. Keep normal narrative
  measure at 68ch.
- **Body Sans** (400, 17px, 1.6): UI descriptions, tables, form content, and navigation when space
  permits. Weight 700 creates strong labels; there is no separate strong-body token.
- **Body Small** (400, 15px, 1.6): compact navigation and secondary interface text.
- **Caption** (400, 14px, 1.5): captions and metadata, frequently combined with bold uppercase styling.
- **Button** (700, 17px, 1.2): primary action labels.
- **Byline** (600, 15px, 1.6): a narrowly used serif metadata role.

The Eyebrow role is retired. Its type token remains in the frontmatter and in `global.css` with no
consumer; removing it is a token change and belongs to the work that resolves 1.5.

**Record references** use Body Small or Caption in the sans face with `tabular-nums` and Muted Umber, per
1.4. They are never set in accent colour and never in uppercase display treatment.

The shared scale bottoms out at 14px. Existing sub-14px labels are contained exceptions listed in Section
9, not reusable tokens.

## 6. Layout and Section Rhythm

### Section Surfaces

`SectionTile` supplies two grounded surfaces: reading canvas and soft paper. Sections use 48px vertical
padding below 640px and 96px from 640px upward, with 16px/20px side padding. They are full-width bands,
not cards.

`canvas` is the default. `soft` marks a section that genuinely differs in kind, and its use must be
justifiable in one sentence. Two adjacent `soft` sections, or a repeating canvas-soft-canvas cadence,
violate 1.2 regardless of how each section looks alone.

Section separation is carried by spacing, hairlines, and heading hierarchy. Every section has a heading;
a section whose only identifier is a small label is the pattern 1.1 removed.

### Reading Containers

Standard page content caps at 1200px. The 68ch default is `--container-prose`, which backs Tailwind's
`max-w-prose`. Academic documents widen to 74ch, and the bylaws introduction to 76ch. Bylaws and the
founding invitation supply a 256px aside and therefore use the shared two-column desktop shell. The
declaration supplies no aside and renders as a centred single column. Shorter prose and community
questions use 68ch, while page leads and hero paragraphs tighten to 60ch to 62ch.

Reading measures are expressed in `ch`, never in `rem`. A rem measure does not track the type scale, so
it drifts against the 60ch to 76ch range at the 640px compaction. `max-w-[75rem]` is the page cap and is
not a reading measure.

## 7. Components

### Navigation

The site uses one sticky header, not separate masthead and navigation bands. The serif wordmark sits on
the left; sans-serif navigation, the public theme control, and the ink-filled Join / Contact action
occupy the right. Top-level controls are at least 48px high. Dropdown and mobile child links use the 44px
compact floor. Desktop navigation appears at 896px; below that threshold the header opens a
scroll-contained mobile menu. At 1152px the full wordmark suffix, larger type, and wider spacing appear.

Desktop top-level navigation keeps the full 73px header hit area so its active underline sits directly
over the header's bottom rule. Neutral hover fill remains a centred 48px-high surface rather than filling
the entire header. The Join / Contact action also remains centred at 48px. Q&A status tabs use the same
edge-aligned underline pattern; on desktop their shared hairline continues beneath the result count,
while on smaller screens it stays with the horizontally scrollable tab row.

The dropdown is a true overlay: canvas background, strong hairline border, 4px-free square geometry, and
the single overlay shadow. Active and expanded states use institutional blue. The mobile menu is a
grounded continuation of the header and therefore has no shadow.

### Buttons

- **Shape:** lightly softened rectangle (4px radius), never a pill.
- **Primary:** warm ink fill, on-primary label, 24px horizontal padding, 48px minimum height. Hover
  shifts to softened ink; public pagination may use institutional blue for the selected page.
- **Outline:** canvas fill, strong hairline border, warm ink label, 48px minimum height. Hover uses soft
  paper.
- **Focus:** a 2px institutional-blue outline offset by 2px. Controls on dark surfaces use a light ring
  derived from the surface text colour.
- **Motion:** colour transitions are brief. Reduced-motion users receive immediate state changes.

### Inputs and Fields

Fields use a canvas background, a one-pixel structural border, square-to-4px corners, 12px/16px internal
padding, and sans-serif content. Primary form controls are 48px high; denser authoring fields may use the
44px floor. Validation and publish failure use oxblood and danger wash. Placeholder and help text must
retain readable contrast against the current surface.

Public Q&A text fields use the strong hairline at rest, softened ink on hover, and one visually
continuous two-pixel institutional-blue inset boundary on focus. The inset treatment replaces the global
offset focus ring for those fields, so focus does not create a double border or change layout. Invalid
fields use the danger border while unfocused; when focused, the blue focus boundary takes precedence
while `aria-invalid` and the adjacent danger message continue to communicate the error.

Third-party form widgets must be told the site theme explicitly. The public theme is a manual
`html.dark` class, so a widget left on its own `prefers-color-scheme` default renders in the wrong theme
whenever the reader's choice differs from their OS. The Turnstile widget therefore has `data-theme` set
from the site theme before `api.js` loads, and re-renders on the `tcn:themechange` event the theme
control dispatches.

### Record References

A reference names a record's kind and key, per 1.3 and 1.4. It sits above or beside the record's heading,
set in the sans face with tabular figures in Muted Umber, and it is never the only identifier a section
has. Bylaw article numbers are references and take plain typographic treatment; they are not enclosed in
decorative shapes.

### Profile Cards

`MemberProfileCard` is a square, borderless canvas cell inside a hairline-separated grid. It has no
avatar and no individual drop shadow. A muted country and the officer role lead into the serif name,
current position, summary, highlights, and bordered expertise tags. Leadership and support tiers become
two columns at 1024px. Directors become two columns at 768px and three at 1024px.

### Media and Lightbox

Media triggers are full-width, borderless buttons around fixed-aspect imagery. Hover-capable devices
reveal a dark caption hint; touch devices show it persistently. Video posters use the permanent dark
surface and a circular play mark. The lightbox is the elevated modal layer and supplies high-contrast
focus rings, keyboard controls, captions, and immediate reduced-motion behaviour.

### Publish Bar and Authoring Feedback

The sticky publish bar derives seven phases from `draft`, `saving`, `failed`, `partial`, `published`,
`dirty`, and `live`. Selected media always remains staged until Save or Create, regardless of whether the
post already exists. The published-state controls include the public URL, Copy link, and post-level
Delete when a post exists. The one-action publish banner draws its confirmation over 450ms and fades in
over 200ms; failure uses the danger wash. Both become immediate under `prefers-reduced-motion`.

## 8. Elevation, State, Motion, and Accessibility

TCN is flat by default. Surface tone, spacing, and one-pixel rules establish depth. Standard content
cards do not float and do not combine borders with decorative shadows. The only shared shadow is
`--shadow-overlay`, used by the desktop navigation menu and other genuinely floating layers.

`--shadow-overlay` is theme-aware. The warm-ink shadow contributes nothing over the dark canvas, so the
dark theme substitutes a blacker, stronger overlay and elevation reads in both themes. This is the one
token whose value differs by theme beyond the colour table.

### Shadow Vocabulary

- **Grounded Surface:** no shadow; use canvas or soft paper plus whitespace.
- **Hairline Separation:** a 1px warm hairline for lists, fields, media, and internal divisions.
- **Strong Rule:** a 1px ink rule for sticky boundaries and emphasised structure.
- **Floating Overlay:** the shared overlay shadow plus a strong hairline border for dropdowns and
  transient floating layers.

### Status, Motion, and Accessibility

Status badges may use a full pill because they are compact labels, not containers. Global focus uses a
2px outline with a 2px offset. Public content sections after the hero may reveal through a 700ms,
four-pixel upward transition only when JavaScript has opted in; content remains visible when JavaScript
fails. Reduced motion disables the transition. The back-to-top control and primary actions are 48px
square or high; secondary link targets may use the 44px floor. The back-to-top control hovers to softened
ink like every other primary button; blue fill belongs to the status badge and the selected pagination
page, not to hover.

Heading levels must not skip. A section that renders an `h3` requires an `h2` above it in the same
section, because assistive technology reads the outline rather than the visual weight.

**The Reveal Threshold Rule.** The reveal observer must use `threshold: 0` and let `rootMargin` decide
the entry point. A ratio threshold cannot be met by a section taller than roughly `root / threshold`, so
long sections, such as the About milestone record that grows with every seminar, would stay at
`opacity: 0` forever while remaining in the accessibility tree. Progressive enhancement must never be
able to subtract content.

In-page anchors and sticky asides share one offset. The header is 73px, so anchor targets use
`scroll-mt-24` and sticky asides use `top-24` (96px) everywhere; the mobile menu's height budget
subtracts both the header and `env(safe-area-inset-top)`.

## 9. Current State

Observations about the code as it stands. Nothing here is a rule. Per the Normative Separation Rule in
Section 0, a line moves out of this section only by an explicit decision recorded in Section 1.

### Known deviations

- `--text-eyebrow` in the frontmatter and in `global.css` has no consumer after 1.1. Its removal is a
  token change deferred with 1.5.
- `--container-page` (75rem) names the 1200px page cap but is unreferenced; all call sites hardcode
  `max-w-[75rem]` instead of the `max-w-page` utility the token generates.
- The Display Hero 42px compaction below 640px is defined but unreachable, because every shipped usage is
  `sm:`-prefixed. Those covers fall back to Display Large.
- The homepage lead bypasses the Lead token with a hardcoded 21px/1.6, so it neither takes the 1.7 line
  height nor compacts.
- The homepage title uses a bespoke 28px/32px pair, and the alternate name 22px/26px when populated.
- The header wordmark is 18px rising to 22px at 1152px, and the footer wordmark is 22px. These two are
  brand decisions outside the type scale.
- `MemberProfileCard` carries a 16px/1.75 summary and 15px/1.65 highlights, plus weights 750 and 650
  outside the documented 400/600/700 set. Local to that card.
- Sub-14px labels in use: profile expertise tags at 12px and the profile current-position label at 11px.
- Media deletion uses the accent treatment even though it is destructive. Do not infer a universal rule
  that all delete actions are danger.
- `--color-canvas-soft` and `--color-canvas-band` are both used as section surfaces and as UI surfaces,
  so the two tokens do not carry separated meanings. 1.2 removed band from sections but did not resolve
  the token semantics.
- The admin layout has no theme bootstrap or theme control, which is why the Public Theme Boundary Rule
  exists.

### Content and data

- `members.json` holds 7 members across 6 distinct countries. The homepage figure was corrected from 15
  to 6 on 2026-08-27 to match.
- `organization-milestones.ts` contains a parent entry and a nested stage that share the date
  `2024-11-30`, so a date-only history reference is ambiguous there. See the Reference Follows the Key
  Rule in 1.4.

### Absent tokens and components

`primary`, `body-sans-strong`, `story-card`, `story-row`, and `officer-card` are not part of this system.
There are no `--spacing-*` tokens; spacing comes from Tailwind's numeric scale.

## 10. Enforcement

Rules in Sections 1 and 2 that can be checked mechanically are checked by
`scripts/verify-design-defaults.mjs`, run as `npm run verify:design`. It sits alongside `a11y.mjs` and
`motion.mjs`. Routing contracts stay in `verify.mjs`, which is a different concern.

Checks:

1. **No section labels.** The `.eyebrow` class does not exist in `global.css` and no component declares an
   `eyebrow` prop. Presence of either fails.
2. **Two section surfaces.** The `SectionTile` variant map contains exactly `canvas` and `soft`.
3. **No ordinal markers from indices.** No component derives a displayed number from an array index.
4. **Heading levels do not skip.** Every rendered `h3` has an `h2` ancestor section.
5. **Reference colour.** No record reference is styled with an accent or link colour token.
6. **No new decorative effects.** No gradient, backdrop-filter, or border-radius above the 4px token
   enters the public stylesheet.

A rule that cannot be checked mechanically stays a prose rule, and the Default Test in Section 2 remains
the reviewer's instrument.
