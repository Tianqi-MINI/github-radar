<#
One-shot offline verification for the release build:
  1. JS syntax checks
  2. Python compile checks
  3. unit tests (JS + Python)
  4. HTTP smoke test on a temporary port
#>
param([int]$Port = 4199)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$script:failures = @()
function Step($name, [scriptblock]$action) {
    Write-Host "== $name" -ForegroundColor Cyan
    try {
        & $action
        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { throw "exit code $LASTEXITCODE" }
        Write-Host "   OK" -ForegroundColor Green
    } catch {
        $script:failures += $name
        Write-Host "   FAIL: $($_.Exception.Message)" -ForegroundColor Red
    }
}

if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonExe = (& py -3.12 -c "import sys; print(sys.executable)").Trim()
    $pythonArgs = @()
} else {
    $pythonExe = (Get-Command python).Source; $pythonArgs = @()
}

Step "JS syntax" {
    foreach ($file in @("util.js", "scoring.js", "onboard.js", "app.js")) {
        node --check (Join-Path $root "app\js\$file")
        if ($LASTEXITCODE -ne 0) { throw "$file failed node --check" }
    }
    node --check (Join-Path $root "scripts\verify-ui.js")
    node --check (Join-Path $root "scripts\check-dom.js")
    node (Join-Path $root "scripts\check-dom.js")
}

Step "Python compile" {
    $files = Get-ChildItem (Join-Path $root "server") -Filter *.py | ForEach-Object { $_.FullName }
    & $pythonExe @pythonArgs -m py_compile @files
}

Step "JS unit tests" {
    node (Join-Path $root "tests\scoring.test.js")
}

Step "Python unit tests" {
    & $pythonExe @pythonArgs -m unittest discover -s (Join-Path $root "tests") -v
}

Step "Hosted-mode verification" {
    & $pythonExe @pythonArgs (Join-Path $root "scripts\verify-hosted.py")
}

$script:serverProc = $null
Step "HTTP smoke test" {
    New-Item -ItemType Directory -Force -Path (Join-Path $root "outputs") | Out-Null
    $log = Join-Path $root "outputs\check-server.log"
    $err = Join-Path $root "outputs\check-server.err.log"
    $script:serverProc = Start-Process -FilePath $pythonExe `
        -ArgumentList ($pythonArgs + @("-m", "server.app", "--host", "127.0.0.1", "--port", "$Port")) `
        -WorkingDirectory $root -WindowStyle Hidden `
        -RedirectStandardOutput $log -RedirectStandardError $err -PassThru

    $base = "http://127.0.0.1:$Port"
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        try {
            $health = Invoke-WebRequest "$base/api/health" -UseBasicParsing -TimeoutSec 3
            if ($health.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw "server did not become ready" }

    $expect = @{
        "/" = 200
        "/styles.css" = 200
        "/js/app.js" = 200
        "/api/feed" = 200
        "/api/repo-guides" = 200
        "/api/research-kits" = 200
        "/api/small-resources" = 200
        "/api/repo-snapshots" = 200
        "/server/config.py" = 404
        "/../server/config.py" = 404
        "/api/not-a-route" = 404
    }
    foreach ($path in $expect.Keys) {
        try {
            $response = Invoke-WebRequest "$base$path" -UseBasicParsing -TimeoutSec 10
            $status = $response.StatusCode
        } catch {
            $status = [int]$_.Exception.Response.StatusCode
        }
        if ($status -ne $expect[$path]) {
            throw "$path expected $($expect[$path]) got $status"
        }
    }
} finally {
    if ($script:serverProc -and -not $script:serverProc.HasExited) {
        Stop-Process -Id $script:serverProc.Id -Force
    }
}

Write-Host ""
if ($script:failures.Count -eq 0) {
    Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
} else {
    Write-Host "FAILED: $($script:failures -join ', ')" -ForegroundColor Red
    exit 1
}
