"use client";

import React, { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dynamically import ReactPlayer to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player"), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full">
      <div className="text-white">Loading player...</div>
    </div>
  )
}) as any;

interface EnhancedVideoPlayerProps {
  url: string;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  onPlay: () => void;
  onPause: () => void;
  onProgress: (progress: { played: number; playedSeconds: number }) => void;
  onDuration: (duration: number) => void;
  onError?: (error: any) => void;
  onReady?: () => void;
  onEnded?: () => void;
  className?: string;
  style?: React.CSSProperties;
  controls?: boolean;
  light?: boolean;
  pip?: boolean;
  playing?: boolean;
  loop?: boolean;
  playbackRate?: number;
  width?: string | number;
  height?: string | number;
}

export default function EnhancedVideoPlayer({
  url,
  isPlaying,
  volume,
  isMuted,
  currentTime,
  onPlay,
  onPause,
  onProgress,
  onDuration,
  onError,
  onReady,
  onEnded,
  className = "",
  style,
  controls = false,
  light = false,
  pip = false,
  playing = false,
  loop = false,
  playbackRate = 1,
  width = "100%",
  height = "100%",
}: EnhancedVideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const durationFetchedRef = useRef(false);

  // Sync playing state - ReactPlayer handles this via the `playing` prop
  // No need to manually control play/pause

  // Seek to current time
  useEffect(() => {
    if (playerRef.current && ready) {
      try {
        const internalPlayer = (playerRef.current as any).getInternalPlayer?.();
        if (internalPlayer) {
          const player = internalPlayer as HTMLVideoElement;
          if (player && Math.abs(player.currentTime - currentTime) > 0.5) {
            (playerRef.current as any).seekTo(currentTime, "seconds");
          }
        } else {
          // Fallback: use seekTo directly without checking current time
          (playerRef.current as any).seekTo(currentTime, "seconds");
        }
      } catch (err) {
        // Fallback: use seekTo directly
        try {
          (playerRef.current as any).seekTo(currentTime, "seconds");
        } catch (seekErr) {
          // Ignore seek errors
        }
      }
    }
  }, [currentTime, ready]);

  // Get duration when it becomes available
  useEffect(() => {
    if (playerRef.current && ready && !durationFetchedRef.current) {
      // Try to get duration from ReactPlayer's internal player
      try {
        const internalPlayer = (playerRef.current as any).getInternalPlayer?.();
        if (internalPlayer) {
          const videoElement = internalPlayer as HTMLVideoElement;
          if (videoElement && videoElement.duration && videoElement.duration > 0 && !isNaN(videoElement.duration)) {
            onDuration(videoElement.duration);
            durationFetchedRef.current = true;
          }
        }
      } catch (err) {
        // getInternalPlayer might not be available, try alternative approach
        // Duration will be available in onProgress callback
      }
    }
  }, [ready, url, onDuration]);

  // Debug: Check video element periodically
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    const checkVideo = () => {
      if (playerRef.current) {
        try {
          // Try multiple ways to get internal player
          const player = playerRef.current as any;
          let internalPlayer = null;
          
          // Method 1: getInternalPlayer()
          if (typeof player.getInternalPlayer === 'function') {
            internalPlayer = player.getInternalPlayer();
          }
          
          // Method 2: Direct access to internal player
          if (!internalPlayer && player.player) {
            internalPlayer = player.player;
          }
          
          // Method 3: Check for video element in DOM
          if (!internalPlayer) {
            const videoElements = document.querySelectorAll('video');
            if (videoElements.length > 0) {
              // Find the video element that matches our URL
              const urlFileName = url.split('/').pop() || '';
              for (const video of Array.from(videoElements)) {
                if (video.src && (video.src.includes(urlFileName) || video.currentSrc.includes(urlFileName))) {
                  internalPlayer = video;
                  break;
                }
              }
              // If no match, use the first video element
              if (!internalPlayer && videoElements.length > 0) {
                internalPlayer = videoElements[0];
              }
            }
          }
          
          if (internalPlayer) {
            const videoElement = internalPlayer as HTMLVideoElement;
            const hasSrc = !!videoElement.src;
            const hasCurrentSrc = !!videoElement.currentSrc;
            const sources = Array.from(videoElement.querySelectorAll('source')).map(s => ({
              src: s.src,
              type: s.type
            }));
            
            const error = videoElement.error;
            const errorInfo = error ? {
              code: error.code,
              message: error.message,
              codeDescription: error.code === 1 ? 'MEDIA_ERR_ABORTED' :
                              error.code === 2 ? 'MEDIA_ERR_NETWORK' :
                              error.code === 3 ? 'MEDIA_ERR_DECODE' :
                              error.code === 4 ? 'MEDIA_ERR_SRC_NOT_SUPPORTED' : 'Unknown'
            } : null;
            
            console.log('🔍 Video element check:', {
              readyState: videoElement.readyState,
              networkState: videoElement.networkState,
              networkStateText: videoElement.networkState === 0 ? 'NETWORK_EMPTY' :
                                videoElement.networkState === 1 ? 'NETWORK_IDLE' :
                                videoElement.networkState === 2 ? 'NETWORK_LOADING' :
                                videoElement.networkState === 3 ? 'NETWORK_NO_SOURCE' : 'Unknown',
              videoWidth: videoElement.videoWidth,
              videoHeight: videoElement.videoHeight,
              duration: videoElement.duration,
              src: videoElement.src?.substring(0, 50) + '...',
              currentSrc: videoElement.currentSrc?.substring(0, 50) + '...',
              error: errorInfo,
              paused: videoElement.paused,
              method: 'found',
              hasSrc,
              hasCurrentSrc,
              sourcesCount: sources.length,
              sources: sources.slice(0, 3) // Show first 3 sources
            });
            
            // If networkState is 3 (NETWORK_NO_SOURCE), try to reload
            if (videoElement.networkState === 3 && hasSrc) {
              console.log('⚠️ Network state is NETWORK_NO_SOURCE, trying to reload video...');
              console.log('⚠️ This usually means CORS issue or video URL is not accessible');
              try {
                // Remove crossOrigin attribute if present (may cause CORS issues)
                if (videoElement.hasAttribute('crossorigin')) {
                  videoElement.removeAttribute('crossorigin');
                  console.log('✅ Removed crossorigin attribute');
                }
                // Try to reload
                videoElement.load();
                console.log('✅ Called videoElement.load()');
              } catch (err) {
                console.error('❌ Error reloading video:', err);
              }
            }
            
            // If video has no src and we have a URL, try to set it manually
            if (!hasSrc && !hasCurrentSrc && url && sources.length === 0) {
              console.log('⚠️ Video element has no src, trying to set it manually');
              try {
                videoElement.src = url;
                videoElement.load();
                console.log('✅ Manually set video src:', url.substring(0, 50) + '...');
              } catch (err) {
                console.error('❌ Error setting video src:', err);
              }
            } else if (hasSrc || hasCurrentSrc || sources.length > 0) {
              console.log('✅ Video element has src, waiting for load...');
            }
          } else {
            console.log('🔍 No internal player yet', {
              hasPlayerRef: !!playerRef.current,
              playerType: player?.constructor?.name,
              playerKeys: player ? Object.keys(player).slice(0, 10) : []
            });
          }
        } catch (err) {
          console.warn('🔍 Error checking video:', err);
        }
      } else {
        console.log('🔍 No playerRef.current');
      }
    };

    // Wait a bit before first check to allow ReactPlayer to initialize
    const timeoutId = setTimeout(() => {
      checkVideo();
      intervalId = setInterval(checkVideo, 2000);
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [url]);

  const handlePlay = () => {
    onPlay();
  };

  const handlePause = () => {
    onPause();
  };

  const handleProgress = (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => {
    onProgress(state);
    // Try to get duration from progress state if available
    if (!durationFetchedRef.current && playerRef.current) {
      try {
        const internalPlayer = (playerRef.current as any).getInternalPlayer?.();
        if (internalPlayer) {
          const videoElement = internalPlayer as HTMLVideoElement;
          if (videoElement && videoElement.duration && videoElement.duration > 0 && !isNaN(videoElement.duration)) {
            onDuration(videoElement.duration);
            durationFetchedRef.current = true;
          }
        }
      } catch (err) {
        // Ignore errors
      }
    }
  };

  const handleReady = () => {
    console.log('🎉 EnhancedVideoPlayer: handleReady called');
    setReady(true);
    durationFetchedRef.current = false; // Reset when new video loads
    
    // Try to get video dimensions for aspect ratio
    try {
      const internalPlayer = (playerRef.current as any).getInternalPlayer?.();
      console.log('EnhancedVideoPlayer: Internal player:', {
        hasInternalPlayer: !!internalPlayer,
        playerType: internalPlayer?.constructor?.name
      });
      
      if (internalPlayer) {
        const videoElement = internalPlayer as HTMLVideoElement;
        console.log('EnhancedVideoPlayer: Video element info:', {
          videoWidth: videoElement.videoWidth,
          videoHeight: videoElement.videoHeight,
          duration: videoElement.duration,
          readyState: videoElement.readyState,
          networkState: videoElement.networkState,
          src: videoElement.src,
          currentSrc: videoElement.currentSrc
        });
        
        if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
          const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
          console.log('EnhancedVideoPlayer: Aspect ratio:', aspectRatio);
          // Note: We can't directly set aspect ratio here, but the parent component
          // can listen to onReady and get dimensions if needed
        }
      }
    } catch (err) {
      console.error('EnhancedVideoPlayer: Error getting internal player:', err);
    }
    
    onReady?.();
  };

  const handleError = (error: any) => {
    console.error("❌ ReactPlayer error:", error);
    console.error("❌ ReactPlayer error details:", {
      url: url.substring(0, 50) + '...',
      error: error,
      errorType: typeof error,
      errorString: String(error),
      errorKeys: error ? Object.keys(error) : []
    });
    
    // Try to get more error details from internal player
    try {
      const internalPlayer = (playerRef.current as any).getInternalPlayer?.();
      console.log('EnhancedVideoPlayer: Checking internal player for errors:', {
        hasInternalPlayer: !!internalPlayer
      });
      
      if (internalPlayer) {
        const videoElement = internalPlayer as HTMLVideoElement;
        const mediaError = videoElement.error;
        console.log('EnhancedVideoPlayer: Video element state:', {
          error: mediaError,
          errorCode: mediaError?.code,
          errorMessage: mediaError?.message,
          networkState: videoElement.networkState,
          readyState: videoElement.readyState,
          src: videoElement.src,
          currentSrc: videoElement.currentSrc,
          videoWidth: videoElement.videoWidth,
          videoHeight: videoElement.videoHeight
        });
        
        if (mediaError) {
          console.error("❌ Video element error:", {
            code: mediaError.code,
            message: mediaError.message,
            networkState: videoElement.networkState,
            readyState: videoElement.readyState
          });
        }
      }
    } catch (err) {
      console.warn("Could not get error details:", err);
    }
    
    onError?.(error);
  };

  const handleEnded = () => {
    console.log('🎬 EnhancedVideoPlayer: Video ended', { url: url.substring(0, 50) + '...' });
    onEnded?.();
  };

  const handleFullscreen = () => {
    if (playerRef.current) {
      try {
        const internalPlayer = (playerRef.current as any).getInternalPlayer?.();
        if (internalPlayer) {
          const player = internalPlayer as HTMLVideoElement;
          if (player.requestFullscreen) {
            player.requestFullscreen();
          } else if ((player as any).webkitRequestFullscreen) {
            (player as any).webkitRequestFullscreen();
          } else if ((player as any).mozRequestFullScreen) {
            (player as any).mozRequestFullScreen();
          } else if ((player as any).msRequestFullscreen) {
            (player as any).msRequestFullscreen();
          }
        }
      } catch (err) {
        console.warn("Could not enter fullscreen:", err);
      }
    }
  };

  if (!url || url.trim() === '') {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`} style={style}>
        <div className="text-center text-gray-400">
          <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No video URL provided</p>
        </div>
      </div>
    );
  }

  console.log('EnhancedVideoPlayer render:', {
    url: url.substring(0, 50) + '...',
    isPlaying,
    hasRef: !!playerRef.current,
    className,
    style
  });

  return (
    <div 
      className={`relative w-full h-full ${className}`} 
      style={{ ...style, minHeight: '200px', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ width: '100%', height: '100%', position: 'relative', minHeight: '200px' }}>
        <ReactPlayer
          ref={playerRef}
          url={url}
          playing={isPlaying}
          volume={volume}
          muted={isMuted}
          playbackRate={playbackRate}
          controls={controls}
          light={light}
          pip={pip}
          loop={loop}
          width="100%"
          height="100%"
          progressInterval={50}
          onPlay={handlePlay}
          onPause={handlePause}
          onProgress={handleProgress as any}
          onReady={handleReady as any}
          onError={handleError as any}
          onEnded={handleEnded}
          onStart={() => {
            console.log('🎬 ReactPlayer: Video started');
          }}
          onLoadStart={() => {
            console.log('📥 ReactPlayer: Load started');
          }}
          onLoadedMetadata={() => {
            console.log('📊 ReactPlayer: Metadata loaded');
          }}
          config={{
            file: {
              attributes: {
                // Removed crossOrigin to avoid CORS issues
                // crossOrigin: "anonymous",
                playsInline: true,
                preload: "auto",
              },
              forceVideo: true,
              forceHLS: false,
              forceDASH: false,
            },
          } as any}
        />
      </div>
      
      {/* Debug overlay - shows URL in development */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ 
          position: 'absolute', 
          top: 10, 
          left: 10, 
          background: 'rgba(255,255,255,0.9)', 
          color: 'black', 
          padding: '4px 8px', 
          fontSize: '11px',
          zIndex: 1000,
          borderRadius: '4px',
          maxWidth: '80%',
          wordBreak: 'break-all'
        }}>
          URL: {url.substring(0, 50)}...
        </div>
      )}
      
      {/* Custom controls overlay (if needed) */}
      {!controls && (
        <div className="absolute bottom-4 right-4 z-10">
          <Button
            onClick={handleFullscreen}
            className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
            size="sm"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

