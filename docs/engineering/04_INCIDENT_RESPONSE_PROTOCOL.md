# Incident Response Protocol

Every bug follows this exact flow.

## The NEVER Flow
❌ Bug -> Fix -> Done

This flow is banned because it hides architectural drift and guarantees the bug will return elsewhere.

## The MUST Flow
Problem
  ↓
Reproduce (Observe the failure in logs, DB, or UI)
  ↓
Trace (Map the exact path the failure took through the architecture)
  ↓
Find Root Cause (What line of code/schema specifically failed?)
  ↓
Find Architectural Cause (Why did the system allow this to fail?)
  ↓
Search Similar Issues (Do other RPCs/APIs share this flaw?)
  ↓
Fix (Implement the correction)
  ↓
Regression (Run typechecks and simulators)
  ↓
Certification (Prove the fix end-to-end with evidence)
  ↓
Close Incident
