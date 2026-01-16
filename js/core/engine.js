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

    // Z-AXIS PERIMETER RULER SYSTEM
    const rulerPoints = new Float32Array(10 * 2 * 3);
    const rulerOut = new Float32Array(10 * 2 * 4);
    const RX = 0, RY = -5, RZ = 0;
    const AS = 0.5;
    rulerPoints.fill(0);
    const bTipIdx = 6 * 6;
    rulerPoints[bTipIdx] = RX; rulerPoints[bTipIdx + 1] = RY - AS; rulerPoints[bTipIdx + 2] = RZ;
    rulerPoints[bTipIdx + 3] = RX - AS; rulerPoints[bTipIdx + 4] = RY; rulerPoints[bTipIdx + 5] = RZ;
    const bLeg2Idx = 7 * 6;
    rulerPoints[bLeg2Idx] = RX; rulerPoints[bLeg2Idx + 1] = RY - AS; rulerPoints[bLeg2Idx + 2] = RZ;
    rulerPoints[bLeg2Idx + 3] = RX + AS; rulerPoints[bLeg2Idx + 4] = RY; rulerPoints[bLeg2Idx + 5] = RZ;

    // DIEGETIC LOADING SPINNER (2 Nested Squares - Progressive Draw-On)
    // Outer: CW, Inner: CCW - Both on grid plane
    // Edges draw progressively from corners
    const spinnerSizeOuter = 1.0;  // 50% smaller
    const spinnerSizeInner = 0.6;  // 50% smaller
    // 8 edges total (4 per square) × 2 endpoints × 3 coords
    const spinnerPoints = new Float32Array(8 * 2 * 3);
    const spinnerOut = new Float32Array(8 * 2 * 4);
    // 8 corner points for dot rendering (4 outer + 4 inner)
    const cornerPoints = new Float32Array(8 * 3);
    const cornerOut = new Float32Array(8 * 4);

    // Helper to update spinner geometry with progressive edge drawing
    // angle: rotation angle
    // scale: scale factor (for shrink animation)
    // drawProgress: 0-1, how much of each edge is drawn (0 = dots only, 1 = full edges)
    function updateSpinnerGeometry(angle, scale, drawProgress) {
        if (scale <= 0) return;

        const dp = Math.min(1, Math.max(0, drawProgress));

        // Outer square (rotates CW)
        const cosO = Math.cos(angle) * scale;
        const sinO = Math.sin(angle) * scale;
        const sO = spinnerSizeOuter;
        const cornersOuter = [
            { x: -sO * cosO - sO * sinO, y: -sO * sinO + sO * cosO },
            { x: sO * cosO - sO * sinO, y: sO * sinO + sO * cosO },
            { x: sO * cosO + sO * sinO, y: sO * sinO - sO * cosO },
            { x: -sO * cosO + sO * sinO, y: -sO * sinO - sO * cosO }
        ];

        // Inner square (rotates CCW - opposite direction)
        const cosI = Math.cos(-angle * 1.5) * scale;
        const sinI = Math.sin(-angle * 1.5) * scale;
        const sI = spinnerSizeInner;
        const cornersInner = [
            { x: -sI * cosI - sI * sinI, y: -sI * sinI + sI * cosI },
            { x: sI * cosI - sI * sinI, y: sI * sinI + sI * cosI },
            { x: sI * cosI + sI * sinI, y: sI * sinI - sI * cosI },
            { x: -sI * cosI + sI * sinI, y: -sI * sinI - sI * cosI }
        ];

        // Store corner positions for dot rendering
        for (let i = 0; i < 4; i++) {
            cornerPoints[i * 3] = cornersOuter[i].x;
            cornerPoints[i * 3 + 1] = cornersOuter[i].y;
            cornerPoints[i * 3 + 2] = 0.05;
            cornerPoints[(i + 4) * 3] = cornersInner[i].x;
            cornerPoints[(i + 4) * 3 + 1] = cornersInner[i].y;
            cornerPoints[(i + 4) * 3 + 2] = 0.05;
        }

        const edges = [[0, 1], [1, 2], [2, 3], [3, 0]];

        // Outer square edges (indices 0-3) - progressive draw
        for (let i = 0; i < 4; i++) {
            const [a, b] = edges[i];
            const base = i * 6;
            const startX = cornersOuter[a].x;
            const startY = cornersOuter[a].y;
            const endX = cornersOuter[b].x;
            const endY = cornersOuter[b].y;

            // Interpolate end position based on drawProgress
            spinnerPoints[base] = startX;
            spinnerPoints[base + 1] = startY;
            spinnerPoints[base + 2] = 0.05;
            spinnerPoints[base + 3] = startX + (endX - startX) * dp;
            spinnerPoints[base + 4] = startY + (endY - startY) * dp;
            spinnerPoints[base + 5] = 0.05;
        }

        // Inner square edges (indices 4-7) - progressive draw
        for (let i = 0; i < 4; i++) {
            const [a, b] = edges[i];
            const base = (i + 4) * 6;
            const startX = cornersInner[a].x;
            const startY = cornersInner[a].y;
            const endX = cornersInner[b].x;
            const endY = cornersInner[b].y;

            // Interpolate end position based on drawProgress
            spinnerPoints[base] = startX;
            spinnerPoints[base + 1] = startY;
            spinnerPoints[base + 2] = 0.05;
            spinnerPoints[base + 3] = startX + (endX - startX) * dp;
            spinnerPoints[base + 4] = startY + (endY - startY) * dp;
            spinnerPoints[base + 5] = 0.05;
        }
    }


    const vE1 = new Float32Array(3), vE2 = new Float32Array(3), vNormal = new Float32Array(3), lightDir = new Float32Array([0.2, 0.3, 1.0]);
    vec3.normalize(lightDir, lightDir);

    let lastSCount = 0;
    let lastBudget = 0;
    let lastVerts = null;
    let wasWASMReady = false;
    let isRendering = false;

    async function frame(mainCtx, overlayCtx, canvas, loop = true) {
        if (isRendering) return;
        isRendering = true;

        try {
            const state = store.getState();
            const { vertices, indices, camera, object, config } = state;
            const cen = state.ui.centroid;

            if (!vertices || !indices) {
                isRendering = false;
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

            // --- Grid & Ruler ---
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
            // Pivot around centroid
            mat4.translate(mModel, mModel, {
                x: object.pos.x + cen.x,
                y: object.pos.y + cen.y,
                z: object.pos.z + cen.z
            });
            RotCache.rotateX(mModel, mModel, object.rot.x);
            RotCache.rotateY(mModel, mModel, object.rot.y);
            RotCache.rotateZ(mModel, mModel, object.rot.z);

            // Apply model reveal animation scale (with ease-out)
            const revealLinear = state.ui.modelRevealScale; // This is LINEAR progress (0-1)
            // Apply ease-out cubic for smooth deceleration
            const revealEased = 1 - Math.pow(1 - revealLinear, 3);
            // Clamp minimum scale to prevent depth sorting issues
            const revealScale = Math.max(0.01, revealEased);
            mat4.scale(mModel, mModel, {
                x: object.scl.x * revealScale,
                y: object.scl.y * revealScale,
                z: object.scl.z * revealScale
            });

            mat4.translate(mModel, mModel, { x: -cen.x, y: -cen.y, z: -cen.z });

            mat4.multiply(mTotal, mView, mModel);

            const WASM = window.ENGINE.RasterizerWASM;
            const useWASM = WASM && WASM.isReady();
            const fovScale = (canvas.height / 2) / Math.tan((config.fov * 0.5) * Math.PI / 180);

            // DIEGETIC LOADING SPINNER (2 Nested Orbital Squares - Progressive Draw-On)
            const { isLoading, loadingPhase, spinnerProgress } = state.ui;

            if (isLoading || loadingPhase < 2) {
                // Update animation state
                let newProgress = spinnerProgress + 0.06; // Faster animation
                let newPhase = loadingPhase;
                let spinnerScale = 1.0;

                // 90° (π/2) revolution for quick loads
                const ROTATION_TARGET = Math.PI / 2;

                // Edge growth completes in 90% of the rotation
                const drawProgress = Math.min(1, spinnerProgress / (ROTATION_TARGET * 0.9));

                // Phase 0: Spinning (complete 90° rotation)
                if (loadingPhase === 0 && newProgress >= ROTATION_TARGET) {
                    // WASM ready check — only advance if WASM is ready
                    if (useWASM) {
                        newPhase = 1; // Move to shrink phase
                        newProgress = 0;
                    }
                }

                // Phase 1: Shrinking (start reveal)
                if (loadingPhase === 1) {
                    spinnerScale = Math.max(0, 1 - newProgress * 3); // Fast spinner shrink

                    // Start model reveal (will continue in phase 2)
                    // Don't dispatch here - let phase 2 handle the timed reveal

                    if (spinnerScale <= 0) {
                        newPhase = 2; // Done with spinner, reveal continues
                        store.dispatch({ type: 'FINISH_LOADING' });
                    }
                }

                // Only render spinner if phase < 2
                if (newPhase < 2 && spinnerScale > 0) {
                    const effectiveDrawProgress = loadingPhase === 1 ? 1 : drawProgress;
                    updateSpinnerGeometry(spinnerProgress, spinnerScale, effectiveDrawProgress);

                    // Transform edge points
                    MathOps.transformBuffer(spinnerOut, spinnerPoints, mView, 8 * 2);
                    MathOps.projectBuffer(spinnerOut, 8 * 2, canvas.width, canvas.height, config.fov * 13.33);

                    // Draw edges (progressive growth from invisible corners)
                    if (drawProgress > 0.01 || loadingPhase === 1) {
                        // Draw outer square edges
                        mainCtx.strokeStyle = config.fg || '#00ffd2';
                        mainCtx.lineWidth = 2;
                        mainCtx.beginPath();
                        for (let i = 0; i < 4; i++) {
                            const i8 = i * 8;
                            if (spinnerOut[i8 + 3] > 0 && spinnerOut[i8 + 7] > 0) {
                                mainCtx.moveTo(spinnerOut[i8], spinnerOut[i8 + 1]);
                                mainCtx.lineTo(spinnerOut[i8 + 4], spinnerOut[i8 + 5]);
                            }
                        }
                        mainCtx.stroke();

                        // Draw inner square edges (slightly dimmer)
                        mainCtx.strokeStyle = 'rgba(0, 255, 210, 0.5)';
                        mainCtx.lineWidth = 1.5;
                        mainCtx.beginPath();
                        for (let i = 4; i < 8; i++) {
                            const i8 = i * 8;
                            if (spinnerOut[i8 + 3] > 0 && spinnerOut[i8 + 7] > 0) {
                                mainCtx.moveTo(spinnerOut[i8], spinnerOut[i8 + 1]);
                                mainCtx.lineTo(spinnerOut[i8 + 4], spinnerOut[i8 + 5]);
                            }
                        }
                        mainCtx.stroke();
                    }
                }

                // Update store with new progress
                if (loadingPhase !== newPhase) {
                    store.dispatch({ type: 'SET_LOADING_PHASE', payload: newPhase });
                }
                store.dispatch({ type: 'UPDATE_SPINNER', payload: newProgress });
            }

            // TIME-BASED MODEL REVEAL (1.5 seconds)
            // Store LINEAR progress - easing applied at render time
            // 0.011 per frame at 60fps = ~90 frames = 1.5 seconds
            if ((loadingPhase === 1 || loadingPhase === 2) && revealLinear < 1) {
                const REVEAL_SPEED = 0.024; // 0.7 seconds at 60fps
                const newLinear = Math.min(1, revealLinear + REVEAL_SPEED);
                store.dispatch({ type: 'SET_MODEL_REVEAL_SCALE', payload: newLinear });
            }

            // GATE: Render geometry during crossfade (phase 1) and after (phase 2)
            const canRenderGeometry = loadingPhase >= 1;

            if (useWASM && config.viewMode !== 'POINTS' && canRenderGeometry) {
                const forceSync = !wasWASMReady;
                if (forceSync) wasWASMReady = true;

                // Force data sync when model changes 
                const modelChanged = lastVerts !== vertices || (lastVerts && lastVerts.length !== vertices.length);
                if (modelChanged || forceSync) {
                    lastVerts = vertices;
                    if (object.clusters) WASM.uploadClusters(object.clusters);
                }
                // ALWAYS upload indices to ensure they're synced
                WASM.uploadIndices(indices);

                const isWire = config.viewMode === 'WIRE';  // Only pure WIRE skips backface culling
                const isUV = config.viewMode === 'UV' || config.viewMode === 'NORMALS';

                // mViewModel = mView * mModel (Calculated above)
                WASM.processVertices(vertices, mTotal, vCount);
                WASM.project(vCount, canvas.width, canvas.height, fovScale);

                let validFaces = 0;
                if (false && object.clusters && object.clusters.length > 1 && fCount > 500000) {
                    // DISABLED: processClusters has issues, using processFaces for all models
                    validFaces = WASM.processClusters(mTotal, fCount, lightDir, isWire, isUV, canvas.width, canvas.height);
                } else {
                    validFaces = WASM.processFaces(fCount, lightDir, isWire, canvas.width, canvas.height, config.viewMode);
                }


                if (validFaces > 0) {
                    const sorted = WASM.sortFaces(validFaces);
                    const isPixelPath = config.viewMode === 'SOLID' || config.viewMode === 'SHADED_WIRE' || config.viewMode === 'UV' || config.viewMode === 'WIRE' || config.viewMode === 'NORMALS';
                    if (isPixelPath) {
                        WASM.clearHW(canvas.width, canvas.height);
                        if (isWire) {
                            const rawColor = config.fg || '#00ffd2';
                            const wasmColor = typeof rawColor === 'string' ?
                                (0xFF000000 | (parseInt(rawColor.slice(5, 7), 16) << 16) | (parseInt(rawColor.slice(3, 5), 16) << 8) | parseInt(rawColor.slice(1, 3), 16)) :
                                rawColor;
                            const density = config.wireDensity !== undefined ? config.wireDensity : 1.0;
                            WASM.renderWire(validFaces, wasmColor, canvas.width, canvas.height, density);
                        } else {
                            await WASM.render(mainCtx, validFaces, config, canvas.width, canvas.height, isUV);
                            // Add wireframe overlay for SHADED_WIRE mode
                            if (config.viewMode === 'SHADED_WIRE') {
                                const rawColor = config.fg || '#00ffd2';
                                const wasmColor = typeof rawColor === 'string' ?
                                    (0xFF000000 | (parseInt(rawColor.slice(5, 7), 16) << 16) | (parseInt(rawColor.slice(3, 5), 16) << 8) | parseInt(rawColor.slice(1, 3), 16)) :
                                    rawColor;
                                const density = config.wireDensity !== undefined ? config.wireDensity : 1.0;
                                WASM.renderWire(validFaces, wasmColor, canvas.width, canvas.height, density);
                            }
                        }
                        WASM.flush(mainCtx, canvas.width, canvas.height);
                    }
                }
            } else if (config.viewMode === 'POINTS' && canRenderGeometry) {
                // --- JS POINTS PATH (Only mode that works without WASM) ---
                MathOps.transformBuffer(buffers.world, vertices, mTotal, vCount);
                buffers.screen.set(buffers.world.subarray(0, vCount * 4));
                MathOps.projectBuffer(buffers.screen, vCount, canvas.width, canvas.height, fovScale);

                const sBudget = config.pointBudget || 20000;
                if (lastBudget !== sBudget || lastVerts !== vertices) {
                    lastBudget = sBudget; lastVerts = vertices;
                    lastSCount = MathOps.sampleSurfaceGrid(buffers.sampledWorld, vertices, indices, fCount, sBudget);
                }
                if (lastSCount > 0) {
                    MathOps.transformBuffer(buffers.sampledScreen, buffers.sampledWorld, mTotal, lastSCount);
                    MathOps.projectBuffer(buffers.sampledScreen, lastSCount, canvas.width, canvas.height, fovScale);
                    const RP = window.ENGINE.RasterizerPixel;
                    const lodStride = Math.max(1, Math.floor(400 / Math.max(10, fovScale)));
                    RP.clearHW(canvas.width, canvas.height);
                    RP.renderPoints(mainCtx, buffers.sampledScreen, lastSCount, config, canvas.width, canvas.height, lodStride);
                    RP.flush(mainCtx, canvas.width, canvas.height);
                }
            }
            // WASM not ready and not POINTS mode - skip geometry rendering
            // (Grid and Gizmos still render)

            // --- GIZMOS ---
            const GR = window.ENGINE.GizmoRenderer;
            const mode = state.ui.transformMode.toUpperCase();
            const origin = [object.pos.x + cen.x, object.pos.y + cen.y, object.pos.z + cen.z];
            if (overlayCtx) {
                if (GR && state.ui.hoveredObjectId && !state.ui.selectedObjectId && fCount < 10000) {
                    GR.drawHoverOutline(overlayCtx, buffers.screen, indices, fCount, '#66ccff');
                }
                if (mode === 'SELECT' && GR && state.ui.selectedObjectId) {
                    GR.drawSelectionOutline(overlayCtx, origin, mView, canvas.width, canvas.height, fovScale);
                }
                if (GR && state.ui.selectedObjectId && (mode === 'TRANSLATE' || mode === 'ROTATE' || mode === 'SCALE')) {
                    const objectRot = object.rot;
                    if (mode === 'TRANSLATE') window.ENGINE.gizmoHitZones = GR.drawTranslate(overlayCtx, origin, mView, canvas.width, canvas.height, fovScale, objectRot, state.ui.hoveredAxis, state.ui.dragAxis);
                    else if (mode === 'ROTATE') window.ENGINE.gizmoHitZones = GR.drawRotate(overlayCtx, origin, mView, canvas.width, canvas.height, fovScale, objectRot, state.ui.hoveredAxis, state.ui.dragAxis);
                    else if (mode === 'SCALE') window.ENGINE.gizmoHitZones = GR.drawScale(overlayCtx, origin, mView, canvas.width, canvas.height, fovScale, objectRot, state.ui.hoveredAxis, state.ui.dragAxis);
                } else {
                    window.ENGINE.gizmoHitZones = [];
                }
            }
        } catch (e) {
            console.error("VEETANCE Critical Frame Manifold Breach:", e);
        } finally {
            isRendering = false;
            if (loop) requestAnimationFrame(() => frame(mainCtx, overlayCtx, canvas));
        }
    }

    return { frame, update: (mainCtx, overlayCtx, canvas) => frame(mainCtx, overlayCtx, canvas, false) };
})();
