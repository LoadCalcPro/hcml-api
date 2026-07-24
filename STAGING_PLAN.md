# LoadCalcPro API Staging Plan

## Non-negotiable safety boundary

The production `main` branch, current Render service, production Supabase project, Payhip webhook, customer records, URLs, and environment variables must remain unchanged. All work begins and remains on this `staging` branch until explicit production approval.

## Separate staging services

Create a new Render Web Service connected to:

- Repository: `LoadCalcPro/hcml-api`
- Branch: `staging`
- Build command: `npm install`
- Start command: `node index.js`

Create a separate Supabase project for staging. Do not copy real customer passwords or production service-role credentials. Use test-only accounts and records.

## Required staging environment variables

- `SUPABASE_URL` — staging Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — staging project service-role key
- `ADMIN_API_KEY` — new staging-only random secret
- `SITE_URL` — separate staging website URL, ending with `/`
- `CREATE_PASSWORD_URL` — staging create-password page
- `RESET_PASSWORD_URL` — staging reset-password page when implemented
- `ALLOWED_ORIGINS` — staging website origin only when CORS restriction is implemented

Never copy these values into source files. Never reuse the production `ADMIN_API_KEY` or production service-role key.

## Migration phases

### Phase 1 — Baseline copy

1. Deploy the unchanged staging branch to the new Render service.
2. Point it only to the staging Supabase project.
3. Confirm `/health` works.
4. Create test member records that represent generator-only, AIC-only, suite, inactive, and canceled access.
5. Verify current API behavior before changing logic.

### Phase 2 — Authentication and membership reliability

1. Verify server-side membership lookup.
2. Verify product-name-to-access mapping.
3. Correct create-password and password-reset redirect handling in staging.
4. Require authenticated sessions for protected operations.
5. Ensure inactive members cannot access calculators.
6. Ensure direct API calls cannot bypass membership checks.

### Phase 3 — Security hardening

1. Replace wildcard CORS with an allowlist for staging and later production.
2. Add rate limiting.
3. Add secure headers.
4. Validate request bodies and reject unexpected fields.
5. Verify webhook authenticity before changing membership records.
6. Prevent secrets and customer data from appearing in logs.
7. Add consistent error responses without revealing whether an email exists.

### Phase 4 — Private calculation API

Move proprietary calculation logic from browser JavaScript into server-side modules one calculator at a time. Keep Node.js/Express unless testing shows a compelling reason to change technology.

For each calculator:

1. Capture known-good production test cases.
2. Implement a private server calculation function.
3. Add automated tests.
4. Compare API results against production outputs.
5. Update only the staging website to call the staging endpoint.
6. Do not remove the old staging calculation until parity is proven.

### Phase 5 — Production readiness

Production migration is allowed only after:

- All automated tests pass.
- Login, create-password, reset-password, and sign-out pass manually.
- Membership entitlement tests pass for every access type.
- Calculator results match production for all regression cases.
- No staging URL, key, database reference, or test account remains in the release candidate.
- The owner explicitly approves deployment.

## API test matrix

- Health endpoint returns a successful staging response.
- Missing required environment variables stop startup safely.
- Valid email normalization works.
- Invalid and blocked disposable emails are rejected as intended.
- Product names map to generator, AIC, or both correctly.
- Unknown products do not grant access.
- Missing or invalid admin key is rejected.
- Generator-only, AIC-only, suite, inactive, and canceled memberships are handled correctly.
- Duplicate webhook delivery is idempotent.
- Malformed webhook payload does not alter records.
- Unauthorized calculation request is denied.
- Authorized calculation request returns the expected result.
- Rate limit returns a controlled response.

## Rollback

Staging rollback requires only disabling the new staging Render service or resetting the `staging` branch. Production remains available because its service, branch, database, URLs, and Payhip configuration are never modified during this process.
