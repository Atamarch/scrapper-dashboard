@echo off

REM Start LinkedIn Crawler API

echo ================================
echo LinkedIn Crawler API
echo ================================

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Check if .env exists
if not exist ".env" (
    echo Creating .env file...
    copy .env.example .env
    echo WARNING: Please edit .env file with your configuration
)

REM Start API server
echo.
echo ================================
echo Starting API server...
echo ================================
echo.
echo API will be available at:
echo   - http://localhost:8000
echo   - Docs: http://localhost:8000/docs
echo.

uvicorn main:app --reload --host 0.0.0.0 --port 8000
