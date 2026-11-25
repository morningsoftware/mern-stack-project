
param(
    [int]$Port = 4002,
    [int]$StartupTimeoutSeconds = 600
)

$ErrorActionPreference = "Stop"

# ------------------------------------------------------------
# Paths and executable locations
# ------------------------------------------------------------

$Root = $PSScriptRoot
$ServerDir = Join-Path $Root "server"
$MobileDir = Join-Path $Root "mobile"

$DemoScript = Join-Path $ServerDir "scripts\demo.ts"

$Node = (Get-Command node -ErrorAction Stop).Source
$Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$Cloudflared = (Get-Command cloudflared -ErrorAction Stop).Source

# ------------------------------------------------------------
# Log files
# ------------------------------------------------------------

$LogPrefix = Join-Path $env:TEMP "checkpoint-mobile-demo-$PID"

$BackendOut = "$LogPrefix-backend.out.log"
$BackendErr = "$LogPrefix-backend.err.log"

$TunnelOut = "$LogPrefix-tunnel.out.log"
$TunnelErr = "$LogPrefix-tunnel.err.log"

# ------------------------------------------------------------
# Process tracking
# ------------------------------------------------------------

$Backend = $null
$Tunnel = $null

# ------------------------------------------------------------
# Save existing environment variables
# ------------------------------------------------------------

$OldApiUrl = $env:EXPO_PUBLIC_API_URL
$OldFetchSetting = $env:EXPO_PUBLIC_USE_RN_FETCH
$OldDemoHost = $env:CHECKPOINT_DEMO_HOST

# ------------------------------------------------------------
# Cleanup helpers
# ------------------------------------------------------------

function Stop-ProcessTree {
    param(
        [System.Diagnostics.Process]$Process,
        [string]$Name
    )

    if ($null -eq $Process) {
        return
    }

    try {
        $Process.Refresh()

        if (-not $Process.HasExited) {
            Write-Host "Stopping $Name..."

            & taskkill.exe /PID $Process.Id /T /F 2>$null |
                Out-Null

            $Process.WaitForExit(10000) | Out-Null
        }
    }
    catch {
        Write-Warning "Could not fully stop $Name`: $($_.Exception.Message)"
    }
}

function Stop-PortProcess {
    param(
        [int]$LocalPort,
        [string]$Name
    )

    try {
        $Connections = @(
            Get-NetTCPConnection -State Listen `
                -LocalPort $LocalPort `
                -ErrorAction SilentlyContinue
        )

        foreach ($Connection in $Connections) {
            $ProcessId = $Connection.OwningProcess

            if ($ProcessId -and $ProcessId -ne $PID) {
                Write-Host "Stopping remaining $Name process..."

                & taskkill.exe /PID $ProcessId /T /F 2>$null |
                    Out-Null
            }
        }
    }
    catch {
        Write-Warning "Could not check port $LocalPort`: $($_.Exception.Message)"
    }
}

# ------------------------------------------------------------
# Main startup
# ------------------------------------------------------------

try {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "       CHECKPOINT MOBILE DEMO"
    Write-Host "========================================"
    Write-Host ""

    # Verify required files

    if (-not (Test-Path $DemoScript)) {
        throw "Demo backend script not found: $DemoScript"
    }

    if (-not (Test-Path (Join-Path $MobileDir "package.json"))) {
        throw "Mobile package.json not found."
    }

    # Make sure the backend port is available

    $ExistingBackend = Get-NetTCPConnection `
        -State Listen `
        -LocalPort $Port `
        -ErrorAction SilentlyContinue

    if ($ExistingBackend) {
        throw "Port $Port is already in use. Stop the existing process before starting the demo."
    }

    Write-Host "Starting demo backend..."

    # --------------------------------------------------------
    # Start backend
    # --------------------------------------------------------

    $Backend = Start-Process `
        -FilePath $Node `
        -ArgumentList @("--import", "tsx", "scripts/demo.ts") `
        -WorkingDirectory $ServerDir `
        -PassThru `
        -RedirectStandardOutput $BackendOut `
        -RedirectStandardError $BackendErr

    # Wait for backend readiness

    $BackendReady = $false
    $BackendDeadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)

    while ((Get-Date) -lt $BackendDeadline) {
        $Backend.Refresh()

        if ($Backend.HasExited) {
            $ErrorDetails = ""

            if (Test-Path $BackendErr) {
                $ErrorDetails = Get-Content $BackendErr -Raw
            }

            throw "Demo backend exited unexpectedly. $ErrorDetails"
        }

        if (Test-Path $BackendOut) {
            $BackendOutput = Get-Content $BackendOut -Raw

            if ($BackendOutput -match "Checkpoint real API demo ready") {
                $BackendReady = $true
                break
            }
        }

        Start-Sleep -Seconds 1
    }

    if (-not $BackendReady) {
        throw "Backend startup timed out after $StartupTimeoutSeconds seconds. Check $BackendOut and $BackendErr"
    }

    Write-Host "Demo backend ready."

    # --------------------------------------------------------
    # Start Cloudflare tunnel
    # --------------------------------------------------------

    Write-Host "Starting Cloudflare tunnel..."

    $Tunnel = Start-Process `
        -FilePath $Cloudflared `
        -ArgumentList @("tunnel", "--url", "http://127.0.0.1:$Port") `
        -PassThru `
        -RedirectStandardOutput $TunnelOut `
        -RedirectStandardError $TunnelErr

    $TunnelDeadline = (Get-Date).AddSeconds(90)
    $ApiUrl = $null

    while ((Get-Date) -lt $TunnelDeadline) {
        $Tunnel.Refresh()

        if ($Tunnel.HasExited) {
            $TunnelDetails = ""

            if (Test-Path $TunnelErr) {
                $TunnelDetails = Get-Content $TunnelErr -Raw
            }

            throw "Cloudflare tunnel exited unexpectedly. $TunnelDetails"
        }

        $TunnelOutput = ""

        if (Test-Path $TunnelOut) {
            $TunnelOutput += Get-Content $TunnelOut -Raw
        }

        if (Test-Path $TunnelErr) {
            $TunnelOutput += Get-Content $TunnelErr -Raw
        }

        if ($TunnelOutput -match "https://[a-z0-9-]+\.trycloudflare\.com") {
            $ApiUrl = $Matches[0]
            break
        }

        Start-Sleep -Seconds 1
    }

    if (-not $ApiUrl) {
        throw "Cloudflare tunnel URL was not detected within 90 seconds."
    }

    Write-Host "Cloudflare tunnel ready."
    Write-Host ""

    # --------------------------------------------------------
    # Configure Expo environment
    # --------------------------------------------------------

    $env:EXPO_PUBLIC_API_URL = $ApiUrl
    $env:EXPO_PUBLIC_USE_RN_FETCH = "1"
    $env:CHECKPOINT_DEMO_HOST = "127.0.0.1"

    Write-Host "API: $ApiUrl"
    Write-Host ""
    Write-Host "Starting Expo..."
    Write-Host "Press Ctrl+C to stop the demo."
    Write-Host ""

    # --------------------------------------------------------
    # Start Expo in the foreground
    # --------------------------------------------------------

    Push-Location $MobileDir

    try {
        & $Npm run start -- --clear
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host ""
    Write-Host "DEMO ERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
finally {
    # --------------------------------------------------------
    # Stop all demo services
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "Stopping demo services..."

    # Stop Expo's Metro process if it is still listening
    Stop-PortProcess -LocalPort 8081 -Name "Expo"

    # Stop Cloudflare tunnel
    Stop-ProcessTree -Process $Tunnel -Name "Cloudflare Tunnel"

    # Stop backend
    Stop-ProcessTree -Process $Backend -Name "Demo Backend"

    # Check for any remaining backend process
    Stop-PortProcess -LocalPort $Port -Name "Demo Backend"

    # --------------------------------------------------------
    # Restore previous environment variables
    # --------------------------------------------------------

    $env:EXPO_PUBLIC_API_URL = $OldApiUrl
    $env:EXPO_PUBLIC_USE_RN_FETCH = $OldFetchSetting
    $env:CHECKPOINT_DEMO_HOST = $OldDemoHost

    Write-Host ""
    Write-Host "Demo cleanup complete."
    Write-Host ""
}
