Set-Location "C:\Users\shahe\Desktop\lifeos-v2-restored\lifeos-v2-ready"

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force

Start-Process powershell -ArgumentList '-NoExit','-Command','cd "C:\Users\shahe\Desktop\lifeos-v2-restored\lifeos-v2-ready\backend"; py -m pip install -r requirements.txt; py -m uvicorn main:app --reload --host 127.0.0.1 --port 8787'

Start-Sleep -Seconds 4

Start-Process powershell -ArgumentList '-NoExit','-Command','cd "C:\Users\shahe\Desktop\lifeos-v2-restored\lifeos-v2-ready"; npm run dev -- --host 127.0.0.1 --port 5173'

Start-Sleep -Seconds 7

$brave="C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
if(!(Test-Path $brave)){$brave="C:\Users\shahe\AppData\Local\BraveSoftware\Brave-Browser\Application\brave.exe"}

if(Test-Path $brave){
  Start-Process $brave "--app=http://127.0.0.1:5173"
} else {
  Start-Process "http://127.0.0.1:5173"
}
