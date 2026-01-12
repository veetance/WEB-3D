// VEETANCE WASM Rasterizer - High-Fidelity C++ Implementation
#include <emscripten/emscripten.h>
#include <stdint.h>
#include <algorithm>
#include <math.h>

#ifdef __cplusplus
extern "C" {
#endif

// Fixed-point scaling for sub-pixel precision
const int f_shift = 16;
const int f_one = 1 << f_shift;

// Helper to draw a single horizontal span with depth testing
inline void drawSpan(
    uint32_t* fb, 
    float* db, 
    int y, 
    int fx1, int fx2, 
    int fz1, int fz2, 
    uint32_t color, 
    int width, int height
) {
    if (y < 0 || y >= height) return;
    
    if (fx1 > fx2) {
        std::swap(fx1, fx2);
        std::swap(fz1, fz2);
    }

    // Convert fixed-point to pixel coordinates (ceil)
    int xStart = (fx1 + f_one - 1) >> f_shift;
    int xEnd = (fx2 + f_one - 1) >> f_shift;

    if (xStart >= xEnd) return;

    // Boundary clipping
    if (xStart < 0) xStart = 0;
    if (xEnd > width) xEnd = width;
    if (xStart >= xEnd) return;

    int dx_f = fx2 - fx1;
    if (dx_f == 0) return;

    // Calculate Z increment per pixel
    int64_t dz_dx_f = ((int64_t)(fz2 - fz1) << f_shift) / dx_f;
    
    // Initial Z value at xStart
    int prestep_x = (xStart << f_shift) - fx1;
    int fz = fz1 + (int)((prestep_x * dz_dx_f) >> f_shift);

    int offset = y * width + xStart;
    float inv_f_one = 1.0f / (float)f_one;

    for (int x = xStart; x < xEnd; x++) {
        float zFloat = (float)fz * inv_f_one;
        if (zFloat > db[offset]) {
            db[offset] = zFloat;
            fb[offset] = color;
        }
        fz += (int)dz_dx_f;
        offset++;
    }
}

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
    // 1. Sort vertices by Y
    if (y0 > y1) { std::swap(x0, x1); std::swap(y0, y1); std::swap(z0, z1); }
    if (y0 > y2) { std::swap(x0, x2); std::swap(y0, y2); std::swap(z0, z2); }
    if (y1 > y2) { std::swap(x1, x2); std::swap(y1, y2); std::swap(z1, z2); }

    float dy01 = y1 - y0;
    float dy02 = y2 - y0;
    float dy12 = y2 - y1;

    // Top Half
    if (dy01 > 0.001f) {
        int dx01_f = (int)((x1 - x0) * f_one / dy01);
        int dx02_f = (int)((x2 - x0) * f_one / dy02);
        int dz01_f = (int)((z1 - z0) * f_one / dy01);
        int dz02_f = (int)((z2 - z0) * f_one / dy02);

        int yStart = (int)ceilf(y0);
        int yEnd = (int)ceilf(y1);

        for (int y = yStart; y < yEnd; y++) {
            float dy = (float)y - y0;
            int fx1 = (int)(x0 * f_one) + (int)(dy * dx01_f);
            int fx2 = (int)(x0 * f_one) + (int)(dy * dx02_f);
            int fz1 = (int)(z0 * f_one) + (int)(dy * dz01_f);
            int fz2 = (int)(z0 * f_one) + (int)(dy * dz02_f);
            drawSpan(framebuffer, depthBuffer, y, fx1, fx2, fz1, fz2, color, width, height);
        }
    }

    // Bottom Half
    if (dy12 > 0.001f) {
        int dx12_f = (int)((x2 - x1) * f_one / dy12);
        int dx02_f = (int)((x2 - x0) * f_one / dy02);
        int dz12_f = (int)((z2 - z1) * f_one / dy12);
        int dz02_f = (int)((z2 - z0) * f_one / dy02);

        int yStart = (int)ceilf(y1);
        int yEnd = (int)ceilf(y2);

        for (int y = yStart; y < yEnd; y++) {
            float dyTop = (float)y - y0;
            float dyBottom = (float)y - y1;
            int fx1 = (int)(x1 * f_one) + (int)(dyBottom * dx12_f);
            int fx2 = (int)(x0 * f_one) + (int)(dyTop * dx02_f);
            int fz1 = (int)(z1 * f_one) + (int)(dyBottom * dz12_f);
            int fz2 = (int)(z0 * f_one) + (int)(dyTop * dz02_f);
            drawSpan(framebuffer, depthBuffer, y, fx1, fx2, fz1, fz2, color, width, height);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void renderBatch(
    uint32_t* fb,
    float* db,
    float* screen,      // [x,y,z,w, ...]
    uint32_t* indices,  // [i0, i1, i2, ...]
    float* intensities, // [intens0, ...]
    uint32_t* sortedIndices,
    int fCount,
    uint32_t r, uint32_t g, uint32_t b,
    int width, int height,
    bool reverseSort
) {
    for (int k = 0; k < fCount; k++) {
        uint32_t sortedIdx = reverseSort ? (fCount - 1 - k) : k;
        uint32_t fIdx = sortedIndices[sortedIdx];
        uint32_t i3 = fIdx * 3;

        uint32_t idx0 = indices[i3];
        uint32_t idx1 = indices[i3 + 1];
        uint32_t idx2 = indices[i3 + 2];

        // Accessing vertex data in [x,y,z,w] format
        uint32_t i04 = idx0 << 2;
        uint32_t i14 = idx1 << 2;
        uint32_t i24 = idx2 << 2;

        // Clip-W check (equivalent to screen[i04+3] != 1)
        if (screen[i04 + 3] != 1.0f || screen[i14 + 3] != 1.0f || screen[i24 + 3] != 1.0f) continue;

        float intens = intensities[fIdx];
        uint32_t color = 0xFF000000 | 
                        (((uint32_t)(b * intens) & 0xFF) << 16) | 
                        (((uint32_t)(g * intens) & 0xFF) << 8) | 
                        ((uint32_t)(r * intens) & 0xFF);

        drawTriangle(fb, db,
            screen[i04],   screen[i04 + 1], screen[i04 + 2],
            screen[i14],   screen[i14 + 1], screen[i14 + 2],
            screen[i24],   screen[i24 + 1], screen[i24 + 2],
            color, width, height);
    }
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
