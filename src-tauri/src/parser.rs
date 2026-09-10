use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::Value;
use url::Url;
use uuid::Uuid;

use crate::models::{ProxyConfig, ProxyProtocol};

pub struct ConfigParser;

impl ConfigParser {
    pub fn parse_single(input: &str) -> Option<ProxyConfig> {
        let mut clean = input.trim();
        if clean.is_empty() {
            return None;
        }

        // Strip surrounding quotes or markdown backticks
        if (clean.starts_with('"') && clean.ends_with('"')) || (clean.starts_with('\'') && clean.ends_with('\'')) {
            clean = clean[1..clean.len() - 1].trim();
        }
        if clean.starts_with("```") && clean.ends_with("```") {
            clean = clean.trim_start_matches("```").trim_end_matches("```").trim();
        }

        // 1. Direct protocol matching
        let lower = clean.to_lowercase();
        if lower.starts_with("vless://") { return Self::parse_vless(clean); }
        if lower.starts_with("vmess://") { return Self::parse_vmess(clean); }
        if lower.starts_with("trojan://") { return Self::parse_trojan(clean); }
        if lower.starts_with("ss://") { return Self::parse_shadowsocks(clean); }
        if clean.starts_with('{') && clean.ends_with('}') { return Self::parse_custom_json(clean); }

        // 2. Extract embedded URI if copied from chat captions (Telegram / WhatsApp)
        let schemes = ["vless://", "vmess://", "trojan://", "ss://"];
        for scheme in schemes {
            if let Some(idx) = lower.find(scheme) {
                let candidate = &clean[idx..];
                let line = candidate.split_whitespace().next().unwrap_or("");
                let line_lower = line.to_lowercase();
                if line_lower.starts_with("vless://") { if let Some(cfg) = Self::parse_vless(line) { return Some(cfg); } }
                if line_lower.starts_with("vmess://") { if let Some(cfg) = Self::parse_vmess(line) { return Some(cfg); } }
                if line_lower.starts_with("trojan://") { if let Some(cfg) = Self::parse_trojan(line) { return Some(cfg); } }
                if line_lower.starts_with("ss://") { if let Some(cfg) = Self::parse_shadowsocks(line) { return Some(cfg); } }
            }
        }

        // 3. Extract embedded JSON if present
        if let (Some(first_brace), Some(last_brace)) = (clean.find('{'), clean.rfind('}')) {
            if last_brace > first_brace {
                let json_candidate = &clean[first_brace..=last_brace];
                if let Some(cfg) = Self::parse_custom_json(json_candidate) {
                    return Some(cfg);
                }
            }
        }

        None
    }

    pub fn parse_multiple(input: &str) -> Vec<ProxyConfig> {
        input.lines()
            .filter_map(|l| Self::parse_single(l.trim()))
            .collect()
    }

    fn parse_vless(uri_str: &str) -> Option<ProxyConfig> {
        let url = Url::parse(uri_str).ok()?;
        let host = url.host_str()?.to_string();
        let port = url.port().unwrap_or(443);
        let uuid = url.username().to_string();

        if host.is_empty() || uuid.is_empty() {
            return None;
        }

        let fragment = url.fragment().unwrap_or("");
        let name = if !fragment.is_empty() {
            urlencoding_decode(fragment)
        } else {
            format!("ZeroTrace VLESS ({host})")
        };

        let mut security = "none".to_string();
        let mut network = "tcp".to_string();
        let mut flow = "".to_string();
        let mut sni = "".to_string();
        let mut path = "".to_string();
        let mut pbk = "".to_string();
        let mut sid = "".to_string();
        let mut fp = "chrome".to_string();
        let mut service_name = "".to_string();

        for (k, v) in url.query_pairs() {
            match k.as_ref() {
                "security" => security = v.to_string(),
                "type" => network = v.to_string(),
                "flow" => {
                    if v.to_lowercase().contains("vision") {
                        flow = "xtls-rprx-vision".to_string();
                    } else {
                        flow = "".to_string();
                    }
                }
                "sni" | "host" => if sni.is_empty() { sni = v.to_string(); },
                "path" => path = v.to_string(),
                "pbk" => pbk = v.to_string(),
                "sid" => sid = v.to_string(),
                "fp" => fp = v.to_string(),
                "serviceName" => service_name = v.to_string(),
                _ => {}
            }
        }

        Some(ProxyConfig {
            id: Uuid::new_v4().to_string(),
            name,
            protocol: ProxyProtocol::Vless,
            server: host,
            port,
            uuid,
            security,
            network,
            sni,
            path,
            flow,
            public_key: pbk,
            short_id: sid,
            fingerprint: fp,
            service_name,
            alter_id: 0,
            cipher: "auto".to_string(),
            raw_config: uri_str.to_string(),
            ping_ms: -1,
            created_at: chrono::Utc::now().timestamp_millis(),
        })
    }

    fn parse_vmess(uri_str: &str) -> Option<ProxyConfig> {
        let b64 = uri_str.get(8..)?.trim();
        let decoded = decode_base64_loose(b64)?;
        let json: Value = serde_json::from_str(&decoded).ok()?;

        let host = json.get("add")?.as_str()?.to_string();
        let port = match json.get("port") {
            Some(Value::Number(n)) => n.as_u64()? as u16,
            Some(Value::String(s)) => s.parse::<u16>().ok()?,
            _ => 443,
        };
        let uuid = json.get("id")?.as_str()?.to_string();
        let alter_id = json.get("aid").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
        let cipher = json.get("scy").and_then(|v| v.as_str()).unwrap_or("auto").to_string();
        let network = json.get("net").and_then(|v| v.as_str()).unwrap_or("tcp").to_string();
        let raw_tls = json.get("tls").and_then(|v| v.as_str()).unwrap_or("none");
        let security = if raw_tls.eq_ignore_ascii_case("tls") { "tls".to_string() } else { "none".to_string() };
        let sni = json.get("sni").or_else(|| json.get("host")).and_then(|v| v.as_str()).unwrap_or("").to_string();
        let path = json.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let ps = json.get("ps").and_then(|v| v.as_str()).unwrap_or("");
        let name = if !ps.is_empty() { ps.to_string() } else { format!("ZeroTrace VMess ({host})") };

        Some(ProxyConfig {
            id: Uuid::new_v4().to_string(),
            name,
            protocol: ProxyProtocol::Vmess,
            server: host,
            port,
            uuid,
            security,
            network,
            sni,
            path,
            flow: "".to_string(),
            public_key: "".to_string(),
            short_id: "".to_string(),
            fingerprint: "chrome".to_string(),
            service_name: "".to_string(),
            alter_id,
            cipher,
            raw_config: uri_str.to_string(),
            ping_ms: -1,
            created_at: chrono::Utc::now().timestamp_millis(),
        })
    }

    fn parse_trojan(uri_str: &str) -> Option<ProxyConfig> {
        let url = Url::parse(uri_str).ok()?;
        let password = url.username().to_string();
        let host = url.host_str()?.to_string();
        let port = url.port().unwrap_or(443);

        if password.is_empty() || host.is_empty() {
            return None;
        }

        let fragment = url.fragment().unwrap_or("");
        let name = if !fragment.is_empty() {
            urlencoding_decode(fragment)
        } else {
            format!("ZeroTrace Trojan ({host})")
        };

        let mut network = "tcp".to_string();
        let mut sni = host.clone();
        let mut path = "".to_string();
        let mut security = "tls".to_string();

        for (k, v) in url.query_pairs() {
            match k.as_ref() {
                "type" => network = v.to_string(),
                "sni" | "peer" => sni = v.to_string(),
                "path" => path = v.to_string(),
                "security" => security = v.to_string(),
                _ => {}
            }
        }

        Some(ProxyConfig {
            id: Uuid::new_v4().to_string(),
            name,
            protocol: ProxyProtocol::Trojan,
            server: host,
            port,
            uuid: password,
            security,
            network,
            sni,
            path,
            flow: "".to_string(),
            public_key: "".to_string(),
            short_id: "".to_string(),
            fingerprint: "chrome".to_string(),
            service_name: "".to_string(),
            alter_id: 0,
            cipher: "auto".to_string(),
            raw_config: uri_str.to_string(),
            ping_ms: -1,
            created_at: chrono::Utc::now().timestamp_millis(),
        })
    }

    fn parse_shadowsocks(uri_str: &str) -> Option<ProxyConfig> {
        let without_scheme = uri_str.get(5..)?;
        let parts: Vec<&str> = without_scheme.splitn(2, '#').collect();
        let main_part = parts[0];
        let fragment = if parts.len() > 1 { urlencoding_decode(parts[1]) } else { "".to_string() };

        let mut cipher = "aes-256-gcm".to_string();
        let mut password = "".to_string();
        let mut host = "".to_string();
        let mut port = 8388;

        if main_part.contains('@') {
            let at_split: Vec<&str> = main_part.splitn(2, '@').collect();
            let user_part = at_split[0];
            let host_port = at_split[1];

            let decoded_user = decode_base64_loose(user_part).unwrap_or_else(|| user_part.to_string());
            if decoded_user.contains(':') {
                let auth_split: Vec<&str> = decoded_user.splitn(2, ':').collect();
                cipher = auth_split[0].to_string();
                password = auth_split[1].to_string();
            } else {
                password = decoded_user;
            }

            if let Ok(fake_url) = Url::parse(&format!("http://{host_port}")) {
                host = fake_url.host_str().unwrap_or("").to_string();
                port = fake_url.port().unwrap_or(8388);
            }
        } else {
            let decoded = decode_base64_loose(main_part)?;
            if let Ok(fake_url) = Url::parse(&format!("ss://{decoded}")) {
                if let Some(pw) = fake_url.password() {
                    cipher = urlencoding_decode(fake_url.username());
                    password = urlencoding_decode(pw);
                } else {
                    let user_info = fake_url.username();
                    if user_info.contains(':') {
                        let auth_split: Vec<&str> = user_info.splitn(2, ':').collect();
                        cipher = auth_split[0].to_string();
                        password = auth_split[1].to_string();
                    } else {
                        password = user_info.to_string();
                    }
                }
                host = fake_url.host_str().unwrap_or("").to_string();
                port = fake_url.port().unwrap_or(8388);
            }
        }

        if host.is_empty() {
            return None;
        }

        let name = if !fragment.is_empty() {
            fragment
        } else {
            format!("ZeroTrace Shadowsocks ({host})")
        };

        Some(ProxyConfig {
            id: Uuid::new_v4().to_string(),
            name,
            protocol: ProxyProtocol::Shadowsocks,
            server: host,
            port,
            uuid: password,
            security: "none".to_string(),
            network: "tcp".to_string(),
            sni: "".to_string(),
            path: "".to_string(),
            flow: "".to_string(),
            public_key: "".to_string(),
            short_id: "".to_string(),
            fingerprint: "chrome".to_string(),
            service_name: "".to_string(),
            alter_id: 0,
            cipher,
            raw_config: uri_str.to_string(),
            ping_ms: -1,
            created_at: chrono::Utc::now().timestamp_millis(),
        })
    }

    fn parse_custom_json(json_str: &str) -> Option<ProxyConfig> {
        let val: Value = serde_json::from_str(json_str).ok()?;
        let first_outbound = val.get("outbounds")?.as_array()?.first()?;
        let protocol_str = first_outbound.get("protocol")?.as_str()?.to_lowercase();
        let tag = first_outbound.get("tag").and_then(|v| v.as_str()).unwrap_or("ZeroTrace Custom Xray");

        let protocol = match protocol_str.as_str() {
            "vless" => ProxyProtocol::Vless,
            "vmess" => ProxyProtocol::Vmess,
            "trojan" => ProxyProtocol::Trojan,
            "shadowsocks" => ProxyProtocol::Shadowsocks,
            _ => ProxyProtocol::CustomJson,
        };

        let (server, port, uuid) = Self::extract_endpoint_from_outbound(first_outbound);

        Some(ProxyConfig {
            id: Uuid::new_v4().to_string(),
            name: tag.to_string(),
            protocol,
            server,
            port,
            uuid,
            security: "none".to_string(),
            network: "tcp".to_string(),
            sni: "".to_string(),
            path: "".to_string(),
            flow: "".to_string(),
            public_key: "".to_string(),
            short_id: "".to_string(),
            fingerprint: "chrome".to_string(),
            service_name: "".to_string(),
            alter_id: 0,
            cipher: "auto".to_string(),
            raw_config: json_str.to_string(),
            ping_ms: -1,
            created_at: chrono::Utc::now().timestamp_millis(),
        })
    }

    /// Best-effort extraction of the real (server, port, secret) from a pasted
    /// custom outbound so the Configs list and ping features show something
    /// meaningful instead of a hardcoded "Custom Endpoint" placeholder.
    /// Supports both Xray-style outbounds (`settings.vnext`/`settings.servers`)
    /// and sing-box-style outbounds (top-level `server`/`server_port`).
    fn extract_endpoint_from_outbound(ob: &Value) -> (String, u16, String) {
        // Xray-style VLESS/VMess: settings.vnext[0]
        if let Some(entry) = ob
            .get("settings")
            .and_then(|s| s.get("vnext"))
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
        {
            let addr = entry.get("address").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if !addr.is_empty() {
                let port = entry.get("port").and_then(|v| v.as_u64()).unwrap_or(443) as u16;
                let secret = entry
                    .get("users")
                    .and_then(|u| u.as_array())
                    .and_then(|a| a.first())
                    .and_then(|u| u.get("id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                return (addr, port, secret);
            }
        }

        // Xray-style Trojan/Shadowsocks: settings.servers[0]
        if let Some(entry) = ob
            .get("settings")
            .and_then(|s| s.get("servers"))
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
        {
            let addr = entry.get("address").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if !addr.is_empty() {
                let port = entry.get("port").and_then(|v| v.as_u64()).unwrap_or(443) as u16;
                let secret = entry.get("password").and_then(|v| v.as_str()).unwrap_or("").to_string();
                return (addr, port, secret);
            }
        }

        // sing-box-style outbound: top-level server / server_port / uuid|password
        let addr = ob.get("server").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if !addr.is_empty() {
            let port = ob.get("server_port").and_then(|v| v.as_u64()).unwrap_or(443) as u16;
            let secret = ob
                .get("uuid")
                .and_then(|v| v.as_str())
                .or_else(|| ob.get("password").and_then(|v| v.as_str()))
                .unwrap_or("")
                .to_string();
            return (addr, port, secret);
        }

        ("Custom Endpoint".to_string(), 443, "".to_string())
    }
}

fn decode_base64_loose(input: &str) -> Option<String> {
    let mut clean = input.replace('-', "+").replace('_', "/");
    let pad = (4 - clean.len() % 4) % 4;
    for _ in 0..pad {
        clean.push('=');
    }
    let bytes = STANDARD.decode(clean).ok()?;
    String::from_utf8(bytes).ok()
}

fn urlencoding_decode(input: &str) -> String {
    url::form_urlencoded::parse(input.as_bytes())
        .map(|(k, _)| k.to_string())
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_vless_reality() {
        let uri = "vless://a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d@sg.novalink.lk:443?security=reality&type=tcp&flow=xtls-rprx-vision&sni=www.microsoft.com&pbk=fake_pbk_123&sid=8a9b0c1d&fp=chrome#ZeroTrace%20Singapore";
        let parsed = ConfigParser::parse_single(uri).expect("Should parse VLESS link");
        assert_eq!(parsed.name, "ZeroTrace Singapore");
        assert_eq!(parsed.protocol, ProxyProtocol::Vless);
        assert_eq!(parsed.server, "sg.novalink.lk");
        assert_eq!(parsed.port, 443);
        assert_eq!(parsed.uuid, "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d");
        assert_eq!(parsed.security, "reality");
        assert_eq!(parsed.network, "tcp");
        assert_eq!(parsed.flow, "xtls-rprx-vision");
        assert_eq!(parsed.sni, "www.microsoft.com");
        assert_eq!(parsed.public_key, "fake_pbk_123");
        assert_eq!(parsed.short_id, "8a9b0c1d");
        assert_eq!(parsed.fingerprint, "chrome");
    }

    #[test]
    fn test_parse_trojan() {
        let uri = "trojan://secretpassword@jp.novalink.lk:443?type=ws&sni=jp.novalink.lk&path=%2Ftrojan-ws#ZeroTrace%20Tokyo";
        let parsed = ConfigParser::parse_single(uri).expect("Should parse Trojan link");
        assert_eq!(parsed.name, "ZeroTrace Tokyo");
        assert_eq!(parsed.protocol, ProxyProtocol::Trojan);
        assert_eq!(parsed.server, "jp.novalink.lk");
        assert_eq!(parsed.port, 443);
        assert_eq!(parsed.uuid, "secretpassword");
        assert_eq!(parsed.network, "ws");
        assert_eq!(parsed.path, "/trojan-ws");
        assert_eq!(parsed.sni, "jp.novalink.lk");
    }

    #[test]
    fn test_parse_vmess() {
        // {"add":"us.novalink.lk","port":443,"id":"11223344-5566-7788-9900-aabbccddeeff","aid":0,"net":"ws","path":"/vmess","tls":"tls","ps":"ZeroTrace US"}
        let b64 = "eyJhZGQiOiJ1cy5ub3ZhbGluay5sayIsInBvcnQiOjQ0MywiaWQiOiIxMTIyMzM0NC01NTY2LTc3ODgtOTkwMC1hYWJiY2NkZGVlZmYiLCJhaWQiOjAsIm5ldCI6IndzIiwicGF0aCI6Ii92bWVzcyIsInRscyI6InRscyIsInBzIjoiWmVyb1RyYWNlIFVTIn0=";
        let uri = format!("vmess://{}", b64);
        let parsed = ConfigParser::parse_single(&uri).expect("Should parse VMess link");
        assert_eq!(parsed.name, "ZeroTrace US");
        assert_eq!(parsed.protocol, ProxyProtocol::Vmess);
        assert_eq!(parsed.server, "us.novalink.lk");
        assert_eq!(parsed.port, 443);
        assert_eq!(parsed.uuid, "11223344-5566-7788-9900-aabbccddeeff");
        assert_eq!(parsed.network, "ws");
        assert_eq!(parsed.path, "/vmess");
        assert_eq!(parsed.security, "tls");
    }

    #[test]
    fn test_parse_shadowsocks() {
        let uri = "ss://YWVzLTI1Ni1nY206cGFzc3dvcmRAMTkyLjE2OC4xLjEwMDo4Mzg4#ZeroTrace%20SS";
        let parsed = ConfigParser::parse_single(uri).expect("Should parse Shadowsocks link");
        assert_eq!(parsed.name, "ZeroTrace SS");
        assert_eq!(parsed.protocol, ProxyProtocol::Shadowsocks);
        assert_eq!(parsed.server, "192.168.1.100");
        assert_eq!(parsed.port, 8388);
        assert_eq!(parsed.cipher, "aes-256-gcm");
        assert_eq!(parsed.uuid, "password");
    }

    #[test]
    fn test_parse_from_caption() {
        let caption = "Check out this fast link:\nvless://a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d@sg.novalink.lk:443?security=reality&type=tcp#SG-01\nEnjoy streaming!";
        let parsed = ConfigParser::parse_single(caption).expect("Should extract embedded URI from caption");
        assert_eq!(parsed.protocol, ProxyProtocol::Vless);
        assert_eq!(parsed.name, "SG-01");
    }

    #[test]
    fn test_parse_vless_flow_none() {
        let uri = "vless://1c803087-b9f6-4be8-bedc-ab3c541d3970@node1.novalink.lk:443?security=tls&flow=none&type=tcp#TestFlowNone";
        let parsed = ConfigParser::parse_single(uri).expect("Should parse VLESS");
        assert_eq!(parsed.flow, "");
    }
}
