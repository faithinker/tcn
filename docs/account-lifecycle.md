# Account and membership lifecycle

The account UI follows the TCN account specification and its UI/UX and engineering supplement (2026-10-20). Pages remain English, as with the rest of the institutional site. This change does not activate public signup or deploy anything.

## Screens and policies

- `/signup`: verify an email with a six-digit code before choosing a display name, optional affiliation and password. The email is locked after verification; changing it discards the prior proof. The browser-bound verification survives reload and expires after 20 minutes. Only final submission creates a pending member and signs them in.
- `/login`: password visibility and Caps Lock feedback, password recovery, and server-authorized return destinations. Password-change/reset notices are removed from the URL after display.
- `/account`: membership status and permission-aware forum links, an edit/cancel/save profile form, password change, all-device logout and account closure. Only display name and affiliation are editable. Email and legacy usernames cannot be changed. Profile saves do not consume `users.revision`, which remains the administrative/audit version.
- `/forgot-password` and `/reset-password`: generic mailbox responses, one-use, 30-minute reset links. Reading a link does not mutate credentials. Completed resets invalidate all sessions and other reset links and require normal login.
- Account closure uses a native modal dialog with Cancel focused first. The current password, acknowledgement and final confirmation are in the dialog. Cancel and ESC send no request; a wrong password keeps the dialog open. Completion moves to the public `/account/withdrawn` page.

New passwords use 15–64 Unicode code points after NFC normalization. Spaces and symbols are allowed; character-class composition is not required. Control/format/invisible characters, reserved display names, simple repetitions or sequences, decorated common/site words, and passwords containing the account username or email local-part are rejected. The production Pwned Passwords lookup sends only a five-character SHA-1 prefix with padding; no raw password, full digest or email is sent. Unavailable safety checking rejects the new-password operation without changing credentials. Explicit loopback-only local mail mode skips the network lookup for synthetic fixtures.

New password hashes are marked `pbkdf2-nfc`; old `pbkdf2` hashes retain their original input semantics. The existing PBKDF2-SHA256 50,000 work factor is retained because of the documented Workers Free CPU budget. This is below OWASP's current recommendation and remains a release security decision; a length change does not resolve that issue.

## Server guarantees

Migration `0011_account_lifecycle.sql` adds deletion and verification timestamps, browser-bound email challenges, independent reauthentication counters and minimal withdrawal events. User rows remain to preserve author and audit foreign keys. Closure replaces the login identifier with `withdrawn:<id>`, stores an unusable password sentinel, removes display name/affiliation/verification data, increments the session version and invalidates account proofs. The deleted row cannot be restored through an ordinary UPDATE.

Active identity lookups and administrative lists/counts exclude deleted users. Forum queries return a separate withdrawal flag and render “Withdrawn member”; historical posts keep their original visibility. Forum writes and administrative user changes recheck current actor/target eligibility at the write. Profile/password updates use the authenticated session version in the storage condition.

Account mutations and logout require exact same origin and an `account`-scoped CSRF token. `/api/auth/me` provides that token only to a valid same-origin session. Rejected members retain profile/security/closure access. Five consecutive current-password failures use counters separate from login locks and invalidate all current sessions.

D1 trigger side effects can increase `meta.changes`; credential/closure success uses returned rows rather than assuming `meta.changes === 1`. The D1 gate reproduces this with a consumed signup challenge so a successful password change is never reported as failed after commit.

Closure and credential changes expire `tcn_session` at `/`, `tcn_device` at `/api/auth/login` and the signup cookie. HTTP-only cookies are cleared in the response. Other devices lose server access immediately; their physical cookies are cleared on a subsequent applicable response. Account browser state is cleared without wiping unrelated theme preferences. Other tabs show a session-ended banner, clear password fields and disable protected submissions while leaving non-secret drafts available to copy.

The withdrawal request ID is stored without original contact details. A lost response is not reported as confirmed closure merely because a later request gets 401. Profile and credential validation failures leave credentials unchanged. Withdrawal data/audit writes are atomic; database errors do not produce a completion response.

## Resend Free mail setup

Resend was selected by the user. No Cloudflare Email Service paid-plan binding or Brevo integration is used. The Worker sends server-side HTTPS requests to `https://api.resend.com/emails`; no SDK is required.

1. Use a Resend Free account and verify a sending domain you control. Publish the DNS records Resend provides; do not guess or overwrite existing mail records. Disable open/click tracking for account-security mail.
2. Create a sending-only API key for the relevant domain. Store `RESEND_API_KEY` in local `.dev.vars` or `wrangler secret put RESEND_API_KEY` for production. Never use a `PUBLIC_` variable or put the key in source, chat, a screenshot or a test log.
3. Set `AUTH_MAIL_FROM` to a verified sender, such as an account mailbox on that domain, and `AUTH_PUBLIC_ORIGIN=https://thetcn.org`. Recovery links use this configured HTTPS origin rather than an untrusted request Host header.
4. Keep `AUTH_MAIL_MODE` unset in production. It must not be set to `local` on the production Worker.
5. Verify delivery, spam placement, recovery, closure and privacy/retention policy before separately authorizing signup activation and deployment. This implementation does not create a provider account, configure DNS, upgrade a plan or set production secrets.

The Resend Free allowance checked on 2026-10-20 is 3,000 emails/month and 100/day. The app reserves a conservative budget of 90 attempts per UTC day and 2,900 per UTC month in D1 with tiered watermarks (signup capped at 50/day and 1,800/month, password reset at 80/day and 2,600/month, and security notices up to 90/day and 2,900/month so signup traffic cannot starve recovery or security alerts); concurrent sends cannot pass a read-then-increment race. Failed attempts count conservatively. Mail from other apps sharing the same Resend account also consumes its quota, so use the provider's Free plan with paid overages disabled. The application cannot enforce another application's usage or account billing settings.

Signup mail failures leave no usable proof and return a generic delivery error. Reset requests return the same accepted response for existing and missing accounts; provider failures are logged without recipient details. Security notifications for password changes/resets and closure retry once in memory with the same provider idempotency key. Mail failure does not roll back a completed account change, and the original withdrawal address is not placed in a persistent retry queue.

Signup codes expire in 10 minutes, have five attempts per challenge, and are stored as server-keyed HMACs. Sending is limited per email (five/hour, 60-second cooldown), IP (10/hour) and purpose, plus the global provider budget. Reset links use a 32-byte random secret stored as a hash; they are never printed by the application. Expired challenge/rate-limit records are pruned as requests run. Local test mail is pruned after one hour of subsequent local sending; the isolated preview directory can be discarded when testing is complete.

## Local verification

Use an isolated local database, with no real email delivery:

```sh
TCN_CONTENT_SOURCE=empty npm run build
npx wrangler d1 migrations apply tcn-content --local --persist-to .wrangler/account-preview
npx wrangler dev --port 4345 --persist-to .wrangler/account-preview --var AUTH_MAIL_MODE:local --var MEMBER_FEATURES_ENABLED:true --var SIGNUP_ENABLED:true --var LOGIN_CHALLENGE:off
```

Restart this preview server after rebuilding so its asset map and hashed scripts match. `astro dev` may be used when available, but the production-adapter preview is the verification baseline.

`local` works only on loopback URLs. It stores synthetic mail in the local D1 `auth_local_mail` table; it does not expose a public inbox or bypass entering the real generated code. The signup-state endpoint provides a local-only response marker so the browser gate refuses to run against a real provider. A non-loopback Worker still requires a configured verified sender and key.

```sh
npm test
npm run check
npm run test:account:d1
BASE_URL=http://localhost:4345 TCN_D1_PERSIST_TO=.wrangler/account-preview npm run verify:account
BASE_URL=http://localhost:4345 TCN_D1_PERSIST_TO=.wrangler/account-preview npm run verify:forum-users
```

The browser gate creates and cleans its own synthetic account, tests verification resumption, immutable email, profile editing, password change/reset, final-confirmation cancellation, wrong-password recovery, closure, cookies and preservation of another tab's unsaved draft. Screenshots go to ignored `verify/accounts/`. Existing forum/user gates retain role, approval, ownership, no-JavaScript POST fallback and header logout coverage.

## Release decisions still required

- Provider account/key and sending-domain setup, real email delivery and provider suppression/quota monitoring.
- Privacy notice, retention periods, backup deletion and treatment of personal information embedded in retained posts. The UI accurately says posts remain; it does not promise to erase already-delivered copies or provider/backup records.
- Existing manual accounts need a separately verified mailbox before automatic email recovery is enabled. The profile editor cannot attach or change it.
- Closure of the last executive is allowed so users are not indefinitely trapped. Operators must appoint/recover the next executive through the existing audited bootstrap procedure. No account can regain old authority automatically by signing up again.
- Higher password-hash work factor/runtime budget and future MFA for privileged accounts.

Sources: [Resend quotas](https://resend.com/blog/new-free-tier), [send API](https://resend.com/docs/api-reference/emails/send-email), [domain verification](https://resend.com/docs/dashboard/domains/introduction), [Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords).
