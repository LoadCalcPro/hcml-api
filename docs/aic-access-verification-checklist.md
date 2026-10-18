# AIC authorization and promotional access verification

## Code inspection (2026-10-18)
- Production dashboard uses Supabase login and POST /api/v2/access. Feature frontend branch uses one access request for both calculator cards.
- Production AIC makes an additional POST /api/v2/access on page load, redoing authenticatedUserFromRequest and findMember.
- The production AIC legacy email form calls POST /api/access without a promo code. The promo gateway only recognizes trials on that legacy endpoint when email **and** code are supplied, so this form is not a complete trial redemption path.
- The promo gateway provides POST /api/promo/redeem and POST /api/promo/access with email + promo code. Trial status, expires_at, and calculator access_type are validated server-side.
- Staging dashboard and staging AIC do not exercise the production membership gate. Do not claim staging access flow tested.
- Feature branch AIC removes the legacy email-only form, keeps /api/v2/access, and links to dashboard. This is not yet an optimization of the second server request.
- Static calculator HTML/JS remains directly downloadable; a client-side access flag or a signed token verified solely in browser cannot enforce paid access to the source.

## Pre-deployment tests (not yet run)
1. Production-like test Supabase user with active AIC entitlement -> dashboard unlocks AIC; direct AIC link succeeds.
2. Active member with generator-only entitlement -> AIC denies.
3. Expired/invalid Supabase session -> AIC denies and links to dashboard.
4. Logout -> re-opening AIC denies.
5. Promo redemption with valid seven-day campaign -> permitted calculator opens through the promo flow.
6. Expired promo -> access denies.
7. AIC-only promo -> Generator denies; Generator-only promo -> AIC denies.
8. Existing IAEI 247 and legacy redirect behavior unchanged.
9. Backend unavailable -> verification unavailable, not false 'No Access'.
10. Inspect access API logs for auth_ms, lookup_ms, total_ms and compare dashboard-to-AIC navigation before/after.

## Architectural decision before eliminating AIC request
A short-lived signed entitlement is useful to avoid repeat database queries, but a protected backend still must validate access for paid operations or delivery of protected calculator code. On a static host, merely trusting a browser-stored token cannot protect the calculator. Decide whether to (a) accept static-source exposure and enforce paid backend capabilities, or (b) move protected calculator delivery behind an authenticated server route. Until then, retain the AIC authenticated request.
