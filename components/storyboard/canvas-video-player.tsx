"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

interface SubtitleItem {
  start: number;
  end: number;
  text: string;
  x?: number;
  y?: number;
}

interface VideoClip {
  id: string;
  url: string;
  startTime: number;
  duration: number;
}

export interface CanvasVideoPlayerRef {
  playFromUserInteraction: () => void;
  resetToFirst: () => void; // Reset to first video
}

interface CanvasVideoPlayerProps {
  clips: VideoClip[];
  subtitles: SubtitleItem[];
  isPlaying: boolean;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onClipChange?: (clipIndex: number) => void;
  volume?: number;
  isMuted?: boolean;
  onEnded?: () => void;
  onPlayRequest?: () => void; // Callback when play is requested (for user interaction)
  showSubtitles?: boolean; // Whether to show subtitles
}

const wrapSubtitleText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = Infinity
) => {
  const sanitized = text?.trim();
  if (!sanitized) {
    return [];
  }

  const hasSpaces = /\s/.test(sanitized);
  const units = hasSpaces ? sanitized.split(/\s+/) : sanitized.split("");
  const separator = hasSpaces ? " " : "";
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i];
    const testLine = currentLine ? `${currentLine}${separator}${unit}` : unit;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = unit;

      if (lines.length === maxLines - 1 && i < units.length - 1) {
        const remaining = units.slice(i + 1).join(separator);
        currentLine = remaining ? `${currentLine}${separator}${remaining}` : currentLine;
        break;
      }
    } else {
      currentLine = testLine;
    }

    const isLastUnit = i === units.length - 1;
    if (isLastUnit && currentLine) {
      lines.push(currentLine);
    }

    if (lines.length >= maxLines) {
      break;
    }
  }

  return lines.slice(0, maxLines);
};

const CanvasVideoPlayer = React.forwardRef<CanvasVideoPlayerRef, CanvasVideoPlayerProps>(({
  clips,
  subtitles,
  isPlaying,
  currentTime,
  onTimeUpdate,
  onClipChange,
  volume = 1,
  isMuted = false,
  onEnded,
  onPlayRequest,
  showSubtitles = true, // Default to showing subtitles
}, ref) => {
  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentClipIndexRef = useRef<number>(0);
  const globalOffsetRef = useRef<number>(0);
  const isVideoAPlayingRef = useRef<boolean>(true);
  const lastUpdateTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const lastFrameDrawnRef = useRef<{ video: HTMLVideoElement | null; time: number }>({ video: null, time: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isAVisible, setIsAVisible] = useState(true);

  // Initialize canvas size
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = canvasARef.current?.parentElement;
      if (container && canvasARef.current && canvasBRef.current) {
        const width = container.clientWidth || 1280; // Default width if 0
        const height = Math.floor(width * 9 / 16); // 16:9 aspect ratio
        setCanvasSize({ width, height });
        canvasARef.current.width = width;
        canvasARef.current.height = height;
        canvasBRef.current.width = width;
        canvasBRef.current.height = height;
      } else {
      }
    };

    // Initial update
    updateCanvasSize();
    
    // Also try multiple times in case container isn't ready yet
    const timeoutIds = [
      setTimeout(updateCanvasSize, 100),
      setTimeout(updateCanvasSize, 500),
      setTimeout(updateCanvasSize, 1000)
    ];
    
    window.addEventListener("resize", updateCanvasSize);
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, []);

  // Render function - defined early so it can be used in useEffect
  const render = useCallback(() => {
    const canvasA = canvasARef.current;
    const canvasB = canvasBRef.current;
    const videoA = videoARef.current;
    const videoB = videoBRef.current;

    if (!canvasA || !canvasB || !videoA || !videoB) return;

    // Determine which canvas/video pair is active
    // Use ref directly to get the most up-to-date value
    const currentIsAVisible = isVideoAPlayingRef.current;
    const activeCanvas = currentIsAVisible ? canvasA : canvasB;
    const activeVideo = currentIsAVisible ? videoA : videoB;
    const inactiveCanvas = currentIsAVisible ? canvasB : canvasA;
    const inactiveVideo = currentIsAVisible ? videoB : videoA;

    const activeCtx = activeCanvas.getContext("2d");
    const inactiveCtx = inactiveCanvas.getContext("2d");
    if (!activeCtx || !inactiveCtx) return;

    // Render active video frame only if ready (readyState >= 2)
    if (activeVideo.readyState >= 2 && activeCanvas.width > 0 && activeCanvas.height > 0) {
      try {
        // Clear and draw new frame
        activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
        activeCtx.drawImage(activeVideo, 0, 0, activeCanvas.width, activeCanvas.height);
        lastFrameDrawnRef.current = { video: activeVideo, time: activeVideo.currentTime };
        
        // Debug log every 30 frames (about once per second at 30fps)
        if (Math.random() < 0.033) {
        }
      } catch (e) {
      }
    } else {
      // Video not ready - keep last frame if available, don't clear to black
      if (lastFrameDrawnRef.current.video === activeVideo && lastFrameDrawnRef.current.video && lastFrameDrawnRef.current.video.readyState >= 2) {
        // We have a previous frame from this video, keep it - don't clear
        // This prevents black screen when video is reloading
      } else if (activeCanvas.width > 0 && activeCanvas.height > 0) {
        // No previous frame and canvas is ready, but video isn't - show black
        // Only clear if we don't have a valid previous frame
        if (!lastFrameDrawnRef.current.video || lastFrameDrawnRef.current.video.readyState < 2) {
          activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
        }
      }
    }

    // Pre-render inactive video if it's ready (for smooth switching)
    if (inactiveVideo.readyState >= 2 && inactiveCanvas.width > 0 && inactiveCanvas.height > 0) {
      try {
        inactiveCtx.clearRect(0, 0, inactiveCanvas.width, inactiveCanvas.height);
        inactiveCtx.drawImage(inactiveVideo, 0, 0, inactiveCanvas.width, inactiveCanvas.height);
      } catch (e) {
        // Ignore drawing errors for inactive canvas
      }
    }

    // Calculate global time from active video
    const globalTime = activeVideo.currentTime + globalOffsetRef.current;

    // Draw subtitles on active canvas (only if showSubtitles is true)
    const activeSubtitles = showSubtitles
      ? subtitles.filter(
          (sub) => globalTime >= sub.start && globalTime < sub.end
        )
      : [];

    activeSubtitles.forEach((subtitle) => {
      const aspectRatio = activeCanvas.width && activeCanvas.height
        ? activeCanvas.width / activeCanvas.height
        : 16 / 9;
      const isPortrait = aspectRatio < 1;
      const fontSize = Math.max(
        Math.min(activeCanvas.width * (isPortrait ? 0.036 : 0.028), 40),
        14
      );
      const lineHeight = fontSize * 1.25;
      const maxSubtitleWidth = activeCanvas.width * (isPortrait ? 0.88 : 0.72);
      const shouldCenter = subtitle.x === undefined;
      const x = shouldCenter ? activeCanvas.width / 2 : subtitle.x;
      const baseY = subtitle.y ?? activeCanvas.height - 10;

      activeCtx.font = `600 ${fontSize}px "Noto Sans", "Microsoft YaHei", "Arial", sans-serif`;
      activeCtx.textAlign = shouldCenter ? "center" : "left";
      activeCtx.textBaseline = "alphabetic";
      activeCtx.lineJoin = "round";
      activeCtx.shadowColor = "rgba(0, 0, 0, 0.9)";
      activeCtx.shadowBlur = fontSize * 0.4;
      activeCtx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      activeCtx.lineWidth = Math.max(fontSize * 0.1, 1.8);

      const lines = wrapSubtitleText(activeCtx, subtitle.text, maxSubtitleWidth, 2);
      const firstLineY = baseY - (lines.length - 1) * lineHeight;

      lines.forEach((line, lineIndex) => {
        const lineY = firstLineY + lineIndex * lineHeight;
        activeCtx.fillStyle = "#ffffff";
        if (line) {
          activeCtx.strokeText(line, x, lineY);
          activeCtx.fillText(line, x, lineY);
        }
      });
    });

    if (activeSubtitles.length > 0) {
      activeCtx.shadowBlur = 0;
      activeCtx.shadowColor = "transparent";
      activeCtx.lineWidth = 1;
    }

    // Update time - throttle updates to avoid excessive state changes
    // Only update if playing to avoid triggering seek during pause
    if (isPlaying && !isSeekingRef.current) {
      const now = Date.now();
      if (now - lastUpdateTimeRef.current > 50) { // Update every 50ms for smoother updates
        // Always update time when playing (don't check timeDiff to avoid blocking updates after video switch)
        onTimeUpdate(globalTime);
        lastSeekTimeRef.current = globalTime; // Update lastSeekTimeRef to current time
        lastUpdateTimeRef.current = now;
      }
    } else if (!isPlaying) {
      // When paused, still update time once to show current frame
      const now = Date.now();
      if (now - lastUpdateTimeRef.current > 1000) { // Update every 1s when paused
        onTimeUpdate(globalTime);
        lastSeekTimeRef.current = globalTime; // Update lastSeekTimeRef to current time
        lastUpdateTimeRef.current = now;
      }
    }

    // Check if video has ended (currentTime >= duration)
    const currentClip = clips[currentClipIndexRef.current];
    if (currentClip && activeVideo.readyState >= 2 && isPlaying) {
      // Check if video has ended
      if (activeVideo.currentTime >= currentClip.duration - 0.05) {
        // Video has ended, switch to next
        const nextIndex = currentClipIndexRef.current + 1;
        if (nextIndex < clips.length) {
          const nextClip = clips[nextIndex];
          const preloadVideo = isVideoAPlayingRef.current ? videoB : videoA;
          
          // If preload video is ready, switch immediately
          if (preloadVideo.src === nextClip.url && preloadVideo.readyState >= 2) {
            // Pause old video first
            activeVideo.pause();
            
            preloadVideo.currentTime = 0;
            preloadVideo.muted = isMuted;
            preloadVideo.play()
              .then(() => {
                const oldActiveVideo = activeVideo;
                isVideoAPlayingRef.current = !isVideoAPlayingRef.current;
                currentClipIndexRef.current = nextIndex;
                globalOffsetRef.current = nextClip.startTime;
                lastFrameDrawnRef.current = { video: preloadVideo, time: 0 };
                setIsAVisible(isVideoAPlayingRef.current);
                
                // Update time immediately after switching
                const newGlobalTime = preloadVideo.currentTime + globalOffsetRef.current;
                onTimeUpdate(newGlobalTime);
                lastSeekTimeRef.current = newGlobalTime;
                lastUpdateTimeRef.current = Date.now();
                
                // Verify video is still playing after switch
                // Note: preloadVideo is now the new activeVideo after swap
                const newActiveVideo = preloadVideo; // This is the video we just started playing
                if (newActiveVideo.paused && isPlaying) {
                  newActiveVideo.play().catch((err) => {
                    // Ignore AbortError - it's expected when play() is interrupted
                    if (err.name !== 'AbortError') {
                    }
                  });
                }
                
                // Ensure render loop continues
                if (animationFrameRef.current === null) {
                  animationFrameRef.current = requestAnimationFrame(render);
                }
                
                // Call onClipChange AFTER all state updates to avoid triggering re-render during switch
                setTimeout(() => {
                  onClipChange?.(nextIndex);
                }, 0);
                // Preload video after next
                const afterNextIndex = nextIndex + 1;
                if (afterNextIndex < clips.length) {
                  const afterNextClip = clips[afterNextIndex];
                  if (oldActiveVideo.src !== afterNextClip.url) {
                    oldActiveVideo.src = afterNextClip.url;
                    oldActiveVideo.preload = "auto";
                    oldActiveVideo.muted = isMuted;
                    oldActiveVideo.load();
                  }
                }
              })
              .catch((err) => {
              });
          } else {
            // Preload video not ready, call switchToNextVideo to handle loading
            switchToNextVideo();
          }
        } else {
          // All videos finished, call onEnded
          activeVideo.pause();
          onEnded?.();
        }
        return; // Skip preload check if video has ended
      }
      
      // Check if we need to preload next video (0.3s before end)
      const remainingTime = currentClip.duration - activeVideo.currentTime;
      const nextIndex = currentClipIndexRef.current + 1;
      
      if (nextIndex < clips.length && remainingTime <= 0.3 && remainingTime > 0) {
        const nextClip = clips[nextIndex];
        const preloadVideo = isVideoAPlayingRef.current ? videoB : videoA;
        
        // Preload next video
        if (preloadVideo.src !== nextClip.url) {
          preloadVideo.src = nextClip.url;
          preloadVideo.preload = "auto";
          preloadVideo.muted = isMuted;
          preloadVideo.load(); // Force load to start preloading
        }
        
        // Start playing next video when remaining time is very small (0.1s)
        if (remainingTime <= 0.1 && preloadVideo.readyState >= 2) {
          // Store the old active video before swapping (for preloading after next)
          const oldActiveVideo = activeVideo;
          
          // Pause old video first
          oldActiveVideo.pause();
          
          // Ensure video is at the start
          preloadVideo.currentTime = 0;
          preloadVideo.muted = isMuted;
          
          // Swap roles BEFORE playing to ensure correct state
          isVideoAPlayingRef.current = !isVideoAPlayingRef.current;
          currentClipIndexRef.current = nextIndex;
          globalOffsetRef.current = nextClip.startTime;
          
          // Update visibility state immediately
          setIsAVisible(isVideoAPlayingRef.current);
          
          // Start playing next video
          preloadVideo.play()
            .then(() => {
              // Update last frame reference
              lastFrameDrawnRef.current = { video: preloadVideo, time: 0 };
              
              // Update time immediately after switching
              const newGlobalTime = preloadVideo.currentTime + globalOffsetRef.current;
              onTimeUpdate(newGlobalTime);
              lastSeekTimeRef.current = newGlobalTime;
              lastUpdateTimeRef.current = Date.now();
              
              // Verify video is still playing after switch
              // Note: preloadVideo is now the new activeVideo after swap
              const newActiveVideo = preloadVideo; // This is the video we just started playing
              
              // Double-check video is playing
              if (newActiveVideo.paused && isPlaying) {
                newActiveVideo.play().catch((err: Error) => {
                  // Ignore AbortError - it's expected when play() is interrupted by pause()
                  if (err.name !== 'AbortError') {
                  }
                });
              }
              
              // Ensure render loop continues
              if (animationFrameRef.current === null) {
                animationFrameRef.current = requestAnimationFrame(render);
              }
              // Call onClipChange AFTER all state updates to avoid triggering re-render during switch
              setTimeout(() => {
                onClipChange?.(nextIndex);
              }, 0);
              
              // Preload the video after next (for continuous playback)
              // Use the old active video (which is now inactive) to preload
              const afterNextIndex = nextIndex + 1;
              if (afterNextIndex < clips.length) {
                const afterNextClip = clips[afterNextIndex];
                
                // Only set src if it's different to avoid reloading
                if (oldActiveVideo.src !== afterNextClip.url) {
                  oldActiveVideo.src = afterNextClip.url;
                  oldActiveVideo.preload = "auto";
                  oldActiveVideo.muted = isMuted;
                  oldActiveVideo.load(); // Force load
                }
              }
            })
            .catch((err) => {
            });
        }
      }
    }

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(render);
  }, [clips, subtitles, onTimeUpdate, onClipChange, isPlaying]);

  // Switch to next video
  const switchToNextVideo = useCallback(() => {
    const nextIndex = currentClipIndexRef.current + 1;
    if (nextIndex >= clips.length) {
      onEnded?.();
      return;
    }

    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;

    const nextClip = clips[nextIndex];
    const currentVideo = isVideoAPlayingRef.current ? videoA : videoB;
    const inactiveVideo = isVideoAPlayingRef.current ? videoB : videoA;
    // Check if inactive video already has the next clip loaded
    if (inactiveVideo.src === nextClip.url && inactiveVideo.readyState >= 2) {
      // Pause current video first
      currentVideo.pause();
      
      // Already loaded, just switch
      inactiveVideo.currentTime = 0;
      inactiveVideo.muted = isMuted;
      
      inactiveVideo.play()
        .then(() => {
          // Swap roles
          isVideoAPlayingRef.current = !isVideoAPlayingRef.current;
          currentClipIndexRef.current = nextIndex;
          globalOffsetRef.current = nextClip.startTime;
          
          // Update last frame reference
          lastFrameDrawnRef.current = { video: inactiveVideo, time: 0 };
          
          // Update visibility state
          setIsAVisible(isVideoAPlayingRef.current);
          
          // Update time immediately after switching
          const newGlobalTime = inactiveVideo.currentTime + globalOffsetRef.current;
          onTimeUpdate(newGlobalTime);
          lastSeekTimeRef.current = newGlobalTime;
          lastUpdateTimeRef.current = Date.now();
          
          // Verify video is still playing after switch
          // Note: inactiveVideo is now the new activeVideo after swap
          const newActiveVideo = inactiveVideo; // This is the video we just started playing
          if (newActiveVideo.paused && isPlaying) {
            newActiveVideo.play().catch(() => {});
          }
          
          // Ensure render loop continues
          if (animationFrameRef.current === null) {
            animationFrameRef.current = requestAnimationFrame(render);
          }
          
          // Call onClipChange AFTER all state updates to avoid triggering re-render during switch
          setTimeout(() => {
            onClipChange?.(nextIndex);
          }, 0);
          // Preload the video after next
          const afterNextIndex = nextIndex + 1;
          if (afterNextIndex < clips.length) {
            const afterNextClip = clips[afterNextIndex];
            // Use the now-inactive video (which was the current one)
            if (currentVideo.src !== afterNextClip.url) {
              currentVideo.src = afterNextClip.url;
              currentVideo.preload = "auto";
              currentVideo.muted = isMuted;
              currentVideo.load();
            }
          }
        })
        .catch((err) => {
        });
    } else {
      // Need to load the next video
      inactiveVideo.src = nextClip.url;
      inactiveVideo.preload = "auto";
      inactiveVideo.muted = isMuted;
      
      const handleCanPlay = () => {
        // Pause current video first
        currentVideo.pause();
        
        inactiveVideo.currentTime = 0;
        inactiveVideo.play()
          .then(() => {
            // Swap roles
            isVideoAPlayingRef.current = !isVideoAPlayingRef.current;
            currentClipIndexRef.current = nextIndex;
            globalOffsetRef.current = nextClip.startTime;
            
            // Update last frame reference
            lastFrameDrawnRef.current = { video: inactiveVideo, time: 0 };
            
            // Update visibility state
            setIsAVisible(isVideoAPlayingRef.current);
            
            // Update time immediately after switching
            const newGlobalTime = inactiveVideo.currentTime + globalOffsetRef.current;
            onTimeUpdate(newGlobalTime);
            lastSeekTimeRef.current = newGlobalTime;
            lastUpdateTimeRef.current = Date.now();
            
            // Verify video is still playing after switch
            // Note: inactiveVideo is now the new activeVideo after swap
            const newActiveVideo = inactiveVideo; // This is the video we just started playing
            if (newActiveVideo.paused && isPlaying) {
              newActiveVideo.play().catch(() => {});
            }
            
            // Ensure render loop continues
            if (animationFrameRef.current === null) {
              animationFrameRef.current = requestAnimationFrame(render);
            }
            
            // Call onClipChange AFTER all state updates to avoid triggering re-render during switch
            setTimeout(() => {
              onClipChange?.(nextIndex);
            }, 0);
            // Preload the video after next
            const afterNextIndex = nextIndex + 1;
            if (afterNextIndex < clips.length) {
              const afterNextClip = clips[afterNextIndex];
              // Use the now-inactive video (which was the current one)
              if (currentVideo.src !== afterNextClip.url) {
                currentVideo.src = afterNextClip.url;
                currentVideo.preload = "auto";
                currentVideo.muted = isMuted;
                currentVideo.load();
              }
            }
          })
          .catch((err: Error) => {
            // Ignore AbortError - it's expected when play() is interrupted by pause()
            if (err.name !== 'AbortError') {
            }
          });
      };
      
      inactiveVideo.addEventListener("canplay", handleCanPlay, { once: true });
      inactiveVideo.addEventListener("canplaythrough", handleCanPlay, { once: true });
      inactiveVideo.load();
    }
  }, [clips, onEnded, onClipChange, isMuted]);

  // Initialize videos - avoid duplicate initialization
  useEffect(() => {
    if (clips.length === 0) return;

    const videoA = videoARef.current;
    const videoB = videoBRef.current;

    if (!videoA || !videoB) return;

    // Set initial video
    const firstClip = clips[0];
    
    // Check if already initialized to avoid Fast Refresh issues
    // Also check if we're in the middle of a video switch (currentClipIndexRef > 0)
    const isAlreadyInitialized = 
      (videoA.src === firstClip.url && 
       (clips.length === 1 || videoB.src === clips[1]?.url)) ||
      currentClipIndexRef.current > 0; // If we've already switched videos, don't reinitialize
    
    if (isAlreadyInitialized) {
      return;
    }
    videoA.src = firstClip.url;
    videoA.volume = volume;
    videoA.muted = isMuted;
    videoA.preload = "auto";
    videoA.load(); // Force load

    // Preload second video if available
    if (clips.length > 1) {
      videoB.src = clips[1].url;
      videoB.volume = volume;
      videoB.muted = isMuted;
      videoB.preload = "auto";
      videoB.load(); // Force load
    }

    currentClipIndexRef.current = 0;
    globalOffsetRef.current = firstClip.startTime;
    isVideoAPlayingRef.current = true;
    // Setup video event listeners
    const handleVideoAEnded = () => {
      switchToNextVideo();
    };

    const handleVideoBEnded = () => {
      switchToNextVideo();
    };

    const handleVideoALoaded = () => {
      // Trigger initial render when first video is loaded
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    const handleVideoBLoaded = () => {
    };

    videoA.addEventListener("ended", handleVideoAEnded);
    videoB.addEventListener("ended", handleVideoBEnded);
    videoA.addEventListener("loadeddata", handleVideoALoaded);
    videoB.addEventListener("loadeddata", handleVideoBLoaded);
    videoA.addEventListener("canplaythrough", handleVideoALoaded);
    videoB.addEventListener("canplaythrough", handleVideoBLoaded);

    // If video is already loaded, trigger render immediately
    if (videoA.readyState >= 2) {
      handleVideoALoaded();
    }
    if (videoB.readyState >= 2) {
      handleVideoBLoaded();
    }

    return () => {
      videoA.removeEventListener("ended", handleVideoAEnded);
      videoB.removeEventListener("ended", handleVideoBEnded);
      videoA.removeEventListener("loadeddata", handleVideoALoaded);
    };
  }, [clips, volume, isMuted, switchToNextVideo, render]);

  // Update isPlayingRef when isPlaying changes
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Play video from user interaction - this bypasses autoplay policy
  const playVideoFromUserInteraction = useCallback(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;

    const currentVideo = isVideoAPlayingRef.current ? videoA : videoB;

    // Ensure video is muted for autoplay policy (if needed)
    currentVideo.muted = isMuted;
    
    // Only play if video is ready
    if (currentVideo.readyState >= 2) {
      currentVideo.play()
        .then(() => {
          // Ensure render loop is running
          if (animationFrameRef.current === null) {
            animationFrameRef.current = requestAnimationFrame(render);
          }
        })
        .catch((err: Error) => {
          // Ignore AbortError - it's expected when play() is interrupted by pause()
          if (err.name !== 'AbortError') {
          }
        });
    } else {
      // Wait for video to be ready
      const handleCanPlay = () => {
        currentVideo.muted = isMuted;
        currentVideo.play()
          .then(() => {
            if (animationFrameRef.current === null) {
              animationFrameRef.current = requestAnimationFrame(render);
            }
          })
          .catch((err) => {
          });
      };
      currentVideo.addEventListener("canplay", handleCanPlay, { once: true });
      currentVideo.addEventListener("canplaythrough", handleCanPlay, { once: true });
      
      // Also try to load if not loading
      if (currentVideo.readyState === 0) {
        currentVideo.load();
      }
    }
  }, [isMuted, render]);

  // Playback control - pause only, play should be triggered by user interaction
  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;

    if (!isPlaying) {
      // pause() is synchronous and doesn't throw errors
      // But it can interrupt play() promises, which is expected behavior
      if (!videoA.paused) {
        videoA.pause();
      }
      if (!videoB.paused) {
        videoB.pause();
      }
    }
    // Note: Actual play() should be called from user interaction handler
    // This prevents browser autoplay policy blocking
  }, [isPlaying]);

  // Reset to first video
  const resetToFirst = useCallback(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB || clips.length === 0) return;
    
    // Pause both videos
    videoA.pause();
    videoB.pause();
    
    // Reset to first clip
    const firstClip = clips[0];
    currentClipIndexRef.current = 0;
    globalOffsetRef.current = firstClip.startTime;
    isVideoAPlayingRef.current = true;
    
    // Reset video A to first clip
    videoA.src = firstClip.url;
    videoA.currentTime = 0;
    videoA.muted = isMuted;
    videoA.load();
    
    // Reset video B to second clip if available
    if (clips.length > 1) {
      videoB.src = clips[1].url;
      videoB.currentTime = 0;
      videoB.muted = isMuted;
      videoB.load();
    } else {
      // If only one clip, clear videoB
      videoB.src = '';
      videoB.currentTime = 0;
    }
    
    // Update visibility state
    setIsAVisible(true);
    
    // Reset time to first clip's startTime (which should be 0 for the first clip)
    const resetTime = firstClip.startTime;
    onTimeUpdate(resetTime);
    lastSeekTimeRef.current = resetTime;
    lastUpdateTimeRef.current = Date.now();
    
    // Clear last frame reference
    lastFrameDrawnRef.current = { video: null, time: 0 };
    
    // Call onClipChange to notify parent
    setTimeout(() => {
      onClipChange?.(0);
    }, 0);
  }, [clips, isMuted, onTimeUpdate, onClipChange]);

  // Expose play function and reset function via ref
  React.useImperativeHandle(ref, () => ({
    playFromUserInteraction: playVideoFromUserInteraction,
    resetToFirst: resetToFirst,
  }), [playVideoFromUserInteraction, resetToFirst]);

  // Volume and mute control
  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (videoA) {
      videoA.volume = volume;
      videoA.muted = isMuted;
    }
    if (videoB) {
      videoB.volume = volume;
      videoB.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Seek control - only trigger on manual seek, not on every time update
  const lastSeekTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);

  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB || clips.length === 0) return;

    // If currently seeking, don't process new seek requests
    if (isSeekingRef.current) {
      return;
    }

    // Calculate time difference
    const timeDiff = Math.abs(currentTime - lastSeekTimeRef.current);

    // If playing, don't seek unless there's a significant time jump (manual seek)
    if (isPlayingRef.current) {
      // Only seek if time difference is large (>= 2 seconds), indicating manual seek
      if (timeDiff < 2.0) {
        // Small time difference during playback, skip seek to avoid interrupting playback
        return;
      }
    }

    // Mark as seeking
    isSeekingRef.current = true;
    lastSeekTimeRef.current = currentTime;

    // Find which clip corresponds to currentTime
    let targetClipIndex = 0;
    let relativeTime = 0;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        targetClipIndex = i;
        relativeTime = currentTime - clip.startTime;
        break;
      }
    }

    const targetClip = clips[targetClipIndex];
    if (!targetClip) return;

    // Update global offset
    globalOffsetRef.current = targetClip.startTime;

    // If we need to switch clips
    if (targetClipIndex !== currentClipIndexRef.current) {
      currentClipIndexRef.current = targetClipIndex;
      
      // Determine which video to use
      const shouldUseVideoA = isVideoAPlayingRef.current;
      
      if (shouldUseVideoA) {
        videoA.src = targetClip.url;
        videoA.currentTime = relativeTime;
        if (isPlaying) {
          videoA.play().catch((err: Error) => {
            // Ignore AbortError - it's expected when play() is interrupted by pause()
            if (err.name !== 'AbortError') {
            }
          });
        }
      } else {
        videoB.src = targetClip.url;
        videoB.currentTime = relativeTime;
        if (isPlaying) {
          videoB.play().catch((err: Error) => {
            // Ignore AbortError - it's expected when play() is interrupted by pause()
            if (err.name !== 'AbortError') {
            }
          });
        }
      }

      // Preload next clip
      if (targetClipIndex + 1 < clips.length) {
        const nextClip = clips[targetClipIndex + 1];
        if (shouldUseVideoA) {
          videoB.src = nextClip.url;
          videoB.preload = "auto";
        } else {
          videoA.src = nextClip.url;
          videoA.preload = "auto";
        }
      }

      onClipChange?.(targetClipIndex);
    } else {
      // Same clip, just seek (only if significant difference)
      if (timeDiff >= 2.0) {
        const currentVideo = isVideoAPlayingRef.current ? videoA : videoB;
        const wasPlaying = !currentVideo.paused;
        currentVideo.currentTime = relativeTime;
        // Resume playback if it was playing
        if (wasPlaying && isPlayingRef.current) {
          currentVideo.play().catch((err: Error) => {
            // Ignore AbortError - it's expected when play() is interrupted by pause()
            if (err.name !== 'AbortError') {
            }
          });
        }
      }
    }
    
    // Clear seeking flag after a short delay
    setTimeout(() => {
      isSeekingRef.current = false;
    }, 100);
  }, [currentTime, clips, isPlaying, onClipChange]);

  // Start/stop rendering loop - always render to show video frames even when paused
  useEffect(() => {
    // Always start rendering loop to show video frames
    const startRender = () => {
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    startRender();
    
    // Also ensure render loop continues even if it stops
    const checkRenderLoop = setInterval(() => {
      if (animationFrameRef.current === null) {
        startRender();
      }
    }, 1000);

    return () => {
      clearInterval(checkRenderLoop);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [render]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      {/* Dual Canvas - CanvasA for videoA, CanvasB for videoB */}
      <canvas
        ref={canvasARef}
        className="absolute w-full h-full object-contain"
        style={{ 
          maxWidth: "100%", 
          maxHeight: "100%",
          zIndex: isAVisible ? 2 : 1,
          opacity: isAVisible ? 1 : 0,
          transition: 'opacity 0.1s ease-in-out',
          pointerEvents: 'none'
        }}
      />
      <canvas
        ref={canvasBRef}
        className="absolute w-full h-full object-contain"
        style={{ 
          maxWidth: "100%", 
          maxHeight: "100%",
          zIndex: isAVisible ? 1 : 2,
          opacity: isAVisible ? 0 : 1,
          transition: 'opacity 0.1s ease-in-out',
          pointerEvents: 'none'
        }}
      />
      {/* Hidden video elements */}
      <video
        ref={videoARef}
        className="hidden"
        playsInline
        muted={isMuted}
      />
      <video
        ref={videoBRef}
        className="hidden"
        playsInline
        muted={isMuted}
      />
    </div>
  );
});

CanvasVideoPlayer.displayName = "CanvasVideoPlayer";

export default CanvasVideoPlayer;

