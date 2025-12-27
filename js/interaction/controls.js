/**
 * VEETANCE Interaction Controls (Mouse/Touch)
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Controls = {
    init: (canvas) => {
        const store = window.ENGINE.Store;
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        canvas.addEventListener('mousedown', e => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            store.dispatch({ type: 'SET_INTERACTING', payload: true });
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                store.dispatch({ type: 'SET_INTERACTING', payload: false });
            }
        });

        window.addEventListener('mousemove', e => {
            if (!isDragging) return;

            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            const state = store.getState();
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
