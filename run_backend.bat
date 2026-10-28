@echo off
title Backend API Server
echo ========================================================
echo Starting Backend API Server on http://127.0.0.1:8000 ...
echo Docs available at: http://127.0.0.1:8000/api/docs
echo ========================================================
cd /d "%~dp0"
.\venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause
