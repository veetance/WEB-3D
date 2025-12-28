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
        radixCounts: new Int32Array(65536)
    };

    function reset() { }

    return {
        getBuffers: () => buffers,
        reset
    };
})();
