/** 
 * VEETANCE Streaming Asset I/O (Worker Enhanced)
 * Uses high-speed Workers to parse chunked manifolds.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.StreamingTransfer = (function () {
    const store = window.ENGINE.Store;
    const CHUNK_SIZE = 1024 * 1024 * 4; // 4MB Chunks

    async function streamOBJ(file) {
        const overlay = document.getElementById('loading-overlay');
        const progress = document.getElementById('loader-progress');
        const text = document.querySelector('.loader-text');

        if (overlay) overlay.classList.remove('hidden');
        if (text) text.textContent = "DECONSTRUCTING MANIFOLD...";

        const worker = new Worker('js/workers/obj-parser.worker.js');
        let offset = 0;
        let leftover = "";

        const finalVerts = [];
        const finalIndices = [];

        return new Promise((resolve) => {
            worker.onmessage = (e) => {
                const { vertices, indices, leftover: nextLeftover } = e.data;
                leftover = nextLeftover;

                if (vertices.length) finalVerts.push(vertices);
                if (indices.length) finalIndices.push(indices);

                if (offset >= file.size) {
                    worker.terminate();
                    finalizeModel(finalVerts, finalIndices);
                    resolve();
                } else {
                    readNextChunk();
                }
            };

            const readNextChunk = async () => {
                const chunk = file.slice(offset, offset + CHUNK_SIZE);
                offset += CHUNK_SIZE;
                const chunkStr = await chunk.text();

                if (progress) progress.textContent = `PUMPING CHUNK: ${Math.min(100, Math.round((offset / file.size) * 100))}%`;

                worker.postMessage({ chunk: chunkStr, leftover });
            };

            const finalizeModel = (vArrays, iArrays) => {
                if (text) text.textContent = "STABILIZING GEOMETRY...";

                // Merge Typed Arrays
                const totalV = vArrays.reduce((s, a) => s + a.length, 0);
                const totalI = iArrays.reduce((s, a) => s + a.length, 0);

                const vFlat = new Float32Array(totalV);
                const iFlat = new Uint32Array(totalI);

                let vOffset = 0;
                for (const arr of vArrays) {
                    vFlat.set(arr, vOffset);
                    vOffset += arr.length;
                }

                let iOffset = 0;
                for (const arr of iArrays) {
                    iFlat.set(arr, iOffset);
                    iOffset += arr.length;
                }

                store.dispatch({
                    type: 'SET_MODEL',
                    payload: { vertices: vFlat, indices: iFlat }
                });

                if (overlay) overlay.classList.add('hidden');
            };

            readNextChunk();
        });
    }

    return { streamOBJ };
})();
