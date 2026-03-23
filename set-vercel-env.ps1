# Set all Vercel production environment variables for mfo-crm
# Run from repo root after `vercel login`

$vars = @{
    "NEXT_PUBLIC_FB_API_KEY"             = "AIzaSyAJBVgI_Vjx6gPjBW0PHBamiCzQVHpZt8o"
    "NEXT_PUBLIC_AUTH_DOMAIN"            = "mfo-crm.firebaseapp.com"
    "NEXT_PUBLIC_PROJECT_ID"             = "mfo-crm"
    "NEXT_PUBLIC_STORAGE_BUCKET"         = "mfo-crm.firebasestorage.app"
    "NEXT_PUBLIC_MESSAGING_SENDER_ID"    = "597083102550"
    "NEXT_PUBLIC_APP_ID"                 = "1:597083102550:web:a6067a7a2c460629"
    "MICROSOFT_TENANT_ID"                = "common"
}

foreach ($key in $vars.Keys) {
    $val = $vars[$key]
    Write-Host "Setting $key..."
    $val | npx vercel env add $key production --yes 2>&1 | Out-Null
    Write-Host "  -> Done"
}

Write-Host ""
Write-Host "All public env vars set. OAuth secrets (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET,"
Write-Host "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FIREBASE_ADMIN_SDK_JSON) must be set manually"
Write-Host "via Vercel Dashboard -> Settings -> Environment Variables once you have those values."
