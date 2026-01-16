# VEETANCE WASM Build - Working Version
Write-Host "Building WASM Rasterizer..." -ForegroundColor Cyan

# Activate Emscripten
& C:\emsdk\emsdk_env.ps1

# Build command using script-relative paths
emcc "$PSScriptRoot\..\js\core\wasm\rasterizer.cpp" `
    -o "$PSScriptRoot\..\js\core\wasm\rasterizer_v2.js" `
    -O3 `
    -msimd128 `
    -matomics `
    -mbulk-memory `
    -pthread `
    -s WASM=1 `
    -s SHARED_MEMORY=1 `
    -s INITIAL_MEMORY=536870912 `
    -s EXPORTED_FUNCTIONS="['_drawTriangle','_clearBuffers','_renderBatch','_renderWireframe','_radixSort','_malloc','_free','_transformBuffer','_projectBuffer','_processFaces','_processFacesSIMD','_processClusters','_extractColors','_binFaces','_renderTile','_uploadClusters','_getPixelBuffer','_getRawVerticesBuffer','_getWorldBuffer','_getScreenBuffer','_getIndicesBuffer','_getIntensitiesBuffer','_getVertexIntensitiesBuffer','_getFaceColorsBuffer','_getDepthsBuffer','_getSortedIndicesBuffer','_getAuxIndicesBuffer','_getAuxDepthsBuffer','_getRadixCountsBuffer','_getMatrixBuffer','_getTilesBuffer','_getOutFBBuffer']" `
    -s EXPORTED_RUNTIME_METHODS="['HEAPU8']"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] WASM build complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Output files:" -ForegroundColor Cyan
    Get-ChildItem "$PSScriptRoot\..\js\core\wasm\*.wasm" | ForEach-Object {
        $sizeKB = [math]::Round($_.Length / 1KB, 2)
        Write-Host "  - $($_.Name) ($sizeKB KB)" -ForegroundColor Gray
    }
}
else {
    Write-Host "[ERROR] Build failed" -ForegroundColor Red
}

# No pause needed for automated runs
