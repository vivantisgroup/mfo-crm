$lines = Get-Content pulled_v2.env
$envLine = ""
foreach ($ln in $lines) { if ($ln.StartsWith("FIREBASE_ADMIN_SDK_JSON=")) { $envLine = $ln; break } }
$localEnv = Get-Content .env.local -Raw
$localEnv = $localEnv -replace '(?m)^F\r?\n\r?\n', "$envLine`n"
Set-Content -Path .env.local -Value $localEnv
Write-Host "INJECTED_V2"
