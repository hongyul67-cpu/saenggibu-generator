@echo off
chcp 65001 >nul
title 생기부 문장 생성기
cd /d "%~dp0"

rem Node가 PATH에 없으면 기본 설치 경로를 추가
where npm >nul 2>nul || set "PATH=C:\Program Files\nodejs;%PATH%"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo [오류] Node.js를 찾을 수 없습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo [최초 1회] 필요한 구성요소를 설치합니다. 수 분 걸릴 수 있어요...
  echo.
  call npm install
)

echo.
echo ============================================================
echo  생기부 문장 생성기를 시작합니다.
echo  잠시 후 브라우저가 자동으로 열립니다.
echo.
echo  * 이 검은 창은 닫지 마세요 (닫으면 프로그램이 종료됩니다).
echo  * 종료하려면 이 창에서 Ctrl + C 를 누르거나 창을 닫으세요.
echo ============================================================
echo.

call npm run dev -- --open
pause
