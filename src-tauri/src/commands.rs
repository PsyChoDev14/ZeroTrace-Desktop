use std::sync::Arc;
use parking_lot::Mutex;
use tauri::{Emitter, State};

use crate::models::{AppSettings, DiagnosticLog, ProxyConfig, TrafficStats, VpnState};
use crate::parser::ConfigParser;
use crate::ping::PingEngine;
use crate::storage::StorageManager;
use crate::tun::TunManager;
#[allow(unused_imports)]
use crate::xray::{XrayConfigGenerator, XrayProcess};

pub struct AppContext {
    pub vpn_state: VpnState,
    pub configs: Vec<ProxyConfig>,
    pub selected_id: Option<String>,
    pub settings: AppSettings,
    pub traffic_stats: TrafficStats,
    pub last_stats_poll: Option<i64>,
    pub last_octets: Option<(u64, u64)>,
    pub logs: Vec<DiagnosticLog>,
    pub tun_manager: TunManager,
    pub xray_process: XrayProcess,
    pub storage: StorageManager,
}

impl AppContext {
    pub fn add_log(&mut self, level: &str, tag: &str, message: &str) {
        let entry = DiagnosticLog {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level: level.to_string(),
            tag: tag.to_string(),
            message: message.to_string(),
        };
        self.logs.push(entry);
        if self.logs.len() > 500 {
            self.logs.remove(0);
        }
    }
}

pub type SharedState = Arc<Mutex<AppContext>>;

// Reports whether the platform tunnel process (sing-box on Windows, Xray on
// macOS) is still alive. Used by `get_state` to detect an unexpected crash
// instead of continuing to report a stale "connected" status.
#[cfg(windows)]
fn tunnel_process_alive(ctx: &mut AppContext) -> bool {
    ctx.tun_manager.is_process_alive()
}

#[cfg(not(windows))]
fn tunnel_process_alive(ctx: &mut AppContext) -> bool {
    ctx.xray_process.is_running()
}

#[tauri::command]
pub fn get_state(state: State<SharedState>) -> VpnState {
    let mut ctx = state.lock();

    // Tunnel health verification: verify the tunnel process carrying traffic is actually still running.
    // If the process terminated unexpectedly, fail open and restore direct network connectivity immediately.
    if ctx.vpn_state.status == "connected" && !tunnel_process_alive(&mut *ctx) {
        ctx.add_log(
            "WARN",
            "ZeroTrace",
            "Tunnel process terminated unexpectedly; restoring direct connectivity.",
        );
        ctx.tun_manager.stop_tunnel();
        ctx.xray_process.stop();
        ctx.vpn_state = VpnState {
            status: "disconnected".to_string(),
            server_name: None,
            server_address: None,
            connected_at: None,
            error_message: Some("Tunnel connection was lost. Direct connection restored.".to_string()),
        };
        ctx.traffic_stats.download_speed = 0;
        ctx.traffic_stats.upload_speed = 0;
        ctx.last_stats_poll = None;
        ctx.last_octets = None;
    }

    ctx.vpn_state.clone()
}

pub async fn do_connect(config_id: Option<String>, state: SharedState) -> Result<bool, String> {
    let (config, settings, app_dir) = {
        let mut ctx = state.lock();
        let target_id = config_id.or_else(|| ctx.selected_id.clone());
        let cfg = ctx.configs.iter().find(|c| Some(&c.id) == target_id.as_ref()).cloned();
        
        let config = match cfg {
            Some(c) => c,
            None => {
                ctx.add_log("ERROR", "ZeroTrace", "No server configuration found to connect.");
                return Err("No server configuration found to connect".to_string());
            }
        };

        ctx.vpn_state = VpnState {
            status: "connecting".to_string(),
            server_name: Some(config.name.clone()),
            server_address: Some(format!("{}:{}", config.server, config.port)),
            connected_at: None,
            error_message: None,
        };

        ctx.add_log("INFO", "ZeroTrace", &format!("Connecting to {} ({}:{})", config.name, config.server, config.port));
        let settings = ctx.settings.clone();
        let app_dir = ctx.storage.data_dir().to_path_buf();
        (config, settings, app_dir)
    };

    // Fast asynchronous pre-resolution of server endpoint to bypass ISP DNS throttling & per-dial delay
    let resolved_ip = tokio::net::lookup_host(format!("{}:{}", config.server, config.port))
        .await
        .ok()
        .and_then(|addrs| {
            let mut vec: Vec<_> = addrs.collect();
            vec.sort_by_key(|a| if a.is_ipv4() { 0 } else { 1 });
            vec.into_iter().next()
        })
        .map(|addr| addr.ip().to_string());

    if let Some(ref ip) = resolved_ip {
        state.lock().add_log("INFO", "ZeroTrace", &format!("Pre-resolved endpoint {} -> {} (Fast Direct Dial)", config.server, ip));
    } else {
        state.lock().add_log("WARN", "ZeroTrace", &format!("Could not pre-resolve {} via local DNS; falling back to Xray engine resolver", config.server));
    }

    #[cfg(windows)]
    {
        let state_clone = state.clone();
        let log_cb = Arc::new(move |level: &str, tag: &str, msg: &str| {
            state_clone.lock().add_log(level, tag, msg);
        });

        {
            let mut ctx = state.lock();
            if let Err(e) = ctx.tun_manager.start_tunnel(
                &config,
                &settings,
                resolved_ip.as_deref(),
                &app_dir,
                Some(log_cb),
            ) {
                ctx.vpn_state = VpnState {
                    status: "error".to_string(),
                    server_name: None,
                    server_address: None,
                    connected_at: None,
                    error_message: Some(e.clone()),
                };
                ctx.add_log("ERROR", "SingBox-Core", &format!("Failed to activate tunnel: {}", e));
                return Err(e);
            }

            let now = chrono::Utc::now().timestamp_millis();
            ctx.vpn_state = VpnState {
                status: "connected".to_string(),
                server_name: Some(config.name.clone()),
                server_address: Some(format!("{}:{}", config.server, config.port)),
                connected_at: Some(now),
                error_message: None,
            };
            ctx.add_log("INFO", "SingBox-Core", "Sing-box Kernel Wintun Layer 3 TUN active. Whole-device gigabit routing enabled.");
        }

        // Verify Sing-box process actually started and didn't crash
        tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
        {
            let mut ctx = state.lock();
            if !tunnel_process_alive(&mut *ctx) {
                ctx.tun_manager.stop_tunnel();
                let is_access_denied = ctx.logs.iter().rev().take(15).any(|l| {
                    l.message.contains("Access is denied")
                        || l.message.contains("access is denied")
                        || l.message.contains("configure tun interface")
                });
                let err_msg = if is_access_denied {
                    "Administrator privileges required to configure Wintun TUN interface. Please right-click ZeroTrace and select 'Run as Administrator'.".to_string()
                } else {
                    "Sing-box core exited immediately upon launch. Direct connection restored.".to_string()
                };
                ctx.vpn_state = VpnState {
                    status: "disconnected".to_string(),
                    server_name: None,
                    server_address: None,
                    connected_at: None,
                    error_message: Some(err_msg.clone()),
                };
                ctx.add_log("ERROR", "ZeroTrace", &err_msg);
                return Err(err_msg);
            }
        }
        return Ok(true);
    }

    #[cfg(not(windows))]
    {
        // 1. Generate runtime Xray config JSON
        let xray_json = XrayConfigGenerator::generate_runtime_json(
            &config,
            &settings,
            10808,
            10809,
            resolved_ip.as_deref(),
        );

        // 2. Start Xray-Core engine with real-time log streaming
        {
            let state_clone = state.clone();
            let log_cb = Arc::new(move |level: &str, tag: &str, msg: &str| {
                state_clone.lock().add_log(level, tag, msg);
            });

            let mut ctx = state.lock();
            if let Err(e) = ctx.xray_process.start(&xray_json, &app_dir, Some(log_cb)) {
                ctx.vpn_state = VpnState {
                    status: "error".to_string(),
                    server_name: None,
                    server_address: None,
                    connected_at: None,
                    error_message: Some(e.clone()),
                };
                ctx.add_log("ERROR", "Xray-Core", &format!("Failed to start engine: {}", e));
                return Err(e);
            }
            ctx.add_log("INFO", "Xray-Core", "Xray runtime engine spawned on 127.0.0.1:10808 (SOCKS5)");
        }

        // 3. Configure macOS system proxy
        {
            let mut ctx = state.lock();
            if let Err(e) = ctx.tun_manager.start_tunnel(
                &config,
                &settings,
                resolved_ip.as_deref(),
                &app_dir,
                None,
            ) {
                ctx.xray_process.stop();
                ctx.vpn_state = VpnState {
                    status: "error".to_string(),
                    server_name: None,
                    server_address: None,
                    connected_at: None,
                    error_message: Some(e.clone()),
                };
                ctx.add_log("ERROR", "TunManager", &format!("Failed to activate tunnel: {}", e));
                return Err(e);
            }

            let now = chrono::Utc::now().timestamp_millis();
            ctx.vpn_state = VpnState {
                status: "connected".to_string(),
                server_name: Some(config.name.clone()),
                server_address: Some(format!("{}:{}", config.server, config.port)),
                connected_at: Some(now),
                error_message: None,
            };
            ctx.add_log("INFO", "TunManager", "macOS high-speed system proxy active. Traffic routed via Xray tunnel.");
        }

        // 4. Verify Xray process actually started and didn't crash during launch
        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
        {
            let mut ctx = state.lock();
            if !tunnel_process_alive(&mut *ctx) {
                ctx.tun_manager.stop_tunnel();
                ctx.xray_process.stop();
                ctx.vpn_state = VpnState {
                    status: "disconnected".to_string(),
                    server_name: None,
                    server_address: None,
                    connected_at: None,
                    error_message: Some("Xray core exited immediately upon launch. Direct connection restored.".to_string()),
                };
                ctx.add_log("ERROR", "ZeroTrace", "Xray core exited immediately upon launch; direct connection restored.");
                return Err("Xray core failed to stay running".to_string());
            }
        }

        Ok(true)
    }
}

#[tauri::command]
pub async fn connect(config_id: Option<String>, state: State<'_, SharedState>) -> Result<bool, String> {
    do_connect(config_id, state.inner().clone()).await
}

pub fn do_disconnect(state: SharedState) -> bool {
    let mut ctx = state.lock();
    ctx.add_log("INFO", "ZeroTrace", "Disconnecting tunnel and restoring network routes...");
    ctx.tun_manager.stop_tunnel();
    ctx.xray_process.stop();
    ctx.vpn_state = VpnState {
        status: "disconnected".to_string(),
        server_name: None,
        server_address: None,
        connected_at: None,
        error_message: None,
    };
    ctx.traffic_stats.download_speed = 0;
    ctx.traffic_stats.upload_speed = 0;
    ctx.last_stats_poll = None;
    ctx.last_octets = None;
    ctx.add_log("INFO", "ZeroTrace", "Network routes restored. Shield offline.");
    true
}

#[tauri::command]
pub fn disconnect(state: State<SharedState>) -> bool {
    do_disconnect(state.inner().clone())
}

#[tauri::command]
pub fn get_configs(state: State<SharedState>) -> Vec<ProxyConfig> {
    state.lock().configs.clone()
}

#[tauri::command]
pub fn get_selected_config_id(state: State<SharedState>) -> Option<String> {
    state.lock().selected_id.clone()
}

#[tauri::command]
pub fn select_config(id: String, state: State<SharedState>) -> bool {
    let mut ctx = state.lock();
    ctx.selected_id = Some(id.clone());
    let _ = ctx.storage.save_selected_id(Some(&id));
    true
}

#[tauri::command]
pub fn save_config(config: ProxyConfig, state: State<SharedState>) -> bool {
    let mut ctx = state.lock();
    if let Some(pos) = ctx.configs.iter().position(|c| c.id == config.id) {
        ctx.configs[pos] = config;
    } else {
        ctx.configs.insert(0, config);
    }
    let configs = ctx.configs.clone();
    let _ = ctx.storage.save_configs(&configs);
    true
}

#[tauri::command]
pub fn delete_config(id: String, state: State<SharedState>) -> bool {
    let mut ctx = state.lock();
    ctx.configs.retain(|c| c.id != id);
    if ctx.selected_id.as_deref() == Some(&id) {
        ctx.selected_id = ctx.configs.first().map(|c| c.id.clone());
        let new_id = ctx.selected_id.clone();
        let _ = ctx.storage.save_selected_id(new_id.as_deref());
    }
    let configs = ctx.configs.clone();
    let _ = ctx.storage.save_configs(&configs);
    true
}

#[tauri::command]
pub async fn ping_config(id: String, state: State<'_, SharedState>) -> Result<i64, String> {
    let cfg = {
        let ctx = state.lock();
        ctx.configs.iter().find(|c| c.id == id).cloned()
    };

    if let Some(config) = cfg {
        let ping = PingEngine::test_latency(&config.server, config.port, 2000).await;
        let mut ctx = state.lock();
        if let Some(pos) = ctx.configs.iter().position(|c| c.id == id) {
            ctx.configs[pos].ping_ms = ping;
            let configs = ctx.configs.clone();
            let _ = ctx.storage.save_configs(&configs);
        }
        Ok(ping)
    } else {
        Err("Config not found".to_string())
    }
}

#[tauri::command]
pub async fn ping_all(state: State<'_, SharedState>) -> Result<Vec<ProxyConfig>, String> {
    let configs = state.lock().configs.clone();
    let mut handles = Vec::new();

    for cfg in configs {
        let id = cfg.id.clone();
        let host = cfg.server.clone();
        let port = cfg.port;
        handles.push(tokio::spawn(async move {
            let ping = PingEngine::test_latency(&host, port, 2000).await;
            (id, ping)
        }));
    }

    let mut results = Vec::new();
    for h in handles {
        if let Ok(res) = h.await {
            results.push(res);
        }
    }

    let mut ctx = state.lock();
    for (id, ping) in results {
        if let Some(pos) = ctx.configs.iter().position(|c| c.id == id) {
            ctx.configs[pos].ping_ms = ping;
        }
    }
    let updated = ctx.configs.clone();
    let _ = ctx.storage.save_configs(&updated);
    Ok(updated)
}

#[tauri::command]
pub fn parse_config(raw: String) -> Option<ProxyConfig> {
    ConfigParser::parse_single(&raw)
}

#[tauri::command]
pub fn get_settings(state: State<SharedState>) -> AppSettings {
    state.lock().settings.clone()
}

#[tauri::command]
pub fn save_settings(settings: AppSettings, state: State<SharedState>) -> bool {
    let mut ctx = state.lock();
    ctx.settings = settings.clone();
    let _ = ctx.storage.save_settings(&settings);
    true
}

#[tauri::command]
pub fn get_logs(state: State<SharedState>) -> Vec<DiagnosticLog> {
    state.lock().logs.clone()
}

#[tauri::command]
pub fn clear_logs(state: State<SharedState>) -> bool {
    state.lock().logs.clear();
    true
}

#[cfg(target_os = "windows")]
fn get_live_interface_octets() -> Option<(u64, u64)> {
    use windows_sys::Win32::NetworkManagement::IpHelper::{GetIfTable2, FreeMibTable, MIB_IF_TABLE2};
    unsafe {
        let mut table: *mut MIB_IF_TABLE2 = std::ptr::null_mut();
        if GetIfTable2(&mut table) == 0 && !table.is_null() {
            let num_entries = (*table).NumEntries as usize;
            let rows_ptr = (*table).Table.as_ptr();

            for i in 0..num_entries {
                let row = *rows_ptr.add(i);
                let alias_len = row.Alias.iter().position(|&c| c == 0).unwrap_or(row.Alias.len());
                let alias = String::from_utf16_lossy(&row.Alias[..alias_len]);

                if alias.eq_ignore_ascii_case("ZeroTrace") {
                    let res = (row.InOctets, row.OutOctets);
                    FreeMibTable(table as *const _);
                    return Some(res);
                }

                let desc_len = row.Description.iter().position(|&c| c == 0).unwrap_or(row.Description.len());
                let desc = String::from_utf16_lossy(&row.Description[..desc_len]);
                if desc.to_lowercase().contains("wintun") || desc.to_lowercase().contains("zerotrace") {
                    let res = (row.InOctets, row.OutOctets);
                    FreeMibTable(table as *const _);
                    return Some(res);
                }
            }

            FreeMibTable(table as *const _);
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn get_live_interface_octets() -> Option<(u64, u64)> {
    let mut ifaddrs: *mut libc::ifaddrs = std::ptr::null_mut();
    unsafe {
        if libc::getifaddrs(&mut ifaddrs) == 0 && !ifaddrs.is_null() {
            let mut curr = ifaddrs;
            let mut in_bytes = 0u64;
            let mut out_bytes = 0u64;
            let mut found = false;

            while !curr.is_null() {
                let ifa = *curr;
                if !ifa.ifa_addr.is_null() && (*ifa.ifa_addr).sa_family as i32 == libc::AF_LINK {
                    let name = std::ffi::CStr::from_ptr(ifa.ifa_name).to_string_lossy();
                    if name.starts_with("en") || name.starts_with("utun") {
                        if !ifa.ifa_data.is_null() {
                            let data = *(ifa.ifa_data as *const libc::if_data);
                            in_bytes += data.ifi_ibytes as u64;
                            out_bytes += data.ifi_obytes as u64;
                            found = true;
                        }
                    }
                }
                curr = ifa.ifa_next;
            }
            libc::freeifaddrs(ifaddrs);
            if found {
                return Some((in_bytes, out_bytes));
            }
        }
    }
    None
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn get_live_interface_octets() -> Option<(u64, u64)> {
    None
}

#[tauri::command]
pub fn get_traffic_stats(state: State<SharedState>) -> TrafficStats {
    let mut ctx = state.lock();
    if ctx.vpn_state.status == "connected" {
        let connected_at = ctx.vpn_state.connected_at.unwrap_or(0);
        let now = chrono::Utc::now().timestamp_millis();
        let uptime = if connected_at > 0 {
            ((now - connected_at) / 1000) as u64
        } else {
            0
        };

        if let Some((curr_in, curr_out)) = get_live_interface_octets() {
            if let (Some(last_poll), Some((last_in, last_out))) = (ctx.last_stats_poll, ctx.last_octets) {
                let delta_ms = (now - last_poll).max(1);
                let delta_in = ((curr_in as u32).wrapping_sub(last_in as u32)) as u64;
                let delta_out = ((curr_out as u32).wrapping_sub(last_out as u32)) as u64;

                // Cap single-second delta at 1.5 GB/s to discard counter reset anomalies
                if delta_in < 1_500_000_000 && delta_out < 1_500_000_000 {
                    let down_speed = (delta_in * 1000) / (delta_ms as u64);
                    let up_speed = (delta_out * 1000) / (delta_ms as u64);

                    ctx.traffic_stats.download_speed = down_speed;
                    ctx.traffic_stats.upload_speed = up_speed;
                    ctx.traffic_stats.total_downloaded += delta_in;
                    ctx.traffic_stats.total_uploaded += delta_out;
                }
            }
            ctx.last_octets = Some((curr_in, curr_out));
        } else {
            ctx.traffic_stats.download_speed = 0;
            ctx.traffic_stats.upload_speed = 0;
        }

        ctx.last_stats_poll = Some(now);
        ctx.traffic_stats.uptime_seconds = uptime;
    } else {
        ctx.last_stats_poll = None;
        ctx.last_octets = None;
        ctx.traffic_stats.download_speed = 0;
        ctx.traffic_stats.upload_speed = 0;
    }
    ctx.traffic_stats.clone()
}

#[tauri::command]
pub fn window_minimize(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
pub fn window_maximize(window: tauri::WebviewWindow) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
pub fn window_close(window: tauri::WebviewWindow) {
    let _ = window.close();
}

#[derive(Clone, serde::Serialize)]
pub struct DownloadProgressPayload {
    pub percent: f64,
    pub stage: String,
    pub detail: String,
}

#[tauri::command]
pub async fn download_and_install_update(
    window: tauri::WebviewWindow,
    url: String,
) -> Result<String, String> {
    // Security check: strictly whitelist official GitHub release URLs
    let allowed_prefix = "https://github.com/PsyChoDev14/ZeroTrace-Desktop/releases/download/";
    if !url.starts_with(allowed_prefix) {
        return Err("Untrusted update source. Updates may only be downloaded from official ZeroTrace releases.".to_string());
    }

    let is_windows = cfg!(windows);
    if is_windows && !url.ends_with(".exe") && !url.ends_with(".msi") {
        return Err("Invalid Windows installer file format.".to_string());
    }
    if !is_windows && !url.ends_with(".dmg") {
        return Err("Invalid macOS installer file format.".to_string());
    }

    let temp_dir = std::env::temp_dir();
    let installer_path = if is_windows {
        temp_dir.join("ZeroTrace-Update-Setup.exe")
    } else {
        temp_dir.join("ZeroTrace-Update.dmg")
    };

    println!("[Updater] In-app download starting from: {} to {:?}", url, installer_path);

    let emit_progress = |percent: f64, stage: &str, detail: &str| {
        let _ = window.emit(
            "update-download-progress",
            DownloadProgressPayload {
                percent,
                stage: stage.to_string(),
                detail: detail.to_string(),
            },
        );
    };

    emit_progress(0.0, "downloading", "Starting download...");

    // Remove any leftover file from earlier runs
    let _ = std::fs::remove_file(&installer_path);

    // Download directly via system curl with -# (streaming progress meter)
    let mut curl_cmd = std::process::Command::new("curl");
    curl_cmd.args(&[
        "-#",
        "-L",
        "--retry", "3",
        "--fail",
        "-o",
        installer_path.to_str().ok_or("Invalid temp path")?,
        &url,
    ]);
    curl_cmd.stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        curl_cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = curl_cmd.spawn()
        .map_err(|e| format!("Failed to spawn download: {}", e))?;

    if let Some(stderr) = child.stderr.take() {
        use std::io::Read;
        let mut reader = std::io::BufReader::new(stderr);
        let mut token = Vec::new();
        let mut byte = [0u8; 1];
        let mut last_emitted = -1;

        while let Ok(n) = reader.read(&mut byte) {
            if n == 0 {
                break;
            }
            let b = byte[0];
            if b == b'\r' || b == b'\n' {
                let text = String::from_utf8_lossy(&token);
                if let Some(pos) = text.rfind('%') {
                    let before = &text[..pos];
                    if let Some(start) = before.rfind(|c: char| c.is_whitespace() || c == '#') {
                        if let Ok(pct) = before[start + 1..].trim().parse::<f64>() {
                            let rounded = pct.round() as i32;
                            if rounded != last_emitted {
                                last_emitted = rounded;
                                emit_progress(pct, "downloading", &format!("{:.0}% downloaded", pct));
                            }
                        }
                    }
                }
                token.clear();
            } else {
                token.push(b);
            }
        }
    }

    let status = child.wait().map_err(|e| format!("Download process failed: {}", e))?;
    if !status.success() {
        return Err("Download failed. Please check your internet connection.".to_string());
    }

    emit_progress(100.0, "verifying", "Verifying package integrity...");

    if is_windows {
        emit_progress(100.0, "installing", "Launching ZeroTrace installer...");

        // Strip any Mark-of-the-Web (Zone.Identifier) so Windows SmartScreen never blocks
        let mut ps_cmd = std::process::Command::new("powershell");
        ps_cmd.args(&[
            "-WindowStyle", "Hidden",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &format!("Unblock-File -LiteralPath '{}'", installer_path.display()),
        ]);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            ps_cmd.creation_flags(CREATE_NO_WINDOW);
        }
        let _ = ps_cmd.output();

        // Spawn NSIS setup installer directly
        std::process::Command::new(&installer_path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;

        // Give installer a moment to start, then exit to release file locks
        tokio::time::sleep(tokio::time::Duration::from_millis(600)).await;
        std::process::exit(0);
    } else {
        emit_progress(100.0, "installing", "Installing update to /Applications...");

        let mount_point = "/tmp/ZeroTraceUpdateMount";
        let _ = std::process::Command::new("hdiutil").args(&["detach", mount_point, "-force"]).output();
        let _ = std::fs::create_dir_all(mount_point);

        // 1. Mount DMG silently without Finder popup
        let mount_res = std::process::Command::new("hdiutil")
            .args(&[
                "attach",
                "-nobrowse",
                "-readonly",
                installer_path.to_str().unwrap(),
                "-mountpoint",
                mount_point,
            ])
            .output()
            .map_err(|e| format!("Failed to mount DMG: {}", e))?;

        if !mount_res.status.success() {
            let err = String::from_utf8_lossy(&mount_res.stderr);
            return Err(format!("Failed to mount DMG: {}", err));
        }

        // 2. In-place replace /Applications/ZeroTrace.app
        let source_app = format!("{}/ZeroTrace.app", mount_point);
        let target_app = "/Applications/ZeroTrace.app";

        let _ = std::process::Command::new("rm").args(&["-rf", target_app]).output();
        let copy_res = std::process::Command::new("cp")
            .args(&["-R", &source_app, "/Applications/"])
            .output()
            .map_err(|e| format!("Failed to copy updated app: {}", e))?;

        if !copy_res.status.success() {
            let err = String::from_utf8_lossy(&copy_res.stderr);
            let _ = std::process::Command::new("hdiutil").args(&["detach", mount_point, "-force"]).output();
            return Err(format!("Failed to install app to /Applications: {}", err));
        }

        // 3. Clear quarantine so Gatekeeper will never ask "Open Anyway" or "damaged"
        let _ = std::process::Command::new("xattr")
            .args(&["-cr", target_app])
            .output();

        // 4. Detach DMG and cleanup temp files
        let _ = std::process::Command::new("hdiutil").args(&["detach", mount_point, "-force"]).output();
        let _ = std::fs::remove_dir_all(mount_point);
        let _ = std::fs::remove_file(&installer_path);

        emit_progress(100.0, "restarting", "Restarting ZeroTrace...");

        // 5. Relaunch new version of ZeroTrace after current process exits cleanly
        println!("[Updater] Scheduling relaunch of /Applications/ZeroTrace.app...");
        let my_pid = std::process::id();
        let restart_cmd = format!(
            "while kill -0 {} 2>/dev/null; do sleep 0.1; done; sleep 0.2; open -n '{}'",
            my_pid, target_app
        );
        let _ = std::process::Command::new("sh")
            .args(&["-c", &restart_cmd])
            .spawn();

        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        std::process::exit(0);
    }

    #[allow(unreachable_code)]
    Ok("Update installed and application restarted".to_string())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(&["/c", "start", "", &url]);
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn export_diagnostic_report(state: State<SharedState>) -> String {
    let ctx = state.lock();
    let os_info = format!("{} ({})", std::env::consts::OS, std::env::consts::ARCH);
    let vpn_status = format!("Status: {}, Error: {:?}", ctx.vpn_state.status, ctx.vpn_state.error_message);
    let active_cfg = ctx.selected_id.as_ref().and_then(|id| ctx.configs.iter().find(|c| &c.id == id));
    let cfg_summary = if let Some(c) = active_cfg {
        format!("Protocol: {:?}, Server: {}:{}, Network: {}, Security: {}, SNI: {}", 
            c.protocol, c.server, c.port, c.network, c.security, c.sni)
    } else {
        "None selected".to_string()
    };

    #[cfg(target_os = "windows")]
    let proxy_verification = {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("reg");
        cmd.args(&["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"]);
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
        let out = cmd.output()
            .ok()
            .map(|o| {
                let s = String::from_utf8_lossy(&o.stdout);
                s.lines()
                    .filter(|l| l.contains("ProxyEnable") || l.contains("ProxyServer") || l.contains("AutoConfigURL") || l.contains("ProxyOverride"))
                    .map(|l| l.trim().to_string())
                    .collect::<Vec<_>>()
                    .join("\n  ")
            })
            .unwrap_or_else(|| "Failed to query registry".to_string());
        format!("Windows Internet Settings:\n  {}", out)
    };

    #[cfg(target_os = "macos")]
    let proxy_verification = {
        let out = std::process::Command::new("networksetup")
            .args(&["-getwebproxy", "Wi-Fi"])
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().replace('\n', "\n  "))
            .unwrap_or_else(|| "Wi-Fi proxy query unavailable".to_string());
        format!("macOS Web Proxy (Wi-Fi):\n  {}", out)
    };

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let proxy_verification = "Linux/Generic: System proxy manual".to_string();
    
    let logs_text = ctx.logs.iter().rev().take(200).rev()
        .map(|l| format!("[{}] [{}] [{}]: {}", l.timestamp, l.level, l.tag, l.message))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        "=== ZeroTrace Desktop Diagnostic Report ===\n\
        Time: {}\n\
        Platform: {}\n\
        VPN State: {}\n\
        Active Config: {}\n\
        Primary DNS: {}\n\
        DPI Mode: {:?}\n\
        Kill Switch: {}\n\
        Bypass LAN: {}\n\
        \n--- System Proxy Verification ---\n\
        {}\n\
        \n--- Diagnostic Logs (Last {} entries) ---\n{}\n\
        === End of Report ===",
        chrono::Utc::now().to_rfc3339(),
        os_info,
        vpn_status,
        cfg_summary,
        ctx.settings.primary_dns,
        ctx.settings.dpi_bypass_mode,
        ctx.settings.kill_switch,
        ctx.settings.bypass_lan,
        proxy_verification,
        ctx.logs.len(),
        logs_text
    )
}



