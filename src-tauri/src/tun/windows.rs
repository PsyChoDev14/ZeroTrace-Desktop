use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::models::{AppSettings, ProxyConfig};
use crate::singbox::SingboxConfigGenerator;

pub struct WindowsTunManager {
    is_active: Arc<AtomicBool>,
    singbox_child: Option<Child>,
    config_file_path: Option<PathBuf>,
}

impl WindowsTunManager {
    pub fn new() -> Self {
        Self {
            is_active: Arc::new(AtomicBool::new(false)),
            singbox_child: None,
            config_file_path: None,
        }
    }

    pub fn start_tunnel(
        &mut self,
        config: &ProxyConfig,
        settings: &AppSettings,
        resolved_ip: Option<&str>,
        app_dir: &Path,
        log_fn: Option<Arc<dyn Fn(&str, &str, &str) + Send + Sync + 'static>>,
    ) -> Result<(), String> {
        self.stop_tunnel();

        println!("[WindowsTunManager] Initializing Sing-box Native Kernel Wintun Tunnel...");

        // 1. Generate runtime Sing-box config JSON
        let singbox_json = SingboxConfigGenerator::generate_runtime_json(
            config,
            settings,
            resolved_ip,
        );

        let config_path = app_dir.join("runtime_singbox.json");
        std::fs::write(&config_path, &singbox_json)
            .map_err(|e| format!("Failed to write singbox runtime config: {}", e))?;
        self.config_file_path = Some(config_path.clone());

        // 2. Locate sing-box.exe
        let singbox_bin = Self::find_singbox_binary()
            .ok_or_else(|| "sing-box.exe binary not found. Please ensure ZeroTrace installation is complete.".to_string())?;

        println!("[WindowsTunManager] Found sing-box at {:?}", singbox_bin);

        // Ensure wintun.dll and libcronet.dll are next to sing-box.exe
        if let Some(parent) = singbox_bin.parent() {
            let wintun_dst = parent.join("wintun.dll");
            if !wintun_dst.exists() {
                if let Some(wintun_src) = Self::find_wintun_dll() {
                    let _ = std::fs::copy(wintun_src, wintun_dst);
                }
            }
            let cronet_dst = parent.join("libcronet.dll");
            if !cronet_dst.exists() {
                if let Some(cronet_src) = Self::find_cronet_dll() {
                    let _ = std::fs::copy(cronet_src, cronet_dst);
                }
            }
        }

        // 3. Spawn sing-box.exe run -c <config_path>
        let mut cmd = Command::new(&singbox_bin);
        cmd.arg("run").arg("-c").arg(&config_path);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        match cmd.spawn() {
            Ok(mut child) => {
                if let Some(log_cb) = log_fn {
                    if let Some(stderr) = child.stderr.take() {
                        let cb = Arc::clone(&log_cb);
                        std::thread::spawn(move || {
                            use std::io::{BufRead, BufReader};
                            let reader = BufReader::new(stderr);
                            for line in reader.lines().flatten() {
                                let trimmed = line.trim();
                                if !trimmed.is_empty() {
                                    let level = if trimmed.contains("WARN") || trimmed.contains("warn") {
                                        "WARN"
                                    } else if trimmed.contains("ERROR") || trimmed.contains("error") || trimmed.contains("FATAL") {
                                        "ERROR"
                                    } else {
                                        "INFO"
                                    };
                                    cb(level, "SingBox-Core", trimmed);
                                }
                            }
                        });
                    }
                    if let Some(stdout) = child.stdout.take() {
                        let cb = Arc::clone(&log_cb);
                        std::thread::spawn(move || {
                            use std::io::{BufRead, BufReader};
                            let reader = BufReader::new(stdout);
                            for line in reader.lines().flatten() {
                                let trimmed = line.trim();
                                if !trimmed.is_empty() {
                                    cb("INFO", "SingBox-Core", trimmed);
                                }
                            }
                        });
                    }
                }

                self.singbox_child = Some(child);

                // Set Windows System Proxy in tandem (to mixed-in port 10808) for instant 0ms browser leak protection
                let _ = Self::set_windows_proxy(true);

                self.is_active.store(true, Ordering::SeqCst);
                println!("[WindowsTunManager] Sing-box Native Kernel Wintun active! Whole-device 1+ Gbps pipeline ready.");
                Ok(())
            }
            Err(e) => {
                let err_msg = format!("Failed to spawn sing-box engine: {}", e);
                eprintln!("[WindowsTunManager] {}", err_msg);
                Err(err_msg)
            }
        }
    }

    pub fn stop_tunnel(&mut self) {
        if self.is_active.swap(false, Ordering::SeqCst) {
            println!("[WindowsTunManager] Stopping Sing-box tunnel and restoring default routes...");

            if let Some(mut child) = self.singbox_child.take() {
                let _ = child.kill();
                let _ = child.wait();
            }

            if let Some(path) = self.config_file_path.take() {
                let _ = std::fs::remove_file(path);
            }

            // Reset Windows system proxy
            let _ = Self::set_windows_proxy(false);
            println!("[WindowsTunManager] Direct network restored. Shield offline.");
        }
    }

    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }

    /// Returns true only if the sing-box child process is still actually
    /// running. Distinct from `is_active()`, which reflects whether the
    /// system proxy configuration is still applied (used by the Kill Switch
    /// to detect a tunnel crash even while `is_active()` stays true).
    pub fn is_process_alive(&mut self) -> bool {
        match self.singbox_child.as_mut() {
            Some(child) => matches!(child.try_wait(), Ok(None)),
            None => false,
        }
    }

    #[inline]
    fn silent_command(program: &str) -> Command {
        let mut cmd = Command::new(program);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        cmd
    }

    pub fn cleanup_stale_proxies() {
        println!("[WindowsTunManager] Checking and cleaning stale Sing-box processes and proxy on startup...");
        let _ = Self::silent_command("taskkill").args(&["/F", "/IM", "sing-box.exe"]).output();
        let _ = Self::silent_command("taskkill").args(&["/F", "/IM", "tun2socks.exe"]).output();
        let _ = Self::set_windows_proxy(false);
    }

    fn find_singbox_binary() -> Option<PathBuf> {
        let binary_name = "sing-box.exe";
        let mut candidates: Vec<PathBuf> = Vec::new();

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                candidates.push(exe_dir.join(binary_name));
                candidates.push(exe_dir.join("binaries").join(binary_name));
                candidates.push(exe_dir.join("resources").join(binary_name));
                candidates.push(exe_dir.join("resources").join("binaries").join(binary_name));
                candidates.push(exe_dir.join("_up_").join("binaries").join(binary_name));
                if let Some(parent_dir) = exe_dir.parent() {
                    candidates.push(parent_dir.join("resources").join(binary_name));
                    candidates.push(parent_dir.join("resources").join("binaries").join(binary_name));
                }
            }
        }

        #[cfg(debug_assertions)]
        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join("binaries").join(binary_name));
            candidates.push(cwd.join("src-tauri").join("binaries").join(binary_name));
            candidates.push(cwd.join("target").join("debug").join(binary_name));
            candidates.push(cwd.join("target").join("release").join(binary_name));
        }

        candidates.into_iter().find(|p| p.exists() && p.is_file())
    }

    fn find_wintun_dll() -> Option<PathBuf> {
        let dll_name = "wintun.dll";
        let mut candidates: Vec<PathBuf> = Vec::new();

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                candidates.push(exe_dir.join(dll_name));
                candidates.push(exe_dir.join("binaries").join(dll_name));
                candidates.push(exe_dir.join("resources").join(dll_name));
                candidates.push(exe_dir.join("resources").join("binaries").join(dll_name));
                candidates.push(exe_dir.join("_up_").join("binaries").join(dll_name));
                if let Some(parent_dir) = exe_dir.parent() {
                    candidates.push(parent_dir.join("resources").join(dll_name));
                    candidates.push(parent_dir.join("resources").join("binaries").join(dll_name));
                }
            }
        }

        #[cfg(debug_assertions)]
        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join("binaries").join(dll_name));
            candidates.push(cwd.join("src-tauri").join("binaries").join(dll_name));
            candidates.push(cwd.join("target").join("debug").join(dll_name));
            candidates.push(cwd.join("target").join("release").join(dll_name));
        }

        candidates.into_iter().find(|p| p.exists() && p.is_file())
    }

    fn find_cronet_dll() -> Option<PathBuf> {
        let dll_name = "libcronet.dll";
        let mut candidates: Vec<PathBuf> = Vec::new();

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                candidates.push(exe_dir.join(dll_name));
                candidates.push(exe_dir.join("binaries").join(dll_name));
                candidates.push(exe_dir.join("resources").join(dll_name));
                candidates.push(exe_dir.join("resources").join("binaries").join(dll_name));
                candidates.push(exe_dir.join("_up_").join("binaries").join(dll_name));
                if let Some(parent_dir) = exe_dir.parent() {
                    candidates.push(parent_dir.join("resources").join(dll_name));
                    candidates.push(parent_dir.join("resources").join("binaries").join(dll_name));
                }
            }
        }

        #[cfg(debug_assertions)]
        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join("binaries").join(dll_name));
            candidates.push(cwd.join("src-tauri").join("binaries").join(dll_name));
            candidates.push(cwd.join("target").join("debug").join(dll_name));
            candidates.push(cwd.join("target").join("release").join(dll_name));
        }

        candidates.into_iter().find(|p| p.exists() && p.is_file())
    }

    fn set_windows_proxy(enable: bool) -> Result<(), String> {
        let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings";
        let proxy_val = if enable { "1" } else { "0" };
        let proxy_server = "127.0.0.1:10808";
        let bypass = "localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*;<local>";

        let _ = Self::silent_command("reg")
            .args(&["add", key, "/v", "ProxyEnable", "/t", "REG_DWORD", "/d", proxy_val, "/f"])
            .output();

        if enable {
            let _ = Self::silent_command("reg")
                .args(&["add", key, "/v", "ProxyServer", "/t", "REG_SZ", "/d", proxy_server, "/f"])
                .output();
            let _ = Self::silent_command("reg")
                .args(&["add", key, "/v", "ProxyOverride", "/t", "REG_SZ", "/d", bypass, "/f"])
                .output();
        }

        Self::refresh_wininet();
        Ok(())
    }

    fn refresh_wininet() {
        #[cfg(windows)]
        unsafe {
            use windows_sys::Win32::Networking::WinInet::{
                InternetSetOptionA, INTERNET_OPTION_REFRESH, INTERNET_OPTION_SETTINGS_CHANGED,
            };
            InternetSetOptionA(std::ptr::null(), INTERNET_OPTION_SETTINGS_CHANGED, std::ptr::null(), 0);
            InternetSetOptionA(std::ptr::null(), INTERNET_OPTION_REFRESH, std::ptr::null(), 0);
        }
    }
}

impl Drop for WindowsTunManager {
    fn drop(&mut self) {
        self.stop_tunnel();
    }
}
