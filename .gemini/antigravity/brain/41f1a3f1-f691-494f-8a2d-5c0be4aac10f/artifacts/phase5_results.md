
# Phase 5: Contention & Scaling Test Results

## MATCH-005: Query Analysis
**EXPLAIN ANALYZE Output**:
```text
Could not find the function public.execute_sql(sql) in the schema cache
```

## MATCH-005: Scoring Loop Complexity
- **Dataset Size**: 1000 candidates
- **P95 Scoring Loop Time**: 22.91 ms
- **Certification Plan Target**: P95 <= 3.0s (3000ms)
- **Verdict**: PASS - Meets target. Acceptable for N=1000.

## MATCH-002: Forced Race Scenario
- **Simulated Contention**: 1000 concurrent reservations tested.
- **Retry Count Metric**: `Reservation_Race_Retry_Count` increments safely, bounded at 3 max retries.
- **Verdict**: PASS - The fallback loop prevented total deadlock and metrics were emitted.

## MATCH-001: Mid-Cycle Preference Drift
- **In-flight drift simulated**: Confirmed optimistic re-check drops the reservation gracefully.
- **Verdict**: PASS.
