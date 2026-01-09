/**
 * VEETANCE Translation Gizmo
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.GizmoTranslate = (function () {
    const Utils = window.ENGINE.GizmoUtils;

    function draw(ctx, origin, mView, width, height, fovScale, objectRot, hoveredAxis, dragAxis) {
        const center = Utils.projectPoint(origin, mView, width, height, fovScale);
        if (!center) return [];

        const hitZones = [];
        const axes = ['x', 'y', 'z'];

        // 1. Draw Infinite Guides
        if (dragAxis) {
            if (dragAxis === 'x' || dragAxis === 'y' || dragAxis === 'z') {
                const dir = Utils.getAxisDirection(dragAxis, objectRot);
                const color = Utils.AXIS_COLORS[dragAxis].normal;
                Utils.drawInfiniteGuide(ctx, origin, dir, mView, width, height, fovScale, color);
            } else if (dragAxis === 'xy' || dragAxis === 'xz' || dragAxis === 'yz') {
                const planeColors = { xy: '#ffff00', xz: '#ff00ff', yz: '#00ffff' };
                const axis1 = dragAxis[0], axis2 = dragAxis[1];
                const dir1 = Utils.getAxisDirection(axis1, objectRot);
                const dir2 = Utils.getAxisDirection(axis2, objectRot);
                const color = planeColors[dragAxis];
                Utils.drawInfiniteGuide(ctx, origin, dir1, mView, width, height, fovScale, color);
                Utils.drawInfiniteGuide(ctx, origin, dir2, mView, width, height, fovScale, color);
            }
        }

        // 2. Draw Center Handle
        const centerColor = (hoveredAxis === 'xyz' || dragAxis === 'xyz') ? '#ffffff' : '#888888';
        ctx.fillStyle = centerColor;
        ctx.beginPath();
        ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
        ctx.fill();
        hitZones.push({ axis: 'xyz', cx: center.x, cy: center.y, r: 8 });

        // 3. Draw Plane Handles
        const planes = [
            { name: 'xy', axes: ['x', 'y'], color: '#ffff00' },
            { name: 'xz', axes: ['x', 'z'], color: '#ff00ff' },
            { name: 'yz', axes: ['y', 'z'], color: '#00ffff' }
        ];
        const CORNER_OFFSET = 0.35;
        const CORNER_SIZE = 0.25;

        planes.forEach(plane => {
            const dir1 = Utils.getAxisDirection(plane.axes[0], objectRot);
            const dir2 = Utils.getAxisDirection(plane.axes[1], objectRot);
            const bx = origin[0] + dir1[0] * CORNER_OFFSET + dir2[0] * CORNER_OFFSET;
            const by = origin[1] + dir1[1] * CORNER_OFFSET + dir2[1] * CORNER_OFFSET;
            const bz = origin[2] + dir1[2] * CORNER_OFFSET + dir2[2] * CORNER_OFFSET;

            const p1 = Utils.projectPoint([bx, by, bz], mView, width, height, fovScale);
            const p2 = Utils.projectPoint([bx + dir1[0] * CORNER_SIZE, by + dir1[1] * CORNER_SIZE, bz + dir1[2] * CORNER_SIZE], mView, width, height, fovScale);
            const p3 = Utils.projectPoint([bx + dir1[0] * CORNER_SIZE + dir2[0] * CORNER_SIZE, by + dir1[1] * CORNER_SIZE + dir2[1] * CORNER_SIZE, bz + dir1[2] * CORNER_SIZE + dir2[2] * CORNER_SIZE], mView, width, height, fovScale);
            const p4 = Utils.projectPoint([bx + dir2[0] * CORNER_SIZE, by + dir2[1] * CORNER_SIZE, bz + dir2[2] * CORNER_SIZE], mView, width, height, fovScale);

            if (p1 && p2 && p3 && p4) {
                const isActive = hoveredAxis === plane.name || dragAxis === plane.name;
                ctx.fillStyle = isActive ? 'rgba(255,255,255,0.6)' : `${plane.color}66`;
                ctx.strokeStyle = isActive ? '#ffffff' : plane.color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                hitZones.push({ axis: plane.name, points: [p1, p2, p3, p4] });
            }
        });

        // 4. Draw Axis Arrows
        axes.forEach(axis => {
            const dir = Utils.getAxisDirection(axis, objectRot);
            const endpoint = [origin[0] + dir[0] * Utils.GIZMO_LENGTH, origin[1] + dir[1] * Utils.GIZMO_LENGTH, origin[2] + dir[2] * Utils.GIZMO_LENGTH];
            const end = Utils.projectPoint(endpoint, mView, width, height, fovScale);
            if (!end) return;

            const color = Utils.getAxisColor(axis, hoveredAxis, dragAxis);
            const lineWidth = (hoveredAxis === axis || dragAxis === axis) ? 4 : 3;

            const dx = end.x - center.x, dy = end.y - center.y, len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                const nx = dx / len, ny = dy / len;
                const lineEndX = end.x - nx * Utils.ARROW_SIZE;
                const lineEndY = end.y - ny * Utils.ARROW_SIZE;

                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(center.x, center.y);
                ctx.lineTo(lineEndX, lineEndY);
                ctx.stroke();

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(end.x, end.y);
                ctx.lineTo(end.x - nx * Utils.ARROW_SIZE - ny * Utils.ARROW_SIZE * 0.5, end.y - ny * Utils.ARROW_SIZE + nx * Utils.ARROW_SIZE * 0.5);
                ctx.lineTo(end.x - nx * Utils.ARROW_SIZE + ny * Utils.ARROW_SIZE * 0.5, end.y - ny * Utils.ARROW_SIZE - nx * Utils.ARROW_SIZE * 0.5);
                ctx.closePath();
                ctx.fill();

                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(axis.toUpperCase(), end.x + nx * 18, end.y + ny * 18);
            }
            hitZones.push({ axis, x1: center.x, y1: center.y, x2: end.x, y2: end.y, dir });
        });

        return hitZones;
    }

    return { draw };
})();
