@echo off
setlocal
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "FRONTEND=%ROOT%\frontend"
set "ELECTRON=%ROOT%\electron"
cd /d "%ROOT%"
if %errorlevel% neq 0 exit /b %errorlevel%
set "OUTPUT_DIR=%ELECTRON%\dist"
if not "%~1"=="" set "OUTPUT_DIR=%~1"
for %%I in ("%OUTPUT_DIR%") do set "OUTPUT_DIR=%%~fI"
echo ===== Gene Drug Visualizer - Build Script =====
echo Output directory: %OUTPUT_DIR%
echo.

if exist "%OUTPUT_DIR%" if not exist "%OUTPUT_DIR%\" goto output_is_file
if exist "%OUTPUT_DIR%" (
    for /f "eol=| delims=" %%F in ('dir /b /a "%OUTPUT_DIR%" 2^>nul') do (
        echo ERROR: Output directory is not empty: %OUTPUT_DIR%
        dir /b /a "%OUTPUT_DIR%"
        exit /b 2
    )
)

echo [1/5] Preparing embedded Python...
call "%~dp0download-python.bat"
if %errorlevel% neq 0 exit /b %errorlevel%
set "PYTHON_EXE=%ELECTRON%\python-embedded\python.exe"

echo [2/5] Validating source data and testing backend...
"%PYTHON_EXE%" -B "%~dp0validate-data.py" --data-dir "%ROOT%\backend\data" --manifest "%ROOT%\backend\data-manifest.json"
if %errorlevel% neq 0 exit /b %errorlevel%
"%PYTHON_EXE%" -B -m unittest discover -s "%ROOT%\backend\tests" -v
if %errorlevel% neq 0 exit /b %errorlevel%

echo [3/5] Testing and building frontend...
cd /d "%FRONTEND%"
if %errorlevel% neq 0 exit /b %errorlevel%
call npm ci
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run audit:security
if %errorlevel% neq 0 exit /b %errorlevel%
call npm test
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%

echo [4/5] Testing and building Electron installer...
cd /d "%ELECTRON%"
if %errorlevel% neq 0 exit /b %errorlevel%
call npm ci
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run audit:security
if %errorlevel% neq 0 exit /b %errorlevel%
call npm test
if %errorlevel% neq 0 exit /b %errorlevel%
call npx electron-builder --win --x64 --config.directories.output="%OUTPUT_DIR%"
if %errorlevel% neq 0 exit /b %errorlevel%

echo [5/5] Validating release artifacts and runtime...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-release.ps1" -DistPath "%OUTPUT_DIR%"
if %errorlevel% neq 0 exit /b %errorlevel%

echo.
echo ===== BUILD SUCCESSFUL =====
echo Installer directory: %OUTPUT_DIR%
exit /b 0

:output_is_file
echo ERROR: Output path is not a directory: %OUTPUT_DIR%
exit /b 2
