@echo off
title Stop Rebates Application

echo ========================================
echo       STOPPING REBATES APPLICATION
echo ========================================
echo.

REM ========================================
REM STOP FRONTEND - PORT 3008
REM ========================================

echo [FRONTEND] Stopping port 3008...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3008 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM ========================================
REM STOP BACKEND - PORT 3009
REM ========================================

echo [BACKEND] Stopping port 3009...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3009 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo ========================================
echo       REBATES APPLICATION STOPPED
echo ========================================
echo.

pause