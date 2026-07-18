const { spawn } = require('child_process');
const { resolve } = require('path');

console.log('Starting Vite dev server...');

const vite = spawn('npx', ['vite', '--host'], {
  stdio: 'pipe',
  shell: true,
  cwd: resolve(__dirname, '..'),
});

vite.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);
  if (text.includes('Local:')) {
    console.log('Vite ready. Starting Electron...');
    setTimeout(() => {
      const electron = spawn('npx', ['electron', '.'], {
        stdio: 'inherit',
        shell: true,
        cwd: resolve(__dirname, '..'),
        env: { ...process.env, ELECTRON_DEV: 'true', NODE_ENV: 'development' },
      });
      electron.on('close', () => {
        vite.kill();
        process.exit();
      });
    }, 1000);
  }
});

vite.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

vite.on('close', (code) => {
  process.exit(code);
});
