@echo off
setlocal
set "ROOT=%~dp0.."
set "FRONTEND=%ROOT%\frontend"
set "ELECTRON=%ROOT%\electron"
set "OUTPUT_DIR=%ELECTRON%\dist"
if not "%~1"=="" set "OUTPUT_DIR=%~1"
for %%I in ("%OUTPUT_DIR%") do set "OUTPUT_DIR=%%~fI"
echo ===== Gene Drug Visualizer - Build Script =====
echo Output directory: %OUTPUT_DIR%
echo.

if exist "%OUTPUT_DIR%" (
    for /f "eol=| delims=" %%F in ('dir /b /a "%OUTPUT_DIR%" 2^>nul') do (
        echo ERROR: Output directory is not empty: %OUTPUT_DIR%
        dir /b /a "%OUTPUT_DIR%"
        exit /b 2
    )
)

echo [1/4] Testing and building frontend...
cd /d "%FRONTEND%"
call npm ci
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run audit:security
if %errorlevel% neq 0 exit /b %errorlevel%
call npm test
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%
echo.

echo [2/4] Preparing embedded Python...
call "%~dp0download-python.bat"
if %errorlevel% neq 0 exit /b %errorlevel%
echo.

echo [3/4] Testing and building Electron installer...
cd /d "%ELECTRON%"
call npm ci
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run audit:security
if %errorlevel% neq 0 exit /b %errorlevel%
call npm test
if %errorlevel% neq 0 exit /b %errorlevel%
call npx electron-builder --win --config.directories.output="%OUTPUT_DIR%"
if %errorlevel% neq 0 exit /b %errorlevel%
echo.

echo [4/4] Validating release artifacts...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-release.ps1" -DistPath "%OUTPUT_DIR%"
if %errorlevel% neq 0 exit /b %errorlevel%

echo.
echo ===== BUILD SUCCESSFUL =====
echo Installer directory: %OUTPUT_DIR%
