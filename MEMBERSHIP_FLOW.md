# TCN Membership Flow

Updated: 2026-10-20. Describes the integrated branch implementation; production activation is separate.

## Account flow

- `/login` accepts existing usernames and new email identifiers. Existing login challenge, lock and trusted-device protections remain.
- `/signup` and `POST /api/auth/signup` open only when `SIGNUP_ENABLED=true` and member features are enabled.
- Signup collects email, password, display name and optional affiliation. Email is normalized; passwords use the existing shared policy.
- A new account is always member/pending with no executive or special forum access. Signup signs the applicant in and sends them to `/account`.
- Pending applicants may read and write the Assembly Forum. Executive approval changes their status to approved; it does not grant officer or Directors Forum permissions.
- Rejected applicants can sign in and see their status on `/account`, but cannot access either private forum. Executives may restore and approve them.
- Public Q&A questions remain available without an account. They are not membership applications.

## Groups and authority

Approved officers operate seminar content, media and official Q&A answers. Auditors and advisers remain members with special Directors Forum access and no content-operation authority. The president and senior vice president are executives.

Executives use `/admin/users` to approve/reject applicants and change approved non-executive accounts’ roles, executive authority and special access. Their own and other executive accounts are read only, including status changes. Newly promoted executives are protected too. Every ordinary user change is audited atomically; protected executive replacement uses an explicit operator recovery procedure.

## Public contact guidance

`/contact` remains public. Its optional external application link uses `PUBLIC_MEMBERSHIP_FORM_URL`; an unset value keeps that external CTA disabled. The existing Secretariat contact details remain the source of truth. The contact page does not automatically enable the new signup route.

## Activation

Keep `MEMBER_FEATURES_ENABLED=false` until the actual operating roster, initial executives and auditor/adviser access have been verified. Keep `SIGNUP_ENABLED=false` independently until the privacy policy, collection/retention/controller decisions and signup abuse protection are ready and activation is approved.

Email ownership verification and password reset remain follow-up work. The user-management screen must explain that email is unverified; operators use names and affiliations to review applications. A documented operator password-reissue/session-revocation procedure is needed before public signup.

Do not request phone numbers, birth dates, home addresses, identity documents or unsupported membership fees/categories.
