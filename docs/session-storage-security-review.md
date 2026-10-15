# Session storage security preparation

Update 2026-10-11: both prepared migrations have now passed 43 isolated PGlite database checks. See [database verification](reset-isolated-database-testing.md) for results and limitations; earlier untested/unavailable statements below describe the prior preparation stage. Production migrations remain unapplied.

Local branch: `feature/reset-interventions`. No production credentials read, SQL executed, services contacted, or changes pushed/deployed. The user supplied the production privilege findings. SQL below is prepared only, not database-tested.

## Application safeguards

- Production cannot use the unauthenticated `App.js` save fallback. Only the isolated development mock client and explicitly simulated mock tests may use it. An `environment` prop cannot enable mocks in a production build.
- New pending sessions retain their starting `ownerUserId`. Per-user local storage refuses to move an owned record into another account. An account change during an exercise saves completed measurements under the original owner without attempting a cloud insert.
- The account repository rejects missing users, mismatched owners, missing tokens, mismatched signed-in users, auth-refresh errors, and tokens still expired after `getSession()`. Supabase may refresh an expired session normally; a successfully refreshed session belonging to the original user can save.
- Completed measurements are cached before network saving. Failed saves retain ratings, metadata and the original UUID in the original user's cache. Signing out does not clear that cache. After the original user signs in, History offers Retry save for pending/failed records. Another account cannot retry those records through the UI. Stale hook callbacks after an account switch are rejected.
- Historical cache entries without an owner remain associated with their existing per-user storage namespace. There is no automatic import from anonymous `sessionLog`, backfill, or transfer between accounts.
- Pending storage is browser-local, not encrypted. Clearing storage can destroy unsynced measurements. This change does not add recovery of an unfinished exercise that is unmounted before completion/after-ratings, and does not label unfinished exercises as completed sessions.
- Client checks are defense in depth, not an authorization boundary. JWT expiry/account switching between checks and the request remains possible; database ownership/entitlement policies and the proposed anonymous deny must enforce authorization. This is why application deployment alone does not close direct anonymous API inserts.

## Read-only inspection to run manually

Use `supabase/inspection/session_results_insert_security.sql`. It has four SELECT result sets; run each separately if SQL Editor displays only the final result. It reads system catalogs only, not session records.

1. `authenticated_member_of_anon` reports direct/indirect membership. `authenticated_inherits_anon` reports immediately available inherited privileges without SET ROLE. The reverse direction and role bypass flags are also shown. Unexpected membership or superuser/BYPASSRLS flags require review before applying the draft.
2. All INSERT and ALL-command policies, including roles, permissive/restrictive status, USING and WITH CHECK expressions. Verify an authenticated owner/entitlement INSERT policy exists and that no unexpected broad policies undermine it. NULL WITH CHECK on ALL policies may fall back to USING; inspect both.
3. Effective table and column INSERT privileges plus schema USAGE for anon and authenticated. Verify authenticated retains the needed privileges independently of anon. Effective permissions alone do not prove an insert will pass RLS.
4. Raw table/column INSERT and schema USAGE ACL entries for all grantees, including PUBLIC and possible inherited roles. Table-level grants apply to columns too, even without individual column ACL entries. Inspect any PUBLIC entries explicitly.

## Separate security migration and rollback

Draft: `supabase/migrations/202610090000_session_results_deny_anon_insert.sql`.

It revokes the direct anon table INSERT grant and adds a restrictive INSERT policy for anon with CHECK false. The restrictive denial also vetoes remaining column-level/PUBLIC/inherited INSERT grants while RLS applies. It deliberately retains `Allow anon inserts` unchanged so the rollback is small. It does not touch SELECT policies, authenticated grants, existing data, subscription configuration, or metadata columns. RLS must remain enabled. Privileged services/table owners or SECURITY DEFINER functions can bypass RLS; this is not a comprehensive audit of all live database functions.

Approval gates: inspect the query results, particularly role membership and authenticated policies, and resolve supported legacy dependencies. Unexpected role inheritance must be reviewed before applying this policy because it could also affect authenticated requests. SQL is transactional with short lock and statement timeouts. A preexisting policy of the same name causes failure rather than silent replacement.

Rollback SQL is included as comments in the migration: drop only the new restrictive policy and restore the direct anon INSERT grant. Capture the original ACLs/policies before applying any change. Rollback requires separate approval and reopens the anonymous-write exposure; prefer repairing authenticated configuration instead. No metadata removal or data rollback is needed.

## Legacy dependence and remaining uncertainty

The current production entry point requires authentication and entitlement for `/app`; trials initialize through authenticated RPCs. Neither current trials nor subscribers require anon inserts. Account history is authenticated but not entitlement-gated, so expired users retain their existing own-history access. Local consumer/admin previews use mock storage only. Checkout and webhook code do not insert session records.

Three unreferenced backup implementations still contain ownerless `saveCravingSession` inserts: `src/App-backup-2026-07-11.js`, `src/App.10:07:26js`, and `src/Backups/React/App-admin-analytics-v1.js`. The original auth migration explicitly preserved anonymous inserts. Older published bundles, alternate Netlify URLs, external clients and long-lived browser tabs could therefore depend on anonymous writes. Repository inspection cannot establish the exact currently deployed artifact or whether those legacy clients remain supported. No remote deployment inventory, access logs, live RLS definitions beyond user-supplied findings, or live function inventory was inspected.

Before approval, the owner should confirm supported deployment versions and decide whether legacy anonymous saving can be intentionally retired. If any supported workflow still requires it, migrate that workflow to authentication first. Do not silently attach anonymous historical records to users based on device IDs.

## Release sequence and validation

1. Review the read-only query results and legacy-client inventory. Approve implementation independently from production operations.
2. Test the security policy in a separately approved disposable PostgreSQL/Supabase fixture. Verify anon NULL-owner and forged-owner inserts fail, including column grants; active trial/subscriber own inserts succeed; cross-owner and expired/revoked entitlement inserts fail; own-history SELECT remains available. Mock tests cannot prove real RLS enforcement. No SQL tests have been executed.
3. After explicit approval, apply the security migration independently of the metadata change. It has no metadata-column dependency and sorts before it. Current authenticated clients should continue working; legacy anonymous writes intentionally stop.
4. After separate approval, apply and verify the metadata migration and API schema visibility. Do not blindly run all pending migrations as a batch.
5. Only after both gates, separately approve application deployment. The new client depends on the metadata columns. If legacy compatibility requires an earlier auth-only client release, prepare a separate patch without metadata-dependent queries.

Automated application regressions cover missing/expired authentication, original-owner retry after logout/account switching, same-ID retries, zero/false metadata, historical records, all three interventions, mock review, and existing subscription function behavior. They use mocks/network guards. Production build validation uses placeholder service configuration with dotenv loading disabled and does not serve the generated artifact.

Preparation validation: 149 frontend tests across 19 suites and 16 function tests across two suites passed. The optimized production build compiled successfully with dummy configuration and dotenv disabled. Build tooling emitted existing Browserslist-data and Node deprecation notices. `git diff --check` passed. SQL and live database behavior remain untested; no deployment is recommended until the approval gates above are satisfied.
