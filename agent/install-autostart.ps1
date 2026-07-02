# Orbit Agent - Autostart installer
# Registers a per-user Scheduled Task that launches the agent at logon, fully
# hidden (no console window), in the interactive desktop session (required:
# input emulation + screen capture only work in the user's own session).
#
# The task runs wscript.exe on start-orbit-hidden.vbs, which launches the venv's
# pythonw with stdout/stderr redirected to logs\orbit-agent.log. The redirect is
# required: under pythonw sys.stdout is None and uvicorn crashes on isatty().
#
# No administrator rights are needed for a per-user "At log on" task.
# Run:  powershell -ExecutionPolicy Bypass -File install-autostart.ps1

$ErrorActionPreference = 'Stop'
$TaskName = 'OrbitAgent'
$AgentDir = $PSScriptRoot

$launcher = Join-Path $AgentDir 'start-orbit-hidden.vbs'
$pythonw  = Join-Path $AgentDir 'venv\Scripts\pythonw.exe'
$entry    = Join-Path $AgentDir 'src\tray.py'
$wscript  = Join-Path $env:SystemRoot 'System32\wscript.exe'

foreach ($req in @($launcher, $pythonw, $entry, $wscript)) {
    if (-not (Test-Path $req)) { throw "Required file not found: $req" }
}

Write-Host "Agent dir : $AgentDir"
Write-Host "Launcher  : $launcher"

$action = New-ScheduledTaskAction -Execute $wscript -Argument "`"$launcher`"" -WorkingDirectory $AgentDir

# At logon for THIS user, with a short delay so the network stack is ready.
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$trigger.Delay = 'PT15S'

# Interactive session, least privilege -> no UAC prompt.
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $TaskName `
    -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
    -Description 'Orbit Remote Agent - starts the phone-to-PC control server at logon.' `
    -Force | Out-Null

Write-Host ""
Write-Host "[OK] Autostart installed as scheduled task '$TaskName'." -ForegroundColor Green
Write-Host "     Launches automatically at every logon (hidden, no window)."
Write-Host "     Start now without rebooting:  Start-ScheduledTask -TaskName $TaskName"
Write-Host "     Logs:                         $AgentDir\logs\orbit-agent.log"
Write-Host "     Remove later:                 .\uninstall-autostart.ps1"
