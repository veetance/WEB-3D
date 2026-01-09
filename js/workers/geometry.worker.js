/**
 * VEETANCE Web Worker - Multi-core Geometry Processor
 */
self.onmessage = function (e) {
    const { task, data, config } = e.data;

    if (task === 'decimate') {
        try {
            const result = cluster(data, config.resolution, config.preserveEdges);
            if (!result || !result.vertices || result.vertices.length === 0) {
                throw new Error("Decimation produced empty mesh");
            }
            self.postMessage({ task: 'decimate_complete', result });
        } catch (err) {
            console.error("Worker Computation Error:", err);
            self.postMessage({ task: 'decimate_complete', result: data });
        }
    }

    // --- Barycentric Generator (Optimized: Purged Unroll) ---
    if (task === 'buffer_gen') {
        const indices = data.indices;
        const vertices = data.vertices;

        // We return the raw shared buffers. NO UNROLLING.
        // The engine now handles wireframes via a zero-bloat edge pass.
        self.postMessage({
            task: 'buffer_gen_complete',
            result: {
                vertices,
                indices,
                barycentric: null // Purged
            }
        }, [vertices.buffer, indices.buffer]);
    }
};

/**
 * C-Style Vertex Clustering (Copied from optimizer.js for Worker Context)
 * Operates on flat Int32/Float32 Arrays.
 */
function cluster(model, resolution, preserveEdges = false) {
    const { vertices, faces } = model;
    const vCount = vertices.length;

    // Bounds Check
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    // Create flat buffer
    const vFlat = new Float32Array(vCount * 3);

    for (let i = 0; i < vCount; i++) {
        const v = vertices[i];
        const i3 = i * 3;
        vFlat[i3] = v.x; vFlat[i3 + 1] = v.y; vFlat[i3 + 2] = v.z;
        if (v.x < minX) minX = v.x; if (v.y < minY) minY = v.y; if (v.z < minZ) minZ = v.z;
        if (v.x > maxX) maxX = v.x; if (v.y > maxY) maxY = v.y; if (v.z > maxZ) maxZ = v.z;
    }

    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    // If preserving edges (no averaging), we can afford slightly lower resolution for same look,
    // but usually user wants same grid.
    const cellSize = (maxDim / resolution) || 0.001;
    const invCell = 1.0 / cellSize;
    const tableSize = Math.floor(vCount * 1.5) + 1;
    const hashTable = new Int32Array(tableSize).fill(-1);

    // If preserveEdges is TRUE, we just keep the FIRST vertex we see in the cell.
    // This snaps geometry to the grid (voxelization style) but keeps original vertex data (crisp).
    // If FALSE, we Average all vertices (Standard Clustering), which smooths out details.

    // Arrays for Averaging (only used if !preserveEdges)
    const cellSums = preserveEdges ? null : new Float32Array(vCount * 3);
    const cellCounts = preserveEdges ? null : new Int32Array(vCount);

    // Array for Representative (used if preserveEdges)
    const cellRep = preserveEdges ? new Int32Array(vCount).fill(-1) : null;

    // Store Grid Coordinates for Topology Check [gx, gy, gz]
    // We cannot pre-allocate strict size easily without 2nd pass or over-allocating, 
    // but we know uniqueCellCount <= vCount.
    const cellCoords = new Int32Array(vCount * 3);

    const vertexMap = new Int32Array(vCount);
    let uniqueCellCount = 0;

    for (let i = 0; i < vCount; i++) {
        const px = vFlat[i * 3];
        const py = vFlat[i * 3 + 1];
        const pz = vFlat[i * 3 + 2];

        const gx = Math.floor((px - minX) * invCell);
        const gy = Math.floor((py - minY) * invCell);
        const gz = Math.floor((pz - minZ) * invCell);

        const p1 = 73856093;
        const p2 = 19349663;
        const p3 = 83492791;

        const h = ((gx * p1) ^ (gy * p2) ^ (gz * p3)) >>> 0;
        const hash = h % tableSize;

        let cellIdx = -1;
        let ptr = hashTable[hash];

        if (ptr === -1) {
            cellIdx = uniqueCellCount++;
            hashTable[hash] = cellIdx;

            // Store coords for topology check
            cellCoords[cellIdx * 3] = gx;
            cellCoords[cellIdx * 3 + 1] = gy;
            cellCoords[cellIdx * 3 + 2] = gz;
        } else {
            cellIdx = ptr;
        }

        vertexMap[i] = cellIdx;

        if (preserveEdges) {
            // Representative Mode:
            // If cell is empty, claim it. If occupied, ignore subsequent vertices (First-Come).
            // OR: Pick closest to center? 
            // First-Come is fastest and usually decent for random order.
            if (cellRep[cellIdx] === -1) {
                cellRep[cellIdx] = i; // This vertex 'i' becomes the representative
            }
        } else {
            // Averaging Mode:
            cellSums[cellIdx * 3] += px;
            cellSums[cellIdx * 3 + 1] += py;
            cellSums[cellIdx * 3 + 2] += pz;
            cellCounts[cellIdx]++;
        }
    }

    // Reconstruct Vertices
    const newVertices = new Array(uniqueCellCount);
    for (let i = 0; i < uniqueCellCount; i++) {
        if (preserveEdges) {
            // Use original vertex position
            const originalIdx = cellRep[i];
            // In rare hash collisions we might get -1 if logic flaw, but unlikely.
            // If originalIdx is -1, something wrong, but we can guard.
            if (originalIdx !== -1) {
                const x = vFlat[originalIdx * 3];
                const y = vFlat[originalIdx * 3 + 1];
                const z = vFlat[originalIdx * 3 + 2];
                newVertices[i] = { x, y, z };
            } else {
                newVertices[i] = { x: 0, y: 0, z: 0 };
            }
        } else {
            const count = cellCounts[i];
            newVertices[i] = {
                x: cellSums[i * 3] / count,
                y: cellSums[i * 3 + 1] / count,
                z: cellSums[i * 3 + 2] / count
            };
        }
    }

    // Reconstruct Faces with Topological Safety Check
    const newFaces = [];
    const seen = new Set();
    const facesLen = faces.length;

    for (let i = 0; i < facesLen; i++) {
        const f = faces[i];
        const mapped = [];
        // Map vertices
        for (let j = 0; j < f.length; j++) {
            const idx = vertexMap[f[j]];
            if (mapped.length === 0 || mapped[mapped.length - 1] !== idx) mapped.push(idx);
        }
        // Loop closure check
        if (mapped.length > 1 && mapped[0] === mapped[mapped.length - 1]) mapped.pop();

        if (mapped.length >= 3) {
            // --- TOPOLOGY SAFETY CHECK ---
            // Ensure no edge connects non-adjacent grid cells.
            // This kills the "long spikes" artifact where distant parts merge.
            let isSafe = true;
            for (let k = 0; k < mapped.length; k++) {
                const idxA = mapped[k];
                const idxB = mapped[(k + 1) % mapped.length];

                const ax = cellCoords[idxA * 3], ay = cellCoords[idxA * 3 + 1], az = cellCoords[idxA * 3 + 2];
                const bx = cellCoords[idxB * 3], by = cellCoords[idxB * 3 + 1], bz = cellCoords[idxB * 3 + 2];

                // Chebyshev distance check: if delta > 1 in any dimension, it's a jump
                if (Math.abs(ax - bx) > 1 || Math.abs(ay - by) > 1 || Math.abs(az - bz) > 1) {
                    isSafe = false;
                    break;
                }
            }

            if (isSafe) {
                const uid = mapped.slice().sort((a, b) => a - b).join('_');
                if (!seen.has(uid)) {
                    seen.add(uid);
                    newFaces.push(mapped);
                }
            }
        }
    }

    // 5. Post-Process: Prune Unused Vertices (Floating Point Removal)
    // The decimation process often leaves vertices that belonged to collapsed faces but are no longer used.

    // Mark used vertices
    const used = new Uint8Array(uniqueCellCount);
    const newFacesLen = newFaces.length;
    let usedCount = 0;

    for (let i = 0; i < newFacesLen; i++) {
        const f = newFaces[i];
        for (let j = 0; j < f.length; j++) {
            if (used[f[j]] === 0) {
                used[f[j]] = 1;
                usedCount++;
            }
        }
    }

    // Remap to compact array
    const finalVertices = new Array(usedCount);
    const remap = new Int32Array(uniqueCellCount).fill(-1);
    let nextIdx = 0;

    for (let i = 0; i < uniqueCellCount; i++) {
        if (used[i] === 1) {
            finalVertices[nextIdx] = newVertices[i];
            remap[i] = nextIdx;
            nextIdx++;
        }
    }

    // Update Faces with new indices
    const finalFaces = new Array(newFacesLen);
    for (let i = 0; i < newFacesLen; i++) {
        const f = newFaces[i];
        const newF = new Array(f.length);
        for (let j = 0; j < f.length; j++) {
            newF[j] = remap[f[j]];
        }
        finalFaces[i] = newF;
    }

    return { vertices: finalVertices, faces: finalFaces, buffer: vFlat.buffer };
}
