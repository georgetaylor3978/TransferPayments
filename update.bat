@echo off
echo ═══════════════════════════════════════════
echo   Transfer Payments — Update + Deploy
echo ═══════════════════════════════════════════
echo.

echo [1/3] Fetching latest data from Open Canada API...
node fetch_data.js
if %ERRORLEVEL% neq 0 (
    echo ERROR: Data fetch failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Staging changes...
git add -A

echo.
echo [3/3] Committing and pushing to GitHub...
set TIMESTAMP=%date% %time%
git commit -m "Data update: %TIMESTAMP%"
git push origin main

echo.
echo ✓ Done! GitHub Pages will update shortly.
pause
