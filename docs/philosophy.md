# VEETANCE: Interaction Manifest & Spatial Logic

This document codifies the core interaction patterns and architectural rationale behind the VEETANCE 3D Engine.

## [1] Kinetic Orbit Pattern (Direct Input)
Unlike traditional CAD software that often defaults to "Flight" or "Inverted" camera logic, VEETANCE utilizes a **Direct Kinetic Orbit**.

- **Implementation**: The mouse `deltaX` and `deltaY` map directly to `orbitY` and `orbitX` respectively, without inversion.
- **The Rationale**: To provide a sense of **Tactile Dominance**. Moving the mouse right rotates the viewpoint right; dragging down tilts the world down. This pattern creates a 1:1 mental mapping between user intent and object rotation, removing the cognitive overhead of "navigating a camera" and replacing it with the sensation of "manipulating a manifold."

## [2] Spatial Overlay Scrollbar
The sidebar utilizes a custom **Absolute Overlay Scrollbar** decoupled from the standard browser rendering flow.

- **Architecture**:
    - Native scrollbars are purged (`display: none`).
    - A custom `custom-scrollbar` manifold is absolutely positioned over the right gutter of the sidebar.
    - Thumb height and position are synchronized via a dedicated kinetic engine in `ui.js`.
- **The Rationale (The "Gutter" Philosophy)**: 
    - **Horizontal Focal Stability**: By overlaying the scrollbar on top of existing gutters rather than placing it beside them, we prevent "layout jumping" when content depth changes. 
    - **Alignment Parity**: This allows fixed elements (like the **ASSET I/O** zone) and scrollable sections to share the exact same horizontal Focal Plane.
    - **Aesthetic Sovereignty**: The stealth-to-glow transition keeps the interface clean, only manifesting control when the user summons it through interaction.

## [3] Architectural Mandate: No Terrestrial Debt
Every interaction choice in VEETANCE is designed to eliminate "Earth-side" technical debt. 

- **Z-Up Sovereignty**: We discard the arbitrary Y-Up world-view of old realms in favor of a mathematically stable Z-Up coordinate system.
- **Buffer-First Rendering**: Every frame is calculated through raw TypedArrays for maximum information density and zero garbage collection, ensuring the engine remains surgical even under high asset load.

---
*VEETANCE Excellence is achieved through the elimination of friction.* 🦾✨
