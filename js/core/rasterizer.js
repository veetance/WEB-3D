/** 
 * VEETANCE Rasterizer (Canvas 2D Utilities)
 * Wireframe rendering has been migrated to WASM.
 * This module only handles non-compute canvas tasks (Ruler, Gizmo).
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Rasterizer = (function () {

    /**
     * drawFaces - DEPRECATED (WASM-ONLY)
     * Wireframe rendering is now handled exclusively by WASM.renderWire()
     */
    function drawFaces() {
        // NO-OP: Wireframe requires WASM acceleration
    }

    function drawRuler(ctx, out) {
        // Clinical Gray (Dimmed relative to grid)
        ctx.strokeStyle = "rgba(85, 85, 85, 0.35)";
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.beginPath();

        for (let i = 0; i < out.length / 8; i++) {
            const i8 = i * 8;
            if (out[i8 + 3] > 0 && out[i8 + 7] > 0) {
                ctx.moveTo(out[i8], out[i8 + 1]);
                ctx.lineTo(out[i8 + 4], out[i8 + 5]);
            }
        }
        ctx.stroke();
    }

    function drawGizmo(ctx, out) { }

    return { drawFaces, drawRuler, drawGizmo };
})();
