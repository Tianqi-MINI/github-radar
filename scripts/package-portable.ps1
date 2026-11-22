<#
Build a Windows portable ZIP for the GitHub Interest Radar.

  .\package-portable.ps1 -PythonEmbedZip .\outputs\python-3.12.10-embed-amd64.zip

The package includes the official Python embeddable runtime, so end users do not
need to install Python. Existing outputs are never overwritten; the next numeric
suffix is used when a package already exists.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$PythonEmbedZip,
    [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
$scriptPath = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path -Parent $scriptPath
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $projectRoot "outputs"
}
$OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
$pythonEmbedZipPath = (Resolve-Path $PythonEmbedZip).Path

function Get-NextPackageSuffix {
    param([string]$Root)

    $suffix = ""
    $index = 1
    while (
        (Test-Path (Join-Path $Root "github-radar-portable$suffix")) -or
        (Test-Path (Join-Path $Root "github-radar-portable$suffix.zip"))
    ) {
        $suffix = "_$index"
        $index += 1
    }
    return $suffix
}

function Copy-PackageTree {
    param(
        [string]$Source,
        [string]$Destination
    )

    $sourcePath = (Resolve-Path $Source).Path
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null

    Get-ChildItem -LiteralPath $sourcePath -Recurse -Force | ForEach-Object {
        $excluded = $_.FullName -match '\\(__pycache__|outputs|\.git|\.ssh-keys)(\\|$)' -or
            $_.Name -like "*.pyc" -or
            $_.Name -like "*.log" -or
            $_.Name -like "*.local.json" -or
            $_.Name -eq ".github-token.json" -or
            $_.Name -eq ".github-token.tmp" -or
            $_.Name -eq "Thumbs.db" -or
            $_.Name -eq ".DS_Store"
        if (-not $excluded) {
            $relative = $_.FullName.Substring($sourcePath.Length).TrimStart("\")
            $target = Join-Path $Destination $relative
            if ($_.PSIsContainer) {
                New-Item -ItemType Directory -Force -Path $target | Out-Null
            } else {
                New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
                Copy-Item -LiteralPath $_.FullName -Destination $target -Force
            }
        }
    }
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$suffix = Get-NextPackageSuffix -Root $OutputRoot
$buildName = "github-radar-portable$suffix"
$buildRoot = Join-Path $OutputRoot $buildName
$zipPath = Join-Path $OutputRoot "$buildName.zip"

New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
Copy-PackageTree -Source (Join-Path $projectRoot "app") -Destination (Join-Path $buildRoot "app")
Copy-PackageTree -Source (Join-Path $projectRoot "server") -Destination (Join-Path $buildRoot "server")
Copy-PackageTree -Source (Join-Path $projectRoot "data") -Destination (Join-Path $buildRoot "data")
Copy-Item -LiteralPath (Join-Path $projectRoot "scripts\portable-launcher.py") -Destination $buildRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "scripts\portable\start-github-radar.bat") -Destination $buildRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "scripts\portable\readme-zh.txt") -Destination $buildRoot

$runtimeRoot = Join-Path $buildRoot "runtime\python"
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
Expand-Archive -LiteralPath $pythonEmbedZipPath -DestinationPath $runtimeRoot -Force

$pthFile = Get-ChildItem -LiteralPath $runtimeRoot -Filter "python*._pth" | Select-Object -First 1
if (-not $pthFile) {
    throw "The Python embeddable ZIP does not contain a python*._pth file."
}
$pthLines = [System.IO.File]::ReadAllLines($pthFile.FullName)
if ($pthLines -notcontains "..\..") {
    $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllLines(
        $pthFile.FullName,
        ($pthLines + "..\.."),
        $utf8NoBom
    )
}

$pythonHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $pythonEmbedZipPath).Hash
$commit = "unknown"
if (Get-Command git -ErrorAction SilentlyContinue) {
    $gitOutput = & git -C $projectRoot rev-parse --short HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $gitOutput) {
        $commit = $gitOutput.Trim()
    }
}

$buildInfo = @(
    "Package: $buildName",
    "Source commit: $commit",
    "Python runtime: $(Split-Path -Leaf $pythonEmbedZipPath)",
    "Python SHA256: $pythonHash",
    "Official source: https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip"
)
$utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
[System.IO.File]::WriteAllLines(
    (Join-Path $buildRoot "build-info.txt"),
    $buildInfo,
    $utf8NoBom
)

Compress-Archive -Path (Join-Path $buildRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
$zipHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash
[System.IO.File]::WriteAllText(
    "$zipPath.sha256",
    "$zipHash  $(Split-Path -Leaf $zipPath)`r`n",
    $utf8NoBom
)

Write-Host "Portable ZIP: $zipPath"
Write-Host "SHA256: $zipHash"
Write-Host "Build directory: $buildRoot"
