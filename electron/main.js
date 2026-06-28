const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  // 加载本地 React 构建后的 index.html
  const indexPath = path.join(
    isDev ? __dirname : path.join(process.resourcesPath, 'backend'),
    'build',
    'index.html'
  );
  console.log(`✅ 加载页面: ${indexPath}`);
  mainWindow.loadFile(indexPath);

  // 页面加载事件监听
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`❌ 页面加载失败: ${errorDescription} (${errorCode}) @ ${validatedURL}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ 页面加载完成');
  });
}

app.whenReady().then(() => {
  const basePath = isDev ? __dirname : process.resourcesPath;
  const pythonExec = path.join(basePath, 'python-embedded', 'python.exe');
  const scriptPath = path.join(basePath, 'backend', 'app.py');
  const backendDir = path.join(basePath, 'backend');

  console.log(`✅ 启动 Python 后端: ${pythonExec}`);
  console.log(`📂 后端目录: ${backendDir}`);

  backendProcess = spawn(pythonExec, [scriptPath], { cwd: backendDir });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Flask stdout] ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Flask stderr] ${data}`);
  });

  backendProcess.on('error', (err) => {
    console.error('❌ Python 后端启动失败：', err);
  });

  backendProcess.on('exit', (code) => {
    console.warn(`⚠️ Python 后端退出，退出码: ${code}`);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


