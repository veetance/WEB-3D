/** 
 * VEETANCE Rotation Cache – reduces repeated Math.sin/Math.cos calls.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.RotationCache = (function () {
    const cache = {
        x: { angle: null, sin: 0, cos: 1 },
        y: { angle: null, sin: 0, cos: 1 },
        z: { angle: null, sin: 0, cos: 1 }
    };

    function getSinCos(axis, rad) {
        const entry = cache[axis];
        if (entry.angle !== rad) {
            entry.angle = rad;
            entry.sin = Math.sin(rad);
            entry.cos = Math.cos(rad);
        }
        return { sin: entry.sin, cos: entry.cos };
    }

    function rotateX(out, a, rad) {
        const { sin, cos } = getSinCos('x', rad);
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
        out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
        out[4] = a10 * cos + a20 * sin; out[5] = a11 * cos + a21 * sin;
        out[6] = a12 * cos + a22 * sin; out[7] = a13 * cos + a23 * sin;
        out[8] = a20 * cos - a10 * sin; out[9] = a21 * cos - a11 * sin;
        out[10] = a22 * cos - a12 * sin; out[11] = a23 * cos - a13 * sin;
        return out;
    }

    function rotateY(out, a, rad) {
        const { sin, cos } = getSinCos('y', rad);
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
        out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
        out[0] = a00 * cos - a20 * sin; out[1] = a01 * cos - a21 * sin;
        out[2] = a02 * cos - a22 * sin; out[3] = a03 * cos - a23 * sin;
        out[8] = a00 * sin + a20 * cos; out[9] = a01 * sin + a21 * cos;
        out[10] = a02 * sin + a22 * cos; out[11] = a03 * sin + a23 * cos;
        return out;
    }

    function rotateZ(out, a, rad) {
        const { sin, cos } = getSinCos('z', rad);
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
        out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
        out[0] = a00 * cos + a10 * sin; out[1] = a01 * cos + a11 * sin;
        out[2] = a02 * cos + a12 * sin; out[3] = a03 * cos + a13 * sin;
        out[4] = a10 * cos - a00 * sin; out[5] = a11 * cos - a01 * sin;
        out[6] = a12 * cos - a02 * sin; out[7] = a13 * cos - a03 * sin;
        return out;
    }

    return { rotateX, rotateY, rotateZ };
})();
