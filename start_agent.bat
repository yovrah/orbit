@echo off
title Orbit Remote Agent
echo Starting Orbit Remote Agent...
cd /d "%~dp0agent"
venv\Scripts\python.exe src/main.py
pause
