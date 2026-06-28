@echo off
setlocal enabledelayedexpansion
set PYTHON_VERSION=3.11.9
set PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-embed-amd64.zip
set ELECTRON_DIR=%~dp0..\electron
set TEMP_DIR=%TEMP%\python-embed-download
echo ===== Download Python %PYTHON_VERSION% Embeddable =====
if exist "%ELECTRON_DIR%\python-embedded\python.exe" (
    echo Python embedded already exists. Delete "%ELECTRON_DIR%\python-embedded" to reinstall.
    exit /b 0
)
mkdir "%TEMP_DIR%" 2>nul
echo Downloading from %PYTHON_URL%...
powershell -Command "Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile '%TEMP_DIR%\python.zip'"
echo Extracting to electron/python-embedded/...
powershell -Command "Expand-Archive -Path '%TEMP_DIR%\python.zip' -DestinationPath '%ELECTRON_DIR%\python-embedded' -Force"
echo.
echo ===== Done =====
echo Python embedded path: %ELECTRON_DIR%\python-embedded
echo.
echo Next step: Install Python dependencies
echo   %ELECTRON_DIR%\python-embedded\python.exe -m pip install flask flask-cors pandas
echo   (get-pip.py needed first for embedded Python)
