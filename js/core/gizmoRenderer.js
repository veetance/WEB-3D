/**
 * VEETANCE Bespoke Gizmo Renderer
 * Draws 3D transform gizmos with hover/active states and coordinate space support.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.GizmoRenderer = (function () {
    const AXIS_COLORS = {
        x: { normal: '#ff3366', hover: '#ff6699', active: '#ffffff' },
        y: { normal: '#33ff66', hover: '#66ff99', active: '#ffffff' },
        z: { normal: '#3366ff', hover: '#6699ff', active: '#ffffff' }
    };
    const GIZMO_LENGTH = 1.5;
    const ARROW_SIZE = 12;
    const RING_RADIUS = 50;
    const CUBE_SIZE = 10;

    /**
     * Transform and project a 3D point to 2D screen coordinates.
     */
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

    /**
     * Get axis direction based on transform space.
     */
    function getAxisDirection(axis, objectRot, cameraOrbitY, space) {
        const dirs = {
            x: [1, 0, 0],
            y: [0, 1, 0],
            z: [0, 0, 1]
        };
        let dir = [...dirs[axis]];

        if (space === 'LOCAL') {
            // Apply object rotation to axis
            const cos = Math.cos, sin = Math.sin;
            const rx = objectRot.x, ry = objectRot.y, rz = objectRot.z;
            // Simplified rotation (Y then X then Z)
            let [x, y, z] = dir;
            // Rotate Y
            let x1 = x * cos(ry) + z * sin(ry);
            let z1 = -x * sin(ry) + z * cos(ry);
            // Rotate X
            let y1 = y * cos(rx) - z1 * sin(rx);
            let z2 = y * sin(rx) + z1 * cos(rx);
            // Rotate Z
            let x2 = x1 * cos(rz) - y1 * sin(rz);
            let y2 = x1 * sin(rz) + y1 * cos(rz);
            dir = [x2, y2, z2];
        } else if (space === 'SCREEN') {
            // Screen space: X is view-right, Y is view-up, Z is view-forward
            const cy = Math.cos(cameraOrbitY), sy = Math.sin(cameraOrbitY);
            if (axis === 'x') dir = [cy, 0, sy];
            else if (axis === 'y') dir = [0, 1, 0];
            else dir = [-sy, 0, cy];
        }
        // GLOBAL: use identity (default dirs)

        return dir;
    }

    /**
     * Get color for axis based on state.
     */
    function getAxisColor(axis, hoveredAxis, dragAxis) {
        const colors = AXIS_COLORS[axis];
        if (dragAxis === axis) return colors.active;
        if (hoveredAxis === axis) return colors.hover;
        return colors.normal;
    }

    /**
     * Draw translate gizmo (3 arrows + plane handles + center).
     */
    function drawTranslate(ctx, origin, mView, width, height, fovScale, objectRot, cameraOrbitY, space, hoveredAxis, dragAxis) {
        const center = projectPoint(origin, mView, width, height, fovScale);
        if (!center) return [];

        const hitZones = [];
        const axes = ['x', 'y', 'z'];
        const PLANE_OFFSET = 0.4;
        const PLANE_SIZE = 0.3;

        // Draw center handle (free movement)
        const centerColor = (hoveredAxis === 'xyz' || dragAxis === 'xyz') ? '#ffffff' : '#888888';
        ctx.fillStyle = centerColor;
        ctx.beginPath();
        ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
        ctx.fill();
        hitZones.push({ axis: 'xyz', cx: center.x, cy: center.y, r: 8 });

        // Draw plane handles (XY, XZ, YZ) - positioned in the CORNER between two axes
        // Colors = blend of the two axis colors: X=Red, Y=Green, Z=Blue
        const planes = [
            { name: 'xy', axes: ['x', 'y'], color: '#ffff00' }, // Yellow = Red + Green
            { name: 'xz', axes: ['x', 'z'], color: '#ff00ff' }, // Magenta = Red + Blue
            { name: 'yz', axes: ['y', 'z'], color: '#00ffff' }  // Cyan = Green + Blue
        ];
        const CORNER_OFFSET = 0.35; // How far along each axis
        const CORNER_SIZE = 0.25;   // Size of the square

        planes.forEach(plane => {
            const dir1 = getAxisDirection(plane.axes[0], objectRot, cameraOrbitY, space);
            const dir2 = getAxisDirection(plane.axes[1], objectRot, cameraOrbitY, space);

            // Position the square in the corner formed by both axes
            // p1 = corner start (on both axes)
            // p2, p3, p4 form the square
            const baseX = origin[0] + dir1[0] * CORNER_OFFSET + dir2[0] * CORNER_OFFSET;
            const baseY = origin[1] + dir1[1] * CORNER_OFFSET + dir2[1] * CORNER_OFFSET;
            const baseZ = origin[2] + dir1[2] * CORNER_OFFSET + dir2[2] * CORNER_OFFSET;

            const p1 = projectPoint([baseX, baseY, baseZ], mView, width, height, fovScale);
            const p2 = projectPoint([
                baseX + dir1[0] * CORNER_SIZE,
                baseY + dir1[1] * CORNER_SIZE,
                baseZ + dir1[2] * CORNER_SIZE
            ], mView, width, height, fovScale);
            const p3 = projectPoint([
                baseX + dir1[0] * CORNER_SIZE + dir2[0] * CORNER_SIZE,
                baseY + dir1[1] * CORNER_SIZE + dir2[1] * CORNER_SIZE,
                baseZ + dir1[2] * CORNER_SIZE + dir2[2] * CORNER_SIZE
            ], mView, width, height, fovScale);
            const p4 = projectPoint([
                baseX + dir2[0] * CORNER_SIZE,
                baseY + dir2[1] * CORNER_SIZE,
                baseZ + dir2[2] * CORNER_SIZE
            ], mView, width, height, fovScale);

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

                hitZones.push({
                    axis: plane.name,
                    points: [p1, p2, p3, p4]
                });
            }
        });

        // Draw axis arrows
        axes.forEach(axis => {
            const dir = getAxisDirection(axis, objectRot, cameraOrbitY, space);
            const endpoint = [
                origin[0] + dir[0] * GIZMO_LENGTH,
                origin[1] + dir[1] * GIZMO_LENGTH,
                origin[2] + dir[2] * GIZMO_LENGTH
            ];
            const end = projectPoint(endpoint, mView, width, height, fovScale);
            if (!end) return;

            const color = getAxisColor(axis, hoveredAxis, dragAxis);
            const lineWidth = (hoveredAxis === axis || dragAxis === axis) ? 4 : 3;

            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            // Arrowhead
            const dx = end.x - center.x;
            const dy = end.y - center.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                const nx = dx / len;
                const ny = dy / len;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(end.x, end.y);
                ctx.lineTo(end.x - nx * ARROW_SIZE - ny * ARROW_SIZE * 0.5, end.y - ny * ARROW_SIZE + nx * ARROW_SIZE * 0.5);
                ctx.lineTo(end.x - nx * ARROW_SIZE + ny * ARROW_SIZE * 0.5, end.y - ny * ARROW_SIZE - nx * ARROW_SIZE * 0.5);
                ctx.closePath();
                ctx.fill();

                // Label
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.fillStyle = color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(axis.toUpperCase(), end.x + nx * 18, end.y + ny * 18);
            }

            hitZones.push({ axis, x1: center.x, y1: center.y, x2: end.x, y2: end.y, dir });
        });

        return hitZones;
    }

    /**
     * Draw rotate gizmo (3D rings perpendicular to each axis).
     */
    function drawRotate(ctx, origin, mView, width, height, fovScale, objectRot, cameraOrbitY, space, hoveredAxis, dragAxis) {
        const hitZones = [];
        const RING_RADIUS_3D = 1.2; // World units
        const SEGMENTS = 48;

        const axes = ['x', 'y', 'z'];

        axes.forEach(axis => {
            const color = getAxisColor(axis, hoveredAxis, dragAxis);
            const lineWidth = (hoveredAxis === axis || dragAxis === axis) ? 3 : 2;

            // Generate 3D circle points perpendicular to the axis
            const points = [];
            for (let i = 0; i <= SEGMENTS; i++) {
                const angle = (i / SEGMENTS) * Math.PI * 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                let px, py, pz;
                if (axis === 'x') {
                    // Circle in YZ plane (perpendicular to X)
                    px = 0;
                    py = cos * RING_RADIUS_3D;
                    pz = sin * RING_RADIUS_3D;
                } else if (axis === 'y') {
                    // Circle in XZ plane (perpendicular to Y)
                    px = cos * RING_RADIUS_3D;
                    py = 0;
                    pz = sin * RING_RADIUS_3D;
                } else {
                    // Circle in XY plane (perpendicular to Z)
                    px = cos * RING_RADIUS_3D;
                    py = sin * RING_RADIUS_3D;
                    pz = 0;
                }

                // Apply coordinate space transformation if LOCAL
                if (space === 'LOCAL') {
                    const rx = objectRot.x, ry = objectRot.y, rz = objectRot.z;
                    // Rotate Y
                    let x1 = px * Math.cos(ry) + pz * Math.sin(ry);
                    let z1 = -px * Math.sin(ry) + pz * Math.cos(ry);
                    // Rotate X
                    let y1 = py * Math.cos(rx) - z1 * Math.sin(rx);
                    let z2 = py * Math.sin(rx) + z1 * Math.cos(rx);
                    // Rotate Z
                    let x2 = x1 * Math.cos(rz) - y1 * Math.sin(rz);
                    let y2 = x1 * Math.sin(rz) + y1 * Math.cos(rz);
                    px = x2; py = y2; pz = z2;
                }

                // Translate to origin
                const worldPoint = [origin[0] + px, origin[1] + py, origin[2] + pz];
                const projected = projectPoint(worldPoint, mView, width, height, fovScale);
                if (projected) {
                    points.push(projected);
                }
            }

            // Draw the ring
            if (points.length > 2) {
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();
            }

            // Calculate hit zone (simplified: use center and average radius)
            const center = projectPoint(origin, mView, width, height, fovScale);
            if (center && points.length > 0) {
                let avgRadius = 0;
                points.forEach(p => {
                    avgRadius += Math.sqrt((p.x - center.x) ** 2 + (p.y - center.y) ** 2);
                });
                avgRadius /= points.length;
                hitZones.push({ axis, cx: center.x, cy: center.y, r: avgRadius });
            }
        });

        return hitZones;
    }

    /**
     * Draw scale gizmo (3 cubes at axis ends).
     */
    function drawScale(ctx, origin, mView, width, height, fovScale, objectRot, cameraOrbitY, space, hoveredAxis, dragAxis) {
        const center = projectPoint(origin, mView, width, height, fovScale);
        if (!center) return [];

        const hitZones = [];
        const axes = ['x', 'y', 'z'];

        axes.forEach(axis => {
            const dir = getAxisDirection(axis, objectRot, cameraOrbitY, space);
            const endpoint = [
                origin[0] + dir[0] * GIZMO_LENGTH,
                origin[1] + dir[1] * GIZMO_LENGTH,
                origin[2] + dir[2] * GIZMO_LENGTH
            ];
            const end = projectPoint(endpoint, mView, width, height, fovScale);
            if (!end) return;

            const color = getAxisColor(axis, hoveredAxis, dragAxis);
            const lineWidth = (hoveredAxis === axis || dragAxis === axis) ? 3 : 2;
            const cubeSize = (hoveredAxis === axis || dragAxis === axis) ? CUBE_SIZE + 2 : CUBE_SIZE;

            // Draw line
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            // Draw cube
            ctx.fillStyle = color;
            ctx.fillRect(end.x - cubeSize / 2, end.y - cubeSize / 2, cubeSize, cubeSize);

            hitZones.push({ axis, x: end.x, y: end.y, size: cubeSize, dir });
        });

        return hitZones;
    }

    /**
     * Draw selection outline (small origin marker).
     */
    function drawSelectionOutline(ctx, origin, mView, width, height, fovScale) {
        const center = projectPoint(origin, mView, width, height, fovScale);
        if (!center) return;

        ctx.strokeStyle = '#66ccff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * Draw hover outline as a union silhouette (outer contour only).
     * Only draws boundary edges - edges that belong to exactly one visible face.
     */
    function drawHoverOutline(ctx, screenBuffer, indices, faceCount, color) {
        if (!screenBuffer || !indices) return;

        // Count edge occurrences in visible faces
        const edgeCount = new Map();
        const edgeCoords = new Map();

        for (let i = 0; i < faceCount; i++) {
            const i3 = i * 3;
            const i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2];
            const i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;

            // Skip if any vertex is behind camera
            if (screenBuffer[i04 + 3] < 0 || screenBuffer[i14 + 3] < 0 || screenBuffer[i24 + 3] < 0) continue;

            // Get screen coordinates
            const x0 = screenBuffer[i04], y0 = screenBuffer[i04 + 1];
            const x1 = screenBuffer[i14], y1 = screenBuffer[i14 + 1];
            const x2 = screenBuffer[i24], y2 = screenBuffer[i24 + 1];

            // Back-face culling
            const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
            if (area > 0) continue;

            // Count edges
            const edges = [[i0, i1], [i1, i2], [i2, i0]];
            edges.forEach(([a, b]) => {
                const key = a < b ? `${a}-${b}` : `${b}-${a}`;
                edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
                if (!edgeCoords.has(key)) {
                    edgeCoords.set(key, {
                        ax: screenBuffer[a << 2], ay: screenBuffer[(a << 2) + 1],
                        bx: screenBuffer[b << 2], by: screenBuffer[(b << 2) + 1]
                    });
                }
            });
        }

        // Draw only boundary edges (count === 1)
        ctx.strokeStyle = color || '#00ffd2';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        edgeCount.forEach((count, key) => {
            if (count === 1) {
                const e = edgeCoords.get(key);
                ctx.moveTo(e.ax, e.ay);
                ctx.lineTo(e.bx, e.by);
            }
        });
        ctx.stroke();
    }

    return {
        drawTranslate,
        drawRotate,
        drawScale,
        drawSelectionOutline,
        drawHoverOutline,
        projectPoint,
        getAxisDirection,
        AXIS_COLORS
    };
})();
