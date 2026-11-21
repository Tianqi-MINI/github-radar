<#
Start the GitHub Interest Radar server.

  .\start.ps1                     # local only
  .\start.ps1 -BindAddress 0.0.0.0 # allow LAN access
  .\start.ps1 -Background          # run hidden, log to outputs/server.log
#>
param(
    [string]$BindAddress = "127.0.0.1",
    [int]$Port = 4173,
    [switch]$Background
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (Get-Command py -ErrorAction SilentlyContinue) {
    # Resolve the real interpreter: spawning the "py" launcher in the
    # background can leave no surviving child process on exit.
    $pythonExe = (& py -3.12 -c "import sys; print(sys.executable)").Trim()
    $pythonArgs = @()
} else {
    $pythonExe = (Get-Command python).Source
    $pythonArgs = @()
}

$appArgs = @("-m", "server.app", "--host", $BindAddress, "--port", "$Port")

if ($Background) {
    New-Item -ItemType Directory -Force -Path (Join-Path $root "outputs") | Out-Null
    $log = Join-Path $root "outputs\server.log"
    $err = Join-Path $root "outputs\server.err.log"
    $proc = Start-Process -FilePath $pythonExe `
        -ArgumentList ($pythonArgs + $appArgs) `
        -WorkingDirectory $root `
        -WindowStyle Hidden `
        -RedirectStandardOutput $log `
        -RedirectStandardError $err `
        -PassThru
    Write-Host "Radar started in the background (PID $($proc.Id))"
    Write-Host "  http://$BindAddress`:$Port"
    Write-Host "  log: outputs\server.log"
    return
}

& $pythonExe @pythonArgs @appArgs
