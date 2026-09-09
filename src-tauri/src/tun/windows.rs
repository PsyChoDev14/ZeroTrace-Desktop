use std::net::IpAddr;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct WindowsTunManager {
    is_active: Arc<AtomicBool>,
    server_ip: Option<String>,
    physical_gateway: Option<String>,
}

impl WindowsTunManager {
    pub fn new() -> Self {
        Self {
            is_active: Arc::new(AtomicBool::new(false)),
            server_ip: None,
            physical_gateway: None,
        }
    }

    pub fn start_tunnel(
        &mut self,
        server_host: &str,
        server_port: u16,
        primary_dns: &str,
    ) -> Result<(), String> {
        self.stop_tunnel();

        // 1. Resolve remote server IP
        let resolved_ip = Self::resolve_host(server_host)?;
        self.server_ip = Some(resolved_ip.clone());

        // 2. Discover default physical gateway
        let gateway = Self::get_default_gateway().unwrap_or_else(|| "192.168.1.1".to_string());
        self.physical_gateway = Some(gateway.clone());

        println!("[WindowsTunManager] Initializing Wintun adapter (Server: {} -> {}, Gateway: {})", server_host, resolved_ip, gateway);

        // 3. Configure Wintun virtual network adapter via netsh
        let adapter_name = "ZeroTrace TUN";
        let _ = Command::new("netsh")
            .args(&[
                "interface", "ipv4", "set", "address",
                &format!("name=\"{}\"", adapter_name),
                "source=static",
                "address=10.233.233.2",
                "mask=255.255.255.0",
                "gateway=10.233.233.1"
            ])
            .output();

        // 4. Configure adapter DNS
        let _ = Command::new("netsh")
            .args(&[
                "interface", "ipv4", "set", "dns",
                &format!("name=\"{}\"", adapter_name),
                "source=static",
                &format!("address={}", primary_dns),
                "register=primary"
            ])
            .output();

        // 5. Add host bypass route for proxy server IP via physical gateway (prevents routing loops)
        let _ = Command::new("route")
            .args(&["add", &resolved_ip, "mask", "255.255.255.255", &gateway, "metric", "1"])
            .output();

        // 6. Add split default routes through Wintun TUN (0.0.0.0/1 and 128.0.0.0/1)
        let _ = Command::new("route")
            .args(&["add", "0.0.0.0", "mask", "128.0.0.0", "10.233.233.2", "metric", "1"])
            .output();
        let _ = Command::new("route")
            .args(&["add", "128.0.0.0", "mask", "128.0.0.0", "10.233.233.2", "metric", "1"])
            .output();

        self.is_active.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub fn stop_tunnel(&mut self) {
        if self.is_active.swap(false, Ordering::SeqCst) {
            println!("[WindowsTunManager] Tearing down Wintun routing rules...");

            // Remove split default routes
            let _ = Command::new("route").args(&["delete", "0.0.0.0", "mask", "128.0.0.0"]).output();
            let _ = Command::new("route").args(&["delete", "128.0.0.0", "mask", "128.0.0.0"]).output();

            // Remove server host bypass route
            if let Some(ref ip) = self.server_ip {
                let _ = Command::new("route").args(&["delete", ip, "mask", "255.255.255.255"]).output();
            }

            self.server_ip = None;
            self.physical_gateway = None;
        }
    }

    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }

    fn resolve_host(host: &str) -> Result<String, String> {
        if let Ok(ip) = host.parse::<IpAddr>() {
            return Ok(ip.to_string());
        }

        use std::net::ToSocketAddrs;
        let addr_str = format!("{}:443", host);
        if let Ok(mut addrs) = addr_str.to_socket_addrs() {
            if let Some(addr) = addrs.next() {
                return Ok(addr.ip().to_string());
            }
        }
        Ok(host.to_string())
    }

    fn get_default_gateway() -> Option<String> {
        let output = Command::new("netsh")
            .args(&["interface", "ipv4", "show", "addresses"])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&output.stdout);

        for line in text.lines() {
            let lower = line.to_lowercase();
            if lower.contains("default gateway") || lower.contains("gateway") {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() > 1 {
                    let candidate = parts[1].trim();
                    if candidate.parse::<IpAddr>().is_ok() {
                        return Some(candidate.to_string());
                    }
                }
            }
        }
        None
    }
}

impl Drop for WindowsTunManager {
    fn drop(&mut self) {
        self.stop_tunnel();
    }
}
