/**
 * VEETANCE Rotation Gizmo
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.GizmoRotate = (function () {
    const Utils = window.ENGINE.GizmoUtils;
    const RING_RADIUS_3D = 1.2;
    const SCREEN_RING_RADIUS = 1.5;
    const SEGMENTS = 64;

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

        // 2. Trackball Volume
        const isTrackballActive = hoveredAxis === 'trackball' || dragAxis === 'trackball';
        const trackballRadiusPx = (fovScale / Math.abs(mView[14])) * 1.1;
        ctx.fillStyle = isTrackballActive ? 'rgba(100, 200, 180, 0.25)' : 'rgba(136, 136, 136, 0.15)';
        ctx.beginPath();
        ctx.arc(center.x, center.y, trackballRadiusPx, 0, Math.PI * 2);
        ctx.fill();
        hitZones.push({ axis: 'trackball', cx: center.x, cy: center.y, r: trackballRadiusPx });

        // 3. Axis Rings
        ['x', 'y', 'z'].forEach(axis => {
            const color = Utils.getAxisColor(axis, hoveredAxis, dragAxis);
            const points = [];
            for (let i = 0; i <= SEGMENTS; i++) {
                const angle = (i / SEGMENTS) * Math.PI * 2;
                const cos = Math.cos(angle), sin = Math.sin(angle);
                let px = 0, py = 0, pz = 0;
                if (axis === 'x') { py = cos * RING_RADIUS_3D; pz = sin * RING_RADIUS_3D; }
                else if (axis === 'y') { px = cos * RING_RADIUS_3D; pz = sin * RING_RADIUS_3D; }
                else { px = cos * RING_RADIUS_3D; py = sin * RING_RADIUS_3D; }

                // Local Rotation
                const rx = objectRot.x, ry = objectRot.y, rz = objectRot.z;
                let x1 = px * Math.cos(ry) + pz * Math.sin(ry);
                let z1 = -px * Math.sin(ry) + pz * Math.cos(ry);
                let y1 = py * Math.cos(rx) - z1 * Math.sin(rx);
                let z2 = py * Math.sin(rx) + z1 * Math.cos(rx);
                px = x1 * Math.cos(rz) - y1 * Math.sin(rz);
                py = x1 * Math.sin(rz) + y1 * Math.cos(rz);
                pz = z2;

                const wp = [origin[0] + px, origin[1] + py, origin[2] + pz];
                const tx = mView[0] * wp[0] + mView[4] * wp[1] + mView[8] * wp[2] + mView[12];
                const ty = mView[1] * wp[0] + mView[5] * wp[1] + mView[9] * wp[2] + mView[13];
                const tz = mView[2] * wp[0] + mView[6] * wp[1] + mView[10] * wp[2] + mView[14];

                if (tz < -0.1) {
                    const s = fovScale / Math.abs(tz);
                    points.push({ x: width * 0.5 + tx * s, y: height * 0.5 - ty * s, z: tz });
                } else points.push(null);
            }

            ctx.lineWidth = (hoveredAxis === axis || dragAxis === axis) ? 4 : 2;
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i], p2 = points[i + 1];
                if (!p1 || !p2) continue;
                const isBehind = (p1.z + p2.z) * 0.5 > mView[14] + 0.1;
                ctx.strokeStyle = isBehind ? color + '44' : color;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
            hitZones.push({ axis, points: points.filter(p => p !== null), type: 'ring' });

            const labelPoint = points[0];
            if (labelPoint && labelPoint.z < mView[14] - 0.1) {
                ctx.font = 'bold 12px Inter, sans-serif';
                ctx.beginPath(); ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.arc(labelPoint.x, labelPoint.y, 8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(axis.toUpperCase(), labelPoint.x, labelPoint.y);
            }
        });

        // 4. Outer Screen Ring
        const outerRadiusPx = (fovScale / Math.abs(mView[14])) * SCREEN_RING_RADIUS;
        const isScreenActive = hoveredAxis === 'screen' || dragAxis === 'screen';
        ctx.strokeStyle = isScreenActive ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(center.x, center.y, outerRadiusPx, 0, Math.PI * 2); ctx.stroke();
        hitZones.push({ axis: 'screen', cx: center.x, cy: center.y, r: outerRadiusPx, type: 'outer' });

        return hitZones;
    }

    return { draw };
})();
