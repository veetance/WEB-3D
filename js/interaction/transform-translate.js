/**
 * VEETANCE Transform: Translate Manifold
 * Surgical precision for 1:1 view-space unprojection and axis-locked movement.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.TransformTranslate = (function () {
    return {
        handle: (mx, my, state, canvas, dragStartPos, dragStartViewZ, dragStartOffset) => {
            const selectedEntity = state.entities.find(e => e.id === state.selectedEntityId);
            if (!selectedEntity) return dragStartPos;
            const pos = { ...selectedEntity.pos };
            const objectRot = selectedEntity.rot;
            const fovScale = state.config.fov * 13.33;
            const dpr = window.devicePixelRatio || 1;
            const lw = canvas.width / dpr, lh = canvas.height / dpr;
            const dragAxis = state.ui.dragAxis;

            const mView = window.ENGINE.MathOps.mat4.create();
            window.ENGINE.Camera.updateViewMatrix(mView, state.camera, state.config);

            if (dragAxis === 'xyz') {
                // --- ROW-BASIS BASIS PROJECTION (F.A.S.T. Engine Standard) ---
                // Extract World-Space Basis Vectors from View Matrix Rows
                const rx = mView[0], ry = mView[4], rz = mView[8]; // Screen Right
                const ux = mView[1], uy = mView[5], uz = mView[9]; // Screen Up

                // Calculate screen-to-world sensitivity based on depth (Z)
                const sensitivity = (-dragStartViewZ) / fovScale;

                // Track mouse displacement from center
                const dx = (mx - lw * 0.5);
                const dy = (my - lh * 0.5);

                // Project displacement back into world space
                const worldX = (rx * dx - ux * dy) * sensitivity;
                const worldY = (ry * dx - uy * dy) * sensitivity;
                const worldZ = (rz * dx - uz * dy) * sensitivity;

                const invView = window.ENGINE.MathOps.mat4.create();
                if (window.ENGINE.MathOps.mat4.invert(invView, mView)) {
                    // Origin point in world space at depth dragStartViewZ
                    const origin = [0, 0, 0, 1];
                    window.ENGINE.MathOps.mat4.transformVec4(origin, invView, [0, 0, dragStartViewZ, 1]);

                    pos.x = (origin[0] + worldX) - dragStartOffset.x;
                    pos.y = (origin[1] + worldY) - dragStartOffset.y;
                    pos.z = (origin[2] + worldZ) - dragStartOffset.z;
                }
            } else if (dragAxis === 'x' || dragAxis === 'y' || dragAxis === 'z') {
                // Relative Axis Projection using Row-Basis for 1:1 Precision
                const dir = window.ENGINE.GizmoRenderer.getAxisDirection(dragAxis, objectRot);
                const origin = [dragStartPos.x, dragStartPos.y, dragStartPos.z];
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
                // Multi-Axis Plane Delta
                const axis1 = dragAxis[0], axis2 = dragAxis[1];
                const dir1 = window.ENGINE.GizmoRenderer.getAxisDirection(axis1, objectRot);
                const dir2 = window.ENGINE.GizmoRenderer.getAxisDirection(axis2, objectRot);
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

            return pos;
        }
    };
})();
