/**
 * VEETANCE Logic Engine - Model Parsers (Buffer Optimized)
 * Outputs Float32Array and Uint32Array directly.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Parser = {
    /**
     * Parse OBJ to Buffers
     */
    parseOBJ: (arrayBuffer) => {
        const decoder = new TextDecoder();
        const text = decoder.decode(arrayBuffer);

        const lines = text.split('\n');
        const positions = []; // Temp [x,y,z, x,y,z...]
        const indices = [];   // Temp [i,j,k...]

        // Output buffers
        // We do a naive parse first because OBJ counts are unknown

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line.startsWith('v ')) {
                const parts = line.split(/\s+/);
                positions.push(parseFloat(parts[1]));
                positions.push(parseFloat(parts[2]));
                positions.push(parseFloat(parts[3]));
            } else if (line.startsWith('f ')) {
                const parts = line.split(/\s+/);
                const face = [];
                for (let j = 1; j < parts.length; j++) {
                    const p = parts[j];
                    const vIdx = parseInt(p.split('/')[0]);
                    // OBJ is 1-indexed
                    if (vIdx < 0) face.push((positions.length / 3) + vIdx); // Relative
                    else face.push(vIdx - 1);
                }

                // Triangulate Fan
                for (let j = 1; j < face.length - 1; j++) {
                    indices.push(face[0]);
                    indices.push(face[j]);
                    indices.push(face[j + 1]);
                }
            }
        }

        const vArr = new Float32Array(positions);
        const iArr = new Uint32Array(indices);

        console.log(`VFE Logic: Ingested ${vArr.length / 3} vertices, ${iArr.length / 3} triangles.`);
        return window.ENGINE.Parser.normalizeAndCenter(vArr, iArr, false); // No rotation for OBJ
    },

    /**
     * Parse GLB to Buffers
     */
    parseGLB: (arrayBuffer) => {
        const view = new DataView(arrayBuffer);
        const magic = view.getUint32(0, true);
        if (magic !== 0x46546c67) throw new Error('Invalid GLB magic');

        const jsonChunkLen = view.getUint32(12, true);
        const jsonBytes = new Uint8Array(arrayBuffer, 20, jsonChunkLen);
        const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

        const binChunkStart = 20 + jsonChunkLen;
        const binChunkLen = view.getUint32(binChunkStart, true);
        const binDataStart = binChunkStart + 8;

        // We expect 1 mesh, primitives
        // Flattening all primitives into one buffer

        let allPos = [];
        let allInd = [];
        let vertexOffset = 0;

        for (const mesh of gltf.meshes) {
            for (const prim of mesh.primitives) {
                // Pos Accessor
                const accPos = gltf.accessors[prim.attributes.POSITION];
                const bufPos = gltf.bufferViews[accPos.bufferView];

                const posOffset = binDataStart + (bufPos.byteOffset || 0) + (accPos.byteOffset || 0);

                // Safety: Extract Float32
                // GLB is Little Endian usually.
                // If stride is 12, we can just copy. If standard gltf, usually tight packed.

                // Just read loop for safety against strides
                const posData = new DataView(arrayBuffer, posOffset, accPos.count * 12); // 3 * 4 bytes
                for (let k = 0; k < accPos.count; k++) {
                    const x = posData.getFloat32(k * 12, true);
                    const y = posData.getFloat32(k * 12 + 4, true);
                    const z = posData.getFloat32(k * 12 + 8, true);
                    allPos.push(x, y, z);
                }

                // Indices
                if (prim.indices !== undefined) {
                    const accInd = gltf.accessors[prim.indices];
                    const bufInd = gltf.bufferViews[accInd.bufferView];
                    const indOffset = binDataStart + (bufInd.byteOffset || 0) + (accInd.byteOffset || 0);

                    const compSize = accInd.componentType === 5123 ? 2 : (accInd.componentType === 5125 ? 4 : 1);
                    const indData = new DataView(arrayBuffer, indOffset, accInd.count * compSize);

                    for (let k = 0; k < accInd.count; k++) {
                        let idx = 0;
                        if (compSize === 2) idx = indData.getUint16(k * 2, true);
                        else if (compSize === 4) idx = indData.getUint32(k * 4, true);
                        else idx = indData.getUint8(k);

                        allInd.push(idx + vertexOffset);
                    }
                } else {
                    // No indices
                    const count = accPos.count;
                    for (let k = 0; k < count; k++) allInd.push(k + vertexOffset);
                }

                vertexOffset += accPos.count;
            }
        }

        const vArr = new Float32Array(allPos);
        const iArr = new Uint32Array(allInd);

        console.log(`VFE Logic (GLB): ${vArr.length / 3} vertices, ${iArr.length / 3} triangles.`);
        return window.ENGINE.Parser.normalizeAndCenter(vArr, iArr, true); // GLB Rotate Y-Up correction
    },

    normalizeAndCenter: (vertices, indices, rotateYUp) => {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        // Bounds
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }

        const range = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
        const scale = 1.0 / range;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const cz = (minZ + maxZ) / 2;

        // Apply Transform
        for (let i = 0; i < vertices.length; i += 3) {
            let x = vertices[i];
            let y = vertices[i + 1];
            let z = vertices[i + 2];

            if (rotateYUp) {
                // Rotation Fix (GLB Y-Up -> Z-Up)
                const ox = (x - cx) * scale;
                const oy = (y - cy) * scale;
                const oz = (z - cz) * scale;

                vertices[i] = ox;
                vertices[i + 1] = oz;
                vertices[i + 2] = -oy;
            } else {
                vertices[i] = (x - cx) * scale;
                vertices[i + 1] = (y - cy) * scale;
                vertices[i + 2] = (z - cz) * scale;
            }
        }

        return { vertices, indices };
    },

    /**
     * Export Buffers to OBJ String
     */
    exportOBJ: (vertices, indices) => {
        let obj = "# VEETANCE Manifold Export\n";
        for (let i = 0; i < vertices.length; i += 3) {
            obj += `v ${vertices[i].toFixed(6)} ${vertices[i + 1].toFixed(6)} ${vertices[i + 2].toFixed(6)}\n`;
        }
        for (let i = 0; i < indices.length; i += 3) {
            // OBJ is 1-indexed
            obj += `f ${indices[i] + 1} ${indices[i + 1] + 1} ${indices[i + 2] + 1}\n`;
        }
        return obj;
    }
};
