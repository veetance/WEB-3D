# VEETANCE: Procedural "Retro" Texturing Protocols 🦾🎨
**Commander:** MrVee | **Executant:** DEUS

Since the VEETANCE engine operates on a pure software rasterizer (CPU/WASM), traditional texture mapping (reading 2048x2048 PNGs) is memory-heavy and cache-unfriendly.

Instead, we employ **Procedural Mathematical Textures**. These are:
1.  **Infinite Resolution**: Calculated per-pixel equation.
2.  **Zero Memory**: No image buffers to store.
3.  **Retro Aesthetic**: Naturally produces the "PS1 / 1995" look.

---

## 1. Dithering (The "Shadow" Hack) 🏁
Instead of alpha blending (which requires reading the destination pixel = slow), we use screen-space dithering.

### The Math:
```javascript
// Checkerboard Dither
if ((x + y) % 2 === 0) {
    // Discard pixel to create 50% transparency
    return; 
}
```

### The Bayer Matrix (Advanced)
For smoother gradients (4x4 ordered dithering):
```cpp
const int bayer[4][4] = {
    { 0,  8,  2, 10 },
    { 12, 4, 14,  6 },
    { 3, 11,  1,  9 },
    { 15, 7, 13,  5 }
};
// If intensity < threshold, discard
if (intensity * 16 < bayer[x % 4][y % 4]) discard;
```

---

## 2. Affine Checkerboard 🏁
A classic "Infinite Floor" effect without UVs. We use World-Space coordinates.

### The Math:
```javascript
// World Space X/Z
const scale = 0.5;
const check = (Math.floor(worldX * scale) + Math.floor(worldZ * scale)) % 2;

if (check === 0) color = 0xFFFFFFFF; // White
else color = 0xFF000000;             // Black
```

**Why it looks Retro:**
Because we are not doing perspective-correct interpolation (W = 1/Z), the checkers will "warp" slightly near the camera, mimicking early 3D engines (Sega Saturn / PS1).

---

## 3. Tri-Planar Projection (No UVs Required) 🧊
For complex models (like the Troll) that don't have good UV maps, we project textures from the 3 cardinal axes.

### The Logic:
1.  Calculate Normal `N`.
2.  If `N` points mostly **Up/Down** (Y), use X/Z coordinates.
3.  If `N` points mostly **Forward/Back** (Z), use X/Y coordinates.
4.  If `N` points mostly **Left/Right** (X), use Y/Z coordinates.

```javascript
/* Pseudocode */
float3 weights = abs(normal);
weights = normalize(weights);

color += texture(planarX) * weights.x;
color += texture(planarY) * weights.y;
color += texture(planarZ) * weights.z;
```

---

## 4. The "Plasma" Surface 🌈
Animated, shifting colors based on vertex position and time.

```javascript
// Time-based undulation
float v = Math.sin(x * 0.1 + time) + Math.cos(z * 0.1 + time);
color = mapToPalette(v);
```

---

## Implementation Plan
We will inject these functions directly into the `drawSpan` loop in `scanline.js` (or its WASM equivalent).

**VEETANCE Directive:** Art through Logic. 🦾✨
