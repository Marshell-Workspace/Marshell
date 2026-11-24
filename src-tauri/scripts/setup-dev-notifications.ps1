# setup-dev-notifications.ps1
param(
  [string]$AppId = 'com.hyperion.desktop',
  [string]$AppName = 'Marshell'
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$tauriRoot = Split-Path -Parent $scriptDir
$iconPath = Join-Path $tauriRoot 'icons\icon.ico'
$exePath = Join-Path $tauriRoot 'target\debug\marshell.exe'

# 1. Registry
$regKey = 'HKCU:\Software\Classes\AppUserModelId\' + $AppId
if (-not (Test-Path $regKey)) {
  New-Item -Path $regKey -Force | Out-Null
}
Set-ItemProperty -Path $regKey -Name 'DisplayName' -Value 'Marshell'
if (Test-Path $iconPath) {
  Set-ItemProperty -Path $regKey -Name 'IconUri' -Value (Resolve-Path $iconPath).Path
}
Set-ItemProperty -Path $regKey -Name 'ShowInSettings' -Value 1 -Type DWord
Write-Host ('  [OK] Registered Windows Registry AUMID: ' + $AppId)

# 2. Start Menu Shortcut
$shortcutDir = [System.IO.Path]::Combine($env:APPDATA, 'Microsoft\Windows\Start Menu\Programs')
$shortcutPath = Join-Path $shortcutDir ($AppName + '.lnk')

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
if (Test-Path $exePath) {
  $shortcut.TargetPath = (Resolve-Path $exePath).Path
  $shortcut.WorkingDirectory = Split-Path -Parent (Resolve-Path $exePath).Path
} else {
  $shortcut.TargetPath = $env:SystemRoot + '\explorer.exe'
}
$shortcut.Description = 'Marshell'
if (Test-Path $iconPath) {
  $shortcut.IconLocation = (Resolve-Path $iconPath).Path + ',0'
}
$shortcut.Save()

Write-Host ('  [OK] Created Start Menu shortcut: ' + $shortcutPath)
Write-Host '  [SUCCESS] Marshell Windows notification identity is configured.'
