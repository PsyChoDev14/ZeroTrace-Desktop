use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ProxyProtocol {
    Vless,
    Vmess,
    Trojan,
    Shadowsocks,
    #[serde(rename = "CUSTOM_JSON")]
    CustomJson,
}

impl ProxyProtocol {
    pub fn display_name(&self) -> &'static str {
        match self {
            ProxyProtocol::Vless => "VLESS",
            ProxyProtocol::Vmess => "VMess",
            ProxyProtocol::Trojan => "Trojan",
            ProxyProtocol::Shadowsocks => "Shadowsocks",
            ProxyProtocol::CustomJson => "Custom JSON",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    pub id: String,
    pub name: String,
    pub protocol: ProxyProtocol,
    pub server: String,
    pub port: u16,
    #[serde(default)]
    pub uuid: String,
    #[serde(default = "default_security")]
    pub security: String,
    #[serde(default = "default_network")]
    pub network: String,
    #[serde(default)]
    pub sni: String,
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub flow: String,
    #[serde(default)]
    pub public_key: String,
    #[serde(default)]
    pub short_id: String,
    #[serde(default = "default_fingerprint")]
    pub fingerprint: String,
    #[serde(default)]
    pub service_name: String,
    #[serde(default)]
    pub alter_id: u32,
    #[serde(default = "default_cipher")]
    pub cipher: String,
    #[serde(default)]
    pub raw_config: String,
    #[serde(default = "default_ping")]
    pub ping_ms: i64,
    #[serde(default = "default_created_at")]
    pub created_at: i64,
}

fn default_security() -> String { "none".to_string() }
fn default_network() -> String { "tcp".to_string() }
fn default_fingerprint() -> String { "chrome".to_string() }
fn default_cipher() -> String { "auto".to_string() }
fn default_ping() -> i64 { -1 }
fn default_created_at() -> i64 { chrono::Utc::now().timestamp_millis() }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VpnState {
    pub status: String, // "disconnected", "connecting", "connected", "stopping", "error"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connected_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum DpiBypassMode {
    Off,
    #[serde(rename = "SMART_FRAGMENT")]
    SmartFragment,
    #[serde(rename = "DEEP_STEALTH")]
    DeepStealth,
    Custom,
}

impl Default for DpiBypassMode {
    fn default() -> Self {
        DpiBypassMode::Off
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub primary_dns: String,
    pub bypass_lan: bool,
    pub sri_lanka_sni_tweak: String,
    pub dpi_bypass_mode: DpiBypassMode,
    pub utls_fingerprint: String,
    pub mux_enabled: bool,
    pub fragment_packets: String,
    pub fragment_length: String,
    pub fragment_interval: String,
    #[serde(default)]
    pub kill_switch: bool,
    pub auto_connect: bool,
    pub minimize_to_tray: bool,
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_theme() -> String { "dark".to_string() }

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            primary_dns: "94.140.14.14".to_string(), // AdGuard
            bypass_lan: true,
            sri_lanka_sni_tweak: "".to_string(),
            dpi_bypass_mode: DpiBypassMode::Off,
            utls_fingerprint: "chrome".to_string(),
            mux_enabled: false,
            fragment_packets: "tlshello".to_string(),
            fragment_length: "10-30".to_string(),
            fragment_interval: "10-20".to_string(),
            kill_switch: false,
            auto_connect: false,
            minimize_to_tray: true,
            theme: "dark".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrafficStats {
    pub download_speed: u64,
    pub upload_speed: u64,
    pub total_downloaded: u64,
    pub total_uploaded: u64,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticLog {
    pub timestamp: String,
    pub level: String,
    pub tag: String,
    pub message: String,
}
