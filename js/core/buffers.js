/** 
 * VEETANCE Buffer Pool
 * Manages pre-allocated typed arrays to ensure zero-garbage rendering.
 * Hybrid Path: Switches to WASM Heap views when manifested.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Pool = (function () {
    const Config = window.ENGINE.Config;

    // Standard JS-Side Buffers (Baseline)
    const buffers = {
        world: new Float32Array(Config.MAX_VERTICES * 4),
        screen: new Float32Array(Config.MAX_VERTICES * 4),
        depth: new Float32Array(Config.MAX_FACES),
        intensity: new Float32Array(Config.MAX_FACES),
        faceColors: new Uint32Array(Config.MAX_FACES),
        sortIndices: new Int32Array(Config.MAX_FACES),
        auxIndices: new Int32Array(Config.MAX_FACES),
        auxDepth: new Float32Array(Config.MAX_FACES),
        radixCounts: new Int32Array(65536),
        framebuffer: new Uint32Array(2560 * 1440), // Increased default size
        pixelDepth: new Float32Array(2560 * 1440),
        sampledWorld: new Float32Array(100000 * 3),
        sampledScreen: new Float32Array(100000 * 4)
    };

    let currentFBSize = 2560 * 1440;

    /**
     * Resize framebuffer and depth buffer if needed
     */
    function ensureBufferSize(width, height) {
        const requiredSize = width * height;
        if (requiredSize > currentFBSize) {
            console.log(`VEETANCE: Resizing buffers from ${currentFBSize} to ${requiredSize} pixels`);
            buffers.framebuffer = new Uint32Array(requiredSize);
            buffers.pixelDepth = new Float32Array(requiredSize);
            currentFBSize = requiredSize;
        }
    }

    /**
     * Manifest Zero-Copy: Switch internal buffers to point directly at WASM Heap.
     */
    function manifestWasmBuffers(wasmViews) {
        console.log("VEETANCE: Synchronizing Manifold Buffers to WASM Heap...");
        buffers.screen = wasmViews.screen;
        buffers.intensity = wasmViews.intensities;
        buffers.sortIndices = wasmViews.sortedIndices;
        buffers.depth = wasmViews.depths;
        buffers.auxIndices = wasmViews.auxIndices;
    }

    return {
        getBuffers: () => buffers,
        ensureBufferSize,
        manifestWasmBuffers,
        reset: () => { }
    };
})();
