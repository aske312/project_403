param(
    [string]$RepoUrl = "https://github.com/aske312/project_403.git",
    [string]$ProjectDir = "",
    [switch]$UpdateRepo,
    [switch]$SkipSystemDeps,
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$StartDb,
    [switch]$DbOnly,
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

function Install-WingetPackage {
    param(
        [string]$CommandName,
        [string]$PackageId
    )

    if (Test-Command $CommandName) {
        return
    }

    if (-not (Test-Command "winget")) {
        throw "$CommandName is not installed. Install it manually or install winget, then run this script again."
    }

    Write-Step "Installing $CommandName"
    Invoke-Checked "winget" @("install", "--id", $PackageId, "-e", "--accept-package-agreements", "--accept-source-agreements")
}

function Install-Docker {
    if (Test-Command "docker") {
        return
    }

    if ($SkipSystemDeps) {
        throw "Docker is not installed or is not available in PATH."
    }

    if ($IsWin) {
        Install-WingetPackage "docker" "Docker.DockerDesktop"

        if (Test-Command "docker") {
            return
        }

        $dockerDesktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerDesktop) {
            Write-Step "Starting Docker Desktop"
            Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
        }

        throw "Docker Desktop was installed, but docker is not available in this shell yet. Open a new PowerShell session and start Docker Desktop, then run this command again."
    }

    if (-not (Test-Command "apt-get")) {
        throw "Docker auto-install is supported only on Windows with winget or apt-based Linux."
    }

    Write-Step "Installing Docker Engine"
    $sudo = if ((id -u) -eq "0") { "" } else { "sudo" }
    if ($sudo) {
        Invoke-Checked $sudo @("apt-get", "update")
        Invoke-Checked $sudo @("apt-get", "install", "-y", "ca-certificates", "curl")
        Invoke-Checked $sudo @("install", "-m", "0755", "-d", "/etc/apt/keyrings")
        Invoke-Checked $sudo @("curl", "-fsSL", "https://download.docker.com/linux/ubuntu/gpg", "-o", "/etc/apt/keyrings/docker.asc")
        Invoke-Checked $sudo @("chmod", "a+r", "/etc/apt/keyrings/docker.asc")
        Invoke-Checked "sh" @("-c", "echo `"deb [arch=`$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu `$(`. /etc/os-release && echo `"`$VERSION_CODENAME`") stable`" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null")
        Invoke-Checked $sudo @("apt-get", "update")
        Invoke-Checked $sudo @("apt-get", "install", "-y", "docker-ce", "docker-ce-cli", "containerd.io", "docker-buildx-plugin", "docker-compose-plugin")
    } else {
        Invoke-Checked "apt-get" @("update")
        Invoke-Checked "apt-get" @("install", "-y", "ca-certificates", "curl")
        Invoke-Checked "install" @("-m", "0755", "-d", "/etc/apt/keyrings")
        Invoke-Checked "curl" @("-fsSL", "https://download.docker.com/linux/ubuntu/gpg", "-o", "/etc/apt/keyrings/docker.asc")
        Invoke-Checked "chmod" @("a+r", "/etc/apt/keyrings/docker.asc")
        Invoke-Checked "sh" @("-c", "echo `"deb [arch=`$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu `$(`. /etc/os-release && echo `"`$VERSION_CODENAME`") stable`" | tee /etc/apt/sources.list.d/docker.list > /dev/null")
        Invoke-Checked "apt-get" @("update")
        Invoke-Checked "apt-get" @("install", "-y", "docker-ce", "docker-ce-cli", "containerd.io", "docker-buildx-plugin", "docker-compose-plugin")
    }
}

function Install-SystemDependencies {
    if ($SkipSystemDeps) {
        return
    }

    if ($IsWin) {
        Install-WingetPackage "git" "Git.Git"
        Install-WingetPackage "python" "Python.Python.3.13"
        Install-WingetPackage "npm" "OpenJS.NodeJS.LTS"
        return
    }

    if (-not (Test-Command "apt-get")) {
        return
    }

    $missing = @()
    if (-not (Test-Command "git")) { $missing += "git" }
    if (-not (Test-Command "python3")) { $missing += "python3" }
    if (-not (Test-Command "npm")) { $missing += "npm" }

    if ($missing.Count -eq 0) {
        return
    }

    Write-Step "Installing system dependencies"
    $sudo = if ((id -u) -eq "0") { "" } else { "sudo" }
    if ($sudo) {
        Invoke-Checked $sudo @("apt-get", "update")
        Invoke-Checked $sudo @("apt-get", "install", "-y", "git", "python3", "python3-venv", "python3-pip", "nodejs", "npm")
    } else {
        Invoke-Checked "apt-get" @("update")
        Invoke-Checked "apt-get" @("install", "-y", "git", "python3", "python3-venv", "python3-pip", "nodejs", "npm")
    }
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

function Get-RepoDirName {
    $name = Split-Path $RepoUrl -Leaf
    if ($name.EndsWith(".git")) {
        $name = $name.Substring(0, $name.Length - 4)
    }

    if ([string]::IsNullOrWhiteSpace($name)) {
        return "project_403"
    }

    return $name
}

function Enter-OrCloneProject {
    if ((Test-Path "package.json") -and (Test-Path "app") -and (Test-Path "src")) {
        return
    }

    if (-not (Test-Command "git")) {
        throw "Git is not installed or is not available in PATH."
    }

    $target = if ([string]::IsNullOrWhiteSpace($ProjectDir)) { Get-RepoDirName } else { $ProjectDir }
    $targetGit = Join-Path $target ".git"

    if (-not (Test-Path $targetGit)) {
        Write-Step "Cloning repository"
        Invoke-Checked "git" @("clone", $RepoUrl, $target)
    }

    Set-Location $target
    $script:Root = (Get-Location).Path
}

function Ensure-EnvFile {
    if (Test-Path ".env") {
        return
    }

    Write-Step "Creating default .env"
    $apiUrl = "http://$BackendHost`:$BackendPort"
    $projectBranch = "unknown"
    try {
        $detectedBranch = git branch --show-current 2>$null
        if ($detectedBranch) {
            $projectBranch = $detectedBranch.Trim()
        }
    } catch {
        $projectBranch = "unknown"
    }
    $envContent = @"
# APPLICATION
APP_NAME=Project_403
VERSION=0.0.1
ENV=development
DEBUG=True
AUTO_CREATE_TABLES=True

# SERVER
HOST=0.0.0.0
PORT=$BackendPort

# DATABASE
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/messenger_db
DB_FALLBACK_ENABLED=True
DB_FALLBACK_URL=sqlite+aiosqlite:///./local.db

# AUTH
JWT_SECRET=change_me_before_public_deploy
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# BUILD
PROJECT_BRANCH=$projectBranch

# LOGGING
LOG_FILE=logs/app.log
LOG_MAX_BYTES=1048576
LOG_BACKUP_COUNT=3

# UI_API
VITE_API_URL=$apiUrl
"@
    Set-Content -Path ".env" -Value $envContent -Encoding UTF8
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

function Start-Database {
    if (-not (Test-Path "docker-compose.yml")) {
        throw "docker-compose.yml was not found."
    }

    Install-Docker

    Write-Step "Starting PostgreSQL"
    Invoke-Checked "docker" @("compose", "up", "-d", "db")
}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$IsWin = ($env:OS -eq "Windows_NT") -or ($PSVersionTable.Platform -eq "Win32NT")
Install-SystemDependencies
Enter-OrCloneProject

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

Ensure-EnvFile

if ($StartDb -or $DbOnly) {
    Start-Database
}

if ($DbOnly) {
    Write-Step "Database is ready"
    exit 0
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
