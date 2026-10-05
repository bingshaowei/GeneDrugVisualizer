[![English](https://img.shields.io/badge/English-README-blue)](README.en.md)
[![中文](https://img.shields.io/badge/中文-README-blue)](README.md)

# Gene Drug Visualizer

An interactive desktop application for exploring gene expression and drug sensitivity relationships, powered by data from the **GDSC (Genomics of Drug Sensitivity in Cancer)** project.

## Features

- **Gene Search** — Search gene names with autocomplete suggestions
- **Correlation Scatter Plot** — Visualize expression vs drug sensitivity for any gene and metric
- **Violin Plot** — Expression distribution grouped by tissue, histology, or TCGA classification
- **Drug Response Analysis** — Explore IC50, AUC, RMSE, and Z_SCORE metrics
- **Interactive Interface** — Built with React and Plotly for rich, responsive charts

## Screenshots

![Gene search for TP53 with scatter plot](screenshot1.png)

![Drug details table and group analysis](screenshot2.png)

## Download

Pre-built Windows installers are available on the [Releases page](https://github.com/bingshaowei/GeneDrugVisualizer/releases).

**Requirements:**
- Windows 10 / 11 (64-bit)
- No additional software required — Python 3.11 and all dependencies are bundled

## Documentation

- [User Manual (English)](docs/User Manual.docx)
- [Software Copyright Certificate (Chinese)](docs/软件证书.pdf)

## Development

### Prerequisites

- Node.js 22.x (>=22.22.2), 24.x (>=24.15.0), or 26+, plus npm 11+
- Python 3.11

### Quick Start

```bash
# Clone the repository
git clone https://github.com/bingshaowei/GeneDrugVisualizer.git
cd GeneDrugVisualizer

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start the Flask backend
cd backend
python -m pip install -r requirements.txt
python app.py &
cd ..

# Start the frontend dev server
cd frontend && npm start
```

The frontend development server uses Vite at `http://127.0.0.1:3000` and proxies API requests to the local Flask service at `http://127.0.0.1:5000`.

### Build Installer

```powershell
# One-click build (recommended)
scripts\build.bat

# Use an isolated output directory for release validation
scripts\build.bat electron\dist-verify-v1.1.1

# Or step by step:
# 1. From the project root, choose a separate output directory that does not exist yet
$releaseOutput = Join-Path (Get-Location) "electron\dist-verify-v1.1.1-manual"
if (Test-Path -LiteralPath $releaseOutput) { throw "Choose a release output directory that does not exist yet." }

# 2. Install locked frontend dependencies, audit, test, and build
cd frontend
npm ci
if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed." }
npm run audit:security
if ($LASTEXITCODE -ne 0) { throw "Frontend dependency audit failed." }
npm test
if ($LASTEXITCODE -ne 0) { throw "Frontend tests failed." }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
cd ..

# 3. Prepare embedded Python and pinned dependencies
scripts\download-python.bat
if ($LASTEXITCODE -ne 0) { throw "Embedded Python preparation failed." }

# 4. Install locked Electron dependencies, audit, test, and build the installer
cd electron
npm ci
if ($LASTEXITCODE -ne 0) { throw "Electron dependency installation failed." }
npm run audit:security
if ($LASTEXITCODE -ne 0) { throw "Electron dependency audit failed." }
npm test
if ($LASTEXITCODE -ne 0) { throw "Electron tests failed." }
npx electron-builder --win --config.directories.output="$releaseOutput"
if ($LASTEXITCODE -ne 0) { throw "Installer build failed." }
cd ..

# 5. Validate the release artifacts in the separate output directory
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\verify-release.ps1 -DistPath "$releaseOutput"
if ($LASTEXITCODE -ne 0) { throw "Release artifact validation failed." }
```

The one-command build installs locked dependencies, runs the frontend and Electron tests, builds the installer, and validates the packaged artifacts. The output directory must be empty; the script never deletes or overwrites existing artifacts. Installers are written to `electron/dist` by default, and validation evidence is saved as `release-validation.json` in the same directory.

Release builds audit all dependencies after installing frontend and Electron dependencies; a vulnerability warning at any severity fails the build.

The application master icon is stored at `electron/build/icon.png`. Electron Builder converts it to the Windows icon formats during packaging. The current installer is not code-signed.

### Data Source

Expression and drug sensitivity data are from the **GDSC (Genomics of Drug Sensitivity in Cancer)** v2 project:

- [GDSC Website](https://www.cancerrxgene.org/)
- Dose-response curves: GDSC2 fitted dose-response (27Oct23 release)
- Gene expression: RNA-seq data

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 8, Plotly.js, Tailwind CSS |
| Backend | Python 3, Flask |
| Desktop Shell | Electron 44, electron-builder |
| Charts | Plotly, ECharts |
| Data Processing | Pandas (CSV) |

## License

MIT License — see [LICENSE](LICENSE)
