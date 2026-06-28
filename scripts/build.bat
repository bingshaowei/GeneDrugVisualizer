@echo off
setlocal enabledelayedexpansion
set ROOT=%~dp0..
set FRONTEND=%ROOT%\frontend
set BACKEND=%ROOT%\backend
set ELECTRON=%ROOT%\electron
echo ===== Gene Drug Visualizer - Build Script =====
echo.
echo [1/4] Building frontend...
cd /d "%FRONTEND%"
call npm install
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%
echo.
echo [2/4] Copying frontend build to electron/backend/build...
if exist "%ELECTRON%\backend" rmdir /s /q "%ELECTRON%\backend"
mkdir "%ELECTRON%\backend"
xcopy /E /I /Y "%FRONTEND%\build" "%ELECTRON%\backend\build"
echo.
echo [3/4] Copying backend files...
xcopy /Y "%BACKEND%\app.py" "%ELECTRON%\backend\"
xcopy /Y "%BACKEND%\requirements.txt" "%ELECTRON%\backend\"
if not exist "%ELECTRON%\backend\data" mkdir "%ELECTRON%\backend\data"
xcopy /E /I /Y "%BACKEND%\data" "%ELECTRON%\backend\data"
echo.
echo [4/4] Building Electron installer...
cd /d "%ELECTRON%"
call npm install
call npx electron-builder --win
if %errorlevel% equ 0 (
    echo.
    echo ===== BUILD SUCCESSFUL =====
    echo Installer: %ELECTRON%\dist\GeneDrugApp Setup *.exe
) else (
    echo.
    echo ===== BUILD FAILED =====
    exit /b %errorlevel%
)
