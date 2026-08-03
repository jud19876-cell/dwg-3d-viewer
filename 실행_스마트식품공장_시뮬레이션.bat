@echo off
chcp 65001 > nul
title 스마트 식품공장 3D 디지털 트윈 시뮬레이션
echo ========================================================
echo   스마트 식품공장 3D 디지털 트윈 & 비교 시뮬레이터 가동
echo ========================================================
echo.
cd /d "%~dp0food_factory_sim"

echo [1/2] 백엔드 시뮬레이션 엔진 실행...
start /b python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
timeout /t 2 > nul

echo [2/2] 3D 시뮬레이터 실행...
start "" "%~dp0food_factory_sim\standalone_3d_twin.html"

echo.
echo ========================================================
echo   시뮬레이션 시스템이 가동되었습니다.
echo   브라우저 화면에서 [DES 시뮬레이션 가동] 버튼을 누르시면 됩니다!
echo ========================================================
echo.
pause
