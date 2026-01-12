/** 
 * VEETANCE WASM Rasterizer Wrapper
 * Bridges the gap between JS types and C++ WASM machine.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.RasterizerWASM = (function () {
    let wasmModule = null;
    let isInitialized = false;

    // Buffer pointers in WASM heap
    let ptrs = {
        fb: 0,
        db: 0,
        screen: 0,
        indices: 0,
        intensities: 0,
        sortedIndices: 0
    };

    const MAX_VERTICES = window.ENGINE.Config.MAX_VERTICES;
    const MAX_FACES = window.ENGINE.Config.MAX_FACES;
    const FB_SIZE = 1024 * 1024;

    const init = async () => {
        if (isInitialized) return;

        // Wait for Emscripten Module
        return new Promise((resolve) => {
            const check = () => {
                if (window.Module && window.Module._renderBatch) {
                    wasmModule = window.Module;
                    allocateBuffers();
                    isInitialized = true;
                    console.log("VEETANCE WASM Rasterizer Manifested. 🦾");
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    };

    function allocateBuffers() {
        // Allocate persistent space in WASM heap
        ptrs.fb = wasmModule._malloc(FB_SIZE * 4);
        ptrs.db = wasmModule._malloc(FB_SIZE * 4);
        ptrs.screen = wasmModule._malloc(MAX_VERTICES * 4 * 4);
        ptrs.indices = wasmModule._malloc(MAX_FACES * 3 * 4);
        ptrs.intensities = wasmModule._malloc(MAX_FACES * 4);
        ptrs.sortedIndices = wasmModule._malloc(MAX_FACES * 4);
    }

    function clearHW(width, height) {
        if (!isInitialized) return;
        wasmModule._clearBuffers(ptrs.fb, ptrs.db, width, height);
    }

    function render(ctx, screen, indices, intensities, sortedIndices, fCount, config, width, height, frontToBack = false) {
        if (!isInitialized) return;

        // 1. Copy dynamic data to WASM heap
        // Optimization: In a future evolution, we will map JS views directly to WASM heap
        wasmModule.HEAPF32.set(screen.subarray(0, (MAX_VERTICES) * 4), ptrs.screen >> 2);
        wasmModule.HEAPU32.set(indices.subarray(0, fCount * 3), ptrs.indices >> 2);
        wasmModule.HEAPF32.set(intensities.subarray(0, fCount), ptrs.intensities >> 2);
        wasmModule.HEAPU32.set(sortedIndices.subarray(0, fCount), ptrs.sortedIndices >> 2);

        const baseColor = config.polyColor || '#1a1a1a';
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);

        // 2. Call WASM Batcher
        wasmModule._renderBatch(
            ptrs.fb, ptrs.db,
            ptrs.screen, ptrs.indices, ptrs.intensities, ptrs.sortedIndices,
            fCount, r, g, b,
            width, height, frontToBack
        );
    }

    let offscreenCanvas = null;
    let offscreenCtx = null;

    function flush(ctx, width, height) {
        if (!isInitialized) return;
        if (!offscreenCanvas || offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = width;
            offscreenCanvas.height = height;
            offscreenCtx = offscreenCanvas.getContext('2d');
        }

        // Create view into WASM memory for ImageData
        const fbView = new Uint8ClampedArray(wasmModule.HEAPU8.buffer, ptrs.fb, width * height * 4);
        const imgData = new ImageData(fbView, width, height);

        offscreenCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(offscreenCanvas, 0, 0);
    }

    return {
        init,
        render,
        clearHW,
        flush,
        isReady: () => isInitialized
    };
})();
