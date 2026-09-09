<div align="center">

# ⚡ ZeroTrace Desktop
### *Ultra-Fast • Anti-Censorship • Privacy-First macOS & Windows Xray Client*

[![Latest Release](https://img.shields.io/github/v/release/PsyChoDev14/ZeroTrace-Desktop?color=00F0FF&label=Release&logo=github&style=for-the-badge)](https://github.com/PsyChoDev14/ZeroTrace-Desktop/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11%20%7C%20macOS%2012%2B-5468FF?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/PsyChoDev14/ZeroTrace-Desktop)
[![Core Engine](https://img.shields.io/badge/Engine-Xray--Core%20v26%2B-7C4DFF?style=for-the-badge&logo=shield&logoColor=white)](https://github.com/XTLS/Xray-core)
[![Built With](https://img.shields.io/badge/Built%20With-Tauri%20v2%20•%20Rust%20•%20React%2018-FFA502?style=for-the-badge&logo=rust&logoColor=white)](https://tauri.app)
[![License](https://img.shields.io/badge/License-MIT-35C77B?style=for-the-badge)](LICENSE)
[![Build Status](https://img.shields.io/badge/Build-Passing%20(Multi--Platform)-00E5FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/PsyChoDev14/ZeroTrace-Desktop/actions)

<br/>

[📥 **Download Latest Release**](https://github.com/PsyChoDev14/ZeroTrace-Desktop/releases/latest) • [✨ **Features**](#-key-features) • [📋 **Feature Matrix**](#-protocol--feature-matrix) • [🚀 **Getting Started**](#-getting-started) • [💻 **Tech Stack**](#-tech-stack--architecture)

---

</div>

## 🌟 Overview

**ZeroTrace Desktop** is a next-generation, high-performance desktop VPN and proxy client for **Windows 10/11** and **macOS (Apple Silicon & Intel)**. Powered by modern **Xray-Core**, **Rust**, and **Tauri v2**, ZeroTrace Desktop delivers unmatched network throughput, state-of-the-art anti-censorship DPI evasion (VLESS XTLS Reality & Vision), zero-admin system proxy routing, built-in AdGuard ad-blocking DNS, carrier SNI bug-host overrides, real-time diagnostic telemetry, and seamless in-app auto-updates.

---

## ✨ Key Features

### 🛡️ 1. Advanced Anti-Censorship & Encryption
* **VLESS XTLS Reality & Vision:** Eliminates traditional VPN signatures. Encrypted traffic is completely indistinguishable from standard TLS connections to major foreign CDN domains (Apple, Microsoft, Cloudflare).
* **Smart TLS Packet Fragmentation:** Defeats state-level and ISP Deep Packet Inspection (DPI) by fragmenting TLS `ClientHello` packets into micro-chunks (`2-8ms` interval) with zero bandwidth penalty.
* **Modern TLS Certificate Verification:** Built-in `verifyPeerCertByName` support for modern Xray-core engines, allowing safe SNI tweaking without insecure certificate bypasses.
* **Multi-Protocol Powerhouse:** Native support for `VLESS`, `VMess`, `Trojan`, `Shadowsocks (AEAD 2022)`, and custom raw `Xray JSON` configurations.

### ⚡ 2. Gigabit Performance & Low-Latency Engine
* **4096 KB (4MB) High-Throughput Pipe Buffer:** Enlarged internal I/O stream buffers prevent packet drops and buffer overruns during high-speed multi-megabit transfers and 4K/8K streaming.
* **TCP Fast Open (TFO) & KeepAlive:** Disables Nagle's algorithm (`tcpNoDelay`), enables TFO to eliminate 1 RTT during connection handshakes, and maintains active keep-alive probes to prevent router/NAT disconnects.
* **Zero-Latency Async Host Pre-Resolution:** Resolves server endpoints asynchronously before dialing, injecting resolved IP addresses directly into outbound routes to eliminate per-connection DNS lookup delays.
* **Non-Blocking Async Ping Engine:** High-concurrency Tokio latency benchmark engine with IPv4 prioritization, preventing dual-stack IPv6 timeout hangs on cellular hotspots.

### 🌐 3. Seamless Multi-Platform System Proxy
* **Windows WinINet Integration:** Automated registry proxy configuration (`HTTP`, `HTTPS`, `SOCKS5`, `FTP`) with instant `InternetSetOptionA` broadcasting—requires **no administrator privileges** or virtual network drivers.
* **macOS Automated Network Routing:** Dynamically detects the active default gateway interface (`en0`, Ethernet, Wi-Fi) and configures macOS system proxy settings via `networksetup`.
* **Intelligent Local LAN Bypass:** Built-in proxy override rules for `127.0.0.1`, `localhost`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, and `*.local`. Local network devices, AirDrop, local printers, and local development servers (`localhost:3000`) never break while connected.
* **Startup Crash Self-Healing:** Automatically audits and restores clean system network proxy states on application launch, ensuring that unexpected computer reboots or crashes never leave the user without internet access.

### 🛡️ 4. Built-in AdGuard Ad-Blocker & Security DNS
* **AdGuard Ad-Blocking DNS (`94.140.14.14`):** Blocks annoying banner ads, video ads, trackers, and analytics telemetry system-wide at the DNS level.
* **Cloudflare Speed DNS (`1.1.1.1`):** Ultra-low latency DNS resolver optimized for gaming and fast web browsing.
* **Cloudflare Security (`1.1.1.2`):** Real-time automatic blocking of phishing, scam, and malware domains.
* **Quad9 Threat Defense (`9.9.9.9`):** Malicious domain, botnet, and ransomware filtering.
* **Google Public DNS (`8.8.8.8`):** Rock-solid global DNS resolution.

### 🇱🇰 5. Carrier SNI Override (Sri Lanka Bug-Host Tweak)
* **Zero-Rated Package Support:** Override SNI for zero-rated Dialog, Mobitel, SLT, or Airtel packages.
* **Automatic Certificate Mapping:** Automatically maps the real upstream server certificate CN/SAN via `verifyPeerCertByName` when bug-host SNIs are configured, preventing handshake failures on modern Xray cores.

### 🩺 6. Real-Time Diagnostics & 1-Click WhatsApp Support
* **Live Engine Log Streaming:** Real-time background stdout/stderr capture with automatic `INFO`, `WARN`, and `ERROR` categorization.
* **1-Click WhatsApp Support Bundle:** Generates a sanitized diagnostic report (OS version, active config summary without credentials, settings, last 80 log lines) and opens WhatsApp Support (`+94 78 838 5465`) with the report ready to send.
* **1-Click .txt Log Export:** Download sanitized diagnostic bundles for offline review and troubleshooting.

### 🔄 7. In-App OTA Auto-Updater
* **Real-Time Progress Bar:** Neon-cyan animated progress bar with streaming token-by-token download progress, stage indicators (`downloading` ➔ `verifying` ➔ `installing` ➔ `restarting`), and live byte counters.
* **macOS Process-Watcher Relaunch:** Background PID-watcher script waits for the old process to terminate before seamlessly opening the newly updated `/Applications/ZeroTrace.app`.
* **Windows SmartScreen Auto-Unblock:** Strips `Zone.Identifier` Mark-of-the-Web (MOTW) via PowerShell `Unblock-File` for seamless installation.

### 🎨 8. Minimalist Liquid Glass UI
* **Apple Human Interface Guidelines (HIG):** Grounded in Clarity, Deference, and Depth with a refined dark cyberpunk aesthetic.
* **Tactile Central Connection Dial:** Ambient breathing glow with fluid status transitions and live uptime clock.
* **Battery-Aware Adaptive Polling:** Dynamic polling intervals that automatically throttle during background / minimized state (macOS App Nap friendly) to minimize CPU usage.

---

## 📋 Protocol & Feature Matrix

| Feature | Supported Methods / Capabilities |
| :--- | :--- |
| **VLESS** | `XTLS Reality`, `Vision (xtls-rprx-vision)`, `WebSocket`, `gRPC`, `TCP`, `HTTPUpgrade` |
| **VMess** | `WebSocket`, `gRPC`, `TCP`, `TLS / Non-TLS`, `AEAD Encryption` |
| **Trojan** | `TLS`, `gRPC`, `WebSocket`, `Native TCP` |
| **Shadowsocks** | `AEAD 2022`, `aes-128-gcm`, `aes-256-gcm`, `chacha20-poly1305` |
| **Anti-Censorship** | `Smart TLS Fragment`, `Deep Stealth`, `uTLS Camouflage (Chrome, Firefox, Safari)` |
| **Routing Strategy** | `IPIfNonMatch` (Accurate domain & LAN bypass resolution) |
| **System Proxy** | `WinINet API (Windows)` • `networksetup (macOS)` • `LAN Bypass Overrides` |
| **DNS Resolvers** | `AdGuard Ad-Blocker`, `Cloudflare 1.1.1.1`, `Cloudflare Security`, `Quad9`, `Google DNS` |
| **Supported OS** | `Windows 10/11 (x64)`, `macOS 12+ (Apple Silicon M1/M2/M3/M4 & Intel)` |

---

## 🚀 Getting Started

### 1. Installation

* **Windows:**
  1. Download the latest installer from [**GitHub Releases**](https://github.com/PsyChoDev14/ZeroTrace-Desktop/releases/latest) (e.g. `ZeroTrace_<version>_x64-setup.exe` or `.msi`).
  2. Run the installer and launch ZeroTrace from your Start Menu or Desktop.
* **macOS:**
  1. Download `ZeroTrace_<version>_universal.dmg` from [**GitHub Releases**](https://github.com/PsyChoDev14/ZeroTrace-Desktop/releases/latest).
  2. Open the DMG and drag **ZeroTrace** into your **Applications** folder.

### 2. Adding a Server Configuration

ZeroTrace Desktop provides three quick ways to import server nodes:
* **📋 Clipboard Paste:** Copy any `vless://`, `vmess://`, `trojan://`, or `ss://` link and click **"Paste Config"**.
* **📷 Import QR Code:** Click the QR code button to upload a server QR code image or screenshot.
* **⚙️ Custom JSON:** Paste raw full Xray JSON configuration for advanced custom routing setups.

### 3. Connect!

* Click the central **Connect Dial** on the Home screen.
* Enjoy ultra-fast, encrypted, uncensored internet with live download/upload throughput counters and ping latency metrics!

---

## 💻 Tech Stack & Architecture

ZeroTrace Desktop combines a lightweight Rust native supervisor with a high-performance React user interface:

```
┌─────────────────────────────────────────────────────────────┐
│                  ZeroTrace Desktop UI Layer                 │
│      React 18 • TypeScript • Tailwind CSS • Lucide Icons    │
├──────────────────────────────┬──────────────────────────────┤
│      Tauri IPC Bridge        │    Live Diagnostic Stream    │
│  State Management • Events   │ Background Stdout/Stderr Pipe│
├──────────────────────────────┴──────────────────────────────┤
│                  Rust Core Engine Supervisor                │
│ tokio Async Runtime • Non-Blocking Ping • Config Generator   │
├──────────────────────────────┬──────────────────────────────┤
│     Windows System Proxy     │      macOS System Proxy      │
│   WinINet Registry + Refresh │ networksetup + Bypass Domains│
├──────────────────────────────┴──────────────────────────────┤
│                      Xray-Core Engine                       │
│   VLESS Reality • Vision • VMess • Trojan • Shadowsocks 2022│
└─────────────────────────────────────────────────────────────┘
```

### 🖥️ Desktop & UI Architecture
* **Frontend Framework:** **React 18** with **TypeScript**
* **Bundler & Build Tool:** **Vite 6**
* **Styling & Design System:** **Tailwind CSS** with custom cyberpunk dark theme grounded in Apple HIG
* **Icons:** **Lucide React**
* **State Management & IPC:** Tauri v2 `@tauri-apps/api` IPC command and event bridge

### 🦀 Rust Backend & Core Architecture
* **Application Framework:** **Tauri v2** (`src-tauri`)
* **Async Runtime:** **Tokio** (multi-threaded asynchronous event loop)
* **Core Proxy Engine:** **[Xray-Core](https://github.com/XTLS/Xray-core)** (supervises child process lifecycle with stdout/stderr real-time log streaming)
* **Socket Tuning:** `tcpNoDelay: true`, `tcpFastOpen: true`, `tcpKeepAlivePeriod: 15`, `tcpKeepAliveInterval: 15`
* **Buffer Pipeline:** 4096 KB (4MB) high-throughput streaming pipe buffers
* **Latency Testing:** Non-blocking async TCP handshake benchmark engine with IPv4 prioritization

### 🌐 Multi-Platform System Routing
* **Windows Engine:** WinINet registry configuration (`HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`) with live `InternetSetOptionA` notification broadcast.
* **macOS Engine:** `networksetup` proxy manager with automatic default route detection (`route -n get default`) and proxy bypass domain mapping.

---

## 🛠️ Project Structure

```text
desktop/
├── package.json                   # Frontend dependencies (React 18, Vite, Tailwind, Lucide)
├── vite.config.ts                 # Vite configuration tailored for Tauri v2
├── tailwind.config.js             # Design tokens matching Cyberpunk Dark & Liquid Glass
├── index.html                     # Application HTML entry point
├── version.json                   # Live OTA version manifest for client auto-updates
├── src/
│   ├── App.tsx                    # Main application shell & adaptive polling loop
│   ├── index.css                  # Liquid glass styles, keyframes & animations
│   ├── types/                     # TypeScript interface definitions (ProxyConfig, AppSettings, etc.)
│   ├── components/
│   │   ├── TitleBar.tsx           # Custom frameless window title bar with window controls
│   │   ├── Navigation.tsx         # Bottom glass navigation bar
│   │   ├── ConnectionDial.tsx     # Apple-HIG inspired tactile connection dial
│   │   ├── ServerCard.tsx         # Compact server node item with latency badge
│   │   ├── UpdateModal.tsx        # Real-time OTA download & install progress modal
│   │   ├── AddConfigModal.tsx     # Manual, clipboard, and QR code server import modal
│   │   ├── EditConfigModal.tsx    # Server configuration editor modal
│   │   └── ShareModal.tsx         # QR code and configuration sharing modal
│   ├── screens/
│   │   ├── HomeScreen.tsx         # Central connection dial, status, and live throughput
│   │   ├── ConfigsScreen.tsx      # Server node manager with search and ping-all
│   │   ├── StatisticsScreen.tsx   # Cumulative bandwidth, session data, and connection uptime
│   │   ├── SettingsScreen.tsx     # Grouped settings (DNS, DPI, Carrier SNI, Support, Updates)
│   │   └── LogsScreen.tsx         # Real-time log console with 1-click WhatsApp support export
│   └── utils/
│       ├── tauriBridge.ts         # Type-safe Tauri IPC command wrapper & browser mocks
│       ├── updater.ts             # GitHub Releases OTA updater client
│       └── formatters.ts          # Monospace speed, uptime, and ping latency formatters
└── src-tauri/
    ├── Cargo.toml                 # Rust dependencies (tauri v2, tokio, parking_lot, etc.)
    ├── tauri.conf.json            # Tauri v2 bundle, window, and security configuration
    ├── build.rs                   # Tauri build script
    ├── capabilities/              # Tauri security permissions configuration
    ├── icons/                     # ZeroTrace application icons (.ico, .icns, .png)
    └── src/
        ├── lib.rs                 # Tauri application setup & command registration
        ├── main.rs                # Desktop GUI application entrypoint
        ├── models.rs              # Rust data types matching TypeScript frontend models
        ├── parser.rs              # VLESS, VMess, Trojan, and Shadowsocks URI parsers
        ├── xray.rs                # High-performance Xray JSON generator & process supervisor
        ├── ping.rs                # Asynchronous non-blocking TCP latency testing engine
        ├── storage.rs             # AppData persistent JSON configuration & settings storage
        ├── commands.rs            # Tauri IPC command handlers & background log stream
        └── tun/
            ├── mod.rs             # Multi-platform proxy abstraction layer
            ├── windows.rs         # WinINet system proxy & Windows registry manager
            └── stub.rs            # macOS networksetup system proxy & LAN bypass manager
```

---

## 🔒 Security & Zero-Logs Privacy

* **Strict No-Logs Policy:** ZeroTrace does **not** collect, store, or transmit your IP address, visited URLs, DNS queries, or session history.
* **Local Sandboxed Storage:** Server credentials, UUIDs, and keys are stored strictly on your local device in the operating system's private app data directory.
* **DNS Leak Prevention:** Built-in DNS interception forces all queries through encrypted or privacy-first DNS resolvers, preventing ISP DNS surveillance.
* **Sanitized Diagnostics:** All diagnostic bundles exported for support automatically scrub passwords, UUIDs, and secret keys to protect user privacy.

---

## 👥 Credits & Brand

* **Engineered by:** [**Nexaura Core**](https://nexauracore.com)
* **Lead Developer:** **Nadun Gawesh**
* **Network & Community:** **NovaLink LK**
* **WhatsApp Support:** [**+94 78 838 5465**](https://wa.me/94788385465)

---

<div align="center">
  <sub>Built with ❤️ for privacy, performance, and uncensored internet freedom.</sub>
</div>
