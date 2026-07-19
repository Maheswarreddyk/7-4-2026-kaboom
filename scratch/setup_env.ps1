$envFile = "C:\Users\coding\Desktop\indiaTV\backend\.env"
$backupFile = "C:\Users\coding\Desktop\indiaTV\backend\.env.backup"
$phase6File = "C:\Users\coding\Desktop\indiaTV\supabase\.env.phase6test"

# Backup
Copy-Item $envFile $backupFile -ErrorAction SilentlyContinue

# Create temp env mapped to phase 6
$content = Get-Content $phase6File
$content = $content -replace "TEST_SUPABASE_URL", "SUPABASE_URL"
$content = $content -replace "TEST_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"
$content = $content -replace "TEST_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"
Set-Content -Path $envFile -Value $content
