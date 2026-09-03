@echo off
cd /d "%~dp0"

echo Starting VitalsGrid...
where docker >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  echo Docker detected. Launching containerized app...
  docker compose up --build -d
  start "" http://localhost:8080
  echo App is running at http://localhost:8080
  exit /b 0
)

echo Docker not available. Falling back to local Node startup...
start "VitalsGrid" /min cmd /c "npm start"
timeout /t 4 /nobreak >nul
start "" http://localhost:8080
