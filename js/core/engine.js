/** 
 * VEETANCE Render Engine - Fragmented Edition
 * High performance, zero garbage, modular.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Core = (function () {
    const store = window.ENGINE.Store;
    const Config = window.ENGINE.Config;
    const Pool = window.ENGINE.Pool;
    const MathOps = window.ENGINE.MathOps;
    const Camera = window.ENGINE.Camera;
    const Rasterizer = window.ENGINE.Rasterizer;
    const RotCache = window.ENGINE.RotationCache;
    const mat4 = MathOps.mat4, vec3 = MathOps.vec3;

    const mModel = mat4.create(), mView = mat4.create(), mTotal = mat4.create(), mProj = mat4.create();

    // Grid Setup
    const gridCount = Config.GRID_DIVISIONS + 1;
    const gridPoints = new Float32Array(gridCount * 2 * 2 * 3);
    const halfSize = Config.GRID_SIZE / 2;
    for (let i = 0; i < gridCount; i++) {
        const d = (i / Config.GRID_DIVISIONS) * Config.GRID_SIZE - halfSize;
        const base = i * 6;
        gridPoints[base] = -halfSize; gridPoints[base + 1] = d; gridPoints[base + 2] = 0;
        gridPoints[base + 3] = halfSize; gridPoints[base + 4] = d; gridPoints[base + 5] = 0;
        const off = gridCount * 6;
        gridPoints[off + base] = d; gridPoints[off + base + 1] = -halfSize; gridPoints[off + base + 2] = 0;
        gridPoints[off + base + 3] = d; gridPoints[off + base + 4] = halfSize; gridPoints[off + base + 5] = 0;
    }
    const gridOut = new Float32Array(gridPoints.length / 3 * 4);

    // Z-AXIS PERIMETER RULER SYSTEM (10 Segments total)
    // 1 Main + 5 Ticks + 2 Base Arrow + 2 Top Arrow
    const rulerPoints = new Float32Array(10 * 2 * 3);
    const rulerOut = new Float32Array(10 * 2 * 4);

    const RX = 0, RY = -5, RZ = 0;
    const AS = 0.5; // Slightly larger arrow for prominence

    // 1. Vertical Ruler Line (Purged)
    rulerPoints.fill(0);

    // 2. Base Compass Arrow (Center Front, pointing AWAY from grid -Y)
    const bTipIdx = 6 * 6;
    rulerPoints[bTipIdx] = RX; rulerPoints[bTipIdx + 1] = RY - AS; rulerPoints[bTipIdx + 2] = RZ;
    rulerPoints[bTipIdx + 3] = RX - AS; rulerPoints[bTipIdx + 4] = RY; rulerPoints[bTipIdx + 5] = RZ;

    const bLeg2Idx = 7 * 6;
    rulerPoints[bLeg2Idx] = RX; rulerPoints[bLeg2Idx + 1] = RY - AS; rulerPoints[bLeg2Idx + 2] = RZ;
    rulerPoints[bLeg2Idx + 3] = RX + AS; rulerPoints[bLeg2Idx + 4] = RY; rulerPoints[bLeg2Idx + 5] = RZ;

    const vE1 = new Float32Array(3), vE2 = new Float32Array(3), vNormal = new Float32Array(3), lightDir = new Float32Array([0.2, 0.3, 1.0]);
    vec3.normalize(lightDir, lightDir);

    let lastSCount = 0;
    let lastBudget = 0;
    let lastVerts = null;

    function frame(mainCtx, overlayCtx, canvas, loop = true) {
        const state = store.getState();
        const { vertices, indices, camera, object, config } = state;
        const cen = state.ui.centroid;
        if (!vertices || !indices) {
            if (loop) requestAnimationFrame(() => frame(mainCtx, overlayCtx, canvas));
            return;
        }

        const buffers = Pool.getBuffers();
        const vCount = vertices.length / 3, fCount = indices.length / 3;

        // --- Clearing Phase ---
        window.ENGINE.Renderer.clear(mainCtx, canvas.width, canvas.height, config.bg);
        if (overlayCtx) overlayCtx.clearRect(0, 0, canvas.width, canvas.height);

        if (state.config.auto) {
            camera.orbitY += Config.AUTO_ROTATE_SPEED;
            if (camera.velX && Math.abs(camera.velX) > 0.00001) { camera.orbitY += camera.velX; camera.velX *= camera.damping; }
            if (camera.velY && Math.abs(camera.velY) > 0.00001) { camera.orbitX += camera.velY; camera.velY *= camera.damping; }
        } else {
            if (camera.velX && Math.abs(camera.velX) > 0.00001) { camera.orbitY += camera.velX; camera.velX *= camera.damping; }
            if (camera.velY && Math.abs(camera.velY) > 0.00001) { camera.orbitX += camera.velY; camera.velY *= camera.damping; }
            if (camera.panVelX && Math.abs(camera.panVelX) > 0.00001) { camera.target.x -= camera.panVelX; camera.panVelX *= camera.damping; }
            if (camera.panVelY && Math.abs(camera.panVelY) > 0.00001) { camera.target.y -= camera.panVelY; camera.panVelY *= camera.damping; }
            if (camera.panVelZ && Math.abs(camera.panVelZ) > 0.00001) { camera.target.z -= camera.panVelZ; camera.panVelZ *= camera.damping; }
        }
        Camera.updateViewMatrix(mView, camera, config);

        // --- Grid & Ruler (Main Layer - Behind Model) ---
        if (config.showGrid) {
            MathOps.transformBuffer(gridOut, gridPoints, mView, gridPoints.length / 3);
            MathOps.projectBuffer(gridOut, gridPoints.length / 3, canvas.width, canvas.height, config.fov * 13.33);
            mainCtx.strokeStyle = "rgba(100, 100, 100, 0.4)"; mainCtx.lineWidth = 1; mainCtx.beginPath();
            for (let i = 0; i < gridOut.length / 8; i++) {
                let i8 = i * 8; if (gridOut[i8 + 3] > 0 && gridOut[i8 + 7] > 0) { mainCtx.moveTo(gridOut[i8], gridOut[i8 + 1]); mainCtx.lineTo(gridOut[i8 + 4], gridOut[i8 + 5]); }
            }
            mainCtx.stroke();
            MathOps.transformBuffer(rulerOut, rulerPoints, mView, 10 * 2);
            MathOps.projectBuffer(rulerOut, 10 * 2, canvas.width, canvas.height, config.fov * 13.33);
            Rasterizer.drawRuler(mainCtx, rulerOut);

            // --- FRONT DIRECTION TOOLTIP (Still on Overlay for Clarity) ---
            if (overlayCtx) {
                const tipX = rulerOut[6 * 8], tipY = rulerOut[6 * 8 + 1], tipW = rulerOut[6 * 8 + 3];
                if (tipW > 0) {
                    window.ENGINE.frontArrowScreen = { x: tipX, y: tipY };
                    if (state.ui.hoveredFrontArrow) {
                        overlayCtx.save();
                        overlayCtx.font = "10px 'Outfit', sans-serif";
                        const text = "FRONT DIRECTION";
                        overlayCtx.fillStyle = "#00ffd2";
                        overlayCtx.textAlign = "center";
                        overlayCtx.fillText(text, tipX, tipY + 18);
                        overlayCtx.restore();
                    }
                } else {
                    window.ENGINE.frontArrowScreen = null;
                }
            }
        }

        mat4.identity(mModel);
        // Pivot around centroid: T(pos + cen) * R * S * T(-cen)
        mat4.translate(mModel, mModel, {
            x: object.pos.x + cen.x,
            y: object.pos.y + cen.y,
            z: object.pos.z + cen.z
        });
        RotCache.rotateX(mModel, mModel, object.rot.x);
        RotCache.rotateY(mModel, mModel, object.rot.y);
        RotCache.rotateZ(mModel, mModel, object.rot.z);
        mat4.scale(mModel, mModel, object.scl);
        mat4.translate(mModel, mModel, { x: -cen.x, y: -cen.y, z: -cen.z });

        mat4.multiply(mTotal, mView, mModel);

        MathOps.transformBuffer(buffers.world, vertices, mTotal, vCount);
        const fovScale = (canvas.height / 2) / Math.tan((config.fov * 0.5) * Math.PI / 180);

        // Required for interaction/outlines even in POINTS mode
        buffers.screen.set(buffers.world.subarray(0, vCount * 4));
        MathOps.projectBuffer(buffers.screen, vCount, canvas.width, canvas.height, fovScale);

        if (config.viewMode === 'POINTS') {
            const sBudget = config.pointBudget || 20000;
            // Persistence Check
            if (lastBudget !== sBudget || lastVerts !== vertices) {
                lastBudget = sBudget;
                lastVerts = vertices;
                lastSCount = MathOps.sampleSurfaceGrid(buffers.sampledWorld, vertices, indices, fCount, sBudget);
            }
            if (lastSCount > 0) {
                MathOps.transformBuffer(buffers.sampledScreen, buffers.sampledWorld, mTotal, lastSCount);
                MathOps.projectBuffer(buffers.sampledScreen, lastSCount, canvas.width, canvas.height, fovScale);
                const RP = window.ENGINE.RasterizerPixel;
                RP.clearHW(canvas.width, canvas.height);
                RP.renderPoints(mainCtx, buffers.sampledScreen, lastSCount, config, canvas.width, canvas.height);
                RP.flush(mainCtx, canvas.width, canvas.height);
            }
        } else {
            const world = buffers.world, screen = buffers.screen, depths = buffers.depth, sIdx = buffers.sortIndices, intensities = buffers.intensity;
            const isWire = config.viewMode === 'WIRE';
            let validFaces = 0;
            const clusters = object.clusters;
            const clusterVisibility = clusters ? new Uint8Array(clusters.length) : null;

            if (clusters) {
                for (let c = 0; c < clusters.length; c++) {
                    const cluster = clusters[c];
                    const [cx, cy, cz, radius] = cluster.sphere;

                    // 1. Cluster Culling (Sphere-Frustum)
                    const cp = [cx, cy, cz, 1.0];
                    MathOps.mat4.transformVec4(cp, mTotal, cp);
                    const w = cp[3];
                    const rScale = fovScale / (w || 1);
                    const screenR = radius * rScale;

                    // Aggressive screen-space frustum cull
                    if (w < -radius) continue; // Behind camera
                    if (Math.abs(cp[0] / w) > 1.2 && Math.abs(cp[0]) > screenR) continue;
                    if (Math.abs(cp[1] / w) > 1.2 && Math.abs(cp[1]) > screenR) continue;

                    // Mark cluster as visible
                    clusterVisibility[c] = 1;

                    // 2. Process triangles in visible cluster
                    for (let j = 0; j < cluster.faceCount; j++) {
                        const i = cluster.startFace + j;
                        const i3 = i * 3, i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2], i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;

                        if (screen[i04 + 3] < 0 || screen[i14 + 3] < 0 || screen[i24 + 3] < 0) continue;

                        const area = (screen[i14] - screen[i04]) * (screen[i24 + 1] - screen[i04 + 1]) - (screen[i14 + 1] - screen[i04 + 1]) * (screen[i24] - screen[i04]);
                        if (area > 0 && !isWire) continue;

                        const ax = world[i14] - world[i04], ay = world[i14 + 1] - world[i04 + 1], az = world[i14 + 2] - world[i04 + 2], bx = world[i24] - world[i04], by = world[i24 + 1] - world[i04 + 1], bz = world[i24 + 2] - world[i04 + 2];
                        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
                        const len = nx * nx + ny * ny + nz * nz;
                        if (len > 0) { const invLen = 1 / Math.sqrt(len); nx *= invLen; ny *= invLen; nz *= invLen; }

                        intensities[i] = Math.max(0.2, (nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2]) * 0.8 + 0.2);
                        depths[validFaces] = (world[i04 + 2] + world[i14 + 2] + world[i24 + 2]) * 0.333333;
                        sIdx[validFaces] = i;
                        validFaces++;
                    }
                }
            } else {
                // Fallback for objects without cluster data
                for (let i = 0; i < fCount; i++) {
                    const i3 = i * 3, i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2], i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;
                    if (screen[i04 + 3] < 0 || screen[i14 + 3] < 0 || screen[i24 + 3] < 0) continue;
                    const area = (screen[i14] - screen[i04]) * (screen[i24 + 1] - screen[i04 + 1]) - (screen[i14 + 1] - screen[i04 + 1]) * (screen[i24] - screen[i04]);
                    if (area > 0 && !isWire) continue;
                    const ax = world[i14] - world[i04], ay = world[i14 + 1] - world[i04 + 1], az = world[i14 + 2] - world[i04 + 2], bx = world[i24] - world[i04], by = world[i24 + 1] - world[i04 + 1], bz = world[i24 + 2] - world[i04 + 2];
                    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
                    const len = nx * nx + ny * ny + nz * nz;
                    if (len > 0) { const invLen = 1 / Math.sqrt(len); nx *= invLen; ny *= invLen; nz *= invLen; }
                    intensities[i] = Math.max(0.2, (nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2]) * 0.8 + 0.2);
                    depths[validFaces] = (world[i04 + 2] + world[i14 + 2] + world[i24 + 2]) * 0.333333;
                    sIdx[validFaces] = i; validFaces++;
                }
            }
            if (validFaces > 0) {
                const sorted = MathOps.radixSort(sIdx, depths, validFaces, buffers.auxIndices, buffers.auxDepth, buffers.radixCounts);

                const RP = window.ENGINE.RasterizerPixel;
                const isPixelPath = config.viewMode === 'SOLID' || config.viewMode === 'SHADED_WIRE';

                if (isPixelPath) {
                    RP.clearHW(canvas.width, canvas.height);
                    RP.render(mainCtx, screen, indices, intensities, sorted, validFaces, config, canvas.width, canvas.height, true);
                    RP.flush(mainCtx, canvas.width, canvas.height);
                }

                // Pass cluster visibility to wireframe renderer
                if (config.viewMode !== 'SOLID') {
                    Rasterizer.drawFaces(mainCtx, buffers, sorted, indices, validFaces, config, object.edges, clusters, clusterVisibility);
                }
            }
        }

        // --- GIZMO & SELECTION RENDERING (Overlay Layer) ---
        const GR = window.ENGINE.GizmoRenderer;
        const mode = state.ui.transformMode.toUpperCase();
        const origin = [
            object.pos.x + cen.x,
            object.pos.y + cen.y,
            object.pos.z + cen.z
        ];

        if (overlayCtx) {
            // Hover Performance Guard: Skip silhouette generation for 10k+ poly models
            if (GR && state.ui.hoveredObjectId && !state.ui.selectedObjectId && buffers && buffers.screen && fCount < 10000) {
                GR.drawHoverOutline(overlayCtx, buffers.screen, indices, fCount, '#66ccff');
            }
            if (mode === 'SELECT' && GR && state.ui.selectedObjectId) {
                GR.drawSelectionOutline(overlayCtx, origin, mView, canvas.width, canvas.height, fovScale);
            }
            if (GR && state.ui.selectedObjectId && (mode === 'TRANSLATE' || mode === 'ROTATE' || mode === 'SCALE')) {
                const hoveredAxis = state.ui.hoveredAxis;
                const dragAxis = state.ui.dragAxis;
                const objectRot = object.rot;
                if (mode === 'TRANSLATE') {
                    window.ENGINE.gizmoHitZones = GR.drawTranslate(overlayCtx, origin, mView, canvas.width, canvas.height, fovScale, objectRot, hoveredAxis, dragAxis);
                } else if (mode === 'ROTATE') {
                    window.ENGINE.gizmoHitZones = GR.drawRotate(overlayCtx, origin, mView, canvas.width, canvas.height, fovScale, objectRot, hoveredAxis, dragAxis);
                } else if (mode === 'SCALE') {
                    window.ENGINE.gizmoHitZones = GR.drawScale(overlayCtx, origin, mView, canvas.width, canvas.height, fovScale, objectRot, hoveredAxis, dragAxis);
                }
            } else {
                window.ENGINE.gizmoHitZones = [];
            }
        }

        if (loop) requestAnimationFrame(() => frame(mainCtx, overlayCtx, canvas));
    }
    return { frame, update: (mainCtx, overlayCtx, canvas) => frame(mainCtx, overlayCtx, canvas, false) };
})();
