@echo off
title College Attendance Project Launcher
echo ========================================================
echo  Smart CCTV Attendance Ledger - 1-Click Launcher
echo ========================================================
cd /d "%~dp0"
start "Backend API (Port 8000)" cmd /k "%~dp0run_backend.bat"
echo Waiting for backend to initialize...
timeout /t 3 /nobreak >nul
start "Frontend UI (Port 3000)" cmd /k "%~dp0run_frontend.bat"
echo.
echo Both servers have been launched in separate windows!
echo Backend API : http://127.0.0.1:8000/api/docs
echo Frontend UI : http://localhost:3000
echo.
echo Default Login: admin@attendance.edu / admin123
echo.
pause
