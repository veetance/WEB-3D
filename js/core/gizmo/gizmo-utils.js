/**
 * VEETANCE Gizmo Utilities
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.GizmoUtils = (function () {
    const AXIS_COLORS = {
        x: { normal: '#ff3366', hover: '#ff6699', active: '#ffffff' },
        y: { normal: '#33ff66', hover: '#66ff99', active: '#ffffff' },
        z: { normal: '#3366ff', hover: '#6699ff', active: '#ffffff' }
    };

    function projectPoint(point, mView, width, height, fovScale) {
        const x = point[0], y = point[1], z = point[2];
        const m = mView;
        const tx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const ty = m[1] * x + m[5] * y + m[9] * z + m[13];
        const tz = m[2] * x + m[6] * y + m[10] * z + m[14];

        if (tz > -0.1) return null;

        const scale = fovScale / Math.abs(tz);
        return {
            x: width * 0.5 + tx * scale,
            y: height * 0.5 - ty * scale
        };
    }

    function getAxisDirection(axis, objectRot) {
        const dirs = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
        let [x, y, z] = dirs[axis];

        const cos = Math.cos, sin = Math.sin;
        const rx = objectRot.x, ry = objectRot.y, rz = objectRot.z;

        // Rotation Sequence: Y -> X -> Z (Manifold Standard)
        let x1 = x * cos(ry) + z * sin(ry);
        let z1 = -x * sin(ry) + z * cos(ry);
        let y1 = y * cos(rx) - z1 * sin(rx);
        let z2 = y * sin(rx) + z1 * cos(rx);
        let x2 = x1 * cos(rz) - y1 * sin(rz);
        let y2 = x1 * sin(rz) + y1 * cos(rz);

        return [x2, y2, z2];
    }

    function getAxisColor(axis, hoveredAxis, dragAxis) {
        const colors = AXIS_COLORS[axis];
        if (dragAxis === axis) return colors.active;
        if (hoveredAxis === axis) return colors.hover;
        return colors.normal;
    }

    /**
     * Draw an infinite guide line along an axis.
     */
    function drawInfiniteGuide(ctx, origin, dir, mView, width, height, fovScale, color) {
        const p0 = projectPoint(origin, mView, width, height, fovScale);
        const p1 = projectPoint([origin[0] + dir[0], origin[1] + dir[1], origin[2] + dir[2]], mView, width, height, fovScale);

        if (!p0 || !p1) return;

        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.1) return;

        const nx = dx / len;
        const ny = dy / len;

        const maxDist = Math.sqrt(width * width + height * height);
        const startX = p0.x - nx * maxDist;
        const startY = p0.y - ny * maxDist;
        const endX = p0.x + nx * maxDist;
        const endY = p0.y + ny * maxDist;

        ctx.save();
        // High-Contrast Kinetic Gradient: 70/30 Falloff
        const grad = ctx.createLinearGradient(startX, startY, endX, endY);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.3, 'transparent'); // 70% transparency clip
        grad.addColorStop(0.5, color); // 100% Contrast at origin
        grad.addColorStop(0.7, 'transparent');
        grad.addColorStop(1, 'transparent');

        ctx.strokeStyle = grad;
        ctx.setLineDash([10, 5]);
        ctx.lineWidth = 1.5; // Slight boost for contrast
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();
    }

    return {
        projectPoint,
        getAxisDirection,
        getAxisColor,
        drawInfiniteGuide,
        AXIS_COLORS,
        GIZMO_LENGTH: 1.5,
        ARROW_SIZE: 12,
        CUBE_SIZE: 10
    };
})();
