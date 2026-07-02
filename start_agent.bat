@echo off
:: Orbit Agent - starts the tray app hidden (no console window stays open).
:: Look for the Orbit icon in the system tray; the QR window opens automatically.
cd /d "%~dp0agent"
start "" venv\Scripts\pythonw.exe src\tray.py
echo Orbit Agent started. Look for the Orbit icon in your system tray.
timeout /t 4 >nul
