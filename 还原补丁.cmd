@echo off
chcp 65001 >nul
title model-hub ZCode Patch Restore
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
timeout /t 3 /nobreak >nul
taskkill /IM ZCode.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul

node patch-core.js --restore > restore-log.txt 2>&1
type restore-log.txt

set GLM=C:\Program Files\ZCode\resources\glm
if exist "%GLM%\zcode.cjs.modelhub-backup" (
  copy /y "%GLM%\zcode.cjs.modelhub-backup" "%GLM%\zcode.cjs.tmp" >nul
  for %%A in ("%GLM%\zcode.cjs.modelhub-backup") do set BS=%%~zA
  for %%A in ("%GLM%\zcode.cjs.tmp") do set TS=%%~zA
  if "%BS%"=="%TS%" (
    move /y "%GLM%\zcode.cjs.tmp" "%GLM%\zcode.cjs" >nul
    echo [OK] engine restored - zcode.cjs
  ) else (
    del /f "%GLM%\zcode.cjs.tmp" >nul 2>&1
    echo [x] engine restore size mismatch - skipped, engine left unchanged
  )
)

echo.
echo ===== done. You can close this window. =====
pause
