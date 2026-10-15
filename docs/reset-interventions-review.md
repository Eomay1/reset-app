# RESET interventions: local review

Branch: `feature/reset-interventions`.

## Run the isolated review

```sh
npm run start:review
```

Open **http://127.0.0.1:3001**. Confirm the yellow **Local review** banner before completing sessions. This mode:

- renders the app without contacting authentication or billing services;
- substitutes a local mock for Supabase (no live client is created);
- stores review data under `reset-review:` browser-storage keys;
- persists test sessions across reloads and supplies them to the administrator preview;
- selects mocks for every development run, whether or not a review flag is set;
- strips Supabase, Stripe, Netlify, and `REACT_APP_*` configuration from the development process and prevents dotenv from restoring it; mock placeholder credentials are used;
- binds only to `127.0.0.1`, disables backend proxies, and does not run Netlify Functions;
- sends an enforced Content Security Policy that blocks fetch/XHR API connections, external sockets, form submissions, and frames. Only local hot-reload WebSockets are allowed;
- installs the same policy in the browser as an additional development safeguard;
- leaves production authentication and services unchanged. Production builds cannot select the review mode.

Both `npm start` and `npm run start:review` now use this same isolated launcher. The existing `.env` file is not edited. The isolated review does not simulate authentication/subscription management; those boundaries are covered by mocked regression tests.

Do not serve the `build/` production artifact or run `netlify dev` for this review. Those are separate execution paths and can use real service configuration. No production build has been served or deployed. The browser policy is a development safeguard, not a guarantee against someone deliberately removing safeguards or running another server.

Netlify's remote production-branch, preview, and build-hook settings have not been verified because authenticated access is unavailable. Work remains local; no push, hosted preview, merge, migration, or deployment is authorized. A branch alone is not an enforced deployment lock.

## Walkthrough

1. **Breathing RESET:** supply craving and anxiety ratings (1–10), use the existing breathing circle, then Continue RESET. Try Breathe Again and the optional Channel Energy action before completing both post-ratings. Verify the summary and selected action.
2. **Acupressure RESET:** choose Wrist Calm, Chest Calm, or Mind Calm, supply both before ratings, and start the existing visual guide. Check pulse markers, pause/resume, restart, and exit. Wrist Calm offers an optional second 60-second interval after the first wrist; the other exercises use one 60-second interval. Choose Finish & Rate at any point (including while paused), complete both post-ratings, and verify the summary. Exit Without Saving abandons the session without recording it.
3. **Grounding RESET:** supply before ratings, then notice 5 things you see, 4 you feel, 3 you hear, 2 you smell, and 1 you taste. Tap each numbered item or skip a step. Complete both post-ratings. Exit partway through a new exercise and verify that it does not add a completed session.
4. Return home and verify the completed-session total and averages. Start another intervention and confirm its ratings are blank.
5. Choose **Administrator** in the development preview toolbar, then **Analytics**. Verify all three completed sessions contribute to the existing dashboard. Select each intervention filter and compare session counts, craving changes, stress levels, mood summaries, and charts. Return to All interventions to restore the combined report.
6. Use a narrow browser viewport (390px and 320px are useful checks) and keyboard navigation. Grounding supports focus changes, labelled item toggles, and step progress. Existing acupressure reduced-motion styling is retained.

The administrator dashboard remains the existing development-only preview; this upgrade does not create a production clinician role or change data-access rules.

To inspect mock saved records in browser DevTools:

```js
JSON.parse(localStorage.getItem('reset-review:cloud-sessions'))
```

To clear **only review data**:

```js
Object.keys(localStorage)
  .filter(key => key.startsWith('reset-review:'))
  .forEach(key => localStorage.removeItem(key));
location.reload();
```

## Compatibility and database gate

All interventions share the existing rating fields and save/retry pipeline. `stress_level` continues to reflect the post-session anxiety/stress rating. Stored intervention values are:

- Breathing: `craving_reset` (existing value retained)
- Acupressure: `acupressure_reset`
- Grounding: `grounding_reset`

No historical rows are rewritten. Records without a type are labelled Historical RESET and included in the Breathing filter for compatibility with the former breathing-only session flow. Unknown historical types remain in All interventions. Missing historical ratings continue to display safely. Saved account history displays intervention labels.

Completed breathing sessions that offer another exercise remain saved. “Try Wrist Calm” and “Repeat Breathing” from that completed-session prompt start separate sessions with fresh ratings and IDs. Repeating breathing before completing the initial session remains part of that session. No Mixed RESET is implemented.

The chosen acupressure point is retained as local session metadata; the intervention type and all four ratings are persisted through the existing database columns. This change does not add point-level database reporting.

The user’s manual production schema inspection confirmed that `intervention_type` is nullable unrestricted text and accepts all three values. The two exercise metadata columns are absent. The prepared migration and cloud mappings require separate approval and schema deployment before any application release. See [cloud storage review](session-metadata-cloud-review.md). No production inspection was performed by the development agent.

No live Supabase data/schema, Stripe configuration, subscription logic, deployment configuration, or production deployment was changed.

## Automated checks

```sh
CI=true npm test -- --watchAll=false --runInBand
npm run test:functions
npm run build
```

Frontend tests mock Supabase and billing. Function tests inject mock Stripe/Supabase clients. Both test commands install a safety net that rejects unmocked fetch, HTTP(S), and TCP connections; browser tests also reject unmocked XHR and WebSocket access. The build creates local files only; it does not deploy.


## Acupressure duration and sequence status

New acupressure sessions retain `activeDurationSeconds` and `guidedSequenceCompleted` in local session storage. The running timer uses a monotonic clock, excludes pauses and wrist-switch/completion screens, and caps each interval at its configured length if browser timer delivery is delayed. Time from restarted attempts remains part of active duration. This measures time with the exercise timer running, not whether the user physically applied pressure.

A full guided sequence means all configured intervals finished normally (both wrists for Wrist Calm; one interval for Chest Calm or Mind Calm). Finishing after only the first wrist, or partway through either interval, records `false`. Accumulating enough seconds through restarts does not by itself complete the sequence. Both after-ratings are still required before saving a session. Exiting does not save a completed record.

The prepared Supabase payload now includes nullable `active_duration_seconds` and `guided_sequence_completed`, and account history reads them across devices. Cloud zero and false values are preserved. Historical NULL metadata stays unknown; no duration is inferred from timestamps or nominal exercise length. Genuine local metadata survives a NULL cloud value and is labelled “this device only”; cloud metadata is labelled “synced”. Dashboard completed-session counts mean rated sessions, not completed treatment protocols.

### Prepared database extension — NOT applied

`supabase/migrations/202610090001_session_exercise_metadata.sql` adds nullable numeric duration and boolean sequence status, without defaults or backfill. Its check rejects negative and nonfinite durations. No RLS policies change. Existing duplicate records are not updated: local metadata on those records remains device-only unless separately migrated with approval.

The new client requires these columns. Apply and verify the migration only after explicit approval, before any separately approved application deployment. Until then, use the isolated mock review only. See [cloud storage review](session-metadata-cloud-review.md) for security findings and rollout risks.
