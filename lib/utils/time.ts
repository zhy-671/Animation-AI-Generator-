// Time-related utility functions

const DEFAULT_FPS = 30;

export type TimeCode = "MM:SS" | "HH:MM:SS" | "HH:MM:SS:CS" | "HH:MM:SS:FF";

// Helper function to format time in various formats
export const formatTimeCode = (
  timeInSeconds: number,
  format: TimeCode = "HH:MM:SS:CS",
  fps = DEFAULT_FPS
): string => {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const centiseconds = Math.floor((timeInSeconds % 1) * 100);
  const frames = Math.floor((timeInSeconds % 1) * fps);

  switch (format) {
    case "MM:SS":
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    case "HH:MM:SS":
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    case "HH:MM:SS:CS":
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${centiseconds.toString().padStart(2, "0")}`;
    case "HH:MM:SS:FF":
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  }
};

// Simple time formatter
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

