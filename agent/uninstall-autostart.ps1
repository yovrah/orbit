# Orbit Agent - Autostart remover
# Stops and unregisters the OrbitAgent scheduled task.
# Run:  powershell -ExecutionPolicy Bypass -File uninstall-autostart.ps1

$ErrorActionPreference = 'Stop'
$TaskName = 'OrbitAgent'

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[OK] Autostart task '$TaskName' removed." -ForegroundColor Green
} else {
    Write-Host "Task '$TaskName' is not installed - nothing to do."
}
