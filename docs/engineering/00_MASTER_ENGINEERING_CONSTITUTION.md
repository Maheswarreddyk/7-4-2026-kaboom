# Kaboom Engineering Constitution

**Version:** 1.0
**Status:** Mandatory

This document defines the engineering principles that govern every change made to Kaboom.

Every implementation, bug fix, refactor, feature, migration, deployment, and investigation must follow this constitution.

No work may begin without first understanding these principles.

## Mission
The objective is not to complete tasks. The objective is to build a production-grade anonymous video platform that remains reliable, understandable, scalable, and maintainable as it evolves. Every change should improve the system, not merely satisfy the current request.

## Engineering Philosophy
Always optimize for:
- Correctness
- Simplicity
- Reliability
- Observability
- Maintainability
- Consistency
- Extensibility

Never optimize merely for speed of implementation.

## Architecture First
Never begin by editing code. Always understand the architecture first.
Before changing anything:
1. Identify where the component sits in the overall architecture.
2. Identify all dependencies.
3. Identify downstream consumers.
4. Identify upstream producers.
5. Understand how the proposed change affects the rest of the system.

If the architecture is not understood, stop and investigate before coding.

## Whole-System Thinking
Never think about a single file. Always think about the entire platform.
For every change, consider:
- Frontend
- Backend
- Database (Stored Procedures, Supabase)
- Realtime
- WebRTC
- Dashboard & Simulator
- Monitoring & Deployment

A local change is never assumed to be isolated.

## No Blind Fixes
Never fix an error simply because it appears in logs. Determine:
1. Why it occurred.
2. What architectural assumption failed.
3. Whether similar assumptions exist elsewhere.
Fix the cause, not only the symptom.

## Dependency Awareness
Before modifying anything, identify:
- Files that depend on this component.
- Components this code depends on.
- Database objects affected.
- APIs affected.
- Frontend/Simulator behavior affected.
Every dependent component must be reviewed before implementation.

## Contract Consistency
Whenever a contract changes, review all consumers.
Examples: Database schema, RPC return types, Enums, API payloads, Realtime messages, TypeScript interfaces, Generated Supabase types.
**A contract change is not complete until every consumer is updated.**

## Rules of Engagement
- **Database Rules:** Review Tables, Indexes, Constraints, Foreign Keys, Triggers, Functions, Views, RLS Policies, Migrations, and Generated Types.
- **Matchmaking Rules:** Preserve Queue integrity, Reservation integrity, Atomic transactions, Duplicate prevention, Fairness, Explainability, Cleanup, and Idempotency.
- **WebRTC Rules:** Verify Offer -> Answer -> ICE -> Connection -> Cleanup. Never assume signaling works just because a match exists.
- **Frontend Rules:** Verify State transitions, Loading states, Error states, Realtime updates, Cleanup, Refresh, and Reconnect.

## Evidence Before Conclusion
Never declare: "Fixed." Instead, provide evidence (Database rows, API responses, Browser logs, Realtime events, Screenshots, Timelines, Metrics). Every conclusion should be supported by evidence.

## Continuous Self-Review
Before every implementation ask:
- What assumptions am I making? Have I verified those assumptions?
- Could another subsystem break? Could this introduce regression?
- Is there a simpler design?
If any answer is uncertain, investigate before coding.

## Regression Policy
After every meaningful change, review all subsystems. A change is incomplete until regression checks pass.

## Incremental Development
Never implement multiple architectural ideas simultaneously. 
One change. -> Verify. -> Review. -> Continue. 

## Production Verification & Incident Investigation
Local success is not enough. Verify against the intended environment.
When a bug is discovered, do not stop at the first error. Continue until the Root cause is identified, Architectural cause is understood, Similar patterns are audited, and Regression checks pass.

## Code Quality
Every change should leave the codebase in a better state than before. Avoid duplicate logic, hidden assumptions, tight coupling, magic values, and unclear naming.

## Final Principle
Every decision should make Kaboom easier to understand, easier to maintain, and more reliable than it was before. If a change solves today's problem but increases tomorrow's complexity, redesign it before implementing it.
