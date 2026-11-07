/** Opens a link in the default browser: through the opener plugin in the Mac app, a new tab otherwise. */
export async function openLink(url: string) {
  if (!url) return;
  if ("__TAURI_INTERNALS__" in window) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url).catch(() => {});
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
