-- PREPARED FOR REVIEW ONLY. Not executed. Requires explicit approval to apply.
-- intervention_type is already unrestricted text; do not alter it or any RLS policy.
-- Nullable, with no defaults or backfill: historical metadata remains unknown.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.session_results
  ADD COLUMN active_duration_seconds numeric NULL,
  ADD COLUMN guided_sequence_completed boolean NULL,
  ADD CONSTRAINT session_results_active_duration_seconds_valid
    CHECK (
      active_duration_seconds >= 0
      AND active_duration_seconds < 'Infinity'::numeric
    );

COMMIT;
