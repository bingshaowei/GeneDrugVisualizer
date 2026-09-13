const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const { SERVICE_URL, isAllowedNavigation, resolveRuntimePaths, waitForBackend } = require('./runtime');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });
  console.log(`✅ 加载页面: ${SERVICE_URL}`);
  mainWindow.loadURL(SERVICE_URL);

  // 页面加载事件监听
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`❌ 页面加载失败: ${errorDescription} (${errorCode}) @ ${validatedURL}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ 页面加载完成');
  });
}

app.whenReady().then(async () => {
  const runtime = resolveRuntimePaths({ isPackaged: app.isPackaged, dirname: __dirname, resourcesPath: process.resourcesPath });
  let backendAlive = true;

  console.log(`✅ 启动 Python 后端: ${runtime.pythonExec}`);
  console.log(`📂 后端目录: ${runtime.backendDir}`);

  backendProcess = spawn(runtime.pythonExec, [runtime.scriptPath], {
    cwd: runtime.backendDir,
    env: { ...process.env, FRONTEND_BUILD_DIR: runtime.frontendBuildDir, PYTHONUNBUFFERED: '1' },
    windowsHide: true,
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Flask stdout] ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Flask stderr] ${data}`);
  });

  backendProcess.on('error', (err) => {
    backendAlive = false;
    console.error('❌ Python 后端启动失败：', err);
  });

  backendProcess.on('exit', (code) => {
    backendAlive = false;
    console.warn(`⚠️ Python 后端退出，退出码: ${code}`);
  });

  try {
    await waitForBackend({ isProcessAlive: () => backendAlive });
    createWindow();
  } catch (error) {
    console.error('❌ 后端启动失败：', error);
    dialog.showErrorBox('Gene Drug Visualizer 启动失败', `${error.message}\n\n请确认 Python 运行时和数据文件完整。`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


