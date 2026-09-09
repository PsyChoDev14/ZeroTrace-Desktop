use std::fs;
use std::path::{Path, PathBuf};
use crate::models::{AppSettings, ProxyConfig};

pub struct StorageManager {
    data_dir: PathBuf,
}

impl StorageManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&app_data_dir);
        Self { data_dir: app_data_dir }
    }

    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    // Configs
    pub fn load_configs(&self) -> Vec<ProxyConfig> {
        let path = self.data_dir.join("configs.json");
        if let Ok(content) = fs::read_to_string(path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    pub fn save_configs(&self, configs: &[ProxyConfig]) -> Result<(), String> {
        let path = self.data_dir.join("configs.json");
        let content = serde_json::to_string_pretty(configs).map_err(|e| e.to_string())?;
        fs::write(path, content).map_err(|e| e.to_string())
    }

    // Selected config ID
    pub fn load_selected_id(&self) -> Option<String> {
        let path = self.data_dir.join("selected_id.txt");
        fs::read_to_string(path).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
    }

    pub fn save_selected_id(&self, id: Option<&str>) -> Result<(), String> {
        let path = self.data_dir.join("selected_id.txt");
        if let Some(id_str) = id {
            fs::write(path, id_str).map_err(|e| e.to_string())
        } else {
            let _ = fs::remove_file(path);
            Ok(())
        }
    }

    // Settings
    pub fn load_settings(&self) -> AppSettings {
        let path = self.data_dir.join("settings.json");
        if let Ok(content) = fs::read_to_string(path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            AppSettings::default()
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), String> {
        let path = self.data_dir.join("settings.json");
        let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
        fs::write(path, content).map_err(|e| e.to_string())
    }
}
