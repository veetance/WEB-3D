/**
 * VEETANCE Interaction Controls (Mouse/Touch)
 * Bespoke gizmo interaction with hover detection and axis locking.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Controls = {
    init: (canvas) => {
        const store = window.ENGINE.Store;
        let isDragging = false;
        let isPanning = false;
        let lastX = 0;
        let lastY = 0;
        let lastDx = 0;
        let lastDy = 0;

        // Drag Lock State
        let dragStartPos = { x: 0, y: 0, z: 0 };
        let dragStartViewZ = 0;
        let dragStartOffset = { a: 0, b: 0, x: 0, y: 0, z: 0 };

        // Disable Context Menu for Right Click
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        // HOVER DETECTION (mousemove without dragging)
        canvas.addEventListener('mousemove', e => {
            if (isDragging || isPanning) return;

            const state = store.getState();
            const mode = state.ui.transformMode.toUpperCase();
            const hitZones = window.ENGINE.gizmoHitZones;
            const HitTest = window.ENGINE.GizmoHitTest;

            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            // ALWAYS detect object hover (for selection in any mode)
            const screenBuffer = window.ENGINE.Pool?.getBuffers()?.screen;
            const indices = state.indices;
            let isOverObject = false;

            if (screenBuffer && indices) {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                const vCount = state.vertices ? state.vertices.length / 3 : 0;
                for (let i = 0; i < vCount; i++) {
                    const x = screenBuffer[i * 4];
                    const y = screenBuffer[i * 4 + 1];
                    const w = screenBuffer[i * 4 + 3];
                    if (w > 0) {
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y);
                    }
                }
                isOverObject = mx >= minX && mx <= maxX && my >= minY && my <= maxY;
            }

            const currentHovered = state.ui.hoveredObjectId;
            const newHovered = isOverObject ? 'main' : null;
            if (currentHovered !== newHovered) {
                store.dispatch({ type: 'SET_HOVERED_OBJECT', payload: newHovered });
            }

            // 3. FRONT ARROW HOVER
            const screenArrow = window.ENGINE.frontArrowScreen;
            let isOverArrow = false;
            if (screenArrow) {
                const dist = Math.sqrt((mx - screenArrow.x) ** 2 + (my - screenArrow.y) ** 2);
                isOverArrow = dist < 25; // Professional Proximity Radius
            }
            if (isOverArrow !== state.ui.hoveredFrontArrow) {
                store.dispatch({ type: 'SET_HOVERED_FRONT_ARROW', payload: isOverArrow });
            }

            if (isOverArrow) {
                canvas.style.cursor = 'help';
            } else if (state.ui.selectedObjectId && hitZones && HitTest &&
                (mode === 'TRANSLATE' || mode === 'ROTATE' || mode === 'SCALE')) {
                let hovered = null;
                if (mode === 'TRANSLATE') hovered = HitTest.testTranslate(mx, my, hitZones);
                else if (mode === 'ROTATE') hovered = HitTest.testRotate(mx, my, hitZones);
                else if (mode === 'SCALE') hovered = HitTest.testScale(mx, my, hitZones);

                if (hovered !== state.ui.hoveredAxis) {
                    store.dispatch({ type: 'SET_HOVERED_AXIS', payload: hovered });
                }
                canvas.style.cursor = hovered ? 'pointer' : (isOverObject ? 'pointer' : 'grab');
            } else {
                canvas.style.cursor = isOverObject ? 'pointer' : 'default';
            }
        });

        // MOUSEDOWN - Lock axis if hovering on gizmo
        canvas.addEventListener('mousedown', e => {
            const rect = canvas.getBoundingClientRect();
            lastX = e.clientX;
            lastY = e.clientY;
            lastDx = 0;
            lastDy = 0;

            if (e.button === 2) {
                isPanning = true;
            } else {
                isDragging = true;

                const state = store.getState();
                const mode = state.ui.transformMode.toUpperCase();
                const hitZones = window.ENGINE.gizmoHitZones;
                const HitTest = window.ENGINE.GizmoHitTest;
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;

                // SELECT mode: click to select object
                if (mode === 'SELECT') {
                    const hoveredObj = state.ui.hoveredObjectId;
                    if (hoveredObj) {
                        store.dispatch({ type: 'SET_SELECTED_OBJECT', payload: hoveredObj });
                        // Auto-activate Translate Gizmo on selection
                        store.dispatch({ type: 'SET_TRANSFORM_MODE', payload: 'TRANSLATE' });
                    } else {
                        store.dispatch({ type: 'SET_SELECTED_OBJECT', payload: null });
                    }
                }
                // Transform modes
                else if (mode === 'TRANSLATE' || mode === 'ROTATE' || mode === 'SCALE') {
                    const hoveredObj = state.ui.hoveredObjectId;

                    // If no object selected, select the hovered one first
                    if (!state.ui.selectedObjectId && hoveredObj) {
                        store.dispatch({ type: 'SET_SELECTED_OBJECT', payload: hoveredObj });
                    }
                    // If clicking a different object, select that one instead
                    else if (hoveredObj && hoveredObj !== state.ui.selectedObjectId) {
                        store.dispatch({ type: 'SET_SELECTED_OBJECT', payload: hoveredObj });
                    }
                    // If object is selected and clicking on gizmo, check for axis
                    else if (state.ui.selectedObjectId && hitZones && HitTest) {
                        let axis = null;
                        if (mode === 'TRANSLATE') axis = HitTest.testTranslate(mx, my, hitZones);
                        else if (mode === 'ROTATE') axis = HitTest.testRotate(mx, my, hitZones);
                        else if (mode === 'SCALE') axis = HitTest.testScale(mx, my, hitZones);

                        if (axis) {
                            store.dispatch({ type: 'SET_DRAG_AXIS', payload: axis });
                            canvas.style.cursor = 'grabbing';

                            // Initialize Drag Lock Manifest (DPI Aware)
                            const obj = state.object;
                            dragStartPos = { ...obj.pos };

                            const dpr = window.devicePixelRatio || 1;
                            const lw = canvas.width / dpr, lh = canvas.height / dpr;

                            const mView = window.ENGINE.MathOps.mat4.create();
                            window.ENGINE.Camera.updateViewMatrix(mView, state.camera, state.config);
                            const cen = state.ui.centroid;
                            const pView = [0, 0, 0, 1];
                            const pWorld = [obj.pos.x + cen.x, obj.pos.y + cen.y, obj.pos.z + cen.z, 1];
                            window.ENGINE.MathOps.mat4.transformVec4(pView, mView, pWorld);
                            dragStartViewZ = pView[2];

                            // --- CAPTURE INITIAL OFFSET TO PREVENT SNAPPING ---
                            const fovScale = state.config.fov * 13.33;
                            if (mode === 'TRANSLATE') {
                                if (axis === 'xyz') {
                                    const tx = (mx - lw * 0.5) * (-dragStartViewZ) / fovScale;
                                    const ty = -(my - lh * 0.5) * (-dragStartViewZ) / fovScale;
                                    const invView = window.ENGINE.MathOps.mat4.create();
                                    if (window.ENGINE.MathOps.mat4.invert(invView, mView)) {
                                        const tWorld = [0, 0, 0, 1];
                                        window.ENGINE.MathOps.mat4.transformVec4(tWorld, invView, [tx, ty, dragStartViewZ, 1]);
                                        dragStartOffset.x = tWorld[0] - (obj.pos.x + cen.x);
                                        dragStartOffset.y = tWorld[1] - (obj.pos.y + cen.y);
                                        dragStartOffset.z = tWorld[2] - (obj.pos.z + cen.z);
                                    }
                                } else if (axis === 'x' || axis === 'y' || axis === 'z') {
                                    const dir = window.ENGINE.GizmoRenderer.getAxisDirection(axis, obj.rot);
                                    const p0 = window.ENGINE.GizmoRenderer.projectPoint([obj.pos.x + cen.x, obj.pos.y + cen.y, obj.pos.z + cen.z], mView, lw, lh, fovScale);
                                    const p1 = window.ENGINE.GizmoRenderer.projectPoint([obj.pos.x + cen.x + dir[0], obj.pos.y + cen.y + dir[1], obj.pos.z + cen.z + dir[2]], mView, lw, lh, fovScale);
                                    if (p0 && p1) {
                                        const vAxis = { x: p1.x - p0.x, y: p1.y - p0.y };
                                        const magSq = vAxis.x * vAxis.x + vAxis.y * vAxis.y;
                                        dragStartOffset.a = (magSq > 0.0001) ? ((mx - p0.x) * vAxis.x + (my - p0.y) * vAxis.y) / magSq : 0;
                                    }
                                } else if (axis === 'xy' || axis === 'xz' || axis === 'yz') {
                                    const dir1 = window.ENGINE.GizmoRenderer.getAxisDirection(axis[0], obj.rot);
                                    const dir2 = window.ENGINE.GizmoRenderer.getAxisDirection(axis[1], obj.rot);
                                    const p0 = window.ENGINE.GizmoRenderer.projectPoint([obj.pos.x + cen.x, obj.pos.y + cen.y, obj.pos.z + cen.z], mView, lw, lh, fovScale);
                                    const p1 = window.ENGINE.GizmoRenderer.projectPoint([obj.pos.x + cen.x + dir1[0], obj.pos.y + cen.y + dir1[1], obj.pos.z + cen.z + dir1[2]], mView, lw, lh, fovScale);
                                    const p2 = window.ENGINE.GizmoRenderer.projectPoint([obj.pos.x + cen.x + dir2[0], obj.pos.y + cen.y + dir2[1], obj.pos.z + cen.z + dir2[2]], mView, lw, lh, fovScale);
                                    if (p0 && p1 && p2) {
                                        const s1 = { x: p1.x - p0.x, y: p1.y - p0.y }, s2 = { x: p2.x - p0.x, y: p2.y - p0.y };
                                        const det = s1.x * s2.y - s1.y * s2.x;
                                        if (Math.abs(det) > 0.001) {
                                            dragStartOffset.a = ((mx - p0.x) * s2.y - (my - p0.y) * s2.x) / det;
                                            dragStartOffset.b = (s1.x * (my - p0.y) - s1.y * (mx - p0.x)) / det;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            store.dispatch({ type: 'SET_INTERACTING', payload: true });
            store.dispatch({ type: 'UPDATE_CAMERA', payload: { velX: 0, velY: 0 } });
        });

        // MOUSEUP - Clear drag axis
        window.addEventListener('mouseup', () => {
            if (isDragging || isPanning) {
                const wasDragging = isDragging;
                const wasPanning = isPanning;
                isDragging = false;
                isPanning = false;

                store.dispatch({ type: 'SET_INTERACTING', payload: false });
                store.dispatch({ type: 'SET_DRAG_AXIS', payload: null });
                canvas.style.cursor = 'grab';

                const state = store.getState();

                // Inertia for orbit (Conditional on Auto-Rotate)
                if (wasDragging && !state.ui.dragAxis && state.config.auto) {
                    const sensitivity = 0.0004;
                    store.dispatch({
                        type: 'UPDATE_CAMERA',
                        payload: {
                            velX: lastDx * sensitivity,
                            velY: lastDy * sensitivity
                        }
                    });
                }

                // Pan inertia (Conditional on Auto-Rotate)
                if (wasPanning && state.config.auto) {
                    const sensitivity = 0.05;
                    const zoomScale = state.camera.zoom * 0.002;

                    const mView = window.ENGINE.MathOps.mat4.create();
                    window.ENGINE.Camera.updateViewMatrix(mView, state.camera, state.config);

                    // Extract View-Plane Basis (Right and Up)
                    const rx = mView[0], ry = mView[4], rz = mView[8];
                    const ux = mView[1], uy = mView[5], uz = mView[9];

                    store.dispatch({
                        type: 'UPDATE_CAMERA',
                        payload: {
                            panVelX: (rx * lastDx - ux * lastDy) * zoomScale * sensitivity,
                            panVelY: (ry * lastDx - uy * lastDy) * zoomScale * sensitivity,
                            panVelZ: (rz * lastDx - uz * lastDy) * zoomScale * sensitivity
                        }
                    });
                }
            }
        });

        // MOUSEMOVE while dragging
        window.addEventListener('mousemove', e => {
            if (!isDragging && !isPanning) return;

            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            lastDx = dx;
            lastDy = dy;

            const state = store.getState();
            const mView = window.ENGINE.MathOps.mat4.create();
            window.ENGINE.Camera.updateViewMatrix(mView, state.camera, state.config);

            // PANNING (Right Click)
            if (isPanning) {
                const panSpeed = state.camera.zoom * 0.002;
                const rx = mView[0], ry = mView[4], rz = mView[8]; // View Right
                const ux = mView[1], uy = mView[5], uz = mView[9]; // View Up

                store.dispatch({
                    type: 'UPDATE_CAMERA',
                    payload: {
                        target: {
                            x: state.camera.target.x - (rx * dx - ux * dy) * panSpeed,
                            y: state.camera.target.y - (ry * dx - uy * dy) * panSpeed,
                            z: state.camera.target.z - (rz * dx - uz * dy) * panSpeed
                        }
                    }
                });
                return;
            }

            const mode = state.ui.transformMode.toUpperCase();
            const dragAxis = state.ui.dragAxis;

            // Orbit camera if no axis locked
            if (!dragAxis) {
                const orbitSensitivity = 0.01;
                store.dispatch({
                    type: 'UPDATE_CAMERA',
                    payload: {
                        orbitY: state.camera.orbitY + dx * orbitSensitivity,
                        orbitX: state.camera.orbitX + dy * orbitSensitivity
                    }
                });
                return;
            }

            if (mode === 'TRANSLATE') {
                const pos = { ...state.object.pos };
                const fovScale = state.config.fov * 13.33;
                const dpr = window.devicePixelRatio || 1;
                const lw = canvas.width / dpr, lh = canvas.height / dpr;
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;

                if (dragAxis === 'xyz') {
                    // --- ABSOLUTE 1:1 LOCKED DRAGGING (View-Space Unprojection) ---
                    const targetViewX = (mx - lw * 0.5) * (-dragStartViewZ) / fovScale;
                    const targetViewY = -(my - lh * 0.5) * (-dragStartViewZ) / fovScale;

                    const invView = window.ENGINE.MathOps.mat4.create();
                    if (window.ENGINE.MathOps.mat4.invert(invView, mView)) {
                        const targetWorldPos = [0, 0, 0, 1];
                        window.ENGINE.MathOps.mat4.transformVec4(targetWorldPos, invView, [targetViewX, targetViewY, dragStartViewZ, 1]);

                        // Apply displacement relative to start-offset and centroid
                        const cen = state.ui.centroid;
                        pos.x = targetWorldPos[0] - dragStartOffset.x - cen.x;
                        pos.y = targetWorldPos[1] - dragStartOffset.y - cen.y;
                        pos.z = targetWorldPos[2] - dragStartOffset.z - cen.z;
                    }
                } else if (dragAxis === 'x' || dragAxis === 'y' || dragAxis === 'z') {
                    // Relative Axis Projection: Zero-Snap Manifest
                    const dir = window.ENGINE.GizmoRenderer.getAxisDirection(dragAxis, state.object.rot);
                    const cen = state.ui.centroid;
                    const origin = [dragStartPos.x + cen.x, dragStartPos.y + cen.y, dragStartPos.z + cen.z];
                    const p0 = window.ENGINE.GizmoRenderer.projectPoint(origin, mView, lw, lh, fovScale);
                    const p1 = window.ENGINE.GizmoRenderer.projectPoint([origin[0] + dir[0], origin[1] + dir[1], origin[2] + dir[2]], mView, lw, lh, fovScale);

                    if (p0 && p1) {
                        const vAxis = { x: p1.x - p0.x, y: p1.y - p0.y };
                        const magSq = vAxis.x * vAxis.x + vAxis.y * vAxis.y;
                        if (magSq > 0.0001) {
                            const currentDot = ((mx - p0.x) * vAxis.x + (my - p0.y) * vAxis.y) / magSq;
                            const deltaValue = currentDot - dragStartOffset.a;
                            pos.x = dragStartPos.x + dir[0] * deltaValue;
                            pos.y = dragStartPos.y + dir[1] * deltaValue;
                            pos.z = dragStartPos.z + dir[2] * deltaValue;
                        }
                    }
                } else if (dragAxis === 'xy' || dragAxis === 'xz' || dragAxis === 'yz') {
                    // Multi-Axis Plane Delta: Surgical Precision
                    const axis1 = dragAxis[0], axis2 = dragAxis[1];
                    const dir1 = window.ENGINE.GizmoRenderer.getAxisDirection(axis1, state.object.rot);
                    const dir2 = window.ENGINE.GizmoRenderer.getAxisDirection(axis2, state.object.rot);
                    const origin = [dragStartPos.x, dragStartPos.y, dragStartPos.z];

                    const p0 = window.ENGINE.GizmoRenderer.projectPoint(origin, mView, lw, lh, fovScale);
                    const p1 = window.ENGINE.GizmoRenderer.projectPoint([origin[0] + dir1[0], origin[1] + dir1[1], origin[2] + dir1[2]], mView, lw, lh, fovScale);
                    const p2 = window.ENGINE.GizmoRenderer.projectPoint([origin[0] + dir2[0], origin[1] + dir2[1], origin[2] + dir2[2]], mView, lw, lh, fovScale);

                    if (p0 && p1 && p2) {
                        const s1 = { x: p1.x - p0.x, y: p1.y - p0.y }, s2 = { x: p2.x - p0.x, y: p2.y - p0.y };
                        const det = s1.x * s2.y - s1.y * s2.x;
                        if (Math.abs(det) > 0.001) {
                            const currentA = ((mx - p0.x) * s2.y - (my - p0.y) * s2.x) / det;
                            const currentB = (s1.x * (my - p0.y) - s1.y * (mx - p0.x)) / det;
                            const deltaA = currentA - dragStartOffset.a;
                            const deltaB = currentB - dragStartOffset.b;

                            pos.x = dragStartPos.x + dir1[0] * deltaA + dir2[0] * deltaB;
                            pos.y = dragStartPos.y + dir1[1] * deltaA + dir2[1] * deltaB;
                            pos.z = dragStartPos.z + dir1[2] * deltaA + dir2[2] * deltaB;
                        }
                    }
                }
                store.dispatch({ type: 'UPDATE_OBJECT', payload: { pos } });
            }
            else if (mode === 'ROTATE') {
                const rotSensitivity = 0.015;
                const rot = { ...state.object.rot };
                const mat = window.ENGINE.MathOps.mat4;

                if (dragAxis === 'x' || dragAxis === 'y' || dragAxis === 'z') {
                    const mObj = mat.create();
                    mat.fromEuler(mObj, rot.x, rot.y, rot.z);
                    const rotDelta = (dx + dy) * rotSensitivity;
                    const mDelta = mat.create();
                    mat.identity(mDelta);

                    if (dragAxis === 'x') mat.rotateX(mDelta, mDelta, rotDelta);
                    else if (dragAxis === 'y') mat.rotateY(mDelta, mDelta, rotDelta);
                    else if (dragAxis === 'z') mat.rotateZ(mDelta, mDelta, -rotDelta);

                    const mNew = mat.create();
                    mat.multiply(mNew, mObj, mDelta);
                    mat.getEuler(rot, mNew);
                } else if (dragAxis === 'screen') {
                    rot.z += (dx + dy) * rotSensitivity;
                }
                store.dispatch({ type: 'UPDATE_OBJECT', payload: { rot } });
            }
            else if (mode === 'SCALE') {
                const scaleSensitivity = 0.05;
                const scl = { ...state.object.scl };
                const fovScale = state.config.fov * 13.33;

                if (dragAxis === 'x' || dragAxis === 'y' || dragAxis === 'z') {
                    const dpr = window.devicePixelRatio || 1;
                    const lw = canvas.width / dpr, lh = canvas.height / dpr;
                    const dir = window.ENGINE.GizmoRenderer.getAxisDirection(dragAxis, state.object.rot);
                    const origin = [state.object.pos.x, state.object.pos.y, state.object.pos.z];
                    const p0 = window.ENGINE.GizmoRenderer.projectPoint(origin, mView, lw, lh, fovScale);
                    const p1 = window.ENGINE.GizmoRenderer.projectPoint(
                        [origin[0] + dir[0], origin[1] + dir[1], origin[2] + dir[2]],
                        mView, lw, lh, fovScale
                    );

                    if (p0 && p1) {
                        const v2x = p1.x - p0.x, v2y = p1.y - p0.y;
                        const magSq = v2x * v2x + v2y * v2y;
                        if (magSq > 0.0001) {
                            const dotValue = (dx * v2x + dy * v2y) / magSq;
                            const amount = dotValue * scaleSensitivity;
                            if (dragAxis === 'x') scl.x = Math.max(0.01, scl.x + amount);
                            else if (dragAxis === 'y') scl.y = Math.max(0.01, scl.y + amount);
                            else if (dragAxis === 'z') scl.z = Math.max(0.01, scl.z + amount);
                        }
                    }
                }
                store.dispatch({ type: 'UPDATE_OBJECT', payload: { scl } });
            }
        });

        // Scroll Zoom (Exponential for Professional Fluidity)
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const state = store.getState();
            // Geometric progression: Zoom speed scales with distance
            const zoomFactor = 1.1;
            const direction = e.deltaY > 0 ? 1 : -1;
            let newZoom = state.camera.zoom * Math.pow(zoomFactor, direction);

            newZoom = Math.max(0.1, Math.min(200, newZoom));

            store.dispatch({
                type: 'UPDATE_CAMERA',
                payload: { zoom: newZoom }
            });
        }, { passive: false });
    }
};
