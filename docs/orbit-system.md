# VEETANCE Orbit Control System

The Orbit System in the F.A.S.T. engine is a high-fidelity interaction layer designed for precise spatial navigation within the manifold. It operates on a **Fixed-Target Orbit** model, where the camera maintains a constant focus on a central coordinate while rotating across spherical axes.

---

## 🛰️ Core Mechanics

### 1. Angular Transformation
The engine utilizes two primary Euler angles to determine the observer's perspective:
- **Orbit X (Pitch)**: Controls the vertical incline (rotation around the global X-axis).
- **Orbit Y (Yaw/Azimuth)**: Controls the horizontal rotation (rotation around the global Z-axis).

### 2. Interaction Logic (`controls.js`)
The interaction follows a **Direct-Manipulation (Grab-and-Pull)** model. 

- **Input Detection**: Tracks `dx` (Horizontal) and `dy` (Vertical) mouse/touch deltas.
- **Rotation Formula**:
  ```javascript
  orbitY += dx * sensitivity; // Horizontal swipe rotates Azimuth
  orbitX += dy * sensitivity; // Vertical swipe rotates Pitch
  ```
- **Inertia Phase**: Upon releasing the drag, the system applies decayed velocity to the orbit angles to ensure organic visual transitions.

### 3. View Matrix Construction (`camera.js`)
The camera matrix is reconstructed every frame following this specific hierarchy:
1. **Identity Initialization**: resets the View Matrix.
2. **Translation (Zoom)**: Pushes the world into Negative Z space based on the `zoom` factor.
3. **Rotational Application**:
   - `rotateX` is applied using the `orbitX` value.
   - `rotateZ` is applied using the `orbitY` value.
4. **Target Offsetting**: Translates the coordinate space relative to the `camera.target` to ensure the object remains the pivot of the rotation.

---

## ⚙️ Sensitivity & Constraints
- **Standard Sensitivity**: `0.01` rad per pixel.
- **Zoom Range**: Clamped between `0.1` and `20.0` to prevent manifold clipping or mathematical singularity.
- **Right-Click (Pan)**: Offsets the `camera.target` coordinate, allowing the observer to shift the focal point of the orbit.

---

*VEETANCE: Precision is not an option; it is the default state.* 🦾✨
