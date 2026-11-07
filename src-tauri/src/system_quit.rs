//! Quitting from the Dock, or the Mac logging out or shutting down, without
//! losing the last change.
//!
//! tao (the window layer) never answers macOS's "may I quit?"
//! (`applicationShouldTerminate:`), so those quits went straight out without
//! the save ⌘Q gets (quit.rs). This adds that answer to tao's app delegate.
//! A Dock quit is held and goes through quit.rs exactly like ⌘Q. A logout or
//! shutdown is asked to wait a moment while the board saves, and the app then
//! goes, so Forma never stops the Mac from shutting down.

use std::sync::OnceLock;

use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{class, msg_send, sel};
use tauri::AppHandle;

use crate::quit;

static APP: OnceLock<AppHandle> = OnceLock::new();

// NSApplicationTerminateReply.
const CANCEL: usize = 0;
const NOW: usize = 1;
const LATER: usize = 2;

/// `why?`, which the quit event carries only when the Mac is logging out,
/// restarting or shutting down (a Dock quit has none).
const QUIT_REASON: u32 = u32::from_be_bytes(*b"why?");

fn mac_is_ending() -> bool {
    unsafe {
        let manager: *mut AnyObject = msg_send![class!(NSAppleEventManager), sharedAppleEventManager];
        if manager.is_null() {
            return false;
        }
        let event: *mut AnyObject = msg_send![manager, currentAppleEvent];
        if event.is_null() {
            return false;
        }
        let reason: *mut AnyObject = msg_send![event, attributeDescriptorForKeyword: QUIT_REASON];
        !reason.is_null()
    }
}

extern "C-unwind" fn should_terminate(_: &AnyObject, _: Sel, _: *mut AnyObject) -> usize {
    if quit::done() {
        return NOW;
    }
    let Some(app) = APP.get() else { return NOW };
    if mac_is_ending() {
        quit::ending();
        quit::request(app);
        LATER
    } else {
        quit::request(app);
        CANCEL
    }
}

/// Teaches tao's app delegate to answer "may I quit?". Call once the app has started.
pub fn install(app: &AppHandle) {
    if APP.set(app.clone()).is_err() {
        return;
    }
    let Some(delegate) = AnyClass::get(c"TaoAppDelegateParent") else {
        eprintln!("Forma: no app delegate to hold quitting from the Dock");
        return;
    };
    unsafe {
        let imp: Imp = std::mem::transmute(
            should_terminate as extern "C-unwind" fn(&AnyObject, Sel, *mut AnyObject) -> usize,
        );
        let added = objc2::ffi::class_addMethod(
            delegate as *const AnyClass as *mut AnyClass,
            sel!(applicationShouldTerminate:),
            imp,
            c"Q@:@".as_ptr(),
        );
        if !added.as_bool() {
            eprintln!("Forma: the app delegate already answers quitting; left as it is");
        }
    }
}
