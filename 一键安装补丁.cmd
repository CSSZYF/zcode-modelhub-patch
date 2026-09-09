@echo off
chcp 65001 >nul
title model-hub ZCode Patch Installer
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [i] Requesting administrator privilege. Click Yes on the UAC prompt.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [x] Node.js not found. Install it from https://nodejs.org and retry.
  pause
  exit /b 1
)

echo [i] Closing ZCode...
taskkill /IM ZCode.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo [i] Step 1/2: patching app.asar (model pull, header simulation)...
node patch-core.js > install-log.txt 2>&1
type install-log.txt

echo.
echo [i] Step 2/2: optional engine patch (edit ALL user messages)...
node engine-patch.js >> install-log.txt 2>&1
type install-log.txt | find /i "engine"

echo.
echo ===== done. You can close this window. =====
pause
