// VEETANCE WASM Rasterizer - FULL PIPELINE ACCELERATION 🦾⚡
#include <emscripten/emscripten.h>
#include <stdint.h>
#include <algorithm>
#include <math.h>
#include <wasm_simd128.h>

#ifdef __cplusplus
extern "C" {
#endif

const int f_shift = 16;
const int f_one = 1 << f_shift;

// --- SCANLINE RASTERIZER ---

// --- OPTIMIZED MATH UTILS ---

inline float fastInvSqrt(float number) {
    long i;
    float x2, y;
    const float threehalfs = 1.5F;

    x2 = number * 0.5F;
    y = number;
    // Safe type punning via memcpy to avoid strict aliasing violation
    // i = *(long*)&y; 
    std::copy(reinterpret_cast<const char*>(&y), reinterpret_cast<const char*>(&y) + sizeof(float), reinterpret_cast<char*>(&i));
    
    i = 0x5f3759df - (i >> 1); // The Logic
    
    // y = *(float*)&i;
    std::copy(reinterpret_cast<const char*>(&i), reinterpret_cast<const char*>(&i) + sizeof(long), reinterpret_cast<char*>(&y));
    
    y = y * (threehalfs - (x2 * y * y));   // 1st iteration
    return y;
}

// --- SCANLINE RASTERIZER (INLINED) ---

inline void drawSpan(uint32_t* fb, float* db, int y, int fx1, int fx2, int fz1, int fz2, uint32_t color, int width, int height) {
    if (y < 0 || y >= height) return;
    if (fx1 > fx2) { std::swap(fx1, fx2); std::swap(fz1, fz2); }
    int xStart = (fx1 + f_one - 1) >> f_shift;
    int xEnd = (fx2 + f_one - 1) >> f_shift;
    if (xStart >= xEnd) return;
    if (xStart < 0) xStart = 0;
    if (xEnd > width) xEnd = width;
    if (xStart >= xEnd) return;

    int dx_f = fx2 - fx1;
    if (dx_f == 0) return;
    
    // Fast Z interpolation
    int64_t dz_dx_f = ((int64_t)(fz2 - fz1) << f_shift) / dx_f;
    int prestep_x = (xStart << f_shift) - fx1;
    int fz = fz1 + (int)((prestep_x * dz_dx_f) >> f_shift);

    int offset = y * width + xStart;
    float inv_f_one = 1.0f / (float)f_one;
    float dz_per_pixel = (float)dz_dx_f * inv_f_one;

    v128_t colorVec = wasm_i32x4_splat(color);
    v128_t dzVec = wasm_f32x4_make(0, dz_per_pixel, dz_per_pixel * 2, dz_per_pixel * 3);
    
    int x = xStart;
    // Unrolled SIMD Loop
    for (; x <= xEnd - 4; x += 4) {
        float baseZ = (float)fz * inv_f_one;
        v128_t currentZVec = wasm_f32x4_add(wasm_f32x4_splat(baseZ), dzVec);
        v128_t depthBufferVec = wasm_v128_load(&db[offset]);
        v128_t mask = wasm_f32x4_gt(currentZVec, depthBufferVec);
        v128_t oldFB = wasm_v128_load(&fb[offset]);
        wasm_v128_store(&fb[offset], wasm_v128_bitselect(colorVec, oldFB, mask));
        wasm_v128_store(&db[offset], wasm_v128_bitselect(currentZVec, depthBufferVec, mask));
        fz += (int)(dz_dx_f * 4);
        offset += 4;
    }
    // Remainder
    for (; x < xEnd; x++) {
        float zFloat = (float)fz * inv_f_one;
        if (zFloat > db[offset]) { db[offset] = zFloat; fb[offset] = color; }
        fz += (int)dz_dx_f;
        offset++;
    }
}

// Internal Inline Version for RenderBatch (No Call Overhead)
static inline void drawTriangleInternal(uint32_t* fb, float* db, int width, int height, 
                                      float x0, float y0, float z0, 
                                      float x1, float y1, float z1, 
                                      float x2, float y2, float z2, uint32_t color) {
    if (y0 > y1) { std::swap(x0, x1); std::swap(y0, y1); std::swap(z0, z1); }
    if (y0 > y2) { std::swap(x0, x2); std::swap(y0, y2); std::swap(z0, z2); }
    if (y1 > y2) { std::swap(x1, x2); std::swap(y1, y2); std::swap(z1, z2); }
    
    float dy01 = y1 - y0, dy02 = y2 - y0, dy12 = y2 - y1;
    
    if (dy02 < 1.0f) return; // Skip triangles shorter than 1 pixel vertically

    int dx01_f = 0, dx02_f = 0, dx12_f = 0;
    int dz01_f = 0, dz02_f = 0, dz12_f = 0;

    dx02_f = (int)((x2 - x0) * f_one / dy02);
    dz02_f = (int)((z2 - z0) * f_one / dy02);

    if (dy01 > 1.0f) {
        dx01_f = (int)((x1 - x0) * f_one / dy01);
        dz01_f = (int)((z1 - z0) * f_one / dy01);
        int yStart = (int)ceilf(y0), yEnd = (int)ceilf(y1);
        if (yStart < 0) yStart = 0;
        if (yEnd > height) yEnd = height;
        
        for (int y = yStart; y < yEnd; y++) {
            float dy = (float)y - y0;
            if (y >= 0 && y < height) { // Safety check
                 int fx1 = (int)(x0 * f_one) + (int)(dy * dx01_f);
                 int fx2 = (int)(x0 * f_one) + (int)(dy * dx02_f);
                 int fz1 = (int)(z0 * f_one) + (int)(dy * dz01_f);
                 int fz2 = (int)(z0 * f_one) + (int)(dy * dz02_f);
                 drawSpan(fb, db, y, fx1, fx2, fz1, fz2, color, width, height);
            }
        }
    }
    
    if (dy12 > 1.0f) {
        dx12_f = (int)((x2 - x1) * f_one / dy12);
        dz12_f = (int)((z2 - z1) * f_one / dy12);
        int yStart = (int)ceilf(y1), yEnd = (int)ceilf(y2);
        if (yStart < 0) yStart = 0;
        if (yEnd > height) yEnd = height;

        for (int y = yStart; y < yEnd; y++) {
            float dyTop = (float)y - y0;
            float dyBottom = (float)y - y1;
            if (y >= 0 && y < height) {
                int fx1 = (int)(x1 * f_one) + (int)(dyBottom * dx12_f);
                int fx2 = (int)(x0 * f_one) + (int)(dyTop * dx02_f);
                int fz1 = (int)(z1 * f_one) + (int)(dyBottom * dz12_f);
                int fz2 = (int)(z0 * f_one) + (int)(dyTop * dz02_f);
                drawSpan(fb, db, y, fx1, fx2, fz1, fz2, color, width, height);
            }
        }
    }
}

// Keep the external one for JS calls
EMSCRIPTEN_KEEPALIVE
void drawTriangle(uint32_t* fb, float* db, float x0, float y0, float z0, float x1, float y1, float z1, float x2, float y2, float z2, uint32_t color, int width, int height) {
    drawTriangleInternal(fb, db, width, height, x0, y0, z0, x1, y1, z1, x2, y2, z2, color);
}

// --- VERTEX PROCESSING ---

EMSCRIPTEN_KEEPALIVE
void transformBuffer(float* out, float* inp, float* m, int count) {
    v128_t m0 = wasm_v128_load(&m[0]);
    v128_t m1 = wasm_v128_load(&m[4]);
    v128_t m2 = wasm_v128_load(&m[8]);
    v128_t m3 = wasm_v128_load(&m[12]);

    for (int i = 0; i < count; i++) {
        int ix = i * 3, ox = i * 4;
        v128_t x = wasm_f32x4_splat(inp[ix]);
        v128_t y = wasm_f32x4_splat(inp[ix + 1]);
        v128_t z = wasm_f32x4_splat(inp[ix + 2]);
        
        v128_t res = wasm_f32x4_add(
            wasm_f32x4_add(wasm_f32x4_mul(m0, x), wasm_f32x4_mul(m1, y)),
            wasm_f32x4_add(wasm_f32x4_mul(m2, z), m3)
        );
        wasm_v128_store(&out[ox], res);
    }
}

EMSCRIPTEN_KEEPALIVE
void projectBuffer(float* out, int count, float width, float height, float fov) {
    float cx = width * 0.5f, cy = height * 0.5f;
    for (int i = 0; i < count; i++) {
        int ox = i * 4;
        float z = out[ox + 2];
        if (z > -0.1f) { out[ox + 3] = -1.0f; continue; }
        float scale = fov / fabsf(z);
        out[ox] = out[ox] * scale + cx;
        out[ox + 1] = -out[ox + 1] * scale + cy;
        out[ox + 3] = 1.0f;
    }
}

// --- FACE PRE-PROCESSING (CULLING & LIGHTING) ---

EMSCRIPTEN_KEEPALIVE
int processFaces(
    float* screen, float* world, uint32_t* indices, 
    float* depths, uint32_t* sortedIndices, float* intensities,
    int fCount, float lx, float ly, float lz, bool isWire,
    int width, int height, float density // density 0.0 - 1.0
) {
    int validCount = 0;
    float w = (float)width;
    float h = (float)height;

    // Density Stride Calculation
    // density 1.0 = draw all
    // density 0.5 = draw every 2nd
    // density 0.1 = draw every 10th
    int stride = 1;
    if (isWire && density < 1.0f) {
        stride = (int)(1.0f / std::max(0.01f, density));
    }

    for (int i = 0; i < fCount; i++) {
        // Wireframe Density Culling
        if (isWire && (i % stride != 0)) continue;

        int i3 = i * 3;
        int i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2];
        int i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;

        if (screen[i04 + 3] < 0 || screen[i14 + 3] < 0 || screen[i24 + 3] < 0) continue;

        float x0 = screen[i04], y0 = screen[i04 + 1];
        float x1 = screen[i14], y1 = screen[i14 + 1];
        float x2 = screen[i24], y2 = screen[i24 + 1];

        // Screen-Space AABB Culling (Safe Min/Max)
        float minX = std::min(x0, std::min(x1, x2));
        float maxX = std::max(x0, std::max(x1, x2));
        float minY = std::min(y0, std::min(y1, y2));
        float maxY = std::max(y0, std::max(y1, y2));

        if (maxX < 0 || minX > w || maxY < 0 || minY > h) continue;

        float area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
        
        // Micro-Triangle Culling
        if (!isWire) {
             if (area <= 0.5f) continue;
        } else {
             // If density is low, we can be more permissive with micro-culling
             // to ensure we don't lose too much structure
             if (fabsf(area) <= 0.05f) continue;
        }

        // Normal/Lighting
        float ax = world[i14] - world[i04], ay = world[i14 + 1] - world[i04 + 1], az = world[i14 + 2] - world[i04 + 2];
        float bx = world[i24] - world[i04], by = world[i24 + 1] - world[i04 + 1], bz = world[i24 + 2] - world[i04 + 2];
        float nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        
        // Safe Sqrt
        float lenSq = nx * nx + ny * ny + nz * nz;
        if (lenSq > 0) { 
            float invLen = 1.0f / sqrtf(lenSq); 
            nx *= invLen; ny *= invLen; nz *= invLen; 
        }
        
        intensities[i] = std::max(0.2f, (nx * lx + ny * ly + nz * lz) * 0.8f + 0.2f);
        depths[validCount] = (world[i04 + 2] + world[i14 + 2] + world[i24 + 2]) * 0.333333f;
        sortedIndices[validCount] = i;
        validCount++;
    }
    return validCount;
}

// --- UTILITIES ---

EMSCRIPTEN_KEEPALIVE
void radixSort(uint32_t* indices, float* depths, int count, uint32_t* auxIndices, float* auxDepths, uint32_t* counts) {
    // ... (Keep existing Radix Sort logic) ...
    if (count <= 1) return;
    uint32_t* sI = indices; uint32_t* dI = auxIndices;
    uint32_t* sK = (uint32_t*)depths; uint32_t* dK = (uint32_t*)auxDepths;
    for (int i = 0; i < count; i++) { uint32_t v = sK[i]; sK[i] = (v & 0x80000000) ? ~v : v ^ 0x80000000; }
    for (int shift = 0; shift < 32; shift += 16) {
        for (int i = 0; i < 65536; i++) counts[i] = 0;
        for (int i = 0; i < count; i++) counts[(sK[i] >> shift) & 0xFFFF]++;
        uint32_t pos = 0;
        for (int i = 0; i < 65536; i++) { uint32_t t = counts[i]; counts[i] = pos; pos += t; }
        for (int i = 0; i < count; i++) { uint32_t v = sK[i]; uint32_t dst = counts[(v >> shift) & 0xFFFF]++; dK[dst] = v; dI[dst] = sI[i]; }
        std::swap(sI, dI); std::swap(sK, dK);
    }
    for (int i = 0; i < count; i++) { uint32_t v = sK[i]; sK[i] = (v & 0x80000000) ? v ^ 0x80000000 : ~v; }
}

EMSCRIPTEN_KEEPALIVE
void renderBatch(uint32_t* fb, float* db, float* screen, uint32_t* indices, float* intensities, uint32_t* sortedIndices, int fCount, uint32_t r, uint32_t g, uint32_t b, int width, int height, bool reverseSort) {
    for (int k = 0; k < fCount; k++) {
        uint32_t fIdx = sortedIndices[reverseSort ? (fCount - 1 - k) : k];
        uint32_t i3 = fIdx * 3;
        uint32_t i04 = indices[i3] << 2, i14 = indices[i3 + 1] << 2, i24 = indices[i3 + 2] << 2;
        float intens = intensities[fIdx];
        uint32_t color = 0xFF000000 | (((uint32_t)(b * intens) & 0xFF) << 16) | (((uint32_t)(g * intens) & 0xFF) << 8) | ((uint32_t)(r * intens) & 0xFF);
        
        // Call Inlined Internal Function
        drawTriangleInternal(fb, db, width, height, 
            screen[i04], screen[i04 + 1], screen[i04 + 2], 
            screen[i14], screen[i14 + 1], screen[i14 + 2], 
            screen[i24], screen[i24 + 1], screen[i24 + 2], 
            color);
    }
}

EMSCRIPTEN_KEEPALIVE
void clearBuffers(uint32_t* fb, float* db, int width, int height) {
    int total = width * height;
    v128_t cC = wasm_i32x4_splat(0x00000000), cD = wasm_f32x4_splat(-1000.0f);
    int i = 0;
    for (; i <= total - 4; i += 4) { wasm_v128_store(&fb[i], cC); wasm_v128_store(&db[i], cD); }
    for (; i < total; i++) { fb[i] = 0x00000000; db[i] = -1000.0f; }
}

#ifdef __cplusplus
}
#endif
