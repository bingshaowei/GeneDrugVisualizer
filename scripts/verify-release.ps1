[CmdletBinding()]
param(
    [string]$DistPath = "electron/dist"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$electronRoot = Join-Path $projectRoot "electron"
$packagePath = Join-Path $electronRoot "package.json"

try {
    if ([System.IO.Path]::IsPathRooted($DistPath)) {
        $resolvedDistPath = [System.IO.Path]::GetFullPath($DistPath)
    } else {
        $resolvedDistPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $DistPath))
    }

    if (-not (Test-Path -LiteralPath $resolvedDistPath -PathType Container)) {
        throw "Release directory does not exist: $resolvedDistPath"
    }

    $electronPackage = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    $version = [string]$electronPackage.version
    $expectedInstallerName = "GeneDrugApp Setup $version.exe"
    $installers = @(Get-ChildItem -LiteralPath $resolvedDistPath -File -Filter "GeneDrugApp Setup *.exe")

    if ($installers.Count -ne 1) {
        $names = if ($installers.Count -eq 0) { "(none)" } else { ($installers.Name -join ", ") }
        throw "Release directory must contain exactly one installer; found $($installers.Count): $names"
    }

    $installer = $installers[0]
    if ($installer.Name -ne $expectedInstallerName) {
        throw "Installer name mismatch: expected $expectedInstallerName, got $($installer.Name)"
    }

    $installerSignature = Get-AuthenticodeSignature -LiteralPath $installer.FullName
    if ($installerSignature.Status -ne "NotSigned") {
        throw "Installer signature status mismatch: expected NotSigned, got $($installerSignature.Status)"
    }

    $unpackedRoot = Join-Path $resolvedDistPath "win-unpacked"
    $appExePath = Join-Path $unpackedRoot "GeneDrugApp.exe"
    $asarPath = Join-Path $unpackedRoot "resources/app.asar"
    $frontendIndexPath = Join-Path $unpackedRoot "resources/backend/build/index.html"
    $requiredFiles = @(
        $appExePath,
        $asarPath,
        (Join-Path $unpackedRoot "resources/python-embedded/python.exe"),
        (Join-Path $unpackedRoot "resources/backend/app.py"),
        (Join-Path $unpackedRoot "resources/backend/api.py"),
        (Join-Path $unpackedRoot "resources/backend/data_service.py"),
        $frontendIndexPath,
        (Join-Path $unpackedRoot "resources/backend/data/drug.csv"),
        (Join-Path $unpackedRoot "resources/backend/data/expression.csv")
    )

    foreach ($requiredFile in $requiredFiles) {
        if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
            throw "Required release file is missing: $requiredFile"
        }
        if ((Get-Item -LiteralPath $requiredFile).Length -le 0) {
            throw "Required release file is empty: $requiredFile"
        }
    }

    $versionPattern = "^$([regex]::Escape($version))(?:\.0)?$"
    $installerVersion = [string]$installer.VersionInfo.ProductVersion
    $appVersion = [string](Get-Item -LiteralPath $appExePath).VersionInfo.ProductVersion
    if ($installerVersion -notmatch $versionPattern) {
        throw "Installer version mismatch: expected $version, got $installerVersion"
    }
    if ($appVersion -notmatch $versionPattern) {
        throw "Application version mismatch: expected $version, got $appVersion"
    }

    $asarCommand = "const asar=require('@electron/asar'); const p=JSON.parse(asar.extractFile(process.argv[1], 'package.json')); process.stdout.write(String(p.version));"
    Push-Location $electronRoot
    try {
        $asarVersion = (& node -e $asarCommand $asarPath).Trim()
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to read package.json from app.asar"
        }
    } finally {
        Pop-Location
    }
    if ($asarVersion -ne $version) {
        throw "ASAR version mismatch: expected $version, got $asarVersion"
    }

    $assetRoot = Join-Path $unpackedRoot "resources/backend/build/assets"
    $uiVersionMatches = @(
        Get-ChildItem -LiteralPath $assetRoot -File -Filter "*.js" |
            Select-String -SimpleMatch "version $version"
    )
    $uiVersionFound = $uiVersionMatches.Count -gt 0
    if (-not $uiVersionFound) {
        throw "Built UI does not contain version $version"
    }

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $installerStream = [System.IO.File]::OpenRead($installer.FullName)
        try {
            $installerHash = [System.BitConverter]::ToString($sha256.ComputeHash($installerStream)).Replace("-", "")
        } finally {
            $installerStream.Dispose()
        }
    } finally {
        $sha256.Dispose()
    }
    $evidence = [ordered]@{
        validatedAtUtc = [DateTimeOffset]::UtcNow.ToString("o")
        version = $version
        appId = [string]$electronPackage.build.appId
        productName = [string]$electronPackage.build.productName
        signed = ($installerSignature.Status -ne "NotSigned")
        installerSignatureStatus = [string]$installerSignature.Status
        installer = [ordered]@{
            fileName = $installer.Name
            bytes = $installer.Length
            productVersion = $installerVersion
            sha256 = $installerHash
        }
        unpackedAppVersion = $appVersion
        asarVersion = $asarVersion
        uiVersion = $version
        requiredFilesChecked = $requiredFiles.Count
    }
    $evidencePath = Join-Path $resolvedDistPath "release-validation.json"
    $evidence | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $evidencePath -Encoding UTF8

    Write-Output "Release validation passed: $expectedInstallerName"
    Write-Output "SHA-256: $installerHash"
    Write-Output "Signing status: $($installerSignature.Status)"
    Write-Output "Validation record: $evidencePath"
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
