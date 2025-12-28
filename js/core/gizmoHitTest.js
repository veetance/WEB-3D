/**
 * VEETANCE Gizmo Hit Test
 * Detects which gizmo axis is being hovered/clicked.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.GizmoHitTest = (function () {
    const HIT_THRESHOLD = 12;

    /**
     * Test if a point is near a line segment.
     */
    function pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);

        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const nearX = x1 + t * dx;
        const nearY = y1 + t * dy;
        return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
    }

    /**
     * Test if point is inside a polygon.
     */
    function pointInPolygon(px, py, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;
            if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    /**
     * Test translate gizmo hit zones (center, planes, arrows).
     */
    function testTranslate(mx, my, hitZones) {
        // Check center first (highest priority)
        for (const zone of hitZones) {
            if (zone.axis === 'xyz' && zone.cx !== undefined) {
                const dist = Math.sqrt((mx - zone.cx) ** 2 + (my - zone.cy) ** 2);
                if (dist < zone.r) return 'xyz';
            }
        }

        // Check plane handles next
        for (const zone of hitZones) {
            if (zone.points && zone.points.length === 4) {
                if (pointInPolygon(mx, my, zone.points)) {
                    return zone.axis;
                }
            }
        }

        // Check axis arrows last
        let closest = null;
        let minDist = HIT_THRESHOLD;
        for (const zone of hitZones) {
            if (zone.x1 !== undefined) {
                const dist = pointToLineDistance(mx, my, zone.x1, zone.y1, zone.x2, zone.y2);
                if (dist < minDist) {
                    minDist = dist;
                    closest = zone.axis;
                }
            }
        }
        return closest;
    }

    /**
     * Test rotate gizmo hit zones (rings).
     */
    function testRotate(mx, my, hitZones) {
        let closest = null;
        let minDiff = HIT_THRESHOLD;

        for (const zone of hitZones) {
            // Distance from center
            const dist = Math.sqrt((mx - zone.cx) ** 2 + (my - zone.cy) ** 2);
            // How close to the ring radius
            const diff = Math.abs(dist - zone.r);
            if (diff < minDiff) {
                minDiff = diff;
                closest = zone.axis;
            }
        }
        return closest;
    }

    /**
     * Test scale gizmo hit zones (cubes).
     */
    function testScale(mx, my, hitZones) {
        for (const zone of hitZones) {
            const half = zone.size / 2 + HIT_THRESHOLD / 2;
            if (Math.abs(mx - zone.x) < half && Math.abs(my - zone.y) < half) {
                return zone.axis;
            }
        }
        return null;
    }

    /**
     * Unified test function - detects axis based on mode.
     */
    function test(mx, my, hitZones, mode) {
        if (!hitZones || hitZones.length === 0) return null;

        mode = mode.toUpperCase();
        if (mode === 'TRANSLATE') return testTranslate(mx, my, hitZones);
        if (mode === 'ROTATE') return testRotate(mx, my, hitZones);
        if (mode === 'SCALE') return testScale(mx, my, hitZomes);
        return null;
    }

    return { testTranslate, testRotate, testScale, test };
})();
