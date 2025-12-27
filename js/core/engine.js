/**
 * VEETANCE Render Engine - Buffer Edition
 * 5000% Speed. Zero Garbage.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Core = (function () {
    const store = window.ENGINE.Store;
    const MathOps = window.ENGINE.MathOps;
    const Renderer = window.ENGINE.Renderer;
    const mat4 = MathOps.mat4;
    const vec3 = MathOps.vec3;

    let worldBuffer = new Float32Array(0); // View Space
    let screenBuffer = new Float32Array(0); // Screen Space
    let depthBuffer = new Float32Array(0); // Depth per face
    let intensityBuffer = new Float32Array(0); // Shading per face
    let sortIndices = new Int32Array(0);   // Face indices to sort

    // Normals scratchpad
    const vE1 = new Float32Array(3);
    const vE2 = new Float32Array(3);
    const vNormal = new Float32Array(3);
    const lightDir = new Float32Array([0.2, 0.3, 1.0]);
    vec3.normalize(lightDir, lightDir);

    // Matrices
    const mModel = mat4.create();
    const mView = mat4.create();
    const mTotal = mat4.create();
    const mTemp = mat4.create();

    // Grid Buffer
    const gridLines = 11; // -5 to 5
    const gridPoints = new Float32Array(gridLines * 2 * 2 * 3); // 2 sets (X/Y), 2 points/line, 3 comps

    for (let i = 0; i < gridLines; i++) {
        const d = i - 5;
        const base = i * 6;
        // Lines parallel to X axis
        gridPoints[base] = -5; gridPoints[base + 1] = d; gridPoints[base + 2] = 0;
        gridPoints[base + 3] = 5; gridPoints[base + 4] = d; gridPoints[base + 5] = 0;

        // Lines parallel to Y axis
        const offset = gridLines * 6;
        gridPoints[offset + base] = d; gridPoints[offset + base + 1] = -5; gridPoints[offset + base + 2] = 0;
        gridPoints[offset + base + 3] = d; gridPoints[offset + base + 1 + 3] = 5; gridPoints[offset + base + 5] = 0;
    }
    const gridOut = new Float32Array(gridPoints.length / 3 * 4);

    function frame(ctx, canvas) {
        const state = store.getState();
        const { vertices, indices, camera, object, config } = state;

        if (!vertices || !indices) {
            requestAnimationFrame(() => frame(ctx, canvas));
            return;
        }

        Renderer.clear(ctx, canvas.width, canvas.height, config.bg);

        // --- 1. Update Matrices (Standard Z-Up Orbit) ---
        if (config.auto) camera.orbitY += 0.005;

        mat4.identity(mView);
        // Distance - Push world into Negative Z (making camera effectively at +Z Elevation)
        mView[14] = -(camera.zoom + config.zOffset);
        // Rotation (Orbit)
        mat4.rotateX(mView, mView, camera.orbitX);
        mat4.rotateZ(mView, mView, camera.orbitY);
        // Target - Center rotations around the focal point
        mat4.translate(mView, mView, {
            x: -camera.target.x,
            y: -camera.target.y,
            z: -camera.target.z
        });

        // --- 2. Draw Grid (Ground Truth) ---
        if (config.showGrid) {
            MathOps.transformBuffer(gridOut, gridPoints, mView, gridPoints.length / 3);
            MathOps.projectBuffer(gridOut, gridPoints.length / 3, canvas.width, canvas.height, config.fov * 400);

            ctx.strokeStyle = "rgba(100, 100, 100, 0.2)"; // Dimmer grid
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < gridOut.length / 8; i++) {
                const i8 = i * 8;
                if (gridOut[i8 + 3] > 0 && gridOut[i8 + 7] > 0) {
                    ctx.moveTo(gridOut[i8], gridOut[i8 + 1]);
                    ctx.lineTo(gridOut[i8 + 4], gridOut[i8 + 5]);
                }
            }
            ctx.stroke();
        }

        // --- 2b. Draw Vertical Ruler (Z-Axis) ---
        if (config.showGrid) {
            const rulerLines = 6; // Main + 5 ticks
            const rulerPoints = new Float32Array(rulerLines * 2 * 3);
            // Main vertical line
            rulerPoints[0] = -5; rulerPoints[1] = -5; rulerPoints[2] = 0;
            rulerPoints[3] = -5; rulerPoints[4] = -5; rulerPoints[5] = 5;
            // Ticks
            for (let t = 1; t <= 5; t++) {
                const base = (t) * 6;
                rulerPoints[base] = -5.2; rulerPoints[base + 1] = -5; rulerPoints[base + 2] = t;
                rulerPoints[base + 3] = -4.8; rulerPoints[base + 4] = -5; rulerPoints[base + 5] = t;
            }
            const rulerOut = new Float32Array(rulerPoints.length / 3 * 4);
            MathOps.transformBuffer(rulerOut, rulerPoints, mView, rulerPoints.length / 3);
            MathOps.projectBuffer(rulerOut, rulerPoints.length / 3, canvas.width, canvas.height, config.fov * 400);

            ctx.strokeStyle = "rgba(150, 150, 150, 0.6)"; // Gray ruler
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < rulerOut.length / 8; i++) {
                const i8 = i * 8;
                if (rulerOut[i8 + 3] > 0 && rulerOut[i8 + 7] > 0) {
                    ctx.moveTo(rulerOut[i8], rulerOut[i8 + 1]);
                    ctx.lineTo(rulerOut[i8 + 4], rulerOut[i8 + 5]);
                }
            }
            ctx.stroke();
        }

        // --- 3. Transform Model ---
        mat4.identity(mModel);
        mat4.translate(mModel, mModel, object.pos);
        mat4.rotateX(mModel, mModel, object.rot.x);
        mat4.rotateY(mModel, mModel, object.rot.y);
        mat4.rotateZ(mModel, mModel, object.rot.z);
        mat4.scale(mModel, mModel, object.scl);

        mat4.multiply(mTotal, mView, mModel);

        const vCount = vertices.length / 3;
        const fCount = indices.length / 3;

        if (worldBuffer.length < vCount * 4) {
            worldBuffer = new Float32Array(vCount * 4);
            screenBuffer = new Float32Array(vCount * 4);
        }
        if (depthBuffer.length < fCount) {
            depthBuffer = new Float32Array(fCount);
            intensityBuffer = new Float32Array(fCount);
            sortIndices = new Int32Array(fCount);
        }

        MathOps.transformBuffer(worldBuffer, vertices, mTotal, vCount);
        screenBuffer.set(worldBuffer);
        MathOps.projectBuffer(screenBuffer, vCount, canvas.width, canvas.height, config.fov * 400);

        // --- 4. Render Mode Logic ---
        const isPoints = config.viewMode === 'POINTS';
        if (isPoints) {
            ctx.fillStyle = config.fg;
            const size = config.thickness;
            for (let i = 0; i < vCount; i++) {
                const idx = i * 4;
                if (screenBuffer[idx + 3] > 0) ctx.fillRect(screenBuffer[idx], screenBuffer[idx + 1], size, size);
            }
        } else {
            let validFaces = 0;
            const mode = config.viewMode;
            const isSolid = mode === 'SOLID';
            const isShadedWire = mode === 'SHADED_WIRE';
            const isWire = mode === 'WIRE';
            const baseColor = config.polyColor || '#1a1a1a';
            const r = parseInt(baseColor.slice(1, 3), 16);
            const g = parseInt(baseColor.slice(3, 5), 16);
            const bVal = parseInt(baseColor.slice(5, 7), 16);

            for (let i = 0; i < fCount; i++) {
                const i3 = i * 3;
                const idx0 = indices[i3], idx1 = indices[i3 + 1], idx2 = indices[i3 + 2];
                if (screenBuffer[idx0 * 4 + 3] < 0 || screenBuffer[idx1 * 4 + 3] < 0 || screenBuffer[idx2 * 4 + 3] < 0) continue;

                const x0 = screenBuffer[idx0 * 4], y0 = screenBuffer[idx0 * 4 + 1];
                const x1 = screenBuffer[idx1 * 4], y1 = screenBuffer[idx1 * 4 + 1];
                const x2 = screenBuffer[idx2 * 4], y2 = screenBuffer[idx2 * 4 + 1];
                const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
                if (area >= 0 && mode !== 'WIRE') continue;

                const p0 = worldBuffer.subarray(idx0 * 4, idx0 * 4 + 3);
                const p1 = worldBuffer.subarray(idx1 * 4, idx1 * 4 + 3);
                const p2 = worldBuffer.subarray(idx2 * 4, idx2 * 4 + 3);
                vec3.sub(vE1, p1, p0);
                vec3.sub(vE2, p2, p0);
                vec3.cross(vNormal, vE1, vE2);
                vec3.normalize(vNormal, vNormal);

                intensityBuffer[i] = Math.max(0.1, vec3.dot(vNormal, lightDir));
                depthBuffer[validFaces] = (worldBuffer[idx0 * 4 + 2] + worldBuffer[idx1 * 4 + 2] + worldBuffer[idx2 * 4 + 2]) * 0.333;
                sortIndices[validFaces] = i;
                validFaces++;
            }

            // RADIX SORT (O(N))
            // RADIX SORT (Optimization: 16-bit / 2-Pass)
            let finalIndices = sortIndices.subarray(0, validFaces);

            if (validFaces > 0) {
                // Check sizes
                if (!window.ENGINE.Data.auxSortIndices || window.ENGINE.Data.auxSortIndices.length < fCount) {
                    window.ENGINE.Data.auxSortIndices = new Int32Array(fCount);
                    window.ENGINE.Data.auxDepth = new Int32Array(fCount);
                    // Histogram: 2 passes * 65536 buckets
                    window.ENGINE.Data.radixCounts = new Int32Array(65536 * 2);
                }

                let srcIds = sortIndices;
                let dstIds = window.ENGINE.Data.auxSortIndices;
                const depthIntView = new Int32Array(depthBuffer.buffer);
                let srcKeys = depthIntView;
                let dstKeys = window.ENGINE.Data.auxDepth;

                const counts = window.ENGINE.Data.radixCounts;
                counts.fill(0);

                // 1. Histogram Pass (2 x 16-bit)
                for (let i = 0; i < validFaces; i++) {
                    const k = srcKeys[i];
                    counts[k & 0xFFFF]++;               // Lower 16 bits
                    counts[65536 + ((k >>> 16) & 0xFFFF)]++; // Upper 16 bits
                }

                // 2. Sort Passes (2 Passes)
                for (let shift = 0; shift < 32; shift += 16) {
                    const countOffset = (shift / 16) * 65536;
                    let pos = 0;

                    // Prefix Sums
                    for (let j = 0; j < 65536; j++) {
                        const tmp = counts[countOffset + j];
                        counts[countOffset + j] = pos;
                        pos += tmp;
                    }

                    // Shuffle
                    for (let i = 0; i < validFaces; i++) {
                        const val = srcKeys[i];
                        const short = (val >>> shift) & 0xFFFF;
                        const destIdx = counts[countOffset + short]++;
                        dstKeys[destIdx] = val;
                        dstIds[destIdx] = srcIds[i];
                    }

                    // Swap Buffers
                    let tK = srcKeys; srcKeys = dstKeys; dstKeys = tK;
                    let tI = srcIds; srcIds = dstIds; dstIds = tI;
                }

                finalIndices = srcIds;
            }

            ctx.lineWidth = config.thickness;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            for (let k = 0; k < validFaces; k++) {
                const faceIdx = finalIndices[k];
                const i3 = faceIdx * 3;
                const idx0 = indices[i3], idx1 = indices[i3 + 1], idx2 = indices[i3 + 2];

                ctx.beginPath();
                ctx.moveTo(screenBuffer[idx0 * 4], screenBuffer[idx0 * 4 + 1]);
                ctx.lineTo(screenBuffer[idx1 * 4], screenBuffer[idx1 * 4 + 1]);
                ctx.lineTo(screenBuffer[idx2 * 4], screenBuffer[idx2 * 4 + 1]);
                ctx.closePath();

                if (isSolid || isShadedWire) {
                    const intensity = intensityBuffer[faceIdx];
                    const fillStyle = `rgb(${r * intensity}, ${g * intensity}, ${bVal * intensity})`;
                    ctx.fillStyle = fillStyle;
                    ctx.fill();

                    if (isSolid) {
                        ctx.strokeStyle = fillStyle;
                        ctx.stroke();
                    }
                }

                if (isShadedWire || isWire) {
                    ctx.strokeStyle = config.fg;
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(() => frame(ctx, canvas));
    }

    return {
        frame,
        update: (ctx, canvas) => {
            // Force a single synchronous frame without scheduling a new one
            // We temporarily shadow requestAnimationFrame to prevent double-looping
            const originalRAF = window.requestAnimationFrame;
            window.requestAnimationFrame = () => { };
            frame(ctx, canvas);
            window.requestAnimationFrame = originalRAF;
        }
    };
})();
