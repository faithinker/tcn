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

## Overview

**Creative North Star: "The Scholarly Record"**

TCN should feel like a carefully edited institutional record: calm enough for sustained reading, formal
without ceremony, and contemporary without looking like a software product. Georgia carries scholarship
and narrative; Pretendard carries navigation, metadata, and authoring controls. Near-black ink, a single
institutional blue, warm paper surfaces, and ruled divisions create hierarchy without decorative chrome.

The public site serves an international scholarly association and is intentionally English-first. Its
large body type, strong contrast, generous line height, and broad touch targets support older readers
without turning accessibility into a separate visual mode. The authoring interface uses the same type,
color, and border vocabulary at a denser rhythm; danger colors belong to failure and validation
feedback — authoring states and public form errors — never to public branding or decoration.

The system is responsive at the points where its content changes, not at three artificial device classes.
The type scale and section spacing compact below 640px; the navigation changes to a menu below 896px;
content grids reorganize primarily at 1024px; and the header gains its most spacious treatment at 1152px.
Two narrower thresholds belong to specific galleries and grids rather than the whole layout: the milestone
gallery takes a second column at 576px, and the director grid and event record grid take an extra column
at 768px. No single threshold governs every component.
Public pages cap at 1200px. The standard narrative measure is 68ch; leads and hero paragraphs tighten to
60–62ch and full academic documents widen to 74–76ch, so the shipped range is 60ch to 76ch with 68ch as
the default. Document pages use the shared two-column shell only when they supply an aside; a document
without an aside remains a centered reading column.

Public pages support a warm dark theme. The admin layout currently remains light because it has neither
the public theme bootstrap nor the theme control. Scroll-entry motion is progressive enhancement:
content is visible without JavaScript, moves only four pixels when enhanced, and becomes immediate when
the reader requests reduced motion.

**Key Characteristics:**

- Serif narrative and sans-serif structure, with no webfont dependency for the serif voice.
- Restrained palette: ink, paper, one institutional blue, plus danger feedback for failed states and form validation.
- Flat surfaces separated by tone, whitespace, and one-pixel rules.
- Desktop body copy at 18px/1.75, with 68ch as the standard reading measure and named 60–62ch and
  74–76ch exceptions.
- Primary controls at 48px; compact secondary controls respect a 44px touch-target floor.
- Responsive behavior driven by real content thresholds at 576px, 640px, 768px, 896px, 1024px, and
  1152px, several of which are component-local rather than global.

**The Record, Not Dashboard Rule.** Public pages must read as edited scholarship, never as a SaaS
dashboard, marketing template, or collection of interchangeable cards.

## Colors

The palette is ink on paper with one institutional blue. Warm neutrals soften long reading sessions;
color never substitutes for hierarchy or meaning.

### Primary

- **Institutional Blue** (`{colors.accent}`): links, active navigation, section labels, selection, and
  default focus rings. Hover and pressed states use `{colors.accent-hover}`.
- **Warm Ink** (`{colors.ink}`): headings, wordmark, primary buttons, and strong structural rules.

### Neutral

- **Reading Canvas** (`{colors.canvas}`): the default page and field surface.
- **Soft Paper** (`{colors.canvas-soft}`): quiet grouping, hover feedback, and grounded callouts.
  `{colors.surface}` is its CSS alias (`--color-surface` resolves to `--color-canvas-soft` in both
  themes), reserved for media placeholder surfaces such as gallery figures while images load.
- **Band Paper** (`{colors.canvas-band}`): alternating full-width sections and selected status surfaces.
- **Body Ink** (`{colors.body}`): long-form copy. `{colors.ink-soft}` is the matching softened strong
  neutral for active or hover surfaces.
- **Muted Umber** (`{colors.body-muted}`): dates, captions, countries, and secondary metadata.
- **Warm Hairline** (`{colors.hairline}`): subtle dividers and field boundaries.
  `{colors.hairline-strong}` marks sticky headers, emphasized rules, and outline controls.
- **Permanent Footer Ink** (`{colors.footer}`): the always-dark footer surface.
  `{colors.on-footer}` remains white in both public themes.

### Authoring State

- **Oxblood Danger** (`{colors.danger}`): failed publishing states, the post-level destructive action, and
  public form validation errors (the Q&A submission form).
- **Danger Wash** (`{colors.danger-soft}`): the background of failure feedback.
- Media deletion currently uses the accent treatment even though it is destructive. Do not infer a
  universal "all delete actions are danger" rule from the post publish bar.

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

**The One Blue Rule.** Do not introduce a second brand hue. Institutional blue is used for links,
labels, active state, focus, and selection; its restraint is the identity.

**Interactive State Hierarchy.** Current navigation and selected tabs use institutional blue with an
accent underline. Pointer hover stays neutral: warm ink on Soft Paper, with a strong-ink underline
where the control has a tab edge. This keeps hover distinct from selection in both themes instead of
making every interactive state look current. Icon-only theme controls follow the same neutral hover
treatment; their pointer cursor, surface change, and persistent boundary provide the affordance.

**The Underlined Ink Link Rule.** Blue is not the only way to mark a link, and on link-dense
surfaces it stops being restraint. Where a set of sibling links sits next to a current-position
marker — the related-documents nav and the bylaws table of contents — the resting links use warm ink
plus an underline, and blue is reserved for the one entry that is current (`aria-current`). Hover
thickens the underline rather than shifting hue. Contact details follow the same rule: the telephone
and email links are real `tel:`/`mailto:` targets in ink with an underline, and the footer's email
link uses `on-footer` with an underline because the footer is permanently dark. Never mark a
non-navigable current item in blue while its navigable siblings are muted grey — that inverts the
affordance.

**The Public Theme Boundary Rule.** Dark-mode guidance applies to public pages only until the admin
layout gains its own theme bootstrap and control.

## Typography

**Display and Narrative Font:** Georgia, with Times New Roman and generic serif fallbacks

**Structure and Interface Font:** Pretendard Variable, with Pretendard and system UI fallbacks

**Character:** Georgia gives the association a durable, bookish voice without another font download.
Pretendard keeps navigation, metadata, controls, and dense authoring surfaces direct and legible. The
contrast between the families is functional, not decorative.

### Hierarchy

- **Display Hero** (600, 60px, 1.12): standard interior-page covers at 640px and above. A 42px
  compaction is defined for below 640px, but every shipped usage is `sm:`-prefixed, so no page renders
  Display Hero under 640px and the override is currently unreachable — latent, not live. Those covers
  fall back to Display Large instead. The long homepage title intentionally uses a smaller bespoke
  28px/32px scale.
- **Display Large** (600, 44px, 1.15): major page and section headings. It compacts to 36px below 640px.
- **Display Medium** (600, 32px, 1.2): subsection and feature headings. It compacts to 28px below 640px.
- **Display Small** (600, 26px, 1.25): card and profile names. It compacts to 22px below 640px; compact
  director cards use a deliberate 24px variant.
- **Lead** (400, 21px, 1.7): introductory narrative. It compacts to 19px below 640px. The homepage lead
  bypasses the token with a hardcoded 21px/1.6 (`index.astro:47`) and so neither takes the 1.7 line
  height nor compacts — a known deviation, not a second lead style.
- **Body Serif** (400, 18px, 1.75): default public body and academic prose. It compacts to 17px/1.7
  below 640px — both the size and the line-height token compact, so the utility and the `body`
  element agree. Keep normal narrative measure at 68ch; every shipped body paragraph is bounded.
- **Body Sans** (400, 17px, 1.6): UI descriptions, tables, form content, and navigation when space
  permits. Weight 700 creates strong labels; there is no separate strong-body token.
- **Body Small** (400, 15px, 1.6): compact navigation and secondary interface text.
- **Eyebrow** (700, 15px, 1.3, uppercase): the reusable blue section label. Below 640px it becomes
  13px with 0.08em tracking.
- **Caption** (400, 14px, 1.5): captions and metadata, frequently combined with bold uppercase styling.
- **Button** (700, 17px, 1.2): primary action labels.
- **Byline** (600, 15px, 1.6): a narrowly used serif metadata role, not the officer-role treatment.

The shared scale bottoms out at 14px, but the current implementation has three intentional compact
exceptions: the mobile eyebrow at 13px, profile expertise tags at 12px, and the profile current-position
label at 11px. Treat these as contained exceptions, not reusable text tokens. Bylaw clause-number badges
also use a local 12px label.

Two further off-scale sizes are brand rather than type-scale decisions and are deliberate: the header
wordmark at 18px, rising to 22px at 1152px (`Header.astro:31, 34`), and the footer wordmark at 22px
(`Footer.astro:22`). The homepage carries a bespoke pair — the title at 28px/32px and, when populated,
the alternate name at 22px/26px (`index.astro:42`). No other component may introduce an off-scale
display size; use `display-sm` where a 26px/22px heading is wanted.

`MemberProfileCard` carries two further off-scale serif sizes that sit above the floor but outside the
named roles: the profile summary at 16px/1.75 (`MemberProfileCard.astro:82`) and profile highlights at
15px/1.65 (`:91`). It also uses two font weights outside the documented 400/600/700 set — 750 on the
current-position label (`:71`) and 650 on expertise tags (`:118`). These are existing exceptions local to
the profile card; do not treat them as new tokens or propagate them to other components.

**The Two Voices Rule.** Serif carries scholarship and narrative. Sans-serif carries wayfinding,
metadata, status, and controls. Never create a third display voice.

**The Honest Floor Rule.** New readable copy must use 14px or larger. Existing 11–13px labels are
short, bold, and local; do not copy them into paragraphs, navigation, captions, or form help.

## Elevation

TCN is flat by default. Surface tone, spacing, and one-pixel rules establish depth. Standard content
cards do not float and do not combine borders with decorative shadows. The only shared shadow is
`--shadow-overlay`, the restrained overlay used by the desktop navigation menu and other genuinely
floating layers: `0 4px 14px -6px rgb(23 19 16 / 0.14), 0 1px 4px rgb(23 19 16 / 0.08)`.

`--shadow-overlay` is theme-aware. The warm-ink shadow above contributes nothing over the dark
canvas, so the dark theme substitutes a blacker, stronger overlay
(`0 4px 14px -6px rgb(0 0 0 / 0.55), 0 1px 4px rgb(0 0 0 / 0.4)`) and elevation reads in both themes.
This is the one token whose value differs by theme beyond the color table.

### Shadow Vocabulary

- **Grounded Surface:** no shadow; use canvas, soft paper, or band paper plus whitespace.
- **Hairline Separation:** a 1px warm hairline for lists, fields, media, and internal divisions.
- **Strong Rule:** a 1px ink rule for sticky boundaries and emphasized structure.
- **Floating Overlay:** the shared overlay shadow plus a strong hairline border for dropdowns and
  transient floating layers.

**The Flat-by-Default Rule.** If a surface is part of document flow, it stays flat. Shadows are reserved
for layers that physically overlap other content.

## Components

### Navigation

The site uses one sticky header, not separate masthead and navigation bands. The serif wordmark sits on
the left; sans-serif navigation, public theme control, and the ink-filled "Join / Contact" action occupy
the right. Top-level controls are at least 48px high. Dropdown and mobile child links use the 44px compact
floor. Desktop navigation appears at 896px; below that threshold the header opens a scroll-contained
mobile menu. At 1152px the full wordmark suffix, larger type, and wider spacing appear.

The dropdown is a true overlay: canvas background, strong hairline border, 4px-free square geometry, and
the single overlay shadow. Active and expanded states use institutional blue. The mobile menu is a
grounded continuation of the header and therefore has no shadow.

### Buttons

- **Shape:** lightly softened rectangle (4px radius), never a pill.
- **Primary:** warm ink fill, white/light on-primary label, 24px horizontal padding, and a 48px minimum
  height. Hover shifts to softened ink; public pagination may use institutional blue for the selected page.
- **Outline:** canvas fill, strong hairline border, warm ink label, and a 48px minimum height. Hover uses
  soft paper.
- **Focus:** a 2px institutional-blue outline offset by 2px. Controls on dark surfaces use a light ring
  derived from the surface text color.
- **Motion:** color transitions are brief. Reduced-motion users receive immediate state changes.

### Inputs and Fields

Fields use a canvas background, a one-pixel structural border, square-to-4px corners, 12px/16px internal
padding, and sans-serif content. Primary form controls are 48px high; denser authoring fields may use the
44px floor. Validation and publish failure use oxblood and danger wash. Placeholder and help text must
retain readable contrast against the current surface.

Public Q&A text fields use the strong hairline at rest, softened ink on hover, and one visually continuous
two-pixel institutional-blue inset boundary on focus. The inset treatment replaces the global offset focus
ring for those fields, so focus does not create a double border or change layout. Invalid fields use the
danger border while unfocused; when focused, the blue focus boundary takes precedence while `aria-invalid`
and the adjacent danger message continue to communicate the error.

Third-party form widgets must be told the site theme explicitly. The public theme is a manual
`html.dark` class, so a widget left on its own `prefers-color-scheme` default renders in the wrong theme
whenever the reader's choice differs from their OS. The Turnstile widget therefore has `data-theme` set
from the site theme before `api.js` loads, and re-renders on the `tcn:themechange` event the theme
control dispatches.

### Section Bands and Reading Containers

`SectionTile` supplies three grounded variants: reading canvas, band paper, and soft paper. Sections use
48px vertical padding below 640px and 96px from 640px upward, with 16px/20px side padding. They are
full-width bands, not cards. Standard page content caps at 1200px; `--container-page` (75rem) names that
cap but is currently unreferenced, because all 20 call sites hardcode `max-w-[75rem]` instead of the
`max-w-page` utility the token generates.

The 68ch default is `--container-prose`, which backs Tailwind's `max-w-prose` at three call sites; the
remaining 68ch measures are written as `max-w-[68ch]`. Academic documents widen to 74ch, and the bylaws
introduction to 76ch. Bylaws and the founding invitation supply a 256px aside and therefore use the shared
two-column desktop shell. The declaration supplies no aside and correctly renders as a centered single
column. Shorter prose and community questions use 68ch, while page leads and hero paragraphs tighten to
60–62ch.

Reading measures are expressed in `ch`, never in `rem`. A rem measure does not track the type scale, so
it drifts against the 60–76ch range at the 640px compaction. The Q&A pages and the seminar post body all
state their measures in `ch`; the seminar post also uses the same 256px aside as the document shell, so
there is one two-column shell rather than two. `max-w-[75rem]` remains the page cap and is not a reading
measure.

### Profile Cards

`MemberProfileCard` is a square, borderless canvas cell inside a hairline-separated grid. It has no
avatar and no individual drop shadow. A blue uppercase role and muted country lead into the serif name,
current position, summary, highlights, and bordered expertise tags. Leadership and support tiers become
two columns at 1024px. Directors become two columns at 768px and three at 1024px, including the intentional
odd-last-card span between 768px and 1024px.

### Media and Lightbox

Media triggers are full-width, borderless buttons around fixed-aspect imagery. Hover-capable devices
reveal a dark caption hint; touch devices show it persistently. Video posters use the permanent dark
surface and a circular play mark. The lightbox is the elevated modal layer and supplies high-contrast
focus rings, keyboard controls, captions, and immediate reduced-motion behavior.

### Publish Bar and Authoring Feedback

The sticky publish bar derives seven phases from `draft`, `saving`, `failed`, `partial`, `published`,
`dirty`, and `live`. Those phases produce six default headlines because `published` and `live` both say
"Published." Upload progress temporarily replaces the saving headline with "Uploading n of N"; a save
without staged files says "Saving the post." "Not created" is the failed-state override when no post
exists yet.

Selected media always remains staged until Save or Create, regardless of whether the post already exists.
The published-state controls include the public URL, Copy link, and post-level Delete when a post exists.
The one-action publish banner draws its confirmation over 450ms and fades in over 200ms; failure uses the
danger wash. Both become immediate under `prefers-reduced-motion`.

### Status, Motion, and Accessibility

Status badges may use a full pill because they are compact labels, not containers. Global focus uses a
2px outline with a 2px offset. Public content sections after the hero may reveal through a 700ms,
four-pixel upward transition only when JavaScript has opted in; content remains visible when JavaScript
fails. Reduced motion disables the transition. The back-to-top control and primary actions are 48px
square/high; secondary link targets may use the 44px floor. The back-to-top control hovers to softened
ink like every other primary button; blue fill belongs to the status badge and the selected pagination
page, not to hover.

**The Reveal Threshold Rule.** The reveal observer must use `threshold: 0` and let `rootMargin` decide
the entry point. A ratio threshold cannot be met by a section taller than roughly `root / threshold`,
so long sections — the About milestone record grows with every seminar — would stay at `opacity: 0`
forever while remaining in the accessibility tree. Progressive enhancement must never be able to
subtract content.

In-page anchors and sticky asides share one offset. The header is 73px, so anchor targets use
`scroll-mt-24` and sticky asides use `top-24` (96px) everywhere; the mobile menu's height budget
subtracts both the header and `env(safe-area-inset-top)`.

**The Grounded Component Rule.** A component in document flow earns separation through spacing, tone,
or a hairline. Do not turn every section, profile, or list item into a rounded card.

## Do's and Don'ts

### Do:

- **Do** use Georgia at weight 600 for headings and Pretendard for navigation, metadata, and controls.
- **Do** keep public narrative copy at 17–18px with generous line height and a 68ch reading measure,
  reserving 60–62ch for leads and 74–76ch for full academic documents.
- **Do** reserve institutional blue for links, active state, labels, selection, and focus.
- **Do** use 48px primary controls and preserve a 44px floor for compact secondary controls.
- **Do** build responsive behavior around the actual 576px, 640px, 768px, 896px, 1024px, and 1152px
  thresholds, and keep the narrower ones scoped to the components that need them.
- **Do** keep content visible without JavaScript and remove nonessential motion for reduced-motion users.
- **Do** use paper tone, whitespace, and hairlines before introducing another container.

### Don't:

- **Don't** invent tokens or components that are absent from the codebase; `primary`,
  `body-sans-strong`, `story-card`, `story-row`, and `officer-card` are not part of the current system.
  There are no `--spacing-*` tokens either: spacing comes from Tailwind's numeric scale, so cite the
  actual utility or pixel value rather than a named step.
- **Don't** introduce a second brand color, gradients, glassmorphism, or decorative background effects.
- **Don't** use rounded cards as default scaffolding or combine a content-card border with a wide shadow.
- **Don't** repeat tiny uppercase eyebrows above every section; use the established eyebrow only where
  its category signal materially helps navigation. Never pair an eyebrow with a heading that says the
  same thing, never stack two eyebrows inside one section, and never render an ordinal (`01`, `Step 02`)
  as a blue eyebrow — ordinals and sub-labels take the muted uppercase caption treatment. The blue
  uppercase officer role in `MemberProfileCard` is the documented exception and stays.
- **Don't** treat 768px as the universal mobile/desktop boundary or assume every academic document has
  an aside.
- **Don't** apply public dark-theme claims to admin pages until admin has an explicit theme mechanism.
- **Don't** reuse the local 11–13px exceptions for readable copy, navigation, captions, or form help.
- **Don't** add shadows to grounded surfaces; the overlay shadow belongs only to overlapping layers.
