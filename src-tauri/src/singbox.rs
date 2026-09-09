use serde_json::{json, Value};
use crate::models::{AppSettings, ProxyConfig, ProxyProtocol};

pub struct SingboxConfigGenerator;

impl SingboxConfigGenerator {
    pub fn generate_runtime_json(
        config: &ProxyConfig,
        settings: &AppSettings,
        resolved_server_ip: Option<&str>,
    ) -> String {
        // If raw custom JSON was provided, return directly
        if config.protocol == ProxyProtocol::CustomJson && config.raw_config.starts_with('{') {
            return config.raw_config.clone();
        }

        let primary_dns = if !settings.primary_dns.is_empty() {
            &settings.primary_dns
        } else {
            "94.140.14.14"
        };

        // 1. DNS Configuration (sing-box 1.14+ format)
        let dns = json!({
            "servers": [
                {
                    "type": "udp",
                    "tag": "dns-remote",
                    "server": primary_dns,
                    "detour": "proxy"
                },
                {
                    "type": "local",
                    "tag": "dns-direct",
                    "detour": "direct"
                }
            ],
            "strategy": "ipv4_only"
        });

        // 2. Inbounds (Wintun Layer 3 TUN with mixed stack + Local SOCKS5/HTTP mixed listener)
        let inbounds = vec![
            json!({
                "type": "tun",
                "tag": "tun-in",
                "interface_name": "ZeroTrace",
                "address": [
                    "172.19.0.1/30"
                ],
                "auto_route": true,
                "strict_route": true,
                "stack": "mixed",
                "sniff": false
            }),
            json!({
                "type": "mixed",
                "tag": "mixed-in",
                "listen": "127.0.0.1",
                "listen_port": 10808
            })
        ];

        // 3. Outbounds
        let proxy_outbound = Self::build_proxy_outbound(config, settings, resolved_server_ip);
        let outbounds = vec![
            proxy_outbound,
            json!({ "type": "direct", "tag": "direct" }),
            json!({ "type": "block", "tag": "block" })
        ];

        // 4. Routing rules (sing-box 1.14+ format)
        let mut route_rules = vec![
            json!({
                "action": "hijack-dns",
                "protocol": "dns"
            })
        ];

        // Bypass local private subnets if enabled
        if settings.bypass_lan {
            route_rules.push(json!({
                "ip_is_private": true,
                "outbound": "direct"
            }));
        }

        // Bypass remote server IP direct to gateway
        if let Some(ip) = resolved_server_ip {
            route_rules.push(json!({
                "ip_cidr": [format!("{}/32", ip)],
                "outbound": "direct"
            }));
        }

        let route = json!({
            "default_domain_resolver": "dns-direct",
            "rules": route_rules,
            "auto_detect_interface": true
        });

        let root = json!({
            "log": {
                "level": "warn"
            },
            "dns": dns,
            "inbounds": inbounds,
            "outbounds": outbounds,
            "route": route
        });

        serde_json::to_string_pretty(&root).unwrap_or_default()
    }

    fn build_proxy_outbound(
        config: &ProxyConfig,
        settings: &AppSettings,
        resolved_server_ip: Option<&str>,
    ) -> Value {
        let target_server = resolved_server_ip.unwrap_or(config.server.as_str());
        let effective_fp = if !config.fingerprint.is_empty() {
            &config.fingerprint
        } else if !settings.utls_fingerprint.is_empty() {
            &settings.utls_fingerprint
        } else {
            "chrome"
        };

        let effective_sni = if !settings.sri_lanka_sni_tweak.is_empty() {
            settings.sri_lanka_sni_tweak.as_str()
        } else if !config.sni.is_empty() {
            config.sni.as_str()
        } else {
            config.server.as_str()
        };

        match config.protocol {
            ProxyProtocol::Vless => {
                let mut outbound = json!({
                    "type": "vless",
                    "tag": "proxy",
                    "server": target_server,
                    "server_port": config.port,
                    "uuid": config.uuid,
                    "packet_encoding": "xudp"
                });

                if !config.flow.is_empty() {
                    outbound["flow"] = json!(config.flow);
                }

                let is_tls = config.security.eq_ignore_ascii_case("tls");
                let is_reality = config.security.eq_ignore_ascii_case("reality");

                if is_tls || is_reality {
                    let mut tls = json!({
                        "enabled": true,
                        "server_name": effective_sni,
                        "utls": {
                            "enabled": true,
                            "fingerprint": effective_fp
                        }
                    });

                    if is_reality {
                        tls["reality"] = json!({
                            "enabled": true,
                            "public_key": config.public_key,
                            "short_id": config.short_id
                        });
                    }

                    outbound["tls"] = tls;
                }

                if let Some(transport) = Self::build_transport(config, effective_sni) {
                    outbound["transport"] = transport;
                }

                outbound
            }
            ProxyProtocol::Vmess => {
                let cipher = if !config.cipher.is_empty() { &config.cipher } else { "auto" };
                let mut outbound = json!({
                    "type": "vmess",
                    "tag": "proxy",
                    "server": target_server,
                    "server_port": config.port,
                    "uuid": config.uuid,
                    "security": cipher,
                    "alter_id": config.alter_id,
                    "packet_encoding": "xudp"
                });

                if config.security.eq_ignore_ascii_case("tls") {
                    outbound["tls"] = json!({
                        "enabled": true,
                        "server_name": effective_sni,
                        "utls": {
                            "enabled": true,
                            "fingerprint": effective_fp
                        }
                    });
                }

                if let Some(transport) = Self::build_transport(config, effective_sni) {
                    outbound["transport"] = transport;
                }

                outbound
            }
            ProxyProtocol::Trojan => {
                let mut outbound = json!({
                    "type": "trojan",
                    "tag": "proxy",
                    "server": target_server,
                    "server_port": config.port,
                    "password": config.uuid
                });

                let is_tls = config.security.is_empty() || config.security.eq_ignore_ascii_case("tls");
                if is_tls {
                    outbound["tls"] = json!({
                        "enabled": true,
                        "server_name": effective_sni,
                        "utls": {
                            "enabled": true,
                            "fingerprint": effective_fp
                        }
                    });
                }

                if let Some(transport) = Self::build_transport(config, effective_sni) {
                    outbound["transport"] = transport;
                }

                outbound
            }
            ProxyProtocol::Shadowsocks => {
                let method = if !config.cipher.is_empty() { &config.cipher } else { "aes-256-gcm" };
                json!({
                    "type": "shadowsocks",
                    "tag": "proxy",
                    "server": target_server,
                    "server_port": config.port,
                    "method": method,
                    "password": config.uuid
                })
            }
            ProxyProtocol::CustomJson => {
                if let Ok(parsed) = serde_json::from_str::<Value>(&config.raw_config) {
                    parsed
                } else {
                    json!({
                        "type": "direct",
                        "tag": "proxy"
                    })
                }
            }
        }
    }

    fn build_transport(config: &ProxyConfig, effective_sni: &str) -> Option<Value> {
        let net = config.network.to_lowercase();
        match net.as_str() {
            "ws" => {
                let path = if !config.path.is_empty() { &config.path } else { "/" };
                let mut ws = json!({
                    "type": "ws",
                    "path": path
                });
                if !effective_sni.is_empty() {
                    ws["headers"] = json!({ "Host": effective_sni });
                }
                Some(ws)
            }
            "grpc" => {
                let service = if !config.service_name.is_empty() {
                    &config.service_name
                } else if !config.path.is_empty() {
                    &config.path
                } else {
                    ""
                };
                Some(json!({
                    "type": "grpc",
                    "service_name": service
                }))
            }
            "httpupgrade" => {
                let path = if !config.path.is_empty() { &config.path } else { "/" };
                let mut hu = json!({
                    "type": "httpupgrade",
                    "path": path
                });
                if !effective_sni.is_empty() {
                    hu["host"] = json!(effective_sni);
                }
                Some(hu)
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_singbox_vless_reality_config() {
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
            dpi_bypass_mode: crate::models::DpiBypassMode::Off,
            utls_fingerprint: "chrome".to_string(),
            mux_enabled: false,
            fragment_packets: "".to_string(),
            fragment_length: "".to_string(),
            fragment_interval: "".to_string(),
            kill_switch: true,
            auto_connect: false,
            minimize_to_tray: true,
        };

        let json_str = SingboxConfigGenerator::generate_runtime_json(
            &config,
            &settings,
            Some("104.21.5.18"),
        );

        let root: Value = serde_json::from_str(&json_str).expect("Valid JSON");

        // Verify DNS (sing-box 1.14+ format)
        let dns = &root["dns"];
        assert_eq!(dns["servers"][0]["type"], "udp");
        assert_eq!(dns["servers"][0]["server"], "94.140.14.14");
        assert_eq!(dns["servers"][1]["type"], "local");

        // Verify Inbounds
        let inbounds = root["inbounds"].as_array().expect("inbounds array");
        assert_eq!(inbounds[0]["type"], "tun");
        assert_eq!(inbounds[0]["stack"], "mixed");
        assert_eq!(inbounds[0]["address"][0], "172.19.0.1/30");
        assert_eq!(inbounds[0]["auto_route"], true);
        assert_eq!(inbounds[0]["strict_route"], true);
        assert_eq!(inbounds[1]["type"], "mixed");
        assert_eq!(inbounds[1]["listen_port"], 10808);

        // Verify Route (sing-box 1.14+ format)
        let route = &root["route"];
        assert_eq!(route["default_domain_resolver"], "dns-direct");
        assert_eq!(route["rules"][0]["action"], "hijack-dns");

        // Verify Outbound
        let outbounds = root["outbounds"].as_array().expect("outbounds array");
        assert_eq!(outbounds[0]["type"], "vless");
        assert_eq!(outbounds[0]["tls"]["reality"]["public_key"], "fake_reality_pbk");
        assert_eq!(outbounds[0]["tls"]["reality"]["short_id"], "8a9b0c1d");
        assert_eq!(outbounds[0]["tls"]["server_name"], "www.microsoft.com");
    }
}
