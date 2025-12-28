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

            // If object is selected AND in gizmo mode, also check gizmo axis hover
            if (state.ui.selectedObjectId && hitZones && HitTest &&
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
                        }
                    }
                    // Clicking empty space does nothing - gizmo stays active
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

                // Inertia for orbit
                if (wasDragging && !state.ui.dragAxis) {
                    const sensitivity = 0.00001;
                    store.dispatch({
                        type: 'UPDATE_CAMERA',
                        payload: {
                            velX: lastDx * sensitivity,
                            velY: lastDy * sensitivity
                        }
                    });
                }

                // Pan inertia
                if (wasPanning) {
                    const zoomScale = state.camera.zoom * 0.002;
                    const azimuth = state.camera.orbitY;
                    const cos = Math.cos(azimuth);
                    const sin = Math.sin(azimuth);
                    const impulse = 0.05;

                    store.dispatch({
                        type: 'UPDATE_CAMERA',
                        payload: {
                            panVelX: (lastDx * cos - lastDy * sin) * zoomScale * impulse,
                            panVelY: (lastDx * sin + lastDy * cos) * zoomScale * impulse
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

            // PANNING (Right Click)
            if (isPanning) {
                const panSpeed = state.camera.zoom * 0.002;
                const azimuth = state.camera.orbitY;
                const cos = Math.cos(azimuth);
                const sin = Math.sin(azimuth);

                const dX_World = (dx * cos - dy * sin) * panSpeed;
                const dY_World = (dx * sin + dy * cos) * panSpeed;

                store.dispatch({
                    type: 'UPDATE_CAMERA',
                    payload: {
                        target: {
                            x: state.camera.target.x - dX_World,
                            y: state.camera.target.y + dY_World,
                            z: state.camera.target.z
                        }
                    }
                });
                return;
            }

            const mode = state.ui.transformMode.toUpperCase();
            const dragAxis = state.ui.dragAxis;
            const space = state.ui.transformSpace;

            // Orbit camera if no axis locked
            if (!dragAxis) {
                const sensitivity = 0.01;
                store.dispatch({
                    type: 'UPDATE_CAMERA',
                    payload: {
                        orbitY: state.camera.orbitY + dx * sensitivity,
                        orbitX: state.camera.orbitX + dy * sensitivity
                    }
                });
                return;
            }

            // TRANSLATION - Intuitive mapping:
            // Drag RIGHT = +X, Drag UP = +Y, Drag UP (on Z) = +Z
            const speed = 0.015;

            if (mode === 'TRANSLATE') {
                const pos = { ...state.object.pos };

                if (dragAxis === 'xyz') {
                    // Free XYZ: View Plane movement using Camera Right & Up vectors
                    const az = state.camera.orbitY;
                    const el = state.camera.orbitX;

                    // Camera Right Vector (XZ plane)
                    const Rx = Math.cos(az);
                    const Rz = -Math.sin(az);

                    // Camera Up Vector (Perpendicular to Look & Right)
                    // Up = Right x Forward
                    // U = (-sin(az)*sin(el), cos(el), -cos(az)*sin(el))
                    const Ux = -Math.sin(az) * Math.sin(el);
                    const Uy = Math.cos(el);
                    const Uz = -Math.cos(az) * Math.sin(el);

                    // Apply Movement: Right * dx + Up * (-dy)
                    // Note: dy is positive down, so -dy is up
                    // Flipped signs to match mouse direction
                    pos.x -= (Rx * dx - Ux * dy) * speed;
                    pos.y -= (-Uy * dy) * speed;
                    pos.z -= (Rz * dx - Uz * dy) * speed;
                } else if (dragAxis === 'xy') {
                    // XY plane: X (red) + Y (green)
                    pos.x += dy * speed;  // X on vertical drag (flipped)
                    pos.y += dx * speed;  // Y on horizontal drag (works)
                } else if (dragAxis === 'xz') {
                    // XZ plane: X (red) + Z (blue) - horizontal=X, vertical=Z
                    pos.x -= dx * speed;  // Match X axis direction
                    pos.z -= dy * speed;  // Match Z axis direction
                } else if (dragAxis === 'yz') {
                    // YZ plane: Y (green) + Z (blue) - vertical=Z, horizontal=Y
                    pos.y += dx * speed;  // Y on horizontal drag (flipped)
                    pos.z -= dy * speed;  // Z on vertical drag (up = forward)
                } else if (dragAxis === 'x') {
                    // X axis: pull direction = +X
                    pos.x -= (dx - dy) * speed;
                } else if (dragAxis === 'y') {
                    // Y axis: pull up = +Y (same pattern as Z which works)
                    pos.y += (dx - dy) * speed;
                } else if (dragAxis === 'z') {
                    // Z axis: pull up = +Z (this works)
                    pos.z -= (dx + dy) * speed;
                }
                store.dispatch({ type: 'UPDATE_OBJECT', payload: { pos } });
            }
            else if (mode === 'ROTATE') {
                const sensitivity = 0.01;
                const rotDelta = (dx + dy) * sensitivity;
                const rot = { ...state.object.rot };
                if (dragAxis === 'x') rot.x += rotDelta;
                else if (dragAxis === 'y') rot.y += rotDelta;
                else if (dragAxis === 'z') rot.z += rotDelta;
                store.dispatch({ type: 'UPDATE_OBJECT', payload: { rot } });
            }
            else if (mode === 'SCALE') {
                const sensitivity = 0.01;
                const scaleDelta = (dx + dy) * sensitivity;
                const scl = { ...state.object.scl };
                if (dragAxis === 'x') scl.x = Math.max(0.1, scl.x + scaleDelta);
                else if (dragAxis === 'y') scl.y = Math.max(0.1, scl.y + scaleDelta);
                else if (dragAxis === 'z') scl.z = Math.max(0.1, scl.z + scaleDelta);
                store.dispatch({ type: 'UPDATE_OBJECT', payload: { scl } });
            }
        });

        // Scroll Zoom
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const state = store.getState();
            const sensitivity = 0.005;
            let newZoom = state.camera.zoom + e.deltaY * sensitivity;
            newZoom = Math.max(0.1, Math.min(20, newZoom));

            store.dispatch({
                type: 'UPDATE_CAMERA',
                payload: { zoom: newZoom }
            });
        }, { passive: false });
    }
};
