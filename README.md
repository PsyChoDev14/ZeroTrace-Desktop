# ⚡ ZeroTrace Desktop (Windows PC Client)

### *High-Performance Anti-Censorship Xray Client with Wintun Virtual L3 Adapter*

ZeroTrace Desktop is the native Windows PC client for ZeroTrace VPN, engineered with **Tauri v2**, **Rust**, and the **Wintun Virtual TUN driver**. It mirrors the design language, telemetry systems, and protocols of the Android application.

---

## 🌟 Key Features

* **Wintun Virtual L3 TUN Adapter:** High-performance kernel TUN interface (`10.233.233.2/24`) with MTU 1400.
* **Non-Disruptive Routing:** Uses split default routes (`0.0.0.0/1` and `128.0.0.0/1`) to route all system traffic into Wintun without deleting the physical adapter's default gateway.
* **Loop Prevention:** Automatically determines the physical default gateway and adds a `/32` host route for the proxy server.
* **Xray-Core Engine:** Full support for:
  * **VLESS:** XTLS Reality (`pbk`, `sid`), Vision (`xtls-rprx-vision`), WebSocket, gRPC, TCP, HTTPUpgrade.
  * **VMess:** WebSocket, TCP, TLS, AEAD.
  * **Trojan:** TLS, WebSocket, gRPC, native TCP.
  * **Shadowsocks:** AEAD 2022, `aes-128-gcm`, `aes-256-gcm`, `chacha20-poly1305`.
  * **Custom Xray JSON:** Raw JSON configurations.
* **DPI Bypass Engine:**
  * **Smart TLS Fragment:** Splits TLS `ClientHello` into micro-packets (`10-30` bytes, `10-20ms` delay) to bypass ISP firewalls.
  * **Deep Stealth Engine:** TLS Packet Fragmentation + Mux.Cool Multiplexing + uTLS Camouflage.
* **System-Wide DNS:** AdGuard Ad-Blocker (`94.140.14.14`), Cloudflare Speed (`1.1.1.1`), Cloudflare Security (`1.1.1.2`), Google (`8.8.8.8`), Quad9 (`9.9.9.9`), or Custom DNS.
* **Sri Lanka Bug-Host SNI Tweak:** Override SNI for zero-rated Dialog, Mobitel, or SLT carrier packages.
* **Liquid Glass UI:** Obsidian glass dial with breathing ambient glow, real-time throughput waveform, latency badges, and diagnostic logs console.

---

## 🛠️ Project Structure

```
desktop/
├── package.json              # Frontend dependencies (React 18, Vite, Tailwind, Lucide)
├── vite.config.ts            # Vite configuration tailored for Tauri v2
├── tailwind.config.js        # Design tokens matching Android Color.kt & LiquidGlass
├── index.html                # HTML entrypoint
├── src/
│   ├── App.tsx               # Main application shell & state orchestration
│   ├── index.css             # Liquid glass CSS and animations
│   ├── components/           # UI widgets (Dial, Cards, Modals, Nav, TitleBar)
│   ├── screens/              # Screens (Home, Servers, Statistics, Settings, Logs)
│   ├── types/                # TypeScript interface definitions
│   └── utils/                # Formatters and Tauri IPC bridge
└── src-tauri/
    ├── Cargo.toml            # Rust dependencies (tauri v2, wintun, tokio, etc.)
    ├── tauri.conf.json       # Tauri v2 frameless window and bundle configuration
    ├── build.rs              # Tauri build script
    ├── capabilities/         # Tauri security permissions
    ├── icons/                # High-res ZeroTrace app icons
    └── src/
        ├── models.rs         # Data structures matching Android codebase
        ├── parser.rs         # URI parsers with chat caption extraction
        ├── xray.rs           # Xray JSON generator & process supervisor
        ├── ping.rs           # Asynchronous TCP latency benchmark engine
        ├── storage.rs        # AppData persistent JSON configuration storage
        ├── commands.rs       # Tauri IPC commands
        ├── lib.rs            # Application builder & state initialization
        ├── main.rs           # Windows GUI entrypoint
        └── tun/
            ├── mod.rs        # TUN abstraction layer
            ├── windows.rs    # Wintun driver & Windows route table manager
            └── stub.rs       # macOS / Linux development fallback
```

---

## 🚀 Building & Running

### Prerequisites
* **Node.js:** v18+ and npm
* **Rust:** 1.77+ (`rustup default stable`)
* **Windows Target:** Windows 10/11 x64, with `wintun.dll` and `xray.exe` in the application path or bundled directory.

### Development Mode
```bash
cd desktop
npm install
npm run tauri dev
```
Or for browser UI preview:
```bash
npm run dev
```

### Production Build (Windows MSI / EXE)
```bash
cd desktop
npm run tauri build
```
The compiled installer will be generated in `src-tauri/target/release/bundle/`.

---

## 📦 Multi-Platform CI/CD (Windows & macOS)

A unified GitHub Actions workflow is provided in [`.github/workflows/desktop_release.yml`](../.github/workflows/desktop_release.yml).

When you push a version tag:
```bash
git tag desktop-v1.0.0
git push origin desktop-v1.0.0
```

GitHub Actions will automatically run parallel matrix runners:
* **Windows Runner (`windows-latest`):** Bundles `wintun.dll` and `xray.exe`, compiles the Rust backend, and generates `.msi` and `.exe` installers.
* **macOS Runner (`macos-latest`):** Bundles `xray`, compiles the arm64/x86_64 binaries, and generates `.dmg` installers.
* **Unified Release:** Publishes both Windows and macOS installers to the same GitHub Release simultaneously!
