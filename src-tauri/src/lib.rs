mod history;
mod quit;
#[cfg(target_os = "macos")]
mod system_quit;

use tauri::{Manager, RunEvent, WindowEvent};

/// A Force Touch trackpad tick, felt under the finger without a click: for
/// snaps ("alignment") and for reaching a new level ("level"). Commands
/// without `async` run on the main thread, which AppKit needs.
#[tauri::command]
fn haptic(kind: String) {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{
            NSHapticFeedbackManager, NSHapticFeedbackPattern, NSHapticFeedbackPerformanceTime,
            NSHapticFeedbackPerformer,
        };
        let pattern = match kind.as_str() {
            "level" => NSHapticFeedbackPattern::LevelChange,
            "generic" => NSHapticFeedbackPattern::Generic,
            _ => NSHapticFeedbackPattern::Alignment,
        };
        NSHapticFeedbackManager::defaultPerformer()
            .performFeedbackPattern_performanceTime(pattern, NSHapticFeedbackPerformanceTime::Now);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = kind;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .menu(quit::menu)
        .setup(|app| {
            #[cfg(target_os = "macos")]
            system_quit::install(app.handle());
            #[cfg(not(target_os = "macos"))]
            let _ = app;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == quit::QUIT_ID {
                quit::request(app);
            }
        })
        // Closing the window quits (it's the only one), so it saves first too.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !quit::done() {
                    api.prevent_close();
                    quit::request(window.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            haptic,
            quit::quit_ready,
            history::history_write,
            history::history_list,
            history::history_read,
            history::history_remove
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                if !quit::done() {
                    api.prevent_exit();
                    quit::request(app);
                }
            }
        });
}
