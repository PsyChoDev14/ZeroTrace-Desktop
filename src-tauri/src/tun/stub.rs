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

        // 3. Configure LAN and local bypass domains
        let _ = Command::new("networksetup")
            .args(&[
                "-setproxybypassdomains",
                &service,
                "127.0.0.1",
                "localhost",
                "10.0.0.0/8",
                "172.16.0.0/12",
                "192.168.0.0/16",
                "*.local",
            ])
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
                let _ = Command::new("networksetup").args(&["-setproxybypassdomains", service, "empty"]).output();
                println!("[StubTunManager] macOS system proxy disabled. Direct connection restored.");
            }
        }
    }

    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }

    pub fn cleanup_stale_proxies() {
        if let Some(service) = Self::get_active_mac_service() {
            println!("[StubTunManager] Checking and cleaning stale macOS system proxy for '{}' on startup...", service);
            let _ = Command::new("networksetup").args(&["-setsocksfirewallproxystate", &service, "off"]).output();
            let _ = Command::new("networksetup").args(&["-setwebproxystate", &service, "off"]).output();
            let _ = Command::new("networksetup").args(&["-setsecurewebproxystate", &service, "off"]).output();
            let _ = Command::new("networksetup").args(&["-setproxybypassdomains", &service, "empty"]).output();
        }
    }

    fn get_active_mac_service() -> Option<String> {
        // 1. Try to detect the default interface from active OS routing table (e.g. "en0")
        let default_device = Command::new("route")
            .args(&["-n", "get", "default"])
            .output()
            .ok()
            .and_then(|output| {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("interface:") {
                        return trimmed.split_whitespace().nth(1).map(|s| s.to_string());
                    }
                }
                None
            });

        // 2. Map default device to the corresponding macOS network service name
        if let Ok(output) = Command::new("networksetup").args(&["-listnetworkserviceorder"]).output() {
            let text = String::from_utf8_lossy(&output.stdout);
            let mut current_service: Option<String> = None;

            for line in text.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('(') && trimmed.contains(')') {
                    if let Some(start) = trimmed.find(' ') {
                        let name = trimmed[start + 1..].trim();
                        current_service = Some(name.to_string());
                    }
                } else if trimmed.starts_with("(Hardware Port:") {
                    if let Some(ref dev) = default_device {
                        if trimmed.contains(&format!("Device: {})", dev)) || trimmed.contains(&format!("Device: {}", dev)) {
                            if let Some(service) = current_service {
                                return Some(service);
                            }
                        }
                    }
                }
            }

            // Fallback: check Wi-Fi or Ethernet
            for line in text.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('(') && trimmed.contains("Wi-Fi") {
                    return Some("Wi-Fi".to_string());
                }
                if trimmed.starts_with('(') && trimmed.contains("Ethernet") {
                    return Some("Ethernet".to_string());
                }
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
