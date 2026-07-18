$ErrorActionPreference="SilentlyContinue"

$app="C:\Users\shahe\Desktop\lifeos-v2-restored\lifeos-v2-ready"
$port=5173

Get-NetTCPConnection -LocalPort 5173,8787,8799 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force

Set-Location -LiteralPath $app

if(!(Test-Path "$app\node_modules")){
  npm install
}

$cmd="Set-Location -LiteralPath '$app'; npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
Start-Process powershell -WindowStyle Minimized -ArgumentList @("-NoExit","-Command",$cmd)

$ready=$false
for($i=0; $i -lt 60; $i++){
  try {
    $r=Invoke-WebRequest "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 2
    if($r.StatusCode -eq 200){ $ready=$true; break }
  } catch {}
  Start-Sleep -Seconds 1
}

if(!$ready){
  Write-Host "Vite did not become ready. Check the npm window for the red error." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit
}

$brave="$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe"
if(!(Test-Path $brave)){
  $brave="$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
}

$url="http://127.0.0.1:5173/?fresh=$(Get-Date -Format yyyyMMddHHmmss)"
$profile="$app\.brave-lifeos-clean-profile"
New-Item -ItemType Directory -Path $profile -Force | Out-Null

if(Test-Path $brave){
  Start-Process -FilePath $brave -ArgumentList @("--app=$url","--user-data-dir=$profile","--disable-extensions","--no-first-run")
} else {
  Start-Process $url
}
