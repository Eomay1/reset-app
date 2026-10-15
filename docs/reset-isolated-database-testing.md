# RESET isolated database verification — 2026-10-11

Result: **43 PASS, 0 FAIL** using PostgreSQL 18.3 in PGlite 0.5.8. This supersedes earlier notes that isolated database testing was unavailable or that these migration files had never been executed in a test database. They remain unapplied to production.

## Isolation and reproducibility

PGlite was installed only in `/private/tmp/reset-db-test.Rt58W2`, with its own npm cache, package manifest and lockfile. RESET dependencies, lockfile, and production configuration were not modified. The database was in memory and closed after each run. All users, UUIDs, ratings and account states were synthetic. No environment files, production credentials, hosted databases or patient records were accessed. No Supabase connections were made; the only installation download was from npm.

Harness: `supabase/tests/session-storage-security.mjs`.
Full results, runtime version and migration SHA-256 hashes: `docs/reset-isolated-database-results.json`.

To repeat with the existing temporary installation:

```sh
RESET_PGLITE_DIR=/private/tmp/reset-db-test.Rt58W2 node supabase/tests/session-storage-security.mjs
```

The temporary installation can disappear when the OS cleans temporary storage. If recreating it, install `@electric-sql/pglite@0.5.8` into a fresh temporary directory, then set RESET_PGLITE_DIR to that directory. Do not install it in the application. The harness explicitly constructs an in-memory PGlite instance, not a network client. It reads the exact repository SQL files; errors cause a failing exit status. It writes results.json only in the runtime directory.

## What was tested

The fixture creates a minimal synthetic pre-auth `session_results` table and `auth.users`, plus separate NOSUPERUSER/NOBYPASSRLS roles `anon` and `authenticated`. It then applies the existing auth-foundation and trial-entitlement migrations to obtain the repository's actual ownership policies and entitlement functions. The complete production base-table definition is unavailable; unreported constraints/triggers are not reproduced.

Both release migration files were executed unchanged against that disposable fixture, in order:

1. `202610090000_session_results_deny_anon_insert.sql`
2. `202610090001_session_exercise_metadata.sql`

| Area | Result |
| --- | --- |
| Baseline anonymous INSERT before hardening | PASS: permitted, reproducing the reported exposure |
| Anonymous NULL-owner and forged-owner INSERT for all three types | PASS: rejected after hardening |
| Active trial and subscriber own INSERT for all three types | PASS: accepted |
| Authenticated cross-account, NULL-owner and missing-subject INSERT | PASS: rejected |
| Expired trial, revoked entitlement and missing account INSERT | PASS: rejected |
| Trial initialization RPC and anonymous RPC denial | PASS |
| Expired account reads its own history only | PASS |
| Client cannot change its own entitlement | PASS |
| Residual column-level and PUBLIC INSERT grants | PASS: restrictive RLS still rejects anonymous INSERT |
| Existing historical rows/ratings and NULL metadata | PASS: unchanged |
| NULL/NULL, zero/false, fractional duration/false, full duration/true | PASS: roundtrip preserved |
| Negative, NaN, positive infinity and negative infinity duration | PASS: rejected with CHECK violation |
| Old client omits metadata | PASS: INSERT succeeds with NULL fields |
| Metadata writes cannot bypass anonymous/ownership checks | PASS |
| Persisted zero/false read in a separate authenticated context | PASS: owner sees it; another user does not |
| Security rollback and reapplication | PASS: rollback restores exposure; reapplication denies again |

## Actual PostgreSQL enforcement versus simulated authentication

The tests use **actual PostgreSQL roles, GRANT/REVOKE, SET LOCAL ROLE, restrictive/permissive RLS policies, CHECK constraints and transactions**. Each role-scoped operation verifies current_user and that the role is neither superuser nor BYPASSRLS. Permission failures are asserted by SQLSTATE 42501; duration failures by 23514. Residual-grant tests also require an RLS-specific error, demonstrating the restrictive policy itself is enforced rather than merely a missing grant. Setup/admin inspection runs with fixture-owner privileges; security assertions run with the nonprivileged roles.

**Supabase authentication is simulated.** A fixture-only `auth.uid()` reads a synthetic request.jwt.claim.sub setting. The privileged test harness switches roles and supplies that setting. This does not verify real JWT signatures, session refresh, Supabase's role selection, or prevent a test administrator from forging the simulated subject. Role/context changes on this single-connection engine simulate separate authenticated requests, not concurrent HTTP requests or physical devices.

Entitlement decisions use the exact repository `consumer_has_active_entitlement()` function and policies. Trial/subscribed/revoked states are seeded directly as synthetic fixture data. No real subscription, payment, Stripe webhook or hosted auth operation is exercised.

## Remaining release risks and next action

The two prepared migrations are now locally database-tested and ready for explicit approval review, subject to:

- Confirm the production authenticated INSERT policy expression and entitlement function match the repository behavior tested here. Previously supplied findings confirmed the policy's presence/role but not its full expression.
- Confirm older supported deployments no longer need anonymous session inserts, or explicitly accept retirement of that saving path.
- PGlite PostgreSQL 18.3 is not necessarily the production PostgreSQL version. Hosted extensions, full original schema, other policies/functions, PostgREST schema-cache refresh, concurrent access, production table size/locking, and backup restoration were not tested.
- Direct clients remain able to exploit the existing production anonymous permission until approved hardening is applied. Application guards alone do not close that path.
- Metadata migration validation may scan and lock the production table. Its lock/statement timeouts can cause a safe failure under load; this tiny fixture does not predict production timing.
- Security rollback deliberately restores anonymous writes; use only with separate approval. Application rollback should retain nullable metadata columns and saved values.

Next: review these results, confirm the two production/legacy conditions above, then explicitly approve the security migration as a separate operation. Metadata migration approval and deployment approval follow independently, in that order. No production SQL, push, merge, or deployment has been performed or authorized by this test run.
