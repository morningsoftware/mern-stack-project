$ErrorActionPreference = "Stop"

$MobileDir = Join-Path $PSScriptRoot "mobile"
$HostedApi = "https://checkpoint.morning.codes"

if (-not (Test-Path (Join-Path $MobileDir "package.json"))) {
    throw "Mobile package.json was not found at $MobileDir"
}

$PreviousApiUrl = $env:EXPO_PUBLIC_API_URL

try {
    Write-Host ""
    Write-Host "Starting Checkpoint Mobile App" -ForegroundColor Cyan
    Write-Host "Backend: $HostedApi" -ForegroundColor Green
    Write-Host "Starting Expo..." -ForegroundColor Cyan
    Write-Host ""

    $env:EXPO_PUBLIC_API_URL = $HostedApi

    Push-Location $MobileDir

    try {
        $Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
        & $Npm run start -- --clear
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($null -eq $PreviousApiUrl) {
        Remove-Item Env:EXPO_PUBLIC_API_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:EXPO_PUBLIC_API_URL = $PreviousApiUrl
    }

    Write-Host ""
    Write-Host "Mobile app launcher stopped." -ForegroundColor Yellow
}
