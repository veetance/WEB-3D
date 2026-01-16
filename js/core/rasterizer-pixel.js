/** 
 * VEETANCE Pixel-Buffer Rasterizer (HUB)
 * The Sovereign CPU path. Direct pixel manipulation via Barycentric coordinates.
 * Inspired by Sean Barrett & Tsoding.
 * 
 * NOTE: This file is now a HUB that re-exports logic from the 'rasterizer' submodule
 * to maintain consolidation and prevent fragmentation-of-import.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.RasterizerPixel = (function () {
    // Import the fragmented modules 
    const SceneRenderer = window.ENGINE.SceneRenderer;

    // Re-export the interface expected by engine.js
    return {
        render: SceneRenderer.render,
        renderPoints: SceneRenderer.renderPoints,
        renderEdges: SceneRenderer.renderEdges,
        clearHW: SceneRenderer.clearHW,
        flush: SceneRenderer.flush
    };
})();
