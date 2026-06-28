@echo off
echo Starting backend...
cd /d "%~dp0..\backend"
echo Backend directory: %cd%
python app.py
pause