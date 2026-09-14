const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const projectRoot = path.resolve(__dirname, '..', '..');

test('1.1 发布元数据包含作者和自定义 Windows 图标', () => {
  const electronPackage = require(path.join(projectRoot, 'electron', 'package.json'));
  const iconPath = path.join(projectRoot, 'electron', 'build', 'icon.png');

  assert.equal(electronPackage.version, '1.1.0');
  assert.equal(electronPackage.author, 'Shaowei Bing');
  assert.equal(electronPackage.build.win.icon, 'build/icon.png');
  assert.equal(fs.existsSync(iconPath), true, '缺少 electron/build/icon.png');

  const png = fs.readFileSync(iconPath);
  assert.equal(png.readUInt32BE(16), 1024, '图标宽度必须为 1024');
  assert.equal(png.readUInt32BE(20), 1024, '图标高度必须为 1024');
  assert.ok([4, 6].includes(png[25]), 'PNG 必须包含透明通道');
});

test('安装脚本策略只允许必需脚本', () => {
  const electronPackage = require(path.join(projectRoot, 'electron', 'package.json'));
  const frontendPackage = require(path.join(projectRoot, 'frontend', 'package.json'));

  assert.deepEqual(electronPackage.allowScripts, { 'electron@27.3.11': true });
  assert.deepEqual(frontendPackage.allowScripts, { 'core-js': false, 'es5-ext': false });
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
