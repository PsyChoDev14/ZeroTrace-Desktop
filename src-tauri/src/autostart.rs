use std::path::PathBuf;

/// Configure whether ZeroTrace launches automatically upon system startup / user login.
pub fn set_autostart(enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = exe.to_string_lossy().to_string();

        if enable {
            let mut cmd = std::process::Command::new("reg");
            cmd.args(&[
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "ZeroTrace",
                "/t",
                "REG_SZ",
                "/d",
                &format!("\"{}\"", exe_str),
                "/f",
            ]);
            cmd.creation_flags(CREATE_NO_WINDOW);
            let status = cmd.status().map_err(|e| e.to_string())?;
            if !status.success() {
                return Err(format!("Failed to register Windows startup registry key (exit code: {:?})", status.code()));
            }
        } else {
            let mut cmd = std::process::Command::new("reg");
            cmd.args(&[
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "ZeroTrace",
                "/f",
            ]);
            cmd.creation_flags(CREATE_NO_WINDOW);
            let _ = cmd.status();
        }
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        let launch_agents_dir = PathBuf::from(home).join("Library/LaunchAgents");
        let plist_path = launch_agents_dir.join("lk.novalink.zerotrace.desktop.plist");

        if enable {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let _ = std::fs::create_dir_all(&launch_agents_dir);
            let plist_content = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>lk.novalink.zerotrace.desktop</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
"#,
                exe.to_string_lossy()
            );
            std::fs::write(&plist_path, plist_content).map_err(|e| e.to_string())?;
        } else {
            if plist_path.exists() {
                let _ = std::fs::remove_file(plist_path);
            }
        }
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Ok(home) = std::env::var("HOME") {
            let autostart_dir = PathBuf::from(home).join(".config/autostart");
            let desktop_file = autostart_dir.join("zerotrace.desktop");
            if enable {
                if let Ok(exe) = std::env::current_exe() {
                    let _ = std::fs::create_dir_all(&autostart_dir);
                    let content = format!(
                        "[Desktop Entry]\nType=Application\nName=ZeroTrace\nExec={}\nTerminal=false\n",
                        exe.to_string_lossy()
                    );
                    let _ = std::fs::write(desktop_file, content);
                }
            } else if desktop_file.exists() {
                let _ = std::fs::remove_file(desktop_file);
            }
        }
        Ok(())
    }
}

/// Check whether ZeroTrace is currently configured to launch at startup.
pub fn is_autostart_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let mut cmd = std::process::Command::new("reg");
        cmd.args(&[
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
            "/v",
            "ZeroTrace",
        ]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        if let Ok(output) = cmd.output() {
            output.status.success()
        } else {
            false
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let plist_path = PathBuf::from(home).join("Library/LaunchAgents/lk.novalink.zerotrace.desktop.plist");
            plist_path.exists()
        } else {
            false
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Ok(home) = std::env::var("HOME") {
            let desktop_file = PathBuf::from(home).join(".config/autostart/zerotrace.desktop");
            desktop_file.exists()
        } else {
            false
        }
    }
}
