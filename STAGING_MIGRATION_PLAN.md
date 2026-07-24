# LoadCalcPro staging migration plan

## Production freeze

The `main` branches, production Render service, production Supabase project, production Payhip configuration, production URLs, and production customer records are out of scope. All code changes and tests must remain on the `staging` branches until a separate production promotion is explicitly approved.

## Current architecture found

- Website authentication is performed directly with Supabase Auth from `member-dashboard.html`.
- Calculator entitlement checks are sent to `POST /api/v2/access` with the Supabase access token.
- Password recovery is initiated by `forgot-password.html`.
- Invitation and recovery links are completed on `create-password.html`.
- The API stores calculator entitlements in `public.members`.
- Payhip events call `/payhip-webhook`; recognized purchases activate access and invite new Auth users.
- The API is Node.js/Express. No Python rewrite is recommended for this migration.

## Staging resources

1. GitHub website branch: `LoadCalcPro/electrical-load-calculator`, branch `staging`.
2. GitHub API branch: `LoadCalcPro/hcml-api`, branch `staging`.
3. Supabase project: `LoadCalcPro Staging`.
4. Separate Render Web Service connected only to the API `staging` branch.
5. Separate staging website URL. Do not point the production GitHub Pages site at staging resources.
6. Payhip production webhooks remain unchanged. Use simulated webhook payloads until a separate staging/test webhook can be configured safely.

## Database migration

In the Supabase staging project SQL Editor, run only:

`supabase/staging-schema-v2.sql`

Do not copy production rows. Add test members only through the staging API or Supabase staging dashboard.

## Render staging environment variables

Set these only on the new staging Render service:

- `SUPABASE_URL`: staging Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: staging secret key only.
- `ADMIN_API_KEY`: a new random staging-only value.
- `SITE_URL`: final staging website base URL, ending with `/`.
- `CREATE_PASSWORD_URL`: final staging `create-password.html` URL.
- `RESET_PASSWORD_URL`: final staging `create-password.html` URL.
- `NODE_ENV=staging`.

Never reuse the production Supabase secret key or production admin key.

Build command: `npm install`

Start command: `node index.js`

## Supabase Authentication settings

In the staging project:

1. Enable Email provider.
2. Keep public anonymous access disabled.
3. Set Site URL to the staging website base URL.
4. Add the exact staging URLs for `create-password.html`, `forgot-password.html`, and `member-dashboard.html` under Redirect URLs.
5. Do not add production customer emails to staging Auth.
6. Use one or two email addresses controlled by the owner for tests.

## Website staging configuration

Before publishing a staging website, replace the production constants on the website `staging` branch only:

- Supabase URL -> staging project URL.
- Supabase publishable key -> staging publishable key.
- API base URL -> new staging Render URL.
- Password recovery redirect -> staging `create-password.html` URL.

Do not merge these replacements into `main`.

## Payhip verification strategy

Production Payhip must not be changed during initial staging work. Verify webhook handling with controlled HTTP requests sent to the staging Render URL using test email addresses and realistic Payhip payload shapes.

Test recognized product names:

- `AIC Calculator`
- `Optional Method Generator Calculator`
- `Electrical Calculation Suite`

Test activation event types:

- `paid`
- `subscription.created`
- `subscription.activated`
- `subscription.payment_succeeded`

Test deactivation event types:

- `refunded`
- `subscription.cancelled`
- `subscription.deleted`
- `subscription.expired`

A real Payhip webhook should be connected to staging only after the simulated tests pass and only if Payhip supports a separate test product or safely isolated webhook URL.

## Required verification cases

### Health and isolation

- Staging `/health` returns HTTP 200 and `database: connected`.
- The staging database contains no production members.
- Production website and production API continue responding normally.

### New customer flow

1. Send a staging activation webhook for a controlled test email.
2. Confirm a `members` row is created with the correct calculator flags.
3. Confirm an Auth invitation email is received.
4. Open the newest invitation link.
5. Create a password.
6. Sign in at the staging dashboard.
7. Confirm only purchased calculators show as included.

### Existing customer flow

- Repeating the activation webhook does not create a duplicate Auth user.
- The existing user uses Forgot Password instead of receiving repeated invitations.

### Password reset

1. Submit a controlled Auth email on staging `forgot-password.html`.
2. Confirm the email link opens staging `create-password.html`.
3. Set a new password.
4. Sign in with the new password.
5. Confirm the old password no longer works.

### Access controls

- No token -> `/api/v2/access` returns 401.
- Valid Auth user without a member row -> 403.
- Inactive member -> 403.
- Generator-only member -> generator allowed, AIC denied.
- AIC-only member -> AIC allowed, generator denied.
- Suite member -> both allowed.
- Cancellation of one product preserves access to the other product.
- Cancellation of the final product sets `active=false`.

### Payhip payload handling

- Missing email -> HTTP 400.
- Unknown product -> safely ignored without granting access.
- Unknown event -> safely ignored without changing access.
- Activation updates the correct calculator only.
- Deactivation updates the correct calculator only.

## Promotion rule

No staging code is merged into `main` until all tests above pass and a written production rollback plan exists. Production changes should be promoted in small, reviewable commits, beginning with configuration and authentication fixes before any calculator logic migration.
