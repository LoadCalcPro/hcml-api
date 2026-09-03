# Standard promotional trial

New standard trial redemptions receive five days (120 consecutive hours) from
first activation, not from a website visit. Repeat visits do not restart access.

`trial-policy.js` is shared by both promotional entry points. It maps legacy
standard campaigns with `duration_hours = 24` to 120 for NEW redemptions and uses
120 as the default when no valid duration exists. Explicit custom campaign
durations other than 24 remain unchanged. New standard campaigns should use 120.

Existing `promo_trials` rows are not updated: active trials retain their saved
`expires_at`, and expired redemptions remain expired. Do not bulk-update stored
trial expiration dates as part of this rollout. Campaign availability windows,
calculator entitlements, paid memberships, and saved calculations are unchanged.

Deploy the backend policy before publishing the five-day website wording.
Public wording lives in `trial.html` and `trial-dashboard.html` in LoadCalcPro/X.
No Payhip changes are required. Test with `node --test test/trial-policy.test.js`.
