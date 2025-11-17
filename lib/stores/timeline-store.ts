import { create } from "zustand";

export type TrackType = "media" | "text" | "audio";

export interface TimelineElement {
  id: string;
  name: string;
  duration: number;
  startTime: number;
  trimStart: number;
  trimEnd: number;
  type: TrackType;
  mediaId?: string;
  thumbnail?: string;
  hidden?: boolean;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  elements: TimelineElement[];
  muted?: boolean;
  isMain?: boolean;
}

interface TimelineStore {
  tracks: TimelineTrack[];
  selectedElements: string[];
  zoomLevel: number;
  snappingEnabled: boolean;
  
  // Actions
  addTrack: (track: TimelineTrack) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  addElementToTrack: (trackId: string, element: TimelineElement) => void;
  removeElementFromTrack: (trackId: string, elementId: string) => void;
  updateElement: (elementId: string, updates: Partial<TimelineElement>) => void;
  selectElement: (elementId: string, multiSelect?: boolean) => void;
  setSelectedElements: (elementIds: string[]) => void;
  clearSelectedElements: () => void;
  setZoomLevel: (zoom: number) => void;
  toggleSnapping: () => void;
  toggleTrackMute: (trackId: string) => void;
  getTotalDuration: () => number;
  _loadTracks: (tracks: TimelineTrack[]) => void;
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  tracks: [],
  selectedElements: [],
  zoomLevel: 1,
  snappingEnabled: true,

  addTrack: (track) => {
    set((state) => ({
      tracks: [...state.tracks, track],
    }));
  },

  removeTrack: (trackId) => {
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
    }));
  },

  updateTrack: (trackId, updates) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, ...updates } : t
      ),
    }));
  },

  addElementToTrack: (trackId, element) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, elements: [...t.elements, element] }
          : t
      ),
    }));
  },

  removeElementFromTrack: (trackId, elementId) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, elements: t.elements.filter((e) => e.id !== elementId) }
          : t
      ),
    }));
  },

  updateElement: (elementId, updates) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        elements: track.elements.map((e) =>
          e.id === elementId ? { ...e, ...updates } : e
        ),
      })),
    }));
  },

  selectElement: (elementId, multiSelect = false) => {
    set((state) => {
      if (multiSelect) {
        const isSelected = state.selectedElements.includes(elementId);
        return {
          selectedElements: isSelected
            ? state.selectedElements.filter((id) => id !== elementId)
            : [...state.selectedElements, elementId],
        };
      }
      return {
        selectedElements: [elementId],
      };
    });
  },

  clearSelectedElements: () => {
    set({ selectedElements: [] });
  },

  setSelectedElements: (elementIds) => {
    set({ selectedElements: elementIds });
  },

  setZoomLevel: (zoom) => {
    set({ zoomLevel: Math.max(0.1, Math.min(10, zoom)) });
  },

  toggleSnapping: () => {
    set((state) => ({ snappingEnabled: !state.snappingEnabled }));
  },

  toggleTrackMute: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    }));
  },

  _loadTracks: (newTracks) => {
    set({ tracks: newTracks });
  },

  getTotalDuration: () => {
    const { tracks } = get();
    let maxDuration = 0;
    
    tracks.forEach((track) => {
      track.elements.forEach((element) => {
        const endTime = element.startTime + element.duration - element.trimStart - element.trimEnd;
        if (endTime > maxDuration) {
          maxDuration = endTime;
        }
      });
    });
    
    return Math.max(maxDuration, 10); // Minimum 10 seconds
  },
}));

