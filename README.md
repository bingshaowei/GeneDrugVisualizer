# Gene Drug Visualizer

An interactive desktop application for exploring gene expression and drug sensitivity relationships using data from the **Genomics of Drug Sensitivity in Cancer (GDSC)** project.

![GeneDrugVisualizer](screenshot.png)

## Features

- **Gene Search** — Search gene names with autocomplete
- **Correlation Scatter Plot** — Visualize expression vs drug sensitivity for any gene and metric
- **Violin Plot** — Expression distribution grouped by tissue, histology, or TCGA classification
- **Drug Response Analysis** — Explore IC50, AUC, RMSE, and Z_SCORE metrics
- **Interactive Interface** — Built with React and Plotly for rich, responsive charts

## Screenshots

*(Add screenshot here)*

## Download

Pre-built Windows installers are available on the [Releases page](https://github.com/bingshaowei/GeneDrugVisualizer/releases).

**Requirements:**
- Windows 10 / 11 (64-bit)
- No additional software needed — Python 3.11 and all dependencies are bundled

## Development

### Prerequisites

- Node.js 18+ and npm
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

### Build Installer

```powershell
# 1. Build frontend
cd frontend
npm install && npm run build
cd ..

# 2. Prepare electron directory
xcopy /E /I /Y frontend\build electron\backend\build
xcopy /Y backend\app.py electron\backend\
xcopy /Y backend\requirements.txt electron\backend\
xcopy /E /I /Y backend\data electron\backend\data

# 3. Download Python embedded (or copy existing installation)
scripts\download-python.bat

# 4. Build Electron installer
cd electron
npm install
npx electron-builder --win
```

Or use the one-click build script:

```powershell
scripts\build.bat
```

## Data Source

Expression and drug sensitivity data are from the **Genomics of Drug Sensitivity in Cancer (GDSC)** project (v2):

- [GDSC - Cancer Drug Sensitivity Genomics](https://www.cancerrxgene.org/)
- GDSC2 fitted dose-response curves (27Oct23 release)
- RNA-seq gene expression data

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Plotly.js, Tailwind CSS |
| Backend | Python 3, Flask |
| Desktop | Electron 27, electron-builder |
| Charts | Plotly, ECharts |
| Data | Pandas (CSV processing) |

## License

MIT License — see [LICENSE](LICENSE) for details.
