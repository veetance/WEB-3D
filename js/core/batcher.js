/**
 * VEETANCE Geometry Batcher
 * Consolidates multiple entities into a single vertex/index stream.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Batcher = (function () {
    const MathOps = window.ENGINE.MathOps;
    const mat4 = MathOps.mat4;

    function batchEntities(entities, buffers, mView, config = {}) {
        let vOffset = 0;
        let iOffset = 0;
        let sOffset = 0;
        let totalFCount = 0;
        const sBudget = config.pointBudget || 15000;

        const worldBuffer = buffers.world;
        const screenBuffer = buffers.screen;
        const intensityBuffer = buffers.intensity;
        const batchIndices = buffers.sortIndices; // We reuse sortIndices as a global index buffer for the batch

        const mModel = mat4.create();
        const mTotal = mat4.create();

        for (let eIdx = 0; eIdx < entities.length; eIdx++) {
            const entity = entities[eIdx];
            if (!entity.vertices || !entity.indices || !entity.visible) continue;

            const vCount = entity.vertices.length / 3;
            const fCount = entity.indices.length / 3;

            // 1. Calculate World-View Matrix for this entity
            mat4.identity(mModel);
            mat4.translate(mModel, mModel, entity.pos);
            // Assuming RotationCache is used or direct Euler
            if (window.ENGINE.RotationCache) {
                window.ENGINE.RotationCache.rotateX(mModel, mModel, entity.rot.x);
                window.ENGINE.RotationCache.rotateY(mModel, mModel, entity.rot.y);
                window.ENGINE.RotationCache.rotateZ(mModel, mModel, entity.rot.z);
            }
            mat4.scale(mModel, mModel, entity.scl);
            mat4.multiply(mTotal, mView, mModel);

            // 2. Transform vertices to World-View space and store in the global pool
            // We need a way to transform into a specific offset of the buffer
            transformToOffset(worldBuffer, entity.vertices, mTotal, vCount, vOffset);

            // 3. Map indices and UVs with offset
            const entityIndices = entity.indices;
            for (let i = 0; i < entityIndices.length; i++) {
                batchIndices[iOffset + i] = entityIndices[i] + vOffset;
            }

            if (entity.uvs) {
                buffers.uvs.set(entity.uvs, vOffset * 2);
            }

            if (entity.samples) {
                const remaining = sBudget - sOffset;
                if (remaining > 0) {
                    const sCount = Math.min(entity.samples.length / 3, remaining);
                    transformSamplesToOffset(buffers.sampledWorld, entity.samples, mTotal, sCount, sOffset);
                    sOffset += sCount;
                }
            }

            vOffset += vCount;
            iOffset += entityIndices.length;
            totalFCount += fCount;
        }

        return { vCount: vOffset, fCount: totalFCount, sCount: sOffset };
    }

    function transformSamplesToOffset(out, inp, m, count, offset) {
        const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3], m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7],
            m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11], m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];

        for (let i = 0; i < count; i++) {
            const ix = i * 3;
            const ox = (offset + i) * 4;
            const x = inp[ix], y = inp[ix + 1], z = inp[ix + 2];

            out[ox] = m00 * x + m10 * y + m20 * z + m30;
            out[ox + 1] = m01 * x + m11 * y + m21 * z + m31;
            out[ox + 2] = m02 * x + m12 * y + m22 * z + m32;
            out[ox + 3] = m03 * x + m13 * y + m23 * z + m33;
        }
    }

    function transformToOffset(out, inp, m, count, offset) {
        const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3], m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7],
            m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11], m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];

        for (let i = 0; i < count; i++) {
            const ix = i * 3;
            const ox = (offset + i) * 4;
            const x = inp[ix], y = inp[ix + 1], z = inp[ix + 2];

            out[ox] = m00 * x + m10 * y + m20 * z + m30;
            out[ox + 1] = m01 * x + m11 * y + m21 * z + m31;
            out[ox + 2] = m02 * x + m12 * y + m22 * z + m32;
            out[ox + 3] = m03 * x + m13 * y + m23 * z + m33;
        }
    }

    return { batchEntities };
})();
