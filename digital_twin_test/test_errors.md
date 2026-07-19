# Digital Twin Load Test Errors

**Monitoring started.**
Currently observing 100 simulated users over a 30-minute window.

## Iteration 1
No errors detected yet. Users are currently spawning and beginning their journeys.

## Iteration 2
- **Timeout Issues (10 Users):** 10 users failed with `Timeout waiting for match`. 
  - *Context*: The test framework currently throws an error if a user waits in the matchmaking queue for more than 60 seconds without finding a partner. Given that 100 users are arriving over a 30-minute period (roughly 1 user every 18 seconds) and they have randomized matching preferences (Gender and Looking For), a 60-second wait time might not be sufficient to find a compatible partner for many users. This is behaving like real-world low-liquidity matching, but is registering as an "Error" in the test script.

## Iteration 3
- **Timeout Issues Continue (33/40 Users):** Out of 40 users spawned so far, 33 have timed out waiting for a match. The error remains identical (`Timeout waiting for match`). No database timeouts or PGRST failures have been detected.
