@echo off
setlocal
set "PYTHON_DIR=%~dp0..\electron\python-embedded"
set "PYTHON_EXE=%PYTHON_DIR%\python.exe"
set "LOCK=%~dp0..\backend\requirements-release.lock"
if exist "%PYTHON_DIR%" goto existing
set "TEMP_DIR=%TEMP%\gene-python-%RANDOM%-%RANDOM%"
if exist "%TEMP_DIR%" (echo Temporary path already exists. Retry. 1>&2 & exit /b 1)
mkdir "%TEMP_DIR%"
if errorlevel 1 exit /b 1
echo Downloading Python 3.11.9 Windows x64; retained staging directory: %TEMP_DIR%
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip' -OutFile (Join-Path $env:TEMP_DIR 'python.zip'); Expand-Archive -LiteralPath (Join-Path $env:TEMP_DIR 'python.zip') -DestinationPath (Join-Path $env:TEMP_DIR 'runtime')"
if errorlevel 1 goto failed
set "STAGED_PYTHON=%TEMP_DIR%\runtime\python.exe"
"%STAGED_PYTHON%" -c "import sys,struct; assert sys.version_info[:3] == (3,11,9) and sys.platform == 'win32' and struct.calcsize('P') == 8, 'Expected Python 3.11.9 Windows x64; actual: '+sys.version"
if errorlevel 1 goto failed
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; Set-Content -LiteralPath (Join-Path $env:TEMP_DIR 'runtime/python311._pth') -Encoding ascii -Value @('python311.zip','.','Lib/site-packages','import site'); Invoke-WebRequest -Uri 'https://files.pythonhosted.org/packages/c9/bc/b7db44f5f39f9d0494071bddae6880eb645970366d0a200022a1a93d57f5/pip-25.0.1-py3-none-any.whl' -OutFile (Join-Path $env:TEMP_DIR 'pip.zip')"
if errorlevel 1 goto failed
"%STAGED_PYTHON%" -c "import hashlib,pathlib,zipfile,sys; p=pathlib.Path(sys.argv[1]); assert hashlib.sha256(p.read_bytes()).hexdigest() == 'c46efd13b6aa8279f33f2864459c8ce587ea6a1a59ee20de055868d8f7688f7f', 'pip 25.0.1 wheel SHA256 mismatch'; zipfile.ZipFile(p).extractall(sys.argv[2])" "%TEMP_DIR%\pip.zip" "%TEMP_DIR%\runtime\Lib\site-packages"
if errorlevel 1 goto failed
"%STAGED_PYTHON%" -m pip install --disable-pip-version-check --require-hashes --only-binary=:all: -r "%LOCK%"
if errorlevel 1 goto failed
"%STAGED_PYTHON%" -B "%~dp0check-python.py" --lock "%LOCK%"
if errorlevel 1 goto failed
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; if (Test-Path -LiteralPath $env:PYTHON_DIR) {throw 'Destination appeared during setup; refusing overwrite'}; Copy-Item -LiteralPath (Join-Path $env:TEMP_DIR 'runtime') -Destination $env:PYTHON_DIR -Recurse"
if errorlevel 1 goto failed
:existing
if not exist "%PYTHON_EXE%" (echo Expected Python 3.11.9 Windows x64; actual missing executable. Use a fresh checkout; existing directory is not modified. 1>&2 & exit /b 1)
"%PYTHON_EXE%" -B "%~dp0check-python.py" --lock "%LOCK%"
exit /b %errorlevel%
:failed
echo Python setup failed. Staging files retained at %TEMP_DIR%. Use a fresh checkout; existing environments are never repaired or overwritten. 1>&2
exit /b 1
