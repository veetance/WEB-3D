/** 
 * VEETANCE WASM Rasterizer Wrapper
 * Bridges the gap between JS types and C++ WASM machine.
 */
window.ENGINE = window.ENGINE || {};
window.ENGINE.RasterizerWASM = (function () {
    let wasmModule = null;

    // Buffer pointers in WASM heap
    let ptrs = {
        pixels: 0,
        world: 0,
        screen: 0,
        indices: 0,
        intensities: 0,
        vertexIntensities: 0,
        faceColors: 0,
        sortedIndices: 0,
        depths: 0,
        auxIndices: 0,
        auxDepths: 0,
        radixCounts: 0,
        matrix: 0,
        rawVertices: 0
    };

    // Buffer views into WASM heap
    let views = {
        world: null,
        screen: null,
        indices: null,
        intensities: null,
        vertexIntensities: null,
        faceColors: null,
        sortedIndices: null,
        depths: null,
        auxIndices: null,
        matrix: null,
        rawVertices: null
    };

    let workers = [];
    let isInitialized = false;

    const MAX_VERTICES = window.ENGINE.Config.MAX_VERTICES;
    const MAX_FACES = window.ENGINE.Config.MAX_FACES;
    const FB_SIZE = 2560 * 1600; // Match expanded kernel
    const TILE_SIZE = 128;

    const init = async () => {
        if (isInitialized) {
            console.log("[DEUS] Already initialized. Skipping.");
            return;
        }

        console.log("[DEUS] Initializing WASM wrapper...");

        return new Promise((resolve) => {
            let attempts = 0;
            const check = async () => {
                attempts++;
                const hasMemory = !!(window.Module && (window.Module.HEAPU8 || window.Module.wasmMemory));
                console.log(`[DEUS] Check #${attempts}: Module=${!!window.Module}, _renderBatch=${!!(window.Module && window.Module._renderBatch)}, Memory=${hasMemory}`);

                if (window.Module && window.Module._renderBatch && hasMemory) {
                    wasmModule = window.Module;
                    allocateBuffers();
                    await spawnWorkers();
                    isInitialized = true;
                    console.log("VEETANCE Multiverse Manifested. 🦾⚡");
                    resolve();
                } else {
                    if (attempts > 50) {
                        console.error("[DEUS] WASM module failed to load after 50 attempts (10 seconds).");
                        resolve();
                    } else {
                        setTimeout(check, 200);
                    }
                }
            };
            check();
        });
    };

    function allocateBuffers() {
        // Get buffer addresses from C++ static globals
        ptrs.pixels = wasmModule._getPixelBuffer();
        ptrs.rawVertices = wasmModule._getRawVerticesBuffer();
        ptrs.world = wasmModule._getWorldBuffer();
        ptrs.screen = wasmModule._getScreenBuffer();
        ptrs.indices = wasmModule._getIndicesBuffer();
        ptrs.intensities = wasmModule._getIntensitiesBuffer();
        ptrs.vertexIntensities = wasmModule._getVertexIntensitiesBuffer();
        ptrs.faceColors = wasmModule._getFaceColorsBuffer();
        ptrs.depths = wasmModule._getDepthsBuffer();
        ptrs.sortedIndices = wasmModule._getSortedIndicesBuffer();
        ptrs.auxIndices = wasmModule._getAuxIndicesBuffer();
        ptrs.auxDepths = wasmModule._getAuxDepthsBuffer();
        ptrs.radixCounts = wasmModule._getRadixCountsBuffer();
        ptrs.matrix = wasmModule._getMatrixBuffer();
        ptrs.tiles = wasmModule._getTilesBuffer();
        ptrs.outFB = wasmModule._getOutFBBuffer();

        const buf = wasmModule.HEAPU8.buffer;
        views.world = new Float32Array(buf, ptrs.world, MAX_VERTICES * 4);
        views.screen = new Float32Array(buf, ptrs.screen, MAX_VERTICES * 4);
        views.indices = new Uint32Array(buf, ptrs.indices, MAX_FACES * 3);
        views.intensities = new Float32Array(buf, ptrs.intensities, MAX_FACES);
        views.vertexIntensities = new Float32Array(buf, ptrs.vertexIntensities, MAX_VERTICES);
        views.faceColors = new Uint32Array(buf, ptrs.faceColors, MAX_FACES);
        views.depths = new Float32Array(buf, ptrs.depths, MAX_FACES);
        views.sortedIndices = new Uint32Array(buf, ptrs.sortedIndices, MAX_FACES);
        views.auxIndices = new Uint32Array(buf, ptrs.auxIndices, MAX_FACES);
        views.auxDepths = new Float32Array(buf, ptrs.auxDepths, MAX_FACES);
        views.matrix = new Float32Array(buf, ptrs.matrix, 16);
        views.rawVertices = new Float32Array(buf, ptrs.rawVertices, MAX_VERTICES * 3);

        if (window.ENGINE.Pool && window.ENGINE.Pool.manifestWasmBuffers) {
            window.ENGINE.Pool.manifestWasmBuffers(views);
        }
        console.log("[DEUS] Buffer addresses mapped:", ptrs);
    }

    const spawnWorkers = async () => {
        if (typeof SharedArrayBuffer === 'undefined') {
            console.warn("VEETANCE: SharedArrayBuffer missing. Multi-core resonance disabled.");
            workers = [];
            return;
        }
        const coreCount = navigator.hardwareConcurrency || 4;
        const version = '5'; // Cache bust - incremented for stride fix
        const wasmJsUrl = `${location.origin}/js/core/wasm/rasterizer_v2.js?v=${version}`;
        const binaryResp = await fetch(`${location.origin}/js/core/wasm/rasterizer_v2.wasm?v=${version}`);
        if (!binaryResp.ok) throw new Error("WASM binary fetch failed");
        const wasmBinary = await binaryResp.arrayBuffer();
        const sharedMemory = wasmModule.wasmMemory;

        console.log(`[DEUS] Spawning Legion of ${coreCount} workers...`);

        const spawnPromises = [];
        for (let i = 0; i < coreCount; i++) {
            const worker = new Worker('./js/core/wasm/rasterizer-worker.js');
            const readyPromise = new Promise((resolve) => {
                const timeout = setTimeout(() => resolve(null), 2000);
                worker.onmessage = (e) => {
                    if (e.data.action === 'READY') {
                        clearTimeout(timeout);
                        resolve(worker);
                    }
                };
                worker.postMessage({
                    action: 'INIT',
                    data: { wasmJsUrl, wasmBinary, sharedMemory }
                });
            });
            spawnPromises.push(readyPromise);
        }

        const results = await Promise.all(spawnPromises);
        workers = results.filter(w => w !== null);
        console.log(`[DEUS] Legion of ${workers.length} cores active. 🦾`);
    };

    function render(ctx, validFaces, config, width, height, isUV) {
        if (!isInitialized) return Promise.resolve();

        const baseColor = config.polyColor || '#474747';
        const r = parseInt(baseColor.slice(1, 3), 16), g = parseInt(baseColor.slice(3, 5), 16), b = parseInt(baseColor.slice(5, 7), 16);
        const wasmColor = 0xFF000000 | (r << 16) | (g << 8) | b;  // Standard 0xFFRRGGBB for WASM extraction logic

        // --- SEQUENTIAL TILED FALLBACK (The Scalar Path) ---
        if (true || workers.length === 0) {
            // Bin faces into tiles (Main Thread)
            wasmModule._binFaces(ptrs.tiles, ptrs.screen, ptrs.indices, ptrs.sortedIndices, validFaces, width, height);

            const tilesX = Math.ceil(width / TILE_SIZE);
            const tilesY = Math.ceil(height / TILE_SIZE);
            const totalTiles = tilesX * tilesY;
            if (config.debug) console.log(`[DEUS] Scalar Rendering ${totalTiles} tiles...`);

            for (let i = 0; i < totalTiles; i++) {
                const isUV = config.viewMode === 'UV';
                const isNormal = config.viewMode === 'NORMALS';
                wasmModule._renderTile(
                    ptrs.pixels, ptrs.tiles, i, ptrs.screen, ptrs.indices,
                    ptrs.intensities, ptrs.faceColors, wasmColor,
                    width, height, isUV || isNormal
                );
            }
            return Promise.resolve();
        }

        // 1. Bin faces into tiles (Main Thread)
        wasmModule._binFaces(
            ptrs.tiles, ptrs.screen, ptrs.indices, ptrs.sortedIndices,
            validFaces, width, height
        );

        // 2. Parallel Core Dispatch
        const TILE_SIZE_CONSTANT = 128;
        const tilesX = Math.ceil(width / TILE_SIZE_CONSTANT);
        const tilesY = Math.ceil(height / TILE_SIZE_CONSTANT);
        const totalTiles = tilesX * tilesY;

        const framePromises = [];
        const frameTimeout = 50; // ms safety timeout per tile batch

        for (let i = 0; i < totalTiles; i++) {
            const worker = workers[i % workers.length];
            const p = new Promise(resolve => {
                const timeout = setTimeout(() => {
                    worker.removeEventListener('message', handler);
                    resolve(); // Soft resolve to unblock loop
                }, frameTimeout);

                const handler = (e) => {
                    if (e.data.action === 'TILE_DONE' && e.data.tileIdx === i) {
                        clearTimeout(timeout);
                        worker.removeEventListener('message', handler);
                        resolve();
                    }
                };
                worker.addEventListener('message', handler);
            });

            const isUV = config.viewMode === 'UV';
            const isNormal = config.viewMode === 'NORMALS';
            worker.postMessage({
                action: 'RENDER_TILE',
                data: { tileIdx: i, ptrs, width, height, baseColor: wasmColor, isUV: isUV || isNormal }
            });
            framePromises.push(p);
        }
        return Promise.all(framePromises);
    }

    function clearHW(width, height) {
        if (!isInitialized) return;
        wasmModule._clearBuffers(ptrs.pixels, width, height);
    }

    function renderWire(validFaces, color, width, height, density) {
        if (!isInitialized) return;
        wasmModule._renderWireframe(ptrs.pixels, ptrs.screen, ptrs.indices, ptrs.sortedIndices, validFaces, color, width, height, density);
    }

    function flush(ctx, width, height) {
        if (!offscreenCanvas || offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = width;
            offscreenCanvas.height = height;
            offscreenCtx = offscreenCanvas.getContext('2d');
            offscreenImgData = offscreenCtx.createImageData(width, height);
            offscreenU32 = new Uint32Array(offscreenImgData.data.buffer);
        }
        if (!ptrs.outFB) ptrs.outFB = wasmModule._malloc(FB_SIZE * 4);

        wasmModule._extractColors(ptrs.pixels, ptrs.outFB, width, height);
        const extractView = new Uint32Array(wasmModule.HEAPU8.buffer, ptrs.outFB, width * height);

        if (window.ENGINE.Config.debug && Math.random() < 0.01) {
            let nonZero = 0;
            for (let i = 0; i < extractView.length; i++) if (extractView[i] !== 0) nonZero++;
            console.log(`[DEUS] Flush Diagnostic: Extracted ${nonZero} colored pixels.`);
        }

        offscreenU32.set(extractView);
        offscreenCtx.putImageData(offscreenImgData, 0, 0);
        ctx.drawImage(offscreenCanvas, 0, 0);
    }

    let offscreenCanvas = null, offscreenCtx = null, offscreenImgData = null, offscreenU32 = null;

    return {
        init, render, renderWire, clearHW, flush,
        processVertices: (vertices, matrix, count) => {
            views.matrix.set(matrix);
            if (vertices instanceof Float32Array) {
                views.rawVertices.set(vertices);
                wasmModule._transformBuffer(ptrs.world, ptrs.rawVertices, ptrs.matrix, count);
            } else {
                wasmModule._transformBuffer(ptrs.world, vertices, ptrs.matrix, count);
            }
        },
        project: (count, width, height, fov) => wasmModule._projectBuffer(ptrs.screen, ptrs.world, count, width, height, fov),
        getWorkerCount: () => workers.length,
        processFaces: (fIdx, lightDir, isWire, width, height, viewMode) => {
            const isUV = viewMode === 'UV';
            const isNormal = viewMode === 'NORMALS';
            return wasmModule._processFacesSIMD(ptrs.screen, ptrs.world, ptrs.indices, ptrs.depths, ptrs.sortedIndices, ptrs.intensities, ptrs.faceColors, fIdx, lightDir[0], lightDir[1], lightDir[2], isWire, isUV, isNormal, width, height);
        },
        sortFaces: (fCount) => {
            wasmModule._radixSort(ptrs.sortedIndices, ptrs.depths, fCount, ptrs.auxIndices, ptrs.auxDepths, ptrs.radixCounts);
            return views.sortedIndices.subarray(0, fCount);
        },
        getViews: () => views,
        uploadIndices: (indices) => views.indices.set(indices),
        getIndicesView: () => views.indices,
        uploadClusters: (clusters) => {
            const count = clusters.length;
            const ptr = wasmModule._malloc(count * 48); // 12 floats (48 bytes) per cluster
            const view = new Float32Array(wasmModule.HEAPU8.buffer, ptr, count * 12);
            for (let i = 0; i < count; i++) {
                const c = clusters[i];
                const off = i * 12;
                view.set(c.aabb, off);
                view.set(c.sphere, off + 6);
                const u32 = new Uint32Array(wasmModule.HEAPU8.buffer, ptr + (off + 10) * 4, 2);
                u32[0] = c.startFace;
                u32[1] = c.faceCount;
            }
            wasmModule._uploadClusters(ptr, count);
            wasmModule._free(ptr);
        },
        processClusters: (matrix, fIdx, lightDir, isWire, isUV, width, height) => {
            views.matrix.set(matrix);
            return wasmModule._processClusters(
                ptrs.screen, ptrs.world, ptrs.indices, ptrs.depths, ptrs.sortedIndices, ptrs.intensities, ptrs.faceColors,
                ptrs.matrix, lightDir[0], lightDir[1], lightDir[2], isWire, isUV, width, height
            );
        },
        isReady: () => isInitialized,
        malloc: (size) => wasmModule._malloc(size)
    };
})();
