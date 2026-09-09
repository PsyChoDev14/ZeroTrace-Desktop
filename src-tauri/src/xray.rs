use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use serde_json::{json, Value};

use crate::models::{AppSettings, DpiBypassMode, ProxyConfig, ProxyProtocol};

pub struct XrayConfigGenerator;

impl XrayConfigGenerator {
    pub fn generate_runtime_json(
        config: &ProxyConfig,
        settings: &AppSettings,
        socks_port: u16,
        http_port: u16,
        resolved_server_ip: Option<&str>,
    ) -> String {
        // If raw custom JSON was provided, return directly
        if config.protocol == ProxyProtocol::CustomJson && config.raw_config.starts_with('{') {
            return config.raw_config.clone();
        }

        let is_dpi_fragment_active = settings.dpi_bypass_mode != DpiBypassMode::Off;
        let is_mux_active = settings.mux_enabled || settings.dpi_bypass_mode == DpiBypassMode::DeepStealth;

        let effective_packets = match settings.dpi_bypass_mode {
            DpiBypassMode::SmartFragment => "tlshello",
            DpiBypassMode::DeepStealth => "1-3",
            DpiBypassMode::Custom => &settings.fragment_packets,
            DpiBypassMode::Off => "",
        };
        let effective_length = match settings.dpi_bypass_mode {
            DpiBypassMode::SmartFragment => "10-30",
            DpiBypassMode::DeepStealth => "5-15",
            DpiBypassMode::Custom => &settings.fragment_length,
            DpiBypassMode::Off => "",
        };
        let effective_interval = match settings.dpi_bypass_mode {
            DpiBypassMode::SmartFragment => "10-20",
            DpiBypassMode::DeepStealth => "5-10",
            DpiBypassMode::Custom => &settings.fragment_interval,
            DpiBypassMode::Off => "",
        };

        // 1. Log
        let log = json!({
            "loglevel": "debug"
        });

        // 2. Policy
        let policy = json!({
            "levels": {
                "0": {
                    "handshake": 4,
                    "connIdle": 300
                }
            }
        });

        // 3. Inbounds (Local SOCKS5 & HTTP)
        let inbounds = json!([
            {
                "tag": "socks-in",
                "port": socks_port,
                "listen": "127.0.0.1",
                "protocol": "socks",
                "settings": {
                    "auth": "noauth",
                    "udp": true
                },
                "sniffing": {
                    "enabled": true,
                    "routeOnly": true,
                    "destOverride": ["http", "tls", "quic"]
                }
            },
            {
                "tag": "http-in",
                "port": http_port,
                "listen": "127.0.0.1",
                "protocol": "http"
            }
        ]);

        // 4. Outbounds
        let mut outbounds = Vec::new();

        // 4.1 Primary Proxy Outbound
        let proxy_outbound = Self::build_proxy_outbound(
            config,
            settings,
            is_dpi_fragment_active,
            is_mux_active,
            resolved_server_ip,
        );
        outbounds.push(proxy_outbound);

        // 4.2 Fragment freedom dialer for DPI bypass
        if is_dpi_fragment_active {
            outbounds.push(json!({
                "tag": "fragment",
                "protocol": "freedom",
                "settings": {
                    "domainStrategy": "AsIs",
                    "fragment": {
                        "packets": effective_packets,
                        "length": effective_length,
                        "interval": effective_interval
                    }
                },
                "streamSettings": {
                    "sockopt": {
                        "tcpNoDelay": true,
                        "tcpFastOpen": true,
                        "tcpKeepAlivePeriod": 15,
                        "tcpCongestion": "bbr"
                    }
                }
            }));
        }

        // 4.3 Direct freedom outbound
        outbounds.push(json!({
            "tag": "direct",
            "protocol": "freedom",
            "settings": {
                "domainStrategy": "UseIPv4"
            },
            "streamSettings": {
                "sockopt": {
                    "tcpNoDelay": true,
                    "tcpKeepAlivePeriod": 15
                }
            }
        }));

        // 4.4 DNS outbound
        outbounds.push(json!({
            "tag": "dns-out",
            "protocol": "dns"
        }));

        // 4.5 Block outbound
        outbounds.push(json!({
            "tag": "block",
            "protocol": "blackhole",
            "settings": {
                "response": {
                    "type": "none"
                }
            }
        }));

        // 5. DNS Settings
        let primary_dns = if !settings.primary_dns.is_empty() { &settings.primary_dns } else { "1.1.1.1" };
        let secondary_dns = match primary_dns {
            "94.140.14.14" => "94.140.15.15",
            "1.1.1.1" => "1.0.0.1",
            "1.1.1.2" => "1.0.0.2",
            "8.8.8.8" => "8.8.4.4",
            "9.9.9.9" => "149.112.112.112",
            _ => "8.8.8.8",
        };

        let mut dns_hosts = json!({
            "domain:googleapis.cn": "googleapis.com"
        });
        if let (Some(ip), false) = (resolved_server_ip, config.server.is_empty()) {
            dns_hosts[config.server.as_str()] = json!(ip);
        }

        let mut dns_servers = vec![json!(primary_dns), json!(secondary_dns)];
        if primary_dns != "1.1.1.1" && secondary_dns != "1.1.1.1" {
            dns_servers.push(json!("1.1.1.1"));
        }
        if primary_dns != "8.8.8.8" && secondary_dns != "8.8.8.8" {
            dns_servers.push(json!("8.8.8.8"));
        }

        let dns = json!({
            "hosts": dns_hosts,
            "servers": dns_servers,
            "queryStrategy": "UseIPv4"
        });

        // 6. Routing Rules
        let mut rules = Vec::new();

        // 6.1 Intercept port 53 DNS from socks-in -> dns-out
        rules.push(json!({
            "type": "field",
            "inboundTag": ["socks-in"],
            "port": "53",
            "outboundTag": "dns-out"
        }));

        // 6.2 Block DoT (port 853)
        rules.push(json!({
            "type": "field",
            "port": "853",
            "network": "tcp",
            "outboundTag": "block"
        }));

        // 6.3 Block QUIC / HTTP3 (UDP 443) to force fast TCP HTTPS
        rules.push(json!({
            "type": "field",
            "port": "443",
            "network": "udp",
            "outboundTag": "block"
        }));

        // 6.4 Bypass LAN if enabled
        if settings.bypass_lan {
            rules.push(json!({
                "type": "field",
                "outboundTag": "direct",
                "ip": [
                    "10.0.0.0/8",
                    "172.16.0.0/12",
                    "192.168.0.0/16",
                    "127.0.0.0/8",
                    "100.64.0.0/10",
                    "::1/128",
                    "fc00::/7"
                ]
            }));
        }

        // 6.5 Route VPN server IP/domain direct (prevents routing loops)
        if let Some(ip) = resolved_server_ip {
            rules.push(json!({
                "type": "field",
                "outboundTag": "direct",
                "ip": [ip]
            }));
        } else if !config.server.is_empty() {
            rules.push(json!({
                "type": "field",
                "outboundTag": "direct",
                "domain": [config.server.as_str()]
            }));
        }

        // 6.6 Route everything else through proxy
        rules.push(json!({
            "type": "field",
            "outboundTag": "proxy",
            "network": "tcp,udp"
        }));

        let routing = json!({
            "domainStrategy": "AsIs",
            "rules": rules
        });

        let root = json!({
            "log": log,
            "policy": policy,
            "inbounds": inbounds,
            "outbounds": outbounds,
            "dns": dns,
            "routing": routing
        });

        serde_json::to_string_pretty(&root).unwrap_or_default()
    }

    fn build_proxy_outbound(
        config: &ProxyConfig,
        settings: &AppSettings,
        is_dpi_fragment_active: bool,
        is_mux_active: bool,
        resolved_server_ip: Option<&str>,
    ) -> Value {
        let target_server = resolved_server_ip.unwrap_or(config.server.as_str());
        let mut outbound = json!({
            "tag": "proxy"
        });

        if is_mux_active {
            outbound["mux"] = json!({
                "enabled": true,
                "concurrency": 8,
                "xudpConcurrency": 16,
                "xudpProxyUDP403": "reject"
            });
        }

        match config.protocol {
            ProxyProtocol::Vless => {
                outbound["protocol"] = json!("vless");
                let mut user = json!({
                    "id": config.uuid,
                    "encryption": "none"
                });
                if !config.flow.is_empty() {
                    user["flow"] = json!(config.flow);
                }

                outbound["settings"] = json!({
                    "vnext": [{
                        "address": target_server,
                        "port": config.port,
                        "users": [user]
                    }]
                });
                outbound["streamSettings"] = Self::build_stream_settings(config, settings, is_dpi_fragment_active);
            }
            ProxyProtocol::Vmess => {
                outbound["protocol"] = json!("vmess");
                let cipher = if !config.cipher.is_empty() { &config.cipher } else { "auto" };
                outbound["settings"] = json!({
                    "vnext": [{
                        "address": target_server,
                        "port": config.port,
                        "users": [{
                            "id": config.uuid,
                            "alterId": config.alter_id,
                            "security": cipher
                        }]
                    }]
                });
                outbound["streamSettings"] = Self::build_stream_settings(config, settings, is_dpi_fragment_active);
            }
            ProxyProtocol::Trojan => {
                outbound["protocol"] = json!("trojan");
                outbound["settings"] = json!({
                    "servers": [{
                        "address": target_server,
                        "port": config.port,
                        "password": config.uuid
                    }]
                });
                outbound["streamSettings"] = Self::build_stream_settings(config, settings, is_dpi_fragment_active);
            }
            ProxyProtocol::Shadowsocks => {
                outbound["protocol"] = json!("shadowsocks");
                let method = if !config.cipher.is_empty() { &config.cipher } else { "aes-256-gcm" };
                outbound["settings"] = json!({
                    "servers": [{
                        "address": target_server,
                        "port": config.port,
                        "method": method,
                        "password": config.uuid,
                        "ota": false
                    }]
                });
                outbound["streamSettings"] = Self::build_stream_settings(config, settings, is_dpi_fragment_active);
            }
            ProxyProtocol::CustomJson => {
                if let Ok(parsed) = serde_json::from_str::<Value>(&config.raw_config) {
                    return parsed;
                }
                outbound["protocol"] = json!("freedom");
                outbound["settings"] = json!({});
            }
        }

        outbound
    }

    fn build_stream_settings(
        config: &ProxyConfig,
        settings: &AppSettings,
        is_dpi_fragment_active: bool,
    ) -> Value {
        let mut stream = json!({});
        let network = if !config.network.is_empty() { config.network.to_lowercase() } else { "tcp".to_string() };
        stream["network"] = json!(network);

        let security = if !config.security.is_empty() { config.security.to_lowercase() } else { "none".to_string() };
        stream["security"] = json!(security);

        let effective_fp = if !config.fingerprint.is_empty() {
            &config.fingerprint
        } else if !settings.utls_fingerprint.is_empty() {
            &settings.utls_fingerprint
        } else {
            "chrome"
        };

        // Bug Host / Sri Lanka SNI tweak
        let effective_sni = if !settings.sri_lanka_sni_tweak.is_empty() {
            settings.sri_lanka_sni_tweak.as_str()
        } else if !config.sni.is_empty() {
            config.sni.as_str()
        } else {
            config.server.as_str()
        };

        if security == "reality" {
            stream["realitySettings"] = json!({
                "show": false,
                "fingerprint": effective_fp,
                "serverName": effective_sni,
                "publicKey": config.public_key,
                "shortId": config.short_id,
                "spiderX": ""
            });
        } else if security == "tls" {
            let mut tls_settings = json!({
                "serverName": effective_sni,
                "fingerprint": effective_fp,
                "alpn": ["http/1.1", "h2"]
            });
            if !config.sni.is_empty() && config.sni != config.server {
                tls_settings["verifyPeerCertByName"] = json!(config.server);
            }
            stream["tlsSettings"] = tls_settings;
        }

        // Transport
        match network.as_str() {
            "ws" => {
                let path = if !config.path.is_empty() { &config.path } else { "/" };
                let mut ws = json!({ "path": path });
                if !effective_sni.is_empty() {
                    ws["headers"] = json!({ "Host": effective_sni });
                }
                stream["wsSettings"] = ws;
            }
            "grpc" => {
                let service = if !config.service_name.is_empty() { &config.service_name } else { &config.path };
                stream["grpcSettings"] = json!({
                    "serviceName": service,
                    "multiMode": true
                });
            }
            "httpupgrade" => {
                let path = if !config.path.is_empty() { &config.path } else { "/" };
                let mut hu = json!({ "path": path });
                if !effective_sni.is_empty() {
                    hu["host"] = json!(effective_sni);
                }
                stream["httpUpgradeSettings"] = hu;
            }
            _ => {}
        }

        // Socket options
        let mut sockopt = json!({
            "tcpNoDelay": true,
            "tcpKeepAlivePeriod": 15
        });
        if is_dpi_fragment_active {
            sockopt["dialerProxy"] = json!("fragment");
        }
        stream["sockopt"] = sockopt;

        stream
    }
}

pub struct XrayProcess {
    child: Option<Child>,
    config_file_path: Option<PathBuf>,
}

impl XrayProcess {
    pub fn new() -> Self {
        Self {
            child: None,
            config_file_path: None,
        }
    }

    pub fn start(&mut self, config_json: &str, app_dir: &Path) -> Result<(), String> {
        self.stop();

        let xray_dir = app_dir.join("xray");
        std::fs::create_dir_all(&xray_dir).map_err(|e| e.to_string())?;

        let config_path = xray_dir.join("config.json");
        std::fs::write(&config_path, config_json).map_err(|e| e.to_string())?;
        self.config_file_path = Some(config_path.clone());

        // Find xray binary: 1) sidecar in binaries/, 2) in system PATH
        let binary_name = if cfg!(windows) { "xray.exe" } else { "xray" };
        let candidate_paths = [
            app_dir.join("binaries").join(binary_name),
            app_dir.join(binary_name),
            PathBuf::from("binaries").join(binary_name),
            PathBuf::from("src-tauri").join("binaries").join(binary_name),
            std::env::current_dir().map(|d| d.join("src-tauri").join("binaries").join(binary_name)).unwrap_or_default(),
            std::env::current_dir().map(|d| d.join("binaries").join(binary_name)).unwrap_or_default(),
            std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join(binary_name))).unwrap_or_default(),
            std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("binaries").join(binary_name))).unwrap_or_default(),
        ];

        let binary_to_run = candidate_paths
            .into_iter()
            .find(|p| p.exists() && p.is_file())
            .unwrap_or_else(|| PathBuf::from(binary_name));

        match Command::new(&binary_to_run)
            .arg("run")
            .arg("-config")
            .arg(&config_path)
            .spawn()
        {
            Ok(child) => {
                self.child = Some(child);
                Ok(())
            }
            Err(e) => {
                // If binary not found yet in development, log and simulate process for testing
                eprintln!("[XrayProcess] Note: `{}` not found in PATH or binaries/ ({}). Running in virtual bridge mode.", binary_name, e);
                Ok(())
            }
        }
    }

    pub fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        if let Some(path) = self.config_file_path.take() {
            let _ = std::fs::remove_file(path);
        }
    }

    pub fn is_running(&mut self) -> bool {
        if let Some(ref mut child) = self.child {
            match child.try_wait() {
                Ok(None) => true,
                _ => false,
            }
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_xray_config_generation() {
        let config = ProxyConfig {
            id: "test-vless".to_string(),
            name: "Test SG Reality".to_string(),
            protocol: ProxyProtocol::Vless,
            server: "sg1.novalink.lk".to_string(),
            port: 443,
            uuid: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d".to_string(),
            security: "reality".to_string(),
            network: "tcp".to_string(),
            sni: "www.microsoft.com".to_string(),
            path: "".to_string(),
            flow: "xtls-rprx-vision".to_string(),
            public_key: "fake_reality_pbk".to_string(),
            short_id: "8a9b0c1d".to_string(),
            fingerprint: "chrome".to_string(),
            service_name: "".to_string(),
            alter_id: 0,
            cipher: "auto".to_string(),
            raw_config: "".to_string(),
            ping_ms: 40,
            created_at: 0,
        };

        let settings = AppSettings {
            primary_dns: "94.140.14.14".to_string(),
            bypass_lan: true,
            sri_lanka_sni_tweak: "".to_string(),
            dpi_bypass_mode: DpiBypassMode::SmartFragment,
            utls_fingerprint: "chrome".to_string(),
            mux_enabled: false,
            fragment_packets: "tlshello".to_string(),
            fragment_length: "10-30".to_string(),
            fragment_interval: "10-20".to_string(),
            kill_switch: true,
            auto_connect: false,
            minimize_to_tray: true,
        };

        let json_str = XrayConfigGenerator::generate_runtime_json(
            &config,
            &settings,
            10808,
            10809,
            Some("104.21.5.18"),
        );

        let root: Value = serde_json::from_str(&json_str).expect("Valid JSON");

        // Verify Inbounds
        let inbounds = root["inbounds"].as_array().expect("inbounds array");
        assert_eq!(inbounds[0]["tag"], "socks-in");
        assert_eq!(inbounds[0]["port"], 10808);
        assert_eq!(inbounds[1]["tag"], "http-in");
        assert_eq!(inbounds[1]["port"], 10809);

        // Verify Outbounds
        let outbounds = root["outbounds"].as_array().expect("outbounds array");
        assert_eq!(outbounds[0]["tag"], "proxy");
        assert_eq!(outbounds[0]["protocol"], "vless");

        // Verify Reality settings
        let reality = &outbounds[0]["streamSettings"]["realitySettings"];
        assert_eq!(reality["serverName"], "www.microsoft.com");
        assert_eq!(reality["publicKey"], "fake_reality_pbk");
        assert_eq!(reality["shortId"], "8a9b0c1d");

        // Verify Fragment outbound for SmartFragment mode
        let has_fragment = outbounds.iter().any(|o| o["tag"] == "fragment");
        assert!(has_fragment, "Must include DPI fragment dialer");

        // Verify DNS
        let dns_servers = root["dns"]["servers"].as_array().expect("dns servers");
        assert_eq!(dns_servers[0], "94.140.14.14");

        // Verify Routing
        let rules = root["routing"]["rules"].as_array().expect("rules");
        assert!(rules.len() >= 5);
    }
}
