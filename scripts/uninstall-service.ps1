param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = "SilentlyContinue"

$nssmExe = Join-Path $InstallDir "tools\nssm.exe"
if (Test-Path $nssmExe) {
  & $nssmExe stop MusicBot
  & $nssmExe remove MusicBot confirm
}
