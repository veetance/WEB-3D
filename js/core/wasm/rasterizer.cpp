#include <emscripten/emscripten.h>
#include <stdint.h>
#include <algorithm>
#include <math.h>
#include <wasm_simd128.h>

#ifdef __cplusplus
extern "C" {
#endif

#define TILE_SIZE 128
#define MAX_FACES_PER_TILE 16384

// --- UNIFIED CACHE-LOCAL ARCHITECTURE ---
struct Pixel {
    float depth;
    uint32_t color;
};

struct Cluster {
    float aabb[6]; // minX, minY, minZ, maxX, maxY, maxZ
    float sphere[4]; // cx, cy, cz, radius
    uint32_t startFace;
    uint32_t faceCount;
};

struct Tile {
    uint32_t faceCount;
    uint32_t indices[16384]; // Max faces per tile
};

// --- STATIC GLOBAL BUFFERS (Pre-allocated, no malloc needed) ---
#define MAX_VERTICES 1000000
#define MAX_FACES 1500000
#define FB_WIDTH 2560
#define FB_HEIGHT 1600

static Pixel g_pixels[FB_WIDTH * FB_HEIGHT];
static float g_rawVertices[MAX_VERTICES * 3];
static float g_world[MAX_VERTICES * 4];
static float g_screen[MAX_VERTICES * 4];
static uint32_t g_indices[MAX_FACES * 3];
static float g_intensities[MAX_FACES];
static float g_vertexIntensities[MAX_VERTICES];
static uint32_t g_faceColors[MAX_FACES];
static float g_depths[MAX_FACES];
static uint32_t g_sortedIndices[MAX_FACES];
static uint32_t g_auxIndices[MAX_FACES];
static float g_auxDepths[MAX_FACES];
static uint32_t g_radixCounts[256];
static float g_matrix[16];
static Tile g_tiles[1024]; // Up to 32x32 tiles (4096x4096 max)
static uint32_t g_outFB[FB_WIDTH * FB_HEIGHT];

// Buffer address getters (exported to JS)
EMSCRIPTEN_KEEPALIVE
Pixel* getPixelBuffer() { return g_pixels; }

EMSCRIPTEN_KEEPALIVE
float* getRawVerticesBuffer() { return g_rawVertices; }

EMSCRIPTEN_KEEPALIVE
float* getWorldBuffer() { return g_world; }

EMSCRIPTEN_KEEPALIVE
float* getScreenBuffer() { return g_screen; }

EMSCRIPTEN_KEEPALIVE
uint32_t* getIndicesBuffer() { return g_indices; }

EMSCRIPTEN_KEEPALIVE
float* getIntensitiesBuffer() { return g_intensities; }

EMSCRIPTEN_KEEPALIVE
uint32_t* getFaceColorsBuffer() { return g_faceColors; }

EMSCRIPTEN_KEEPALIVE
float* getDepthsBuffer() { return g_depths; }

EMSCRIPTEN_KEEPALIVE
uint32_t* getSortedIndicesBuffer() { return g_sortedIndices; }

EMSCRIPTEN_KEEPALIVE
uint32_t* getAuxIndicesBuffer() { return g_auxIndices; }

EMSCRIPTEN_KEEPALIVE
float* getAuxDepthsBuffer() { return g_auxDepths; }

EMSCRIPTEN_KEEPALIVE
uint32_t* getRadixCountsBuffer() { return g_radixCounts; }

EMSCRIPTEN_KEEPALIVE
float* getMatrixBuffer() { return g_matrix; }

EMSCRIPTEN_KEEPALIVE
Tile* getTilesBuffer() { return g_tiles; }

EMSCRIPTEN_KEEPALIVE
float* getVertexIntensitiesBuffer() { return g_vertexIntensities; }

EMSCRIPTEN_KEEPALIVE
uint32_t* getOutFBBuffer() { return g_outFB; }


// Global Memory for Cluster Culling
Cluster* g_clusters = nullptr;
int g_clusterCount = 0;

EMSCRIPTEN_KEEPALIVE
void uploadClusters(Cluster* data, int count) {
    if (g_clusters) free(g_clusters);
    g_clusters = (Cluster*)malloc(count * sizeof(Cluster));
    memcpy(g_clusters, data, count * sizeof(Cluster));
    g_clusterCount = count;
}

const int f_shift = 16;
const int f_one = 1 << f_shift;

// --- OPTIMIZED MATH UTILS ---
inline float fastInvSqrt(float number) {
    long i;
    float x2, y;
    const float threehalfs = 1.5F;
    x2 = number * 0.5F;
    y = number;
    std::copy(reinterpret_cast<const char*>(&y), reinterpret_cast<const char*>(&y) + sizeof(float), reinterpret_cast<char*>(&i));
    i = 0x5f3759df - (i >> 1);
    std::copy(reinterpret_cast<const char*>(&i), reinterpret_cast<const char*>(&i) + sizeof(long), reinterpret_cast<char*>(&y));
    y = y * (threehalfs - (x2 * y * y));
    return y;
}

// --- SCANLINE RASTERIZER (Unified Buffer) ---

inline void drawSpan(Pixel* pixels, int y, int fx1, int fx2, int fz1, int fz2, float fi1, float fi2, uint32_t color, int width, int height) {
    if (y < 0 || y >= height) return;
    if (fx1 > fx2) { std::swap(fx1, fx2); std::swap(fz1, fz2); std::swap(fi1, fi2); }
    
    int xStart = (fx1 + f_one - 1) >> f_shift;
    int xEnd = (fx2 + f_one - 1) >> f_shift;
    
    if (xStart >= xEnd) return;
    if (xEnd > width) xEnd = width;
    if (xStart < 0) xStart = 0;
    if (xStart >= xEnd) return;

    float zStart = (float)fz1 / f_one;
    float zEnd = (float)fz2 / f_one;
    int dx = fx2 - fx1;
    
    float weight = (dx > 0) ? (float)((xStart << f_shift) - fx1) / dx : 0;
    float dz = (dx > 0) ? (zEnd - zStart) * f_one / dx : 0;
    float di = (dx > 0) ? (fi2 - fi1) * f_one / dx : 0;
    
    float z = zStart + (zEnd - zStart) * weight;
    float intens = fi1 + (fi2 - fi1) * weight;

    uint8_t r_src = (color >> 16) & 0xFF, g_src = (color >> 8) & 0xFF, b_src = color & 0xFF;

    Pixel* p = &pixels[y * FB_WIDTH + xStart];
    for (int x = xStart; x < xEnd; x++) {
        if (z > p->depth) {
            p->depth = z;
            uint8_t r = (uint8_t)(r_src * intens), g = (uint8_t)(g_src * intens), b = (uint8_t)(b_src * intens);
            p->color = 0xFF000000 | (b << 16) | (g << 8) | r;
        }
        z += dz;
        intens += di;
        p++;
    }
}

inline void drawTriangleInternal(Pixel* pixels, int width, int height, float x0, float y0, float z0, float x1, float y1, float z1, float x2, float y2, float z2, float i0, float i1, float i2, uint32_t color) {
    if (y0 > y1) { std::swap(x0, x1); std::swap(y0, y1); std::swap(z0, z1); std::swap(i0, i1); }
    if (y0 > y2) { std::swap(x0, x2); std::swap(y0, y2); std::swap(z0, z2); std::swap(i0, i2); }
    if (y1 > y2) { std::swap(x1, x2); std::swap(y1, y2); std::swap(z1, z2); std::swap(i1, i2); }

    int iy0 = (int)(y0 + 0.5f), iy1 = (int)(y1 + 0.5f), iy2 = (int)(y2 + 0.5f);
    if (iy0 == iy2) return;

    float dy02 = y2 - y0;
    float dx02 = (x2 - x0) / dy02, dz02 = (z2 - z0) / dy02, di02 = (i2 - i0) / dy02;
    
    if (iy0 < iy1) {
        float dy01 = y1 - y0;
        float dx01 = (x1 - x0) / dy01, dz01 = (z1 - z0) / dy01, di01 = (i1 - i0) / dy01;
        int startY = std::max(0, iy0), endY = std::min(height, iy1);
        for (int y = startY; y < endY; y++) {
            float dy = (float)y - y0;
            drawSpan(pixels, y, (int)((x0 + dy * dx01) * f_one), (int)((x0 + dy * dx02) * f_one), 
                               (int)((z0 + dy * dz01) * f_one), (int)((z0 + dy * dz02) * f_one), 
                               (i0 + dy * di01), (i0 + dy * di02), color, width, height);
        }
    }
    
    if (iy1 < iy2) {
        float dy12 = y2 - y1;
        float dx12 = (x2 - x1) / dy12, dz12 = (z2 - z1) / dy12, di12 = (i2 - i1) / dy12;
        int startY = std::max(0, iy1), endY = std::min(height, iy2);
        for (int y = startY; y < endY; y++) {
            float dyBot = (float)y - y1, dyTop = (float)y - y0;
            drawSpan(pixels, y, (int)((x1 + dyBot * dx12) * f_one), (int)((x0 + dyTop * dx02) * f_one), 
                               (int)((z1 + dyBot * dz12) * f_one), (int)((z0 + dyTop * dz02) * f_one), 
                               (i1 + dyBot * di12), (i0 + dyTop * di02), color, width, height);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void drawTriangle(Pixel* pixels, float x0, float y0, float z0, float x1, float y1, float z1, float x2, float y2, float z2, float i0, float i1, float i2, uint32_t color, int width, int height) {
    drawTriangleInternal(pixels, width, height, x0, y0, z0, x1, y1, z1, x2, y2, z2, i0, i1, i2, color);
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
        v128_t res = wasm_f32x4_add(wasm_f32x4_add(wasm_f32x4_mul(m0, x), wasm_f32x4_mul(m1, y)), wasm_f32x4_add(wasm_f32x4_mul(m2, z), m3));
        wasm_v128_store(&out[ox], res);
    }
}

EMSCRIPTEN_KEEPALIVE
void projectBuffer(float* out, float* inp, int count, float width, float height, float fov) {
    float cx = width * 0.5f, cy = height * 0.5f;
    for (int i = 0; i < count; i++) {
        int ox = i * 4;
        float z = inp[ox + 2];
        
        // Calibrated Frustum: Reject if too close or behind (Z > -0.01)
        if (z > -0.01f) { 
            out[ox + 3] = -1.0f; 
            continue; 
        }
        
        float invW = 1.0f / -z;
        float scale = fov * invW;
        out[ox] = inp[ox] * scale + cx;
        out[ox + 1] = -inp[ox + 1] * scale + cy;
        out[ox + 2] = invW;
        out[ox + 3] = 1.0f;
    }
}

// --- FACE PRE-PROCESSING ---

EMSCRIPTEN_KEEPALIVE
int processFaces(
    float* screen, float* world, uint32_t* indices, 
    float* depths, uint32_t* sortedIndices, float* intensities, uint32_t* faceColors,
    int fCount, float lx, float ly, float lz, bool isWire, bool isUV, bool isNormal,
    int width, int height
) {
    int validCount = 0;
    float w = (float)width, h = (float)height;
    
    // Adaptive stride for HIGH-POLY performance (Production Mode)
    int stride = 1;
    if (fCount > 200000) stride = 4;
    else if (fCount > 50000) stride = 2;

    for (int i = 0; i < fCount; i += stride) {
        int i3 = i * 3;
        int i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2];
        int i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;
        
        // Frustum Check: W < 0 means culled in projectBuffer
        if (screen[i04 + 3] < 0 || screen[i14 + 3] < 0 || screen[i24 + 3] < 0) continue;

        float x0 = screen[i04], y0 = screen[i04 + 1], x1 = screen[i14], y1 = screen[i14 + 1], x2 = screen[i24], y2 = screen[i24 + 1];
        float area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
        
        // Standard CCW Winding: Backface cull for solid
        if (!isWire) { 
            if (area >= 0.0f) continue; 
        }

        float ax = world[i14] - world[i04], ay = world[i14 + 1] - world[i04 + 1], az = world[i14 + 2] - world[i04 + 2];
        float bx = world[i24] - world[i04], by = world[i24 + 1] - world[i04 + 1], bz = world[i24 + 2] - world[i04 + 2];
        float nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        float lenSq = nx * nx + ny * ny + nz * nz;
        if (lenSq > 0) { float invLen = fastInvSqrt(lenSq); nx *= invLen; ny *= invLen; nz *= invLen; }

        if (isNormal || isUV) {
            uint8_t r = (uint8_t)((nx * 0.5f + 0.5f) * 255.9f);
            uint8_t g = (uint8_t)((ny * 0.5f + 0.5f) * 255.9f);
            uint8_t b = (uint8_t)((nz * 0.5f + 0.5f) * 255.9f);
            // Reverted to Legacy ABGR (0xFFBBGGRR) for direct HEAP to ImageData sync
            faceColors[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
        }

        float intens = std::max(0.2f, (nx * lx + ny * ly + nz * lz) * 0.8f + 0.2f);
        intensities[i] = intens;
        depths[validCount] = (world[i04 + 2] + world[i14 + 2] + world[i24 + 2]) * 0.333333f;
        sortedIndices[validCount] = i;
        validCount++;
    }
    return validCount;
}

EMSCRIPTEN_KEEPALIVE
int processFacesSIMD(
    float* screen, float* world, uint32_t* indices, 
    float* depths, uint32_t* sortedIndices, float* intensities, uint32_t* faceColors,
    int fCount, float lx, float ly, float lz, bool isWire, bool isUV, bool isNormal,
    int width, int height
) {
    int validCount = 0;
    
    // Adaptive stride for HIGH-POLY performance (Production Mode)
    int stride = 1;
    if (fCount > 200000) stride = 4;
    else if (fCount > 50000) stride = 2;
    
    // SIMD Vectors for Lighting
    v128_t vLX = wasm_f32x4_splat(lx);
    v128_t vLY = wasm_f32x4_splat(ly);
    v128_t vLZ = wasm_f32x4_splat(lz);

    for (int i = 0; i < fCount; i += stride) {
        int i3 = i * 3;
        uint32_t i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2];
        int i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;

        // Frustum Check: W < 0 means culled
        if (screen[i04 + 3] < 0 || screen[i14 + 3] < 0 || screen[i24 + 3] < 0) continue;

        float x0 = screen[i04], y0 = screen[i04 + 1];
        float x1 = screen[i14], y1 = screen[i14 + 1];
        float x2 = screen[i24], y2 = screen[i24 + 1];

        float area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
        
        // Standard CCW Winding: Backface cull for solid
        if (!isWire) { 
            if (area >= 0.0f) continue; 
        }

        float ax = world[i14] - world[i04], ay = world[i14+1] - world[i04+1], az = world[i14+2] - world[i04+2];
        float bx = world[i24] - world[i04], by = world[i24+1] - world[i04+1], bz = world[i24+2] - world[i04+2];
        
        float nx = ay*bz - az*by;
        float ny = az*bx - ax*bz;
        float nz = ax*by - ay*bx;
        
        float lenSq = nx*nx + ny*ny + nz*nz;
        if (lenSq > 0) {
            float invLen = fastInvSqrt(lenSq);
            nx *= invLen; ny *= invLen; nz *= invLen;
        }

        if (isNormal || isUV) {
            uint8_t r = (uint8_t)((nx * 0.5f + 0.5f) * 255.9f);
            uint8_t g = (uint8_t)((ny * 0.5f + 0.5f) * 255.9f);
            uint8_t b = (uint8_t)((nz * 0.5f + 0.5f) * 255.9f);
            // Reverted to Legacy ABGR (0xFFBBGGRR) for direct HEAP to ImageData sync
            faceColors[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
        }

        float intens = std::max(0.2f, (nx*lx + ny*ly + nz*lz) * 0.8f + 0.2f);
        intensities[i] = intens;
        depths[validCount] = (world[i04 + 2] + world[i14 + 2] + world[i24 + 2]) * 0.333333f;
        sortedIndices[validCount] = i;
        validCount++;
    }
    return validCount;
}

// --- CLUSTER CULLING & BINNING ---

inline bool isBoxVisible(const float* aabb, const float* m) {
    return true; // Bypass affine-bound culling anomaly
}

EMSCRIPTEN_KEEPALIVE
int processClusters(
    float* screen, float* world, uint32_t* indices, 
    float* depths, uint32_t* sortedIndices, float* intensities, uint32_t* faceColors,
    float* m, float lx, float ly, float lz, bool isWire, bool isUV,
    int width, int height
) {
    int validCount = 0;
    for (int c = 0; c < g_clusterCount; c++) {
        Cluster& cl = g_clusters[c];
        if (!isBoxVisible(cl.aabb, m)) continue;

        for (uint32_t i = cl.startFace; i < cl.startFace + cl.faceCount; i++) {
            int i3 = i * 3;
            int i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2];
            int i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;
            
            if (screen[i04 + 3] < 0 || screen[i14 + 3] < 0 || screen[i24 + 3] < 0) continue;

            float x0 = screen[i04], y0 = screen[i04 + 1], x1 = screen[i14], y1 = screen[i14+1], x2 = screen[i24], y2 = screen[i24+1];
            float area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
            
            // Corrected Culling: Backface cull for solid, no area cull for wire
            if (!isWire) { 
                if (area >= 0.0f) continue; 
            }
            // Wireframe: Draw ALL triangles regardless of size

            float ax = world[i14] - world[i04], ay = world[i14 + 1] - world[i04 + 1], az = world[i14 + 2] - world[i04 + 2];
            float bx = world[i24] - world[i04], by = world[i24 + 1] - world[i04 + 1], bz = world[i24 + 2] - world[i04 + 2];
            float nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
            float lenSq = nx * nx + ny * ny + nz * nz;
            if (lenSq > 0) { float invLen = fastInvSqrt(lenSq); nx *= invLen; ny *= invLen; nz *= invLen; }

            float intens = std::max(0.2f, (nx * lx + ny * ly + nz * lz) * 0.8f + 0.2f);
            g_vertexIntensities[i0] = intens;
            g_vertexIntensities[i1] = intens;
            g_vertexIntensities[i2] = intens;

            intensities[i] = intens;
            depths[validCount] = (world[i04 + 2] + world[i14 + 2] + world[i24 + 2]) * 0.333333f;
            sortedIndices[validCount] = i;
            validCount++;
        }
    }
    return validCount;
}

// --- RADIX SORT ---

EMSCRIPTEN_KEEPALIVE
void radixSort(uint32_t* indices, float* depths, int count, uint32_t* auxIndices, float* auxDepths, uint32_t* counts) {
    if (count <= 1) return;
    uint32_t* curIndices = indices; float* curDepths = depths;
    uint32_t* nextIndices = auxIndices; float* nextDepths = auxDepths;
    for (int shift = 0; shift < 32; shift += 8) {
        for (int i = 0; i < 256; i++) counts[i] = 0;
        for (int i = 0; i < count; i++) {
            uint32_t fbits = *(uint32_t*)&curDepths[i];
            uint32_t sortable = fbits ^ (-(int32_t)(fbits >> 31) | 0x80000000);
            counts[(sortable >> shift) & 0xFF]++;
        }
        uint32_t total = 0;
        for (int i = 0; i < 256; i++) { uint32_t c = counts[i]; counts[i] = total; total += c; }
        for (int i = 0; i < count; i++) {
            uint32_t fbits = *(uint32_t*)&curDepths[i];
            uint32_t sortable = fbits ^ (-(int32_t)(fbits >> 31) | 0x80000000);
            uint32_t bucket = (sortable >> shift) & 0xFF;
            uint32_t dest = counts[bucket]++;
            nextIndices[dest] = curIndices[i]; nextDepths[dest] = curDepths[i];
        }
        std::swap(curIndices, nextIndices); std::swap(curDepths, nextDepths);
    }
    if (curIndices != indices) { for (int i = 0; i < count; i++) { indices[i] = curIndices[i]; depths[i] = curDepths[i]; } }
}

// --- BATCH RENDERER ---

/**
 * Deterministic drawLineInternal: Uses periodic dashing for line density
 * density: 1.0 = solid, 0.5 = 50% dash, etc.
 */
inline void drawLineInternal(Pixel* pixels, int width, int height, float x0, float y0, float z0, float x1, float y1, float z1, uint32_t color, float density) {
    int ix0 = (int)x0, iy0 = (int)y0, ix1 = (int)x1, iy1 = (int)y1;
    int dx = abs(ix1 - ix0), dy = abs(iy1 - iy0);
    int sx = ix0 < ix1 ? 1 : -1, sy = iy0 < iy1 ? 1 : -1;
    int err = dx - dy, totalSteps = std::max(dx, dy);
    float stepZ = totalSteps > 0 ? (z1 - z0) / totalSteps : 0, z = z0;

    // Fixed dashing period (16 pixels)
    const int dashPeriod = 16;
    int dashThreshold = (int)(dashPeriod * density);

    for (int i = 0; i <= totalSteps; i++) {
        // Deterministic Dashing: Draw segment, skip segment
        if ((i % dashPeriod) < dashThreshold) {
            if (ix0 >= 0 && ix0 < width && iy0 >= 0 && iy0 < height) {
                Pixel& p = pixels[iy0 * FB_WIDTH + ix0];
                if (z >= p.depth - 0.01f) { 
                    p.depth = z; 
                    p.color = color; 
                }
            }
        }
        
        if (ix0 == ix1 && iy0 == iy1) break;
        int e2 = 2 * err;
        if (e2 > -dy) { err -= dy; ix0 += sx; }
        if (e2 < dx) { err += dx; iy0 += sy; }
        z += stepZ;
    }
}

EMSCRIPTEN_KEEPALIVE
void renderWireframe(Pixel* pixels, float* screen, uint32_t* indices, uint32_t* sortedIndices, int fCount, uint32_t color, int width, int height, float density) {
    for (int i = 0; i < fCount; i++) {
        int idx = sortedIndices[i];
        int i3 = idx * 3, i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2], i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;
        
        drawLineInternal(pixels, width, height, screen[i04], screen[i04+1], screen[i04+2], screen[i14], screen[i14+1], screen[i14+2], color, density);
        drawLineInternal(pixels, width, height, screen[i14], screen[i14+1], screen[i14+2], screen[i24], screen[i24+1], screen[i24+2], color, density);
        drawLineInternal(pixels, width, height, screen[i24], screen[i24+1], screen[i24+2], screen[i04], screen[i04+1], screen[i04+2], color, density);
    }
}

EMSCRIPTEN_KEEPALIVE
void renderBatch(Pixel* pixels, float* screen, uint32_t* indices, uint32_t* sortedIndices, float* intensities, uint32_t* faceColors, int fCount, uint32_t baseColor, int width, int height, bool isUV) {
    // Extract RGB from 0xFFRRGGBB (The JS WASM Color)
    uint8_t r_src = (baseColor >> 16) & 0xFF;
    uint8_t g_src = (baseColor >> 8) & 0xFF;
    uint8_t b_src = baseColor & 0xFF;

    for (int i = 0; i < fCount; i++) {
        int idx = sortedIndices[i];
        int i3 = idx * 3, i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2], i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;
        
        float x0 = screen[i04], y0 = screen[i04+1], z0 = screen[i04+2];
        float x1 = screen[i14], y1 = screen[i14+1], z1 = screen[i14+2];
        float x2 = screen[i24], y2 = screen[i24+1], z2 = screen[i24+2];
        
        // Flat Shading: Use face intensity for all vertices (Screenshot-02 parity)
        float faceIntens = isUV ? 1.0f : intensities[idx];
        float in0 = faceIntens, in1 = faceIntens, in2 = faceIntens;

        // --- NANITE STYLE MICRO-POLYGON PUNTING ---
        float minX = std::min(x0, std::min(x1, x2));
        float maxX = std::max(x0, std::max(x1, x2));
        float minY = std::min(y0, std::min(y1, y2));
        float maxY = std::max(y0, std::max(y1, y2));

        if ((maxX - minX) < 1.0f && (maxY - minY) < 1.0f) {
            int px = (int)x0, py = (int)y0;
            if (px >= 0 && px < width && py >= 0 && py < height) {
                Pixel& p = pixels[py * FB_WIDTH + px];
                if (z0 > p.depth) {
                    p.depth = z0;
                    float avgIn = (in0 + in1 + in2) * 0.333333f;
                    uint8_t r = (uint8_t)(r_src * avgIn), g = (uint8_t)(g_src * avgIn), b = (uint8_t)(b_src * avgIn);
                    p.color = 0xFF000000 | (b << 16) | (g << 8) | r;
                }
            }
            continue;
        }

        drawTriangleInternal(pixels, width, height, x0, y0, z0, x1, y1, z1, x2, y2, z2, in0, in1, in2, baseColor);
    }
}

// --- TILED PARALLEL ARCHITECTURE ---

EMSCRIPTEN_KEEPALIVE
void binFaces(
    Tile* tiles, float* screen, uint32_t* indices, uint32_t* sortedIndices, 
    int validCount, int width, int height
) {
    int tilesX = (width + TILE_SIZE - 1) / TILE_SIZE;
    int tilesY = (height + TILE_SIZE - 1) / TILE_SIZE;

    // Clear tiles
    for (int i = 0; i < tilesX * tilesY; i++) tiles[i].faceCount = 0;

    for (int i = 0; i < validCount; i++) {
        int idx = sortedIndices[i];
        int i3 = idx * 3;
        int i0 = indices[i3], i1 = indices[i3+1], i2 = indices[i3+2];
        int i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;

        float x0 = screen[i04], y0 = screen[i04+1];
        float x1 = screen[i14], y1 = screen[i14+1];
        float x2 = screen[i24], y2 = screen[i24+1];

        int minTx = (int)(std::min({x0, x1, x2}) / TILE_SIZE);
        int maxTx = (int)(std::max({x0, x1, x2}) / TILE_SIZE);
        int minTy = (int)(std::min({y0, y1, y2}) / TILE_SIZE);
        int maxTy = (int)(std::max({y0, y1, y2}) / TILE_SIZE);

        minTx = std::max(0, minTx); maxTx = std::min(tilesX - 1, maxTx);
        minTy = std::max(0, minTy); maxTy = std::min(tilesY - 1, maxTy);

        for (int ty = minTy; ty <= maxTy; ty++) {
            for (int tx = minTx; tx <= maxTx; tx++) {
                Tile& t = tiles[ty * tilesX + tx];
                if (t.faceCount < MAX_FACES_PER_TILE) {
                    t.indices[t.faceCount++] = idx;
                }
            }
        }
    }
}

inline void drawSpanTile(Pixel* pixels, int y, int fx1, int fx2, int fz1, int fz2, float fi1, float fi2, uint32_t color, int width, int height, int minX, int maxX) {
    if (y < 0 || y >= height) return;
    if (fx1 > fx2) { std::swap(fx1, fx2); std::swap(fz1, fz2); std::swap(fi1, fi2); }
    
    int xStart = std::max(minX, (fx1 + f_one - 1) >> f_shift);
    int xEnd = std::min(maxX, (fx2 + f_one - 1) >> f_shift);
    
    if (xStart >= xEnd) return;
    
    float zStart = (float)fz1 / f_one;
    float zEnd = (float)fz2 / f_one;
    int dx = fx2 - fx1;
    
    float weight = (dx > 0) ? (float)((xStart << f_shift) - fx1) / dx : 0;
    float dz = (dx > 0) ? (zEnd - zStart) * f_one / dx : 0;
    float di = (dx > 0) ? (fi2 - fi1) * f_one / dx : 0;
    
    float z = zStart + (zEnd - zStart) * weight;
    float intens = fi1 + (fi2 - fi1) * weight;

    uint8_t r_src = (color >> 16) & 0xFF, g_src = (color >> 8) & 0xFF, b_src = color & 0xFF;

    Pixel* p = &pixels[y * FB_WIDTH + xStart];
    for (int x = xStart; x < xEnd; x++) {
        if (z > p->depth) {
            p->depth = z;
            uint8_t r = (uint8_t)(r_src * intens), g = (uint8_t)(g_src * intens), b = (uint8_t)(b_src * intens);
            p->color = 0xFF000000 | (b << 16) | (g << 8) | r;
        }
        z += dz;
        intens += di;
        p++;
    }
}

EMSCRIPTEN_KEEPALIVE
void renderTile(
    Pixel* pixels, Tile* tiles, int tileIdx, float* screen, uint32_t* indices, 
    float* intensities, uint32_t* faceColors, uint32_t baseColor, 
    int width, int height, bool isUV
) {
    Tile& t = tiles[tileIdx];
    int tilesX = (width + TILE_SIZE - 1) / TILE_SIZE;
    int tx = tileIdx % tilesX;
    int ty = tileIdx / tilesX;
    int minX = tx * TILE_SIZE, maxX = std::min(width, (tx + 1) * TILE_SIZE);
    int minY = ty * TILE_SIZE, maxY = std::min(height, (ty + 1) * TILE_SIZE);

    // Extract RGB from 0xFFRRGGBB (Corrected extraction)
    uint8_t r_src = (baseColor >> 16) & 0xFF;
    uint8_t g_src = (baseColor >> 8) & 0xFF;
    uint8_t b_src = baseColor & 0xFF;

    for (int i = 0; i < t.faceCount; i++) {
        int idx = t.indices[i];
        
        // Mode Override: Use faceColors for UV/Normals
        uint32_t effectiveColor = baseColor;
        uint8_t er = r_src, eg = g_src, eb = b_src;
        if (isUV) {
            effectiveColor = faceColors[idx];
            eb = (effectiveColor >> 16) & 0xFF; // Inverting extraction for legacy ABGR
            eg = (effectiveColor >> 8) & 0xFF;
            er = effectiveColor & 0xFF;
            
            // Force full intensity for Normals/UV mode
            intensities[idx] = 1.0f;
        }

        int i3 = idx * 3, i0 = indices[i3], i1 = indices[i3 + 1], i2 = indices[i3 + 2], i04 = i0 << 2, i14 = i1 << 2, i24 = i2 << 2;
        
        float x0 = screen[i04], y0 = screen[i04+1], z0 = screen[i04+2];
        float x1 = screen[i14], y1 = screen[i14+1], z1 = screen[i14+2];
        float x2 = screen[i24], y2 = screen[i24+1], z2 = screen[i24+2];
        
        // Flat Shading: Use face intensity for all vertices (No gradients)
        float faceIntens = isUV ? 1.0f : intensities[idx];
        float in0 = faceIntens, in1 = faceIntens, in2 = faceIntens;

        // Check if sub-pixel
        float fMinX = std::min({x0, x1, x2}), fMaxX = std::max({x0, x1, x2});
        float fMinY = std::min({y0, y1, y2}), fMaxY = std::max({y0, y1, y2});

        if ((fMaxX - fMinX) < 1.0f && (fMaxY - fMinY) < 1.0f) {
            int px = (int)x0, py = (int)y0;
            if (px >= minX && px < maxX && py >= minY && py < maxY) {
                Pixel& p = pixels[py * FB_WIDTH + px];
                if (z0 > p.depth) { 
                    p.depth = z0; 
                    float avgIn = (in0 + in1 + in2) * 0.333333f;
                    uint8_t r = (uint8_t)(er * avgIn), g = (uint8_t)(eg * avgIn), b = (uint8_t)(eb * avgIn);
                    p.color = 0xFF000000 | (b << 16) | (g << 8) | r;
                }
            }
            continue;
        }

        // Tiled triangle render (Interpolated)
        if (y0 > y1) { std::swap(x0, x1); std::swap(y0, y1); std::swap(z0, z1); std::swap(in0, in1); }
        if (y0 > y2) { std::swap(x0, x2); std::swap(y0, y2); std::swap(z0, z2); std::swap(in0, in2); }
        if (y1 > y2) { std::swap(x1, x2); std::swap(y1, y2); std::swap(z1, z2); std::swap(in1, in2); }

        int iy0 = (int)(y0 + 0.5f), iy1 = (int)(y1 + 0.5f), iy2 = (int)(y2 + 0.5f);
        if (iy0 == iy2) continue;

        float dy02 = y2 - y0;
        float dx02 = (x2 - x0) / dy02, dz02 = (z2 - z0) / dy02, di02 = (in2 - in0) / dy02;
        
        if (iy0 < iy1) {
            float dy01 = y1 - y0;
            float dx01 = (x1 - x0) / dy01, dz01 = (z1 - z0) / dy01, di01 = (in1 - in0) / dy01;
            int startY = std::max(minY, iy0), endY = std::min(maxY, iy1);
            for (int y = startY; y < endY; y++) {
                float dy = (float)y - y0;
                drawSpanTile(pixels, y, (int)((x0 + dy * dx01) * f_one), (int)((x0 + dy * dx02) * f_one), 
                                   (int)((z0 + dy * dz01) * f_one), (int)((z0 + dy * dz02) * f_one), 
                                   (in0 + dy * di01), (in0 + dy * di02), effectiveColor, width, height, minX, maxX);
            }
        }
        if (iy1 < iy2) {
            float dy12 = y2 - y1;
            float dx12 = (x2 - x1) / dy12, dz12 = (z2 - z1) / dy12, di12 = (in2 - in1) / dy12;
            int startY = std::max(minY, iy1), endY = std::min(maxY, iy2);
            for (int y = startY; y < endY; y++) {
                float dyBot = (float)y - y1, dyTop = (float)y - y0;
                drawSpanTile(pixels, y, (int)((x1 + dyBot * dx12) * f_one), (int)((x0 + dyTop * dx02) * f_one), 
                                   (int)((z1 + dyBot * dz12) * f_one), (int)((z0 + dyTop * dz02) * f_one), 
                                   (in1 + dyBot * di12), (in0 + dyTop * di02), effectiveColor, width, height, minX, maxX);
            }
        }
    }
    // Only print for first tile to avoid spam
    if (tileIdx == 0 && t.faceCount > 0) {
        printf("[DEUS-W] Tile 0 rendered %d faces.\n", t.faceCount);
    }
}

EMSCRIPTEN_KEEPALIVE
void extractColors(Pixel* pixels, uint32_t* out, int width, int height) {
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            out[y * width + x] = pixels[y * FB_WIDTH + x].color;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void clearBuffers(Pixel* pixels, int width, int height) {
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            Pixel& p = pixels[y * FB_WIDTH + x];
            p.depth = -2000.0f; 
            p.color = 0; 
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void* malloc(size_t size) { return ::malloc(size); }
EMSCRIPTEN_KEEPALIVE
void free(void* ptr) { ::free(ptr); }

#ifdef __cplusplus
}
#endif
