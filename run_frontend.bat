@echo off
title Frontend Web App
echo ========================================================
echo Starting Frontend Next.js Dev Server on http://localhost:3000 ...
echo ========================================================
cd /d "%~dp0frontend"
npm.cmd run dev
pause
