# LoadCalcPro X — Membership tiers (development specification)

Status: design only. This file does not activate billing, change access, or deploy code.

## Plans
- Free: Standard Dwelling calculator (where already offered free); no cloud saving.
- Standard Monthly: USD 9.99/month.
- Standard Annual: USD 99/year.
- Complete Professional Suite Monthly: USD 14.99/month.
- Complete Professional Suite Annual: USD 149/year.

## Entitlements
| Feature | Free | Standard | Complete |
|---|---|---|---|
| Standard Dwelling (free offering) | Yes | Yes | Yes |
| Optional Method Generator | No | Yes | Yes |
| AIC | No | Yes | Yes |
| Commercial calculator | No | No | Yes |
| Transformer/conductor/panel suite | No | No | Yes |
| One-Line Diagram Editor | No | No | Yes |
| Save/open cloud projects | No | No | Yes |

## Design requirements
1. Preserve current production behavior until a separately reviewed release.
2. Preserve existing staging testing access; no paid gate in staging.
3. Authenticate customer once and return all entitlements in one request.
4. Payment provider events must be verified before changing entitlements.
5. Record provider subscription ID, product/price ID, tier, status, paid-through timestamp, and latest processed event ID.
6. Never infer a successful renewal from elapsed time alone. Use verified billing events/provider status.
7. A scheduled cancellation should retain access through its confirmed paid-through date; immediate revocations/refunds require separate handling.
8. Trial access is distinct from paid subscription access and keeps its own expiration rules.
9. Cloud project storage is loaded on demand, not during calculator unlock.
10. Fail closed for authorization; display a verification error rather than falsely reporting 'No Access' on transient failures.
11. Map exact Payhip/Stripe product IDs and webhook event semantics before writing payment-handling code.
12. Confirm data-retention, export, quota and cancellation rules for cloud-saved projects before launch.

## Next implementation steps
- Instrument backend authentication, membership lookup, and gateway timings without logging tokens or sensitive data.
- Make dashboard consume a single permission response.
- Add subscription fields and verified event processing in a staging/test database.
- Test new purchase, renewal, cancellation, failure, expiration, and tier upgrade/downgrade.
- Add cloud Save entitlement and storage only after its design and security review.
