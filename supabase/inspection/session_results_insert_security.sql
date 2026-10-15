-- READ ONLY: catalog metadata and privilege checks only. No session rows read.
-- Run manually in SQL Editor. Review all four result sets (or run each SELECT separately).

-- 1. MEMBER includes indirect membership. USAGE indicates immediately available
-- inherited privileges, without SET ROLE. Both directions help identify unusual roles.
SELECT
  pg_has_role('authenticated', 'anon', 'MEMBER') AS authenticated_member_of_anon,
  pg_has_role('authenticated', 'anon', 'USAGE') AS authenticated_inherits_anon,
  pg_has_role('anon', 'authenticated', 'MEMBER') AS anon_member_of_authenticated,
  pg_has_role('anon', 'authenticated', 'USAGE') AS anon_inherits_authenticated,
  r.rolname, r.rolinherit, r.rolsuper, r.rolbypassrls
FROM pg_roles r
WHERE r.rolname IN ('anon', 'authenticated');

-- 2. INSERT and ALL policies, including permissive/restrictive status and roles.
SELECT p.polname AS policy_name,
  CASE p.polcmd WHEN 'a' THEN 'INSERT' WHEN '*' THEN 'ALL' END AS command,
  p.polpermissive AS permissive,
  ARRAY(SELECT CASE WHEN role_oid = 0 THEN 'PUBLIC'
                    ELSE pg_get_userbyid(role_oid)::text END
        FROM unnest(p.polroles) AS roles(role_oid)) AS policy_roles,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expression
FROM pg_policy p
WHERE p.polrelid = to_regclass('public.session_results')
  AND p.polcmd IN ('a', '*')
ORDER BY p.polname;

-- 3. Effective privileges include applicable inherited/PUBLIC grants.
SELECT r.rolname,
  has_schema_privilege(r.oid, 'public', 'USAGE') AS schema_usage,
  has_table_privilege(r.oid, c.oid, 'INSERT') AS table_insert,
  has_any_column_privilege(r.oid, c.oid, 'INSERT') AS any_column_insert,
  c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
  pg_get_userbyid(c.relowner) AS table_owner,
  (SELECT jsonb_agg(jsonb_build_object(
     'column', a.attname,
     'can_insert', has_column_privilege(r.oid, c.oid, a.attnum, 'INSERT')
   ) ORDER BY a.attnum)
   FROM pg_attribute a
   WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  ) AS effective_column_insert_privileges
FROM pg_roles r
CROSS JOIN pg_class c
WHERE r.rolname IN ('anon', 'authenticated')
  AND c.oid = to_regclass('public.session_results');

-- 4. Explicit INSERT ACL entries for ALL grantees, including PUBLIC and
-- roles from which anon/authenticated might inherit. Include schema USAGE.
WITH grants AS (
  SELECT 'table'::text AS scope, c.relname::text AS object_name, acl.*
  FROM pg_class c
  CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
  WHERE c.oid = to_regclass('public.session_results') AND acl.privilege_type = 'INSERT'
  UNION ALL
  SELECT 'column', a.attname::text, acl.*
  FROM pg_attribute a
  CROSS JOIN LATERAL aclexplode(a.attacl) acl
  WHERE a.attrelid = to_regclass('public.session_results')
    AND a.attnum > 0 AND NOT a.attisdropped AND acl.privilege_type = 'INSERT'
  UNION ALL
  SELECT 'schema', n.nspname::text, acl.*
  FROM pg_namespace n
  CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
  WHERE n.nspname = 'public' AND acl.privilege_type = 'USAGE'
)
SELECT scope, object_name,
  CASE WHEN grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee)::text END AS grantee,
  pg_get_userbyid(grantor) AS grantor, privilege_type, is_grantable
FROM grants
ORDER BY scope, object_name, grantee;
