-- PREPARED FOR REVIEW ONLY. DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL.
-- Gate: inspect session_results_insert_security.sql results first. Verify
-- authenticated does not inherit anon and is covered by its own INSERT policy.
-- Confirm legacy anonymous workflows have been retired or intentionally stopped.
-- Independent of the exercise-metadata migration; no column dependency.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE INSERT ON TABLE public.session_results FROM anon;

-- A restrictive policy also vetoes remaining column/PUBLIC/inherited grants.
-- Keep the existing permissive policy unchanged for a narrowly scoped rollback.
CREATE POLICY session_results_deny_anon_insert
  ON public.session_results
  AS RESTRICTIVE
  FOR INSERT
  TO anon
  WITH CHECK (false);

COMMIT;

-- ROLLBACK PROPOSAL ONLY; separate approval required. Reopens anonymous writes.
-- BEGIN;
-- DROP POLICY session_results_deny_anon_insert ON public.session_results;
-- GRANT INSERT ON TABLE public.session_results TO anon;
-- COMMIT;
