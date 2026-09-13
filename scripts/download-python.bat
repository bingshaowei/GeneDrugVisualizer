@echo off
setlocal enabledelayedexpansion
set PYTHON_VERSION=3.11.9
set PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-embed-amd64.zip
set ELECTRON_DIR=%~dp0..\electron
set TEMP_DIR=%TEMP%\python-embed-download
echo ===== Download Python %PYTHON_VERSION% Embeddable =====
mkdir "%TEMP_DIR%" 2>nul
if not exist "%ELECTRON_DIR%\python-embedded\python.exe" (
    echo Downloading from %PYTHON_URL%...
    powershell -Command "Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile '%TEMP_DIR%\python.zip'"
    if !errorlevel! neq 0 exit /b !errorlevel!
    echo Extracting to electron/python-embedded/...
    powershell -Command "Expand-Archive -Path '%TEMP_DIR%\python.zip' -DestinationPath '%ELECTRON_DIR%\python-embedded' -Force"
    if !errorlevel! neq 0 exit /b !errorlevel!
)
set PYTHON_EXE=%ELECTRON_DIR%\python-embedded\python.exe
set PTH_FILE=%ELECTRON_DIR%\python-embedded\python311._pth
powershell -Command "(Get-Content -LiteralPath '%PTH_FILE%') -replace '^#import site$', 'import site' | Set-Content -LiteralPath '%PTH_FILE%' -Encoding ascii"
"%PYTHON_EXE%" -c "import flask, pandas"
if !errorlevel! neq 0 (
    "%PYTHON_EXE%" -m pip --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo Installing pip...
        powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '%TEMP_DIR%\get-pip.py'"
        if !errorlevel! neq 0 exit /b !errorlevel!
        "%PYTHON_EXE%" "%TEMP_DIR%\get-pip.py"
        if !errorlevel! neq 0 exit /b !errorlevel!
    )
    echo Installing backend dependencies...
    "%PYTHON_EXE%" -m pip install -r "%~dp0..\backend\requirements.txt"
    if !errorlevel! neq 0 exit /b !errorlevel!
    "%PYTHON_EXE%" -c "import flask, pandas"
    if !errorlevel! neq 0 exit /b !errorlevel!
)
echo.
echo ===== Done =====
echo Python embedded path: %ELECTRON_DIR%\python-embedded
echo.
echo Python dependencies verified.
