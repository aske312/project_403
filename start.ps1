param(
    [switch]$UpdateRepo,
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$InstallOnly,
    [switch]$BuildOnly,
    [switch]$ForceInstall,
    [switch]$ForceBuild,
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8000,
    [string]$FrontendHost = "127.0.0.1",
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Command {
    param([string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-BasePython {
    if ($IsWin -and (Test-Command "py")) {
        return @{ File = "py"; Args = @("-3") }
    }

    if (Test-Command "python3") {
        return @{ File = "python3"; Args = @() }
    }

    if (Test-Command "python") {
        return @{ File = "python"; Args = @() }
    }

    throw "Python 3 is not installed or is not available in PATH."
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
}

function Test-BuildOutdated {
    if ($ForceBuild) {
        return $true
    }

    $distIndex = Join-Path $Root "dist/index.html"
    if (-not (Test-Path $distIndex)) {
        return $true
    }

    $distTime = (Get-Item $distIndex).LastWriteTimeUtc
    $trackedInputs = @(
        "index.html",
        "package.json",
        "package-lock.json",
        "vite.config.js",
        ".env",
        "src",
        "public"
    )

    foreach ($input in $trackedInputs) {
        $path = Join-Path $Root $input
        if (-not (Test-Path $path)) {
            continue
        }

        $item = Get-Item $path
        if ($item.PSIsContainer) {
            $newerFile = Get-ChildItem -LiteralPath $path -Recurse -File |
                Where-Object { $_.LastWriteTimeUtc -gt $distTime } |
                Select-Object -First 1

            if ($null -ne $newerFile) {
                return $true
            }
        } elseif ($item.LastWriteTimeUtc -gt $distTime) {
            return $true
        }
    }

    return $false
}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$IsWin = ($env:OS -eq "Windows_NT") -or ($PSVersionTable.Platform -eq "Win32NT")
$VenvPython = if ($IsWin) {
    Join-Path $Root ".venv\Scripts\python.exe"
} else {
    Join-Path $Root ".venv/bin/python"
}
$Npm = if ($IsWin) { "npm.cmd" } else { "npm" }

if ($UpdateRepo) {
    if (-not (Test-Command "git")) {
        throw "Git is not installed or is not available in PATH."
    }

    if (-not (Test-Path ".git")) {
        throw "This directory is not a git repository. Clone the repository first."
    }

    Write-Step "Updating repository"
    Invoke-Checked "git" @("pull", "--ff-only")
}

if (-not (Test-Path ".env")) {
    Write-Warning ".env was not found. Backend will use defaults where available; database and auth settings may be missing."
}

if (-not $SkipInstall) {
    if (-not (Test-Path $VenvPython)) {
        Write-Step "Creating Python virtual environment"
        $basePython = Get-BasePython
        Invoke-Checked $basePython.File ($basePython.Args + @("-m", "venv", ".venv"))
    }

    Write-Step "Installing Python dependencies"
    Invoke-Checked $VenvPython @("-m", "pip", "install", "-r", "requirements.txt")

    if (-not (Test-Command $Npm)) {
        throw "Node.js/npm is not installed or is not available in PATH."
    }

    if ($ForceInstall -or -not (Test-Path "node_modules")) {
        Write-Step "Installing frontend dependencies"
        if (Test-Path "package-lock.json") {
            Invoke-Checked $Npm @("ci")
        } else {
            Invoke-Checked $Npm @("install")
        }
    } else {
        Write-Step "Frontend dependencies already installed"
    }
}

if ($InstallOnly) {
    Write-Step "Environment is ready"
    exit 0
}

if (-not $SkipBuild) {
    if (Test-BuildOutdated) {
        Write-Step "Building frontend"
        Invoke-Checked $Npm @("run", "build")
    } else {
        Write-Step "Frontend build is up to date"
    }
}

if ($BuildOnly) {
    Write-Step "Build is ready"
    exit 0
}

# Database startup placeholder. Keep disabled until local DB orchestration is chosen.
#
# Docker example:
# Write-Step "Starting PostgreSQL"
# docker run --name messenger-postgres `
#     -e POSTGRES_DB=messenger_db `
#     -e POSTGRES_USER=postgres `
#     -e POSTGRES_PASSWORD=password `
#     -p 5432:5432 `
#     -d postgres:16
#
# Docker Compose example:
# docker compose up -d db

Write-Step "Starting backend"
$backendArgs = @(
    "-m", "uvicorn",
    "app.start:app",
    "--host", $BackendHost,
    "--port", "$BackendPort"
)
$backend = Start-Process -FilePath $VenvPython -ArgumentList $backendArgs -WorkingDirectory $Root -NoNewWindow -PassThru

Write-Step "Starting frontend"
$frontendArgs = @("run", "dev", "--", "--host", $FrontendHost, "--port", "$FrontendPort")
$frontend = Start-Process -FilePath $Npm -ArgumentList $frontendArgs -WorkingDirectory $Root -NoNewWindow -PassThru

Write-Host ""
Write-Host "Frontend: http://$FrontendHost`:$FrontendPort" -ForegroundColor Green
Write-Host "Backend:  http://$BackendHost`:$BackendPort" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both processes."

try {
    while ($true) {
        Start-Sleep -Seconds 1
        $backend.Refresh()
        $frontend.Refresh()

        if ($backend.HasExited) {
            throw "Backend process exited with code $($backend.ExitCode)."
        }

        if ($frontend.HasExited) {
            throw "Frontend process exited with code $($frontend.ExitCode)."
        }
    }
}
finally {
    Write-Step "Stopping processes"

    foreach ($process in @($backend, $frontend)) {
        if ($null -ne $process) {
            $process.Refresh()
            if (-not $process.HasExited) {
                Stop-Process -Id $process.Id -Force
            }
        }
    }
}
