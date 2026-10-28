use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, Window, WindowEvent,
};

const TRAY_ID: &str = "dino-lab-main-tray";
static NEXT_TEMPORARY: AtomicU64 = AtomicU64::new(0);

#[derive(Clone)]
pub struct DesktopPreferences(Arc<PreferenceState>);

struct PreferenceState {
    enabled: AtomicBool,
    path: Option<PathBuf>,
    writer: Mutex<()>,
}

fn load_enabled(path: Option<&Path>) -> bool {
    path.and_then(|path| fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
        .and_then(|value| value.get("closeToTray").and_then(|value| value.as_bool()))
        .unwrap_or(true)
}

fn temporary_file(parent: &Path) -> io::Result<(PathBuf, File)> {
    for _ in 0..10 {
        let sequence = NEXT_TEMPORARY.fetch_add(1, Ordering::Relaxed);
        let path = parent.join(format!(
            ".desktop-preferences-{}-{sequence}.tmp",
            std::process::id()
        ));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }
    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "Could not reserve a settings file",
    ))
}

fn persist_enabled(path: &Path, enabled: bool) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "Missing settings folder"))?;
    fs::create_dir_all(parent)?;
    let mut object = match fs::read(path) {
        Ok(bytes) => serde_json::from_slice::<serde_json::Value>(&bytes)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default(),
        Err(error) if error.kind() == io::ErrorKind::NotFound => serde_json::Map::new(),
        Err(error) => return Err(error),
    };
    object.insert("closeToTray".into(), serde_json::Value::Bool(enabled));
    let bytes = serde_json::to_vec_pretty(&object).map_err(io::Error::other)?;
    let (temporary, mut file) = temporary_file(parent)?;
    let write_result = file.write_all(&bytes).and_then(|_| file.sync_all());
    drop(file); // Windows must release the temporary file before replacement.
    let result = write_result.and_then(|_| fs::rename(&temporary, path));
    if result.is_err() {
        // Only remove the exact temporary file created above; never delete or
        // truncate the existing preference as a rename fallback.
        let _ = fs::remove_file(&temporary);
    }
    result
}

impl DesktopPreferences {
    fn load(path: Option<PathBuf>) -> Self {
        let enabled = load_enabled(path.as_deref());
        Self(Arc::new(PreferenceState {
            enabled: AtomicBool::new(enabled),
            path,
            writer: Mutex::new(()),
        }))
    }

    fn enabled(&self) -> bool {
        self.0.enabled.load(Ordering::Acquire)
    }

    fn save(&self, enabled: bool) -> Result<bool, String> {
        let _writer = self.0.writer.lock().map_err(|_| {
            "The desktop preference could not be saved. Please reopen Dino Lab.".to_string()
        })?;
        let path = self
            .0
            .path
            .as_deref()
            .ok_or_else(|| "The desktop preferences folder is unavailable.".to_string())?;
        persist_enabled(path, enabled)
            .map_err(|error| format!("Could not save Minimize on close: {error}"))?;
        self.0.enabled.store(enabled, Ordering::Release);
        Ok(enabled)
    }
}

#[tauri::command]
pub fn get_close_to_tray(preferences: State<'_, DesktopPreferences>) -> bool {
    preferences.enabled()
}

#[tauri::command]
pub async fn set_close_to_tray(
    enabled: bool,
    preferences: State<'_, DesktopPreferences>,
) -> Result<bool, String> {
    let preferences = preferences.inner().clone();
    tauri::async_runtime::spawn_blocking(move || preferences.save(enabled))
        .await
        .map_err(|error| format!("Could not save Minimize on close: {error}"))?
}

/// Used by tray events and the single-instance callback. No page reload or
/// new window is created, so the current research session remains intact.
pub fn restore_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn create_tray(app: &tauri::App) -> Result<(), String> {
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "The application icon is unavailable.".to_string())?;
    let open = MenuItem::with_id(app, "open-dino-lab", "Open Dino Lab", true, None::<&str>)
        .map_err(|error| error.to_string())?;
    let exit = MenuItem::with_id(app, "exit-dino-lab", "Exit Dino Lab", true, None::<&str>)
        .map_err(|error| error.to_string())?;
    let menu = Menu::with_items(app, &[&open, &exit]).map_err(|error| error.to_string())?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("Dino Lab")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open-dino-lab" => restore_main(app),
            "exit-dino-lab" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            }
            | TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } => restore_main(tray.app_handle()),
            _ => {}
        })
        .build(app)
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub fn initialize(app: &mut tauri::App) {
    let path = app
        .path()
        .app_config_dir()
        .ok()
        .map(|directory| directory.join("desktop-preferences.json"));
    app.manage(DesktopPreferences::load(path));
    if let Err(error) = create_tray(app) {
        // Startup remains usable; an unavailable tray means normal close.
        eprintln!("Dino Lab tray unavailable; close will exit normally: {error}");
    }
}

fn prevent_close_when_safe<E>(
    label: &str,
    enabled: bool,
    tray_available: impl FnOnce() -> bool,
    hide: impl FnOnce() -> Result<(), E>,
) -> bool {
    label == "main" && enabled && tray_available() && hide().is_ok()
}

pub fn on_window_event(window: &Window, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };
    let enabled = window
        .app_handle()
        .try_state::<DesktopPreferences>()
        .map(|preferences| preferences.enabled())
        .unwrap_or(false);
    let should_prevent = prevent_close_when_safe(
        window.label(),
        enabled,
        || {
            // On Windows tray construction can succeed before Shell_NotifyIcon
            // registration succeeds. A shell-known rectangle proves the icon is
            // actually available, including after Explorer re-registers it.
            window
                .app_handle()
                .tray_by_id(TRAY_ID)
                .and_then(|tray| tray.rect().ok().flatten())
                .is_some()
        },
        || window.hide(),
    );
    if should_prevent {
        api.prevent_close();
    }
    // Never intercept ExitRequested: the explicit tray Exit must always exit.
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDirectory {
        root: PathBuf,
        directory: PathBuf,
    }
    impl TestDirectory {
        fn new() -> Self {
            let root = std::env::temp_dir().canonicalize().unwrap();
            let directory = root.join(format!(
                "dino-lab-close-tray-test-{}-{}",
                std::process::id(),
                NEXT_TEMPORARY.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&directory).unwrap();
            Self { root, directory }
        }
        fn file(&self) -> PathBuf {
            self.directory.join("desktop-preferences.json")
        }
    }
    impl Drop for TestDirectory {
        fn drop(&mut self) {
            // Confirm the resolved, task-created temporary directory is still
            // directly inside the intended temp root before recursive cleanup.
            if self.directory.parent() == Some(self.root.as_path())
                && self.directory.file_name().is_some_and(|name| {
                    name.to_string_lossy()
                        .starts_with("dino-lab-close-tray-test-")
                })
            {
                let _ = fs::remove_dir_all(&self.directory);
            }
        }
    }

    #[test]
    fn enabled_by_default_and_false_survives_reload() {
        let directory = TestDirectory::new();
        let path = directory.file();
        let preferences = DesktopPreferences::load(Some(path.clone()));
        assert!(preferences.enabled());
        assert_eq!(preferences.save(false).unwrap(), false);
        assert!(!preferences.enabled());
        assert!(!DesktopPreferences::load(Some(path.clone())).enabled());
        assert_eq!(preferences.save(true).unwrap(), true);
        assert!(DesktopPreferences::load(Some(path)).enabled());
    }

    #[test]
    fn invalid_or_missing_values_use_enabled_default() {
        let directory = TestDirectory::new();
        let path = directory.file();
        for bytes in [
            "not JSON",
            "{}",
            r#"{"closeToTray":"false"}"#,
            r#"{"closeToTray":null}"#,
        ] {
            fs::write(&path, bytes).unwrap();
            assert!(DesktopPreferences::load(Some(path.clone())).enabled());
        }
        assert!(DesktopPreferences::load(None).enabled());
    }

    #[test]
    fn saving_preserves_unrelated_preferences() {
        let directory = TestDirectory::new();
        let path = directory.file();
        fs::write(&path, r#"{"closeToTray":false,"otherSetting":42}"#).unwrap();
        let preferences = DesktopPreferences::load(Some(path.clone()));
        assert!(!preferences.enabled());
        preferences.save(true).unwrap();
        let saved: serde_json::Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
        assert_eq!(saved["otherSetting"], 42);
        assert_eq!(saved["closeToTray"], true);
    }

    #[test]
    fn failed_save_does_not_change_runtime_or_existing_file() {
        let directory = TestDirectory::new();
        let blocker = directory.directory.join("not-a-directory");
        fs::write(&blocker, b"preserve me").unwrap();
        let preferences = DesktopPreferences::load(Some(blocker.join("desktop-preferences.json")));
        assert!(preferences.save(false).is_err());
        assert!(preferences.enabled());
        assert_eq!(fs::read(&blocker).unwrap(), b"preserve me");
        let unavailable = DesktopPreferences::load(None);
        assert!(unavailable.save(false).is_err());
        assert!(unavailable.enabled());
    }

    #[cfg(windows)]
    #[test]
    fn failed_windows_replacement_preserves_previous_saved_value() {
        let directory = TestDirectory::new();
        let path = directory.file();
        let preferences = DesktopPreferences::load(Some(path.clone()));
        preferences.save(false).unwrap();
        let before = fs::read(&path).unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();
        let result = preferences.save(true);
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(&path, permissions).unwrap();
        assert!(result.is_err());
        assert!(!preferences.enabled());
        assert_eq!(fs::read(&path).unwrap(), before);
        assert_eq!(fs::read_dir(&directory.directory).unwrap().count(), 1);
    }

    #[test]
    fn concurrent_saves_keep_memory_and_disk_consistent() {
        let directory = TestDirectory::new();
        let path = directory.file();
        let preferences = DesktopPreferences::load(Some(path.clone()));
        let workers: Vec<_> = (0..8)
            .map(|index| {
                let preferences = preferences.clone();
                std::thread::spawn(move || preferences.save(index % 2 == 0).unwrap())
            })
            .collect();
        for worker in workers {
            worker.join().unwrap();
        }
        assert_eq!(
            preferences.enabled(),
            DesktopPreferences::load(Some(path)).enabled()
        );
    }

    #[test]
    fn close_is_prevented_only_when_main_enabled_tray_ready_and_hide_succeeds() {
        for (label, enabled, tray_available) in [
            ("secondary", true, true),
            ("main", false, true),
            ("main", true, false),
        ] {
            let called = std::cell::Cell::new(false);
            assert!(!prevent_close_when_safe(
                label,
                enabled,
                || tray_available,
                || {
                    called.set(true);
                    Ok::<(), ()>(())
                }
            ));
            assert!(!called.get());
        }
        assert!(!prevent_close_when_safe(
            "main",
            true,
            || true,
            || Err::<(), ()>(())
        ));
        assert!(prevent_close_when_safe(
            "main",
            true,
            || true,
            || Ok::<(), ()>(())
        ));
    }
}
