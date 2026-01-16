/**
 * VEETANCE Scanline Core
 * Pure math module for Soft-Rasterization. 
 * Handles Span setup, edge walking, and z-buffer interpolation.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Scanline = (function () {
    // 2D Clipping Constants
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
    const f_shift = 16;
    const f_one = 1 << f_shift;

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

    function drawLine(fb, db, x0, y0, z0, x1, y1, z1, color, width, height) {
        if (isNaN(x0) || isNaN(y0) || isNaN(x1) || isNaN(y1)) return;
        if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;

        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let curX = x0 | 0, curY = y0 | 0;
        let endX = x1 | 0, endY = y1 | 0;

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

    return { drawTriangle, drawLine, computeOutCode, INSIDE, LEFT, RIGHT, BOTTOM, TOP };
})();
