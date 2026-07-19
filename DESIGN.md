---
version: alpha
name: TCN-editorial-analysis
description: A scholarly editorial interface designed for authority, trust, and an older Korean readership. Noto Serif KR carries headlines and long-form body copy, while Pretendard is used for navigation and metadata. Large type, high-contrast text, warm paper surfaces, hairline rules, and a single institutional blue establish the hierarchy.

# Audience-driven design decisions:
#  1. Type floors raised — body 16→18px, caption 12→14px — for late-50s+ eyes (WCAG AAA legibility).
#  2. Secondary gray darkened #757575→#5a5a5a (4.6:1 → ~7:1 contrast).
#  3. Korean serif + sans font stacks added (Noto Serif KR / Pretendard); display weight 600, not 400 — hangul serif needs more weight than a Latin didone for equal presence.
#  4. Warm parchment surfaces (#f7f5f0) reduce white glare and add journal warmth.
#  5. Near-black ink (#141414) instead of pure #000 — reduces halation for large hangul blocks.
#  6. Interactive corners 4px (rounded.sm) instead of hard 0 — a touch less austere while keeping editorial gravitas.
#  7. Relaxed line-heights prevent Hangul clipping; body 1.75, display 1.12.

colors:
  primary: "#141414"
  on-primary: "#ffffff"
  ink: "#141414"
  ink-soft: "#2b2b2b"
  body: "#2b2b2b"
  body-muted: "#5a5a5a"
  hairline: "#ddd9d0"
  hairline-strong: "#141414"
  canvas: "#ffffff"
  canvas-soft: "#f7f5f0"
  canvas-band: "#f2efe7"
  link: "#0b3d6b"
  link-hover: "#09507f"
  accent: "#0b3d6b"

typography:
  display-hero:
    fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Playfair Display", Georgia, serif'
    fontSize: 60px
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: -0.5px
  display-lg:
    fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Playfair Display", Georgia, serif'
    fontSize: 44px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.3px
  display-md:
    fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Playfair Display", Georgia, serif'
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.2px
  display-sm:
    fontFamily: '"Noto Serif KR", "Nanum Myeongjo", Georgia, serif'
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  eyebrow:
    fontFamily: 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif'
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 1.2px
  lead:
    fontFamily: '"Noto Serif KR", Lora, Georgia, serif'
    fontSize: 21px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0
  body-serif:
    fontFamily: '"Noto Serif KR", Lora, Georgia, serif'
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: 0
  body-sans:
    fontFamily: 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif'
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-sans-strong:
    fontFamily: 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif'
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif'
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  byline:
    fontFamily: '"Noto Serif KR", Georgia, serif'
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: 0
  caption:
    fontFamily: 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  button:
    fontFamily: 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif'
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.2px

rounded:
  none: 0px
  sm: 4px
  full: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 48px
  5xl: 64px
  6xl: 96px

components:
  masthead-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sans-strong}"
    padding: "{spacing.lg} {spacing.xl}"
    borderBottom: "1px solid {colors.hairline-strong}"
  nav-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sans-strong}"
    padding: "{spacing.md} {spacing.xl}"
  nav-link:
    textColor: "{colors.ink}"
    typography: "{typography.body-sans-strong}"
    minHeight: 48px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg} {spacing.2xl}"
    minHeight: 48px
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-strong}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg} {spacing.2xl}"
    minHeight: 48px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-strong}"
    typography: "{typography.body-sans}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md} {spacing.lg}"
    minHeight: 48px
  eyebrow:
    textColor: "{colors.accent}"
    typography: "{typography.eyebrow}"
  hero-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-hero}"
    padding: "{spacing.6xl} {spacing.xl}"
  section-band:
    backgroundColor: "{colors.canvas-band}"
    textColor: "{colors.ink}"
    padding: "{spacing.6xl} {spacing.xl}"
  story-card-large:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-md}"
    padding: "{spacing.2xl}"
  story-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-sm}"
    padding: "{spacing.lg}"
  story-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-sans-strong}"
    padding: "{spacing.2xl} 0"
  officer-card:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    nameTypography: "{typography.display-sm}"
    roleTypography: "{typography.eyebrow}"
    bioTypography: "{typography.body-serif}"
    rounded: "{rounded.sm}"
    padding: "{spacing.2xl}"
  byline-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body-muted}"
    typography: "{typography.byline}"
  hairline-divider:
    borderColor: "{colors.hairline}"
  footer:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    padding: "{spacing.6xl} {spacing.xl}"

---

## Overview

TCN's public site presents a learned society (Transcultural Network), not a SaaS product. The surface is editorial: a paper canvas, serif headlines and long-form body copy, a structured grid separated by hairlines, and a single deep institutional blue for links. It is tuned end-to-end for **authority + trust** and for a **late-50s-and-older Korean readership** through larger type, higher contrast, a warm parchment tint, and Korean-first font stacks.

Type carries the identity. Two Korean-capable families ladder the system: **Noto Serif KR (명조)** for every headline and for long-form body (정관·인사말·연혁·논문 소개), and **Pretendard** (a modern Korean UI sans) for navigation, metadata, eyebrows, captions, and buttons. Serifs speak scholarship and gravitas; the sans handles structure and wayfinding.

The single restrained accent is a deep institutional blue `{colors.accent}` (`#0b3d6b`) — used for inline links, category eyebrows, and active states. There is no second brand color. Black-on-paper plus this one blue is the entire palette; the society's emblem/seal supplies any further identity.

**Key Characteristics:**
- Serif-led editorial voice — Noto Serif KR headlines + serif body read as a scholarly journal, not a tech landing page.
- One accent only: deep institutional blue `{colors.accent}`. Everything else is ink-on-paper.
- Warm paper (`{colors.canvas-soft}` / `{colors.canvas-band}`) instead of stark white — easier on older eyes, quietly authoritative.
- Legibility floors for an older audience: 18px serif body, 14px minimum anywhere, secondary text no lighter than `{colors.body-muted}` (~7:1 contrast).
- Hairline dividers and surface contrast carry hierarchy — no drop-shadows, minimal chrome.
- Generous vertical rhythm (`{spacing.5xl}`/`{spacing.6xl}`) so dense academic content (officers, bylaws, events, publications) never crowds.

## Colors

### Brand & Accent
- **Ink** (`{colors.ink}` — `#141414`): Wordmark, all headlines, all body. Near-black to avoid halation on large hangul blocks.
- **Accent / Link** (`{colors.accent}` = `{colors.link}` — `#0b3d6b`): The society's single blue. Inline links, category eyebrows, active nav, focus rings. Deep enough for high contrast and institutional gravitas.
- **Link Hover** (`{colors.link-hover}` — `#09507f`): Hover/pressed state for links.

### Surface
- **Canvas** (`{colors.canvas}` — `#ffffff`): Default reading background for long-form text (maximum contrast).
- **Canvas Soft** (`{colors.canvas-soft}` — `#f7f5f0`): Warm parchment for cards (officer cards, callouts).
- **Canvas Band** (`{colors.canvas-band}` — `#f2efe7`): Slightly deeper parchment for alternating full-width section bands.
- **Hairline** (`{colors.hairline}` — `#ddd9d0`): 1px warm dividers between story/officer/bylaw rows.
- **Hairline Strong** (`{colors.hairline-strong}` — `#141414`): 1–2px black rules for the masthead underline and outline buttons.

### Text
- **Ink** (`#141414`): Headlines and primary body.
- **Ink Soft / Body** (`{colors.body}` — `#2b2b2b`): Long-form paragraphs (~13:1 contrast).
- **Body Muted** (`{colors.body-muted}` — `#5a5a5a`): Bylines, dates, secondary metadata only. Never lighter than this (~7:1) so supporting text remains legible.

## Typography

### Font Family
1. **Noto Serif KR (본명조 계열)** — headlines (`display-*`), lead paragraphs, long-form body, bylines. The scholarly voice. Load weights 400/600/700 (Google Fonts). Latin fallbacks: Playfair Display (display), Lora (body).
2. **Pretendard** — navigation, buttons, eyebrows, metadata, captions, form controls. Excellent Korean + Latin coverage; system fallbacks Apple SD Gothic Neo / Malgun Gothic.

**Why display weight 600:** Hangul serif at 400 looks thin and loses authority at display sizes. 600 restores presence without becoming heavy.

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.display-hero}` | 60px | 600 | 1.12 | Home hero / page cover headline. |
| `{typography.display-lg}` | 44px | 600 | 1.15 | Major section headlines. |
| `{typography.display-md}` | 32px | 600 | 1.20 | Feature card / subsection. |
| `{typography.display-sm}` | 26px | 600 | 1.25 | Officer name, card headings. |
| `{typography.eyebrow}` | 15px | 700 | 1.30 | Category / section label (Pretendard, tracked, accent color). |
| `{typography.lead}` | 21px | 400 | 1.70 | Lead paragraph (인사말·소개 리드). |
| `{typography.body-serif}` | 18px | 400 | 1.75 | Default long-form body (정관·연혁·본문). |
| `{typography.body-sans}` | 17px | 400 | 1.60 | Sans body — nav, UI, table cells. |
| `{typography.body-sans-strong}` | 17px | 700 | 1.50 | Nav links, story-row titles. |
| `{typography.body-sm}` | 15px | 400 | 1.60 | Secondary sans body. |
| `{typography.byline}` | 15px | 700 | 1.60 | Officer role line / byline (serif). |
| `{typography.caption}` | 14px | 400 | 1.50 | Fine print, captions. Minimum size anywhere. |
| `{typography.button}` | 17px | 700 | 1.20 | Button labels. |

### Principles
- **Serif for narrative, sans for structure.** Serif never labels a button; sans never sets article body.
- **14px is the floor.** Nothing on the page renders below `{typography.caption}` — the audience skews late-50s+.
- **Secondary text ≥ `{colors.body-muted}`.** No faint gray metadata.
- **Line-height is generous.** Hangul needs air; body runs 1.75.

## Layout

### Spacing System
- **Base unit**: 4px. Tokens: `xxs` 2 · `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 20 · `2xl` 24 · `3xl` 32 · `4xl` 48 · `5xl` 64 · `6xl` 96.
- **Section padding**: full-width bands use `{spacing.6xl}` 96px top/bottom on desktop.
- **Row padding**: `{spacing.2xl}` 24px vertical between story/officer/bylaw rows.

### Grid & Container
- Content container ~1200px max to favor readable measure over density.
- Long-form article/bylaw column caps at ~68ch for comfortable reading.
- Home: hero band → intro (인사말/미션) → featured (연혁 or 학술대회) → officer grid → news/notice rows → footer.
- Officer grid: 2-up desktop, 1-up mobile.

### Responsive Strategy

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Hero 60→36px; all grids 1-up; hamburger nav; body stays 18px. |
| Tablet | 768–1023px | 2-up officer/feature grids. |
| Desktop | ≥ 1024px | Full grid, wide bands. |

**Touch targets:** nav links, buttons, and inputs are ≥ 48px tall — comfortable for older users on Android. Do not shrink below 44px.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Level 0 — Flat | No shadow, no border. | Most surfaces. |
| Level 1 — Hairline | 1px `{colors.hairline}`. | Row dividers, card edges, input borders. |
| Level 2 — Black rule | 1–2px `{colors.hairline-strong}`. | Masthead underline, outline buttons, emphasis. |

No drop-shadows. Surface contrast + hairlines carry all hierarchy.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Section bands, full-bleed imagery. |
| `{rounded.sm}` | 4px | Buttons, inputs, cards; lightly softened while remaining editorial. |
| `{rounded.full}` | 9999px | Author/officer avatars, icon buttons only. |

## Components

### Navigation
- **`masthead-band`** — thin top band, society wordmark/seal centered or left, black 1px underline. Pretendard bold.
- **`nav-bar`** — light nav; primary sections + a clear "회원가입/문의" CTA. Hamburger < 768px. Links ≥ 48px tall.

### Buttons
- **`button-primary`** — ink fill, white label, 4px corners, ≥48px tall. Primary CTA (회원가입, 문의, 자료 다운로드).
- **`button-outline`** — white fill, black 1px border, ink label. Secondary actions.

### Cards & Rows
- **`story-card-large` / `story-card`** — feature news/event cards; serif heading + serif lead + sans byline.
- **`story-row`** — bylined list row with hairline bottom border; for 공지/뉴스/논문 lists.
- **`officer-card`** — parchment card for 임원진: serif name (`display-sm`), accent eyebrow role (`eyebrow`), serif bio (`body-serif`), optional circular avatar.

### Signature
- **`hero-band`** — white hero, `display-hero` serif headline + `lead` subhead. No background image required; type carries it (works even without photography).
- **`section-band`** — alternating parchment full-width band to separate major sections (미션, 연혁, 학술대회).
- **`eyebrow`** — accent-blue tracked caps label above section headlines.
- **`byline-row`** — serif byline with muted color; officer role / article meta.
- **`hairline-divider`** — the 1px warm line; the only default elevation cue.
- **`footer`** — ink-black band, white text columns: 연락처·주소·바로가기·저작권. Generous 96px padding.

## Do's and Don'ts

### Do
- Set every headline in Noto Serif KR (`display-*`, weight 600). The serif voice IS the authority.
- Keep body at 18px serif with 1.75 line-height. The audience skews older — legibility is non-negotiable.
- Reserve `{colors.accent}` blue for links, eyebrows, and active states only.
- Use warm parchment bands to separate sections; let hairlines and whitespace carry structure.
- Keep touch targets ≥ 48px. Test on Android at default zoom.
- Let type + hairlines do the work when photography is thin — the design does not depend on hero imagery.

### Don't
- Don't drop below 14px anywhere, and don't use gray lighter than `{colors.body-muted}` for readable text.
- Don't add a second brand color. One blue, one ink, paper. The seal supplies identity.
- Don't set body copy in the sans, or button labels in the serif. Two voices, two roles.
- Don't add drop-shadows or gradients. This is editorial, not SaaS.
- Don't crowd content to look "efficient" — generous rhythm reads as institutional confidence.
- Don't go pure `#000` on `#fff` for large hangul blocks — use `{colors.ink}` `#141414` to reduce glare.
