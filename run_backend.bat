@echo off
title Law Scrapper Backend Server
echo ===================================================
echo   Law Scrapper Python Backend Server (FastAPI)
echo   [Uvicorn Auto-Reload Enabled]
echo ===================================================
echo.
cd /d "%~dp0"
echo [1] 파이썬 가상환경(.venv) 활성화 중...
call .venv\Scripts\activate
echo [2] 백엔드 서버 기동 중...
python -m backend.main
pause
