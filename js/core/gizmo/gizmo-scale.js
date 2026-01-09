/**
 * VEETANCE Scale Gizmo
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.GizmoScale = (function () {
    const Utils = window.ENGINE.GizmoUtils;

    function draw(ctx, origin, mView, width, height, fovScale, objectRot, hoveredAxis, dragAxis) {
        const center = Utils.projectPoint(origin, mView, width, height, fovScale);
        if (!center) return [];

        const hitZones = [];

        // 1. Draw Infinite Guides if dragging a single axis
        if (dragAxis && (dragAxis === 'x' || dragAxis === 'y' || dragAxis === 'z')) {
            const dir = Utils.getAxisDirection(dragAxis, objectRot);
            const color = Utils.AXIS_COLORS[dragAxis].normal;
            Utils.drawInfiniteGuide(ctx, origin, dir, mView, width, height, fovScale, color);
        }

        ['x', 'y', 'z'].forEach(axis => {
            const dir = Utils.getAxisDirection(axis, objectRot);
            const endpoint = [origin[0] + dir[0] * Utils.GIZMO_LENGTH, origin[1] + dir[1] * Utils.GIZMO_LENGTH, origin[2] + dir[2] * Utils.GIZMO_LENGTH];
            const end = Utils.projectPoint(endpoint, mView, width, height, fovScale);
            if (!end) return;

            const color = Utils.getAxisColor(axis, hoveredAxis, dragAxis);
            const lineWidth = (hoveredAxis === axis || dragAxis === axis) ? 3 : 2;
            const cubeSize = (hoveredAxis === axis || dragAxis === axis) ? Utils.CUBE_SIZE + 2 : Utils.CUBE_SIZE;

            const dx = end.x - center.x, dy = end.y - center.y, len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                const nx = dx / len, ny = dy / len;
                const lineEndX = end.x - nx * (cubeSize / 2);
                const lineEndY = end.y - ny * (cubeSize / 2);

                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(center.x, center.y);
                ctx.lineTo(lineEndX, lineEndY);
                ctx.stroke();
            }

            ctx.fillStyle = color;
            ctx.fillRect(end.x - cubeSize / 2, end.y - cubeSize / 2, cubeSize, cubeSize);
            hitZones.push({ axis, x: end.x, y: end.y, size: cubeSize, dir });
        });

        return hitZones;
    }

    return { draw };
})();
