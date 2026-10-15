-- READ ONLY. Run manually if approved. No session records are read.
-- Privilege functions include effective PUBLIC/inherited privileges.
WITH target AS (
  SELECT
    to_regclass('public.session_results') AS table_oid,
    (SELECT oid FROM pg_roles WHERE rolname = 'anon') AS role_oid
)
SELECT
  t.table_oid IS NOT NULL AS table_exists,
  t.role_oid IS NOT NULL AS anon_role_exists,
  has_schema_privilege(t.role_oid, 'public', 'USAGE') AS anon_schema_usage,
  has_table_privilege(t.role_oid, t.table_oid, 'INSERT') AS anon_table_insert,
  has_any_column_privilege(t.role_oid, t.table_oid, 'INSERT') AS anon_any_column_insert,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'column', a.attname,
        'can_insert', has_column_privilege(t.role_oid, t.table_oid, a.attnum, 'INSERT')
      ) ORDER BY a.attnum
    )
    FROM pg_attribute a
    WHERE a.attrelid = t.table_oid
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) AS effective_column_insert_privileges
FROM target t
LEFT JOIN pg_class c ON c.oid = t.table_oid;
