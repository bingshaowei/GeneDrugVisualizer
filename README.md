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
- Python 3.11

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/bingshaowei/GeneDrugVisualizer.git
cd GeneDrugVisualizer

# 安装前端依赖
cd frontend && npm install && cd ..

# 启动 Flask 后端
cd backend
python -m pip install -r requirements.txt
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

# 使用独立输出目录进行发布验证
scripts\build.bat electron\dist-verify-v1.1.1

# 或手动分步执行：
# 1. 从项目根目录选择尚不存在的独立发布输出目录
$releaseOutput = Join-Path (Get-Location) "electron\dist-verify-v1.1.1-manual"
if (Test-Path -LiteralPath $releaseOutput) { throw "请选择尚不存在的发布输出目录。" }

# 2. 安装锁定前端依赖，审计、测试并构建
cd frontend
npm ci
if ($LASTEXITCODE -ne 0) { throw "前端依赖安装失败。" }
npm run audit:security
if ($LASTEXITCODE -ne 0) { throw "前端依赖审计失败。" }
npm test
if ($LASTEXITCODE -ne 0) { throw "前端测试失败。" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "前端构建失败。" }
cd ..

# 3. 准备 Python 嵌入版及固定依赖
scripts\download-python.bat
if ($LASTEXITCODE -ne 0) { throw "Python 嵌入版准备失败。" }

# 4. 安装锁定 Electron 依赖，审计、测试并打包
cd electron
npm ci
if ($LASTEXITCODE -ne 0) { throw "Electron 依赖安装失败。" }
npm run audit:security
if ($LASTEXITCODE -ne 0) { throw "Electron 依赖审计失败。" }
npm test
if ($LASTEXITCODE -ne 0) { throw "Electron 测试失败。" }
npx electron-builder --win --config.directories.output="$releaseOutput"
if ($LASTEXITCODE -ne 0) { throw "安装程序构建失败。" }
cd ..

# 5. 验证独立目录中的发布产物
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\verify-release.ps1 -DistPath "$releaseOutput"
if ($LASTEXITCODE -ne 0) { throw "发布产物验证失败。" }
```

一键构建会依次安装锁定依赖、运行前端和 Electron 测试、构建安装包并执行产物验证。输出目录必须为空；脚本不会自动删除或覆盖已有产物。默认安装包输出到 `electron/dist`，验证结果写入同目录的 `release-validation.json`。

发布构建会在前端和 Electron 安装依赖后执行全量依赖安全审计，任意等级的漏洞告警都会导致构建失败。

应用主图标位于 `electron/build/icon.png`，Electron Builder 会在打包时生成 Windows 所需图标格式。当前安装包未配置代码签名。

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
