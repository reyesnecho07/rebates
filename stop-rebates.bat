@echo off
title Stop Rebates Application

echo ========================================
echo       STOPPING REBATES APPLICATION
echo ========================================
echo.

REM ========================================
REM STOP FRONTEND - PORT 3010
REM ========================================

echo [FRONTEND] Stopping port 3010...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3010 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM ========================================
REM STOP BACKEND - PORT 3011
REM ========================================

echo [BACKEND] Stopping port 3011...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3011 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo ========================================
echo       REBATES APPLICATION STOPPED
echo ========================================
echo.

pause