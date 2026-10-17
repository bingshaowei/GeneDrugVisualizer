const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const projectRoot = path.resolve(__dirname, '..', '..');
const scratch = path.join(projectRoot, 'electron', 'dist-release-tests');
fs.mkdirSync(scratch, { recursive: true });

for (const fromRoot of [true, false]) {
  test('相对输出目录以项目根目录为基准；调用位置=' + (fromRoot ? '根目录' : '其他目录'), () => {
    const root = fs.mkdtempSync(path.join(scratch, 'build path '));
    fs.mkdirSync(path.join(root, 'scripts'));
    const script = path.join(root, 'scripts', 'build.bat');
    fs.copyFileSync(path.join(projectRoot, 'scripts', 'build.bat'), script);
    const output = path.join(root, 'electron', 'release output');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, ';existing.exe'), 'keep');
    const result = spawnSync('cmd.exe', ['/d', '/s', '/c', '""' + script + '" "electron\\release output""'], {
      cwd: fromRoot ? root : projectRoot, encoding: 'utf8', windowsVerbatimArguments: true,
    });
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(result.stdout.includes(output), result.stdout);
    assert.equal(fs.readFileSync(path.join(output, ';existing.exe'), 'utf8'), 'keep');
    assert.doesNotMatch(result.stdout, /Preparing embedded Python|npm ci/);
  });
}

test('绝对输出路径和已有文件均不被覆盖', () => {
  const root = fs.mkdtempSync(path.join(scratch, 'absolute path '));
  const output = path.join(root, 'already here');
  fs.writeFileSync(output, 'keep');
  const script = path.join(projectRoot, 'scripts', 'build.bat');
  const result = spawnSync('cmd.exe', ['/d', '/s', '/c', '""' + script + '" "' + output + '""'], {
    cwd: root, encoding: 'utf8', windowsVerbatimArguments: true,
  });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stdout, /Output path is not a directory/);
  assert.equal(fs.readFileSync(output, 'utf8'), 'keep');
});

test('Python 准备失败会保留原退出码且不执行后续构建', () => {
  const root = fs.mkdtempSync(path.join(scratch, 'failed setup '));
  fs.mkdirSync(path.join(root, 'scripts'));
  const script = path.join(root, 'scripts', 'build.bat');
  fs.copyFileSync(path.join(projectRoot, 'scripts', 'build.bat'), script);
  fs.writeFileSync(path.join(root, 'scripts', 'download-python.bat'), '@echo off\r\nexit /b 37\r\n');
  const result = spawnSync('cmd.exe', ['/d', '/s', '/c', '""' + script + '""'], {
    cwd: projectRoot, encoding: 'utf8', windowsVerbatimArguments: true,
  });
  assert.equal(result.status, 37, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /Validating source data|Testing and building frontend/);
});
