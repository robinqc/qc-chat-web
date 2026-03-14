import type {
  ScreenShareCaptureOptions,
  TrackPublishOptions,
  VideoEncoding,
  VideoResolution,
} from "livekit-client";

import type {
  ScreenShareFrameRate,
  ScreenShareResolution,
} from "@revolt/state/stores/Voice";

/**
 * Bitrate map keyed by `${resolution}-${fps}`.
 * Values are in bits-per-second and tuned for screen content
 * (text, UI, code) which compresses well with modern codecs.
 */
const BITRATE_MAP: Record<string, number> = {
  "720-30": 2_500_000,
  "720-60": 4_000_000,
  "1080-30": 4_500_000,
  "1080-60": 8_000_000,
  "original-30": 8_000_000,
  "original-60": 12_000_000,
};

const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  "720": { width: 1280, height: 720 },
  "1080": { width: 1920, height: 1080 },
};

/**
 * Build ScreenShareCaptureOptions and TrackPublishOptions from the user's
 * chosen resolution and frame rate.
 */
export function buildScreenShareOptions(
  resolution: ScreenShareResolution,
  frameRate: ScreenShareFrameRate,
): {
  captureOptions: ScreenShareCaptureOptions;
  publishOptions: TrackPublishOptions;
} {
  const key = `${resolution}-${frameRate}`;
  const maxBitrate = BITRATE_MAP[key] ?? 4_500_000;

  // Capture options sent to getDisplayMedia
  const captureOptions: ScreenShareCaptureOptions = {
    audio: true,
    // "detail" prioritises sharpness for text/UI; "motion" for high-fps video
    contentHint: frameRate >= 60 ? "motion" : "detail",
  };

  // Only constrain resolution when the user picked a fixed preset.
  // "original" leaves it unconstrained so the browser captures at native res.
  if (resolution !== "original") {
    const dims = RESOLUTION_MAP[resolution];
    const videoResolution: VideoResolution = {
      width: dims.width,
      height: dims.height,
      frameRate,
    };
    captureOptions.resolution = videoResolution;
  }

  // Encoding parameters that control the WebRTC encoder
  const screenShareEncoding: VideoEncoding = {
    maxBitrate,
    maxFramerate: frameRate,
  };

  const publishOptions: TrackPublishOptions = {
    screenShareEncoding,
    // Publish a lower-quality simulcast layer so bandwidth-limited viewers
    // still get a usable stream. This layer is ~25% of the primary bitrate.
    screenShareSimulcastLayers: [
      {
        encoding: {
          maxBitrate: Math.round(maxBitrate * 0.25),
          maxFramerate: Math.min(frameRate, 15),
        },
        width: 1280,
        height: 720,
      } as any,
    ],
  };

  return { captureOptions, publishOptions };
}

/**
 * Build default publish defaults for the Room constructor.
 * This sets a sensible baseline so even non-screen-share tracks
 * get reasonable encoding parameters.
 */
export function buildDefaultPublishDefaults(
  resolution: ScreenShareResolution,
  frameRate: ScreenShareFrameRate,
) {
  const key = `${resolution}-${frameRate}`;
  const maxBitrate = BITRATE_MAP[key] ?? 4_500_000;

  return {
    screenShareEncoding: {
      maxBitrate,
      maxFramerate: frameRate,
    } as VideoEncoding,
    // VP9 compresses screen content significantly better than VP8.
    // backupCodec defaults to true so incompatible browsers fall back to VP8.
    videoCodec: "vp9" as const,
  };
}
