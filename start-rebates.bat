@echo off
title Rebates Application

echo ========================================
echo       STARTING REBATES APPLICATION
echo ========================================
echo.

echo Starting Frontend...
start "Rebates Frontend" cmd /k "cd /d C:\Users\GA\Documents\GitHub\rebates\frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo Starting Backend...
start "Rebates Backend" cmd /k "cd /d C:\Users\GA\Documents\GitHub\rebates\backend && npm run dev"

echo.
echo ========================================
echo Frontend and Backend startup commands sent.
echo ========================================
echo.
pause