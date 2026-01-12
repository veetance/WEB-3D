# VEETANCE WASM Build Script - Simplified
# Compiles C++ rasterizer to WebAssembly

Write-Host "========================================"
Write-Host "VEETANCE WASM BUILD"
Write-Host "========================================"
Write-Host ""

# Create wasm directory
$wasmDir = "..\js\core\wasm"
if (-not (Test-Path $wasmDir)) {
    New-Item -ItemType Directory -Path $wasmDir | Out-Null
    Write-Host "[OK] Created directory: $wasmDir"
}

# Create placeholder C++ file if it doesn't exist
$sourceFile = "$wasmDir\rasterizer.cpp"
if (-not (Test-Path $sourceFile)) {
    Write-Host "[INFO] Creating placeholder C++ file..."
    
    $cppCode = @"
// VEETANCE WASM Rasterizer - Placeholder
#include <emscripten.h>
#include <stdint.h>

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void drawTriangle(
        uint32_t* framebuffer,
        float* depthBuffer,
        float x0, float y0, float z0,
        float x1, float y1, float z1,
        float x2, float y2, float z2,
        uint32_t color,
        int width, int height
    ) {
        // Placeholder - will be implemented in Phase 4B.1
    }
    
    EMSCRIPTEN_KEEPALIVE
    void clearBuffers(
        uint32_t* framebuffer,
        float* depthBuffer,
        int width, int height
    ) {
        for (int i = 0; i < width * height; i++) {
            framebuffer[i] = 0x00000000;
            depthBuffer[i] = -1000.0f;
        }
    }
}
"@
    
    $cppCode | Out-File -FilePath $sourceFile -Encoding UTF8
    Write-Host "[OK] Placeholder created"
}

Write-Host ""
Write-Host "[INFO] Building WASM modules..."
Write-Host ""

# Build production version
Write-Host "[1/3] Building production (optimized)..."
emcc $sourceFile -o "$wasmDir\rasterizer.wasm" `
    -O3 `
    -s WASM=1 `
    -s ALLOW_MEMORY_GROWTH=1 `
    -s EXPORTED_FUNCTIONS="['_drawTriangle','_clearBuffers']" `
    -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" `
    -s MODULARIZE=1 `
    -s EXPORT_NAME="createWASMRasterizer"

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item "$wasmDir\rasterizer.wasm").Length / 1KB
    Write-Host "[OK] rasterizer.wasm ($([math]::Round($size, 2)) KB)"
}
else {
    Write-Host "[ERROR] Build failed"
    exit 1
}

Write-Host ""

# Build SIMD version
Write-Host "[2/3] Building SIMD (optimized + SIMD)..."
emcc $sourceFile -o "$wasmDir\rasterizer-simd.wasm" `
    -O3 `
    -msimd128 `
    -s WASM=1 `
    -s ALLOW_MEMORY_GROWTH=1 `
    -s EXPORTED_FUNCTIONS="['_drawTriangle','_clearBuffers']" `
    -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" `
    -s MODULARIZE=1 `
    -s EXPORT_NAME="createWASMRasterizer"

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item "$wasmDir\rasterizer-simd.wasm").Length / 1KB
    Write-Host "[OK] rasterizer-simd.wasm ($([math]::Round($size, 2)) KB)"
}
else {
    Write-Host "[WARNING] SIMD build failed (may not be supported)"
}

Write-Host ""

# Build debug version
Write-Host "[3/3] Building debug..."
emcc $sourceFile -o "$wasmDir\rasterizer-dev.wasm" `
    -O0 `
    -g `
    -s WASM=1 `
    -s ALLOW_MEMORY_GROWTH=1 `
    -s ASSERTIONS=1 `
    -s EXPORTED_FUNCTIONS="['_drawTriangle','_clearBuffers']" `
    -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" `
    -s MODULARIZE=1 `
    -s EXPORT_NAME="createWASMRasterizer"

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item "$wasmDir\rasterizer-dev.wasm").Length / 1KB
    Write-Host "[OK] rasterizer-dev.wasm ($([math]::Round($size, 2)) KB)"
}
else {
    Write-Host "[WARNING] Debug build failed"
}

Write-Host ""
Write-Host "========================================"
Write-Host "BUILD COMPLETE"
Write-Host "========================================"
Write-Host ""
Write-Host "Output: js\core\wasm\"
Write-Host ""
Write-Host "Next: Implement actual rasterizer in rasterizer.cpp"
Write-Host ""

pause
