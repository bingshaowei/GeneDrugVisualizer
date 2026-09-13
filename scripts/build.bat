@echo off
setlocal enabledelayedexpansion
set ROOT=%~dp0..
set FRONTEND=%ROOT%\frontend
set BACKEND=%ROOT%\backend
set ELECTRON=%ROOT%\electron
echo ===== Gene Drug Visualizer - Build Script =====
echo.
echo [1/3] Building frontend...
cd /d "%FRONTEND%"
call npm install
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%
echo.
echo [2/3] Preparing embedded Python...
call "%~dp0download-python.bat"
if %errorlevel% neq 0 exit /b %errorlevel%
echo.
echo [3/3] Building Electron installer...
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
