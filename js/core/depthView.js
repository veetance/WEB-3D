/** 
 * VEETANCE Depth Buffer View – persistent Int32Array wrapper
 * Provides a cached view of a Float32Array depth buffer as Int32Array.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.DepthView = (function () {
    let lastBuffer = null;
    let intView = null;

    function getView(depthBuffer) {
        if (!depthBuffer) return null;
        if (depthBuffer !== lastBuffer) {
            intView = new Int32Array(depthBuffer.buffer, depthBuffer.byteOffset, depthBuffer.length);
            lastBuffer = depthBuffer;
        }
        return intView;
    }

    return { getView };
})();
