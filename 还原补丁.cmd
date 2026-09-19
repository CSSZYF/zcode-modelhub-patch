@echo off
chcp 65001 >nul
title model-hub ZCode Patch Restore
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [i] Requesting administrator privilege. Click Yes on the UAC prompt.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -WorkingDirectory '%~dp0' -Verb RunAs"
  exit /b
)

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [x] Node.js not found. Install it from https://nodejs.org and retry.
  pause
  exit /b 1
)

:waitclose
tasklist /FI "IMAGENAME eq ZCode.exe" 2>nul | find /I "ZCode.exe" >nul
if not errorlevel 1 (
  echo [i] ZCode is still running. Quit it completely first:
  echo     right-click the tray icon -^> Quit  ^(closing the window is not enough^)
  echo     Then press any key here to continue...
  pause >nul
  goto waitclose
)

node patch-core.js --restore > restore-log.txt 2>&1
type restore-log.txt
if errorlevel 1 (
  echo.
  echo [x] Restore failed - see restore-log.txt above.
  pause
  exit /b 1
)

echo.
echo ===== done. ZCode is back to the official version. =====
pause
