/**
 * VEETANCE Parallel Rasterizer Worker
 * Executes tiled rendering tasks on the shared manifold.
 */

self.onmessage = async function (e) {
    const { action, data } = e.data;

    if (action === 'INIT') {
        const { wasmJsUrl, wasmBinary, sharedMemory } = data;

        self.Module = {
            wasmBinary: wasmBinary,
            wasmMemory: sharedMemory,
            print: (txt) => console.log("[DEUS-WORKER] " + txt),
            printErr: (txt) => console.error("[DEUS-WORKER] " + txt),
            onRuntimeInitialized: () => {
                self.postMessage({ action: 'READY' });
            }
        };

        // Import the Emscripten glue
        self.importScripts(wasmJsUrl);
    } else if (action === 'RENDER_TILE') {
        const { tileIdx, ptrs, width, height, baseColor, isUV } = data;

        // Execute the tile render on the shared heap
        self.Module._renderTile(
            ptrs.pixels, ptrs.tiles, tileIdx, ptrs.screen, ptrs.indices,
            ptrs.intensities, ptrs.faceColors, baseColor,
            width, height, isUV
        );

        self.postMessage({ action: 'TILE_DONE', tileIdx });
    }
};
