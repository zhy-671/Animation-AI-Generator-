import type { TrackType } from "../stores/timeline-store";

// Track color definitions
export const TRACK_COLORS: Record<
  TrackType,
  { solid: string; background: string; border: string }
> = {
  media: {
    solid: "bg-blue-500",
    background: "",
    border: "",
  },
  text: {
    solid: "bg-[#5DBAA0]",
    background: "bg-[#5DBAA0]",
    border: "",
  },
  audio: {
    solid: "bg-green-500",
    background: "bg-[#915DBE]",
    border: "",
  },
} as const;

// Track height definitions
export const TRACK_HEIGHTS: Record<TrackType, number> = {
  media: 80, // Increased from 60 to 80 for better thumbnail visibility
  text: 25,
  audio: 50,
} as const;

// Utility function for track heights
export function getTrackHeight(type: TrackType): number {
  return TRACK_HEIGHTS[type];
}

// Calculate cumulative height up to (but not including) a track index
export function getCumulativeHeightBefore(
  tracks: Array<{ type: TrackType }>,
  trackIndex: number
): number {
  const GAP = 4; // 4px gap between tracks
  return tracks
    .slice(0, trackIndex)
    .reduce((sum, track) => sum + getTrackHeight(track.type) + GAP, 0);
}

// Calculate total height of all tracks
export function getTotalTracksHeight(
  tracks: Array<{ type: TrackType }>
): number {
  const GAP = 4;
  const tracksHeight = tracks.reduce(
    (sum, track) => sum + getTrackHeight(track.type),
    0
  );
  const gapsHeight = Math.max(0, tracks.length - 1) * GAP;
  return tracksHeight + gapsHeight;
}

// Timeline constants
export const TIMELINE_CONSTANTS = {
  ELEMENT_MIN_WIDTH: 80,
  PIXELS_PER_SECOND: 50,
  TRACK_HEIGHT: 60,
  DEFAULT_TEXT_DURATION: 5,
  DEFAULT_IMAGE_DURATION: 5,
  ZOOM_LEVELS: [0.25, 0.5, 1, 1.5, 2, 3, 4],
} as const;

// FPS presets
export const FPS_PRESETS = [
  { value: "24", label: "24 fps" },
  { value: "25", label: "25 fps" },
  { value: "30", label: "30 fps" },
  { value: "60", label: "60 fps" },
  { value: "120", label: "120 fps" },
] as const;

// Frame snapping utilities
export function timeToFrame(time: number, fps: number): number {
  return Math.round(time * fps);
}

export function frameToTime(frame: number, fps: number): number {
  return frame / fps;
}

export function snapTimeToFrame(time: number, fps: number): number {
  if (fps <= 0) return time;
  const frame = timeToFrame(time, fps);
  return frameToTime(frame, fps);
}

export function getFrameDuration(fps: number): number {
  return 1 / fps;
}

