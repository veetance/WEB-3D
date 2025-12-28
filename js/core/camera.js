/** 
 * VEETANCE Camera System
 * Handles View/Projection matrix calculations.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Camera = (function () {
    const MathOps = window.ENGINE.MathOps;
    const mat4 = MathOps.mat4;
    const RotCache = window.ENGINE.RotationCache;

    /**
     * Updates the View Matrix based on camera state.
     * @param {Float32Array} outView View Matrix to update
     * @param {Object} camera Camera state (orbitX, orbitY, zoom, target)
     * @param {Object} config Rendering config (zOffset)
     */
    function updateViewMatrix(outView, camera, config) {
        mat4.identity(outView);

        // Distance - Push world into Negative Z
        outView[14] = -(camera.zoom + (config.zOffset || 0));

        // Rotation (Orbit)
        RotCache.rotateX(outView, outView, camera.orbitX);
        RotCache.rotateZ(outView, outView, camera.orbitY);

        // Target - Center rotations around the focal point
        mat4.translate(outView, outView, {
            x: -camera.target.x,
            y: -camera.target.y,
            z: -camera.target.z
        });
    }

    return {
        updateViewMatrix
    };
})();
