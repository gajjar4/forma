// A video's size and one still of it, read in the app when it is brought in.
// The still is what the board shows (a picture costs nothing to pan over; a
// playing video does), and where its palette comes from.

/** How far in the still is taken: past a fade-in, early enough to be the opening. */
const AT = 0.5;
/** The longest side of the saved still, in pixels. */
const MAX_SIDE = 1400;

export type VideoStill = { w: number; h: number; still: Blob | null };

export async function videoStill(file: Blob): Promise<VideoStill> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(video.error);
      video.src = url;
    });
    const w = video.videoWidth || 1;
    const h = video.videoHeight || 1;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = Math.min(AT, (video.duration || 1) / 3);
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const still = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return { w, h, still };
  } catch {
    return { w: 1, h: 1, still: null };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export const isVideoFile = (file: File) => file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(file.name);
