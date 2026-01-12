# VEETANCE WASM Build - Working Version
Write-Host "Building WASM Rasterizer..." -ForegroundColor Cyan

# Activate Emscripten
& C:\emsdk\emsdk_env.ps1

# Build command that works
emcc ..\js\core\wasm\rasterizer.cpp `
    -o ..\js\core\wasm\rasterizer.js `
    -O3 `
    -s WASM=1 `
    -s EXPORTED_FUNCTIONS="['_drawTriangle','_clearBuffers','_renderBatch']"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] WASM build complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Output files:" -ForegroundColor Cyan
    Get-ChildItem ..\js\core\wasm\*.wasm | ForEach-Object {
        $sizeKB = [math]::Round($_.Length / 1KB, 2)
        Write-Host "  - $($_.Name) ($sizeKB KB)" -ForegroundColor Gray
    }
}
else {
    Write-Host "[ERROR] Build failed" -ForegroundColor Red
}

Write-Host ""
pause
