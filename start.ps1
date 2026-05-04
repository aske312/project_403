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
    [switch]$StopOnly,
    [switch]$NoReplaceExisting
)

$ErrorActionPreference = "Stop"
$BackendHost = "127.0.0.1"
$BackendPort = 8000
$FrontendHost = "127.0.0.1"
$FrontendPort = 5173

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Command {
    param([string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Read-DotEnvSettings {
    param([string]$Path = ".env")

    $settings = @{}
    if (-not (Test-Path $Path)) {
        return $settings
    }

    foreach ($line in Get-Content -Path $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }

        $separator = $trimmed.IndexOf("=")
        if ($separator -le 0) {
            continue
        }

        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim().Trim('"').Trim("'")
        $settings[$key] = $value
    }

    return $settings
}

function Get-DotEnvValue {
    param(
        [hashtable]$Settings,
        [string[]]$Names,
        [string]$Default
    )

    foreach ($name in $Names) {
        if ($Settings.ContainsKey($name) -and -not [string]::IsNullOrWhiteSpace($Settings[$name])) {
            return $Settings[$name]
        }
    }

    return $Default
}

function Get-ChildProcessIds {
    param([int]$ProcessId)

    if ($IsWin) {
        @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue |
            ForEach-Object { [int]$_.ProcessId })
        return
    }

    if (Test-Command "pgrep") {
        @(& pgrep -P $ProcessId 2>$null | ForEach-Object {
            if ($_ -match "^\d+$") {
                [int]$_
            }
        })
        return
    }

    @()
}

function Get-ProcessCommandLine {
    param([int]$ProcessId)

    if ($IsWin) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
        if ($null -ne $process) {
            return [string]$process.CommandLine
        }

        return ""
    }

    $cmdlinePath = "/proc/$ProcessId/cmdline"
    if (Test-Path $cmdlinePath) {
        return (Get-Content -LiteralPath $cmdlinePath -Raw -ErrorAction SilentlyContinue) -replace "`0", " "
    }

    return ""
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    if ($ProcessId -le 0 -or $ProcessId -eq $PID) {
        return
    }

    foreach ($childId in Get-ChildProcessIds $ProcessId) {
        Stop-ProcessTree -ProcessId $childId
    }

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return
    }

    try {
        Stop-Process -Id $ProcessId -Force -ErrorAction Stop
    } catch {
        Write-Warning "Could not stop process ${ProcessId}: $($_.Exception.Message)"
    }
}

function Add-ProcessTreeToSet {
    param(
        [int]$ProcessId,
        [hashtable]$Target
    )

    if ($ProcessId -le 0 -or $ProcessId -eq $PID) {
        return
    }

    if (-not $Target.ContainsKey($ProcessId)) {
        $Target[$ProcessId] = $true
    }

    foreach ($childId in Get-ChildProcessIds $ProcessId) {
        Add-ProcessTreeToSet -ProcessId $childId -Target $Target
    }
}

function Test-ProjectCommandLine {
    param([string]$CommandLine)

    if ([string]::IsNullOrWhiteSpace($CommandLine)) {
        return $false
    }

    $line = $CommandLine.ToLowerInvariant()
    $rootNative = $Root.ToLowerInvariant()
    $rootSlash = ($Root -replace "\\", "/").ToLowerInvariant()
    $hasRoot = $line.Contains($rootNative) -or $line.Contains($rootSlash)

    if ($hasRoot -and ($line -match "uvicorn|app\.start:app|vite|node_modules")) {
        return $true
    }

    if (($line -match "uvicorn") -and ($line -match "app\.start:app") -and ($line -match "--port\s+$BackendPort\b")) {
        return $true
    }

    if (($line -match "vite") -and ($line -match "--port\s+$FrontendPort\b")) {
        return $true
    }

    return $false
}

function Test-ProjectProcessName {
    param([string]$Name)

    if ([string]::IsNullOrWhiteSpace($Name)) {
        return $false
    }

    $normalized = $Name.ToLowerInvariant()
    return $normalized -match "^(node|node\.exe|python|python3|python\.exe|cmd|cmd\.exe|npm|npm\.cmd|sh|bash)$"
}

function Get-ProjectProcessRecords {
    $records = @()

    if ($IsWin) {
        $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
        foreach ($process in $processes) {
            if ($process.ProcessId -eq $PID) {
                continue
            }

            if ((Test-ProjectProcessName $process.Name) -and (Test-ProjectCommandLine $process.CommandLine)) {
                $records += [pscustomobject]@{
                    ProcessId = [int]$process.ProcessId
                    Name = [string]$process.Name
                    CommandLine = [string]$process.CommandLine
                }
            }
        }

        return $records
    }

    foreach ($process in Get-Process -ErrorAction SilentlyContinue) {
        if ($process.Id -eq $PID) {
            continue
        }

        $commandLine = Get-ProcessCommandLine $process.Id
        if ((Test-ProjectProcessName $process.ProcessName) -and (Test-ProjectCommandLine $commandLine)) {
            $records += [pscustomobject]@{
                ProcessId = [int]$process.Id
                Name = [string]$process.ProcessName
                CommandLine = [string]$commandLine
            }
        }
    }

    return $records
}

function Get-ListeningProcessIds {
    param([int]$Port)

    if ($IsWin -and (Test-Command "Get-NetTCPConnection")) {
        @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique |
            ForEach-Object { [int]$_ })
        return
    }

    @()
}

function Add-ListeningProjectProcessesToSet {
    param([hashtable]$Target)

    foreach ($port in @($BackendPort, $FrontendPort)) {
        foreach ($processId in Get-ListeningProcessIds $port) {
            if ($processId -eq $PID) {
                continue
            }

            $commandLine = Get-ProcessCommandLine $processId
            if (Test-ProjectCommandLine $commandLine) {
                Add-ProcessTreeToSet -ProcessId $processId -Target $Target
            }
        }
    }
}

function Stop-TrackedProcessTrees {
    param([hashtable]$ProcessIds)

    foreach ($processId in ($ProcessIds.Keys | Sort-Object -Descending)) {
        Stop-ProcessTree -ProcessId ([int]$processId)
    }
}

function Stop-ExistingProjectProcesses {
    param([string]$Message = "Stopping existing project processes")

    $targets = @{}

    foreach ($record in Get-ProjectProcessRecords) {
        if (-not $targets.ContainsKey($record.ProcessId)) {
            $targets[$record.ProcessId] = $record
        }
    }

    foreach ($port in @($BackendPort, $FrontendPort)) {
        foreach ($processId in Get-ListeningProcessIds $port) {
            if ($processId -eq $PID -or $targets.ContainsKey($processId)) {
                continue
            }

            $commandLine = Get-ProcessCommandLine $processId
            if (Test-ProjectCommandLine $commandLine) {
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                $targets[$processId] = [pscustomobject]@{
                    ProcessId = [int]$processId
                    Name = if ($null -ne $process) { [string]$process.ProcessName } else { "unknown" }
                    CommandLine = [string]$commandLine
                }
                continue
            }

            $owner = Get-Process -Id $processId -ErrorAction SilentlyContinue
            $ownerName = if ($null -ne $owner) { $owner.ProcessName } else { "unknown" }
            throw "Port $port is already in use by PID $processId ($ownerName). It does not look like this project's dev process, so it was not stopped."
        }
    }

    if ($targets.Count -eq 0) {
        return
    }

    Write-Step $Message
    foreach ($record in ($targets.Values | Sort-Object ProcessId -Descending)) {
        Write-Host "Stopping PID $($record.ProcessId) ($($record.Name))"
        Stop-ProcessTree -ProcessId $record.ProcessId
    }

    Start-Sleep -Milliseconds 500
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

    throw "Settings file is missing. Create the project settings file before starting the app."
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
if (-not $StopOnly) {
    Install-SystemDependencies
}
Enter-OrCloneProject

Ensure-EnvFile

$envSettings = Read-DotEnvSettings
$BackendHost = Get-DotEnvValue $envSettings @("HOST") $BackendHost
$BackendPort = [int](Get-DotEnvValue $envSettings @("PORT") "$BackendPort")
$FrontendHost = Get-DotEnvValue $envSettings @("FRONTEND_HOST") $FrontendHost
$FrontendPort = [int](Get-DotEnvValue $envSettings @("FRONTEND_PORT") "$FrontendPort")

if ($StopOnly) {
    Stop-ExistingProjectProcesses "Stopping project processes"
    Write-Step "Project processes are stopped"
    exit 0
}

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

    Write-Step "Updating pip"
    Invoke-Checked $VenvPython @("-m", "pip", "install", "--upgrade", "pip")

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

if (-not $NoReplaceExisting) {
    Stop-ExistingProjectProcesses "Stopping previous project processes"
}

$startedProcessIds = @{}
$adminCommandPathFromEnv = Get-DotEnvValue $envSettings @("ADMIN_COMMAND_FILE") "logs/admin-command.json"
$adminCommandFile = Join-Path $Root $adminCommandPathFromEnv
$adminCommandArchiveDir = Join-Path $Root "logs\admin-commands"

$backendArgs = @(
    "-m", "uvicorn",
    "app.start:app",
    "--host", $BackendHost,
    "--port", "$BackendPort"
)

$frontendArgs = @("run", "dev", "--", "--host", $FrontendHost, "--port", "$FrontendPort")

function Start-BackendService {
    Write-Step "Starting backend"
    $process = Start-Process -FilePath $VenvPython -ArgumentList $backendArgs -WorkingDirectory $Root -NoNewWindow -PassThru
    Add-ProcessTreeToSet -ProcessId $process.Id -Target $startedProcessIds
    return $process
}

function Start-FrontendService {
    Write-Step "Starting frontend"
    $process = Start-Process -FilePath $Npm -ArgumentList $frontendArgs -WorkingDirectory $Root -NoNewWindow -PassThru
    Add-ProcessTreeToSet -ProcessId $process.Id -Target $startedProcessIds
    return $process
}

function Stop-ServiceProcess {
    param(
        $Process,
        [string]$Name
    )

    if ($null -eq $Process) {
        return
    }

    $Process.Refresh()
    if ($Process.HasExited) {
        return
    }

    Write-Step "Stopping $Name"
    $targets = @{}
    Add-ProcessTreeToSet -ProcessId $Process.Id -Target $targets
    Stop-TrackedProcessTrees -ProcessIds $targets
    Start-Sleep -Milliseconds 500
}

function Complete-AdminCommand {
    param($Command)

    if (-not (Test-Path $adminCommandFile)) {
        return
    }

    if (-not (Test-Path $adminCommandArchiveDir)) {
        New-Item -ItemType Directory -Path $adminCommandArchiveDir -Force | Out-Null
    }

    $commandId = if ($null -ne $Command -and $Command.id) { $Command.id } else { "invalid-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" }
    Move-Item -LiteralPath $adminCommandFile -Destination (Join-Path $adminCommandArchiveDir "$commandId.json") -Force
}

function Get-PendingAdminCommand {
    if (-not (Test-Path $adminCommandFile)) {
        return $null
    }

    try {
        $command = Get-Content -Raw -Path $adminCommandFile | ConvertFrom-Json
    } catch {
        Write-Warning "Admin command file is invalid: $($_.Exception.Message)"
        Complete-AdminCommand $null
        return $null
    }

    try {
        if ($command.expires_at) {
            $expiresAt = ([datetime]::Parse($command.expires_at)).ToUniversalTime()
            if ($expiresAt -lt [datetime]::UtcNow) {
                Write-Warning "Admin command expired: $($command.command)"
                Complete-AdminCommand $command
                return $null
            }
        }
    } catch {
        Write-Warning "Admin command expiration is invalid: $($_.Exception.Message)"
        Complete-AdminCommand $command
        return $null
    }

    return $command
}

function Invoke-AdminCommand {
    param($Command)

    switch ($Command.command) {
        "restart_backend" {
            Write-Step "Admin command: restart backend"
            Stop-ServiceProcess -Process $script:backend -Name "backend"
            $script:backend = Start-BackendService
            Complete-AdminCommand $Command
        }
        "restart_frontend" {
            Write-Step "Admin command: restart frontend"
            Stop-ServiceProcess -Process $script:frontend -Name "frontend"
            $script:frontend = Start-FrontendService
            Complete-AdminCommand $Command
        }
        "restart_project" {
            Write-Step "Admin command: restart project"
            Stop-ServiceProcess -Process $script:frontend -Name "frontend"
            Stop-ServiceProcess -Process $script:backend -Name "backend"
            $script:backend = Start-BackendService
            $script:frontend = Start-FrontendService
            Complete-AdminCommand $Command
        }
        default {
            Write-Warning "Unknown admin command: $($Command.command)"
            Complete-AdminCommand $Command
        }
    }
}

$backend = Start-BackendService
$frontend = Start-FrontendService

Write-Host ""
Write-Host "Frontend: http://$FrontendHost`:$FrontendPort" -ForegroundColor Green
Write-Host "Backend:  http://$BackendHost`:$BackendPort" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both processes."

try {
    while ($true) {
        Start-Sleep -Seconds 1

        $command = Get-PendingAdminCommand
        if ($null -ne $command) {
            Invoke-AdminCommand $command
            continue
        }

        $backend.Refresh()
        $frontend.Refresh()

        if ($backend.HasExited) {
            throw "Backend process exited with code $($backend.ExitCode)."
        }

        if ($frontend.HasExited) {
            throw "Frontend process exited with code $($frontend.ExitCode)."
        }

        Add-ProcessTreeToSet -ProcessId $backend.Id -Target $startedProcessIds
        Add-ProcessTreeToSet -ProcessId $frontend.Id -Target $startedProcessIds
        Add-ListeningProjectProcessesToSet -Target $startedProcessIds
    }
}
finally {
    Write-Step "Stopping processes"

    foreach ($process in @($backend, $frontend)) {
        if ($null -ne $process) {
            Add-ProcessTreeToSet -ProcessId $process.Id -Target $startedProcessIds
        }
    }

    Stop-TrackedProcessTrees -ProcessIds $startedProcessIds
}
