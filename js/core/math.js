/**
 * VEETANCE Logic Engine - Core Mathematics (High Performance)
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.MathOps = {
    mat4: {
        create: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
        identity: (out) => {
            out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
            out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
            out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
            out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
            return out;
        },
        translate: (out, a, v) => {
            let x = v.x ?? v[0], y = v.y ?? v[1], z = v.z ?? v[2];
            let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
                a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
                a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
                a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
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
            let s = Math.sin(rad), c = Math.cos(rad);
            let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
                a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
            out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
            out[4] = a10 * c + a20 * s; out[5] = a11 * c + a21 * s; out[6] = a12 * c + a22 * s; out[7] = a13 * c + a23 * s;
            out[8] = a20 * c - a10 * s; out[9] = a21 * c - a11 * s; out[10] = a22 * c - a12 * s; out[11] = a23 * c - a13 * s;
            return out;
        },
        rotateY: (out, a, rad) => {
            let s = Math.sin(rad), c = Math.cos(rad);
            let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
                a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
            out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
            out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
            out[0] = a00 * c - a20 * s; out[1] = a01 * c - a21 * s; out[2] = a02 * c - a22 * s; out[3] = a03 * c - a23 * s;
            out[8] = a00 * s + a20 * c; out[9] = a01 * s + a21 * c; out[10] = a02 * s + a22 * c; out[11] = a03 * s + a23 * c;
            return out;
        },
        rotateZ: (out, a, rad) => {
            let s = Math.sin(rad), c = Math.cos(rad);
            let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
                a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
            out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
            out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
            out[0] = a00 * c + a10 * s; out[1] = a01 * c + a11 * s; out[2] = a02 * c + a12 * s; out[3] = a03 * c + a13 * s;
            out[4] = a10 * c - a00 * s; out[5] = a11 * c - a01 * s; out[6] = a12 * c - a02 * s; out[7] = a13 * c - a03 * s;
            return out;
        },
        scale: (out, a, v) => {
            let x = v.x ?? v[0], y = v.y ?? v[1], z = v.z ?? v[2];
            out[0] = a[0] * x; out[1] = a[1] * x; out[2] = a[2] * x; out[3] = a[3] * x;
            out[4] = a[4] * y; out[5] = a[5] * y; out[6] = a[6] * y; out[7] = a[7] * y;
            out[8] = a[8] * z; out[9] = a[9] * z; out[10] = a[10] * z; out[11] = a[11] * z;
            out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
            return out;
        },
        multiply: (out, a, b) => {
            let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
                a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
                a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
                a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
            let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
            out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30; out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32; out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
            out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30; out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32; out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
            out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30; out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32; out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
            out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30; out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
            out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32; out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
            return out;
        },
        perspective: (out, fovy, aspect, near, far) => {
            let f = 1.0 / Math.tan(fovy / 2), nf = 1 / (near - far);
            out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
            out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
            out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
            out[12] = 0; out[13] = 0; out[14] = (2 * far * near) * nf; out[15] = 0;
            return out;
        },
        fromEuler: (out, x, y, z) => {
            const cx = Math.cos(x), sx = Math.sin(x);
            const cy = Math.cos(y), sy = Math.sin(y);
            const cz = Math.cos(z), sz = Math.sin(z);
            // YXZ Order
            out[0] = cy * cz + sy * sx * sz;
            out[1] = cz * sy * sx - cy * sz;
            out[2] = cx * sy;
            out[4] = cx * sz;
            out[5] = cx * cz;
            out[6] = -sx;
            out[8] = cy * sx * sz - cz * sy;
            out[9] = cy * cz * sx + sy * sz;
            out[10] = cy * cx;
            out[3] = out[7] = out[11] = out[12] = out[13] = out[14] = 0; out[15] = 1;
            return out;
        },
        getEuler: (out, m) => {
            // Extract from YXZ Matrix
            out.x = Math.asin(-Math.max(-1, Math.min(1, m[6])));
            if (Math.abs(m[6]) < 0.999) {
                out.y = Math.atan2(m[2], m[10]);
                out.z = Math.atan2(m[4], m[5]);
            } else {
                out.y = Math.atan2(-m[8], m[0]);
                out.z = 0;
            }
            return out;
        },
        invert: (out, a) => {
            let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
                a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
                a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
                a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

            let b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
                b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
                b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
                b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;

            let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
            if (!det) return null;
            det = 1.0 / det;

            out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
            out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
            out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
            out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
            out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
            out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
            out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
            out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
            out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
            out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
            out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
            out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
            out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
            out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
            out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
            out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
            return out;
        },
        transformVec4: (out, m, v) => {
            let x = v[0], y = v[1], z = v[2], w = v[3];
            out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
            out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
            out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
            out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
            return out;
        }
    },
    transformBuffer: (out, inp, m, count) => {
        let m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3], m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7],
            m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11], m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];
        for (let i = 0; i < count; i++) {
            let ix = i * 3, ox = i * 4, x = inp[ix], y = inp[ix + 1], z = inp[ix + 2];
            out[ox] = m00 * x + m10 * y + m20 * z + m30; out[ox + 1] = m01 * x + m11 * y + m21 * z + m31;
            out[ox + 2] = m02 * x + m12 * y + m22 * z + m32; out[ox + 3] = m03 * x + m13 * y + m23 * z + m33;
        }
    },
    projectBuffer: (out, count, width, height, fov) => {
        let cx = width / 2, cy = height / 2;
        for (let i = 0; i < count; i++) {
            let ox = i * 4, x = out[ox], y = out[ox + 1], z = out[ox + 2];
            if (z > -0.1) {
                out[ox + 3] = -1; continue;
            }
            let scale = fov / Math.abs(z);
            out[ox] = x * scale + cx;
            out[ox + 1] = -y * scale + cy;
            out[ox + 3] = 1;
        }
    },
    vec3: {
        sub: (out, a, b) => { out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out; },
        cross: (out, a, b) => {
            let ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
            out[0] = ay * bz - az * by; out[1] = az * bx - ax * bz; out[2] = ax * by - ay * bx; return out;
        },
        dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
        normalize: (out, a) => {
            let x = a[0], y = a[1], z = a[2], len = x * x + y * y + z * z;
            if (len > 0) { len = 1 / Math.sqrt(len); out[0] = x * len; out[1] = y * len; out[2] = z * len; }
            return out;
        }
    },
    radixSort: (indices, depths, count, auxIndices, auxDepths, counts) => {
        if (count <= 1) return indices;

        let sI = indices, dI = auxIndices;
        let sD = depths, dD = auxDepths;
        let sK = new Uint32Array(sD.buffer, sD.byteOffset, count);
        let dK = new Uint32Array(dD.buffer, dD.byteOffset, count);

        // Prep bitcasted depth for radix sort (handle negative floats)
        for (let i = 0; i < count; i++) {
            let v = sK[i];
            // If negative: flip all bits. If positive: flip sign bit.
            // This makes the float bit-patterns monotonic for Uint32 sorting.
            sK[i] = (v & 0x80000000) ? ~v : v ^ 0x80000000;
        }

        // 16-bit 2-pass radix sort
        for (let shift = 0; shift < 32; shift += 16) {
            counts.fill(0);
            for (let i = 0; i < count; i++) counts[(sK[i] >>> shift) & 0xFFFF]++;
            let pos = 0;
            for (let i = 0; i < 65536; i++) { let t = counts[i]; counts[i] = pos; pos += t; }
            for (let i = 0; i < count; i++) {
                let v = sK[i], dst = counts[(v >>> shift) & 0xFFFF]++;
                dK[dst] = v; dI[dst] = sI[i];
            }
            // Swap buffers
            let tI = sI; sI = dI; dI = tI;
            let tK = sK; sK = dK; dK = tK;
        }

        // Reverse back to Float bit pattern (optional, but keep consistent for return)
        for (let i = 0; i < count; i++) {
            let v = sK[i];
            sK[i] = (v & 0x80000000) ? v ^ 0x80000000 : ~v;
        }

        return sI;
    }
};
