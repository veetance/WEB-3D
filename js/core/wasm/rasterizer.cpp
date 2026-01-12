// VEETANCE WASM Rasterizer - Minimal Working Version
#include <emscripten/emscripten.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

EMSCRIPTEN_KEEPALIVE
void drawTriangle(
    uint32_t* framebuffer,
    float* depthBuffer,
    float x0, float y0, float z0,
    float x1, float y1, float z1,
    float x2, float y2, float z2,
    uint32_t color,
    int width, int height
) {
    // Placeholder implementation
    // TODO: Implement scanline rasterization in Phase 4B.1
}

EMSCRIPTEN_KEEPALIVE
void clearBuffers(
    uint32_t* framebuffer,
    float* depthBuffer,
    int width, int height
) {
    int total = width * height;
    for (int i = 0; i < total; i++) {
        framebuffer[i] = 0x00000000;
        depthBuffer[i] = -1000.0f;
    }
}

#ifdef __cplusplus
}
#endif
