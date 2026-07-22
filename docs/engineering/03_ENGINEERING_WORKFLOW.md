# Engineering Workflow

This tells all agents and engineers HOW to work on Kaboom.
Never jump directly into coding. Follow this exact flow:

## 1. Understand
Read the Constitution and verify you grasp the domain.

## 2. Architecture Review
Identify where the requested change lives in the system map.

## 3. Dependency Analysis
Identify all upstream producers and downstream consumers of the component.
- Example: If changing a Postgres ENUM, you must check TypeScript types, backend parsers, and frontend UI logic.

## 4. Design
Plan the implementation. Consider trade-offs. 

## 5. Implementation
Write the code. Follow incremental development rules (one architectural change at a time).

## 6. Static Review
Run TypeScript checks (`tsc --noEmit`), linting, and schema validations.

## 7. Runtime Review
Run the application locally. Trigger the changed paths.

## 8. Regression
Ensure existing invariants and unrelated subsystems still function perfectly. 

## 9. Documentation
Update `06_ARCHITECTURE_DECISION_RECORDS.md` or `11_PROJECT_MEMORY.md` to reflect what changed and why.

## 10. Certification
Use the Digital Twin (Simulator) or manual end-to-end device testing to prove the fix works. Provide evidence.

> **CRITICAL:** Do not declare a task "Fixed" without executing Step 10.
