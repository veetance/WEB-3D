/** 
 * VEETANCE Buffer Pool
 * Manages pre-allocated typed arrays to ensure zero-garbage rendering.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Pool = (function () {
    const Config = window.ENGINE.Config;

    // Pre-allocate large buffers once on boot
    const buffers = {
        world: new Float32Array(Config.MAX_VERTICES * 4),    // x, y, z, w
        screen: new Float32Array(Config.MAX_VERTICES * 4),   // x, y, z, w
        depth: new Float32Array(Config.MAX_FACES),          // z-value per face
        intensity: new Float32Array(Config.MAX_FACES),      // light intensity per face
        sortIndices: new Int32Array(Config.MAX_FACES),      // indices for radix sort

        // Auxiliary buffers for radix sort
        auxIndices: new Int32Array(Config.MAX_FACES),
        auxDepth: new Float32Array(Config.MAX_FACES),
        radixCounts: new Int32Array(65536),

        // RAW Pixel-Buffer (Software Path) - 1024x1024 cap
        framebuffer: new Uint32Array(1024 * 1024),
        pixelDepth: new Float32Array(1024 * 1024),
        sampledWorld: new Float32Array(100000 * 3), // Local space points
        sampledScreen: new Float32Array(100000 * 4), // Screen space points

        // Scanline Edge Table (y-max, x, 1/m, z, 1/mz)
        // [minY...maxY] -> list of edges starting at Y
        edgeTable: new Float32Array(2048 * 4 * 10), // Max 10 edges per scanline for vertical height
        activeEdges: new Int32Array(1000) // Indices for active edge list
    };

    function reset() { }

    return {
        getBuffers: () => buffers,
        reset
    };
})();
