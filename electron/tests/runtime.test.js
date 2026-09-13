const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { isAllowedNavigation, resolveRuntimePaths, waitForBackend } = require('../runtime');


test('开发模式使用源码后端和前端构建目录', () => {
  const result = resolveRuntimePaths({
    isPackaged: false,
    dirname: path.join('D:', 'repo', 'electron'),
    resourcesPath: path.join('D:', 'resources'),
    env: { PYTHON_EXECUTABLE: 'python-custom.exe' },
  });
  assert.equal(result.pythonExec, 'python-custom.exe');
  assert.equal(result.scriptPath, path.join('D:', 'repo', 'backend', 'app.py'));
  assert.equal(result.frontendBuildDir, path.join('D:', 'repo', 'frontend', 'build'));
});

test('打包模式使用 resources 中的后端和嵌入式 Python', () => {
  const resourcesPath = path.join('D:', 'resources');
  const result = resolveRuntimePaths({ isPackaged: true, dirname: 'unused', resourcesPath, env: {} });
  assert.equal(result.pythonExec, path.join(resourcesPath, 'python-embedded', 'python.exe'));
  assert.equal(result.scriptPath, path.join(resourcesPath, 'backend', 'app.py'));
  assert.equal(result.frontendBuildDir, path.join(resourcesPath, 'backend', 'build'));
});

test('健康检查只接受正确的服务标识', async () => {
  let attempts = 0;
  const health = await waitForBackend({
    timeoutMs: 100,
    intervalMs: 1,
    requestHealth: async () => {
      attempts += 1;
      return attempts === 1
        ? { service: 'other', status: 'ready' }
        : { service: 'gene-drug-visualizer', status: 'ready' };
    },
  });
  assert.equal(health.status, 'ready');
  assert.equal(attempts, 2);
});

test('后端进程提前退出会立即终止等待', async () => {
  await assert.rejects(
    waitForBackend({
      timeoutMs: 100,
      intervalMs: 1,
      isProcessAlive: () => false,
      requestHealth: async () => { throw new Error('not ready'); },
    }),
    /后端进程已退出/
  );
});

test('导航只允许精确的本地服务源', () => {
  assert.equal(isAllowedNavigation('http://127.0.0.1:5000/path'), true);
  assert.equal(isAllowedNavigation('http://127.0.0.1:5000.evil.example/path'), false);
  assert.equal(isAllowedNavigation('https://example.com'), false);
});
