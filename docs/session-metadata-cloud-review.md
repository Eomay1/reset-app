# Prepared cloud metadata changes — approval pending

Prepared locally on `feature/reset-interventions`. No SQL was executed, production credentials accessed, database connections made, policies changed, or services deployed. Production schema findings below were supplied by the user after their manual inspection.

## Schema and migration

`intervention_type` is nullable unrestricted text; no alteration is needed for `craving_reset`, `acupressure_reset`, or `grounding_reset`. The two metadata columns are absent.

Draft: [`202610090001_session_exercise_metadata.sql`](../supabase/migrations/202610090001_session_exercise_metadata.sql).

- Adds nullable `active_duration_seconds numeric` and `guided_sequence_completed boolean`.
- No defaults or backfill: historical and old-client sessions retain NULL (unknown).
- Duration check accepts zero and finite positive values, rejecting negatives, infinities, and numeric NaN. PostgreSQL numeric NaN sorts above infinity, so the strict upper bound rejects it. NULL passes the check.
- No intervention-type, ownership, entitlement, grant, or RLS changes.
- Transactional, with a five-second lock timeout and thirty-second statement timeout. Schema drift causes failure rather than silently accepting incompatible columns. The ALTER requires a table lock; validation may scan the table. Schedule an approved application window appropriate to table size and activity. If it times out, roll back the failed transaction before retrying; do not assume it applied.

This is backward-compatible for existing clients that name insert columns and omit the new fields. Consumers relying on positional inserts or exact `SELECT *` shapes outside this repository should be checked before approval. SQL has been reviewed but not executed or database-tested.

## Application preparation

The account session repository serializes and retrieves both fields. Existing ratings, intervention values, ownership filters, pagination, UUIDs, duplicate ownership verification, and retry behavior are preserved. Invalid new metadata is rejected before constructing a write query. Zero duration and false completion are real values, not missing data.

Account history on a fresh device reads cloud metadata without needing the originating device cache. Historical NULL values remain unknown. When a historical cloud row has NULL metadata, genuine device measurements remain visible with a device-only label. Database values take precedence when present. Neither timestamps nor standard protocol lengths supply missing measurements.

Retries retain the original session ID and metadata. An existing owned duplicate is considered saved without updating it, as before. Consequently, previously saved rows do not acquire metadata retroactively; those values may remain device-only. No UPDATE privilege or backfill is added.

Only acupressure currently measures exercise metadata; breathing and grounding continue saving their types and ratings with NULL metadata. The review environment remains mock-only. Cross-device tests simulate separate device caches and authenticated cloud responses; they do not contact Supabase or prove live RLS configuration.

## Anonymous insert assessment

The user confirmed RLS is enabled and `Allow anon inserts` permits the anon role with `WITH CHECK (true)`. The existing local auth-foundation migration also grants table INSERT to anon, but live effective privileges still require the separate manual query below.

The current production `/app` route requires authentication and entitlement; account saves carry `user_id` and use the authenticated workflow. A Supabase publishable/anon key used with a signed-in user JWT does not make that request an anonymous-role insert. Neither sign-in nor the Stripe checkout/webhook workflow requires anonymous inserts into `session_results`.

The unauthenticated fallback in `App.js` is now explicitly limited to mock review. Production account writes additionally verify the current auth session and original owner before inserting. See [session storage security preparation](session-storage-security-review.md). Legacy deployed bundles, long-lived tabs, or external callers might still depend on anonymous inserts. Repository inspection cannot establish their absence. Therefore, the policy appears unnecessary for the current authenticated consumer workflow, but removal requires a separately approved dependency and production rollout assessment.

If anon has schema USAGE and sufficient INSERT privileges, the permissive policy permits unauthenticated inserts subject to other applicable restrictions, defaults, and constraints. It does not enforce authenticated ownership or entitlement. That can allow fabricated sessions and potentially spoofed user attribution, affecting data integrity and reporting. Table-wide INSERT privileges also cover the newly added columns. No exploit or live write was attempted. RLS being enabled alone does not close this path.

No grants or RLS changes are included. Consider anonymous-write hardening separately after checking legacy dependencies; do not silently bundle it with this additive migration.

## Manual read-only privilege inspection

Run [`session_results_anon_insert_privileges.sql`](../supabase/inspection/session_results_anon_insert_privileges.sql) manually in Supabase SQL Editor. It reads only system catalogs and privilege functions, not session records.

- `anon_schema_usage = true` and `anon_table_insert = true`: anon has the basic effective table-level permission for inserts, including privileges inherited or granted through PUBLIC. RLS and other database restrictions still apply.
- Table INSERT false but `anon_any_column_insert = true`: some column-level inserts may be allowed; inspect the per-column results. This does not mean arbitrary complete rows are insertable.
- Both INSERT results false: the policy alone does not grant direct INSERT permission.
- False schema USAGE prevents ordinary access through that schema. Defaults requiring sequences/functions may introduce additional permissions. This query does not audit SECURITY DEFINER functions or every indirect write path.

## Approval and rollout risks

1. Review and explicitly approve the migration before anyone executes it. It has not been applied.
2. After approved execution, verify the resulting columns and API schema-cache visibility. Old clients can continue operating during this phase.
3. Separately approve deployment of the new client only after the schema is ready. The new selects/inserts depend on these columns; deployment first would cause cloud read/save errors. Local pending records and existing retry behavior remain, but there is no silent fallback that drops metadata.
4. Review anonymous-insert hardening independently. This migration neither creates nor removes the existing anonymous-write exposure.

If an application rollback is needed, retain the nullable columns and stored metadata. Do not drop them as part of a client rollback. No push, merge, migration execution, or deployment is authorized by preparing these files.
