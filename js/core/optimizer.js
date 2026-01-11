/**
 * VEETANCE Logic Engine - Geometry Optimizer
 * High-performance mesh decimation via Grid-Based Vertex Clustering.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.Optimizer = {
    /**
     * Reduces mesh complexity by merging vertices within grid cells.
     * @param {Float32Array} vertices
     * @param {Uint16Array|Uint32Array} indices
     * @param {number} strength - 10 to 100 (higher = more reduction)
     */
    cluster: (vertices, indices, strength) => {
        const vCount = vertices.length / 3;
        const fCount = indices.length / 3;

        // Calculate Grid Resolution (Coarseness)
        // Strength 10 (Fine) to 100 (Coarse)
        const resolution = 1 / (strength * 0.01);

        const grid = new Map();
        const newVertices = [];
        const vertexMap = new Int32Array(vCount); // Old Index -> New Index

        // 1. Cluster Vertices
        for (let i = 0; i < vCount; i++) {
            const ix = i * 3;
            const x = vertices[ix], y = vertices[ix + 1], z = vertices[ix + 2];

            // Quantize to grid
            const qx = Math.round(x * resolution);
            const qy = Math.round(y * resolution);
            const qz = Math.round(z * resolution);
            const key = `${qx}_${qy}_${qz}`;

            if (!grid.has(key)) {
                const newIdx = newVertices.length / 3;
                grid.set(key, newIdx);
                newVertices.push(x, y, z);
                vertexMap[i] = newIdx;
            } else {
                vertexMap[i] = grid.get(key);
            }
        }

        // 2. Re-index and Cull Degenerate Faces
        const newIndices = [];
        for (let i = 0; i < fCount; i++) {
            const i3 = i * 3;
            const a = vertexMap[indices[i3]];
            const b = vertexMap[indices[i3 + 1]];
            const c = vertexMap[indices[i3 + 2]];

            // Only add faces that are not collapsed to points or lines
            if (a !== b && b !== c && c !== a) {
                newIndices.push(a, b, c);
            }
        }

        return {
            vertices: new Float32Array(newVertices),
            indices: indices.constructor === Uint16Array ? new Uint16Array(newIndices) : new Uint32Array(newIndices)
        };
    },

    /**
     * Fragments a mesh into localized packets for Cluster Culling.
     * @param {Float32Array} vertices 
     * @param {Uint32Array} indices 
     * @param {number} trianglesPerCluster 
     */
    buildClusters: (vertices, indices, trianglesPerCluster = 64) => {
        const fCount = indices.length / 3;
        const clusters = [];

        for (let i = 0; i < fCount; i += trianglesPerCluster) {
            const count = Math.min(trianglesPerCluster, fCount - i);
            const clusterIndices = new Uint32Array(count * 3);

            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

            for (let j = 0; j < count; j++) {
                const fIdx = (i + j) * 3;
                const a = indices[fIdx], b = indices[fIdx + 1], c = indices[fIdx + 2];
                clusterIndices[j * 3] = a;
                clusterIndices[j * 3 + 1] = b;
                clusterIndices[j * 3 + 2] = c;

                // Expand Bounding Box
                for (const idx of [a, b, c]) {
                    const ix = idx * 3;
                    const x = vertices[ix], y = vertices[ix + 1], z = vertices[ix + 2];
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
                }
            }

            const cx = (minX + maxX) * 0.5, cy = (minY + maxY) * 0.5, cz = (minZ + maxZ) * 0.5;
            let radiusSq = 0;
            for (let j = 0; j < count * 3; j++) {
                const idx = clusterIndices[j] * 3;
                const dx = vertices[idx] - cx, dy = vertices[idx + 1] - cy, dz = vertices[idx + 2] - cz;
                radiusSq = Math.max(radiusSq, dx * dx + dy * dy + dz * dz);
            }

            clusters.push({
                indices: clusterIndices,
                aabb: [minX, minY, minZ, maxX, maxY, maxZ],
                sphere: [cx, cy, cz, Math.sqrt(radiusSq)],
                startFace: i,
                faceCount: count
            });
        }

        console.log(`VFE: Manifold Decomposed into ${clusters.length} Clusters.`);
        return clusters;
    }
};
