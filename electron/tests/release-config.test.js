const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const projectRoot = path.resolve(__dirname, '..', '..');

test('1.1.1 发布元数据包含作者和自定义 Windows 图标', () => {
  const electronPackage = require(path.join(projectRoot, 'electron', 'package.json'));
  const electronLock = require(path.join(projectRoot, 'electron', 'package-lock.json'));
  const frontendPackage = require(path.join(projectRoot, 'frontend', 'package.json'));
  const frontendLock = require(path.join(projectRoot, 'frontend', 'package-lock.json'));
  const iconPath = path.join(projectRoot, 'electron', 'build', 'icon.png');

  assert.equal(electronPackage.version, '1.1.1');
  assert.equal(frontendPackage.version, electronPackage.version);
  assert.equal(electronLock.version, electronPackage.version);
  assert.equal(electronLock.packages[''].version, electronPackage.version);
  assert.equal(frontendLock.version, electronPackage.version);
  assert.equal(frontendLock.packages[''].version, electronPackage.version);
  assert.equal(electronPackage.author, 'Shaowei Bing');
  assert.equal(electronPackage.build.appId, 'com.electron.gene-drug-electron');
  assert.equal(electronPackage.build.productName, 'GeneDrugApp');
  assert.equal(electronPackage.build.directories.output, 'dist');
  assert.equal(electronPackage.build.win.target, 'nsis');
  assert.equal(electronPackage.build.win.icon, 'build/icon.png');
  assert.deepEqual(electronPackage.build.files, ['main.js', 'runtime.js', 'package.json']);
  assert.deepEqual(electronPackage.build.nsis, {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  });
  assert.deepEqual(electronPackage.build.extraResources, [
    { from: '../backend/app.py', to: 'backend/app.py' },
    { from: '../backend/api.py', to: 'backend/api.py' },
    { from: '../backend/data_service.py', to: 'backend/data_service.py' },
    { from: '../backend/requirements.txt', to: 'backend/requirements.txt' },
    { from: '../backend/data', to: 'backend/data' },
    { from: '../frontend/build', to: 'backend/build' },
    { from: 'python-embedded', to: 'python-embedded' },
  ]);
  assert.equal(fs.existsSync(iconPath), true, '缺少 electron/build/icon.png');

  const png = fs.readFileSync(iconPath);
  assert.equal(png.readUInt32BE(16), 1024, '图标宽度必须为 1024');
  assert.equal(png.readUInt32BE(20), 1024, '图标高度必须为 1024');
  assert.ok([4, 6].includes(png[25]), 'PNG 必须包含透明通道');
  assert.equal(
    crypto.createHash('sha256').update(png).digest('hex').toUpperCase(),
    'CF8FD98DC895B30FDB9413C8FE7F2D558214F469A9A418D85B0EB9E0918C1E31',
    '图标必须保持为 v1.1 透明原图',
  );
});

test('electron-builder 26 使用 signtoolOptions 保持 Windows 未签名配置', () => {
  const electronPackage = require(path.join(projectRoot, 'electron', 'package.json'));

  assert.equal(electronPackage.build.win.signtoolOptions?.sign, null);
  assert.equal(Object.hasOwn(electronPackage.build.win, 'sign'), false);
});

test('Electron 44 发布使用 builder 默认下载解包而不固定 electronDist', () => {
  const electronPackage = require(path.join(projectRoot, 'electron', 'package.json'));

  // Electron 44 的 npm 包不包含 dist，交由 builder 获取运行时。
  assert.equal(Object.hasOwn(electronPackage.build, 'electronDist'), false);
});

test('界面显示版本与发布版本保持一致', () => {
  const electronPackage = require(path.join(projectRoot, 'electron', 'package.json'));
  const frontendPackage = require(path.join(projectRoot, 'frontend', 'package.json'));
  const appSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'src', 'App.jsx'), 'utf8');

  assert.equal(frontendPackage.version, electronPackage.version);
  assert.match(appSource, new RegExp(`version ${electronPackage.version.replaceAll('.', '\\.')}`));
});

test('Electron 发布依赖使用审计通过的精确版本', () => {
  const electronPackage = require(path.join(projectRoot, 'electron', 'package.json'));
  const electronLock = require(path.join(projectRoot, 'electron', 'package-lock.json'));

  const expectedDependencies = { '@electron/asar': '3.4.1', electron: '44.5.1', 'electron-builder': '26.15.3' };
  assert.deepEqual(electronPackage.devDependencies, expectedDependencies);
  assert.equal(electronLock.packages['node_modules/electron'].version, '44.5.1');
  assert.equal(electronLock.packages['node_modules/electron-builder'].version, '26.15.3');
  assert.equal(electronLock.packages['node_modules/@electron/asar'].version, '3.4.1');
});

test('Electron 锁文件根直接声明精确 ASAR 和发布依赖', () => {
  const electronLock = require(path.join(projectRoot, 'electron', 'package-lock.json'));

  assert.deepEqual(electronLock.packages[''].devDependencies, {
    '@electron/asar': '3.4.1',
    electron: '44.5.1',
    'electron-builder': '26.15.3',
  });
});

for (const readmeName of ['README.md', 'README.en.md']) {
  test(`${readmeName} 明确要求锁定依赖支持的 Node.js 分支和最低版本`, () => {
    const source = fs.readFileSync(path.join(projectRoot, readmeName), 'utf8');
    const nodeRequirement = source.split(/\r?\n/).find((line) => line.includes('Node.js'));

    assert.ok(nodeRequirement, 'README 缺少 Node.js 版本要求');
    assert.match(nodeRequirement, /22\.x[^\r\n]*>=\s*22\.22\.2/);
    assert.match(nodeRequirement, /24\.x[^\r\n]*>=\s*24\.15\.0/);
    assert.match(nodeRequirement, /26\+/);
    assert.doesNotMatch(nodeRequirement, />=\s*22\.12\b/);
    assert.doesNotMatch(nodeRequirement, /\b20(?:\.\d+)?/);
  });
}

test('安装脚本策略只允许必需脚本', () => {
  const electronPackage = require(path.join(projectRoot, 'electron', 'package.json'));
  const frontendPackage = require(path.join(projectRoot, 'frontend', 'package.json'));

  assert.deepEqual(electronPackage.allowScripts, { 'electron@44.5.1': true });
  assert.deepEqual(frontendPackage.allowScripts, { 'core-js': false, 'es5-ext': false });
});

test('前端和 Electron 全量依赖审计遇到任意等级告警时失败', () => {
  for (const packageDirectory of ['frontend', 'electron']) {
    const packageConfig = require(path.join(projectRoot, packageDirectory, 'package.json'));
    assert.equal(packageConfig.scripts['audit:security'], 'npm audit --audit-level=low');
  }
});

test('前端使用 Vite 并保持既有构建与代理接口', async () => {
  const frontendPackage = require(path.join(projectRoot, 'frontend', 'package.json'));
  const configUrl = pathToFileURL(path.join(projectRoot, 'frontend', 'vite.config.mjs'));
  const config = (await import(`${configUrl.href}?test=${Date.now()}`)).default;

  assert.equal(frontendPackage.dependencies?.['react-scripts'], undefined);
  assert.match(frontendPackage.devDependencies?.vite, /^\^8\./);
  assert.match(frontendPackage.devDependencies?.vitest, /^\^5\./);
  assert.equal(frontendPackage.scripts.start, 'vite');
  assert.equal(frontendPackage.scripts.dev, 'vite');
  assert.equal(frontendPackage.scripts.build, 'vite build');
  assert.equal(frontendPackage.scripts.test, 'vitest run');
  assert.equal(config.server.port, 3000);
  assert.equal(config.server.strictPort, true);
  assert.equal(config.server.proxy['^/(health|genes|expression|autocomplete|drug_group_summary|drug_response|drug_details|cell_line_map)'].target, 'http://127.0.0.1:5000');
  assert.equal(config.build.outDir, 'build');
  assert.equal(config.test.environment, 'jsdom');
});

test('前端锁定 source-map-js 1.2.2 修复 GHSA-68fv-2mgg-jv7q', () => {
  const lock = require(path.join(projectRoot, 'frontend', 'package-lock.json'));
  assert.equal(lock.packages['node_modules/source-map-js'].version, '1.2.2');
});

test('Electron 下载器使用无 sprintf-js 的兼容代理依赖', () => {
  const pkg = require(path.join(projectRoot, 'electron', 'package.json'));
  const lock = require(path.join(projectRoot, 'electron', 'package-lock.json'));
  assert.deepEqual(pkg.overrides, { '@electron/get': { 'global-agent': '4.1.3' } });
  assert.ok(!Object.keys(lock.packages).some((name) => name.endsWith('/sprintf-js')));
});

test('Electron builder 下载器可实际初始化代理', () => {
  const { createRequire } = require('node:module');
  const { spawnSync } = require('node:child_process');
  const builderRequire = createRequire(require.resolve('app-builder-lib/package.json'));
  const getPath = builderRequire.resolve('@electron/get');
  const getRequire = createRequire(getPath);
  assert.equal(getRequire('global-agent/package.json').version, '4.1.3');
  const child = spawnSync(process.execPath, ['-e',
    'require(' + JSON.stringify(getPath) + ').initializeProxy(); if (!global.GLOBAL_AGENT) throw new Error("Proxy did not initialize");'
  ], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stdout + child.stderr);
});
