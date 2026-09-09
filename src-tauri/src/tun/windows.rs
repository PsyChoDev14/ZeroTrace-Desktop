use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct WindowsTunManager {
    is_active: Arc<AtomicBool>,
}

impl WindowsTunManager {
    pub fn new() -> Self {
        Self {
            is_active: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start_tunnel(
        &mut self,
        _server_host: &str,
        _server_port: u16,
        _primary_dns: &str,
    ) -> Result<(), String> {
        self.stop_tunnel();

        println!("[WindowsTunManager] Activating Windows system proxy for ZeroTrace tunnel (127.0.0.1:10809)...");
        Self::set_windows_proxy(true)?;
        self.is_active.store(true, Ordering::SeqCst);
        println!("[WindowsTunManager] Windows system proxy active. Traffic routing through ZeroTrace.");
        Ok(())
    }

    pub fn stop_tunnel(&mut self) {
        if self.is_active.swap(false, Ordering::SeqCst) {
            println!("[WindowsTunManager] Deactivating Windows system proxy...");
            let _ = Self::set_windows_proxy(false);
            println!("[WindowsTunManager] Windows system proxy disabled. Direct network restored.");
        }
    }

    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }

    pub fn cleanup_stale_proxies() {
        println!("[WindowsTunManager] Checking and cleaning stale Windows system proxy on startup...");
        let _ = Self::set_windows_proxy(false);
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

