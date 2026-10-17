[![English](https://img.shields.io/badge/English-README-blue)](README.en.md)
[![中文](https://img.shields.io/badge/中文-README-blue)](README.md)

# Gene Drug Visualizer

交互式桌面应用，用于探索基因表达与药物敏感性之间的关系，数据来自 **GDSC（Genomics of Drug Sensitivity in Cancer）** 项目。

## 功能

- **基因搜索** — 输入基因名称，自动补全匹配
- **相关性散点图** — 任意基因 + 任意指标，可视化表达量与药物敏感性的关系
- **小提琴图** — 按组织 / 组织学分类 / TCGA 分组展示表达量分布
- **药物响应分析** — 查看 IC50、AUC、RMSE、Z_SCORE 等指标
- **交互式界面** — 基于 React + Plotly，图表可缩放、悬停查看详情

## 界面预览

![搜索基因 TP53 与散点图](screenshot1.png)

![药物详情表格与分组分析](screenshot2.png)

## 下载

Windows 安装程序请前往 [Releases 页面](https://github.com/bingshaowei/GeneDrugVisualizer/releases) 下载。

**系统要求：**
- Windows 10 / 11（64 位）
- 无需额外安装软件 — Python 3.11 及所有依赖已内置

## 文档

- [用户手册](docs/用户手册.pdf)
- [软件著作权证书](docs/软件证书.pdf)

## 开发

### 前置要求

- Node.js 22.x（>=22.22.2）、24.x（>=24.15.0）或 26+，以及 npm 11+
- Python 3.11.9（开发用；发布脚本自动准备嵌入版）
- Git LFS（用于获取真实 CSV 数据）

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/bingshaowei/GeneDrugVisualizer.git
cd GeneDrugVisualizer
git lfs install --local
git lfs pull

# 安装前端依赖
cd frontend && npm install && cd ..

# 启动 Flask 后端
cd backend
python -m pip install --require-hashes --only-binary=:all: -r requirements-release.lock
python app.py &
cd ..

# 启动前端开发服务器
cd frontend && npm start
```

前端开发服务器使用 Vite，固定监听 `http://127.0.0.1:3000`，并将 API 请求代理到本地 Flask 服务 `http://127.0.0.1:5000`。

### 构建安装包

```powershell
# 一键构建（推荐）
scripts\build.bat

# 使用全新独立输出目录
scripts\build.bat electron\dist-verify-v1.1.1

# 或手动分步执行：
# 1. 从项目根目录选择尚不存在的输出目录
$releaseOutput = Join-Path (Get-Location) "electron\dist-verify-v1.1.1-manual"
if (Test-Path -LiteralPath $releaseOutput) { throw "请选择尚不存在的发布输出目录。" }

# 2. 准备锁定 Python 环境，验证真实数据并执行后端测试
scripts\download-python.bat
if ($LASTEXITCODE -ne 0) { throw "Python 准备失败。" }
$pythonExe = Join-Path (Get-Location) "electron\python-embedded\python.exe"
& $pythonExe -B scripts\validate-data.py --data-dir backend\data --manifest backend\data-manifest.json
if ($LASTEXITCODE -ne 0) { throw "数据校验失败。" }
& $pythonExe -B -m unittest discover -s backend\tests -v
if ($LASTEXITCODE -ne 0) { throw "后端或发布校验器测试失败。" }

# 3. 安装前端锁定依赖，审计、测试并构建
cd frontend
npm ci
if ($LASTEXITCODE -ne 0) { throw "前端依赖安装失败。" }
npm run audit:security
if ($LASTEXITCODE -ne 0) { throw "前端审计失败。" }
npm test
if ($LASTEXITCODE -ne 0) { throw "前端测试失败。" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "前端构建失败。" }
cd ..

# 4. 安装 Electron 锁定依赖，审计、测试并打包 Windows x64
cd electron
npm ci
if ($LASTEXITCODE -ne 0) { throw "Electron 依赖安装失败。" }
npm run audit:security
if ($LASTEXITCODE -ne 0) { throw "Electron 审计失败。" }
npm test
if ($LASTEXITCODE -ne 0) { throw "Electron 测试失败。" }
npx electron-builder --win --x64 --publish never --config.directories.output="$releaseOutput"
if ($LASTEXITCODE -ne 0) { throw "安装程序构建失败。" }
cd ..

# 5. 校验产物文件、依赖、数据及真实后端请求
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\verify-release.ps1 -DistPath "$releaseOutput"
if ($LASTEXITCODE -ne 0) { throw "发布验证失败。" }
```

一键构建依次准备 Python、校验数据并执行后端测试、安装和审计前端依赖、执行前端测试与构建、安装和审计 Electron 依赖、执行 Electron 测试、打包并验证产物。任一步失败即停止。

默认输出为 `electron/dist`；自定义相对输出路径始终相对于项目根目录，绝对路径原样使用。输出目录必须不存在或为空，不会自动清理已有产物。

发布环境固定为 Windows x64 / Python 3.11.9，完整依赖及 wheel SHA-256 记录在 `backend/requirements-release.lock`。Flask 2.2.5、Pandas 1.5.3、NumPy 1.26.4、Werkzeug 2.3.8 保持兼容基线。准备脚本在独立暂存目录安装，使用 `--require-hashes --only-binary=:all:`，完成精确版本比对、`pip check` 和导入检查后才复制到新的嵌入式目录。已有目录版本不符或缺包时明确失败，不会自动覆盖、降级或修复；请在另一个全新检出目录中构建。失败暂存文件会保留，清理前请自行确认路径。

两个 CSV 由 Git LFS 管理，克隆后执行 `git lfs pull`；源码 ZIP 或未安装 LFS 的检出可能只有指针。构建前及打包后会依据 `backend/data-manifest.json` 检查指针、大小、SHA-256、必要列与非空数据行。更新正式数据时必须同步清单中的 LFS oid、大小、编码及必要列。

两端 npm 全量依赖审计保持任意等级漏洞告警即失败。应用图标仍为 `electron/build/icon.png`，安装包保持未签名。

验证脚本保留文件、版本、签名和安装包哈希检查，并使用 `win-unpacked` 内的 Python、后端、前端资源与数据运行真实请求：30 秒内就绪、正确的 `/health` 标识、首页及引用的脚本/样式、TP53 表达查询和药物响应查询。端口 5000 占用时拒绝运行，不停止已有服务；结束时仅清理本次创建的后端进程。全部通过后写入 `release-validation.json`，包含 `pythonDependencies`、`dataValidation` 和 `runtimeValidation`。


当前锁文件将 source-map-js 更新至 1.2.2，并将 Electron 下载器的 global-agent 固定为 4.1.3，以移除 source-map-js 和 sprintf-js 的已知漏洞链；Electron 与 electron-builder 版本不变。代理初始化另有实际兼容性测试。

前端样式扫描显式限定为 `frontend/src` 和 `frontend/index.html`，避免把数据、依赖或构建产物作为样式候选。若将组件移到这些目录以外，须在样式入口中补充对应的 `@source`。

### Windows CI 与安装验收

`.github/workflows/windows-release.yml` 使用 Windows 2022、Node.js 24.18.0 和 npm 11+。PR 执行两端安装、审计、测试及前端构建，并在独立 Python 3.11.9 环境中运行后端、数据校验器与生命周期测试。推送到 `master` 或手动触发时启用 LFS，执行完整 Windows x64 构建和运行验证。工作流仅有仓库读取权限，不上传产物、不创建 Release，也不自动发布。

自动化验证覆盖解包目录中的后端和资源，不替代 NSIS 安装与 Electron 窗口验收。正式发布前仍须在没有额外 Python 的干净 Windows 环境安装，确认窗口打开、TP53 搜索、药物查询和退出成功，并确认退出后没有遗留后端进程。新增工作流文件不代表远程 CI 已经执行或通过。

### 数据说明

基因表达和药物敏感性数据来自 **GDSC（Genomics of Drug Sensitivity in Cancer）** v2 项目：

- [GDSC 官网](https://www.cancerrxgene.org/)
- 剂量响应曲线：GDSC2 fitted dose-response（2023年10月27日版）
- 基因表达：RNA-seq 数据

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18, Vite 8, Plotly.js, Tailwind CSS |
| 后端 | Python 3, Flask |
| 桌面壳 | Electron 44, electron-builder |
| 图表 | Plotly, ECharts |
| 数据处理 | Pandas (CSV) |

## 许可证

MIT License — 详见 [LICENSE](LICENSE)
