# VEETANCE WASM Setup Script - Simplified Version
# Run this from PowerShell: .\setup-wasm-simple.ps1

Write-Host "========================================"
Write-Host "VEETANCE WASM SETUP"
Write-Host "========================================"
Write-Host ""

# Check if emsdk exists
$emsdkPath = "C:\emsdk"
if (Test-Path $emsdkPath) {
    Write-Host "[OK] Emscripten SDK found at $emsdkPath"
}
else {
    Write-Host "[INFO] Cloning Emscripten SDK..."
    git clone https://github.com/emscripten-core/emsdk.git $emsdkPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to clone. Make sure Git is installed."
        exit 1
    }
    Write-Host "[OK] SDK cloned successfully"
}

Write-Host ""

# Navigate to emsdk
Set-Location $emsdkPath

# Install
Write-Host "[INFO] Installing Emscripten (this takes 5-10 minutes)..."
& .\emsdk.bat install latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Installation failed"
    exit 1
}
Write-Host "[OK] Installed"
Write-Host ""

# Activate
Write-Host "[INFO] Activating..."
& .\emsdk.bat activate latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Activation failed"
    exit 1
}
Write-Host "[OK] Activated"
Write-Host ""

# Set environment
Write-Host "[INFO] Setting environment variables..."
& .\emsdk_env.ps1
Write-Host "[OK] Environment set"
Write-Host ""

# Verify
Write-Host "[INFO] Verifying installation..."
$version = & emcc --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Emscripten is working!"
    Write-Host ""
    Write-Host "Version:"
    Write-Host $version
}
else {
    Write-Host "[WARNING] Verification failed - you may need to restart terminal"
}

Write-Host ""
Write-Host "========================================"
Write-Host "SETUP COMPLETE"
Write-Host "========================================"
Write-Host ""
Write-Host "Next: Close terminal, reopen, then run build-wasm.ps1"
Write-Host ""

# Return to project
Set-Location "C:\D-DRIVE\WEB-3D\WASM"

pause
