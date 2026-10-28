#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sources;
mod updates;
mod window_lifecycle;

use sha2::{Digest, Sha256};

fn main() {
    let context = tauri::generate_context!();
    // Launch this exact executable with --verify-assets <report.json> to
    // inspect its embedded assets without relying on a dev server or UI.
    let args: Vec<String> = std::env::args().collect();
    if let Some(index) = args.iter().position(|arg| arg == "--verify-assets") {
        let Some(report_path) = args.get(index + 1) else {
            std::process::exit(2)
        };
        let index_present = context.assets().get(&"index.html".into()).is_some();
        let manifest = context.assets().get(&".dino-desktop-assets.json".into());
        let manifest =
            manifest.and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok());
        let files = manifest
            .as_ref()
            .and_then(|value| value.get("files"))
            .and_then(|value| value.as_array());
        let missing: Vec<String> = files
            .into_iter()
            .flatten()
            .filter_map(|value| value.get("path").and_then(|path| path.as_str()))
            .filter(|path| context.assets().get(&(*path).into()).is_none())
            .map(String::from)
            .collect();
        let count = files.map(|files| files.len()).unwrap_or(0);
        let mismatched: Vec<String> = files
            .into_iter()
            .flatten()
            .filter_map(|file| {
                let path = file.get("path")?.as_str()?;
                if path == "index.html" {
                    return None;
                } // Tauri injects CSP into HTML.
                let bytes = context.assets().get(&path.into())?;
                let actual = format!("{:x}", Sha256::digest(bytes.as_ref()));
                (file.get("sha256").and_then(|value| value.as_str()) != Some(actual.as_str()))
                    .then(|| path.to_string())
            })
            .collect();
        let passed = index_present && count > 0 && missing.is_empty() && mismatched.is_empty();
        let report = serde_json::json!({"version": env!("CARGO_PKG_VERSION"), "passed": passed, "indexHtml": index_present, "expectedFiles": count, "missing": missing, "hashMismatches": mismatched, "htmlRewrittenByTauri": true});
        if std::fs::write(report_path, serde_json::to_vec_pretty(&report).unwrap()).is_err() {
            std::process::exit(2)
        }
        std::process::exit(if passed { 0 } else { 1 });
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window_lifecycle::restore_main(app);
        }))
        .setup(|app| {
            window_lifecycle::initialize(app);
            Ok(())
        })
        .on_window_event(window_lifecycle::on_window_event)
        .invoke_handler(tauri::generate_handler![
            sources::open_source,
            updates::check_for_updates,
            updates::open_update_release,
            window_lifecycle::get_close_to_tray,
            window_lifecycle::set_close_to_tray
        ])
        .run(context)
        .expect("Dino Lab could not start its desktop window");
}
