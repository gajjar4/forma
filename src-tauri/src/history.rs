//! Earlier versions of each board, kept in the app's own data folder:
//!
//!   ~/Library/Application Support/world.pukha.forma/history/<key>/board-<time>.json
//!
//! The webview decides what to keep, its names and what to let go of
//! (src/store/versions.ts); these commands only read and write files in that
//! one folder. They are commands rather than fs permissions because the fs
//! plugin adds a command's scope to the global one ($HOME/**), so a "remove"
//! permission could not have been held to this folder.
//!
//! All `async`, so the file work runs off the main thread and never holds up
//! a frame.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// A board's folder name: letters, digits and dashes (see historyKey).
fn valid_key(key: &str) -> bool {
    !key.is_empty() && key.len() <= 80 && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// A version's file name: board-<time>.json, nothing that could leave the folder.
fn valid_name(name: &str) -> bool {
    name.len() <= 64
        && name.starts_with("board-")
        && name.ends_with(".json")
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
        && !name.contains("..")
}

fn folder(app: &AppHandle, key: &str) -> Result<PathBuf, String> {
    if !valid_key(key) {
        return Err(format!("not a history folder: {key}"));
    }
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(base.join("history").join(key))
}

fn file(app: &AppHandle, key: &str, name: &str) -> Result<PathBuf, String> {
    if !valid_name(name) {
        return Err(format!("not a version: {name}"));
    }
    Ok(folder(app, key)?.join(name))
}

fn names(dir: &PathBuf) -> Result<Vec<String>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let name = entry.map_err(|e| e.to_string())?.file_name().to_string_lossy().into_owned();
        if valid_name(&name) {
            out.push(name);
        }
    }
    Ok(out)
}

/// Writes one version (whole, through a temporary file) and returns every
/// version now in the folder, for the webview to prune.
#[tauri::command]
pub async fn history_write(app: AppHandle, key: String, name: String, text: String) -> Result<Vec<String>, String> {
    let path = file(&app, &key, &name)?;
    let dir = folder(&app, &key)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.saving");
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    names(&dir)
}

#[tauri::command]
pub async fn history_list(app: AppHandle, key: String) -> Result<Vec<String>, String> {
    names(&folder(&app, &key)?)
}

#[tauri::command]
pub async fn history_read(app: AppHandle, key: String, name: String) -> Result<String, String> {
    fs::read_to_string(file(&app, &key, &name)?).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn history_remove(app: AppHandle, key: String, names: Vec<String>) -> Result<(), String> {
    for name in names {
        let path = file(&app, &key, &name)?;
        if path.exists() {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_stay_in_the_folder() {
        assert!(valid_name("board-2026-11-03T14-32-05-123Z.json"));
        assert!(!valid_name("../board.json"));
        assert!(!valid_name("board-..json"));
        assert!(!valid_name("board-x/../../y.json"));
        assert!(!valid_name("board.json"));
        assert!(valid_key("Neos-0123456789abcdef"));
        assert!(!valid_key(".."));
        assert!(!valid_key("a/b"));
        assert!(!valid_key(""));
    }
}
