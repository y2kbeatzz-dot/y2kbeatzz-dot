@echo off
setlocal
cd /d "%~dp0"
echo Starting Crystal Spotify setup...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0SETUP-SPOTIFY.ps1"
echo.
pause
