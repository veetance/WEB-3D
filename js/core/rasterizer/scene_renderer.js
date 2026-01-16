/**
 * VEETANCE Scene Renderer
 * The high-level looping logic that orchestrates the Scanline Rasterizer.
 * Handles: Points, Edges, Faces, and Buffer Flushing.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.SceneRenderer = (function () {
    const Pool = window.ENGINE.Pool;
    const Scanline = window.ENGINE.Scanline;

    // Direct Import Constants
    const { computeOutCode, INSIDE, LEFT, RIGHT, BOTTOM, TOP } = Scanline;

    function clearHW(width, height) {
        Pool.ensureBufferSize(width, height);
        const buffers = Pool.getBuffers();
        buffers.framebuffer.fill(0x00000000, 0, width * height);
        buffers.pixelDepth.fill(-1000.0, 0, width * height);
    }

    let offscreenCanvas = null;
    let offscreenCtx = null;

    function flush(ctx, width, height) {
        // Validate dimensions
        if (!width || !height || width <= 0 || height <= 0) {
            console.warn(`VEETANCE: Invalid canvas dimensions: ${width}x${height}`);
            return;
        }

        Pool.ensureBufferSize(width, height);

        if (!offscreenCanvas || offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = width;
            offscreenCanvas.height = height;
            offscreenCtx = offscreenCanvas.getContext('2d');
        }

        const buffers = Pool.getBuffers();
        const fb = buffers.framebuffer;
        const expectedSize = width * height * 4;

        // Safety check: ensure buffer is large enough
        if (fb.byteLength < expectedSize) {
            console.warn(`VEETANCE: Buffer too small. Expected ${expectedSize}, got ${fb.byteLength}`);
            return;
        }

        const imgData = new ImageData(new Uint8ClampedArray(fb.buffer, fb.byteOffset, expectedSize), width, height);

        offscreenCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(offscreenCanvas, 0, 0);
    }

    /**
     * Main Face Rendering Loop
     * @param {Uint32Array} [faceColors] - Optional pre-calculated colors per face (for UV/Normal modes)
     */
    function render(ctx, screen, indices, intensities, sortedIndices, fCount, config, width, height, frontToBack = false, faceColors = null) {
        const buffers = Pool.getBuffers();
        const fb = buffers.framebuffer;
        const db = buffers.pixelDepth;

        const baseColor = config.polyColor || '#1a1a1a';
        const r = parseInt(baseColor.slice(1, 3), 16), g = parseInt(baseColor.slice(3, 5), 16), b = parseInt(baseColor.slice(5, 7), 16);

        for (let k = 0; k < fCount; k++) {
            const sortedIdx = frontToBack ? (fCount - 1 - k) : k;
            const fIdx = sortedIndices[sortedIdx];
            const i3 = fIdx * 3;

            const idx0 = indices[i3], idx1 = indices[i3 + 1], idx2 = indices[i3 + 2];
            const i04 = idx0 << 2, i14 = idx1 << 2, i24 = idx2 << 2;

            if (screen[i04 + 3] !== 1 || screen[i14 + 3] !== 1 || screen[i24 + 3] !== 1) continue;

            let color;
            if (faceColors) {
                // UV/Normal Mode: Use pre-calculated color directly
                color = faceColors[fIdx];
            } else {
                // Standard Lighting Mode
                const intens = intensities[fIdx];
                color = 0xFF000000 | ((b * intens | 0) << 16) | ((g * intens | 0) << 8) | (r * intens | 0);
            }

            Scanline.drawTriangle(fb, db,
                { x: screen[i04], y: screen[i04 + 1], z: screen[i04 + 2] },
                { x: screen[i14], y: screen[i14 + 1], z: screen[i14 + 2] },
                { x: screen[i24], y: screen[i24 + 1], z: screen[i24 + 2] },
                color, width, height);
        }
    }

    function renderPoints(ctx, screen, sCount, config, width, height, lodStride = 1) {
        const buffers = Pool.getBuffers();
        const fb = buffers.framebuffer;
        const db = buffers.pixelDepth;

        const baseColor = config.fg || '#00ffd2';
        const r = parseInt(baseColor.slice(1, 3), 16), g = parseInt(baseColor.slice(3, 5), 16), b = parseInt(baseColor.slice(5, 7), 16);
        const pointColor = 0xFF000000 | (b << 16) | (g << 8) | r;

        for (let i = 0; i < sCount; i++) {
            if (i % lodStride !== 0) continue;

            const i4 = i << 2;
            if (screen[i4 + 3] < 0) continue;

            const sx = screen[i4] | 0, sy = screen[i4 + 1] | 0, sz = screen[i4 + 2];
            if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

            const idx = sy * width + sx;
            if (sz > db[idx] - 0.05) {
                db[idx] = sz;
                fb[idx] = pointColor;
            }
        }
    }

    function renderEdges(ctx, screen, edges, config, width, height, vOffset, fovScale) {
        if (!edges) return;
        const buffers = Pool.getBuffers();
        const fb = buffers.framebuffer;
        const db = buffers.pixelDepth;

        const baseColor = config.fg || '#00ffd2';
        const r = parseInt(baseColor.slice(1, 3), 16), g = parseInt(baseColor.slice(3, 5), 16), b = parseInt(baseColor.slice(5, 7), 16);
        const color = 0xFF000000 | (b << 16) | (g << 8) | r;

        for (let i = 0; i < edges.length; i += 2) {
            const idx0 = edges[i] + vOffset;
            const idx1 = edges[i + 1] + vOffset;

            const maxIdx = (screen.length >> 2) - 1;
            if (idx0 < 0 || idx0 > maxIdx || idx1 < 0 || idx1 > maxIdx) continue;

            const i14 = idx0 << 2, i24 = idx1 << 2;
            if (screen[i14 + 3] !== 1 || screen[i24 + 3] !== 1) continue;

            let x1 = screen[i14], y1 = screen[i14 + 1], z1 = screen[i14 + 2];
            let x2 = screen[i24], y2 = screen[i24 + 1], z2 = screen[i24 + 2];

            if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) continue;

            // 2D Screen Space Clipping (Cohen-Sutherland)
            let code0 = computeOutCode(x1, y1, width, height);
            let code1 = computeOutCode(x2, y2, width, height);
            let accept = false;
            let iterations = 0;

            while (iterations++ < 10) {
                if (!(code0 | code1)) {
                    accept = true; break;
                } else if (code0 & code1) {
                    break;
                } else {
                    let outcode = code0 ? code0 : code1;
                    let x, y;
                    const dx = x2 - x1, dy = y2 - y1;

                    if (outcode & TOP) {
                        if (Math.abs(dy) < 0.001) break;
                        x = x1 + dx * (0 - y1) / dy; y = 0;
                    }
                    else if (outcode & BOTTOM) {
                        if (Math.abs(dy) < 0.001) break;
                        x = x1 + dx * ((height - 1) - y1) / dy; y = height - 1;
                    }
                    else if (outcode & RIGHT) {
                        if (Math.abs(dx) < 0.001) break;
                        y = y1 + dy * ((width - 1) - x1) / dx; x = width - 1;
                    }
                    else if (outcode & LEFT) {
                        if (Math.abs(dx) < 0.001) break;
                        y = y1 + dy * (0 - x1) / dx; x = 0;
                    }
                    else break;

                    if (!isFinite(x) || !isFinite(y)) break;

                    if (outcode === code0) { x1 = x; y1 = y; code0 = computeOutCode(x1, y1, width, height); }
                    else { x2 = x; y2 = y; code1 = computeOutCode(x2, y2, width, height); }
                }
            }

            if (accept) Scanline.drawLine(fb, db, x1, y1, z1, x2, y2, z2, color, width, height);
        }
    }

    return { render, renderPoints, renderEdges, clearHW, flush };
})();
