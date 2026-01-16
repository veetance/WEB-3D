# VEETANCE WASM Build - Working Version
Write-Host "Building WASM Rasterizer..." -ForegroundColor Cyan

# Activate Emscripten
& C:\emsdk\emsdk_env.ps1

# Build command that works
emcc ..\js\core\wasm\rasterizer.cpp `
    -o ..\js\core\wasm\rasterizer_v2.js `
    -O3 `
    -msimd128 `
    -s WASM=1 `
    -s INITIAL_MEMORY=268435456 `
    -s EXPORTED_FUNCTIONS="['_drawTriangle','_clearBuffers','_renderBatch','_radixSort','_malloc','_free','_transformBuffer','_projectBuffer','_processFaces']"

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

# No pause needed for automated runs
