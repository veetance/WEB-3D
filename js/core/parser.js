/**
 * VEETANCE Logic Engine - Model Parsers (Manifold Edition)
 * Synchronized for Z-UP standards.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Parser = (function () {
    const MathOps = window.ENGINE.MathOps;
    const mat4 = MathOps.mat4;

    /**
     * Common Normalization & Transform Utility
     */
    function finalizeManifold(vertices, indices, isGLB) {
        if (vertices.length === 0) return { vertices, indices, centroid: { x: 0, y: 0, z: 0 } };

        // Pass 1: Bounding Box
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }

        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
        const maxRange = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
        const scale = 6.0 / maxRange;

        // Pass 2: Sovereign Orientation & Transformation
        let sx = 0, sy = 0, sz = 0;
        let pZ = Infinity;
        const len = vertices.length;

        for (let i = 0; i < len; i += 3) {
            const tx = (vertices[i] - cx) * scale;
            const ty = (vertices[i + 1] - cy) * scale;
            const tz = (vertices[i + 2] - cz) * scale;
            const nx = tx, ny = -tz, nz = ty;
            vertices[i] = nx; vertices[i + 1] = ny; vertices[i + 2] = nz;
            sx += nx; sy += ny; sz += nz;
            if (nz < pZ) pZ = nz;
        }

        const vCount = len / 3;
        for (let i = 2; i < len; i += 3) vertices[i] -= pZ;

        const centroid = { x: sx / vCount, y: sy / vCount, z: (sz / vCount) - pZ };

        // EXTREME OPTIMIZATION: Move vertices to WASM heap immediately
        const WASM = window.ENGINE.RasterizerWASM;
        let wasmPtr = null;
        if (WASM && WASM.isReady()) {
            wasmPtr = WASM.malloc(vertices.byteLength);
            const heapView = new Float32Array(window.Module.HEAPU8.buffer, wasmPtr, vertices.length);
            heapView.set(vertices);
        }

        return { vertices, indices, centroid, wasmPtr };
    }

    return {
        // ... parseOBJ and parseGLB contents as before, just using finalizeManifold ...
        parseOBJ: (arrayBuffer) => {
            const decoder = new TextDecoder();
            const text = decoder.decode(arrayBuffer);
            const lines = text.split('\n');
            const positions = [];
            const indices = [];

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (line.startsWith('v ')) {
                    const parts = line.split(/\s+/);
                    positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
                } else if (line.startsWith('f ')) {
                    const parts = line.split(/\s+/);
                    const face = [];
                    for (let j = 1; j < parts.length; j++) {
                        const p = parts[j];
                        const vIdx = parseInt(p.split('/')[0]);
                        if (vIdx < 0) face.push((positions.length / 3) + vIdx);
                        else face.push(vIdx - 1);
                    }
                    for (let j = 1; j < face.length - 1; j++) {
                        indices.push(face[0], face[j], face[j + 1]);
                    }
                }
            }
            return finalizeManifold(new Float32Array(positions), new Uint32Array(indices), false);
        },

        parseGLB: (arrayBuffer) => {
            const view = new DataView(arrayBuffer);
            const magic = view.getUint32(0, true);
            if (magic !== 0x46546c67) throw new Error('Invalid GLB magic');

            const jsonLen = view.getUint32(12, true);
            const jsonBytes = new Uint8Array(arrayBuffer, 20, jsonLen);
            const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

            const jsonPadding = (4 - (jsonLen % 4)) % 4;
            const binHeaderStart = 20 + jsonLen + jsonPadding;
            const binDataStart = binHeaderStart + 8;

            const allV = [];
            const allI = [];
            let vCount = 0;

            const processNode = (nodeIdx, parentMatrix) => {
                const node = gltf.nodes[nodeIdx];
                const matrix = mat4.create();

                if (node.matrix) {
                    matrix.set(node.matrix);
                } else {
                    const t = node.translation || [0, 0, 0], r = node.rotation || [0, 0, 0, 1], s = node.scale || [1, 1, 1];
                    // Manual compose (simplified logic for VFE) - only matrix for now
                }

                mat4.multiply(matrix, parentMatrix, matrix);

                if (node.mesh !== undefined) {
                    const mesh = gltf.meshes[node.mesh];
                    for (const prim of mesh.primitives) {
                        const accPos = gltf.accessors[prim.attributes.POSITION];
                        const viewPos = gltf.bufferViews[accPos.bufferView];
                        const stride = viewPos.byteStride || 12;
                        const startPos = binDataStart + (viewPos.byteOffset || 0) + (accPos.byteOffset || 0);

                        for (let k = 0; k < accPos.count; k++) {
                            const offset = startPos + k * stride;
                            const vx = view.getFloat32(offset, true);
                            const vy = view.getFloat32(offset + 4, true);
                            const vz = view.getFloat32(offset + 8, true);

                            const tx = matrix[0] * vx + matrix[4] * vy + matrix[8] * vz + matrix[12];
                            const ty = matrix[1] * vx + matrix[5] * vy + matrix[9] * vz + matrix[13];
                            const tz = matrix[2] * vx + matrix[6] * vy + matrix[10] * vz + matrix[14];

                            allV.push(tx, ty, tz);
                        }

                        if (prim.indices !== undefined) {
                            const accInd = gltf.accessors[prim.indices];
                            const viewInd = gltf.bufferViews[accInd.bufferView];
                            const startInd = binDataStart + (viewInd.byteOffset || 0) + (accInd.byteOffset || 0);
                            const compType = accInd.componentType;

                            for (let k = 0; k < accInd.count; k++) {
                                let idx = 0;
                                if (compType === 5123) idx = view.getUint16(startInd + k * 2, true);
                                else if (compType === 5125) idx = view.getUint32(startInd + k * 4, true);
                                else if (compType === 5121) idx = view.getUint8(startInd + k);
                                allI.push(idx + vCount);
                            }
                        } else {
                            for (let k = 0; k < accPos.count; k++) allI.push(k + vCount);
                        }
                        vCount += accPos.count;
                    }
                }

                if (node.children) {
                    for (const childIdx of node.children) processNode(childIdx, matrix);
                }
            };

            const scene = gltf.scenes[gltf.scene || 0];
            for (const nodeIdx of scene.nodes) processNode(nodeIdx, mat4.create());

            return finalizeManifold(new Float32Array(allV), new Uint32Array(allI), true);
        },
        finalizeManifold
    };
})();
