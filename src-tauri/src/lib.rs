pub mod commands;
pub mod models;
pub mod parser;
pub mod ping;
pub mod singbox;
pub mod storage;
pub mod tun;
pub mod xray;

use std::sync::Arc;
use parking_lot::Mutex;
use tauri::Manager;

use commands::*;
use models::*;
use storage::StorageManager;
use tun::TunManager;
use xray::XrayProcess;

pub fn run() {
    let app_builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle();
            let app_data_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| {
                std::env::current_dir().unwrap_or_default().join(".zerotrace")
            });

            let storage = StorageManager::new(app_data_dir);
            let configs = storage.load_configs();
            let mut selected_id = storage.load_selected_id();
            let settings = storage.load_settings();

            // Clean startup with no dummy configs
            if selected_id.is_none() && !configs.is_empty() {
                selected_id = Some(configs[0].id.clone());
            }

            // Clean up any stale system proxy leftover from a previous crash or sudden reboot
            TunManager::cleanup_stale_proxies();

            let initial_context = AppContext {
                vpn_state: VpnState {
                    status: "disconnected".to_string(),
                    server_name: None,
                    server_address: None,
                    connected_at: None,
                    error_message: None,
                },
                configs,
                selected_id,
                settings,
                traffic_stats: TrafficStats::default(),
                last_stats_poll: None,
                last_octets: None,
                logs: vec![
                    DiagnosticLog {
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        level: "INFO".to_string(),
                        tag: "ZeroTrace-Core".to_string(),
                        message: "Desktop PC Engine initialized. High-performance proxy pipeline ready.".to_string(),
                    },
                ],
                tun_manager: TunManager::new(),
                xray_process: XrayProcess::new(),
                storage,
            };

            let shared_state: SharedState = Arc::new(Mutex::new(initial_context));
            app.manage(shared_state);

            // Setup System Tray / Menu Bar Status Icon
            use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
            use tauri::menu::{Menu, MenuItem};

            let show_i = MenuItem::with_id(app, "show", "Open ZeroTrace", true, None::<&str>)?;
            let toggle_i = MenuItem::with_id(app, "toggle", "Connect / Disconnect", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit ZeroTrace", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &toggle_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("ZeroTrace VPN")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                        "toggle" => {
                            let state_arc = app.state::<SharedState>().inner().clone();
                            let status = state_arc.lock().vpn_state.status.clone();
                            if status == "connected" {
                                do_disconnect(state_arc);
                            } else {
                                let first_id = state_arc.lock().selected_id.clone()
                                    .or_else(|| state_arc.lock().configs.first().map(|c| c.id.clone()));
                                tokio::spawn(async move {
                                    let _ = do_connect(first_id, state_arc).await;
                                });
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _ = tray_builder.build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            connect,
            disconnect,
            get_configs,
            get_selected_config_id,
            select_config,
            save_config,
            delete_config,
            ping_config,
            ping_all,
            parse_config,
            get_settings,
            save_settings,
            get_logs,
            clear_logs,
            get_traffic_stats,
            window_minimize,
            window_maximize,
            window_close,
            download_and_install_update,
            open_url,
            export_diagnostic_report,
        ]);

    app_builder
        .run(tauri::generate_context!())
        .expect("error while running ZeroTrace desktop application");
}
