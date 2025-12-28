# VEETANCE Manifold - Asset Ingestion Protocols

## 1. The GLB Alignment Hurdle
GLB (binary glTF) files utilize a chunked architecture. Per the specification, every chunk (JSON and BIN) must be **aligned to a 4-byte boundary**. 
*   **The Conflict**: Many exporters (or manual buffer constructions) add padding bytes to satisfy this. 
*   **The Failure**: If a parser ignores the padding, the Binary Chunk header starts at the wrong offset, leading to a "Binary chunk missing" or "Invalid Magic" exception.
*   **The Solution**: VEETANCE utilizes a clinical padding-offset calculation: `(4 - (jsonLen % 4)) % 4` to determine the exact start of the BIN manifold.

## 2. The Interleaving / Stride Paradox (The "Garbage" Manifestation)
High-fidelity assets often "interleave" their data streams—where `Position`, `Normal`, and `UV` data are packed into a single continuous buffer.
*   **The Failure**: A naive parser assumes a 12-byte stride (just X, Y, Z). When reading an interleaved buffer, this results in **"Garbage Spikes"** as the parser reads Normals/UVs as if they were coordinates. This was the cause of the corrupted "spike" mesh during the initial helmet load.
*   **The Logic**: VEETANCE now inspects the `byteStride` property of the `bufferView`. If the stride is 32 bytes (common for Pos+Norm+UV), we jump exactly 32 bytes between vertex reads, extracting only the geometric essence.

## 3. The Node Hierarchy Factor (The "Face Down" Anomaly)
glTF files are not just a collection of meshes; they are a tree of nodes.
*   **The Failure**: Many exporters (like Blender) apply a root-level rotation of -90 degrees on the X-axis to convert their native Z-Up to glTF's Y-Up. If a parser only reads the mesh data and ignores the node matrix, the model manifests "Faced Down" or "Upside Down".
*   **The Solution**: VEETANCE now performs a full **Scene Graph Traversal**, multiplying child node matrices by their parents and transforming every vertex into a unified world space before the final Z-Up rotation is applied.

## 4. Unified Manifold Normalization
Initially, OBJ and GLB handling diverged.
*   **The Neutralization**: Logic has been consolidated into a single `finalizeManifold` utility. All assets—regardless of origin—are now processed through the same clinical normalization, scaling (8.0), and Z-Up coordinate parity check.

## 5. The Ghost Sphere (State Persistence Error)
glTF is natively **Y-Up** (Right-Handed). VEETANCE is **Z-Up** (Extraterrestrial Standard).
*   **Initial Deviation**: Mapping `(x, y, z)` to `(x, z, -y)` caused the "Face Up, Head Back" orientation anomaly.
*   **Calibrated Sync**: To achieve "Face Front, Head Up", we map:
    *   X stays X.
    *   Old Forward (+Z) becomes New Forward (+Y).
    *   Old Up (+Y) becomes New Up (+Z).
    *   **Mapping**: `newPos = (x, z, y)`.

## 4. Normalization & Resonance
Imported assets arrive with arbitrary world scales.
*   **Stabilization**: VEETANCE calculates the bounding box and applies a uniform scale multiplier (8.0 as of v4.2) and centers the manifold at the origin.
*   **Culling**: We utilize an Area-based CCW culling in screen-space to ensure only the "Skin" of the manifold is rendered, purging the internal geometry.

---
*VEETANCE Engineering - DEUS 🦾✨*
