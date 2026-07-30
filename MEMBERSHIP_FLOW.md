# TCN Membership Flow

Updated: 2026-07-30

Public route: `/contact` (`src/pages/contact.astro`). The former `/ko/contact` and `/en/contact` paths were removed in the English-only pivot and are 301'd to `/contact` by the prefix-stripping rules in `public/_redirects:49-50`.

## Implemented today

The contact page is public guidance plus one environment-gated call to action. No membership form exists in this repository.

- `src/pages/contact.astro:6` reads `PUBLIC_MEMBERSHIP_FORM_URL`; `.env.example:2` documents it.
- When the variable is non-empty, `contact.astro:64-82` renders a real external link, "Open application form" (`src/i18n/content.ts:511`).
- When it is empty or unset, the same block renders an `aria-disabled` placeholder, "Application form coming soon" (`content.ts:512`). This is the current production state.
- Secretariat details already ship on the page: telephone `031-709-8111` (`content.ts:529`) and email `mingoo@aks.ac.kr` (`content.ts:531`).
- "Information to Prepare" (`content.ts:517-523`) tells applicants what will be asked. It is guidance copy, not a form.

Activation is a configuration change, not a build: point the variable at an approved external form or member system and the CTA goes live.

## The Q&A board is not this channel

The public Q&A board (`/questions/new`) is the site's only working public intake form. It is Turnstile-gated and collects a title and a question body only, with no contact fields. It is deliberately **not** the membership application channel; do not route applicants there.

## Before activation

1. membership categories and approval authority;
2. dues and payment handling, if any;
3. privacy policy, retention period, and data controller — no privacy policy page exists yet, and `content.ts:510` tells visitors that applications open only once this is settled;
4. application receipt and decision-message templates.

Settled: an official TCN reply email and telephone number are published (`content.ts:529-531`), so neither blocks activation.

## Proposals, not built

There is no `/join`, `/apply`, or `/membership` route. The list below is a proposal for whoever builds or configures the external form. Only the shipped "Information to Prepare" copy is authoritative.

- Full name and preferred English name
- Affiliation, position, and country or region of activity
- Research or professional field
- Motivation and preferred TCN activities
- Reply email
- Privacy-policy consent — blocked until there is a privacy policy to consent to

Do not request a phone number, birth date, home address, resident number, or identity document in the initial application. Do not invent membership categories, fees, or contact values that are not already in `content.ts`.
