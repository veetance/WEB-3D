/**
 * VEETANCE Transform: Scale Manifold
 * Projected axis scaling with surgical magnitude calculation.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.TransformScale = (function () {
    return {
        handle: (dx, dy, state, canvas) => {
            const selectedEntity = state.entities.find(e => e.id === state.selectedEntityId);
            if (!selectedEntity) return { x: 1, y: 1, z: 1 };
            const scaleSensitivity = 0.05;
            const scl = { ...selectedEntity.scl };
            const objectRot = selectedEntity.rot;
            const objectPos = selectedEntity.pos;
            const dragAxis = state.ui.dragAxis;
            const fovScale = state.config.fov * 13.33;

            const mView = window.ENGINE.MathOps.mat4.create();
            window.ENGINE.Camera.updateViewMatrix(mView, state.camera, state.config);

            if (dragAxis === 'x' || dragAxis === 'y' || dragAxis === 'z') {
                const dpr = window.devicePixelRatio || 1;
                const lw = canvas.width / dpr, lh = canvas.height / dpr;
                const dir = window.ENGINE.GizmoRenderer.getAxisDirection(dragAxis, objectRot);
                const origin = [objectPos.x, objectPos.y, objectPos.z];
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

            return scl;
        }
    };
})();
