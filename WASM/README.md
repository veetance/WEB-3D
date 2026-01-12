# VEETANCE WASM Scripts

This folder contains the WebAssembly build tooling for Phase 4B.

## Files

### `setup-wasm.ps1`
Automated Emscripten SDK installation script.

**What it does:**
- Clones Emscripten SDK to `C:\emsdk`
- Installs latest compiler toolchain
- Activates SDK and sets environment variables
- Verifies installation

**How to run:**
```powershell
# Option 1: Right-click setup-wasm.ps1 → "Run with PowerShell"

# Option 2: From PowerShell terminal
cd C:\D-DRIVE\WEB-3D\WASM
.\setup-wasm.ps1
```

**Prerequisites:**
- Git installed
- Internet connection (~500MB download)
- Administrator privileges (recommended)

---

### `build.ps1`
WASM compilation script for the rasterizer.

**What it does:**
- Compiles `js/core/wasm/rasterizer.cpp` to WebAssembly.
- Automatically activates the Emscripten environment.
- Outputs `rasterizer.wasm` and `rasterizer.js`.

**How to run:**
```powershell
cd C:\D-DRIVE\WEB-3D\WASM
.\build.ps1
```

**Prerequisites:**
- Emscripten SDK installed (run `setup-wasm.ps1` first)
- Environment variables set (close/reopen terminal after setup)

---

## Quick Start

**Step 1: Install Emscripten**
```powershell
cd C:\D-DRIVE\WEB-3D\WASM
.\setup-wasm.ps1
```

**Step 2: Close and reopen your terminal**
(This refreshes environment variables)

**Step 3: Build WASM modules**
```powershell
cd C:\D-DRIVE\WEB-3D\WASM
.\build.ps1
```

**Step 4: Verify**
Check that these files exist:
- `C:\D-DRIVE\WEB-3D\js\core\wasm\rasterizer.wasm`
- `C:\D-DRIVE\WEB-3D\js\core\wasm\rasterizer-simd.wasm`

---

## Troubleshooting

### "emcc not found" error
**Solution:** Activate Emscripten manually:
```powershell
cd C:\emsdk
.\emsdk_env.ps1
```

### "Access denied" error
**Solution:** Run PowerShell as Administrator

### Build fails with "source file not found"
**Solution:** The build script will auto-generate a placeholder. If it still fails, check that you're in the correct directory.

---

## Next Steps (After Build)

1. Implement actual rasterizer in `js/core/wasm/rasterizer.cpp`
2. Create WASM loader in `js/core/rasterizer-wasm.js`
3. Integrate into `js/core/engine.js`
4. Benchmark performance (target: 60-80 FPS on 900K faces)

---

**For detailed implementation roadmap, see:** `wasm-roadmap.md`
