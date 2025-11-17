import { create } from "zustand";

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  previousVolume: number;
  speed: number;
}

interface PlaybackControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setSpeed: (speed: number) => void;
}

interface PlaybackStore extends PlaybackState, PlaybackControls {
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
}

let playbackTimer: number | null = null;

const startTimer = (store: () => PlaybackStore) => {
  if (playbackTimer) cancelAnimationFrame(playbackTimer);

  const updateTime = () => {
    const state = store();
    if (state.isPlaying && state.currentTime < state.duration) {
      const now = performance.now();
      const delta = (now - lastUpdate) / 1000;
      lastUpdate = now;

      const newTime = state.currentTime + delta * state.speed;

      if (newTime >= state.duration) {
        state.pause();
        state.setCurrentTime(state.duration);
      } else {
        state.setCurrentTime(newTime);
      }
    }
    playbackTimer = requestAnimationFrame(updateTime);
  };

  let lastUpdate = performance.now();
  playbackTimer = requestAnimationFrame(updateTime);
};

const stopTimer = () => {
  if (playbackTimer) {
    cancelAnimationFrame(playbackTimer);
    playbackTimer = null;
  }
};

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  previousVolume: 1,
  speed: 1.0,

  play: () => {
    const state = get();
    if (state.duration > 0) {
      if (state.currentTime >= state.duration) {
        get().seek(0);
      }
      set({ isPlaying: true });
      startTimer(get);
    }
  },

  pause: () => {
    set({ isPlaying: false });
    stopTimer();
  },

  toggle: () => {
    const state = get();
    if (state.isPlaying) {
      state.pause();
    } else {
      state.play();
    }
  },

  seek: (time: number) => {
    const state = get();
    const clampedTime = Math.max(0, Math.min(time, state.duration));
    set({ currentTime: clampedTime });
    
    // Dispatch custom event for video sync
    window.dispatchEvent(
      new CustomEvent("playback-seek", {
        detail: { time: clampedTime },
      })
    );
  },

  setCurrentTime: (time: number) => {
    const state = get();
    const clampedTime = Math.max(0, Math.min(time, state.duration));
    set({ currentTime: clampedTime });
    
    // Dispatch custom event for video sync
    window.dispatchEvent(
      new CustomEvent("playback-update", { detail: { time: clampedTime } })
    );
  },

  setDuration: (duration: number) => {
    set({ duration: Math.max(0, duration) });
  },

  setVolume: (volume: number) => {
    set({ volume: Math.max(0, Math.min(1, volume)) });
  },

  toggleMute: () => {
    const state = get();
    if (state.muted) {
      set({ muted: false, volume: state.previousVolume });
    } else {
      set({ muted: true, previousVolume: state.volume, volume: 0 });
    }
  },

  setSpeed: (speed: number) => {
    set({ speed: Math.max(0.25, Math.min(4, speed)) });
  },
}));

