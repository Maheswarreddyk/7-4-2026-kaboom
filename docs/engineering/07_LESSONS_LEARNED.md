# Lessons Learned

Every production issue must be recorded here so that the same class of mistake doesn't recur.

## Lesson 001: ENUM Mismatch Database Crash
- **Cause:** Database schema was updated to add `SMART` and `EXACT` match modes to `match_mode_type`. The production database was not updated to match local, and backend/frontend TS types were not updated.
- **Result:** Silent Postgres crashes when casting strings to ENUMs, leaving users stuck searching forever.
- **Prevention:** Audit all ENUMs and TS interfaces after every migration.

## Lesson 002: RPC Return Type Parsing
- **Cause:** The `execute_matchmaking` RPC was rewritten to return a JSON object (`{success, match_id}`) for telemetry purposes, replacing a flat UUID return. The backend API was forgotten.
- **Result:** Backend queried the UUID column using a JSON object, failing silently and never emitting Realtime events.
- **Prevention:** Strict Contract Review Checklist. Whenever an RPC signature changes, grep the backend for all usages.

## Lesson 003: PostgREST Schema Cache
- **Cause:** Migration was applied via SQL, but Supabase PostgREST cache was stale.
- **Result:** RPC calls failed with "function does not exist" or schema errors.
- **Prevention:** Always reload the PostgREST cache (`NOTIFY pgrst, reload schema`) after applying direct SQL migrations.
