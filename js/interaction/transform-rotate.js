/**
 * VEETANCE Transform: Rotate Manifold
 * Clean rebuild with verified Z-Up axis mappings.
 * Red (X) = Z-axis rotation (yaw/vertical spin)
 * Green (Y) = Y-axis rotation (pitch/forward tilt)
 * Blue (Z) = X-axis rotation (roll/right tilt)
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.TransformRotate = (function () {
    const quat = window.ENGINE.MathOps.quat;
    const vec3 = window.ENGINE.MathOps.vec3;

    /**
     * Ray-Plane Intersection
     */
    function rayPlaneIntersect(rayOrigin, rayDir, planePoint, planeNormal) {
        const denom = vec3.dot(planeNormal, rayDir);
        if (Math.abs(denom) < 0.0001) return null;

        const diff = [
            planePoint[0] - rayOrigin[0],
            planePoint[1] - rayOrigin[1],
            planePoint[2] - rayOrigin[2]
        ];
        const t = vec3.dot(diff, planeNormal) / denom;
        if (t < 0) return null;

        return [
            rayOrigin[0] + rayDir[0] * t,
            rayOrigin[1] + rayDir[1] * t,
            rayOrigin[2] + rayDir[2] * t
        ];
    }

    /**
     * Unproject mouse to 3D ray
     */
    function getMouseRay(mx, my, canvas, state) {
        const dpr = window.devicePixelRatio || 1;
        const lw = canvas.width / dpr, lh = canvas.height / dpr;
        const fovScale = state.config.fov * 13.33;

        const ndcX = (mx - lw * 0.5) / fovScale;
        const ndcY = -(my - lh * 0.5) / fovScale;

        const mView = window.ENGINE.MathOps.mat4.create();
        window.ENGINE.Camera.updateViewMatrix(mView, state.camera, state.config);
        const invView = window.ENGINE.MathOps.mat4.create();
        if (!window.ENGINE.MathOps.mat4.invert(invView, mView)) return null;

        const rayOrigin = [invView[12], invView[13], invView[14]];
        const rayDirView = [ndcX, ndcY, -1, 0];
        const rayDirWorld = [0, 0, 0, 0];
        window.ENGINE.MathOps.mat4.transformVec4(rayDirWorld, invView, rayDirView);
        const rayDir = [rayDirWorld[0], rayDirWorld[1], rayDirWorld[2]];
        vec3.normalize(rayDir, rayDir);

        return { origin: rayOrigin, dir: rayDir };
    }

    return {
        handle: (mx, my, state, canvas, dragStartPos, dragStartRot, dragStartOffset) => {
            const selectedEntity = state.entities.find(e => e.id === state.selectedEntityId);
            if (!selectedEntity) return dragStartRot;
            const rot = { ...selectedEntity.rot };
            const dragAxis = state.ui.dragAxis;

            if (dragAxis === 'x' || dragAxis === 'y' || dragAxis === 'z') {
                // --- AXIS-LOCKED ROTATION (Virtual Plane Method) ---

                // Map gizmo axis to world rotation axis (Z-Up Convention + User Swap)
                // Red (x) -> Local Z, Green (y) -> Local Y, Blue (z) -> Local X
                let localAxisKey = 'z';
                if (dragAxis === 'y') localAxisKey = 'y';
                else if (dragAxis === 'z') localAxisKey = 'x';

                const rotationAxis = window.ENGINE.GizmoRenderer.getAxisDirection(localAxisKey, dragStartRot);

                const ray = getMouseRay(mx, my, canvas, state);
                if (!ray) return rot;

                const planePoint = [dragStartPos.x, dragStartPos.y, dragStartPos.z];
                const currentPoint = rayPlaneIntersect(ray.origin, ray.dir, planePoint, rotationAxis);
                if (!currentPoint) return rot;

                // Calculate arm vectors
                // Safety: If initial intersection was missed, return current rot to prevent snap
                if (dragStartOffset.px === undefined) return rot;

                const arm1 = [
                    dragStartOffset.px - planePoint[0],
                    dragStartOffset.py - planePoint[1],
                    dragStartOffset.pz - planePoint[2]
                ];
                const arm2 = [
                    currentPoint[0] - planePoint[0],
                    currentPoint[1] - planePoint[1],
                    currentPoint[2] - planePoint[2]
                ];

                vec3.normalize(arm1, arm1);
                vec3.normalize(arm2, arm2);

                // Calculate angle
                const dotProduct = Math.max(-1, Math.min(1, vec3.dot(arm1, arm2)));
                let angle = Math.acos(dotProduct);

                // Determine direction
                const crossResult = [0, 0, 0];
                vec3.cross(crossResult, arm1, arm2);
                const direction = vec3.dot(crossResult, rotationAxis);
                if (direction < 0) angle = -angle;

                // User Request: Invert Green axis
                if (dragAxis === 'y') angle = -angle;

                // Apply quaternion rotation
                const startQuat = quat.create();
                quat.fromEuler(startQuat, dragStartRot.x, dragStartRot.y, dragStartRot.z);

                const deltaQuat = quat.create();
                quat.fromAxisAngle(deltaQuat, rotationAxis, angle);

                const newQuat = quat.create();
                quat.multiply(newQuat, deltaQuat, startQuat);
                quat.normalize(newQuat, newQuat);

                // --- SURGICAL PARITY: Convert to Matrix for Euler Extraction ---
                const mNew = window.ENGINE.MathOps.mat4.create();
                const q = newQuat, xq = q[0], yq = q[1], zq = q[2], wq = q[3];
                const x2 = xq + xq, y2 = yq + yq, z2 = zq + zq;
                const xx = xq * x2, xy = xq * y2, xz = xq * z2;
                const yy = yq * y2, yz = yq * z2, zz = zq * z2;
                const wx = wq * x2, wy = wq * y2, wz = wq * z2;

                mNew[0] = 1 - (yy + zz); mNew[1] = xy + wz; mNew[2] = xz - wy;
                mNew[4] = xy - wz; mNew[5] = 1 - (xx + zz); mNew[6] = yz + wx;
                mNew[8] = xz + wy; mNew[9] = yz - wx; mNew[10] = 1 - (xx + yy);

                window.ENGINE.MathOps.mat4.getEuler(rot, mNew);

            } else if (dragAxis === 'screen') {
                // --- SCREEN-SPACE ROLL (Uses captured object center) ---
                const cx = dragStartOffset.x;
                const cy = dragStartOffset.y;

                if (cx === undefined || cy === undefined) return rot;

                const currentAngle = Math.atan2(my - cy, mx - cx);
                let deltaAngle = currentAngle - dragStartOffset.a;

                if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
                if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

                const startQuat = quat.create();
                quat.fromEuler(startQuat, dragStartRot.x, dragStartRot.y, dragStartRot.z);

                const deltaQuat = quat.create();
                quat.fromAxisAngle(deltaQuat, [0, 0, 1], deltaAngle);

                const newQuat = quat.create();
                quat.multiply(newQuat, deltaQuat, startQuat);
                quat.normalize(newQuat, newQuat);

                // Matrix Parity Extraction
                const mNew = window.ENGINE.MathOps.mat4.create();
                const q = newQuat, xq = q[0], yq = q[1], zq = q[2], wq = q[3];
                const x2 = xq + xq, y2 = yq + yq, z2 = zq + zq;
                const xx = xq * x2, xy = xq * y2, xz = xq * z2;
                const yy = yq * y2, yz = yq * z2, zz = zq * z2;
                const wx = wq * x2, wy = wq * y2, wz = wq * z2;
                mNew[0] = 1 - (yy + zz); mNew[1] = xy + wz; mNew[2] = xz - wy;
                mNew[4] = xy - wz; mNew[5] = 1 - (xx + zz); mNew[6] = yz + wx;
                mNew[8] = xz + wy; mNew[9] = yz - wx; mNew[10] = 1 - (xx + yy);
                window.ENGINE.MathOps.mat4.getEuler(rot, mNew);

            } else if (dragAxis === 'trackball') {
                // --- FREE TRACKBALL ROTATION ---
                const dx = mx - dragStartOffset.mx;
                const dy = my - dragStartOffset.my;
                const sensitivity = 0.01;

                const startQuat = quat.create();
                quat.fromEuler(startQuat, dragStartRot.x, dragStartRot.y, dragStartRot.z);

                const qx = quat.create();
                quat.fromAxisAngle(qx, [1, 0, 0], dy * sensitivity);

                const qy = quat.create();
                quat.fromAxisAngle(qy, [0, 1, 0], dx * sensitivity);

                const qTemp = quat.create();
                quat.multiply(qTemp, qy, qx);

                const newQuat = quat.create();
                quat.multiply(newQuat, qTemp, startQuat);
                quat.normalize(newQuat, newQuat);

                // Matrix Parity Extraction
                const mNew = window.ENGINE.MathOps.mat4.create();
                const q = newQuat, xq = q[0], yq = q[1], zq = q[2], wq = q[3];
                const x2 = xq + xq, y2 = yq + yq, z2 = zq + zq;
                const xx = xq * x2, xy = xq * y2, xz = xq * z2;
                const yy = yq * y2, yz = yq * z2, zz = zq * z2;
                const wx = wq * x2, wy = wq * y2, wz = wq * z2;
                mNew[0] = 1 - (yy + zz); mNew[1] = xy + wz; mNew[2] = xz - wy;
                mNew[4] = xy - wz; mNew[5] = 1 - (xx + zz); mNew[6] = yz + wx;
                mNew[8] = xz + wy; mNew[9] = yz - wx; mNew[10] = 1 - (xx + yy);
                window.ENGINE.MathOps.mat4.getEuler(rot, mNew);
            }

            return rot;
        }
    };
})();
