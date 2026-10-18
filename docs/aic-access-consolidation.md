# AIC membership-check consolidation — implementation contract

## Confirmed production behavior
- member-dashboard.html calls POST /api/v2/access for each product.
- aic_calculator.html calls POST /api/v2/access again for signed-in members.
- AIC also offers POST /api/access using an email alone.
- Staging AIC currently calls neither endpoint and simply opens the calculator; staging cannot validate the production access flow as-is.

## Required implementation
1. Authenticate on the dashboard and query member permissions once.
2. Issue a signed, short-lived, audience-scoped entitlement for each permitted calculator, bound to the authenticated user ID and session. Include expiry, tier, and issued-at. Do not accept browser-created flags as proof.
3. Validate the entitlement on calculator entry without Supabase database round trips. For a static frontend, client-side verification alone cannot reliably protect downloadable HTML/JS; paid API/storage operations must independently enforce authorization server-side. If source-code protection is required, host calculator delivery behind a server-side gate.
4. Retain direct-link access with a secure fallback: existing Supabase session plus one server verification when no valid entitlement is present.
5. Preserve the separate promotional trial flow and server-enforced expiration. Do not silently grant paid membership based on email-only checks.
6. Make logout and session changes invalidate cached grants; keep grant lifetime short to limit revoked-access exposure.
7. Add measurements for dashboard login, AIC navigation with grant, direct-link fallback, and promo trial entry.
8. Test expired grant, wrong audience, forged grant, logged-out browser, revoked membership, and expired promo.
9. Stage with staging Supabase and staging backend only; production untouched until separately approved.

## Why no direct removal yet
Deleting the AIC membership checks without a verified replacement would allow direct URL entry to bypass paid authorization. Existing staging AIC has no checks and therefore cannot serve as proof that this replacement is safe.
