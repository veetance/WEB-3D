/** 
 * VEETANCE WASM Rasterizer Wrapper
 * Bridges the gap between JS types and C++ WASM machine.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.RasterizerWASM = (function () {
    let wasmModule = null;
    let isInitialized = false;

    // Buffer pointers in WASM heap
    let ptrs = {
        fb: 0,
        db: 0,
        world: 0,
        screen: 0,
        indices: 0,
        intensities: 0,
        sortedIndices: 0,
        auxIndices: 0,
        auxDepths: 0,
        radixCounts: 0,
        matrix: 0
    };

    // Buffer views into WASM heap
    let views = {
        world: null,
        screen: null,
        indices: null,
        intensities: null,
        sortedIndices: null,
        depths: null,
        auxIndices: null,
        matrix: null
    };

    const MAX_VERTICES = window.ENGINE.Config.MAX_VERTICES;
    const MAX_FACES = window.ENGINE.Config.MAX_FACES;
    const FB_SIZE = 1024 * 1024;

    const init = async () => {
        if (isInitialized) return;

        return new Promise((resolve) => {
            const check = () => {
                if (window.Module && window.Module._renderBatch && window.Module.HEAPU8) {
                    wasmModule = window.Module;
                    allocateBuffers();
                    isInitialized = true;

                    if (window.ENGINE.Pool) {
                        window.ENGINE.Pool.manifestWasmBuffers(views);
                    }

                    console.log("VEETANCE WASM Rasterizer Manifested. 🦾");
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    };

    function allocateBuffers() {
        // Arena Allocation Strategy (Contiguous Memory Layout)
        const sizes = {
            fb: FB_SIZE * 4,
            db: FB_SIZE * 4,
            world: MAX_VERTICES * 4 * 4,
            screen: MAX_VERTICES * 4 * 4,
            indices: MAX_FACES * 3 * 4,
            intensities: MAX_FACES * 4,
            sortedIndices: MAX_FACES * 4,
            auxIndices: MAX_FACES * 4,
            auxDepths: MAX_FACES * 4,
            radixCounts: 65536 * 4,
            matrix: 16 * 4
        };

        const totalSize = Object.values(sizes).reduce((a, b) => a + b, 0);
        const basePtr = wasmModule._malloc(totalSize);

        console.log(`[DEUS] Arena Allocated: ${(totalSize / 1024 / 1024).toFixed(2)} MB at 0x${basePtr.toString(16)}`);

        let offset = 0;
        ptrs.fb = basePtr + offset; offset += sizes.fb;
        ptrs.db = basePtr + offset; offset += sizes.db;
        ptrs.world = basePtr + offset; offset += sizes.world;
        ptrs.screen = basePtr + offset; offset += sizes.screen;
        ptrs.indices = basePtr + offset; offset += sizes.indices;
        ptrs.intensities = basePtr + offset; offset += sizes.intensities;
        ptrs.sortedIndices = basePtr + offset; offset += sizes.sortedIndices;
        ptrs.auxIndices = basePtr + offset; offset += sizes.auxIndices;
        ptrs.auxDepths = basePtr + offset; offset += sizes.auxDepths;
        ptrs.radixCounts = basePtr + offset; offset += sizes.radixCounts;
        ptrs.matrix = basePtr + offset; offset += sizes.matrix;

        updateViews();
    }

    function updateViews() {
        const buf = wasmModule.HEAPU8.buffer;
        views.world = new Float32Array(buf, ptrs.world, MAX_VERTICES * 4);
        views.screen = new Float32Array(buf, ptrs.screen, MAX_VERTICES * 4);
        views.indices = new Uint32Array(buf, ptrs.indices, MAX_FACES * 3);
        views.intensities = new Float32Array(buf, ptrs.intensities, MAX_FACES);
        views.sortedIndices = new Uint32Array(buf, ptrs.sortedIndices, MAX_FACES);
        views.depths = new Float32Array(buf, ptrs.auxDepths, MAX_FACES);
        views.auxIndices = new Uint32Array(buf, ptrs.auxIndices, MAX_FACES);
        views.matrix = new Float32Array(buf, ptrs.matrix, 16);
    }

    function clearHW(width, height) {
        if (!isInitialized) return;
        wasmModule._clearBuffers(ptrs.fb, ptrs.db, width, height);
    }

    // --- High Speed Pipeline Calls ---

    function transform(vertices, matrix) {
        if (!isInitialized) return;
        // Vertices are still in JS? Let's check. 
        // We usually upload indices once. Vertices might change.
        // For now, let's assume they are already in views.world or we copy them once.
        views.matrix.set(matrix);
        // We need a pointer to the original input vertices.
        // For zero-copy, the raw vertices (from OBJ loader) should be in the WASM heap.
        // Let's create a temporary buffer for input vertices if they aren't in the heap.
    }

    // Direct C++ Pipeline
    function processVertices(inpPtr, matrix, count) {
        views.matrix.set(matrix);
        wasmModule._transformBuffer(ptrs.world, inpPtr, ptrs.matrix, count);
    }

    function project(count, width, height, fov) {
        wasmModule._projectBuffer(ptrs.screen, count, width, height, fov);
    }

    function processFaces(fCount, lightDir, isWire, width, height, density) {
        return wasmModule._processFaces(
            ptrs.screen, ptrs.world, ptrs.indices,
            ptrs.auxDepths, ptrs.sortedIndices, ptrs.intensities,
            fCount, lightDir[0], lightDir[1], lightDir[2], isWire,
            width, height, density
        );
    }

    function sortFaces(fCount) {
        wasmModule._radixSort(ptrs.sortedIndices, ptrs.auxDepths, fCount, ptrs.auxIndices, ptrs.intensities, ptrs.radixCounts);
        return views.sortedIndices.subarray(0, fCount);
    }

    function render(ctx, fCount, config, width, height, frontToBack = false) {
        const baseColor = config.polyColor || '#1a1a1a';
        const r = parseInt(baseColor.slice(1, 3), 16), g = parseInt(baseColor.slice(3, 5), 16), b = parseInt(baseColor.slice(5, 7), 16);
        wasmModule._renderBatch(ptrs.fb, ptrs.db, ptrs.screen, ptrs.indices, ptrs.intensities, ptrs.sortedIndices, fCount, r, g, b, width, height, frontToBack);
    }

    function flush(ctx, width, height) {
        if (!offscreenCanvas || offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = width;
            offscreenCanvas.height = height;
            offscreenCtx = offscreenCanvas.getContext('2d');
        }
        const fbView = new Uint8ClampedArray(wasmModule.HEAPU8.buffer, ptrs.fb, width * height * 4);
        const imgData = new ImageData(fbView, width, height);
        offscreenCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(offscreenCanvas, 0, 0);
    }

    let offscreenCanvas = null, offscreenCtx = null;

    // Direct memory access for Loader
    function getVertexPointer(count) {
        return wasmModule._malloc(count * 3 * 4);
    }

    return {
        init, render, clearHW, flush, sortFaces,
        processVertices, project, processFaces,
        getViews: () => views,
        uploadIndices: (indices) => views.indices.set(indices),
        isReady: () => isInitialized,
        malloc: (size) => wasmModule._malloc(size)
    };
})();
