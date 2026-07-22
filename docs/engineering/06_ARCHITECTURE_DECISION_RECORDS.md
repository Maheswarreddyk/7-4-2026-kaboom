# Architecture Decision Records (ADRs)

Every major technical decision should be documented here to preserve institutional memory.

## Format
**ADR-XXX: [Title]**
- **Reason:** Why was this chosen?
- **Alternatives:** What was rejected?
- **Because:** Why were alternatives rejected?

## Examples

### ADR-001: Backend owns matchmaking lifecycle
- **Reason:** Prevent race conditions where two clients claim the same match.
- **Alternatives:** Frontend ownership.
- **Because:** Frontend ownership allows rogue clients to corrupt the queue.

### ADR-002: Atomic reservation
- **Reason:** Prevent duplicate matchmaking where a user is assigned to two different partners simultaneously. The database PL/pgSQL function locks rows during selection.

### ADR-003: Adaptive Matchmaking (SMART/EXACT)
- **Reason:** To maximize connection success (liquidity) while respecting user preferences. Strict matching leads to empty queues in early stage startups.
- **Alternatives:** Hard failing strict filters.
- **Because:** Hard failing results in users seeing "Nobody is online", increasing churn.
