# 💻 BUKKIT Desktop (Electron Windows & Multi-Platform)

This folder contains the **Electron Desktop Application** architecture for **BUKKIT — Campus Food Marketplace**.

---

## 📁 Architecture Overview

- **`electron/main.cjs`**: Electron main process entry point. Manages native window lifecycle, menus, single-instance locking, OS notifications, and secure external URL routing.
- **`electron/preload.cjs`**: Context isolation bridge exposing safe native window APIs (`window.electronAPI`) to the React web app.
- **`electron/electron-builder.json`**: Build & packaging configuration for generating Windows **`.exe` (NSIS Installer)** and **`.exe` (Standalone Portable)** executables.
- **`.github/workflows/build-electron-exe.yml`**: GitHub Actions CI/CD pipeline that automatically compiles, packages, checksums, and publishes downloadable Windows `.exe` releases.

---

## 🛠️ Local Development & Commands

### 1. Run Electron in Development Mode
```bash
# Terminal 1: Start Vite Dev Server
npm run dev

# Terminal 2: Launch Electron Window pointing to dev server
ELECTRON_START_URL=http://localhost:3000 npx electron electron/main.cjs
```

### 2. Build Windows `.exe` Locally
```bash
# 1. Compile web production bundle
npm run build

# 2. Package Windows Installer & Portable .exe
npx electron-builder --win --x64 --config electron/electron-builder.json
```
The compiled binaries will be output into the `dist-electron/` directory:
- `Bukkit-Setup-0.0.0.exe` (Windows NSIS Setup Installer)
- `Bukkit-Portable-0.0.0.exe` (Standalone Portable Executable, runs with no installation needed)

---

## 🚀 GitHub Actions Automated Build

The `.github/workflows/build-electron-exe.yml` workflow automatically runs on push to `main` / `master` / `dev` or on manual `workflow_dispatch`.

It produces:
1. **GitHub Artifacts**: Downloadable `.zip` containing both `.exe` files and SHA-256 checksums.
2. **GitHub Releases**: Tagged release with attached `Bukkit-Setup-*.exe` and `Bukkit-Portable-*.exe`.
