/** 
 * VEETANCE Rasterizer
 * Handles CPU-based Canvas 2D drawing of transformed geometry.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Rasterizer = (function () {
    let wireframeBuffer = null;
    let wireframeCtx = null;

    function drawFaces(ctx, buffers, sortedIndices, indices, validFaces, config, structuralEdges, clusters, clusterVisibility) {
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

        // Build cluster lookup if available
        const faceToCluster = clusters ? new Uint32Array(indices.length / 3) : null;
        if (clusters) {
            for (let c = 0; c < clusters.length; c++) {
                const cluster = clusters[c];
                for (let j = 0; j < cluster.faceCount; j++) {
                    faceToCluster[cluster.startFace + j] = c;
                }
            }
        }

        // Sparse Wireframe Optimization: Direct pixel buffer manipulation
        const w = ctx.canvas.width, h = ctx.canvas.height;
        const wireDensity = config.wireDensity || 0.5; // 50% default (every other pixel)

        if (isWire && !wireframeBuffer) {
            wireframeBuffer = ctx.createImageData(w, h);
        }

        if (isWire && wireframeBuffer && (wireframeBuffer.width !== w || wireframeBuffer.height !== h)) {
            wireframeBuffer = ctx.createImageData(w, h);
        }

        const wireData = isWire ? wireframeBuffer.data : null;
        if (wireData) wireData.fill(0); // Clear buffer

        const wireColor = config.fg || '#00ffd2';
        const wr = parseInt(wireColor.slice(1, 3), 16);
        const wg = parseInt(wireColor.slice(3, 5), 16);
        const wb = parseInt(wireColor.slice(5, 7), 16);

        // Sparse Bresenham Line Rasterizer with Depth Testing
        const drawSparseLine = (x0, y0, x1, y1, z0, z1) => {
            x0 = Math.round(x0); y0 = Math.round(y0);
            x1 = Math.round(x1); y1 = Math.round(y1);

            const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
            const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
            let err = dx - dy;
            let pixelCount = 0;

            // Linear Z interpolation
            const totalSteps = Math.max(dx, dy);
            const dz = totalSteps > 0 ? (z1 - z0) / totalSteps : 0;
            let z = z0;

            // Get depth buffer for occlusion testing (SHADED_WIRE mode only)
            const Pool = window.ENGINE.Pool;
            const depthBuffer = (mode === 'SHADED_WIRE' && Pool) ? Pool.getBuffers().pixelDepth : null;

            while (true) {
                // Sparse sampling: only draw pixels based on density
                if (pixelCount % Math.max(1, Math.floor(1 / wireDensity)) === 0) {
                    if (x0 >= 0 && x0 < w && y0 >= 0 && y0 < h) {
                        const idx = (y0 * w + x0) * 4;
                        const bufferIdx = y0 * w + x0;

                        // Depth test: only draw if wireframe is in front of solid geometry
                        let shouldDraw = true;
                        if (depthBuffer) {
                            const solidDepth = depthBuffer[bufferIdx];
                            // Add small epsilon to prevent z-fighting
                            shouldDraw = (z >= solidDepth - 0.01);
                        }

                        if (shouldDraw) {
                            wireData[idx] = wr;
                            wireData[idx + 1] = wg;
                            wireData[idx + 2] = wb;
                            wireData[idx + 3] = 255;
                        }
                    }
                }

                if (x0 === x1 && y0 === y1) break;
                const e2 = err * 2;
                if (e2 > -dy) { err -= dy; x0 += sx; }
                if (e2 < dx) { err += dx; y0 += sy; }
                pixelCount++;
                z += dz;
            }
        };

        ctx.lineWidth = config.thickness;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (let k = validFaces - 1; k >= 0; k--) {
            const fIdx = sortedIndices[k];

            // Wire-Cluster Culling: Skip if cluster is not visible
            if (clusterVisibility && !clusterVisibility[faceToCluster[fIdx]]) continue;

            const i3 = fIdx * 3;
            const idx0 = indices[i3], idx1 = indices[i3 + 1], idx2 = indices[i3 + 2], i04 = idx0 << 2, i14 = idx1 << 2, i24 = idx2 << 2;

            // SOLID mode is now handled by RasterizerPixel (software rasterizer)
            // This function only handles wireframe overlay rendering

            if (isWire) {
                const x0 = screen[i04], y0 = screen[i04 + 1], z0 = screen[i04 + 2];
                const x1 = screen[i14], y1 = screen[i14 + 1], z1 = screen[i14 + 2];
                const x2 = screen[i24], y2 = screen[i24 + 1], z2 = screen[i24 + 2];

                if (config.showDiagonals || !structuralEdges || edgeSet.has(idx0 < idx1 ? `${idx0}_${idx1}` : `${idx1}_${idx0}`)) {
                    drawSparseLine(x0, y0, x1, y1, z0, z1);
                }
                if (config.showDiagonals || !structuralEdges || edgeSet.has(idx1 < idx2 ? `${idx1}_${idx2}` : `${idx2}_${idx1}`)) {
                    drawSparseLine(x1, y1, x2, y2, z1, z2);
                }
                if (config.showDiagonals || !structuralEdges || edgeSet.has(idx2 < idx0 ? `${idx2}_${idx0}` : `${idx0}_${idx2}`)) {
                    drawSparseLine(x2, y2, x0, y0, z2, z0);
                }
            }
        }

        // Flush wireframe buffer to canvas with alpha compositing
        if (isWire && wireData) {
            if (!wireframeCtx) {
                const offscreen = document.createElement('canvas');
                offscreen.width = w;
                offscreen.height = h;
                wireframeCtx = offscreen.getContext('2d');
            }

            if (wireframeCtx.canvas.width !== w || wireframeCtx.canvas.height !== h) {
                wireframeCtx.canvas.width = w;
                wireframeCtx.canvas.height = h;
            }

            wireframeCtx.putImageData(wireframeBuffer, 0, 0);
            ctx.drawImage(wireframeCtx.canvas, 0, 0);
        }
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

    return { drawFaces, drawRuler, drawGizmo };
})();
