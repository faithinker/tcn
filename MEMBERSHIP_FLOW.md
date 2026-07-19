# TCN Membership Flow

Updated: 2026-07-19

Public routes: `/ko/contact` and `/en/contact`

## Phase 1: public guidance

- Explain who can join and what activities members can participate in.
- Publish the review flow without inventing membership categories, fees, phone numbers, or email addresses.
- Keep the application CTA disabled until an approved form URL is configured.
- Request only information required to review and reply to an application.

## Proposed application fields

- Korean and English name
- Affiliation and position
- Country or region of activity
- Research or professional field
- Motivation and preferred TCN activities
- Reply email
- Privacy-policy consent

Do not request a phone number, birth date, home address, resident number, or identity document in the initial application.

## Activation

Set `PUBLIC_MEMBERSHIP_FORM_URL` to an approved external form or member system. The shared Korean/English contact page enables the external CTA only when this value is non-empty. Before activation, confirm:

1. membership categories and approval authority;
2. dues and payment handling, if any;
3. privacy policy, retention period, and data controller;
4. application receipt and decision-message templates;
5. an official TCN reply email.
