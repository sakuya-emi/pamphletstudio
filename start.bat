@echo off
cd /d "%~dp0"
if not exist node_modules\vite\bin\vite.js (
  echo Run npm install in this folder first.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:5173 in your browser.
node node_modules\vite\bin\vite.js --host 127.0.0.1
pause
