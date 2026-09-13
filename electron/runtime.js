const http = require('http');
const path = require('path');


const SERVICE_URL = 'http://127.0.0.1:5000';

function isAllowedNavigation(url) {
  try {
    return new URL(url).origin === SERVICE_URL;
  } catch (_error) {
    return false;
  }
}

function resolveRuntimePaths({ isPackaged, dirname, resourcesPath, env = process.env }) {
  if (isPackaged) {
    return {
      pythonExec: path.join(resourcesPath, 'python-embedded', 'python.exe'),
      scriptPath: path.join(resourcesPath, 'backend', 'app.py'),
      backendDir: path.join(resourcesPath, 'backend'),
      frontendBuildDir: path.join(resourcesPath, 'backend', 'build'),
    };
  }
  const projectRoot = path.resolve(dirname, '..');
  return {
    pythonExec: env.PYTHON_EXECUTABLE || path.join(dirname, 'python-embedded', 'python.exe'),
    scriptPath: path.join(projectRoot, 'backend', 'app.py'),
    backendDir: path.join(projectRoot, 'backend'),
    frontendBuildDir: path.join(projectRoot, 'frontend', 'build'),
  };
}

function requestHealth() {
  return new Promise((resolve, reject) => {
    const request = http.get(`${SERVICE_URL}/health`, { timeout: 1000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('健康检查超时')));
    request.on('error', reject);
  });
}

async function waitForBackend({
  timeoutMs = 30000,
  intervalMs = 250,
  requestHealth: check = requestHealth,
  isProcessAlive = () => true,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive()) throw new Error('后端进程已退出');
    try {
      const health = await check();
      if (health?.service === 'gene-drug-visualizer' && health?.status === 'ready') return health;
    } catch (_error) {
      // 服务加载数据期间连接失败属于正常重试。
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('后端在 30 秒内未就绪，请检查 Python 环境和数据文件');
}

module.exports = { SERVICE_URL, isAllowedNavigation, requestHealth, resolveRuntimePaths, waitForBackend };
