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

    const RX = -5, RY = -5, RZ = 0, L = 5;
    const AS = 0.4; // Arrow Scale

    // 1. Vertical Ruler Line
    rulerPoints[0] = RX; rulerPoints[1] = RY; rulerPoints[2] = RZ;
    rulerPoints[3] = RX; rulerPoints[4] = RY; rulerPoints[5] = RZ + L;

    // 2. Ticks
    for (let t = 1; t <= 5; t++) {
        const b = t * 6;
        rulerPoints[b] = RX - 0.2; rulerPoints[b + 1] = RY; rulerPoints[b + 2] = RZ + t;
        rulerPoints[b + 3] = RX + 0.2; rulerPoints[b + 4] = RY; rulerPoints[b + 5] = RZ + t;
    }

    // 3. Base Arrow (Tip touching base, facing Front -Y)
    const bTipIdx = 6 * 6;
    rulerPoints[bTipIdx] = RX; rulerPoints[bTipIdx + 1] = RY; rulerPoints[bTipIdx + 2] = RZ;
    rulerPoints[bTipIdx + 3] = RX - AS; rulerPoints[bTipIdx + 4] = RY + AS; rulerPoints[bTipIdx + 5] = RZ;

    const bLeg2Idx = 7 * 6;
    rulerPoints[bLeg2Idx] = RX; rulerPoints[bLeg2Idx + 1] = RY; rulerPoints[bLeg2Idx + 2] = RZ;
    rulerPoints[bLeg2Idx + 3] = RX + AS; rulerPoints[bLeg2Idx + 4] = RY + AS; rulerPoints[bLeg2Idx + 5] = RZ;

    // 4. TOP Arrow (Tip touching Top, pointing UP +Z)
    const tTipIdx = 8 * 6;
    rulerPoints[tTipIdx] = RX; rulerPoints[tTipIdx + 1] = RY; rulerPoints[tTipIdx + 2] = RZ + L;
    rulerPoints[tTipIdx + 3] = RX - AS; rulerPoints[tTipIdx + 4] = RY; rulerPoints[tTipIdx + 5] = RZ + L - AS;

    const tLeg2Idx = 9 * 6;
    rulerPoints[tLeg2Idx] = RX; rulerPoints[tLeg2Idx + 1] = RY; rulerPoints[tLeg2Idx + 2] = RZ + L;
    rulerPoints[tLeg2Idx + 3] = RX + AS; rulerPoints[tLeg2Idx + 4] = RY; rulerPoints[tLeg2Idx + 5] = RZ + L - AS;

    const vE1 = new Float32Array(3), vE2 = new Float32Array(3), vNormal = new Float32Array(3), lightDir = new Float32Array([0.2, 0.3, 1.0]);
    vec3.normalize(lightDir, lightDir);

    function frame(ctx, canvas, loop = true) {
        const state = store.getState();
        const { vertices, indices, camera, object, config } = state;
        const buffers = Pool.getBuffers();
        window.ENGINE.Renderer.clear(ctx, canvas.width, canvas.height, config.bg);

        if (state.camera.auto) { camera.orbitY += Config.AUTO_ROTATE_SPEED; }
        else {
            if (camera.velX && Math.abs(camera.velX) > 0.00001) { camera.orbitY += camera.velX; camera.velX *= 0.95; }
            if (camera.velY && Math.abs(camera.velY) > 0.00001) { camera.orbitX += camera.velY; camera.velY *= 0.95; }
            if (camera.panVelX && Math.abs(camera.panVelX) > 0.00001) { camera.target.x -= camera.panVelX; camera.panVelX *= 0.95; }
            if (camera.panVelY && Math.abs(camera.panVelY) > 0.00001) { camera.target.y += camera.panVelY; camera.panVelY *= 0.95; }
        }
        Camera.updateViewMatrix(mView, camera, config);

        if (config.showGrid) {
            MathOps.transformBuffer(gridOut, gridPoints, mView, gridPoints.length / 3);
            MathOps.projectBuffer(gridOut, gridPoints.length / 3, canvas.width, canvas.height, config.fov * 400);
            ctx.strokeStyle = "rgba(100, 100, 100, 0.4)"; ctx.lineWidth = 1; ctx.beginPath();
            for (let i = 0; i < gridOut.length / 8; i++) {
                let i8 = i * 8; if (gridOut[i8 + 3] > 0 && gridOut[i8 + 7] > 0) { ctx.moveTo(gridOut[i8], gridOut[i8 + 1]); ctx.lineTo(gridOut[i8 + 4], gridOut[i8 + 5]); }
            }
            ctx.stroke();
            MathOps.transformBuffer(rulerOut, rulerPoints, mView, 10 * 2);
            MathOps.projectBuffer(rulerOut, 10 * 2, canvas.width, canvas.height, config.fov * 400);
            Rasterizer.drawRuler(ctx, rulerOut);
        }

        if (!vertices || !indices) {
            if (loop) requestAnimationFrame(() => frame(ctx, canvas));
            return;
        }

        mat4.identity(mModel);
        mat4.translate(mModel, mModel, object.pos);
        RotCache.rotateX(mModel, mModel, object.rot.x); RotCache.rotateY(mModel, mModel, object.rot.y); RotCache.rotateZ(mModel, mModel, object.rot.z);
        mat4.scale(mModel, mModel, object.scl);
        mat4.multiply(mTotal, mView, mModel);

        const vCount = vertices.length / 3, fCount = indices.length / 3;
        MathOps.transformBuffer(buffers.world, vertices, mTotal, vCount);
        buffers.screen.set(buffers.world.subarray(0, vCount * 4));
        MathOps.projectBuffer(buffers.screen, vCount, canvas.width, canvas.height, config.fov * 400);

        const useGL = window.ENGINE.isGL && config.hardwareMode === 'GPU';
        if (useGL) {
            mat4.perspective(mProj, config.fov * Math.PI / 180, canvas.width / canvas.height, 0.1, 1000.0);
            window.ENGINE.GL.render(vertices, indices, mTotal, mProj, config);
        } else if (config.viewMode !== 'POINTS') {
            const world = buffers.world, screen = buffers.screen, depths = buffers.depth, sIdx = buffers.sortIndices, intensities = buffers.intensity;
            const isWire = config.viewMode === 'WIRE';
            let validFaces = 0;
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
            if (validFaces > 0) {
                const sorted = MathOps.radixSort(sIdx, depths, validFaces, buffers.auxIndices, buffers.auxDepth, buffers.radixCounts);
                Rasterizer.drawFaces(ctx, buffers, sorted, indices, validFaces, config, object.edges);
            }
        } else {
            Rasterizer.drawPoints(ctx, buffers.screen, vCount, config);
        }

        // --- GIZMO & SELECTION RENDERING ---
        const GR = window.ENGINE.GizmoRenderer;
        const mode = state.ui.transformMode.toUpperCase();
        const fovScale = config.fov * 400;
        const origin = [object.pos.x, object.pos.y, object.pos.z];

        // Draw hover outline when hovering over object (works in ALL modes)
        if (!useGL && GR && state.ui.hoveredObjectId && !state.ui.selectedObjectId && buffers && buffers.screen) {
            GR.drawHoverOutline(ctx, buffers.screen, indices, fCount, '#66ccff');
        }

        // Draw origin circle when object is selected (SELECT mode only for the circle)
        if (mode === 'SELECT' && !useGL && GR && state.ui.selectedObjectId) {
            GR.drawSelectionOutline(ctx, origin, mView, canvas.width, canvas.height, fovScale);
        }

        // Draw transform gizmos ONLY when object is selected AND in TRANSLATE/ROTATE/SCALE modes
        if (GR && state.ui.selectedObjectId && (mode === 'TRANSLATE' || mode === 'ROTATE' || mode === 'SCALE')) {
            const hoveredAxis = state.ui.hoveredAxis;
            const dragAxis = state.ui.dragAxis;
            const space = state.ui.transformSpace;
            const objectRot = object.rot;
            const cameraOrbitY = camera.orbitY;

            if (mode === 'TRANSLATE') {
                window.ENGINE.gizmoHitZones = GR.drawTranslate(ctx, origin, mView, canvas.width, canvas.height, fovScale, objectRot, cameraOrbitY, space, hoveredAxis, dragAxis);
            } else if (mode === 'ROTATE') {
                window.ENGINE.gizmoHitZones = GR.drawRotate(ctx, origin, mView, canvas.width, canvas.height, fovScale, objectRot, cameraOrbitY, space, hoveredAxis, dragAxis);
            } else if (mode === 'SCALE') {
                window.ENGINE.gizmoHitZones = GR.drawScale(ctx, origin, mView, canvas.width, canvas.height, fovScale, objectRot, cameraOrbitY, space, hoveredAxis, dragAxis);
            }
        } else {
            window.ENGINE.gizmoHitZones = [];
        }

        if (loop) requestAnimationFrame(() => frame(ctx, canvas));
    }
    return { frame, update: (ctx, canvas) => frame(ctx, canvas, false) };
})();
