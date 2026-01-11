/** 
 * VEETANCE Pixel-Buffer Rasterizer
 * The Sovereign CPU path. Direct pixel manipulation via Barycentric coordinates.
 * Inspired by Sean Barrett & Tsoding.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.RasterizerPixel = (function () {
    const Pool = window.ENGINE.Pool;

    // 2D Clipping Constants
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
    function computeOutCode(x, y, w, h) {
        let code = INSIDE;
        if (x < 0) code |= LEFT;
        else if (x >= w) code |= RIGHT;
        if (y < 0) code |= TOP;
        else if (y >= h) code |= BOTTOM;
        return code;
    }

    function drawTriangle(fb, db, p0, p1, p2, color, width, height) {
        // 1. Sort vertices by Y
        if (p0.y > p1.y) [p0, p1] = [p1, p0];
        if (p0.y > p2.y) [p0, p2] = [p2, p0];
        if (p1.y > p2.y) [p1, p2] = [p2, p1];

        const f_shift = 16;
        const f_one = 1 << f_shift;

        const drawSpan = (y, fx1, fx2, fz1, fz2) => {
            if (y < 0 || y >= height) return;
            if (fx1 > fx2) { [fx1, fx2] = [fx2, fx1];[fz1, fz2] = [fz2, fz1]; }

            const xStart = Math.ceil(fx1 / f_one);
            const xEnd = Math.ceil(fx2 / f_one);
            if (xStart >= xEnd) return;

            const dx_f = (fx2 - fx1);
            const dz_dx_f = dx_f > 0 ? ((fz2 - fz1) * f_one / dx_f) | 0 : 0;

            const prestep_x = (xStart * f_one - fx1);
            let fz = fz1 + (prestep_x * (dz_dx_f / f_one)) | 0;

            let offset = y * width + xStart;
            for (let x = xStart; x < xEnd; x++) {
                if (x >= 0 && x < width) {
                    const zFloat = fz / f_one;
                    if (zFloat > db[offset]) {
                        db[offset] = zFloat;
                        fb[offset] = color;
                    }
                }
                fz += dz_dx_f;
                offset++;
            }
        };

        const dy01 = p1.y - p0.y, dy02 = p2.y - p0.y, dy12 = p2.y - p1.y;

        // Top Half
        if (dy01 > 0.0001) {
            const dx01_f = ((p1.x - p0.x) * f_one / dy01) | 0;
            const dx02_f = ((p2.x - p0.x) * f_one / dy02) | 0;
            const dz01_f = ((p1.z - p0.z) * f_one / dy01) | 0;
            const dz02_f = ((p2.z - p0.z) * f_one / dy02) | 0;

            const yStart = Math.ceil(p0.y), yEnd = Math.ceil(p1.y);
            for (let y = yStart; y < yEnd; y++) {
                const dy = y - p0.y;
                const fx1 = p0.x * f_one + dy * dx01_f;
                const fx2 = p0.x * f_one + dy * dx02_f;
                const fz1 = p0.z * f_one + dy * dz01_f;
                const fz2 = p0.z * f_one + dy * dz02_f;
                drawSpan(y, fx1, fx2, fz1, fz2);
            }
        }

        // Bottom Half
        if (dy12 > 0.0001) {
            const dx12_f = ((p2.x - p1.x) * f_one / dy12) | 0;
            const dx02_f = ((p2.x - p0.x) * f_one / dy02) | 0;
            const dz12_f = ((p2.z - p1.z) * f_one / dy12) | 0;
            const dz02_f = ((p2.z - p0.z) * f_one / dy02) | 0;

            const yStart = Math.ceil(p1.y), yEnd = Math.ceil(p2.y);
            for (let y = yStart; y < yEnd; y++) {
                const dyTop = y - p0.y, dyBottom = y - p1.y;
                const fx1 = p1.x * f_one + dyBottom * dx12_f;
                const fx2 = p0.x * f_one + dyTop * dx02_f;
                const fz1 = p1.z * f_one + dyBottom * dz12_f;
                const fz2 = p0.z * f_one + dyTop * dz02_f;
                drawSpan(y, fx1, fx2, fz1, fz2);
            }
        }
    }

    function clearHW(width, height) {
        const buffers = Pool.getBuffers();
        buffers.framebuffer.fill(0x00000000, 0, width * height);
        buffers.pixelDepth.fill(-1000.0, 0, width * height);
    }

    let offscreenCanvas = null;
    let offscreenCtx = null;

    function flush(ctx, width, height) {
        if (!offscreenCanvas || offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = width;
            offscreenCanvas.height = height;
            offscreenCtx = offscreenCanvas.getContext('2d');
        }

        const buffers = Pool.getBuffers();
        const fb = buffers.framebuffer;
        const imgData = new ImageData(new Uint8ClampedArray(fb.buffer, fb.byteOffset, width * height * 4), width, height);

        offscreenCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(offscreenCanvas, 0, 0);
    }

    function render(ctx, screen, indices, intensities, sortedIndices, fCount, config, width, height, frontToBack = false) {
        const buffers = Pool.getBuffers();
        const fb = buffers.framebuffer;
        const db = buffers.pixelDepth;

        const baseColor = config.polyColor || '#1a1a1a';
        const r = parseInt(baseColor.slice(1, 3), 16), g = parseInt(baseColor.slice(3, 5), 16), b = parseInt(baseColor.slice(5, 7), 16);

        for (let k = 0; k < fCount; k++) {
            // If frontToBack is true, we iterate the ASCENDING sort in REVERSE (Closest First)
            const sortedIdx = frontToBack ? (fCount - 1 - k) : k;
            const fIdx = sortedIndices[sortedIdx];
            const i3 = fIdx * 3;

            const idx0 = indices[i3], idx1 = indices[i3 + 1], idx2 = indices[i3 + 2];
            const i04 = idx0 << 2, i14 = idx1 << 2, i24 = idx2 << 2;

            if (screen[i04 + 3] !== 1 || screen[i14 + 3] !== 1 || screen[i24 + 3] !== 1) continue;

            const intens = intensities[fIdx];
            const color = 0xFF000000 | ((b * intens | 0) << 16) | ((g * intens | 0) << 8) | (r * intens | 0);

            drawTriangle(fb, db,
                { x: screen[i04], y: screen[i04 + 1], z: screen[i04 + 2] },
                { x: screen[i14], y: screen[i14 + 1], z: screen[i14 + 2] },
                { x: screen[i24], y: screen[i24 + 1], z: screen[i24 + 2] },
                color, width, height);
        }
    }

    function renderPoints(ctx, screen, sCount, config, width, height) {
        const buffers = Pool.getBuffers();
        const fb = buffers.framebuffer;
        const db = buffers.pixelDepth;

        const baseColor = config.fg || '#00ffd2';
        const r = parseInt(baseColor.slice(1, 3), 16), g = parseInt(baseColor.slice(3, 5), 16), b = parseInt(baseColor.slice(5, 7), 16);
        const pointColor = 0xFF000000 | (b << 16) | (g << 8) | r;

        for (let i = 0; i < sCount; i++) {
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

            // Bounds check: ensure indices are within screen buffer
            const maxIdx = (screen.length >> 2) - 1;
            if (idx0 < 0 || idx0 > maxIdx || idx1 < 0 || idx1 > maxIdx) continue;

            const i14 = idx0 << 2, i24 = idx1 << 2;

            // Only draw if BOTH vertices are valid (in front of camera)
            if (screen[i14 + 3] !== 1 || screen[i24 + 3] !== 1) continue;

            let x1 = screen[i14], y1 = screen[i14 + 1], z1 = screen[i14 + 2];
            let x2 = screen[i24], y2 = screen[i24 + 1], z2 = screen[i24 + 2];

            // NaN/Infinity guard
            if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) continue;

            // 2D Screen Space Clipping (Cohen-Sutherland)
            let code0 = computeOutCode(x1, y1, width, height);
            let code1 = computeOutCode(x2, y2, width, height);
            let accept = false;
            let iterations = 0;

            while (iterations++ < 10) { // Safety limit
                if (!(code0 | code1)) {
                    accept = true; break;
                } else if (code0 & code1) {
                    break;
                } else {
                    let outcode = code0 ? code0 : code1;
                    let x, y;
                    const dx = x2 - x1, dy = y2 - y1;

                    if (outcode & TOP) {
                        if (Math.abs(dy) < 0.001) break; // Avoid division by zero
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

            if (accept) drawLine(fb, db, x1, y1, z1, x2, y2, z2, color, width, height);
        }
    }

    function drawLine(fb, db, x0, y0, z0, x1, y1, z1, color, width, height) {
        // Sanitize NaN/Infinity to prevent infinite loops
        if (isNaN(x0) || isNaN(y0) || isNaN(x1) || isNaN(y1)) return;
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;

        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let curX = x0 | 0, curY = y0 | 0;
        let endX = x1 | 0, endY = y1 | 0;

        // Safety iteration limit (sanity check)
        let maxIterations = 10000;

        while (maxIterations-- > 0) {
            if (curX >= 0 && curX < width && curY >= 0 && curY < height) {
                const idx = curY * width + curX;
                const dist0 = Math.abs(curX - x0) + Math.abs(curY - y0);
                const dist1 = Math.abs(endX - curX) + Math.abs(endY - curY);
                const t = dist0 / (dist0 + dist1 || 1);
                const curZ = z0 + (z1 - z0) * t;

                if (curZ > db[idx] - 0.2) {
                    fb[idx] = color;
                }
            }
            if (curX === endX && curY === endY) break;
            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; curX += sx; }
            if (e2 < dx) { err += dx; curY += sy; }
        }
    }

    return { render, renderPoints, renderEdges, clearHW, flush };
})();
