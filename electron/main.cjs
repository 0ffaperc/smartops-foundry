const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let orchestratorProc = null;

// --- Hermes Orchestrator backend (Perc Jr.) auto-start ----------------------
function isBackendUp() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:8787/health', { timeout: 1500 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function startOrchestratorBackend() {
  // Don't start a second copy if one is already listening.
  if (await isBackendUp()) {
    console.log('[orchestrator] backend already running on :8787');
    return;
  }
  const serverPath = path.join(__dirname, '..', 'orchestrator-server', 'server.mjs');
  try {
    orchestratorProc = spawn(process.execPath, ['--env-file=.env', serverPath], {
      cwd: path.join(__dirname, '..', 'orchestrator-server'),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'ignore',
      detached: false,
    });
    orchestratorProc.on('error', (e) => console.error('[orchestrator] failed to start:', e.message));
    console.log('[orchestrator] backend launched');
  } catch (e) {
    console.error('[orchestrator] spawn error:', e.message);
  }
}

function stopOrchestratorBackend() {
  if (orchestratorProc && !orchestratorProc.killed) {
    try { orchestratorProc.kill(); } catch (_) {}
    orchestratorProc = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: true,
    backgroundColor: '#08080f',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startOrchestratorBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  stopOrchestratorBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopOrchestratorBackend();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
