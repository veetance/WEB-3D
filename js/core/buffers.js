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
        sortIndices: new Int32Array(Config.MAX_FACES),
        auxIndices: new Int32Array(Config.MAX_FACES),
        auxDepth: new Float32Array(Config.MAX_FACES),
        radixCounts: new Int32Array(65536),
        framebuffer: new Uint32Array(1024 * 1024),
        pixelDepth: new Float32Array(1024 * 1024),
        sampledWorld: new Float32Array(100000 * 3),
        sampledScreen: new Float32Array(100000 * 4)
    };

    /**
     * Manifest Zero-Copy: Switch internal buffers to point directly at WASM Heap.
     */
    function manifestWasmBuffers(wasmViews) {
        console.log("VEETANCE: Synchronizing Manifold Buffers to WASM Heap...");
        // Redirect key buffers to the WASM memory space
        buffers.screen = wasmViews.screen;
        buffers.intensity = wasmViews.intensities;
        buffers.sortIndices = wasmViews.sortedIndices;
        buffers.depth = wasmViews.depths;
        buffers.auxIndices = wasmViews.auxIndices;
        // Note: 'world' buffer remains JS-side for now to avoid collision with incoming RAW data,
        // or we can redirect that too if we want full WASM-side math.
    }

    return {
        getBuffers: () => buffers,
        manifestWasmBuffers,
        reset: () => { }
    };
})();
