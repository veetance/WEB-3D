/**
 * VEETANCE Interaction Controls (Mouse/Touch)
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Controls = {
    init: (canvas) => {
        const store = window.ENGINE.Store;
        let isDragging = false;
        let isPanning = false; // Right click
        let lastX = 0;
        let lastY = 0;
        let lastDx = 0;
        let lastDy = 0;

        // Disable Context Menu for Right Click
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        canvas.addEventListener('mousedown', e => {
            lastX = e.clientX;
            lastY = e.clientY;
            lastDx = 0; lastDy = 0;

            if (e.button === 2) { // Right Click
                isPanning = true;
            } else { // Left Click (or others)
                isDragging = true;
            }

            store.dispatch({ type: 'SET_INTERACTING', payload: true });
            // Stop drift
            store.dispatch({ type: 'UPDATE_CAMERA', payload: { velX: 0, velY: 0 } });
        });

        window.addEventListener('mouseup', () => {
            if (isDragging || isPanning) {
                const wasDragging = isDragging;
                const wasPanning = isPanning;
                isDragging = false;
                isPanning = false;
                store.dispatch({ type: 'SET_INTERACTING', payload: false });

                // Inertia Throw
                const state = store.getState();

                if (wasDragging && state.ui.transformMode === 'ORBIT') {
                    const sensitivity = 0.00001; // Extremely low drag
                    store.dispatch({
                        type: 'UPDATE_CAMERA',
                        payload: {
                            velX: lastDx * sensitivity,
                            velY: lastDy * sensitivity
                        }
                    });
                }

                if (wasPanning) {
                    // Pan Velocity Kick
                    // Scale force by zoom to match drag feel
                    const zoomScale = state.camera.zoom * 0.002;
                    // Rotate velocity by azimuth
                    const azimuth = state.camera.orbitY;
                    const cos = Math.cos(azimuth);
                    const sin = Math.sin(azimuth);
                    // Impulse Factor (High for slide)
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

        window.addEventListener('mousemove', e => {
            if (!isDragging && !isPanning) return;

            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            // Track for Inertia
            lastDx = dx;
            lastDy = dy;

            const state = store.getState();

            // PANNING (Right Click)
            if (isPanning) {
                // Scale pan speed with Zoom (further = faster)
                const panSpeed = state.camera.zoom * 0.002;

                // Rotate the delta by the camera's azimuth (orbitY)
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
                            y: state.camera.target.y + dY_World, // World Y is Up? Screen Y is Down.
                            z: state.camera.target.z
                        }
                    }
                });
                return;
            }

            const mode = state.ui.transformMode;

            if (mode === 'ORBIT') {
                const sensitivity = 0.01;
                store.dispatch({
                    type: 'UPDATE_CAMERA',
                    payload: {
                        orbitY: state.camera.orbitY + dx * sensitivity,
                        orbitX: state.camera.orbitX + dy * sensitivity
                    }
                });
            }
            else if (mode === 'ROTATE') {
                const sensitivity = 0.01;
                store.dispatch({
                    type: 'UPDATE_OBJECT',
                    payload: {
                        rot: {
                            x: state.object.rot.x + dy * sensitivity,
                            y: state.object.rot.y + dx * sensitivity,
                            z: state.object.rot.z
                        }
                    }
                });
            }
            // Add other modes as needed
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
