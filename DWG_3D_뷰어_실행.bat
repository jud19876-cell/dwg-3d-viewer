@echo off
chcp 65001 > nul
title DWG / DXF 3D 웹 뷰어 원클릭 실행기

:: Node.js 경로 자동 탐색
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"

echo =======================================================================
echo   🚀 DWG / DXF 3D 웹 도면 뷰어 (AutoCAD 300 DPI 플롯 탑재)
echo =======================================================================
echo.

cd /d "%~dp0"

:: 1. Node.js 설치 상태 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [경고] 컴퓨터에 Node.js가 설치되어 있지 않습니다.
    echo [안내] https://nodejs.org 에서 Node.js를 설치 후 다시 실행하세요.
    pause
    exit /b
)

:: 2. 필수 라이브러리 패키지 검사 및 자동 설치
IF NOT EXIST "node_modules" (
    echo [안내] 최초 1회 실행을 위해 필수 패키지를 설치하고 있습니다...
    call npm install
    echo [성공] 패키지 설치가 완료되었습니다.
    echo.
)

:: 3. 브라우저 자동 오픈 및 백엔드 서버 시작
echo [안내] 도면 뷰어 웹 서버를 구동합니다...
start http://localhost:3000

node server.js

pause
