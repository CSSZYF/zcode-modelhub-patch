@echo off
chcp 65001 >nul
title model-hub ZCode Patch Installer
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

echo.
echo [1/3] Patching app.asar ^(model pull / header simulation / privacy^)...
node patch-core.js > install-log.txt 2>&1
if errorlevel 1 (
  type install-log.txt
  echo.
  echo [x] Step 1 failed - nothing was replaced. See install-log.txt above.
  pause
  exit /b 1
)
type install-log.txt

echo.
choice /C YN /M "[2/3] Install optional ENGINE patch - edit ALL user messages (Y/N)"
if errorlevel 2 goto step3
node engine-patch.js >> install-log.txt 2>&1
if errorlevel 1 (
  echo [i] Engine patch not applied - see install-log.txt
) else (
  echo [OK] Engine patch applied.
)

:step3
echo.
echo [3/3] Materializing bundled computer-use plugin ^(fixes "Plugin not found"^)...
set "RES="
for /f "delims=" %%D in ('node patch-core.js --detect') do set "RES=%%D"
if not defined RES goto done
if /I "%RES%"=="NOT_FOUND" goto done
for %%I in ("%RES%\..") do set "LIVE=%%~fI"
if not exist "%LIVE%\ZCode.exe" goto done
set "ELECTRON_RUN_AS_NODE=1"
"%LIVE%\ZCode.exe" "%LIVE%\resources\glm\zcode.cjs" plugins list > "%TEMP%\modelhub-plugins.txt" 2>&1
set "ELECTRON_RUN_AS_NODE="
findstr /I "computer-use" "%TEMP%\modelhub-plugins.txt" >nul
if errorlevel 1 (
  echo [i] computer-use not in plugin list - skipped ^(non-fatal^)
) else (
  echo [OK] computer-use plugin present.
)

:done
echo.
echo ===== done. Open ZCode: Settings - Model Providers - Add/Edit channel. =====
pause
