@echo off
chcp 65001 > nul
title DWG / DXF 3D 웹 뷰어 서버 실행기

:: Node.js 경로 자동 추가 (Windows 환경변수 미갱신 방지)
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"

echo ==================================================
echo   🚀 DWG / DXF 3D 웹 뷰어 서버를 시작합니다...
echo ==================================================
echo.

cd /d "%~dp0"

IF NOT EXIST "node_modules" (
    echo [안내] 최초 실행으로 필수 패키지를 설치하는 중입니다...
    call npm install
    echo.
)

echo [안내] 백엔드 서버 구동 완료! 브라우저를 엽니다...
start http://localhost:3000
node server.js

pause
