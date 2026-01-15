@echo off
echo ========================================
echo COGNICODE Setup Script (Windows)
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Setting up backend...
cd backend

REM Create virtual environment
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
) else (
    echo Virtual environment already exists
)

REM Activate virtual environment and install dependencies
echo Installing backend dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt

REM Copy .env.example to .env if .env doesn't exist
if not exist .env (
    echo Creating .env file...
    copy .env.example .env
) else (
    echo .env file already exists
)

cd ..

echo.
echo [2/5] Setting up frontend...
cd frontend

REM Install frontend dependencies
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
) else (
    echo Node modules already installed
)

cd ..

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the application:
echo.
echo 1. Start the backend:
echo    cd backend
echo    venv\Scripts\activate
echo    uvicorn app.main:app --reload
echo.
echo 2. In a new terminal, start the frontend:
echo    cd frontend
echo    npm run dev
echo.
echo 3. Open your browser to http://localhost:3000
echo.
echo See README.md for more information.
echo.
pause
