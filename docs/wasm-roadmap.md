# VEETANCE WASM MIGRATION ROADMAP
**Commander:** MrVee | **Executant:** DEUS
**Objective:** Achieve 60+ FPS on 900K face models through WebAssembly acceleration

---

## CURRENT STATE

### Performance Metrics (JavaScript Rasterizer)
- **Pyramid (6 faces):** 60 FPS ✅
- **Large Troll (81K faces):** 30-40 FPS (SOLID), 30-60 FPS (WIRE) ✅
- **Massive Model (900K faces):** 8 FPS ❌ **← PRIMARY BOTTLENECK**

### Bottleneck Analysis
**Hot Loop:** `drawTriangle` in `RasterizerPixel.js`
- Called 900,000 times per frame for 900K face model
- Each call processes ~50-200 pixels (scanline rasterization)
- Total: ~45-180 million pixel operations per frame
- JavaScript overhead: Type checking, GC pauses, no SIMD

---

## PHASE 4B: WASM RASTERIZER MIGRATION

### Objective
Port the triangle rasterization hot loop to WebAssembly with SIMD optimization to achieve **4x-10x performance improvement**.

### Target Performance
- **900K faces:** 60-80 FPS (currently 8 FPS)
- **81K faces:** 120-200 FPS (currently 30-40 FPS)
- **6 faces:** 300+ FPS (currently 60 FPS)

---

## IMPLEMENTATION PHASES

### PHASE 4B.1: CORE WASM RASTERIZER (Week 1)

**Goal:** Replace JavaScript `drawTriangle` with C++ WASM equivalent

**Tasks:**
1. **Create `js/core/wasm/rasterizer.cpp`**
   - Port `drawTriangle` function from `RasterizerPixel.js`
   - Implement scanline rasterization in C++
   - Use fixed-point arithmetic (16.16) for sub-pixel precision
   - Depth testing with Early-Z rejection

2. **Create `js/core/wasm/rasterizer.h`**
   - Function signatures for WASM exports
   - Memory layout definitions (framebuffer, depth buffer)

3. **Create Build Script `build-wasm.sh`**
   ```bash
   emcc js/core/wasm/rasterizer.cpp \
     -o js/core/wasm/rasterizer.wasm \
     -O3 \                          # Maximum optimization
     -s WASM=1 \                    # Output WebAssembly
     -s ALLOW_MEMORY_GROWTH=1 \     # Dynamic memory
     -s EXPORTED_FUNCTIONS='["_drawTriangle", "_clearBuffers"]' \
     -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]'
   ```

4. **Create `js/core/rasterizer-wasm.js`**
   - WASM module loader
   - Shared memory bridge (SharedArrayBuffer)
   - Fallback to JavaScript rasterizer if WASM not supported

5. **Integration into `engine.js`**
   - Replace `RasterizerPixel.render()` with WASM calls
   - Benchmark and verify correctness

**Expected Gain:** 3x-5x (8 FPS → 30-40 FPS on 900K faces)

---

### PHASE 4B.2: SIMD OPTIMIZATION (Week 2)

**Goal:** Process 4 pixels simultaneously using `wasm_simd128`

**Tasks:**
1. **Rewrite Scanline Loop with SIMD**
   ```cpp
   // Process 4 pixels per iteration
   v128_t zVec = wasm_f32x4_splat(z);
   v128_t colorVec = wasm_i32x4_splat(color);
   
   for (int x = xStart; x < xEnd; x += 4) {
       v128_t dbVec = wasm_v128_load(&depthBuffer[x]);
       v128_t mask = wasm_f32x4_gt(zVec, dbVec);
       
       // Write 4 pixels if depth test passes
       wasm_v128_store(&framebuffer[x], 
           wasm_v128_bitselect(colorVec, wasm_v128_load(&framebuffer[x]), mask)
       );
   }
   ```

2. **Compile with SIMD Enabled**
   ```bash
   emcc js/core/wasm/rasterizer.cpp \
     -o js/core/wasm/rasterizer-simd.wasm \
     -O3 \
     -msimd128 \                    # Enable SIMD
     -s WASM=1
   ```

3. **Feature Detection**
   - Check if browser supports WASM SIMD
   - Load `rasterizer-simd.wasm` if supported, else `rasterizer.wasm`

**Expected Gain:** Additional 2x-3x (30-40 FPS → 60-80 FPS on 900K faces)

---

### PHASE 4B.3: SPARSE WIREFRAME WASM (Week 3)

**Goal:** Accelerate sparse wireframe rasterization

**Tasks:**
1. **Port `drawSparseLine` to C++**
   - Bresenham algorithm with density-based pixel skipping
   - Depth-aware occlusion testing

2. **Batch Line Drawing**
   - Instead of calling WASM for each line, batch 1000 lines per call
   - Reduces JS ↔ WASM overhead

**Expected Gain:** 2x-4x in WIRE mode (30-60 FPS → 100-200 FPS)

---

### PHASE 4B.4: POINT CLOUD WASM (Optional)

**Goal:** Accelerate point cloud generation

**Tasks:**
1. **Port `sampleSurfaceGrid` to C++**
   - Isometric lattice subdivision
   - Spatial deduplication

**Expected Gain:** 3x-4x (60 FPS → 200+ FPS in POINTS mode)

---

## TECHNICAL ARCHITECTURE

### Memory Layout (Shared Between JS and WASM)

```
┌─────────────────────────────────────┐
│   SharedArrayBuffer (Heap)          │
├─────────────────────────────────────┤
│ Framebuffer (Uint32Array)           │  ← RGBA pixels
│ Size: width * height * 4 bytes      │
├─────────────────────────────────────┤
│ Depth Buffer (Float32Array)         │  ← Z-values
│ Size: width * height * 4 bytes      │
├─────────────────────────────────────┤
│ Screen Buffer (Float32Array)        │  ← Projected vertices
│ Size: vertexCount * 4 * 4 bytes     │
├─────────────────────────────────────┤
│ Index Buffer (Uint32Array)          │  ← Triangle indices
│ Size: faceCount * 3 * 4 bytes       │
└─────────────────────────────────────┘
```

### WASM Function Signatures

```cpp
// C++ exports
extern "C" {
    void drawTriangle(
        uint32_t* framebuffer,
        float* depthBuffer,
        float x0, float y0, float z0,
        float x1, float y1, float z1,
        float x2, float y2, float z2,
        uint32_t color,
        int width, int height
    );
    
    void clearBuffers(
        uint32_t* framebuffer,
        float* depthBuffer,
        int width, int height
    );
    
    void renderBatch(
        uint32_t* framebuffer,
        float* depthBuffer,
        float* screenBuffer,
        uint32_t* indexBuffer,
        float* intensities,
        uint32_t* sortedIndices,
        int faceCount,
        uint32_t baseColor,
        int width, int height
    );
}
```

---

## BUILD TOOLING

### Prerequisites
```bash
# Install Emscripten (WASM compiler)
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

### Build Commands
```bash
# Development build (with debug symbols)
npm run build:wasm:dev

# Production build (optimized)
npm run build:wasm:prod

# SIMD build
npm run build:wasm:simd
```

### package.json Scripts
```json
{
  "scripts": {
    "build:wasm:dev": "emcc js/core/wasm/rasterizer.cpp -o js/core/wasm/rasterizer.wasm -O0 -g -s WASM=1",
    "build:wasm:prod": "emcc js/core/wasm/rasterizer.cpp -o js/core/wasm/rasterizer.wasm -O3 -s WASM=1",
    "build:wasm:simd": "emcc js/core/wasm/rasterizer.cpp -o js/core/wasm/rasterizer-simd.wasm -O3 -msimd128 -s WASM=1"
  }
}
```

---

## FALLBACK STRATEGY

### Browser Compatibility
- **WASM Support:** Chrome 57+, Firefox 52+, Safari 11+, Edge 16+
- **SIMD Support:** Chrome 91+, Firefox 89+, Safari 16.4+

### Graceful Degradation
```javascript
// Feature detection
const hasWASM = typeof WebAssembly !== 'undefined';
const hasSIMD = hasWASM && WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));

// Load appropriate rasterizer
if (hasSIMD) {
    await loadWASMRasterizer('rasterizer-simd.wasm');
} else if (hasWASM) {
    await loadWASMRasterizer('rasterizer.wasm');
} else {
    console.warn('WASM not supported, using JavaScript rasterizer');
    // Use RasterizerPixel.js
}
```

---

## BENCHMARKING PLAN

### Test Models
1. **Pyramid (6 faces)** - Baseline
2. **Large Troll (81K faces)** - Medium complexity
3. **Massive Model (900K faces)** - Stress test

### Metrics to Track
- **FPS:** Frames per second
- **Frame Time:** Milliseconds per frame
- **Rasterizer Time:** Time spent in `drawTriangle` calls
- **Memory Usage:** Heap size

### Benchmark Script
```javascript
// js/benchmark.js
function benchmarkRasterizer(model, iterations = 100) {
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        renderFrame(model);
        const end = performance.now();
        times.push(end - start);
    }
    
    const avg = times.reduce((a, b) => a + b) / times.length;
    const fps = 1000 / avg;
    
    console.log(`Model: ${model.name}`);
    console.log(`Avg Frame Time: ${avg.toFixed(2)}ms`);
    console.log(`FPS: ${fps.toFixed(2)}`);
}
```

---

## RISKS & MITIGATION

### Risk 1: WASM Binary Size
- **Risk:** WASM file adds 50-200KB to download
- **Mitigation:** Use `-Oz` (optimize for size) instead of `-O3` if needed
- **Mitigation:** Lazy-load WASM only when needed (e.g., high-poly models)

### Risk 2: Browser Compatibility
- **Risk:** Older browsers don't support WASM or SIMD
- **Mitigation:** Maintain JavaScript fallback (current `RasterizerPixel.js`)
- **Mitigation:** Feature detection and graceful degradation

### Risk 3: Debugging Difficulty
- **Risk:** WASM is harder to debug than JavaScript
- **Mitigation:** Maintain debug build with source maps
- **Mitigation:** Extensive unit tests for C++ code
- **Mitigation:** Logging/assertions in WASM code

### Risk 4: Memory Management
- **Risk:** Manual memory management in C++ (no GC)
- **Mitigation:** Use RAII patterns (smart pointers)
- **Mitigation:** Valgrind/AddressSanitizer during development

---

## SUCCESS CRITERIA

### Phase 4B.1 (Core WASM)
- ✅ 900K face model renders at 30-40 FPS (currently 8 FPS)
- ✅ Visual output matches JavaScript rasterizer (pixel-perfect)
- ✅ Fallback to JS works on non-WASM browsers

### Phase 4B.2 (SIMD)
- ✅ 900K face model renders at 60-80 FPS
- ✅ SIMD detection and feature gating works
- ✅ No visual artifacts or z-fighting

### Phase 4B.3 (Sparse Wireframe)
- ✅ WIRE mode renders at 100-200 FPS on 900K faces
- ✅ Depth-aware occlusion still works

---

## TIMELINE

**Week 1:** Phase 4B.1 (Core WASM Rasterizer)
- Day 1-2: Write C++ rasterizer, set up build tooling
- Day 3-4: Create WASM loader, integrate into engine
- Day 5: Benchmark and debug

**Week 2:** Phase 4B.2 (SIMD Optimization)
- Day 1-2: Rewrite scanline loop with SIMD
- Day 3: Feature detection and dual-build system
- Day 4-5: Benchmark and optimize

**Week 3:** Phase 4B.3 (Sparse Wireframe WASM)
- Day 1-2: Port `drawSparseLine` to C++
- Day 3: Batch line drawing optimization
- Day 4-5: Final benchmarks and documentation

---

## FUTURE ENHANCEMENTS (POST-WASM)

### Phase 5: Texture Mapping
- WASM-accelerated texture sampling
- Bilinear filtering in SIMD
- Mipmap generation

### Phase 6: Advanced Shading
- Normal mapping
- Ambient occlusion
- Physically-based rendering (PBR)

### Phase 7: Multi-Threading
- Use Web Workers to parallelize rasterization
- Tile-based rendering (split screen into 4x4 tiles)
- Each worker processes a tile

---

**END OF ROADMAP** 🦾✨
**VEETANCE ENGINE - WASM ACCELERATION PATH**
**Commander:** MrVee | **Executant:** DEUS
