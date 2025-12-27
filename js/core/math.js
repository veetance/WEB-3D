/**
 * VEETANCE Logic Engine - Core Mathematics (High Performance)
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.MathOps = {
    /**
     * Matrix4 (Column-Major)
     * For combining Rot/Scale/Trans into one operation.
     */
    mat4: {
        create: () => new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]),

        identity: (out) => {
            out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
            out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
            out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
            out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
            return out;
        },

        translate: (out, a, v) => {
            let x = v.x !== undefined ? v.x : v[0];
            let y = v.y !== undefined ? v.y : v[1];
            let z = v.z !== undefined ? v.z : v[2];
            let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
            let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

            out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
            out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
            out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;
            out[12] = a00 * x + a10 * y + a20 * z + a30;
            out[13] = a01 * x + a11 * y + a21 * z + a31;
            out[14] = a02 * x + a12 * y + a22 * z + a32;
            out[15] = a03 * x + a13 * y + a23 * z + a33;
            return out;
        },

        rotateX: (out, a, rad) => {
            let s = Math.sin(rad);
            let c = Math.cos(rad);
            let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];

            // Copy unaffected rows
            out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
            out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];

            out[4] = a10 * c + a20 * s;
            out[5] = a11 * c + a21 * s;
            out[6] = a12 * c + a22 * s;
            out[7] = a13 * c + a23 * s;
            out[8] = a20 * c - a10 * s;
            out[9] = a21 * c - a11 * s;
            out[10] = a22 * c - a12 * s;
            out[11] = a23 * c - a13 * s;
            return out;
        },

        rotateY: (out, a, rad) => {
            let s = Math.sin(rad);
            let c = Math.cos(rad);
            let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
            let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];

            out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
            out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];

            out[0] = a00 * c - a20 * s;
            out[1] = a01 * c - a21 * s;
            out[2] = a02 * c - a22 * s;
            out[3] = a03 * c - a23 * s;
            out[8] = a00 * s + a20 * c;
            out[9] = a01 * s + a21 * c;
            out[10] = a02 * s + a22 * c;
            out[11] = a03 * s + a23 * c;
            return out;
        },

        rotateZ: (out, a, rad) => {
            let s = Math.sin(rad);
            let c = Math.cos(rad);
            let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
            let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];

            out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
            out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];

            out[0] = a00 * c + a10 * s;
            out[1] = a01 * c + a11 * s;
            out[2] = a02 * c + a12 * s;
            out[3] = a03 * c + a13 * s;
            out[4] = a10 * c - a00 * s;
            out[5] = a11 * c - a01 * s;
            out[6] = a12 * c - a02 * s;
            out[7] = a13 * c - a03 * s;
            return out;
        },

        scale: (out, a, v) => {
            let x = v.x !== undefined ? v.x : v[0];
            let y = v.y !== undefined ? v.y : v[1];
            let z = v.z !== undefined ? v.z : v[2];
            out[0] = a[0] * x; out[1] = a[1] * x; out[2] = a[2] * x; out[3] = a[3] * x;
            out[4] = a[4] * y; out[5] = a[5] * y; out[6] = a[6] * y; out[7] = a[7] * y;
            out[8] = a[8] * z; out[9] = a[9] * z; out[10] = a[10] * z; out[11] = a[11] * z;
            out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
            return out;
        },

        multiply: (out, a, b) => {
            let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
            let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

            let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
            out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

            b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
            out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

            b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
            out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

            b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
            out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
            out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
            out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            return out;
        }
    },

    /**
     * Batch Transform (The Speed Demon)
     * Transforms an entire vertex buffer by a matrix.
     * @param {Float32Array} out - Output buffer (x, y, z, w/flag) -> 4 floats per vert
     * @param {Float32Array} inp - Input buffer (x, y, z) -> 3 floats per vert
     * @param {Float32Array} m - 4x4 Transformation Matrix
     * @param {Number} count - Number of vertices
     */
    transformBuffer: (out, inp, m, count) => {
        const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3];
        const m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7];
        const m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11];
        const m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];

        for (let i = 0; i < count; i++) {
            const ix = i * 3;
            const ox = i * 4;

            const x = inp[ix];
            const y = inp[ix + 1];
            const z = inp[ix + 2];

            // Apply Matrix
            out[ox] = m00 * x + m10 * y + m20 * z + m30;
            out[ox + 1] = m01 * x + m11 * y + m21 * z + m31;
            out[ox + 2] = m02 * x + m12 * y + m22 * z + m32;
            const w = m03 * x + m13 * y + m23 * z + m33;

            out[ox + 3] = w;
        }
    },

    /**
     * Project Buffer to Screen Space
     */
    projectBuffer: (out, count, width, height, fov) => {
        const cx = width / 2;
        const cy = height / 2;
        const aspect = width / height;

        for (let i = 0; i < count; i++) {
            const ox = i * 4;
            const z = out[ox + 2];

            if (Math.abs(z) < 0.01) {
                out[ox + 3] = -1;
                continue;
            }

            const scale = fov / Math.abs(z);
            const x = out[ox] * scale;
            const y = out[ox + 1] * scale;

            out[ox] = x + cx;
            out[ox + 1] = -y + cy;
            out[ox + 3] = 1;
        }
    },

    /**
     * Vec3 Utilities
     */
    vec3: {
        sub: (out, a, b) => {
            out[0] = a[0] - b[0];
            out[1] = a[1] - b[1];
            out[2] = a[2] - b[2];
            return out;
        },
        cross: (out, a, b) => {
            let ax = a[0], ay = a[1], az = a[2];
            let bx = b[0], by = b[1], bz = b[2];
            out[0] = ay * bz - az * by;
            out[1] = az * bx - ax * bz;
            out[2] = ax * by - ay * bx;
            return out;
        },
        dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
        normalize: (out, a) => {
            let x = a[0], y = a[1], z = a[2];
            let len = x * x + y * y + z * z;
            if (len > 0) {
                len = 1 / Math.sqrt(len);
                out[0] = x * len;
                out[1] = y * len;
                out[2] = z * len;
            }
            return out;
        }
    },

    /**
     * Radix Sort for Z-Depth (Adapted for TypedArrays)
     */
    radixSort: (indices, depths, count) => {
        if (count <= 1) return indices;

        let curr = indices;
        let next = new Int32Array(count);
        const counts = new Int32Array(256);

        const intView = new Uint32Array(depths.buffer, depths.byteOffset, count);

        for (let shift = 0; shift < 32; shift += 8) {
            counts.fill(0);
            for (let i = 0; i < count; i++) {
                const val = intView[curr[i]];
                counts[(val >> shift) & 0xFF]++;
            }
            let off = 0;
            for (let i = 0; i < 256; i++) {
                const t = counts[i];
                counts[i] = off;
                off += t;
            }
            for (let i = 0; i < count; i++) {
                const val = intView[curr[i]];
                next[counts[(val >> shift) & 0xFF]++] = curr[i];
            }
            // Swap
            let t = curr; curr = next; next = t;
        }
        return curr;
    }
};
