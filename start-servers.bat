@echo off
title SmartOps Foundry - Server Manager
color 0B

echo ========================================
echo   SmartOps Foundry - Server Startup
echo ========================================
echo.

REM Kill any existing instances to avoid port conflicts
echo [1/4] Cleaning up old processes...
taskkill /F /IM cloudflared.exe >nul 2>&1
REM Kill node processes only on port 3000 and 8787 (not all node)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8787 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul
echo     Done.
echo.

REM Start the orchestrator server (API, auth, chat) on port 8787
echo [2/4] Starting Orchestrator Server (port 8787)...
cd /d "C:\Users\shahe\Desktop\lifeos-v2-restored\lifeos-v2-ready\orchestrator-server"
start "SmartOps - Orchestrator (:8787)" /min cmd /k "node --env-file=.env server.mjs"
echo     Waiting for orchestrator to boot...
timeout /t 4 /nobreak >nul

REM Verify orchestrator is up
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8787/api/agency/clients' -UseBasicParsing -TimeoutSec 5; if ($r.StatusCode -eq 401 -or $r.StatusCode -eq 200) { Write-Host '    OK - Orchestrator is running' -ForegroundColor Green } else { Write-Host '    WARN - Unexpected response' -ForegroundColor Yellow } } catch { if ($_.Exception.Response.StatusCode.value__ -eq 401) { Write-Host '    OK - Orchestrator is running' -ForegroundColor Green } else { Write-Host '    ERROR - Orchestrator not responding' -ForegroundColor Red } }"
echo.

REM Start the static website server on port 3000
echo [3/4] Starting Website Server (port 3000)...
start "SmartOps - Website (:3000)" /min cmd /k "node smartops-server.mjs"
timeout /t 3 /nobreak >nul

REM Verify website is up
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 5; if ($r.StatusCode -eq 200) { Write-Host '    OK - Website is running' -ForegroundColor Green } else { Write-Host '    WARN - Unexpected response' -ForegroundColor Yellow } } catch { Write-Host '    ERROR - Website not responding' -ForegroundColor Red }"
echo.

REM Start the Cloudflare tunnel
echo [4/4] Starting Cloudflare Tunnel...
start "SmartOps - Cloudflare Tunnel" /min cmd /k "cloudflared tunnel run"
echo     Waiting for tunnel to connect...
timeout /t 10 /nobreak >nul

REM Verify the public site is up
powershell -Command "try { $r = Invoke-WebRequest -Uri 'https://smartopsfoundry.com' -UseBasicParsing -TimeoutSec 10; if ($r.StatusCode -eq 200) { Write-Host '    OK - smartopsfoundry.com is LIVE' -ForegroundColor Green } else { Write-Host '    WARN - Got status '$r.StatusCode -ForegroundColor Yellow } } catch { Write-Host '    ERROR - Site not reachable yet (tunnel may still be connecting)' -ForegroundColor Red; Write-Host '    Wait 30 seconds and refresh smartopsfoundry.com' -ForegroundColor Yellow }"
echo.

echo ========================================
echo   All servers started!
echo.
echo   Orchestrator:  http://localhost:8787
echo   Website:      http://localhost:3000
echo   Public URL:   https://smartopsfoundry.com
echo.
echo   Each server runs in its own window.
echo   Close those windows to stop them.
echo.
echo   To restart: re-run this script.
echo ========================================
echo.
pause
