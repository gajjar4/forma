//! Quitting, or closing the window, without losing the last change.
//!
//! The board saves a moment after each change, so quitting right after one
//! could leave it unwritten. Every way out (⌘Q, Quit in the menu, the red
//! button, ⌘W, the app being asked to exit, and through system_quit.rs Quit
//! in the Dock and the Mac logging out or shutting down) is held, the webview is told to
//! save (src/app/closing.ts: what's being typed is committed, the board
//! written), and once it says it's done the app exits. If it doesn't answer
//! in time, the app exits anyway: quitting never hangs.
//!
//! macOS's own Quit item goes straight to `terminate:`, which tao turns into
//! an exit nobody can hold, so the app menu's Quit is replaced by our own.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
#[allow(unused_imports)]
use tauri::menu::{Menu, MenuItem, MenuItemKind};
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// The event the webview saves on.
const SAVE_EVENT: &str = "forma://save-and-quit";
/// The id of our Quit item.
pub const QUIT_ID: &str = "forma-quit";
/// The longest the webview gets to save (it gives up itself after 2s).
const LONGEST: Duration = Duration::from_millis(2500);

/// Set once the board is saved, or we stopped waiting: the next exit goes through.
static DONE: AtomicBool = AtomicBool::new(false);
/// Set once the webview has been asked to save, so asking twice waits once.
static ASKED: AtomicBool = AtomicBool::new(false);
/// Set when the Mac is logging out or shutting down (system_quit.rs): macOS
/// is waiting on us, so once the board is saved the app simply ends.
static ENDING: AtomicBool = AtomicBool::new(false);

/// The Mac is logging out or shutting down.
#[allow(dead_code)]
pub fn ending() {
    ENDING.store(true, Ordering::SeqCst);
}

pub fn done() -> bool {
    DONE.load(Ordering::SeqCst)
}

fn finish<R: Runtime>(app: &AppHandle<R>) {
    DONE.store(true, Ordering::SeqCst);
    if ENDING.load(Ordering::SeqCst) {
        // The board is written; macOS is holding the shutdown for us, and
        // ending here lets it carry on at once.
        std::process::exit(0);
    }
    app.exit(0);
}

/// Asks the webview to save, then quits; or quits now when there's nothing to ask.
pub fn request<R: Runtime>(app: &AppHandle<R>) {
    if done() {
        return app.exit(0);
    }
    if ASKED.swap(true, Ordering::SeqCst) {
        return;
    }
    if app.webview_windows().is_empty() || app.emit(SAVE_EVENT, ()).is_err() {
        return finish(app);
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(LONGEST);
        if !done() {
            eprintln!("Forma: the board didn't say it was saved in time; quitting anyway");
            finish(&app);
        }
    });
}

/// The webview has saved (or gave up, and says why). Quit now.
#[tauri::command]
pub fn quit_ready(app: AppHandle, problem: Option<String>) {
    if let Some(problem) = problem {
        eprintln!("Forma: {problem}");
    }
    finish(&app);
}

/// The default menu with its Quit item swapped for one we can hold.
pub fn menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;
    #[cfg(target_os = "macos")]
    if let Some(MenuItemKind::Submenu(app_menu)) = menu.items()?.into_iter().next() {
        // The app menu ends with Quit (see tauri's Menu::default).
        let count = app_menu.items()?.len();
        if count > 0 {
            app_menu.remove_at(count - 1)?;
        }
        let name = app.package_info().name.clone();
        app_menu.append(&MenuItem::with_id(app, QUIT_ID, format!("Quit {name}"), true, Some("CmdOrCtrl+Q"))?)?;
    }
    Ok(menu)
}
