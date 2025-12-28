/** 
 * VEETANCE Rasterizer
 * Handles CPU-based Canvas 2D drawing of transformed geometry.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Rasterizer = (function () {
    function drawFaces(ctx, buffers, sortedIndices, indices, validFaces, config, structuralEdges) {
        const { screen, intensity: intensityBuffer } = buffers;
        const mode = config.viewMode;
        const isSolid = mode === 'SOLID' || mode === 'SHADED_WIRE';
        const isWire = mode === 'WIRE' || mode === 'SHADED_WIRE';

        const edgeSet = new Set();
        if (structuralEdges) {
            for (let e = 0; e < structuralEdges.length; e += 2) {
                const a = structuralEdges[e], b = structuralEdges[e + 1];
                edgeSet.add(a < b ? `${a}_${b}` : `${b}_${a}`);
            }
        }

        const baseColor = config.polyColor || '#333333';
        const r = parseInt(baseColor.slice(1, 3), 16), g = parseInt(baseColor.slice(3, 5), 16), bVal = parseInt(baseColor.slice(5, 7), 16);

        ctx.lineWidth = config.thickness;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (let k = validFaces - 1; k >= 0; k--) {
            const fIdx = sortedIndices[k], i3 = fIdx * 3;
            const idx0 = indices[i3], idx1 = indices[i3 + 1], idx2 = indices[i3 + 2], i04 = idx0 << 2, i14 = idx1 << 2, i24 = idx2 << 2;
            if (isSolid) {
                ctx.beginPath(); ctx.moveTo(screen[i04], screen[i04 + 1]); ctx.lineTo(screen[i14], screen[i14 + 1]); ctx.lineTo(screen[i24], screen[i24 + 1]); ctx.closePath();
                const intens = intensityBuffer[fIdx];
                const fill = `rgb(${r * intens | 0}, ${g * intens | 0}, ${bVal * intens | 0})`;
                ctx.fillStyle = fill; ctx.fill();
                if (mode === 'SOLID') { ctx.strokeStyle = fill; ctx.stroke(); }
            }
            if (isWire) {
                ctx.strokeStyle = config.fg || '#00ffd2';
                ctx.beginPath();
                if (config.showDiagonals || !structuralEdges || edgeSet.has(idx0 < idx1 ? `${idx0}_${idx1}` : `${idx1}_${idx0}`)) { ctx.moveTo(screen[i04], screen[i04 + 1]); ctx.lineTo(screen[i14], screen[i14 + 1]); }
                if (config.showDiagonals || !structuralEdges || edgeSet.has(idx1 < idx2 ? `${idx1}_${idx2}` : `${idx2}_${idx1}`)) { ctx.moveTo(screen[i14], screen[i14 + 1]); ctx.lineTo(screen[i24], screen[i24 + 1]); }
                if (config.showDiagonals || !structuralEdges || edgeSet.has(idx2 < idx0 ? `${idx2}_${idx0}` : `${idx0}_${idx2}`)) { ctx.moveTo(screen[i24], screen[i24 + 1]); ctx.lineTo(screen[i04], screen[i04 + 1]); }
                ctx.stroke();
            }
        }
    }

    function drawPoints(ctx, screen, vCount, config) {
        const baseColor = config.fg || '#00ffd2';
        const size = Math.max(0.5, config.thickness * 0.5); // Smaller, sharper stars

        ctx.fillStyle = baseColor;

        // High-density optimization: Batching points by opacity for 'star' feel
        for (let i = 0; i < vCount; i++) {
            const i4 = i << 2;
            if (screen[i4 + 3] > 0) {
                // Stochastic alpha for star-shimmer effect
                if (i % 3 === 0) ctx.globalAlpha = 0.4 + Math.random() * 0.6;
                else ctx.globalAlpha = 0.8;

                ctx.fillRect(screen[i4], screen[i4 + 1], size, size);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    function drawRuler(ctx, out) {
        // Clinical Gray (Dimmed relative to grid)
        ctx.strokeStyle = "rgba(85, 85, 85, 0.35)";
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.beginPath();

        // drawRuler now processes the unified manifold passed from engine.js
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

    return { drawFaces, drawPoints, drawRuler, drawGizmo };
})();
