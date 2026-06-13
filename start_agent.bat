@echo off
title Orbit Remote Agent
echo Starting Orbit Remote Agent...
cd /d "%~dp0agent"
call venv\Scripts\activate.bat
python src/main.py
pause
