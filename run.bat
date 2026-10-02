@echo off
cd /d "%~dp0"

echo ============================================
echo   UniReserve - Campus Resource Booking
echo ============================================

rem Install dependencies if needed
if not exist node_modules (
    echo Installing npm packages...
    npm install
)

echo.
echo Starting server on http://localhost:3000
echo.

rem Open the login page in the browser FIRST (before the blocking node call)
timeout /t 2 /nobreak >nul
start http://localhost:3000/login.html

rem Start the server (this blocks until you press Ctrl+C)
node server.js
