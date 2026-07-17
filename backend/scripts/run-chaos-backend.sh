#!/bin/bash
# Chaos Runner for Backend
# Randomly kills and restarts the Node.js backend every 15-45 seconds

export CHAOS_DB_LATENCY=true

echo "============================================="
echo "🔥 STARTING KABOOM BACKEND IN CHAOS MODE 🔥"
echo "============================================="

while true; do
  echo "[Chaos] Booting Node.js backend..."
  
  # Start the backend in the background
  npx tsx src/index.ts &
  BACKEND_PID=$!
  
  # Calculate a random uptime between 15 and 45 seconds
  UPTIME=$(( (RANDOM % 30) + 15 ))
  
  echo "[Chaos] Backend will be killed in $UPTIME seconds (PID: $BACKEND_PID)"
  
  # Wait for the calculated uptime
  sleep $UPTIME
  
  # Kill the backend
  echo "[Chaos] 💥 KILLING BACKEND (Simulated Infrastructure Failure) 💥"
  kill -9 $BACKEND_PID
  
  # Brief downtime before restart
  DOWNTIME=$(( (RANDOM % 5) + 2 ))
  echo "[Chaos] Infrastructure down for $DOWNTIME seconds..."
  sleep $DOWNTIME
done
