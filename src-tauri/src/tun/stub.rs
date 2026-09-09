use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct StubTunManager {
    is_active: Arc<AtomicBool>,
    active_service: Option<String>,
}

impl StubTunManager {
    pub fn new() -> Self {
        Self {
            is_active: Arc::new(AtomicBool::new(false)),
            active_service: None,
        }
    }

    pub fn start_tunnel(
        &mut self,
        server_host: &str,
        _server_port: u16,
        _primary_dns: &str,
    ) -> Result<(), String> {
        let service = Self::get_active_mac_service().unwrap_or_else(|| "Wi-Fi".to_string());
        println!("[StubTunManager] Configuring macOS system proxy for '{}' (SOCKS5 10808, HTTP 10809)...", service);

        // 1. Configure SOCKS5 proxy
        let _ = Command::new("networksetup")
            .args(&["-setsocksfirewallproxy", &service, "127.0.0.1", "10808"])
            .output();
        let _ = Command::new("networksetup")
            .args(&["-setsocksfirewallproxystate", &service, "on"])
            .output();

        // 2. Configure HTTP and HTTPS proxies
        let _ = Command::new("networksetup")
            .args(&["-setwebproxy", &service, "127.0.0.1", "10809"])
            .output();
        let _ = Command::new("networksetup")
            .args(&["-setwebproxystate", &service, "on"])
            .output();
        let _ = Command::new("networksetup")
            .args(&["-setsecurewebproxy", &service, "127.0.0.1", "10809"])
            .output();
        let _ = Command::new("networksetup")
            .args(&["-setsecurewebproxystate", &service, "on"])
            .output();

        self.active_service = Some(service.clone());
        self.is_active.store(true, Ordering::SeqCst);
        println!("[StubTunManager] macOS system proxy active! Traffic routed via Xray tunnel (Server: {}).", server_host);
        Ok(())
    }

    pub fn stop_tunnel(&mut self) {
        if self.is_active.swap(false, Ordering::SeqCst) {
            if let Some(ref service) = self.active_service.take() {
                println!("[StubTunManager] Restoring macOS network settings for '{}'...", service);
                let _ = Command::new("networksetup").args(&["-setsocksfirewallproxystate", service, "off"]).output();
                let _ = Command::new("networksetup").args(&["-setwebproxystate", service, "off"]).output();
                let _ = Command::new("networksetup").args(&["-setsecurewebproxystate", service, "off"]).output();
                println!("[StubTunManager] macOS system proxy disabled. Direct connection restored.");
            }
        }
    }

    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }

    fn get_active_mac_service() -> Option<String> {
        let output = Command::new("networksetup")
            .args(&["-listnetworkserviceorder"])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&output.stdout);

        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('(') && trimmed.contains("Wi-Fi") {
                return Some("Wi-Fi".to_string());
            }
            if trimmed.starts_with('(') && trimmed.contains("Ethernet") {
                return Some("Ethernet".to_string());
            }
        }
        Some("Wi-Fi".to_string())
    }
}

impl Drop for StubTunManager {
    fn drop(&mut self) {
        self.stop_tunnel();
    }
}
