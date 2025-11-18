"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ZoomOut
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
import { isCompleteVideoExportAllowed, type SubscriptionPlan } from "@/lib/subscription/rules";

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
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null); // Video aspect ratio
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const canvasPlayerRef = useRef<CanvasVideoPlayerRef>(null);
  const [useCanvasPlayer, setUseCanvasPlayer] = useState(true); // Use canvas player for dual video + subtitle rendering
  
  // Tab state: "subtitles" | "voiceover" | "scenes"
  const [activeTab, setActiveTab] = useState<"subtitles" | "voiceover" | "scenes">("scenes");
  
  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Subscription plan state
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(null);
  
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
  // 大于110%则添加水平滚动条，小于等于100%则取消滚动条
  const needsHorizontalScroll = timelineZoom > 1.1; // 110% = 1.1
  
  // Subtitle editing panel state
  const [subtitleType, setSubtitleType] = useState<"narration" | "character">("narration");
  const [subtitleContent, setSubtitleContent] = useState<string>("");
  const [editingSubtitleId, setEditingSubtitleId] = useState<string | null>(null);
  
  // Scene data (includes storyboard information)
  const [sceneData, setSceneData] = useState<any>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Video generation settings
  const [videoQuality, setVideoQuality] = useState<"512P" | "768P" | "1080P">("768P");
  const [videoDuration, setVideoDuration] = useState<5 | 10>(5);
  
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
    const updateContainerWidth = () => {
      if (videoContainerRef.current) {
        setContainerWidth(videoContainerRef.current.offsetWidth);
      }
    };

    updateContainerWidth();
    const resizeObserver = new ResizeObserver(updateContainerWidth);
    if (videoContainerRef.current) {
      resizeObserver.observe(videoContainerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Load subscription plan
  useEffect(() => {
    const loadSubscriptionPlan = async () => {
      try {
        const planData = await getUserSubscriptionPlan();
        if (planData.plan !== undefined) {
          setSubscriptionPlan(planData.plan);
        }
      } catch (error) {
        console.error("Error loading subscription plan:", error);
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
    
    // Load videos only once using safe pattern
    if (!videosLoaded) {
      loadVideos();
    }
  }, [projectId, videosLoaded]);


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
      console.error("Error loading project:", error);
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
                    console.warn("Shot has no video_url:", {
                      shot_number: shot.shot_number,
                      shot: shot
                    });
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
            
            // Log video URLs for debugging
            console.log('Video clips loaded:', videoClips.map(c => ({ id: c.id, url: c.url, hasUrl: !!c.url })));
            
            // Check if any clips have valid URLs
            const clipsWithUrls = videoClips.filter(c => c.url && c.url.trim() !== '');
            console.log(`Total clips: ${videoClips.length}, Clips with URLs: ${clipsWithUrls.length}`);
            
            if (clipsWithUrls.length === 0) {
              console.warn('No video clips with valid URLs found!');
              console.log('All clips:', videoClips);
            } else {
              // Videos loaded successfully
            }
            
            // Extract subtitle information from storyboard data
            const subtitles: Subtitle[] = [];
            let subtitleTime = 0;
            videoClips.forEach((clip) => {
              if (clip.shotData) {
                // If there is narration, add to subtitle track
                if (clip.shotData.narration && clip.shotData.narration.trim()) {
                  subtitles.push({
                    id: `subtitle-${clip.id}-narration`,
                    text: clip.shotData.narration,
                    startTime: subtitleTime,
                    endTime: subtitleTime + clip.duration,
                    type: "narration"
                  });
                }
                // If there is dialogue, add to subtitle track
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
      console.error("Error loading videos:", error);
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
        
        // 重新计算后续片段的时间
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
        
        // 重新计算后续片段的时间
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
        
        // 重新排序并重新计算时间
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

  // 获取当前播放的视频片段
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
      console.log('⚠️ No clips available for switching');
      return;
    }
    
    const currentIndex = currentClipIndexRef.current;
    console.log('🔄 switchToNextVideo called:', {
      currentIndex,
      totalClips: clips.length,
      currentClipId: clips[currentIndex]?.id
    });
    
    if (currentIndex >= clips.length - 1) {
      // All videos finished, reset to first
      console.log('✅ All videos finished, resetting to first');
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
    
    console.log('➡️ Switching to next video:', {
      nextIndex,
      nextClipId: nextClip?.id,
      nextClipUrl: nextClip?.url?.substring(0, 50) + '...',
      nextClipStartTime: nextClip?.startTime
    });
    
    if (nextClip && nextClip.url) {
      // Update index first
      currentClipIndexRef.current = nextIndex;
      
      // Update playhead position
      setCurrentTime(nextClip.startTime);
      currentPlayingClipRef.current = nextClip;
      
      // Update selected clip ID to trigger video switch (for react-player)
      // This will cause EnhancedVideoPlayer to re-render with new URL via key prop
      setSelectedClipId(nextClip.id);
      
      console.log('✅ Updated to next clip:', {
        selectedClipId: nextClip.id,
        playheadPosition: nextClip.startTime,
        isPlaying
      });
      
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
              console.error("Error playing video:", err);
          setIsPlaying(false);
            }
        });
      }
      }
    } else {
      console.warn('⚠️ Next clip is invalid:', nextClip);
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
    
    // 如果没有选中，使用第一个视频片段
    if (!targetClip && tracks.length > 0 && tracks[0].clips.length > 0) {
      targetClip = tracks[0].clips[0];
    }
    
    return targetClip?.shotData || null;
  };
  
  // 获取当前选中的视频片段（如果没有选中，返回第一个）
  const getCurrentSelectedClip = (): VideoClip | null => {
    if (selectedClipId) {
      for (const track of tracks) {
        const clip = track.clips.find(c => c.id === selectedClipId);
        if (clip) return clip;
      }
    }
    
    // 如果没有选中，使用第一个视频片段
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
      // Use edited description if available, otherwise use original
      const videoDescription = editingVideoDescription.trim() || 
        selectedClip.shotData?.video_prompt || 
        selectedClip.shotData?.image_prompt || 
        selectedClip.shotData?.description || "";
      
      if (!videoDescription.trim()) {
        showWarning("Please enter a video description");
        setIsRegenerating(false);
        return;
      }
      
      // Call video generation API
      const response = await fetch("/api/video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scene_item_id: selectedClip.sceneItemId,
          project_id: projectId,
          shot_number: selectedClip.shotNumber,
          image_prompt: selectedClip.shotData?.image_prompt || "",
          prompt: videoDescription,
          resolution: videoQuality,
          duration: videoDuration,
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
      console.error("Error regenerating video:", error);
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
        const response = await fetch(`/api/video/status?taskId=${taskId}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            if (result.data.status === "SUCCEEDED" && result.data.videoUrl) {
              // Upload video to TOS
              const uploadResponse = await fetch("/api/video/upload", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  videoUrl: result.data.videoUrl,
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
        console.error("Error polling video status:", error);
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
      console.error("Error saving video description:", error);
      showError("Failed to save video description");
    } finally {
      setIsSavingDescription(false);
    }
  };

  // Get current subtitle (based on playback time)
  const getCurrentSubtitle = (): Subtitle | null => {
    for (const subtitle of subtitleTrack.subtitles) {
      if (currentTime >= subtitle.startTime && currentTime < subtitle.endTime) {
        return subtitle;
      }
    }
    return null;
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

  const currentSubtitle = getCurrentSubtitle();

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <Header />
      
      {/* Navigation bar */}
      <div className="flex-shrink-0">
        <StoryboardNav
          currentProjectId={projectId}
          sessionProjectId={projectId}
          statusScript={statusScript}
          statusSettings={statusSettings}
          statusStoryboard={statusStoryboard}
          statusVideo={statusVideo}
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
                    value="512P"
                    checked={videoQuality === "512P"}
                    onChange={() => setVideoQuality("512P")}
                    className="w-4 h-4 text-[#FFDA2A]"
                  />
                  <span className="text-sm text-gray-300">Basic (512P)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="videoQuality"
                    value="768P"
                    checked={videoQuality === "768P"}
                    onChange={() => setVideoQuality("768P")}
                    className="w-4 h-4 text-[#FFDA2A]"
                  />
                  <span className="text-sm text-gray-300">Standard (768P)</span>
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
                    value="5"
                    checked={videoDuration === 5}
                    onChange={() => setVideoDuration(5)}
                    className="w-4 h-4 text-[#FFDA2A]"
                  />
                  <span className="text-sm text-gray-300">5 seconds</span>
                </label>
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
              </div>
            </div>
          </div>
          
          {/* Regenerate button */}
          <div className="p-6 border-t border-gray-800 bg-gray-900">
            <Button
              onClick={handleRegenerateVideo}
              disabled={!getCurrentSelectedClip() || isRegenerating}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold h-12 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isRegenerating ? "Regenerating..." : "Regenerate Video (10 Credits)"}
            </Button>
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
                    onEnded={() => {
                      // All videos finished, reset to first
                      console.log('✅ All videos finished, resetting to first');
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
                        console.log("Video ready");
                      }}
                    />
                    {/* Subtitle Overlay */}
                    {showSubtitles && getCurrentSubtitle() && (
                      <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none">
                        <div className="bg-black/70 text-white px-6 py-3 rounded-lg text-lg max-w-4xl text-center">
                          {getCurrentSubtitle()?.text}
                        </div>
                </div>
              )}
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
                    {/* 显示已有的字幕 */}
                    {subtitleTrack.subtitles && [...subtitleTrack.subtitles].sort((a, b) => a.startTime - b.startTime).map((subtitle, index, sortedSubtitles) => {
                      // 按照时间轴的实际位置显示
                      const left = subtitle.startTime * pixelsPerSecond * timelineZoom;
                      // 计算宽度，确保框体首尾相邻
                      const nextSubtitle = sortedSubtitles[index + 1];
                      // 如果有下一个框体，确保当前框体不超过下一个框体的开始位置
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
                          {/* 文字内容 */}
                          <div className="text-sm text-gray-200 leading-relaxed min-w-0 pr-6 overflow-hidden h-6 flex items-center flex-1 relative">
                            <div className="truncate w-full">
                              {subtitle.text}
                            </div>
                          </div>
                          {/* 加号按钮 - 右上角 */}
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
                    {/* 为每个视频片段显示空框（如果没有字幕） */}
                    {tracks[0]?.clips.map((clip) => {
                      // 检查是否已有字幕覆盖这个时间段
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
                          {/* 文字内容 */}
                          <div className="text-sm text-gray-200 leading-relaxed min-w-0 pr-6 overflow-hidden h-6 flex items-center flex-1">
                            <div className="truncate w-full">
                              {/* 空内容 */}
                            </div>
                          </div>
                          {/* 加号按钮 - 右上角 */}
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
                    {/* 显示已有的配音 */}
                    {voiceoverTrack.voiceovers && [...voiceoverTrack.voiceovers].sort((a, b) => a.startTime - b.startTime).map((voiceover, index, sortedVoiceovers) => {
                      // 按照时间轴的实际位置显示
                      const left = voiceover.startTime * pixelsPerSecond * timelineZoom;
                      // 计算宽度，确保框体首尾相邻
                      const nextVoiceover = sortedVoiceovers[index + 1];
                      // 如果有下一个框体，确保当前框体不超过下一个框体的开始位置
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
                          {/* 文字内容 */}
                          <div className="text-sm text-gray-200 leading-relaxed min-w-0 pr-6 overflow-hidden h-6 flex items-center flex-1">
                            <div className="truncate w-full">
                              {voiceover.text}
                            </div>
                          </div>
                          {/* 加号按钮 - 右上角 */}
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
                    {/* 为每个视频片段显示空框（如果没有配音） */}
                    {tracks[0]?.clips.map((clip) => {
                      // 检查是否已有配音覆盖这个时间段
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
                          {/* 文字内容 */}
                          <div className="text-sm text-gray-200 leading-relaxed min-w-0 pr-6 overflow-hidden h-6 flex items-center flex-1">
                            <div className="truncate w-full">
                              {/* 空内容 */}
                            </div>
                          </div>
                          {/* 加号按钮 - 右上角 */}
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
              onClick={() => {
                // TODO: 实现下载视频功能
                console.log("Download videos");
                setShowExportDialog(false);
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
                  showWarning("Complete video export is only available for Pro and Studio plans. Please upgrade your subscription.");
                  return;
                }
                // TODO: 实现导出完整视频功能
                console.log("Export complete video");
                setShowExportDialog(false);
              }}
              disabled={!isCompleteVideoExportAllowed(subscriptionPlan)}
              className={`w-full p-4 border rounded-lg text-left group transition-all ${
                isCompleteVideoExportAllowed(subscriptionPlan)
                  ? "border-gray-600 hover:border-yellow-400 hover:bg-yellow-400/10 cursor-pointer"
                  : "border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed"
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
    </div>
  );
}



