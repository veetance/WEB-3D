# GLB Format

Binary glTF 2.0 file format parsing.

---

## File Structure

```
┌──────────────────────────────┐
│  HEADER (12 bytes)           │
│    Bytes 0-3:  Magic "glTF"  │
│    Bytes 4-7:  Version (2)   │
│    Bytes 8-11: Total length  │
├──────────────────────────────┤
│  CHUNK 0: JSON               │
│    4 bytes: Chunk length     │
│    4 bytes: Type (0x4E4F534A)│
│    N bytes: JSON data        │
├──────────────────────────────┤
│  CHUNK 1: BIN                │
│    4 bytes: Chunk length     │
│    4 bytes: Type (0x004E4942)│
│    M bytes: Binary data      │
└──────────────────────────────┘
```

---

## JSON Chunk

Contains scene description:
- **meshes** — Array of mesh definitions
- **accessors** — Metadata about data arrays
- **bufferViews** — Slices into binary buffer

---

## Accessor

Describes typed array in binary chunk:

```json
{
    "bufferView": 0,
    "byteOffset": 0,
    "componentType": 5126,  // FLOAT
    "count": 100,
    "type": "VEC3"
}
```

### Component Types
- `5126` = FLOAT (4 bytes)
- `5123` = UNSIGNED_SHORT (2 bytes)
- `5125` = UNSIGNED_INT (4 bytes)
- `5121` = UNSIGNED_BYTE (1 byte)

---

## Reading Vertices

```javascript
const accessor = gltf.accessors[positionIndex];
const view = gltf.bufferViews[accessor.bufferView];
const offset = binStart + view.byteOffset + accessor.byteOffset;
const stride = view.byteStride || 12; // 3 floats * 4 bytes

for (let i = 0; i < accessor.count; i++) {
    const vOffset = offset + i * stride;
    const x = dataView.getFloat32(vOffset, true);
    const y = dataView.getFloat32(vOffset + 4, true);
    const z = dataView.getFloat32(vOffset + 8, true);
    vertices.push({ x, y, z });
}
```

---

## Key Insight

We use `DataView` instead of typed arrays to avoid byte alignment issues.
`Float32Array` requires 4-byte aligned offsets; `DataView` does not.

---

*GLB is just structured bytes. No magic, just specification.*
