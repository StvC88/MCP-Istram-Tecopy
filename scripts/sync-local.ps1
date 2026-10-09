[CmdletBinding()]
param(
  [string]$Target = 'C:\Users\steve\Desktop\istram-mcp',
  [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$desktopRoot = [IO.Path]::GetFullPath([Environment]::GetFolderPath('Desktop'))
$targetPath = [IO.Path]::GetFullPath($Target).TrimEnd('\')
$parentPath = [IO.Path]::GetDirectoryName($targetPath).TrimEnd('\')
if (-not $parentPath.Equals($desktopRoot.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Target must be an immediate child of the current Desktop.'
}
if (-not ([IO.Path]::GetFileName($targetPath) -eq 'istram-mcp')) {
  throw 'This script only synchronizes the istram-mcp project.'
}
$nonce = [guid]::NewGuid().ToString('N')
$stagePath = Join-Path $desktopRoot ('istram-mcp.checkout-' + $nonce)
$backupPath = Join-Path $desktopRoot ('istram-mcp.previous-' + $nonce)
foreach ($checkedPath in @($stagePath,$backupPath)) {
  if (-not ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($checkedPath))).Equals($desktopRoot,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'Resolved destination is outside Desktop.'
  }
}
if (Test-Path -LiteralPath $targetPath) {
  if ((Get-Item -LiteralPath $targetPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'Linked target directories are refused.'
  }
}
Write-Output "Repository: https://github.com/StvC88/MCP-Istram-Tecopy.git"
Write-Output "Branch: codex/istram-stable"
Write-Output "Target: $targetPath"
Write-Output "Backup: $backupPath"
if (-not $Apply) {
  Write-Output 'Preview only. Use -Apply to clone, verify, and synchronize with a retained backup.'
  exit 0
}
git clone --branch codex/istram-stable --single-branch 'https://github.com/StvC88/MCP-Istram-Tecopy.git' $stagePath
if ($LASTEXITCODE -ne 0) { throw 'Clone failed; original target was not changed.' }
Push-Location -LiteralPath $stagePath
try {
  npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed; original target was not changed.' }
  npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed; original target was not changed.' }
} finally { Pop-Location }
$hadTarget = Test-Path -LiteralPath $targetPath
if ($hadTarget) { Move-Item -LiteralPath $targetPath -Destination $backupPath }
try { Move-Item -LiteralPath $stagePath -Destination $targetPath }
catch {
  if ($hadTarget -and -not (Test-Path -LiteralPath $targetPath)) {
    Move-Item -LiteralPath $backupPath -Destination $targetPath
  }
  throw
}
Write-Output "Synchronized: $targetPath"
Write-Output "Previous project retained: $backupPath"
