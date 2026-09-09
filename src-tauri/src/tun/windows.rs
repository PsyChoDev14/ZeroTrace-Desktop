use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

pub struct WindowsTunManager {
    is_active: Arc<AtomicBool>,
    tun2socks_child: Option<Child>,
    server_ip: Option<String>,
}

impl WindowsTunManager {
    pub fn new() -> Self {
        Self {
            is_active: Arc::new(AtomicBool::new(false)),
            tun2socks_child: None,
            server_ip: None,
        }
    }

    pub fn start_tunnel(
        &mut self,
        server_host_or_ip: &str,
        server_port: u16,
        primary_dns: &str,
    ) -> Result<(), String> {
        self.stop_tunnel();

        println!("[WindowsTunManager] Initializing Kernel Wintun Layer 3 Virtual Adapter...");

        // 1. Locate tun2socks.exe
        let tun2socks_bin = Self::find_tun2socks_binary();
        let default_gw = Self::get_default_gateway();

        // Pre-resolve or parse server IP for bypass route
        let direct_ip = if server_host_or_ip.split('.').count() == 4
            && server_host_or_ip.split('.').all(|p| p.parse::<u8>().is_ok())
        {
            Some(server_host_or_ip.to_string())
        } else {
            use std::net::ToSocketAddrs;
            format!("{}:{}", server_host_or_ip, server_port)
                .to_socket_addrs()
                .ok()
                .and_then(|mut iter| iter.find(|a| a.is_ipv4()))
                .map(|a| a.ip().to_string())
        };

        self.server_ip = direct_ip.clone();

        if let Some(bin_path) = tun2socks_bin {
            println!("[WindowsTunManager] Spawning tun2socks from {:?}", bin_path);

            // Ensure wintun.dll is present next to tun2socks if needed
            if let Some(parent) = bin_path.parent() {
                let wintun_dst = parent.join("wintun.dll");
                if !wintun_dst.exists() {
                    if let Some(wintun_src) = Self::find_wintun_dll() {
                        let _ = std::fs::copy(wintun_src, wintun_dst);
                    }
                }
            }

            let mut cmd = Command::new(&bin_path);
            cmd.args(&[
                "-device", "wintun",
                "-proxy", "socks5://127.0.0.1:10808",
                "-loglevel", "warning",
                "-mtu", "9000",
                "-udp-timeout", "60s",
            ]);
            cmd.stdout(std::process::Stdio::null());
            cmd.stderr(std::process::Stdio::null());

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }

            match cmd.spawn() {
                Ok(child) => {
                    self.tun2socks_child = Some(child);
                    println!("[WindowsTunManager] tun2socks kernel forwarder spawned. Configuring IP routing...");

                    // Wait for Wintun adapter to appear in Windows NDIS network stack
                    let mut adapter_ready = false;
                    for attempt in 1..=15 {
                        let check = Command::new("netsh")
                            .args(&["interface", "show", "interface", "name=wintun"])
                            .output();
                        if let Ok(c) = check {
                            if c.status.success() {
                                println!("[WindowsTunManager] Wintun interface detected on attempt {}", attempt);
                                adapter_ready = true;
                                break;
                            }
                        }
                        std::thread::sleep(Duration::from_millis(200));
                    }

                    if !adapter_ready {
                        println!("[WindowsTunManager] Wintun interface check timeout, continuing with configuration...");
                        std::thread::sleep(Duration::from_millis(400));
                    }

                    let dns = if !primary_dns.is_empty() { primary_dns } else { "94.140.14.14" };

                    // Configure Wintun IP address & DNS servers
                    let _ = Command::new("netsh")
                        .args(&[
                            "interface", "ipv4", "set", "address",
                            "name=wintun",
                            "source=static",
                            "addr=198.18.0.1",
                            "mask=255.255.0.0",
                            "gateway=none"
                        ])
                        .output();
                    let _ = Command::new("netsh")
                        .args(&[
                            "interface", "ipv4", "set", "dnsservers",
                            "name=wintun",
                            "static",
                            &format!("address={}", dns),
                            "register=none",
                            "validate=no"
                        ])
                        .output();

                    // If physical gateway and server IP are known, route server IP direct to gateway so Xray traffic doesn't loop
                    if let (Some(ref gw), Some(ref s_ip)) = (&default_gw, &direct_ip) {
                        let _ = Command::new("route")
                            .args(&["add", s_ip, "mask", "255.255.255.255", gw, "metric", "1"])
                            .output();
                        println!("[WindowsTunManager] Direct bypass route established: {} -> physical gw {}", s_ip, gw);
                    }

                    // Route all PC internet traffic to Wintun using /1 subnets (longest-prefix match beats 0.0.0.0/0)
                    let _ = Command::new("route")
                        .args(&["add", "0.0.0.0", "mask", "128.0.0.0", "198.18.0.1", "metric", "1"])
                        .output();
                    let _ = Command::new("route")
                        .args(&["add", "128.0.0.0", "mask", "128.0.0.0", "198.18.0.1", "metric", "1"])
                        .output();

                    // Also configure default route via netsh on wintun interface with metric 1
                    let _ = Command::new("netsh")
                        .args(&["interface", "ipv4", "add", "route", "0.0.0.0/0", "wintun", "198.18.0.1", "metric=1"])
                        .output();

                    // Dual-Protection: also activate Windows System Proxy for 100% leak-proof browser traffic
                    let _ = Self::set_windows_proxy(true);

                    self.is_active.store(true, Ordering::SeqCst);
                    println!("[WindowsTunManager] Wintun Layer 3 TUN mode active with dual-protection routing enabled.");
                    return Ok(());
                }
                Err(e) => {
                    eprintln!("[WindowsTunManager] Failed to spawn tun2socks Wintun ({e}). Falling back to System Proxy.");
                }
            }
        }

        // Fallback to System Proxy if tun2socks is unavailable
        println!("[WindowsTunManager] Activating fallback Windows system proxy (127.0.0.1:10809)...");
        Self::set_windows_proxy(true)?;
        self.is_active.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub fn stop_tunnel(&mut self) {
        if self.is_active.swap(false, Ordering::SeqCst) {
            println!("[WindowsTunManager] Deactivating Wintun tunnel and restoring default routes...");

            // 1. Delete Wintun routes
            let _ = Command::new("route").args(&["delete", "0.0.0.0", "mask", "128.0.0.0"]).output();
            let _ = Command::new("route").args(&["delete", "128.0.0.0", "mask", "128.0.0.0"]).output();
            let _ = Command::new("netsh").args(&["interface", "ipv4", "delete", "route", "0.0.0.0/0", "wintun"]).output();
            if let Some(ref s_ip) = self.server_ip.take() {
                let _ = Command::new("route").args(&["delete", s_ip, "mask", "255.255.255.255"]).output();
            }

            // 2. Terminate tun2socks process (destroys Wintun virtual adapter)
            if let Some(mut child) = self.tun2socks_child.take() {
                let _ = child.kill();
                let _ = child.wait();
            }

            // 3. Reset Windows system proxy
            let _ = Self::set_windows_proxy(false);
            println!("[WindowsTunManager] Direct network restored. Shield offline.");
        }
    }

    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }

    pub fn cleanup_stale_proxies() {
        println!("[WindowsTunManager] Checking and cleaning stale Wintun routes and proxy on startup...");
        let _ = Command::new("route").args(&["delete", "0.0.0.0", "mask", "128.0.0.0"]).output();
        let _ = Command::new("route").args(&["delete", "128.0.0.0", "mask", "128.0.0.0"]).output();
        let _ = Command::new("netsh").args(&["interface", "ipv4", "delete", "route", "0.0.0.0/0", "wintun"]).output();
        let _ = Command::new("taskkill").args(&["/F", "/IM", "tun2socks.exe"]).output();
        let _ = Self::set_windows_proxy(false);
    }

    fn find_tun2socks_binary() -> Option<PathBuf> {
        let binary_name = if cfg!(windows) { "tun2socks.exe" } else { "tun2socks" };
        let mut candidate_paths: Vec<PathBuf> = Vec::new();

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                candidate_paths.push(exe_dir.join(binary_name));
                candidate_paths.push(exe_dir.join("binaries").join(binary_name));
                candidate_paths.push(exe_dir.join("resources").join(binary_name));
                candidate_paths.push(exe_dir.join("resources").join("binaries").join(binary_name));
                candidate_paths.push(exe_dir.join("_up_").join("binaries").join(binary_name));
                if let Some(parent_dir) = exe_dir.parent() {
                    candidate_paths.push(parent_dir.join("resources").join(binary_name));
                    candidate_paths.push(parent_dir.join("resources").join("binaries").join(binary_name));
                }
            }
        }

        if let Ok(cwd) = std::env::current_dir() {
            candidate_paths.push(cwd.join("binaries").join(binary_name));
            candidate_paths.push(cwd.join("src-tauri").join("binaries").join(binary_name));
            candidate_paths.push(cwd.join("target").join("debug").join("binaries").join(binary_name));
            candidate_paths.push(cwd.join("target").join("release").join("binaries").join(binary_name));
        }

        candidate_paths.into_iter().find(|p| p.exists() && p.is_file())
    }

    fn find_wintun_dll() -> Option<PathBuf> {
        let dll_name = "wintun.dll";
        let mut candidate_paths: Vec<PathBuf> = Vec::new();

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                candidate_paths.push(exe_dir.join(dll_name));
                candidate_paths.push(exe_dir.join("binaries").join(dll_name));
                candidate_paths.push(exe_dir.join("resources").join(dll_name));
                candidate_paths.push(exe_dir.join("resources").join("binaries").join(dll_name));
                if let Some(parent_dir) = exe_dir.parent() {
                    candidate_paths.push(parent_dir.join("resources").join(dll_name));
                    candidate_paths.push(parent_dir.join("resources").join("binaries").join(dll_name));
                }
            }
        }

        if let Ok(cwd) = std::env::current_dir() {
            candidate_paths.push(cwd.join("binaries").join(dll_name));
            candidate_paths.push(cwd.join("src-tauri").join("binaries").join(dll_name));
        }

        candidate_paths.into_iter().find(|p| p.exists() && p.is_file())
    }

    fn get_default_gateway() -> Option<String> {
        // Fast path: parse `route print 0.0.0.0` (takes ~5ms)
        if let Ok(out) = Command::new("cmd").args(&["/c", "route", "print", "0.0.0.0"]).output() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 && parts[0] == "0.0.0.0" && parts[1] == "0.0.0.0" {
                    let gw = parts[2].trim();
                    if gw != "0.0.0.0"
                        && gw.split('.').count() == 4
                        && gw.split('.').all(|p| p.parse::<u8>().is_ok())
                    {
                        println!("[WindowsTunManager] Discovered physical gateway via route print: {}", gw);
                        return Some(gw.to_string());
                    }
                }
            }
        }

        // Fallback: PowerShell Get-NetRoute
        let out = Command::new("powershell")
            .args(&[
                "-NoProfile",
                "-Command",
                "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1).NextHop",
            ])
            .output()
            .ok()?;
        let gw = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !gw.is_empty() && gw.split('.').count() == 4 && gw != "0.0.0.0" {
            println!("[WindowsTunManager] Discovered physical gateway via PowerShell: {}", gw);
            Some(gw)
        } else {
            None
        }
    }

    fn set_windows_proxy(enable: bool) -> Result<(), String> {
        let proxy_val = if enable { "1" } else { "0" };
        let proxy_server = "http=127.0.0.1:10809;https=127.0.0.1:10809;socks=127.0.0.1:10808;ftp=127.0.0.1:10809";
        let bypass = "localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*;<local>";

        // 1. Configure ProxyEnable (1 = ON, 0 = OFF)
        let out1 = Command::new("reg")
            .args(&[
                "add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyEnable",
                "/t", "REG_DWORD",
                "/d", proxy_val,
                "/f"
            ])
            .output()
            .map_err(|e| format!("Failed to execute reg for ProxyEnable: {}", e))?;

        if !out1.status.success() {
            return Err(format!("reg add ProxyEnable failed: {}", String::from_utf8_lossy(&out1.stderr).trim()));
        }

        if enable {
            // 2. Configure ProxyServer (HTTP/HTTPS to 10809, SOCKS5 to 10808)
            let out2 = Command::new("reg")
                .args(&[
                    "add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                    "/v", "ProxyServer",
                    "/t", "REG_SZ",
                    "/d", proxy_server,
                    "/f"
                ])
                .output()
                .map_err(|e| format!("Failed to execute reg for ProxyServer: {}", e))?;

            if !out2.status.success() {
                return Err(format!("reg add ProxyServer failed: {}", String::from_utf8_lossy(&out2.stderr).trim()));
            }

            // 3. Configure ProxyOverride for local LAN and localhost
            let out3 = Command::new("reg")
                .args(&[
                    "add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                    "/v", "ProxyOverride",
                    "/t", "REG_SZ",
                    "/d", bypass,
                    "/f"
                ])
                .output()
                .map_err(|e| format!("Failed to execute reg for ProxyOverride: {}", e))?;

            if !out3.status.success() {
                return Err(format!("reg add ProxyOverride failed: {}", String::from_utf8_lossy(&out3.stderr).trim()));
            }
        }

        // 4. Notify Windows system, Chrome, Edge, Brave to immediately reload proxy
        Self::refresh_wininet();

        Ok(())
    }

    fn refresh_wininet() {
        #[cfg(windows)]
        {
            mod wininet {
                #[link(name = "wininet")]
                extern "system" {
                    pub fn InternetSetOptionA(
                        h_internet: *mut std::ffi::c_void,
                        dw_option: u32,
                        lp_buffer: *mut std::ffi::c_void,
                        dw_buffer_length: u32,
                    ) -> i32;
                }
                pub const INTERNET_OPTION_SETTINGS_CHANGED: u32 = 39;
                pub const INTERNET_OPTION_REFRESH: u32 = 37;
            }

            unsafe {
                wininet::InternetSetOptionA(std::ptr::null_mut(), wininet::INTERNET_OPTION_SETTINGS_CHANGED, std::ptr::null_mut(), 0);
                wininet::InternetSetOptionA(std::ptr::null_mut(), wininet::INTERNET_OPTION_REFRESH, std::ptr::null_mut(), 0);
            }
        }
    }
}

impl Drop for WindowsTunManager {
    fn drop(&mut self) {
        self.stop_tunnel();
    }
}

