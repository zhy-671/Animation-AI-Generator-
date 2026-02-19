"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Play, 
  Pause, 
  Scissors, 
  Trash2, 
  Move, 
  SkipBack, 
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Download,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  Mic,
  Film,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Diamond
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Header from "@/components/header/header";
import StoryboardNav from "./storyboard-nav";
import { useToast } from "@/components/ui/toast-notification";
import EnhancedVideoPlayer from "./enhanced-video-player";
import CanvasVideoPlayer, { CanvasVideoPlayerRef } from "./canvas-video-player";
import { getUserSubscriptionPlan } from "@/lib/subscription/client";
import { isCompleteVideoExportAllowed, calculateVideoCredits, type SubscriptionPlan } from "@/lib/subscription/rules";
import { ExportDialog } from "./export-dialog";

interface Shot {
  shot_number: number;
  description: string;
  image_prompt: string;
  video_prompt?: string; // Video generation prompt
  framing: string;
  camera_angle: string;
  camera_movement?: string;
  composition?: string;
  lighting?: string;
  mood?: string;
  narration: string;
  dialogue: string;
  characters?: string;
  image_url?: string;
  video_url?: string;
}

interface VideoClip {
  id: string;
  url: string;
  startTime: number; // Start time on timeline (seconds)
  duration: number; // Video duration (seconds)
  sceneItemId?: string;
  shotNumber?: number;
  sceneNumber?: number;
  thumbnail?: string;
  shotData?: Shot; // Associated storyboard data
}

interface Subtitle {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  type: "narration" | "character"; // Narration or character
  characterName?: string; // Character name if type is character
  x?: number; // X position for canvas rendering (optional)
  y?: number; // Y position for canvas rendering (optional)
}

interface Voiceover {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  audioUrl?: string; // Generated audio URL
}

interface VideoTrack {
  id: string;
  clips: VideoClip[];
}

interface SubtitleTrack {
  id: string;
  subtitles: Subtitle[];
}

interface VoiceoverTrack {
  id: string;
  voiceovers: Voiceover[];
}

const wrapTextWithContext = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2
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

      if (lines.length === maxLines - 1) {
        const remaining = units.slice(i + 1).join(separator);
        currentLine = remaining ? `${currentLine}${separator}${remaining}` : currentLine;
        break;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
};

export default function VideoEditor() {
  const router = useRouter();
  const { showError, showSuccess, showInfo, showWarning } = useToast();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [tracks, setTracks] = useState<VideoTrack[]>([
    { id: "track-1", clips: [] }
  ]);
  const [subtitleTrack, setSubtitleTrack] = useState<SubtitleTrack>({
    id: "subtitle-track",
    subtitles: []
  });
  const [voiceoverTrack, setVoiceoverTrack] = useState<VoiceoverTrack>({
    id: "voiceover-track",
    voiceovers: []
  });
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0); // Initial position at 0 seconds
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const timelineTracksRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true); // Subtitle display toggle
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [videoContainerSize, setVideoContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const canvasPlayerRef = useRef<CanvasVideoPlayerRef>(null);
  const [useCanvasPlayer, setUseCanvasPlayer] = useState(true); // Use canvas player for dual video + subtitle rendering
  const measurementCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const getMeasurementContext = useCallback((): CanvasRenderingContext2D | null => {
    if (!measurementCanvasRef.current) {
      measurementCanvasRef.current = document.createElement("canvas");
    }
    return measurementCanvasRef.current.getContext("2d");
  }, []);
  const [subtitlePreviewLayout, setSubtitlePreviewLayout] = useState<{
    lines: string[];
    fontSize: number;
    lineHeight: number;
    maxWidth: number;
  } | null>(null);
  
  // Tab state: "subtitles" | "voiceover" | "scenes"
  const [activeTab, setActiveTab] = useState<"subtitles" | "voiceover" | "scenes">("scenes");
  
  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showExportCompleteDialog, setShowExportCompleteDialog] = useState(false);
  
  // Subscription plan state
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(null);
  
  // Project step status state
  const [projectStepStatus, setProjectStepStatus] = useState<{
    step_script: boolean;
    step_settings: boolean;
    step_storyboard: boolean;
    step_video: boolean;
  } | null>(null);
  
  // Timeline state
  const [timelineZoom, setTimelineZoom] = useState(1); // Zoom level for timeline
  const pixelsPerSecond = 50; // Base pixels per second
  const [timelineViewportWidth, setTimelineViewportWidth] = useState<number>(0);
  
  // Calculate auto zoom to fit all videos in viewport (only on initial load)
  const [autoZoomCalculated, setAutoZoomCalculated] = useState(false);
  useEffect(() => {
    if (totalDuration > 0 && timelineTracksRef.current && !autoZoomCalculated) {
      const viewportWidth = timelineTracksRef.current.clientWidth;
      if (viewportWidth > 0) {
        setTimelineViewportWidth(viewportWidth);
        // Calculate auto zoom: viewport width / (totalDuration * pixelsPerSecond)
        const autoZoom = viewportWidth / (totalDuration * pixelsPerSecond);
        // Only set auto zoom on initial load
        setTimelineZoom(autoZoom);
        setAutoZoomCalculated(true);
      }
    }
  }, [totalDuration, autoZoomCalculated]); // Only recalculate when totalDuration changes and not yet calculated
  
  // Update viewport width on resize
  useEffect(() => {
    const updateViewportWidth = () => {
      if (timelineTracksRef.current) {
        setTimelineViewportWidth(timelineTracksRef.current.clientWidth);
      }
    };
    
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);
  
  // Handle zoom in/out
  const handleZoomIn = () => {
    setTimelineZoom(prev => Math.min(prev * 1.2, 5)); // Max zoom 5x
  };
  
  const handleZoomOut = () => {
    setTimelineZoom(prev => Math.max(prev / 1.2, 0.1)); // Min zoom 0.1x
  };
  
  // Calculate if horizontal scroll is needed
  // Add horizontal scrollbar if zoom is greater than 110%, remove if 100% or less
  const needsHorizontalScroll = timelineZoom > 1.1; // 110% = 1.1
  
  // Subtitle editing panel state
  const [subtitleType, setSubtitleType] = useState<"narration" | "character">("character");
  const [subtitleContent, setSubtitleContent] = useState<string>("");
  const [editingSubtitleId, setEditingSubtitleId] = useState<string | null>(null);
  
  // Scene data (includes storyboard information)
  const [sceneData, setSceneData] = useState<any>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Video generation settings
  const [videoQuality, setVideoQuality] = useState<"480P" | "720P" | "1080P">("720P");
  const [videoDuration, setVideoDuration] = useState<10 | 15>(10);
  
  // Editable video description
  const [editingVideoDescription, setEditingVideoDescription] = useState<string>("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  
  // Video player type: 'native' | 'react-player' | 'videojs'
  const [playerType, setPlayerType] = useState<"native" | "react-player">("react-player");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videosLoaded, setVideosLoaded] = useState(false); // Track if videos have been loaded
  const currentPlayingClipRef = useRef<VideoClip | null>(null); // Track currently playing video clip
  
  // Video playback refs
  const clipsArrayRef = useRef<VideoClip[]>([]); // All video clips array
  const currentClipIndexRef = useRef<number>(0); // Current clip index
  const [statusScript, setStatusScript] = useState(false);
  const [statusSettings, setStatusSettings] = useState(false);
  const [statusStoryboard, setStatusStoryboard] = useState(false);
  const [statusVideo, setStatusVideo] = useState(false);

  // Listen for container width changes, recalculate video height
  useEffect(() => {
    const updateContainerSize = () => {
      if (videoContainerRef.current) {
        setVideoContainerSize({
          width: videoContainerRef.current.offsetWidth,
          height: videoContainerRef.current.offsetHeight,
        });
      }
    };

    updateContainerSize();
    const resizeObserver = new ResizeObserver(updateContainerSize);
    if (videoContainerRef.current) {
      resizeObserver.observe(videoContainerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const activeSubtitle = useMemo(() => {
    return subtitleTrack.subtitles.find(
      (subtitle) => currentTime >= subtitle.startTime && currentTime < subtitle.endTime
    );
  }, [subtitleTrack.subtitles, currentTime]);

  useEffect(() => {
    if (!showSubtitles) {
      setSubtitlePreviewLayout(null);
      return;
    }

    if (!activeSubtitle?.text) {
      setSubtitlePreviewLayout(null);
      return;
    }

    const ctx = getMeasurementContext();
    if (!ctx) {
      return;
    }

    const { width: containerWidth, height: containerHeight } = videoContainerSize;
    if (!containerWidth || !containerHeight) {
      return;
    }

    const aspectRatio =
      videoDimensions?.width && videoDimensions.height
        ? videoDimensions.width / videoDimensions.height
        : containerWidth && containerHeight
          ? containerWidth / containerHeight
          : 16 / 9;

    const isPortrait = aspectRatio < 1;
    const effectiveWidth = containerWidth;
    const maxWidth = effectiveWidth * (isPortrait ? 0.88 : 0.72);
    const scaleDimension = Math.min(effectiveWidth, effectiveWidth / aspectRatio || containerHeight || effectiveWidth);
    let fontSize = Math.max(Math.min(scaleDimension * (isPortrait ? 0.032 : 0.028), 26), 14);

    ctx.font = `600 ${fontSize}px "Noto Sans", "Microsoft YaHei", "Arial", sans-serif`;
    let lines = wrapTextWithContext(ctx, activeSubtitle.text, maxWidth, 2);

    while (lines.length > 2 && fontSize > 12) {
      fontSize -= 1;
      ctx.font = `600 ${fontSize}px "Noto Sans", "Microsoft YaHei", "Arial", sans-serif`;
      lines = wrapTextWithContext(ctx, activeSubtitle.text, maxWidth, 2);
    }

    setSubtitlePreviewLayout({
      lines,
      fontSize,
      lineHeight: fontSize * 1.25,
      maxWidth,
    });
  }, [showSubtitles, getMeasurementContext, videoContainerSize, videoDimensions, activeSubtitle]);

  // Load subscription plan
  useEffect(() => {
    const loadSubscriptionPlan = async () => {
      try {
        const planData = await getUserSubscriptionPlan();
        if (planData.plan !== undefined) {
          setSubscriptionPlan(planData.plan);
        }
      } catch (error) {
      }
    };
    
    loadSubscriptionPlan();
  }, []);

  // Load project information and videos
  useEffect(() => {
    if (!projectId) {
      router.push("/storyboard");
      return;
    }

    loadProjectData();
    loadProjectStepStatus();
    
    // Load videos only once using safe pattern
    if (!videosLoaded) {
      loadVideos();
    }
  }, [projectId, videosLoaded]);

  // Load project step status (only query once on page load)
  const loadProjectStepStatus = async () => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/storyboard/project-step-status?projectId=${projectId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setProjectStepStatus(result.data);
        } else {
          // If query fails, default all steps to incomplete
          setProjectStepStatus({
            step_script: false,
            step_settings: false,
            step_storyboard: false,
            step_video: false,
          });
        }
      } else {
        // Query failed, default all steps to incomplete
        setProjectStepStatus({
          step_script: false,
          step_settings: false,
          step_storyboard: false,
          step_video: false,
        });
      }
    } catch (error) {
      // Query failed, default all steps to incomplete
      setProjectStepStatus({
        step_script: false,
        step_settings: false,
        step_storyboard: false,
        step_video: false,
      });
    }
  };

  // Check if all previous steps are completed (script, settings, storyboard)
  const arePreviousStepsCompleted = (): boolean => {
    if (!projectStepStatus) return false;
    return projectStepStatus.step_script && 
           projectStepStatus.step_settings && 
           projectStepStatus.step_storyboard;
  };


  const loadProjectData = async () => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/storyboard/projects/${projectId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setProjectTitle(result.data.title || "");
          setStatusScript(result.data.status_script || false);
          setStatusSettings(result.data.status_settings || false);
          setStatusStoryboard(result.data.status_storyboard || false);
          setStatusVideo(result.data.status_video || false);
        }
      }
    } catch (error) {
    }
  };

  const loadVideos = async () => {
    if (!projectId || videosLoaded) return; // Prevent duplicate loading
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/scenes?projectId=${projectId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const loadedSceneData = result.data;
          setSceneData(loadedSceneData); // Save complete scene data
          // Status is read from database, no need to set separately
          
          // Extract all videos from scene data
          const videoClips: VideoClip[] = [];
          let currentTime = 0;
          
          if (loadedSceneData.items) {
            // Process each item safely using for...of loop
            for (const item of loadedSceneData.items) {
              // Check if storyboard data exists
              if (item.metadata?.storyboard?.shots) {
                const shots = item.metadata.storyboard.shots;
                
                // Process each shot safely - use for...of loop for better error handling
                for (const shot of shots) {
                  if (!shot?.video_url) {
                    continue; // Skip shots without video_url to prevent crashes
                  }
                  
                  // Add clip safely
                  videoClips.push({
                    id: `clip-${item.id}-${shot.shot_number}`,
                    url: shot.video_url,
                    startTime: currentTime,
                    duration: 5, // Default 5 seconds, should be obtained from video metadata
                    sceneItemId: item.id,
                    shotNumber: shot.shot_number,
                    sceneNumber: item.scene_number,
                    thumbnail: shot.image_url || shot.thumbnail || shot.thumbnail_url || "", // Save thumbnail URL
                    shotData: shot, // Save complete storyboard data
                  });
                  
                  currentTime += 5;
                }
              } else if (item.video_url) {
                // If no storyboard, use scene video
                videoClips.push({
                  id: `clip-${item.id}`,
                  url: item.video_url,
                  startTime: currentTime,
                  duration: 5,
                  sceneItemId: item.id,
                  sceneNumber: item.scene_number,
                });
                currentTime += 5;
              }
            }
          }
          
          // Update tracks
          if (videoClips.length > 0) {
            setTracks([{ id: "track-1", clips: videoClips }]);
            setTotalDuration(currentTime);
            // Select first video clip by default
            if (videoClips.length > 0) {
              setSelectedClipId(videoClips[0].id);
              currentPlayingClipRef.current = videoClips[0];
              currentClipIndexRef.current = 0;
              // Set initial time to 0
              setCurrentTime(0);
            }
            
            // Initialize video playback
            clipsArrayRef.current = videoClips;
            
            // Check if any clips have valid URLs
            const clipsWithUrls = videoClips.filter(c => c.url && c.url.trim() !== '');
            
            if (clipsWithUrls.length === 0) {
            } else {
              // Videos loaded successfully
            }
            
            // Extract subtitle information from storyboard data (only dialogue, not narration)
            const subtitles: Subtitle[] = [];
            let subtitleTime = 0;
            videoClips.forEach((clip) => {
              if (clip.shotData) {
                // Only add dialogue to subtitle track, skip narration
                if (clip.shotData.dialogue && clip.shotData.dialogue.trim()) {
                  subtitles.push({
                    id: `subtitle-${clip.id}-dialogue`,
                    text: clip.shotData.dialogue,
                    startTime: subtitleTime,
                    endTime: subtitleTime + clip.duration,
                    type: "character"
                  });
                }
                subtitleTime += clip.duration;
              }
            });
            
            if (subtitles.length > 0) {
              setSubtitleTrack({
                id: "subtitle-track",
                subtitles: subtitles
              });
            }
          } else {
            // If no videos, notify user and redirect
            showWarning("This project has no storyboard videos. Please generate storyboard videos first");
            setTimeout(() => {
              router.push(`/storyboard/create?projectId=${projectId}`);
            }, 2000);
          }
        }
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) {
      return "00:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      // Pause playback
      setIsPlaying(false);
    } else {
      // Start playback - trigger from user interaction to bypass autoplay policy
          setIsPlaying(true);
      // Call play function directly from user interaction context
      if (useCanvasPlayer && canvasPlayerRef.current) {
        canvasPlayerRef.current.playFromUserInteraction();
      }
    }
  };

  // Handle playhead drag
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPlayhead(true);
    // Store whether video was playing before drag
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      setIsPlaying(false);
    }
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!timelineContainerRef.current) return;
      
      const rect = timelineContainerRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const newTime = Math.max(0, Math.min(totalDuration, x / (pixelsPerSecond * timelineZoom)));
      setCurrentTime(newTime);
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDraggingPlayhead(false);
      // Seek to final position using the mouse up position
      if (timelineContainerRef.current) {
        const rect = timelineContainerRef.current.getBoundingClientRect();
        const x = upEvent.clientX - rect.left;
        const finalTime = Math.max(0, Math.min(totalDuration, x / (pixelsPerSecond * timelineZoom)));
        handleSeek(finalTime);
        
        // Resume playback if it was playing before drag
        if (wasPlaying) {
              setIsPlaying(true);
          // Trigger play from user interaction for Canvas player
          if (useCanvasPlayer && canvasPlayerRef.current) {
            canvasPlayerRef.current.playFromUserInteraction();
          }
        }
      }
      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Initial position update
    if (timelineContainerRef.current) {
      const rect = timelineContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newTime = Math.max(0, Math.min(totalDuration, x / (pixelsPerSecond * timelineZoom)));
      setCurrentTime(newTime);
    }
  };

  const handleSeek = (time: number) => {
    // Cannot be less than 0 seconds (can equal 0), cannot be greater than total duration (can equal total duration)
    const clampedTime = Math.max(0, Math.min(totalDuration, time));
    setCurrentTime(clampedTime);
    
    // Update current clip based on playhead position
      const clips = clipsArrayRef.current;
      const targetClip = getCurrentVideoClip(clampedTime);
      
      if (targetClip && targetClip.url) {
      // Update refs
        currentPlayingClipRef.current = targetClip;
        
        // Find clip index
        if (clips && clips.length > 0) {
          const clipIndex = clips.findIndex(c => c.id === targetClip.id);
          if (clipIndex >= 0) {
            currentClipIndexRef.current = clipIndex;
          }
        }
        
      // Update selected clip ID to trigger video switch (for react-player)
      // The key prop on EnhancedVideoPlayer will force re-render when clip changes
      if (selectedClipId !== targetClip.id) {
        setSelectedClipId(targetClip.id);
      }
      
      // For native video element (fallback)
      if (videoRef.current && playerType !== "react-player") {
        const relativeTime = clampedTime - targetClip.startTime;
        
        // Set video source if different
        if (videoRef.current.src !== targetClip.url) {
          const videoUrl = targetClip.url;
          let mimeType = '';
          if (videoUrl.toLowerCase().endsWith('.mp4')) {
            mimeType = 'video/mp4';
          } else if (videoUrl.toLowerCase().endsWith('.webm')) {
            mimeType = 'video/webm';
          } else if (videoUrl.toLowerCase().endsWith('.ogg')) {
            mimeType = 'video/ogg';
          }
          
          videoRef.current.innerHTML = '';
          if (mimeType) {
            const source = document.createElement('source');
            source.src = videoUrl;
            source.type = mimeType;
            videoRef.current.appendChild(source);
          } else {
            videoRef.current.src = videoUrl;
          }
          videoRef.current.load();
        }
        
        // Set video time
        videoRef.current.currentTime = Math.max(0, Math.min(relativeTime, targetClip.duration));
      }
    }
  };


  // Update time and playhead position based on video playback
  // Note: For react-player, this is handled by onProgress callback
  // This effect is mainly for native video element fallback
  useEffect(() => {
    if (!isPlaying || !videoRef.current || playerType === "react-player") return;
    
    const updateTime = () => {
      if (!videoRef.current) return;
      
      const clips = clipsArrayRef.current;
      const currentClip = getCurrentVideoClip(videoRef.current.currentTime);
      
      if (currentClip) {
        const relativeTime = videoRef.current.currentTime;
        const absoluteTime = currentClip.startTime + relativeTime;
        
        // Update current time
        setCurrentTime(absoluteTime);
        
        // Check if we need to switch to next clip
        if (absoluteTime >= currentClip.startTime + currentClip.duration) {
          switchToNextVideo();
        }
      } else {
        // Fallback: use video currentTime directly
        setCurrentTime(videoRef.current.currentTime);
      }
    };
    
    const interval = setInterval(updateTime, 100); // Update every 100ms
    
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration, playerType]);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const handleSplitClip = (clipId: string, splitTime: number) => {
    setTracks(prevTracks => {
      return prevTracks.map(track => {
        const clipIndex = track.clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return track;
        
        const clip = track.clips[clipIndex];
        const relativeTime = splitTime - clip.startTime;
        
        if (relativeTime <= 0 || relativeTime >= clip.duration) return track;
        
        const newClips = [...track.clips];
        const firstPart = {
          ...clip,
          duration: relativeTime
        };
        const secondPart = {
          ...clip,
          id: `${clip.id}-split-${Date.now()}`,
          startTime: clip.startTime + relativeTime,
          duration: clip.duration - relativeTime
        };
        
        newClips.splice(clipIndex, 1, firstPart, secondPart);
        
        // Recalculate timing for subsequent clips
        let currentTime = secondPart.startTime + secondPart.duration;
        for (let i = clipIndex + 2; i < newClips.length; i++) {
          newClips[i].startTime = currentTime;
          currentTime += newClips[i].duration;
        }
        
        setTotalDuration(currentTime);
        
        return { ...track, clips: newClips };
      });
    });
  };

  const handleDeleteClip = (clipId: string) => {
    setTracks(prevTracks => {
      return prevTracks.map(track => {
        const clipIndex = track.clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return track;
        
        const clip = track.clips[clipIndex];
        const newClips = track.clips.filter(c => c.id !== clipId);
        
        // Recalculate timing for subsequent clips
        let currentTime = clip.startTime;
        for (let i = clipIndex; i < newClips.length; i++) {
          newClips[i].startTime = currentTime;
          currentTime += newClips[i].duration;
        }
        
        setTotalDuration(currentTime);
        
        return { ...track, clips: newClips };
      });
    });
    setSelectedClipId(null);
  };

  const handleMoveClip = (clipId: string, newStartTime: number) => {
    setTracks(prevTracks => {
      return prevTracks.map(track => {
        const clipIndex = track.clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return track;
        
        const clip = track.clips[clipIndex];
        const newClips = [...track.clips];
        newClips[clipIndex] = { ...clip, startTime: newStartTime };
        
        // Re-sort and recalculate timing
        newClips.sort((a, b) => a.startTime - b.startTime);
        let currentTime = 0;
        newClips.forEach(c => {
          c.startTime = currentTime;
          currentTime += c.duration;
        });
        
        setTotalDuration(currentTime);
        
        return { ...track, clips: newClips };
      });
    });
  };

  // Get the currently playing video clip
  const getCurrentVideoClip = (time?: number): VideoClip | null => {
    const checkTime = time !== undefined ? time : currentTime;
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (checkTime >= clip.startTime && checkTime < clip.startTime + clip.duration) {
          return clip;
        }
      }
    }
    return tracks[0]?.clips[0] || null;
  };

  const currentClip = getCurrentVideoClip();

  // Switch to next video smoothly
  const switchToNextVideo = () => {
    const clips = clipsArrayRef.current;
    if (!clips || clips.length === 0) {
      return;
    }
    
    const currentIndex = currentClipIndexRef.current;
    
    if (currentIndex >= clips.length - 1) {
      // All videos finished, reset to first
      setIsPlaying(false);
      currentClipIndexRef.current = 0;
      setCurrentTime(0);
      if (clips.length > 0) {
        setSelectedClipId(clips[0].id);
        currentPlayingClipRef.current = clips[0];
      }
      return;
    }
    
    // Switch to next video
    const nextIndex = currentIndex + 1;
    const nextClip = clips[nextIndex];
    
    if (nextClip && nextClip.url) {
      // Update index first
      currentClipIndexRef.current = nextIndex;
      
      // Update playhead position
      setCurrentTime(nextClip.startTime);
      currentPlayingClipRef.current = nextClip;
      
      // Update selected clip ID to trigger video switch (for react-player)
      // This will cause EnhancedVideoPlayer to re-render with new URL via key prop
      setSelectedClipId(nextClip.id);
      
      // For native video element (fallback)
      if (videoRef.current && playerType !== "react-player") {
      // Set next video source
      const videoUrl = nextClip.url;
      let mimeType = '';
      if (videoUrl.toLowerCase().endsWith('.mp4')) {
        mimeType = 'video/mp4';
      } else if (videoUrl.toLowerCase().endsWith('.webm')) {
        mimeType = 'video/webm';
      } else if (videoUrl.toLowerCase().endsWith('.ogg')) {
        mimeType = 'video/ogg';
      }
      
      videoRef.current.innerHTML = '';
      if (mimeType) {
        const source = document.createElement('source');
        source.src = videoUrl;
        source.type = mimeType;
        videoRef.current.appendChild(source);
      } else {
        videoRef.current.src = videoUrl;
      }
      
      // Load and play next video
      videoRef.current.load();
        if (isPlaying && videoRef.current) {
          videoRef.current.play().catch((err) => {
            if (err.name !== "AbortError" && err.name !== "NotAllowedError") {
          setIsPlaying(false);
            }
        });
      }
      }
    }
  };

  
  // Get currently selected storyboard data (if none selected, return first)
  const getSelectedShot = (): Shot | null => {
    let targetClip: VideoClip | null = null;
    
    if (selectedClipId) {
      for (const track of tracks) {
        const clip = track.clips.find(c => c.id === selectedClipId);
        if (clip) {
          targetClip = clip;
          break;
        }
      }
    }
    
    // If no clip is selected, use the first video clip
    if (!targetClip && tracks.length > 0 && tracks[0].clips.length > 0) {
      targetClip = tracks[0].clips[0];
    }
    
    return targetClip?.shotData || null;
  };
  
  // Get the currently selected video clip (returns first clip if none selected)
  const getCurrentSelectedClip = (): VideoClip | null => {
    if (selectedClipId) {
      for (const track of tracks) {
        const clip = track.clips.find(c => c.id === selectedClipId);
        if (clip) return clip;
      }
    }
    
    // If no clip is selected, use the first video clip
    if (tracks.length > 0 && tracks[0].clips.length > 0) {
      return tracks[0].clips[0];
    }
    
    return null;
  };


  // Cleanup video elements on unmount
  useEffect(() => {
    return () => {
      // Cleanup video elements
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, []);
  
  // Regenerate video
  const handleRegenerateVideo = async () => {
    if (!projectId) return;
    
    const selectedClip = getCurrentSelectedClip();
    if (!selectedClip || !selectedClip.sceneItemId || !selectedClip.shotNumber) {
      showWarning("Please select a valid video clip");
      return;
    }
    
    setIsRegenerating(true);
    try {
      // Use the description from the input field directly (what user sees is what gets submitted)
      const videoDescription = editingVideoDescription.trim();
      
      if (!videoDescription) {
        showWarning("Please enter a video description");
        setIsRegenerating(false);
        return;
      }
      
      // 使用Sora API生成视频
      // 根据分辨率设置size（API 会根据 size 自动选择正确的模型）
      const resolutionMap: Record<string, string> = {
        "480P": "1280x704",
        "720P": "1280x704",
        "1080P": "1920x1080",
      };
      const size = resolutionMap[videoQuality] || "1280x704";
      
      // 获取图片URL
      const imageUrl = selectedClip.shotData?.image_url;
      if (!imageUrl) {
        showError("Image URL is required for video generation");
        setIsRegenerating(false);
        return;
      }
      
      // Call Sora video generation API
      const response = await fetch("/api/video/generate-sora-video2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: videoDescription,
          imageUrl: imageUrl,
          size: size,
          seconds: videoDuration,
          // 不传递 model，让 API 根据 size 自动选择（竖屏用 sora_video2，横屏用 sora_video2-landscape）
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Start polling video status
          const taskId = result.data.taskId;
          await pollVideoStatus(taskId, selectedClip);
        } else {
          showError("Video generation failed: " + (result.error || "Unknown error"));
        }
      } else {
        showError("Video generation request failed");
      }
    } catch (error) {
      showError("Video generation error occurred");
    } finally {
      setIsRegenerating(false);
    }
  };
  
  // Poll video generation status
  const pollVideoStatus = async (taskId: string, clip: VideoClip) => {
    const maxAttempts = 40;
    let attempts = 0;
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/video/status-sora-video2?taskId=${taskId}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Sora API返回的状态可能是 "completed" 或其他值，url字段包含视频URL
            if ((result.data.status === "completed" || result.data.status === "SUCCEEDED") && result.data.url) {
              // 使用Sora API的下载接口上传到TOS
              const uploadResponse = await fetch("/api/video/download-sora-video2", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  taskId: taskId,
                  projectId: projectId,
                  sceneItemId: clip.sceneItemId,
                  shotNumber: clip.shotNumber,
                }),
              });
              
              if (uploadResponse.ok) {
                const uploadResult = await uploadResponse.json();
                if (uploadResult.success && uploadResult.data?.videoUrl) {
                  // Automatically replace the video in the track
                  const newVideoUrl = uploadResult.data.videoUrl;
                  
                  // Update the clip URL in tracks
                  setTracks(prevTracks => 
                    prevTracks.map(track => ({
                      ...track,
                      clips: track.clips.map(c => {
                        if (c.id === clip.id) {
                          return {
                            ...c,
                            url: newVideoUrl,
                            // Update thumbnail if available
                            thumbnail: uploadResult.data?.thumbnailUrl || c.thumbnail,
                          };
                        }
                        return c;
                      })
                    }))
                  );
                  
                  // Update clipsArrayRef for video player
                  clipsArrayRef.current = clipsArrayRef.current.map(c => {
                    if (c.id === clip.id) {
                      return {
                        ...c,
                        url: newVideoUrl,
                        thumbnail: uploadResult.data?.thumbnailUrl || c.thumbnail,
                      };
                    }
                    return c;
                  });
                  
                  // If this is the currently playing clip, update the ref
                  if (currentPlayingClipRef.current?.id === clip.id) {
                    currentPlayingClipRef.current = {
                      ...currentPlayingClipRef.current,
                      url: newVideoUrl,
                      thumbnail: uploadResult.data?.thumbnailUrl || currentPlayingClipRef.current.thumbnail,
                    };
                  }
                  
                  // Check if there's at least one video, then update step_video and step_storyboard
                  // Reload scene data to check for videos
                  if (projectId) {
                    const checkVideosResponse = await fetch(`/api/scenes?projectId=${projectId}`);
                    if (checkVideosResponse.ok) {
                      const checkVideosResult = await checkVideosResponse.json();
                      if (checkVideosResult.success && checkVideosResult.data?.items) {
                        const hasVideo = checkVideosResult.data.items.some((item: any) => 
                          item.metadata?.storyboard?.shots?.some((shot: any) => 
                            shot.video_url && shot.video_url.trim() !== ''
                          )
                        );
                        
                        if (hasVideo) {
                          const statusResponse = await fetch('/api/storyboard/project-step-status', {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              project_id: projectId,
                              step_video: true,
                              step_storyboard: true,
                            }),
                          });

                          if (statusResponse.ok) {
                            const statusResult = await statusResponse.json();
                            if (statusResult.success && statusResult.data) {
                              setStatusVideo(statusResult.data.step_video || false);
                              setStatusStoryboard(statusResult.data.step_storyboard || false);
                              // Update projectStepStatus cache
                              setProjectStepStatus(prev => prev ? {
                                ...prev,
                                step_video: statusResult.data.step_video || false,
                                step_storyboard: statusResult.data.step_storyboard || false,
                              } : null);
                            }
                          }
                        }
                      }
                    }
                  }
                  
                  // Update sceneData to reflect the new video URL
                  if (sceneData?.items) {
                    const updatedSceneData = {
                      ...sceneData,
                      items: sceneData.items.map((item: any) => {
                        if (item.id === clip.sceneItemId && item.metadata?.storyboard?.shots) {
                          return {
                            ...item,
                            metadata: {
                              ...item.metadata,
                              storyboard: {
                                ...item.metadata.storyboard,
                                shots: item.metadata.storyboard.shots.map((shot: any) => {
                                  if (shot.shot_number === clip.shotNumber) {
                                    return {
                                      ...shot,
                                      video_url: newVideoUrl,
                                      thumbnail_url: uploadResult.data?.thumbnailUrl || shot.thumbnail_url,
                                    };
                                  }
                                  return shot;
                                })
                              }
                            }
                          };
                        }
                        return item;
                      })
                    };
                    setSceneData(updatedSceneData);
                  }
                  
                  // Reload videos to ensure consistency
                  await loadVideos();
                  showSuccess("Video regenerated and replaced successfully!");
                } else {
                  showError("Failed to upload video");
                }
              } else {
                showError("Failed to upload video to storage");
              }
              return;
            } else if (result.data.status === "FAILED") {
              showError("Video generation failed");
              return;
            }
          }
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 15000); // Retry after 15 seconds
        } else {
              showWarning("Video generation timed out. Please check later");
        }
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 15000);
        }
      }
    };
    
    poll();
  };

  // Update editing description when selected clip changes
  useEffect(() => {
    const selectedShot = getSelectedShot();
    if (selectedShot) {
      const description = selectedShot.video_prompt || selectedShot.image_prompt || selectedShot.description || "";
      setEditingVideoDescription(description);
    } else {
      setEditingVideoDescription("");
    }
  }, [selectedClipId, tracks]);

  // Save edited video description
  const handleSaveVideoDescription = async () => {
    const selectedClip = getCurrentSelectedClip();
    if (!selectedClip || !selectedClip.sceneItemId || !selectedClip.shotNumber) {
      showWarning("Please select a valid video clip");
      return;
    }

    if (!editingVideoDescription.trim()) {
      showWarning("Video description cannot be empty");
      return;
    }

    setIsSavingDescription(true);
    try {
      // Save to database
      const response = await fetch("/api/storyboard/update-shot-description", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          scene_item_id: selectedClip.sceneItemId,
          shot_number: selectedClip.shotNumber,
          video_prompt: editingVideoDescription.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to save video description");
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to save video description");
      }

      // Update local shot data after successful database save
      const updatedTracks = tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip => {
          if (clip.id === selectedClip.id && clip.shotData) {
            return {
              ...clip,
              shotData: {
                ...clip.shotData,
                video_prompt: editingVideoDescription.trim(),
              }
            };
          }
          return clip;
        })
      }));
      setTracks(updatedTracks);

      // Update sceneData to reflect the change
      if (sceneData?.items) {
        const updatedSceneData = {
          ...sceneData,
          items: sceneData.items.map((item: any) => {
            if (item.id === selectedClip.sceneItemId && item.metadata?.storyboard?.shots) {
              return {
                ...item,
                metadata: {
                  ...item.metadata,
                  storyboard: {
                    ...item.metadata.storyboard,
                    shots: item.metadata.storyboard.shots.map((shot: any) => {
                      if (shot.shot_number === selectedClip.shotNumber) {
                        return {
                          ...shot,
                          video_prompt: editingVideoDescription.trim(),
                        };
                      }
                      return shot;
                    })
                  }
                }
              };
            }
            return item;
          })
        };
        setSceneData(updatedSceneData);
      }

      showSuccess("Video description saved successfully");
    } catch (error) {
      showError("Failed to save video description");
    } finally {
      setIsSavingDescription(false);
    }
  };

  // Add subtitle
  const handleAddSubtitle = () => {
    if (!subtitleContent.trim()) return;
    
    const newSubtitle: Subtitle = {
      id: `subtitle-${Date.now()}`,
      text: subtitleContent,
      startTime: currentTime,
      endTime: currentTime + 3, // Default 3 seconds
      type: subtitleType,
      characterName: subtitleType === "character" ? "Character Name" : undefined
    };
    
    setSubtitleTrack(prev => ({
      ...prev,
      subtitles: [...prev.subtitles, newSubtitle].sort((a, b) => a.startTime - b.startTime)
    }));
    
    setSubtitleContent("");
  };

  // Delete subtitle
  const handleDeleteSubtitle = (subtitleId: string) => {
    setSubtitleTrack(prev => ({
      ...prev,
      subtitles: prev.subtitles.filter(s => s.id !== subtitleId)
    }));
    if (selectedSubtitleId === subtitleId) {
      setSelectedSubtitleId(null);
    }
  };

  // Edit subtitle
  const handleEditSubtitle = (subtitle: Subtitle) => {
    setEditingSubtitleId(subtitle.id);
    setSubtitleType(subtitle.type);
    setSubtitleContent(subtitle.text);
    setSelectedSubtitleId(subtitle.id);
  };

  // Save subtitle edit
  const handleSaveSubtitle = () => {
    if (!editingSubtitleId || !subtitleContent.trim()) return;
    
    setSubtitleTrack(prev => ({
      ...prev,
      subtitles: prev.subtitles.map(s => 
        s.id === editingSubtitleId 
          ? { ...s, text: subtitleContent, type: subtitleType }
          : s
      )
    }));
    
    setEditingSubtitleId(null);
    setSubtitleContent("");
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 mx-auto mb-4"
          >
            <Play className="w-12 h-12 text-[#FFDA2A]" />
          </motion.div>
          <p className="text-gray-400">Loading video...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <Header />
      
      {/* Navigation bar */}
      <div className="flex-shrink-0">
        <StoryboardNav
          currentProjectId={projectId}
          sessionProjectId={projectId}
          statusScript={projectStepStatus?.step_script || statusScript}
          statusSettings={projectStepStatus?.step_settings || statusSettings}
          statusStoryboard={projectStepStatus?.step_storyboard || statusStoryboard}
          statusVideo={projectStepStatus?.step_video || statusVideo}
          currentPage="video"
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left video generation panel */}
        <div className="w-80 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Video Generation</h3>
            
            {/* Current scene information */}
            {(() => {
              const clip = getCurrentSelectedClip();
              return clip ? (
                <div className="mb-6 text-sm text-gray-400">
                  Scene {clip.sceneNumber}
                  {clip.shotNumber && `; Shot ${clip.shotNumber}`}
                </div>
              ) : null;
            })()}
            
            {/* Video description */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-white">Video Description</label>
                  <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center">
                    <span className="text-xs text-gray-400">i</span>
                  </div>
                </div>
                {editingVideoDescription !== (getSelectedShot()?.video_prompt || getSelectedShot()?.image_prompt || getSelectedShot()?.description || "") && (
                  <Button
                    onClick={handleSaveVideoDescription}
                    disabled={isSavingDescription}
                    className="h-6 px-2 text-xs bg-yellow-400 hover:bg-yellow-500 text-gray-900"
                  >
                    {isSavingDescription ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
              <Textarea
                value={editingVideoDescription}
                onChange={(e) => setEditingVideoDescription(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white min-h-[120px] resize-none text-sm focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
                placeholder="Enter video description..."
              />
            </div>
            
            {/* Video quality */}
            <div className="mb-6">
              <label className="text-sm font-medium text-white mb-3 block">Video Quality</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoQuality"
                    value="480P"
                    checked={videoQuality === "480P"}
                    onChange={() => setVideoQuality("480P")}
                    className="w-4 h-4 text-[#FFDA2A]"
                  />
                  <span className="text-sm text-gray-300">Basic (480P)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoQuality"
                    value="720P"
                    checked={videoQuality === "720P"}
                    onChange={() => setVideoQuality("720P")}
                    className="w-4 h-4 text-[#FFDA2A]"
                  />
                  <span className="text-sm text-gray-300">Standard (720P)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoQuality"
                    value="1080P"
                    checked={videoQuality === "1080P"}
                    onChange={() => setVideoQuality("1080P")}
                    className="w-4 h-4 text-[#FFDA2A]"
                  />
                  <span className="text-sm text-gray-300">High Quality (1080P)</span>
                </label>
              </div>
            </div>
            
            {/* Video duration */}
            <div className="mb-6">
              <label className="text-sm font-medium text-white mb-3 block">Video Duration</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoDuration"
                    value="10"
                    checked={videoDuration === 10}
                    onChange={() => setVideoDuration(10)}
                    className="w-4 h-4 text-[#FFDA2A]"
                  />
                  <span className="text-sm text-gray-300">10 seconds</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoDuration"
                    value="15"
                    checked={videoDuration === 15}
                    onChange={() => setVideoDuration(15)}
                    className="w-4 h-4 text-[#FFDA2A]"
                  />
                  <span className="text-sm text-gray-300">15 seconds</span>
                </label>
              </div>
            </div>
            
            {/* Video Status */}
            {(() => {
              const clip = getCurrentSelectedClip();
              const videoUrl = clip?.url;
              return (
                <div className="mb-6">
                  <label className="text-sm font-medium text-white mb-3 block">Video Status</label>
                  <div className="flex items-center gap-2">
                    {videoUrl ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-gray-300">Video generated</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        <span className="text-sm text-gray-300">No video generated</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          
          {/* Regenerate button */}
          <div className="p-6 border-t border-gray-800 bg-gray-900">
            {(() => {
              // Convert videoQuality format (480P, 720P, 1080P) to calculateVideoCredits format (480p, 720p, 1080p)
              const resolutionMap: Record<"480P" | "720P" | "1080P", "480p" | "720p" | "1080p"> = {
                "480P": "480p",
                "720P": "720p",
                "1080P": "1080p"
              };
              const resolutionForCredits = resolutionMap[videoQuality];
              const requiredCredits = calculateVideoCredits(subscriptionPlan, resolutionForCredits, videoDuration);
              
              return (
                <Button
                  onClick={handleRegenerateVideo}
                  disabled={!getCurrentSelectedClip() || isRegenerating || !arePreviousStepsCompleted()}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold h-12 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  title={!arePreviousStepsCompleted() ? "Please complete story script, settings, and storyboard steps first" : undefined}
                >
                  {isRegenerating ? (
                    "Regenerating..."
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Regenerate Video
                      <span className="flex items-center gap-1">
                        <Diamond className="w-4 h-4" />
                        <span className="text-sm font-semibold">{requiredCredits}</span>
                      </span>
                    </span>
                  )}
                </Button>
              );
            })()}
            {!arePreviousStepsCompleted() && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Complete all previous steps first
              </p>
            )}
          </div>
        </div>

        {/* Right main content area - Video Editor */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-gray-900">
          {/* Video Preview Area */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0 bg-black" ref={videoContainerRef}>
            <div className="w-full h-full max-w-6xl bg-black relative">
              {tracks[0]?.clips && tracks[0].clips.length > 0 ? (
                useCanvasPlayer ? (
                  <CanvasVideoPlayer
                    ref={canvasPlayerRef}
                    clips={tracks[0].clips}
                    subtitles={subtitleTrack.subtitles.map((sub) => ({
                      start: sub.startTime,
                      end: sub.endTime,
                      text: sub.text,
                      x: sub.x ?? 100,
                      y: sub.y, // Will be calculated based on canvas height if not provided
                    }))}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    onTimeUpdate={(time) => {
                      setCurrentTime(time);
                    }}
                    onClipChange={(clipIndex) => {
                      // Update selected clip
                      if (tracks[0]?.clips[clipIndex]) {
                        setSelectedClipId(tracks[0].clips[clipIndex].id);
                      }
                    }}
                    volume={volume}
                    isMuted={isMuted}
                    showSubtitles={showSubtitles}
                    onEnded={() => {
                      // All videos finished, reset to first
                      setIsPlaying(false);
                      currentClipIndexRef.current = 0;
                      if (tracks[0]?.clips.length > 0) {
                        setSelectedClipId(tracks[0].clips[0].id);
                        currentPlayingClipRef.current = tracks[0].clips[0];
                      }
                      // Reset canvas player to first video (this will also reset currentTime via onTimeUpdate)
                      if (canvasPlayerRef.current) {
                        canvasPlayerRef.current.resetToFirst();
                      }
                      // Ensure currentTime is reset to 0 after resetToFirst completes
                      setTimeout(() => {
                        setCurrentTime(0);
                      }, 100);
                    }}
                  />
                ) : (
                  <>
                    <EnhancedVideoPlayer
                      url={getCurrentVideoClip()!.url}
                      isPlaying={isPlaying}
                      volume={volume}
                      isMuted={isMuted}
                      currentTime={currentTime - (getCurrentVideoClip()?.startTime || 0)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onProgress={(progress) => {
                        if (!progress || typeof progress.playedSeconds !== 'number' || isNaN(progress.playedSeconds)) {
                          return;
                        }
                        const clip = getCurrentVideoClip();
                        if (!clip) {
                          return;
                        }
                        const relativeTime = progress.playedSeconds;
                        const clipDuration = clip.duration || 5;
                        const clampedTime = Math.min(Math.max(0, relativeTime), clipDuration);
                        const absoluteTime = (clip.startTime || 0) + clampedTime;
                        // Update currentTime to move playhead
                        const finalTime = Math.min(Math.max(0, absoluteTime), totalDuration || 0);
                        setCurrentTime(finalTime);
                      }}
                      onDuration={(duration) => {
                        // Duration is already set from clip data
                      }}
                      onEnded={() => {
                        switchToNextVideo();
                      }}
                      onReady={() => {
                      }}
                      onVideoDimensions={({ width, height }) => {
                        setVideoDimensions({ width, height });
                      }}
                    />
                    {/* Subtitle Overlay */}
                    {showSubtitles && subtitlePreviewLayout?.lines?.length ? (
                      <div
                        className="absolute left-0 right-0 flex justify-center pointer-events-none"
                        style={{ bottom: 10 }}
                      >
                        <div
                          className="text-white text-center font-semibold tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
                          style={{
                            fontSize: `${subtitlePreviewLayout.fontSize}px`,
                            lineHeight: `${subtitlePreviewLayout.lineHeight}px`,
                            maxWidth: `${subtitlePreviewLayout.maxWidth}px`,
                          }}
                        >
                          {subtitlePreviewLayout.lines.map((line, index) => (
                            <span key={`${line}-${index}`} className="block">
                              {line}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Film className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No video selected</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Playback Controls Bar */}
          <div className="h-14 bg-gray-800 border-t border-gray-700 flex items-center px-6">
            {/* Left Controls */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Time Display */}
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-mono text-sm">
                  {formatTime(isNaN(currentTime) || currentTime < 0 ? 0 : currentTime)}
                </span>
                <span className="text-gray-500">/</span>
                <span className="text-gray-400 font-mono text-sm">
                  {formatTime(isNaN(totalDuration) || totalDuration < 0 ? 0 : totalDuration)}
                </span>
              </div>
              
              {/* Subtitle Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">Subtitles</span>
                <button
                  onClick={() => setShowSubtitles(!showSubtitles)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    showSubtitles ? "bg-yellow-400" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      showSubtitles ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
              
            {/* Play Button - Centered aligned with video preview */}
            <div className="flex-1 flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePlayPause}
                disabled={!getCurrentVideoClip()}
                className="w-10 h-10 rounded-full bg-black hover:bg-gray-700"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white" />
                )}
              </Button>
            </div>
              
            {/* Right Controls */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Zoom Controls */}
              <div className="flex items-center gap-2 border-l border-gray-700 pl-4 ml-4">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-400 font-mono min-w-[50px] text-center">
                  {Math.round(timelineZoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
              
              {/* Export Button */}
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/20"
                title="Export"
                onClick={() => setShowExportDialog(true)}
              >
                <Download className="w-4 h-4" />
              </Button>
                
              {/* Fullscreen Button */}
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Timeline Editing Area */}
          <div className="h-64 bg-gray-800 border-t border-gray-700 flex">
            {/* Left Sidebar - Tab Navigation */}
            <div className="w-20 bg-gray-900 border-r border-gray-700 flex flex-col relative">
              {/* Ruler spacer - matches timeline ruler height (h-10 = 40px) */}
              <div className="h-10 border-b border-gray-700"></div>
              {/* Subtitle Button - aligned with subtitle track */}
              <button
                onClick={() => setActiveTab("subtitles")}
                className={`absolute left-0 right-0 h-10 flex flex-col items-center justify-center gap-1 transition-colors border-b border-gray-700 ${
                  activeTab === "subtitles"
                    ? "bg-yellow-400/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-300"
                }`}
                style={{ top: "40px" }}
              >
                <FileText className="w-4 h-4" />
                <span className="text-xs">Subtitles</span>
              </button>
              {/* Voiceover Button - aligned with voiceover track */}
              <button
                onClick={() => setActiveTab("voiceover")}
                className={`absolute left-0 right-0 h-10 flex flex-col items-center justify-center gap-1 transition-colors border-b border-gray-700 ${
                  activeTab === "voiceover"
                    ? "bg-yellow-400/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-300"
                }`}
                style={{ top: "80px" }}
              >
                <Mic className="w-4 h-4" />
                <span className="text-xs">Voiceover</span>
              </button>
              {/* Scenes Button - aligned with video track */}
              <button
                onClick={() => setActiveTab("scenes")}
                className={`absolute left-0 right-0 h-32 flex flex-col items-center justify-center gap-2 transition-colors ${
                  activeTab === "scenes"
                    ? "bg-yellow-400/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-300"
                }`}
                style={{ top: "120px" }}
              >
                <Film className="w-5 h-5" />
                <span className="text-xs">Scenes</span>
              </button>
          </div>

            {/* Timeline Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-800">
              {/* Shared container for ruler and tracks to ensure alignment - handles horizontal scrolling */}
              <div 
                ref={timelineContainerRef}
                className={`flex flex-col ${needsHorizontalScroll ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
                style={{ width: '100%', height: '100%' }}
              >
                {/* Inner container with fixed width for alignment */}
                <div 
                  className="relative flex flex-col"
                  style={{ width: `${totalDuration * pixelsPerSecond * timelineZoom}px`, minWidth: `${totalDuration * pixelsPerSecond * timelineZoom}px` }}
                >
                {/* Global Playhead - spans all tracks */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-20 cursor-ew-resize"
                  style={{ 
                    left: `${(isNaN(currentTime) || currentTime < 0 ? 0 : currentTime) * pixelsPerSecond * timelineZoom}px`,
                    transition: isDraggingPlayhead ? 'none' : 'left 0.1s linear',
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={handlePlayheadMouseDown}
                />
                {/* Playhead handle for easier dragging */}
                <div
                  className="absolute top-0 w-3 h-full -left-1.5 z-30 cursor-ew-resize"
                  style={{ 
                    left: `${(isNaN(currentTime) || currentTime < 0 ? 0 : currentTime) * pixelsPerSecond * timelineZoom}px`,
                    transition: isDraggingPlayhead ? 'none' : 'left 0.1s linear',
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={handlePlayheadMouseDown}
                />
                
                {/* Timeline Ruler */}
                <div className="h-10 bg-gray-900 border-b border-gray-700 flex items-end relative" style={{ width: '100%' }}>
                  {/* Major time markers (every 5 seconds) */}
                      {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }).map((_, i) => {
                        const time = i * 5;
                        if (time > totalDuration) return null;
                        return (
                          <div
                        key={`major-${time}`}
                        className="absolute flex flex-col"
                        style={{ 
                          left: `${time * pixelsPerSecond * timelineZoom}px`,
                          alignItems: time === 0 ? 'flex-start' : 'center',
                          transform: time === 0 ? 'translateX(0)' : 'translateX(-50%)'
                        }}
                      >
                        <div className="w-px h-2 bg-gray-400"></div>
                        <div className="text-xs text-gray-400 font-mono mt-1 whitespace-nowrap">
                          {formatTime(time)}
                        </div>
                          </div>
                        );
                      })}
                  {/* Always show the end time marker if not already shown */}
                  {totalDuration % 5 !== 0 && (
                    <div
                      key={`major-${totalDuration}`}
                      className="absolute flex flex-col items-end"
                      style={{ left: `${totalDuration * pixelsPerSecond * timelineZoom}px` }}
                    >
                      <div className="w-px h-2 bg-gray-400"></div>
                      <div className="text-xs text-gray-400 font-mono mt-1 whitespace-nowrap">
                        {formatTime(totalDuration)}
                    </div>
                  </div>
                  )}
                  {/* Minor time markers (every second) */}
                  {Array.from({ length: Math.ceil(totalDuration) + 1 }).map((_, i) => {
                    if (i % 5 === 0) return null; // Skip major markers
                    if (i > totalDuration) return null;
                    return (
                      <div
                        key={`minor-${i}`}
                        className="absolute w-px h-1 bg-gray-600"
                        style={{ left: `${i * pixelsPerSecond * timelineZoom}px`, bottom: "20px" }}
                      />
                    );
                  })}
                  </div>

                {/* Timeline Tracks */}
                <div 
                  ref={timelineTracksRef}
                  className="flex-1 overflow-y-auto bg-gray-800 overflow-x-hidden"
                  style={{ width: '100%' }}
                >
                {/* Subtitle Track */}
                <div className="h-10 border-b border-gray-700 relative bg-gray-800" style={{ width: '100%' }}>
                  <div className="h-full relative" style={{ width: `${totalDuration * pixelsPerSecond * timelineZoom}px` }}>
                    {/* Display existing subtitles */}
                    {subtitleTrack.subtitles && [...subtitleTrack.subtitles].sort((a, b) => a.startTime - b.startTime).map((subtitle, index, sortedSubtitles) => {
                      // Display at actual timeline position
                      const left = subtitle.startTime * pixelsPerSecond * timelineZoom;
                      // Calculate width to ensure boxes are adjacent
                      const nextSubtitle = sortedSubtitles[index + 1];
                      // If there's a next box, ensure current box doesn't exceed next box's start position
                      const effectiveEndTime = nextSubtitle 
                        ? Math.min(subtitle.endTime, nextSubtitle.startTime)
                        : subtitle.endTime;
                      const width = Math.max((effectiveEndTime - subtitle.startTime) * pixelsPerSecond * timelineZoom, 100);
                        return (
                          <div
                            key={subtitle.id}
                          className="absolute top-1 bottom-1 bg-gray-700 border border-gray-600 rounded px-2 cursor-pointer hover:bg-gray-600 flex items-center"
                          style={{ 
                            left: `${left}px`, 
                            width: `${width}px`, 
                            minWidth: "100px", 
                            zIndex: sortedSubtitles.length - index,
                            pointerEvents: 'auto'
                          }}
                          onClick={() => {
                              setSelectedSubtitleId(subtitle.id);
                            handleSeek(subtitle.startTime);
                          }}
                        >
                          {/* Text content */}
                          <div className="text-sm text-gray-200 leading-relaxed min-w-0 pr-6 overflow-hidden h-6 flex items-center flex-1 relative">
                            <div className="truncate w-full">
                              {subtitle.text}
                            </div>
                          </div>
                          {/* Add button - top right corner */}
                          <button
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center flex-shrink-0 z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle add action
                            }}
                          >
                            <Plus className="w-2.5 h-2.5 text-gray-300" />
                          </button>
                          </div>
                        );
                    })}
                    {/* Display empty boxes for each video clip (if no subtitles) */}
                    {tracks[0]?.clips.map((clip) => {
                      // Check if there's already a subtitle covering this time period
                      const hasSubtitle = subtitleTrack.subtitles?.some(
                        s => s.startTime <= clip.startTime && s.endTime >= clip.startTime + clip.duration
                      );
                      if (hasSubtitle) return null;
                      
                      const left = clip.startTime * pixelsPerSecond * timelineZoom;
                      const width = clip.duration * pixelsPerSecond * timelineZoom;
                        return (
                          <div
                          key={`subtitle-empty-${clip.id}`}
                          className="absolute top-1 bottom-1 bg-gray-700 border border-gray-600 rounded px-2 cursor-pointer hover:bg-gray-600 flex items-center"
                          style={{ left: `${left}px`, width: `${width}px`, minWidth: "100px" }}
                          onClick={() => {
                            handleSeek(clip.startTime);
                          }}
                        >
                          {/* Text content */}
                          <div className="text-sm text-gray-200 leading-relaxed min-w-0 pr-6 overflow-hidden h-6 flex items-center flex-1">
                            <div className="truncate w-full">
                              {/* Empty content */}
                            </div>
                          </div>
                          {/* Add button - top right corner */}
                          <button 
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center flex-shrink-0 z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle add action
                            }}
                          >
                            <Plus className="w-2.5 h-2.5 text-gray-300" />
                          </button>
                          </div>
                        );
                    })}
                  </div>
                </div>

                {/* Voiceover Track */}
                <div className="h-10 border-b border-gray-700 relative bg-gray-800" style={{ width: '100%' }}>
                  <div className="h-full relative" style={{ width: `${totalDuration * pixelsPerSecond * timelineZoom}px` }}>
                    {/* Display existing voiceovers */}
                    {voiceoverTrack.voiceovers && [...voiceoverTrack.voiceovers].sort((a, b) => a.startTime - b.startTime).map((voiceover, index, sortedVoiceovers) => {
                      // Display at actual timeline position
                      const left = voiceover.startTime * pixelsPerSecond * timelineZoom;
                      // Calculate width to ensure boxes are adjacent
                      const nextVoiceover = sortedVoiceovers[index + 1];
                      // If there's a next box, ensure current box doesn't exceed next box's start position
                      const effectiveEndTime = nextVoiceover 
                        ? Math.min(voiceover.endTime, nextVoiceover.startTime)
                        : voiceover.endTime;
                      const width = Math.max((effectiveEndTime - voiceover.startTime) * pixelsPerSecond * timelineZoom, 100);
                        return (
                          <div
                            key={voiceover.id}
                          className="absolute top-1 bottom-1 bg-gray-700 border border-gray-600 rounded px-2 cursor-pointer hover:bg-gray-600 flex items-center relative"
                          style={{ 
                            left: `${left}px`, 
                            width: `${width}px`, 
                            minWidth: "100px", 
                            zIndex: sortedVoiceovers.length - index,
                            pointerEvents: 'auto'
                          }}
                          onClick={() => handleSeek(voiceover.startTime)}
                        >
                          {/* Text content */}
                          <div className="text-sm text-gray-200 leading-relaxed min-w-0 pr-6 overflow-hidden h-6 flex items-center flex-1">
                            <div className="truncate w-full">
                              {voiceover.text}
                            </div>
                          </div>
                          {/* Add button - top right corner */}
                          <button 
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center flex-shrink-0 z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle add action
                            }}
                          >
                            <Plus className="w-2.5 h-2.5 text-gray-300" />
                          </button>
                          </div>
                        );
                    })}
                    {/* Display empty boxes for each video clip (if no voiceovers) */}
                    {tracks[0]?.clips.map((clip) => {
                      // Check if there's already a voiceover covering this time period
                      const hasVoiceover = voiceoverTrack.voiceovers?.some(
                        v => v.startTime <= clip.startTime && v.endTime >= clip.startTime + clip.duration
                      );
                      if (hasVoiceover) return null;
                      
                      const left = clip.startTime * pixelsPerSecond * timelineZoom;
                      const width = clip.duration * pixelsPerSecond * timelineZoom;
                        return (
                          <div
                          key={`voiceover-empty-${clip.id}`}
                          className="absolute top-1 bottom-1 bg-gray-700 border border-gray-600 rounded px-2 cursor-pointer hover:bg-gray-600 flex items-center"
                          style={{ left: `${left}px`, width: `${width}px`, minWidth: "100px" }}
                          onClick={() => handleSeek(clip.startTime)}
                        >
                          {/* Text content */}
                          <div className="text-sm text-gray-200 leading-relaxed min-w-0 pr-6 overflow-hidden h-6 flex items-center flex-1">
                            <div className="truncate w-full">
                              {/* Empty content */}
                            </div>
                          </div>
                          {/* Add button - top right corner */}
                          <button 
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center flex-shrink-0 z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle add action
                            }}
                          >
                            <Plus className="w-2.5 h-2.5 text-gray-300" />
                          </button>
                          </div>
                        );
                    })}
                  </div>
                </div>

                {/* Video Track */}
                <div className="h-32 border-b border-gray-700 relative bg-gray-800" style={{ width: '100%' }}>
                  <div className="h-full relative" style={{ width: `${totalDuration * pixelsPerSecond * timelineZoom}px` }}>
                    {tracks[0]?.clips.map((clip, index) => {
                      const left = clip.startTime * pixelsPerSecond * timelineZoom;
                      const width = clip.duration * pixelsPerSecond * timelineZoom;
                          return (
                        <div
                              key={clip.id}
                          className="absolute top-1 bottom-1 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-yellow-400"
                          style={{ left: `${left}px`, width: `${width}px`, minWidth: "80px" }}
                          onClick={() => {
                            setSelectedClipId(clip.id);
                            handleSeek(clip.startTime);
                          }}
                        >
                          {clip.thumbnail ? (
                            <div className="relative w-full h-full">
                              <img
                                src={clip.thumbnail}
                                alt={`Clip ${index + 1}`}
                                      className="w-full h-full object-cover"
                              />
                              <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Film className="w-3 h-3" />
                                <span>{index + 1}</span>
                                    </div>
                            </div>
                                ) : (
                            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                              <span className="text-white text-sm">{index + 1}</span>
                                  </div>
                                )}
                                </div>
                          );
                        })}
                  </div>
                </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Export Options</DialogTitle>
            <DialogDescription className="text-gray-400">
              Choose your export method
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <button
              onClick={async () => {
                if (!projectId) {
                  showError("Project ID is missing");
                  return;
                }
                
                // Get current scene ID (from sceneData)
                const currentSceneId = sceneData?.id;
                if (!currentSceneId) {
                  showError("Scene data is not loaded");
                  return;
                }
                
                try {
                  setShowExportDialog(false);
                  showInfo("Preparing video download...");
                  
                  // Call download API with sceneId parameter
                  const response = await fetch(`/api/projects/${projectId}/download-videos?sceneId=${currentSceneId}`);
                  
                  if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to download videos');
                  }
                  
                  // Get zip file
                  const blob = await response.blob();
                  
                  // Create download link
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  const sceneTitle = sceneData?.title || 'scene';
                  const safeTitle = sceneTitle.replace(/[^a-zA-Z0-9]/g, '_');
                  a.download = `${safeTitle}_videos_${Date.now()}.zip`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                  
                  showSuccess("Videos downloaded successfully!");
                } catch (error) {
                  showError(error instanceof Error ? error.message : "Failed to download videos");
                }
              }}
              className="w-full p-4 border border-gray-600 rounded-lg hover:border-yellow-400 hover:bg-yellow-400/10 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-700 rounded-lg group-hover:bg-yellow-400/20 transition-colors flex-shrink-0">
                  <Download className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white mb-1">Download Videos</div>
                  <div className="text-sm text-gray-400 leading-relaxed">Individual video files packaged in a compressed archive</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                if (!isCompleteVideoExportAllowed(subscriptionPlan)) {
                  showWarning("Complete video export is only available for Pro and Studio plans. Redirecting to upgrade page...");
                  setShowExportDialog(false);
                  // Delay redirect to let user see the message
                  setTimeout(() => {
                    router.push('/pricing');
                  }, 1500);
                  return;
                }
                // Open export dialog
                setShowExportDialog(false);
                setShowExportCompleteDialog(true);
              }}
              className={`w-full p-4 border rounded-lg text-left group transition-all ${
                isCompleteVideoExportAllowed(subscriptionPlan)
                  ? "border-gray-600 hover:border-yellow-400 hover:bg-yellow-400/10 cursor-pointer"
                  : "border-gray-700 bg-gray-800/50 opacity-50 cursor-pointer hover:border-yellow-500/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  isCompleteVideoExportAllowed(subscriptionPlan)
                    ? "bg-gray-700 group-hover:bg-yellow-400/20"
                    : "bg-gray-800"
                }`}>
                  <Save className={`w-5 h-5 ${
                    isCompleteVideoExportAllowed(subscriptionPlan) ? "text-yellow-400" : "text-gray-600"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white mb-1">Export Complete Video</div>
                  <div className="text-sm text-gray-400 leading-relaxed">
                    {isCompleteVideoExportAllowed(subscriptionPlan)
                      ? "All videos merged into a single complete video file"
                      : "Available for Pro and Studio plans only"}
                  </div>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Complete Video Dialog */}
      {projectId && sceneData && (
        <ExportDialog
          open={showExportCompleteDialog}
          onOpenChange={setShowExportCompleteDialog}
          projectId={projectId}
          sceneId={sceneData.id}
          videoClips={tracks.flatMap(track => 
            track.clips.map(clip => ({
              url: clip.url,
              startTime: clip.startTime,
              duration: clip.duration,
            }))
          )}
          subtitles={subtitleTrack.subtitles.map(sub => ({
            text: sub.text,
            startTime: sub.startTime,
            endTime: sub.endTime,
            x: sub.x,
            y: sub.y,
          }))}
          includeSubtitles={showSubtitles}
          coverImage={tracks[0]?.clips[0]?.thumbnail || sceneData.cover_image_url}
          onExportComplete={(videoUrl) => {
            showSuccess('Video exported successfully!');
          }}
        />
      )}
    </div>
  );
}



