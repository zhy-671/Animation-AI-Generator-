import { snapTimeToFrame } from "@/lib/constants/timeline-constants";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePlaybackStore } from "@/lib/stores/playback-store";

const DEFAULT_FPS = 30;

interface UseTimelinePlayheadProps {
  currentTime: number;
  duration: number;
  zoomLevel: number;
  seek: (time: number) => void;
  rulerRef: React.RefObject<HTMLDivElement>;
  rulerScrollRef: React.RefObject<HTMLDivElement>;
  tracksScrollRef: React.RefObject<HTMLDivElement>;
  playheadRef?: React.RefObject<HTMLDivElement>;
}

export function useTimelinePlayhead({
  currentTime,
  duration,
  zoomLevel,
  seek,
  rulerRef,
  rulerScrollRef,
  tracksScrollRef,
  playheadRef,
}: UseTimelinePlayheadProps) {
  // Playhead scrubbing state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  // Ruler drag detection state
  const [isDraggingRuler, setIsDraggingRuler] = useState(false);
  const [hasDraggedRuler, setHasDraggedRuler] = useState(false);
  const lastMouseXRef = useRef<number>(0);

  const playheadPosition =
    isScrubbing && scrubTime !== null ? scrubTime : currentTime;

  // --- Playhead Scrubbing Handlers ---
  const handlePlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsScrubbing(true);
      handleScrub(e);
    },
    [duration, zoomLevel]
  );

  // Ruler mouse down handler
  const handleRulerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (playheadRef?.current?.contains(e.target as Node)) return;

      e.preventDefault();
      setIsDraggingRuler(true);
      setHasDraggedRuler(false);
      setIsScrubbing(true);
      handleScrub(e);
    },
    [duration, zoomLevel]
  );

  const handleScrub = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const ruler = rulerRef.current;
      if (!ruler) return;
      const rect = ruler.getBoundingClientRect();
      const rawX = e.clientX - rect.left;

      const timelineContentWidth = duration * 50 * zoomLevel;
      const x = Math.max(0, Math.min(timelineContentWidth, rawX));
      const rawTime = Math.max(0, Math.min(duration, x / (50 * zoomLevel)));
      const time = snapTimeToFrame(rawTime, DEFAULT_FPS);

      setScrubTime(time);
      seek(time);

      lastMouseXRef.current = e.clientX;
    },
    [duration, zoomLevel, seek, rulerRef]
  );

  // Mouse move/up event handlers
  useEffect(() => {
    if (!isScrubbing) return;

    const onMouseMove = (e: MouseEvent) => {
      handleScrub(e);
      if (isDraggingRuler) {
        setHasDraggedRuler(true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      setIsScrubbing(false);
      if (scrubTime !== null) seek(scrubTime);
      setScrubTime(null);

      if (isDraggingRuler) {
        setIsDraggingRuler(false);
        if (!hasDraggedRuler) {
          handleScrub(e);
        }
        setHasDraggedRuler(false);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    isScrubbing,
    scrubTime,
    seek,
    handleScrub,
    isDraggingRuler,
    hasDraggedRuler,
  ]);

  // Playhead auto-scroll effect (only during playback)
  useEffect(() => {
    const { isPlaying } = usePlaybackStore.getState();
    if (!isPlaying || isScrubbing) return;

    const rulerViewport = rulerScrollRef.current;
    const tracksViewport = tracksScrollRef.current;
    if (!rulerViewport || !tracksViewport) return;

    const playheadPx = playheadPosition * 50 * zoomLevel;
    const viewportWidth = rulerViewport.clientWidth;
    const scrollMin = 0;
    const scrollMax = rulerViewport.scrollWidth - viewportWidth;

    const needsScroll =
      playheadPx < rulerViewport.scrollLeft ||
      playheadPx > rulerViewport.scrollLeft + viewportWidth;

    if (needsScroll) {
      const desiredScroll = Math.max(
        scrollMin,
        Math.min(scrollMax, playheadPx - viewportWidth / 2)
      );
      rulerViewport.scrollLeft = tracksViewport.scrollLeft = desiredScroll;
    }
  }, [
    playheadPosition,
    duration,
    zoomLevel,
    rulerScrollRef,
    tracksScrollRef,
    isScrubbing,
  ]);

  return {
    playheadPosition,
    handlePlayheadMouseDown,
    handleRulerMouseDown,
    isDraggingRuler,
  };
}

