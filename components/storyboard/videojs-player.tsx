"use client";

import React, { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "@videojs/themes/dist/forest/video-js.css";

interface VideoJSPlayerProps {
  options: {
    autoplay?: boolean;
    controls?: boolean;
    responsive?: boolean;
    fluid?: boolean;
    sources: Array<{
      src: string;
      type: string;
    }>;
  };
  onReady?: (player: any) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onError?: (error: any) => void;
  onEnded?: () => void;
  className?: string;
}

export default function VideoJSPlayer({
  options,
  onReady,
  onPlay,
  onPause,
  onTimeUpdate,
  onDurationChange,
  onError,
  onEnded,
  className = "",
}: VideoJSPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement("video");
      videoElement.className = "video-js vjs-big-play-centered";
      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("crossorigin", "anonymous");
      videoRef.current.appendChild(videoElement);

      const player = videojs(videoElement, {
        ...options,
        html5: {
          vhs: {
            overrideNative: true,
          },
          nativeVideoTracks: false,
          nativeAudioTracks: false,
          nativeTextTracks: false,
        },
      });

      playerRef.current = player;

      // Event listeners
      player.ready(() => {
        onReady?.(player);
      });

      player.on("play", () => {
        onPlay?.();
      });

      player.on("pause", () => {
        onPause?.();
      });

      player.on("timeupdate", () => {
        onTimeUpdate?.(player.currentTime());
      });

      player.on("loadedmetadata", () => {
        onDurationChange?.(player.duration());
      });

      player.on("error", () => {
        const error = player.error();
        onError?.(error);
      });

      player.on("ended", () => {
        onEnded?.();
      });
    }

    // Cleanup function
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  // Update sources when options change
  useEffect(() => {
    if (playerRef.current && options.sources) {
      playerRef.current.src(options.sources);
    }
  }, [options.sources]);

  return (
    <div className={className}>
      <div ref={videoRef} className="video-js-container" />
    </div>
  );
}

