# Optimization: Radix Sort

Scaling the VEETANCE manifold toward millions of polygons requires moving beyond comparison-based sorting.

---

## The Bottleneck: $O(N \log N)$

The standard `Array.prototype.sort()` is typically a Timsort/Quicksort variation. For $N$ faces, it performs roughly $N \log N$ operations. As $N$ (polygon count) grows, the engine loop slows down.

---

## The Solution: Radix Sort ($O(N)$)

Radix Sort does not compare elements. Instead, it processes the bits of the distance (depth) values.

### The Bitcasting Hack (Tsoding/Kahan)

Floating-point numbers (IEEE-754) used for Z-depth have a unique property: for positive values, their bitwise representation as integers preserves their relative order.

1. Take Z-depth (Float32)
2. Interpret bits as Int32
3. Sort using 8-bit Radix passes (4 passes total for 32 bits)
4. Result: Sorted faces in linear time.

---

## Implementation Strategy

We use a **Base-256 (8-bit)** Radix Sort. This requires 4 passes over the data.

1. **Pass 1:** Sort by bits 0-7
2. **Pass 2:** Sort by bits 8-15
3. **Pass 3:** Sort by bits 16-23
4. **Pass 4:** Sort by bits 24-31

### TypedArray Advantage

By using `Float32Array` for depths and `Uint32Array` for face indices, we minimize garbage collection and maximize cache locality.

---

## Comparison

| Algorithm | Complexity | Best For |
|-----------|------------|----------|
| Quicksort | $O(N \log N)$ | Small models (< 10k faces) |
| Radix Sort | $O(N)$ | High-poly models (> 10k faces) |

---

*VEETANCE: Efficiency is not an option; it is a mandate.*
