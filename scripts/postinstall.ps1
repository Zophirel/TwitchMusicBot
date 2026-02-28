param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = "Stop"

$nodeDir = Join-Path $InstallDir "tools\node"
$npmCmd = Join-Path $nodeDir "npm.cmd"
$nssmExe = Join-Path $InstallDir "tools\nssm.exe"

if (!(Test-Path $npmCmd)) {
  throw "npm not found at $npmCmd"
}
if (!(Test-Path $nssmExe)) {
  throw "nssm not found at $nssmExe"
}

Push-Location $InstallDir

# Ensure logs directory exists
$logsDir = Join-Path $InstallDir "logs"
if (!(Test-Path $logsDir)) {
  New-Item -ItemType Directory -Path $logsDir | Out-Null
}

# Install dependencies and build
& $npmCmd install
& $npmCmd run build
& $npmCmd run -w @musicbot/api prisma:migrate

# Install and start service
& $nssmExe install MusicBot "$env:ComSpec"
& $nssmExe set MusicBot AppDirectory "$InstallDir"
& $nssmExe set MusicBot AppParameters "/c scripts\\musicbot-service.cmd"
& $nssmExe set MusicBot AppStdout "$logsDir\service.out.log"
& $nssmExe set MusicBot AppStderr "$logsDir\service.err.log"
& $nssmExe set MusicBot AppRotateFiles 1
& $nssmExe set MusicBot AppRotateOnline 1
& $nssmExe set MusicBot AppRotateBytes 1048576
& $nssmExe set MusicBot Start SERVICE_AUTO_START
& $nssmExe start MusicBot

Pop-Location
