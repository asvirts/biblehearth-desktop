mod storage;
mod window;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use storage::{Annotation, AppState, ImportSummary, Location, Preferences};
use tauri::menu::{Menu, MenuItem, MenuItemKind};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

struct Database(Mutex<rusqlite::Connection>);
struct Diagnostics(Mutex<Option<sentry::ClientInitGuard>>);
struct ExitAuthorization(AtomicBool);
fn database_error() -> String {
    "storage_unavailable".into()
}
fn configure_diagnostics(diagnostics: &Diagnostics, enabled: bool) {
    let Ok(mut guard) = diagnostics.0.lock() else {
        return;
    };
    if !enabled {
        if let Some(client) = guard.take() {
            client.close(None);
        }
        return;
    }
    if guard.is_some() {
        return;
    }
    // Both values must be explicitly provided by the owner's personal project.
    if option_env!("BIBLEHEARTH_SENTRY_ACCOUNT") == Some("personal") {
        if let Some(dsn) = option_env!("BIBLEHEARTH_SENTRY_DSN") {
            *guard = Some(sentry::init((
                dsn,
                sentry::ClientOptions {
                    send_default_pii: false,
                    attach_stacktrace: false,
                    traces_sample_rate: 0.0,
                    before_send: Some(std::sync::Arc::new(|event| {
                        // Do not transmit arbitrary panic/error strings, breadcrumbs, paths or locals.
                        if !matches!(
                            event.message.as_deref(),
                            Some(
                                "BibleHearth native diagnostic test"
                                    | "BibleHearth native storage error"
                                    | "BibleHearth native error"
                            )
                        ) {
                            return None;
                        }
                        Some(sentry::protocol::Event {
                            message: event.message,
                            level: event.level,
                            ..Default::default()
                        })
                    })),
                    ..Default::default()
                },
            )));
        }
    }
}
#[tauri::command]
fn load_state(db: State<Database>) -> Result<AppState, String> {
    storage::load(&*db.0.lock().map_err(|_| database_error())?)
}
#[tauri::command]
fn save_preferences(
    preferences: Preferences,
    db: State<Database>,
    diagnostics: State<Diagnostics>,
) -> Result<AppState, String> {
    preferences.validate()?;
    let c = db.0.lock().map_err(|_| database_error())?;
    storage::setting(&c, "preferences", &preferences)?;
    configure_diagnostics(&diagnostics, preferences.crash_reports);
    storage::load(&c)
}
#[tauri::command]
fn save_location(location: Location, db: State<Database>) -> Result<AppState, String> {
    location.validate()?;
    let c = db.0.lock().map_err(|_| database_error())?;
    storage::setting(&c, "location", &location)?;
    storage::load(&c)
}
#[tauri::command]
fn upsert_annotation(annotation: Annotation, db: State<Database>) -> Result<AppState, String> {
    let c = db.0.lock().map_err(|_| database_error())?;
    storage::upsert(&c, &annotation)?;
    storage::load(&c)
}
#[tauri::command]
fn delete_annotation(id: String, db: State<Database>) -> Result<AppState, String> {
    let c = db.0.lock().map_err(|_| database_error())?;
    storage::delete(&c, &id)?;
    storage::load(&c)
}
#[tauri::command]
fn export_backup(db: State<Database>) -> Result<String, String> {
    storage::export(&*db.0.lock().map_err(|_| database_error())?)
}
#[tauri::command]
fn import_backup(json: String, db: State<Database>) -> Result<ImportSummary, String> {
    storage::import(&mut *db.0.lock().map_err(|_| database_error())?, &json)
}
#[tauri::command]
async fn export_backup_file(app: tauri::AppHandle) -> Result<bool, String> {
    let Some(file) = app
        .dialog()
        .file()
        .add_filter("BibleHearth backup", &["json"])
        .set_file_name("biblehearth-backup.json")
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = file.into_path().map_err(|_| "invalid_backup_path")?;
    let json = storage::export(
        &*app
            .state::<Database>()
            .0
            .lock()
            .map_err(|_| database_error())?,
    )?;
    std::fs::write(path, json).map_err(|_| "backup_write_failed")?;
    Ok(true)
}
#[tauri::command]
async fn import_backup_file(app: tauri::AppHandle) -> Result<Option<ImportSummary>, String> {
    let Some(file) = app
        .dialog()
        .file()
        .add_filter("BibleHearth backup", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = file.into_path().map_err(|_| "invalid_backup_path")?;
    let meta = std::fs::metadata(&path).map_err(|_| "backup_read_failed")?;
    if meta.len() > 25_000_000 {
        return Err("backup_too_large".into());
    }
    let json = std::fs::read_to_string(path).map_err(|_| "backup_read_failed")?;
    let db = app.state::<Database>();
    let mut c = db.0.lock().map_err(|_| database_error())?;
    Ok(Some(storage::import(&mut c, &json)?))
}
#[tauri::command]
fn native_diagnostic_test(diagnostics: State<Diagnostics>) -> Result<(), String> {
    if diagnostics
        .0
        .lock()
        .map_err(|_| "diagnostics_unavailable")?
        .is_none()
    {
        return Err("diagnostics_not_enabled".into());
    }
    sentry::capture_message("BibleHearth native diagnostic test", sentry::Level::Info);
    Ok(())
}
#[tauri::command]
fn set_crash_reporting(
    enabled: bool,
    db: State<Database>,
    diagnostics: State<Diagnostics>,
) -> Result<(), String> {
    let c = db.0.lock().map_err(|_| database_error())?;
    let mut prefs = storage::load(&c)?.preferences;
    prefs.crash_reports = enabled;
    storage::setting(&c, "preferences", &prefs)?;
    configure_diagnostics(&diagnostics, enabled);
    Ok(())
}
#[tauri::command]
fn installation_kind() -> &'static str {
    if cfg!(target_os = "linux") {
        if std::env::var_os("APPIMAGE").is_some() {
            "appimage"
        } else {
            "deb"
        }
    } else {
        "native"
    }
}

#[tauri::command]
fn finish_exit(app: tauri::AppHandle, authorization: State<ExitAuthorization>) {
    // The frontend calls this only after note autosave and the storage queue drain.
    authorization.0.store(true, Ordering::SeqCst);
    app.exit(0);
}

pub fn run() {
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        sentry::capture_message("BibleHearth native error", sentry::Level::Error);
        // Keep local debug diagnostics usable; telemetry remains a fixed sanitized event.
        if cfg!(debug_assertions) {
            previous_hook(info);
        }
    }));
    tauri::Builder::default()
        .menu(|app| {
            let menu = Menu::default(app)?;
            let quit = MenuItem::with_id(
                app,
                "biblehearth.quit",
                "Quit BibleHearth",
                true,
                Some("CmdOrCtrl+Q"),
            )?;
            // Tauri's pinned default places predefined Quit last in the first
            // submenu (Application on macOS, File on Windows). Native macOS
            // terminate: bypasses cancellable exit requests, so replace that item.
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            if let Some(MenuItemKind::Submenu(submenu)) = menu.items()?.first() {
                let count = submenu.items()?.len();
                if count > 0 {
                    submenu.remove_at(count - 1)?;
                }
                submenu.append(&quit)?;
            }
            #[cfg(not(any(target_os = "macos", target_os = "windows")))]
            menu.insert(
                &tauri::menu::Submenu::with_items(app, "File", true, &[&quit])?,
                0,
            )?;
            Ok(menu)
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "biblehearth.quit" {
                if app.get_webview_window("main").is_some() {
                    let _ = app.emit("biblehearth-exit-requested", ());
                } else {
                    app.exit(0);
                }
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Development builds intentionally have no signing key or update feed.
            // Registering the updater without its required config aborts startup.
            if app.config().plugins.0.contains_key("updater") {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let mut conn = rusqlite::Connection::open(dir.join("biblehearth.sqlite3"))?;
            storage::migrate(&mut conn).map_err(std::io::Error::other)?;
            let state = storage::load(&conn).map_err(std::io::Error::other)?;
            let diagnostics = Diagnostics(Mutex::new(None));
            configure_diagnostics(&diagnostics, state.preferences.crash_reports);
            app.manage(Database(Mutex::new(conn)));
            app.manage(diagnostics);
            app.manage(ExitAuthorization(AtomicBool::new(false)));
            if let Some(window) = app.get_webview_window("main") {
                window::show_at_default_size(&window)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_preferences,
            save_location,
            upsert_annotation,
            delete_annotation,
            export_backup,
            import_backup,
            export_backup_file,
            import_backup_file,
            native_diagnostic_test,
            set_crash_reporting,
            installation_kind,
            finish_exit
        ])
        .build(tauri::generate_context!())
        .expect("BibleHearth could not start")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                // Restarts are already flushed by the frontend, and Tauri cannot cancel them.
                if code == Some(tauri::RESTART_EXIT_CODE) {
                    return;
                }
                let authorized = app
                    .try_state::<ExitAuthorization>()
                    .map(|state| state.0.load(Ordering::SeqCst))
                    .unwrap_or(true);
                if !authorized && app.get_webview_window("main").is_some() {
                    api.prevent_exit();
                    let _ = app.emit("biblehearth-exit-requested", ());
                }
            }
        });
}
