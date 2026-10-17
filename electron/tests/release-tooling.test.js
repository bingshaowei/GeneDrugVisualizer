const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..', '..');
const verifierPath = path.join(projectRoot, 'scripts', 'verify-release.ps1');
const buildScriptPath = path.join(projectRoot, 'scripts', 'build.bat');

test('产物验证脚本使用直接声明的 @electron/asar 读取 ASAR', () => {
  const source = require('node:fs').readFileSync(verifierPath, 'utf8');

  assert.match(source, /require\('@electron\/asar'\)/);
  assert.doesNotMatch(source, /require\('asar'\)/);
});

test('产物验证脚本读取安装程序实际签名并拒绝非 NotSigned 状态', () => {
  const source = require('node:fs').readFileSync(verifierPath, 'utf8');

  assert.match(source, /\$installerSignature\s*=\s*Get-AuthenticodeSignature\s+-LiteralPath\s+\$installer\.FullName/);
  assert.match(source, /if\s*\(\$installerSignature\.Status\s+-ne\s+"NotSigned"\)\s*\{\s*throw\s+"Installer signature status mismatch/);
});

test('产物验证证据记录实际签名状态并据此推导 signed', () => {
  const source = require('node:fs').readFileSync(verifierPath, 'utf8');

  assert.match(source, /signed\s*=\s*\(\$installerSignature\.Status\s+-ne\s+"NotSigned"\)/);
  assert.match(source, /installerSignatureStatus\s*=\s*\[string\]\$installerSignature\.Status/);
  assert.doesNotMatch(source, /signed\s*=[^\r\n]+\$electronPackage\.build\.win/);
});

test('产物验证脚本输出实际签名状态', () => {
  const source = require('node:fs').readFileSync(verifierPath, 'utf8');

  assert.match(source, /Write-Output\s+"Signing status: \$\(\$installerSignature\.Status\)"/);
  assert.doesNotMatch(source, /Write-Output\s+"Signing status: unsigned/);
});

test('产物验证脚本对不存在的发布目录给出明确错误', () => {
  const missingPath = path.join(projectRoot, 'electron', 'dist-does-not-exist');
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', verifierPath, '-DistPath', missingPath],
    { encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Release directory does not exist/);
});

test('构建脚本拒绝非空输出目录并按固定顺序审计、测试、构建和验证', () => {
  const source = require('node:fs').readFileSync(buildScriptPath, 'utf8');
  const requiredSteps = [
    'if not "%~1"=="" set "OUTPUT_DIR=%~1"',
    'Output directory is not empty',
    'call "%~dp0download-python.bat"',
    'validate-data.py',
    '-m unittest discover',
    'call npm ci',
    'call npm run audit:security',
    'call npm test',
    'call npm run build',
    'call npm ci',
    'call npm run audit:security',
    'call npm test',
    'call npx electron-builder --win --x64 --publish never --config.directories.output="%OUTPUT_DIR%"',
    'verify-release.ps1" -DistPath "%OUTPUT_DIR%"',
  ];

  let previousIndex = -1;
  for (const step of requiredSteps) {
    const currentIndex = source.indexOf(step, previousIndex + 1);
    assert.ok(currentIndex > previousIndex, `构建脚本缺少步骤或顺序错误：${step}`);
    previousIndex = currentIndex;
  }
});

test('前端和 Electron 审计门禁均在失败时立即退出构建', () => {
  const source = require('node:fs').readFileSync(buildScriptPath, 'utf8');
  const auditCommands = source.match(/call npm run audit:security/g) || [];
  const auditFailureGates = source.match(/call npm run audit:security\r?\nif %errorlevel% neq 0 exit \/b %errorlevel%/g) || [];

  assert.equal(auditCommands.length, 2);
  assert.equal(auditFailureGates.length, 2);
});

test('构建脚本的非空检查不会忽略分号开头的产物名', () => {
  const source = require('node:fs').readFileSync(buildScriptPath, 'utf8');
  const options = source.match(/for \/f "([^"]*)" %%F in \('dir \/b \/a "%OUTPUT_DIR%"/);

  assert.ok(options, '缺少输出目录非空检查');
  assert.match(options[1], /(?:^|\s)eol=\|(?:\s|$)/);
  const result = spawnSync(
    'cmd.exe',
    ['/d', '/c', `for /f "${options[1]}" %F in (";artifact.exe") do @echo(%F`],
    { encoding: 'utf8', windowsVerbatimArguments: true },
  );

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), ';artifact.exe');
});

for (const readmeName of ['README.md', 'README.en.md']) {
  test(`${readmeName} 手动发布命令失败后立即停止`, () => {
    const source = require('node:fs').readFileSync(path.join(projectRoot, readmeName), 'utf8');
    const manualSteps = source.split(/# (?:或手动分步执行：|Or step by step:)/)[1]?.split('```')[0];
    assert.ok(manualSteps, '缺少手动发布步骤');
    const lines = manualSteps.split(/\r?\n/);
    const commandPattern = /^(?:npm (?:ci|run audit:security|test|run build)$|scripts\\download-python\.bat$|& \$pythonExe\b|npx electron-builder\b|powershell\.exe .+verify-release\.ps1\b)/;
    const commandIndexes = lines.flatMap((line, index) => commandPattern.test(line) ? [index] : []);

    assert.equal(commandIndexes.length, 12, '手动发布应包含十二条关键外部命令');
    for (const index of commandIndexes) {
      assert.match(lines[index + 1], /^if \(\$LASTEXITCODE -ne 0\) \{ (?:throw .+|exit \$LASTEXITCODE) \}$/, `命令失败后没有立即停止：${lines[index]}`);
    }
  });

  test(`${readmeName} 手动发布步骤包含两端审计测试和独立产物验证`, () => {
    const source = require('node:fs').readFileSync(path.join(projectRoot, readmeName), 'utf8');
    const manualSteps = source.split(/# (?:或手动分步执行：|Or step by step:)/)[1]?.split('```')[0];
    assert.ok(manualSteps, '缺少手动发布步骤');
    const requiredSteps = [
      '$releaseOutput = Join-Path (Get-Location) "electron\\dist-verify-v1.1.1-manual"',
      'scripts\\download-python.bat',
      'validate-data.py',
      '-m unittest discover',
      'cd frontend',
      'npm ci',
      'npm run audit:security',
      'npm test',
      'npm run build',
      'cd electron',
      'npm ci',
      'npm run audit:security',
      'npm test',
      'npx electron-builder --win --x64 --publish never --config.directories.output="$releaseOutput"',
      'cd ..',
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\verify-release.ps1 -DistPath "$releaseOutput"',
    ];

    let previousIndex = -1;
    for (const step of requiredSteps) {
      const currentIndex = manualSteps.indexOf(step, previousIndex + 1);
      assert.ok(currentIndex > previousIndex, `手动发布步骤缺少命令或顺序错误：${step}`);
      previousIndex = currentIndex;
    }
    assert.doesNotMatch(manualSteps, /npm install/);
  });
}

test('产物验证脚本只在至少一个前端资源真实命中版本号时通过', () => {
  const source = require('node:fs').readFileSync(verifierPath, 'utf8');

  assert.match(source, /\$uiVersionMatches\s*=\s*@\(/);
  assert.match(source, /\$uiVersionFound\s*=\s*\$uiVersionMatches\.Count\s*-gt\s*0/);
  assert.doesNotMatch(source, /Select-String[^\r\n]+-Quiet/);
});

test('产物验证必须检查锁定依赖、真实数据与运行结果后才写成功证据', () => {
  const source = require('node:fs').readFileSync(verifierPath, 'utf8');
  let previous = -1;
  for (const step of ['check-python.py', 'validate-data.py', 'verify-runtime.py', 'pythonDependencies =', 'dataValidation =', 'runtimeValidation =', 'Set-Content -LiteralPath $evidencePath']) {
    const index = source.indexOf(step, previous + 1);
    assert.ok(index > previous, '缺少校验或成功证据过早写入：' + step);
    previous = index;
  }
  assert.match(source, /ConvertTo-Json -Depth 10/);
});

test('Windows CI 分离 PR 检查和完整构建且不上传发布', () => {
  const source = require('node:fs').readFileSync(path.join(projectRoot, '.github/workflows/windows-release.yml'), 'utf8');
  assert.match(source, /pull_request:/);
  assert.match(source, /branches: \[master\]/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /contents: read/);
  assert.equal((source.match(/runs-on: windows-2022/g) || []).length, 2);
  assert.equal((source.match(/node-version: 24\.18\.0/g) || []).length, 2);
  assert.match(source, /python-version: 3\.11\.9/);
  assert.match(source, /lfs: true/);
  assert.match(source, /--require-hashes --only-binary=:all:/);
  assert.match(source, /python -B -m unittest discover -s backend\/tests/);
  assert.match(source, /build\.bat \$output/);
  assert.doesNotMatch(source, /upload-artifact|gh release|contents: write|pull_request_target/);
});

test('签名校验在继承不兼容安全模块路径时仍使用当前解释器的内置模块', () => {
  const fs = require('node:fs');
  const fixture = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'gene-signature-'));
  const modules = path.join(fixture, 'modules');
  const security = path.join(modules, 'Microsoft.PowerShell.Security');
  fs.mkdirSync(security, { recursive: true });
  fs.writeFileSync(path.join(security, 'Microsoft.PowerShell.Security.psd1'), "@{ ModuleVersion='99.0'; PowerShellVersion='99.0'; RootModule='missing.dll'; FunctionsToExport=@(); CmdletsToExport=@('Get-AuthenticodeSignature') }");
  fs.writeFileSync(path.join(fixture, 'GeneDrugApp Setup 1.1.1.exe'), 'not a PE executable');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', verifierPath, '-DistPath', fixture], {
    encoding: 'utf8',
    env: { ...process.env, PSModulePath: modules + ';' + path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/Modules') },
  });
  assert.notEqual(result.status, 0);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /Installer signature status mismatch|Required release file is missing/);
  assert.doesNotMatch(output, /module could not be loaded|Modules_ModuleRequiresNewPowerShell/);
  assert.equal(fs.existsSync(path.join(fixture, 'release-validation.json')), false);
});

test('自动打包显式关闭 CI 隐式发布', () => {
  assert.match(require('node:fs').readFileSync(buildScriptPath, 'utf8'), /electron-builder --win --x64 --publish never/);
});
