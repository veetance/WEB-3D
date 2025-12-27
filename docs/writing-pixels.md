# Writing Pixels

Direct pixel manipulation — the ultimate primitive.

---

## The Tsoding Insight

PPM format: write RGB bytes directly to a file.
Canvas 2D: write RGBA bytes directly to `ImageData`.

Same concept, different medium.

---

## ImageData API

```javascript
// Create buffer
const imageData = ctx.createImageData(width, height);
const pixels = imageData.data; // Uint8ClampedArray [R,G,B,A,R,G,B,A,...]

// Set a pixel at (x, y)
function setPixel(x, y, r, g, b) {
    const i = (y * width + x) * 4;
    pixels[i + 0] = r;     // Red   0-255
    pixels[i + 1] = g;     // Green 0-255
    pixels[i + 2] = b;     // Blue  0-255
    pixels[i + 3] = 255;   // Alpha (opaque)
}

// Push to canvas
ctx.putImageData(imageData, 0, 0);
```

---

## CPU Fragment Shader

A fragment shader is a function that runs per-pixel.

```javascript
function fragmentShader(uv, time) {
    // uv = normalized coordinates { x: [0,1], y: [0,1] }
    // time = animation time in seconds
    // Returns color { r, g, b } each [0, 1]
    
    return {
        r: uv.x,
        g: uv.y,
        b: Math.sin(time * 3.14) * 0.5 + 0.5
    };
}
```

---

## Rendering Loop

```javascript
function render(time) {
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const uv = { 
                x: x / width, 
                y: y / height 
            };
            
            const color = fragmentShader(uv, time);
            
            setPixel(x, y, 
                color.r * 255, 
                color.g * 255, 
                color.b * 255
            );
        }
    }
    ctx.putImageData(imageData, 0, 0);
}
```

---

## Shader Primitives

To run GLSL-like shaders on CPU, we need:

| GLSL | JavaScript |
|------|------------|
| `vec2` | `{ x, y }` |
| `vec3` | `{ x, y, z }` |
| `a * b` (vec * scalar) | `scale(a, b)` |
| `a + b` (vec + vec) | `add(a, b)` |
| `sin(x)` | `Math.sin(x)` |
| `length(v)` | `Math.hypot(v.x, v.y)` |

---

## This Is All Shaders Are

GPU shaders do this in parallel.
CPU shaders do this sequentially.
Same math, different hardware.

---

*When you can write pixels, you can render anything.*
