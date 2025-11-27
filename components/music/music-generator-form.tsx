"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Music, 
  Sparkles, 
  Play, 
  Pause, 
  Download, 
  Loader2,
  Wand2,
  Clock,
  TrendingUp,
  Heart,
  Zap,
  ChevronDown,
  ChevronUp,
  Shuffle,
  FileText,
  X,
  Diamond,
  Video
} from "lucide-react";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { checkCreditsBalance, deductMusicCredits, deductLyricsCredits, deductMusicWithLyricsCredits } from "@/lib/credits/deduct";
import { createClient } from "@/lib/supabase/client";
import ProfessionalAudioVisualizer from "@/components/music/professional-audio-visualizer";
import ProfessionalProgressBar from "@/components/music/professional-progress-bar";

interface MusicFormData {
  prompt: string;
  genre: string;
  mood: string;
  theme: string;
  tempo: string;
  energy: string;
  lyrics: boolean;
  instrumental: boolean;
  voiceType: 'male' | 'female' | 'duet';
}

interface GeneratedMusic {
  id: string;
  audioUrl: string | null;
  coverUrl: string | null;
  prompt: string;
  title?: string;
  style: string;
  mood: string;
  duration: string;
  createdAt: Date;
  lyrics?: string;
  hasLyrics?: boolean;
}

type PendingGenerationMode = 'music' | 'lyrics';

interface PendingGenerationContext {
  mode: PendingGenerationMode;
  description: string;
  generatedPrompt: string;
  title?: string;
  genre: string;
  mood: string;
  theme: string;
  tempo: string;
  energy: string;
  lyrics: string;
  instrumental: boolean;
  voiceType: 'male' | 'female' | 'duet';
  image?: string;
}

interface MusicExample {
  id: string;
  title: string;
  tags: string;
  coverUrl: string;
  duration: number;
  audioUrl: string;
  createdAt: string;
  status: number;
  isPrivate: boolean;
  extra: any;
}

const GENRES = [
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "electronic", label: "Electronic" },
  { value: "jazz", label: "Jazz" },
  { value: "classical", label: "Classical" },
  { value: "hip-hop", label: "Hip-Hop" },
  { value: "ambient", label: "Ambient" },
  { value: "cinematic", label: "Cinematic" },
  { value: "folk", label: "Folk" },
  { value: "reggae", label: "Reggae" },
];

const MOODS = [
  { value: "energetic", label: "Energetic" },
  { value: "calm", label: "Calm" },
  { value: "happy", label: "Happy" },
  { value: "melancholic", label: "Melancholic" },
  { value: "dramatic", label: "Dramatic" },
  { value: "romantic", label: "Romantic" },
  { value: "mysterious", label: "Mysterious" },
  { value: "uplifting", label: "Uplifting" },
];

const THEMES = [
  { value: "summer", label: "Summer" },
  { value: "winter", label: "Winter" },
  { value: "nature", label: "Nature" },
  { value: "urban", label: "Urban" },
  { value: "space", label: "Space" },
  { value: "ocean", label: "Ocean" },
  { value: "forest", label: "Forest" },
  { value: "city", label: "City" },
];

const TEMPOS = [
  { value: "slow", label: "Slow" },
  { value: "moderate", label: "Moderate" },
  { value: "fast", label: "Fast" },
  { value: "very-fast", label: "Very Fast" },
];

const ENERGY_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "very-high", label: "Very High" },
];

const VOICE_TYPES = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "duet", label: "Duet" },
];

const DEFAULT_AUDIO_SETTING = {
  sample_rate: 44100,
  bitrate: 256000,
  format: "mp3",
} as const;

interface MusicPromptAttributes {
  genre?: string;
  mood?: string;
  theme?: string;
  tempo?: string;
  energy?: string;
  description?: string;
  voiceType?: 'male' | 'female' | 'duet';
}

const buildMusicGenerationPrompt = (attributes: MusicPromptAttributes) => {
  const parts = [
    attributes.genre,
    attributes.mood,
    attributes.theme,
    attributes.tempo,
    attributes.energy,
    attributes.description,
  ].filter((value) => Boolean(value && value.trim()));

  // 如果有 voiceType 且不是伴奏模式，添加人物选择（英文）
  if (attributes.voiceType) {
    const voiceTypeMap: Record<'male' | 'female' | 'duet', string> = {
      'male': 'male voice',
      'female': 'female voice',
      'duet': 'male and female duet',
    };
    parts.push(voiceTypeMap[attributes.voiceType]);
  }

  return parts.join(", ");
};

export default function MusicGeneratorForm() {
  const [formData, setFormData] = useState<MusicFormData>({
    prompt: "",
    genre: "",
    mood: "",
    theme: "",
    tempo: "",
    energy: "",
    lyrics: false,
    instrumental: false,
    voiceType: 'female', // 默认女声
  });
  const promptValue = typeof formData.prompt === "string" ? formData.prompt : "";
  const trimmedPromptValue = promptValue.trim();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMusics, setGeneratedMusics] = useState<GeneratedMusic[]>([]);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [audioProgress, setAudioProgress] = useState<Map<string, { currentTime: number; duration: number }>>(new Map());
  const [isMounted, setIsMounted] = useState(false);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{
    status: 'idle' | 'generating' | 'completed' | 'error';
    message: string;
  }>({
    status: 'idle',
    message: ''
  });
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [musicExamples, setMusicExamples] = useState<MusicExample[]>([]);
  const [examplePlayingId, setExamplePlayingId] = useState<string | null>(null);
  const exampleAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [exampleAudioProgress, setExampleAudioProgress] = useState<Map<string, { currentTime: number; duration: number }>>(new Map());
  const exampleAudioListeners = useRef<Map<string, () => void>>(new Map());
  const audioListeners = useRef<Map<string, () => void>>(new Map());
  const [activeTab, setActiveTab] = useState<'examples' | 'my-music'>('examples');
  const [myMusicList, setMyMusicList] = useState<GeneratedMusic[]>([]);
  const [isLoadingMyMusic, setIsLoadingMyMusic] = useState(false);
  const myMusicSectionRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const [videoPreparingId, setVideoPreparingId] = useState<string | null>(null);
  
  // 歌词编辑弹窗状态
  const [lyricsEditDialog, setLyricsEditDialog] = useState<{
    isOpen: boolean;
    lyrics: string;
    musicId: string | null;
    isNewGeneration: boolean; // 是否为新生成的歌词（需要生成音乐）
  }>({
    isOpen: false,
    lyrics: '',
    musicId: null,
    isNewGeneration: false,
  });
  const [pendingGeneration, setPendingGeneration] = useState<PendingGenerationContext | null>(null);

  const supabase = createClient();
  const requiredCreditsForMusic = 5; // 非歌词模式音乐生成所需的积分
  const requiredCreditsForLyrics = 35; // 歌词模式生成所需的积分（包含生成歌曲和封面）
  const requiredCreditsForMusicWithLyrics = 30; // 带歌词的音乐生成所需的积分

  const logGenerationSnapshot = (
    label: string,
    payload: Record<string, unknown>
  ) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      console.group(`[MusicGenerator] ${label}`);
      Object.entries(payload).forEach(([key, value]) => {
        console.log(`${key}:`, value);
      });
      console.groupEnd();
    } catch (error) {
      console.log(`[MusicGenerator] ${label}`, payload, error);
    }
  };

  const cleanupAudioListeners = (
    listenersMap: React.MutableRefObject<Map<string, () => void>>,
    id: string
  ) => {
    const cleanup = listenersMap.current.get(id);
    if (cleanup) {
      cleanup();
      listenersMap.current.delete(id);
    }
  };

  const attachExampleAudioElement = useCallback(
    (id: string, el: HTMLAudioElement | null) => {
      console.log('[DEBUG attachExampleAudioElement]', { id, hasElement: !!el, src: el?.src });
      const map = exampleAudioElementsRef.current;
      const current = map.get(id);
      if (current === el) {
        console.log('[DEBUG attachExampleAudioElement] Element unchanged, skipping');
        return;
      }
      if (el) {
        map.set(id, el);
        console.log('[DEBUG attachExampleAudioElement] Element registered, total:', map.size);
      } else {
        // 清理 Blob URL（如果存在）
        if (current && (window as any).__audioBlobURLCleanup) {
          const cleanup = (window as any).__audioBlobURLCleanup.get(current);
          if (cleanup) {
            cleanup();
            (window as any).__audioBlobURLCleanup.delete(current);
          }
        }
        map.delete(id);
        console.log('[DEBUG attachExampleAudioElement] Element removed, total:', map.size);
      }

      cleanupAudioListeners(exampleAudioListeners, id);

      if (!el) {
        return;
      }

      // 确保音频元素未静音且音量正常
      if (el.muted) {
        console.warn('[DEBUG attachExampleAudioElement] Audio element is muted, unmuting...');
        el.muted = false;
      }
      if (el.volume === 0) {
        console.warn('[DEBUG attachExampleAudioElement] Audio element volume is 0, setting to 1...');
        el.volume = 1.0;
      }
      console.log('[DEBUG attachExampleAudioElement] Audio element state:', {
        id,
        muted: el.muted,
        volume: el.volume,
        paused: el.paused,
        readyState: el.readyState,
        src: el.src?.substring(0, 100)
      });

      let timeUpdateCount = 0;
      const handleTimeUpdate = () => {
        timeUpdateCount++;
        // 前 5 次和每 10 次 timeupdate 记录一次日志
        if (timeUpdateCount <= 5 || timeUpdateCount % 10 === 0) {
          console.log('[DEBUG attachExampleAudioElement] timeupdate:', {
            id,
            count: timeUpdateCount,
            currentTime: el.currentTime,
            duration: el.duration,
            paused: el.paused,
            readyState: el.readyState,
            seeking: el.seeking,
            buffered: el.buffered.length > 0 ? `${el.buffered.start(0)}-${el.buffered.end(0)}` : 'none'
          });
        }
        setExampleAudioProgress((prev) => {
          const next = new Map(prev);
          next.set(id, {
            currentTime: el.currentTime,
            duration: el.duration || 0,
          });
          return next;
        });
      };

      const handleLoadedMetadata = () => {
        setExampleAudioProgress((prev) => {
          const next = new Map(prev);
          next.set(id, {
            currentTime: 0,
            duration: el.duration || 0,
          });
          return next;
        });
      };

      const handleError = (event: Event) => {
        console.error("[DEBUG attachExampleAudioElement] Example audio loading error:", { id, event, src: el.src });
      };

      const handleEnded = () => {
        console.log('[DEBUG attachExampleAudioElement] Example audio ended:', id);
        setExamplePlayingId((current) => (current === id ? null : current));
        setExampleAudioProgress((prev) => {
          const next = new Map(prev);
          const progress = next.get(id);
          if (progress) {
            next.set(id, { ...progress, currentTime: 0 });
          }
          return next;
        });
      };

      const handlePlay = () => {
        console.log('[DEBUG attachExampleAudioElement] Audio play event:', {
          id,
          currentTime: el.currentTime,
          paused: el.paused,
          readyState: el.readyState
        });
      };

      const handlePlaying = () => {
        console.log('[DEBUG attachExampleAudioElement] Audio playing event (actually playing):', {
          id,
          currentTime: el.currentTime,
          paused: el.paused,
          readyState: el.readyState,
          duration: el.duration
        });
      };

      const handlePause = () => {
        console.log('[DEBUG attachExampleAudioElement] Audio pause event:', {
          id,
          currentTime: el.currentTime,
          paused: el.paused
        });
      };

      const handleWaiting = () => {
        console.log('[DEBUG attachExampleAudioElement] Audio waiting event (buffering):', {
          id,
          currentTime: el.currentTime,
          readyState: el.readyState
        });
      };

      const handleStalled = () => {
        console.warn('[DEBUG attachExampleAudioElement] Audio stalled event:', {
          id,
          currentTime: el.currentTime,
          readyState: el.readyState,
          networkState: el.networkState
        });
      };

      el.addEventListener('timeupdate', handleTimeUpdate);
      el.addEventListener('loadedmetadata', handleLoadedMetadata);
      el.addEventListener('error', handleError);
      el.addEventListener('ended', handleEnded);
      el.addEventListener('play', handlePlay);
      el.addEventListener('playing', handlePlaying);
      el.addEventListener('pause', handlePause);
      el.addEventListener('waiting', handleWaiting);
      el.addEventListener('stalled', handleStalled);

      exampleAudioListeners.current.set(id, () => {
        el.removeEventListener('timeupdate', handleTimeUpdate);
        el.removeEventListener('loadedmetadata', handleLoadedMetadata);
        el.removeEventListener('error', handleError);
        el.removeEventListener('ended', handleEnded);
        el.removeEventListener('play', handlePlay);
        el.removeEventListener('playing', handlePlaying);
        el.removeEventListener('pause', handlePause);
        el.removeEventListener('waiting', handleWaiting);
        el.removeEventListener('stalled', handleStalled);
      });
    },
    [setExampleAudioProgress, setExamplePlayingId]
  );

  const attachMainAudioElement = useCallback(
    (id: string, el: HTMLAudioElement | null) => {
      console.log('[DEBUG attachMainAudioElement]', { id, hasElement: !!el, src: el?.src });
      const map = audioElementsRef.current;
      const current = map.get(id);
      if (current === el) {
        console.log('[DEBUG attachMainAudioElement] Element unchanged, skipping');
        return;
      }
      if (el) {
        map.set(id, el);
        console.log('[DEBUG attachMainAudioElement] Element registered, total:', map.size);
      } else {
        // 清理 Blob URL（如果存在）
        if (current && (window as any).__audioBlobURLCleanup) {
          const cleanup = (window as any).__audioBlobURLCleanup.get(current);
          if (cleanup) {
            cleanup();
            (window as any).__audioBlobURLCleanup.delete(current);
          }
        }
        map.delete(id);
        console.log('[DEBUG attachMainAudioElement] Element removed, total:', map.size);
      }

      cleanupAudioListeners(audioListeners, id);

      if (!el) {
        return;
      }

      // 确保音频元素未静音且音量正常
      if (el.muted) {
        console.warn('[DEBUG attachMainAudioElement] Audio element is muted, unmuting...');
        el.muted = false;
      }
      if (el.volume === 0) {
        console.warn('[DEBUG attachMainAudioElement] Audio element volume is 0, setting to 1...');
        el.volume = 1.0;
      }
      console.log('[DEBUG attachMainAudioElement] Audio element state:', {
        id,
        muted: el.muted,
        volume: el.volume,
        paused: el.paused,
        readyState: el.readyState,
        src: el.src?.substring(0, 100)
      });

      let timeUpdateCount = 0;
      let lastTimeUpdateTime = 0;
      const handleTimeUpdate = () => {
        timeUpdateCount++;
        const currentTimeNow = el.currentTime;
        const timeChanged = currentTimeNow > lastTimeUpdateTime;
        lastTimeUpdateTime = currentTimeNow;
        
        // 前 10 次和每 10 次 timeupdate 记录一次日志
        if (timeUpdateCount <= 10 || timeUpdateCount % 10 === 0) {
          console.log('[DEBUG attachMainAudioElement] timeupdate:', {
            id,
            count: timeUpdateCount,
            currentTime: el.currentTime,
            duration: el.duration,
            paused: el.paused,
            readyState: el.readyState,
            seeking: el.seeking,
            timeChanged,
            buffered: el.buffered.length > 0 ? `${el.buffered.start(0)}-${el.buffered.end(0)}` : 'none'
          });
        }
        
        // 如果时间没有变化但音频在播放，记录警告
        if (!timeChanged && !el.paused && timeUpdateCount > 1) {
          console.warn('[DEBUG attachMainAudioElement] WARNING: timeupdate fired but currentTime did not change!', {
            id,
            currentTime: el.currentTime,
            paused: el.paused,
            readyState: el.readyState
          });
        }
        setAudioProgress((prev) => {
          const next = new Map(prev);
          next.set(id, {
            currentTime: el.currentTime,
            duration: el.duration || 0,
          });
          return next;
        });
      };

      const handleLoadedMetadata = () => {
        setAudioProgress((prev) => {
          const next = new Map(prev);
          next.set(id, {
            currentTime: 0,
            duration: el.duration || 0,
          });
          return next;
        });
      };

      const handleError = (event: Event) => {
        console.error("[DEBUG attachMainAudioElement] Audio loading error:", { id, event, src: el.src });
      };

      const handleEnded = () => {
        console.log('[DEBUG attachMainAudioElement] Audio ended:', id);
        setCurrentPlayingId((current) => (current === id ? null : current));
      };

      const handlePlay = () => {
        console.log('[DEBUG attachMainAudioElement] Audio play event:', {
          id,
          currentTime: el.currentTime,
          paused: el.paused,
          readyState: el.readyState
        });
      };

      const handlePlaying = () => {
        const playingStartTime = el.currentTime;
        console.log('[DEBUG attachMainAudioElement] Audio playing event (actually playing):', {
          id,
          currentTime: el.currentTime,
          paused: el.paused,
          readyState: el.readyState,
          duration: el.duration
        });
        
        // 定期检查 currentTime 是否在增加
        const checkInterval = setInterval(() => {
          const currentTimeNow = el.currentTime;
          const timeIncreased = currentTimeNow > playingStartTime;
          console.log('[DEBUG attachMainAudioElement] Playing check:', {
            id,
            playingStartTime,
            currentTimeNow,
            timeIncreased,
            paused: el.paused,
            readyState: el.readyState
          });
          
          if (el.paused || !timeIncreased) {
            console.warn('[DEBUG attachMainAudioElement] Audio stopped or not progressing:', {
              id,
              paused: el.paused,
              timeIncreased,
              currentTime: el.currentTime
            });
            clearInterval(checkInterval);
          }
        }, 200);
        
        // 5 秒后停止检查
        setTimeout(() => {
          clearInterval(checkInterval);
        }, 5000);
      };

      const handlePause = () => {
        console.log('[DEBUG attachMainAudioElement] Audio pause event:', {
          id,
          currentTime: el.currentTime,
          paused: el.paused
        });
      };

      const handleWaiting = () => {
        console.log('[DEBUG attachMainAudioElement] Audio waiting event (buffering):', {
          id,
          currentTime: el.currentTime,
          readyState: el.readyState
        });
      };

      const handleStalled = () => {
        console.warn('[DEBUG attachMainAudioElement] Audio stalled event:', {
          id,
          currentTime: el.currentTime,
          readyState: el.readyState,
          networkState: el.networkState
        });
      };

      el.addEventListener('timeupdate', handleTimeUpdate);
      el.addEventListener('loadedmetadata', handleLoadedMetadata);
      el.addEventListener('error', handleError);
      el.addEventListener('ended', handleEnded);
      el.addEventListener('play', handlePlay);
      el.addEventListener('playing', handlePlaying);
      el.addEventListener('pause', handlePause);
      el.addEventListener('waiting', handleWaiting);
      el.addEventListener('stalled', handleStalled);

      audioListeners.current.set(id, () => {
        el.removeEventListener('timeupdate', handleTimeUpdate);
        el.removeEventListener('loadedmetadata', handleLoadedMetadata);
        el.removeEventListener('error', handleError);
        el.removeEventListener('ended', handleEnded);
        el.removeEventListener('play', handlePlay);
        el.removeEventListener('playing', handlePlaying);
        el.removeEventListener('pause', handlePause);
        el.removeEventListener('waiting', handleWaiting);
        el.removeEventListener('stalled', handleStalled);
      });
    },
    [setAudioProgress]
  );

  const ensureAudioCanPlay = (audio: HTMLAudioElement) => {
    console.log('[DEBUG ensureAudioCanPlay] Audio state:', { 
      readyState: audio.readyState, 
      src: audio.src?.substring(0, 100),
      paused: audio.paused,
      duration: audio.duration,
      currentTime: audio.currentTime
    });
    
    // 如果音频已经加载足够的数据，直接返回
    if (audio.readyState >= 3) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
      console.log('[DEBUG ensureAudioCanPlay] Audio already ready (readyState >= 3)');
      // 确保从头开始播放
      if (audio.currentTime > 0) {
        console.log('[DEBUG ensureAudioCanPlay] Resetting currentTime to 0');
        audio.currentTime = 0;
      }
      return Promise.resolve();
    }

    console.log('[DEBUG ensureAudioCanPlay] Waiting for audio to load...');
    return new Promise<void>((resolve, reject) => {
      let resolved = false;
      let timeout: NodeJS.Timeout | null = null;
      
      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        audio.removeEventListener('canplay', handleCanPlayFinal);
        audio.removeEventListener('canplaythrough', handleCanPlayThroughFinal);
        audio.removeEventListener('error', handleError);
      };

      const handleError = (event: Event) => {
        if (resolved) return;
        console.error('[DEBUG ensureAudioCanPlay] Audio load error:', event);
        console.error('[DEBUG ensureAudioCanPlay] Audio state on error:', {
          src: audio.src?.substring(0, 150),
          readyState: audio.readyState,
          networkState: audio.networkState,
          error: (audio as any).error
        });
        resolved = true;
        cleanup();
        reject(event);
      };

      const handleLoadedMetadata = () => {
        console.log('[DEBUG ensureAudioCanPlay] Audio metadata loaded:', {
          duration: audio.duration,
          readyState: audio.readyState
        });
      };

      // 优先等待 canplaythrough，如果超时则使用 canplay
      const doResolve = () => {
        if (resolved) return;
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        if (audio.currentTime > 0) {
          console.log('[DEBUG ensureAudioCanPlay] Resetting currentTime to 0');
          audio.currentTime = 0;
        }
        resolved = true;
        cleanup();
        resolve();
      };
      
      const handleCanPlayFinal = () => {
        if (resolved) return;
        console.log('[DEBUG ensureAudioCanPlay] Audio can play now', {
          readyState: audio.readyState,
          paused: audio.paused,
          currentTime: audio.currentTime,
          duration: audio.duration
        });
        doResolve();
      };

      const handleCanPlayThroughFinal = () => {
        if (resolved) return;
        console.log('[DEBUG ensureAudioCanPlay] Audio can play through now', {
          readyState: audio.readyState,
          paused: audio.paused,
          currentTime: audio.currentTime,
          duration: audio.duration
        });
        doResolve();
      };
      
      audio.addEventListener('canplaythrough', handleCanPlayThroughFinal, { once: true });
      audio.addEventListener('canplay', handleCanPlayFinal, { once: true });
      audio.addEventListener('error', handleError, { once: true });
      audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      
      // 设置超时，如果 3 秒内没有响应，但 readyState >= 2，则继续
      timeout = setTimeout(() => {
        if (!resolved && audio.readyState >= 2) {
          console.log('[DEBUG ensureAudioCanPlay] Timeout reached, but readyState >= 2, resolving');
          doResolve();
        }
      }, 3000);
      
      console.log('[DEBUG ensureAudioCanPlay] Calling audio.load()');
      audio.load();
    });
  };

  // 将 Base64 音频转换为 Blob URL
  const convertBase64ToBlobURL = (base64DataUrl: string): string | null => {
    try {
      const [header, data] = base64DataUrl.split(',');
      if (!data) {
        console.error('[DEBUG convertBase64ToBlobURL] Invalid base64 data URL format');
        return null;
      }
      
      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'audio/mpeg';
      
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: mimeType });
      const blobURL = URL.createObjectURL(blob);
      console.log('[DEBUG convertBase64ToBlobURL] Converted Base64 to Blob URL:', {
        mimeType,
        blobSize: blob.size,
        blobURL: blobURL.substring(0, 50) + '...'
      });
      return blobURL;
    } catch (error) {
      console.error('[DEBUG convertBase64ToBlobURL] Error converting Base64 to Blob:', error);
      return null;
    }
  };

  const playAudioElementSafely = async (audio: HTMLAudioElement) => {
    console.log('[DEBUG playAudioElementSafely] Starting playback attempt');
    const isBase64 = audio.src?.startsWith('data:audio');
    console.log('[DEBUG playAudioElementSafely] Audio state before:', {
      src: audio.src?.substring(0, 150),
      isBase64,
      readyState: audio.readyState,
      paused: audio.paused,
      currentTime: audio.currentTime,
      duration: audio.duration,
      muted: audio.muted,
      volume: audio.volume,
      networkState: audio.networkState,
      error: (audio as any).error ? {
        code: (audio as any).error.code,
        message: (audio as any).error.message
      } : null
    });
    
    // 如果是 Base64 音频，尝试转换为 Blob URL
    let blobURL: string | null = null;
    let originalSrc: string | null = null;
    if (isBase64) {
      console.log('[DEBUG playAudioElementSafely] Base64 audio detected, converting to Blob URL...');
      originalSrc = audio.src;
      blobURL = convertBase64ToBlobURL(audio.src);
      if (blobURL) {
        audio.src = blobURL;
        console.log('[DEBUG playAudioElementSafely] Base64 converted to Blob URL, reloading audio...');
        audio.load();
      } else {
        console.warn('[DEBUG playAudioElementSafely] Failed to convert Base64 to Blob URL, using original');
      }
    }
    
    // 检查音频错误状态
    if ((audio as any).error) {
      console.error('[DEBUG playAudioElementSafely] Audio has error before play:', (audio as any).error);
    }
    
    try {
      await ensureAudioCanPlay(audio);
      console.log('[DEBUG playAudioElementSafely] Audio ready, calling play()');
      
      // 设置一个标志来检查 playing 事件是否触发
      let playingEventFired = false;
      const playingHandler = () => {
        playingEventFired = true;
        console.log('[DEBUG playAudioElementSafely] playing event fired!');
        audio.removeEventListener('playing', playingHandler);
      };
      audio.addEventListener('playing', playingHandler, { once: true });
      
      const playPromise = audio.play();
      console.log('[DEBUG playAudioElementSafely] play() called, waiting for promise');
      await playPromise;
      console.log('[DEBUG playAudioElementSafely] Playback started successfully');
      console.log('[DEBUG playAudioElementSafely] Audio state after play():', {
        paused: audio.paused,
        currentTime: audio.currentTime,
        readyState: audio.readyState,
        networkState: audio.networkState,
        error: (audio as any).error ? {
          code: (audio as any).error.code,
          message: (audio as any).error.message
        } : null
      });
      
      // 延迟检查播放状态，多次检查以确认是否真的在播放
      const initialTime = audio.currentTime;
      
      // 检查 playing 事件是否在短时间内触发
      setTimeout(() => {
        if (!playingEventFired) {
          console.warn('[DEBUG playAudioElementSafely] WARNING: playing event did not fire within 100ms!');
          console.warn('[DEBUG playAudioElementSafely] This suggests playback was blocked by browser autoplay policy');
        }
      }, 100);
      
      setTimeout(() => {
        const timeAfter100ms = audio.currentTime;
        const timeChanged = timeAfter100ms > initialTime;
        console.log('[DEBUG playAudioElementSafely] Audio state 100ms after play():', {
          paused: audio.paused,
          currentTime: audio.currentTime,
          initialTime,
          timeChanged,
          readyState: audio.readyState,
          seeking: audio.seeking,
          playingEventFired
        });
        if (!timeChanged && !audio.paused) {
          console.warn('[DEBUG playAudioElementSafely] WARNING: Audio is not paused but currentTime did not change!');
          // 尝试重新播放
          if (!playingEventFired) {
            console.log('[DEBUG playAudioElementSafely] Attempting to force play again...');
            audio.play().catch(err => {
              console.error('[DEBUG playAudioElementSafely] Retry play failed:', err);
            });
          }
        }
      }, 100);
      
      setTimeout(() => {
        const timeAfter500ms = audio.currentTime;
        const timeChanged = timeAfter500ms > initialTime;
        console.log('[DEBUG playAudioElementSafely] Audio state 500ms after play():', {
          paused: audio.paused,
          currentTime: audio.currentTime,
          initialTime,
          timeChanged,
          readyState: audio.readyState,
          playingEventFired,
          muted: audio.muted,
          volume: audio.volume,
          seeking: audio.seeking,
          error: (audio as any).error ? {
            code: (audio as any).error.code,
            message: (audio as any).error.message
          } : null
        });
        if (!timeChanged && !audio.paused) {
          console.error('[DEBUG playAudioElementSafely] ERROR: Audio is not paused but currentTime did not change after 500ms!');
          console.error('[DEBUG playAudioElementSafely] This indicates the audio is not actually playing despite paused=false');
          console.error('[DEBUG playAudioElementSafely] playingEventFired:', playingEventFired);
          console.error('[DEBUG playAudioElementSafely] muted:', audio.muted, 'volume:', audio.volume);
          console.error('[DEBUG playAudioElementSafely] isBase64:', audio.src?.startsWith('data:audio'));
          console.error('[DEBUG playAudioElementSafely] Possible causes:');
          console.error('[DEBUG playAudioElementSafely] 1. Browser autoplay policy blocking playback');
          console.error('[DEBUG playAudioElementSafely] 2. Audio source is invalid or corrupted (especially Base64)');
          console.error('[DEBUG playAudioElementSafely] 3. Audio element is muted or disabled');
          console.error('[DEBUG playAudioElementSafely] 4. Network/CORS issues preventing playback');
          console.error('[DEBUG playAudioElementSafely] 5. Audio element was recreated by React during playback');
          
          // 检查音频数据是否有效
          if (audio.src?.startsWith('data:audio')) {
            console.warn('[DEBUG playAudioElementSafely] Base64 audio detected - checking data validity');
            const base64Data = audio.src.split(',')[1];
            if (!base64Data || base64Data.length < 100) {
              console.error('[DEBUG playAudioElementSafely] Base64 audio data appears to be invalid or too short');
            }
          }
          
          // 尝试修复：确保音频未静音，重置并重新播放
          console.log('[DEBUG playAudioElementSafely] Attempting recovery: ensure unmuted, reset currentTime, reload and play');
          audio.muted = false;
          audio.volume = 1.0;
          const wasPlaying = !audio.paused;
          audio.currentTime = 0;
          
          // 如果之前正在播放，尝试恢复播放
          if (wasPlaying) {
            audio.load();
            
            // 等待加载完成后再次播放
            const retryPlay = () => {
              audio.play().then(() => {
                console.log('[DEBUG playAudioElementSafely] Recovery play() succeeded');
                // 再次检查 playing 事件和 timeupdate
                const retryPlayingHandler = () => {
                  console.log('[DEBUG playAudioElementSafely] Recovery: playing event fired!');
                  // 检查 timeupdate 是否触发
                  setTimeout(() => {
                    if (audio.currentTime === 0 && !audio.paused) {
                      console.error('[DEBUG playAudioElementSafely] Recovery: Still no time progression after playing event!');
                    }
                  }, 200);
                };
                audio.addEventListener('playing', retryPlayingHandler, { once: true });
              }).catch(err => {
                console.error('[DEBUG playAudioElementSafely] Recovery play() failed:', err);
              });
            };
            
            if (audio.readyState >= 2) {
              setTimeout(retryPlay, 100);
            } else {
              audio.addEventListener('canplay', retryPlay, { once: true });
              audio.addEventListener('canplaythrough', retryPlay, { once: true });
            }
          }
        }
      }, 500);
      
      // 设置清理 Blob URL 的监听器（如果使用了 Blob URL）
      if (blobURL && originalSrc) {
        const cleanupBlobURL = () => {
          console.log('[DEBUG playAudioElementSafely] Cleaning up Blob URL');
          URL.revokeObjectURL(blobURL!);
          // 恢复原始 src（如果需要）
          // audio.src = originalSrc;
        };
        
        // 在音频结束时清理
        const handleEnded = () => {
          cleanupBlobURL();
          audio.removeEventListener('ended', handleEnded);
        };
        audio.addEventListener('ended', handleEnded, { once: true });
        
        // 在组件卸载或音频元素被移除时清理（通过一个标记）
        // 注意：这里我们使用一个 WeakMap 来跟踪需要清理的音频元素
        if (!(window as any).__audioBlobURLCleanup) {
          (window as any).__audioBlobURLCleanup = new WeakMap();
        }
        (window as any).__audioBlobURLCleanup.set(audio, cleanupBlobURL);
      }
      
      return playPromise;
    } catch (error) {
      console.error('[DEBUG playAudioElementSafely] Play failed:', error);
      console.error('[DEBUG playAudioElementSafely] Audio state on error:', {
        paused: audio.paused,
        currentTime: audio.currentTime,
        readyState: audio.readyState,
        src: audio.src?.substring(0, 150),
        error: (audio as any).error ? {
          code: (audio as any).error.code,
          message: (audio as any).error.message
        } : null
      });
      
      // 如果出错，立即清理 Blob URL
      if (blobURL) {
        console.log('[DEBUG playAudioElementSafely] Cleaning up Blob URL due to error');
        URL.revokeObjectURL(blobURL);
        if (originalSrc) {
          audio.src = originalSrc;
        }
      }
      
      throw error;
    }
  };

  const requestMusicGeneration = async ({
    prompt,
    lyrics,
    audioSetting = DEFAULT_AUDIO_SETTING,
  }: {
    prompt: string;
    lyrics: string; // 可以为空字符串（当instrumental为true时）
    audioSetting?: typeof DEFAULT_AUDIO_SETTING;
  }) => {
    const response = await fetch('/api/music/generate-from-lyrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        lyrics: lyrics || '', // 如果为空则传空字符串
        audioSetting,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate music audio');
    }

    if (!data.audioBase64) {
      throw new Error('Music generation succeeded but audio data is missing.');
    }

    const format = data.format || audioSetting.format || 'mp3';

    return {
      audioUrl: `data:audio/${format};base64,${data.audioBase64}`,
      traceId: data.traceId as string | undefined,
      extraInfo: data.extraInfo,
      status: data.status,
      format,
    };
  };

  useEffect(() => {
    setIsMounted(true);
    
    // 获取积分余额
    const fetchCredits = async () => {
      try {
        const balanceCheck = await checkCreditsBalance(0);
        if (balanceCheck.balance !== undefined) {
          setCreditsBalance(balanceCheck.balance);
        }
      } catch (error) {
        console.error("Error fetching credits:", error);
      }
    };
    
    fetchCredits();
    
    // 加载音乐示例
    const loadMusicExamples = async () => {
      try {
        const response = await fetch('/music/music.json');
        if (response.ok) {
          const data: MusicExample[] = await response.json();
          setMusicExamples(data);
        }
      } catch (error) {
        console.error("Error loading music examples:", error);
      }
    };
    
    loadMusicExamples();
    
    // 加载用户的音乐
    const loadMyMusic = async () => {
      try {
        setIsLoadingMyMusic(true);
        const response = await fetch('/api/music/list');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const formattedMusic: GeneratedMusic[] = result.data.map((music: any) => ({
              id: music.id,
              audioUrl: music.audio_url || music.audioUrl,
              coverUrl: music.cover_url || music.coverUrl,
              prompt: music.prompt,
              title: music.title || music.prompt?.substring(0, 50),
              style: music.genre || "",
              mood: music.mood || "",
              duration: music.duration ? String(music.duration) : "30",
              createdAt: new Date(music.created_at || music.createdAt),
              lyrics: music.metadata?.lyrics || music.lyrics,
              hasLyrics: music.lyrics || (music.metadata?.lyrics ? true : false),
            }));
            setMyMusicList(formattedMusic);
            setGeneratedMusics(formattedMusic); // 同时更新 generatedMusics 以保持兼容
          }
        }
      } catch (error) {
        console.error("Error loading my music:", error);
      } finally {
        setIsLoadingMyMusic(false);
      }
    };
    
    loadMyMusic();
    
    // 监听积分更新事件
    const handleCreditsUpdated = async () => {
      await fetchCredits();
    };
    
    window.addEventListener('credits-updated', handleCreditsUpdated);
    
    return () => {
      window.removeEventListener('credits-updated', handleCreditsUpdated);
    };
  }, []);

  const handleInputChange = (field: keyof MusicFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRandomPrompt = async () => {
    try {
      const response = await fetch('/music/musicPrompt.json');
      if (response.ok) {
        const data: Array<{ id: number; description: string }> = await response.json();
        if (data.length > 0) {
          const randomIndex = Math.floor(Math.random() * data.length);
          const randomPrompt = data[randomIndex]?.description ?? "";
          if (randomPrompt) {
            handleInputChange("prompt", randomPrompt);
          }
        }
      }
    } catch (error) {
      console.error("Error loading random prompt:", error);
    }
  };

  const handleGenerate = async () => {
    if (!trimmedPromptValue) {
      alert("Please enter a description for your music");
      return;
    }

    const selectedGenre = formData.genre || GENRES[0].value;
    const selectedMood = formData.mood || MOODS[0].value;
    const selectedTheme = formData.theme || THEMES[0].value;
    const selectedTempo = formData.tempo || TEMPOS[0].value;
    const selectedEnergy = formData.energy || ENERGY_LEVELS[0].value;

    // 检查积分余额
    const requiredCredits = formData.lyrics ? requiredCreditsForLyrics : requiredCreditsForMusic;
    const creditsCheck = await checkCreditsBalance(requiredCredits);
    if (!creditsCheck.sufficient) {
      alert(`Insufficient credits. Required: ${requiredCredits}, Current: ${creditsCheck.balance || 0}`);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress({
      status: 'generating',
      message: formData.lyrics ? 'Generating lyrics...' : 'Creating your music...'
    });

    try {
      if (formData.lyrics) {
        // 歌词模式：扣35积分，直接生成歌曲和封面
        const deductResult = await deductLyricsCredits({
          prompt: promptValue,
          genre: formData.genre,
          mood: formData.mood,
        });

        if (!deductResult.success) {
          throw new Error(deductResult.error || 'Failed to deduct credits');
        }

        // 更新积分余额
        if (deductResult.newBalance !== undefined) {
          setCreditsBalance(deductResult.newBalance);
          window.dispatchEvent(new Event('credits-updated'));
        }

        // 调用API生成歌词和标题
        setGenerationProgress({
          status: 'generating',
          message: 'Generating lyrics and title...'
        });

        const promptResponse = await fetch('/api/music/generate-prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            genre: selectedGenre,
            mood: selectedMood,
            theme: selectedTheme,
            tempo: selectedTempo,
            energy: selectedEnergy,
            description: promptValue,
          }),
        });

        if (!promptResponse.ok) {
          const errorData = await promptResponse.json();
          throw new Error(errorData.error || 'Failed to generate lyrics');
        }

        const promptResult = await promptResponse.json();
        const generatedPrompt = promptResult.prompt || promptValue;
        const generatedLyrics = promptResult.lyrics || '';
        const generatedTitle = promptResult.title || '';

        // 如果选择伴奏模式，lyrics传空
        const lyricsForMusic = formData.instrumental ? '' : generatedLyrics;

        // 构建音乐生成提示词
        const minimaxiPrompt = buildMusicGenerationPrompt({
          genre: selectedGenre,
          mood: selectedMood,
          theme: selectedTheme,
          tempo: selectedTempo,
          energy: selectedEnergy,
          description: promptValue,
          voiceType: formData.instrumental ? undefined : formData.voiceType,
        });

        // 同时生成音乐、标题和封面
        setGenerationProgress({
          status: 'generating',
          message: 'Creating your music with lyrics...'
        });

        // 如果是歌词模式（非伴奏），调用新API获取标题和图片描述
        const titleAndImagePromise = !formData.instrumental && generatedLyrics && generatedLyrics.trim()
          ? fetch('/api/music/generate-title-and-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                lyrics: generatedLyrics.trim(),
              }),
            }).then(async (res) => {
              if (res.ok) {
                const result = await res.json();
                if (result.success) {
                  return {
                    title: result.title || generatedTitle || promptValue.substring(0, 50),
                    imagePrompt: result.image || '',
                  };
                }
              }
              return {
                title: generatedTitle || promptValue.substring(0, 50),
                imagePrompt: '',
              };
            }).catch((error) => {
              console.error("Error generating title and image:", error);
              return {
                title: generatedTitle || promptValue.substring(0, 50),
                imagePrompt: '',
              };
            })
          : Promise.resolve({
              title: generatedTitle || promptValue.substring(0, 50),
              imagePrompt: '',
            });

        const [musicResult, titleAndImageResult] = await Promise.all([
          requestMusicGeneration({
            prompt: minimaxiPrompt,
            lyrics: lyricsForMusic,
          }),
          titleAndImagePromise,
        ]);

        // 使用获取的图片描述生成封面
        const imageResult = titleAndImageResult.imagePrompt
          ? await fetch('/api/scenes/generate-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt: titleAndImageResult.imagePrompt,
              }),
            }).then(async (res) => {
              if (res.ok) {
                const result = await res.json();
                if (result.success && result.data && result.data.length > 0) {
                  return result.data[0].url;
                }
              }
              return null;
            }).catch((error) => {
              console.error("Error generating cover image:", error);
              return null;
            })
          : null;

        // 创建音乐对象
        const newMusic: GeneratedMusic = {
          id: `music-${Date.now()}`,
          audioUrl: musicResult.audioUrl,
          coverUrl: imageResult || null,
          prompt: generatedPrompt,
          title: titleAndImageResult.title,
          style: selectedGenre || "",
          mood: selectedMood,
          duration: "30",
          createdAt: new Date(),
          lyrics: generatedLyrics,
          hasLyrics: !formData.instrumental && !!generatedLyrics,
        };

        // 保存到数据库
        try {
          const saveResponse = await fetch('/api/music/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: titleAndImageResult.title,
              prompt: generatedPrompt,
              genre: selectedGenre,
              mood: selectedMood,
              theme: selectedTheme,
              tempo: selectedTempo,
              energy: selectedEnergy,
              lyrics: !formData.instrumental && !!generatedLyrics,
              instrumental: formData.instrumental,
              voiceType: formData.instrumental ? undefined : formData.voiceType,
              audioUrl: musicResult.audioUrl,
              coverUrl: imageResult || undefined,
              duration: 30,
              status: 'completed',
              metadata: {
                lyrics: generatedLyrics,
                minimaxiTraceId: musicResult.traceId,
                minimaxiExtraInfo: musicResult.extraInfo,
              },
            }),
          });

          if (saveResponse.ok) {
            const result = await saveResponse.json();
            if (result.success && result.data) {
              newMusic.id = result.data.id;
              if (result.data.audio_url) {
                newMusic.audioUrl = result.data.audio_url;
              }
              if (result.data.cover_url) {
                newMusic.coverUrl = result.data.cover_url;
              }
            }
          }
        } catch (saveError) {
          console.error("Error saving music to database:", saveError);
        }

        logGenerationSnapshot('Music With Lyrics Generated', {
          id: newMusic.id,
          prompt: newMusic.prompt,
          title: newMusic.title,
          genre: newMusic.style,
          mood: newMusic.mood,
          duration: newMusic.duration,
          lyrics: generatedLyrics,
          instrumental: formData.instrumental,
          creditsSpent: requiredCreditsForLyrics,
          audioUrl: newMusic.audioUrl,
          coverUrl: newMusic.coverUrl,
          minimaxiTraceId: musicResult.traceId,
        });

        setGeneratedMusics(prev => [newMusic, ...prev]);
        setMyMusicList(prev => [newMusic, ...prev]);

        // 切换到 My Music 标签页并滚动到该区域
        setActiveTab('my-music');
        setTimeout(() => {
          myMusicSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        setGenerationProgress({
          status: 'completed',
          message: 'Music with lyrics generated successfully!'
        });
      } else {
        // 非歌词模式：扣5积分直接生成音乐
        const deductResult = await deductMusicCredits({
          prompt: promptValue,
          genre: formData.genre,
          mood: formData.mood,
        });

        if (!deductResult.success) {
          throw new Error(deductResult.error || 'Failed to deduct credits');
        }

        // 更新积分余额
        if (deductResult.newBalance !== undefined) {
          setCreditsBalance(deductResult.newBalance);
          window.dispatchEvent(new Event('credits-updated'));
        }

        // 调用API生成音乐提示词
        setGenerationProgress({
          status: 'generating',
          message: 'Generating music prompt...'
        });

        const promptResponse = await fetch('/api/music/generate-prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            genre: selectedGenre,
            mood: selectedMood,
            theme: selectedTheme,
            tempo: selectedTempo,
            energy: selectedEnergy,
            description: promptValue,
          }),
        });

        if (!promptResponse.ok) {
          const errorData = await promptResponse.json();
          throw new Error(errorData.error || 'Failed to generate music prompt');
        }

        const promptResult = await promptResponse.json();
        const generatedPrompt = promptResult.prompt || promptValue;
        const generatedLyrics = promptResult.lyrics || '';
        const generatedImage = promptResult.image || '';
        const generatedTitle = promptResult.title || '';

        setPendingGeneration({
          mode: 'music',
          description: promptValue,
          generatedPrompt,
          title: generatedTitle,
          genre: selectedGenre,
          mood: selectedMood,
          theme: selectedTheme,
          tempo: selectedTempo,
          energy: selectedEnergy,
          lyrics: generatedLyrics,
          instrumental: formData.instrumental,
          voiceType: formData.instrumental ? 'female' : formData.voiceType, // 默认值，但实际不会在伴奏模式下使用
          image: generatedImage,
        });

        setLyricsEditDialog({
          isOpen: true,
          lyrics: generatedLyrics,
          musicId: null,
          isNewGeneration: true,
        });

        logGenerationSnapshot('Music Prompt Generated', {
          mode: 'music',
          description: promptValue,
          generatedPrompt,
          lyricsPreview: generatedLyrics,
          genre: selectedGenre,
          mood: selectedMood,
          theme: selectedTheme,
          tempo: selectedTempo,
          energy: selectedEnergy,
          instrumental: formData.instrumental,
          requiredCredits: requiredCreditsForMusic,
        });

        setGenerationProgress({
          status: 'completed',
          message: 'Lyrics generated. Review before creating your music.'
        });
      }

      // Reset form
      setFormData(prev => ({
        ...prev,
        prompt: ""
      }));
    } catch (error) {
      console.error("Error generating music:", error);
      setGenerationProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate. Please try again.'
      });
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        setGenerationProgress({
          status: 'idle',
          message: ''
        });
      }, 3000);
    }
  };

  const handleConfirmLyricsAndCreateMusic = async () => {
    if (!pendingGeneration || pendingGeneration.mode !== 'music') {
      return;
    }

    const lyricsToAttach = lyricsEditDialog.lyrics.trim() || pendingGeneration.lyrics?.trim() || '';

    // 如果选择伴奏模式，允许没有歌词；否则需要提供歌词
    if (!pendingGeneration.instrumental && !lyricsToAttach) {
      alert('Please provide lyrics before generating music.');
      return;
    }

    const minimaxiPrompt = buildMusicGenerationPrompt({
      genre: pendingGeneration.genre,
      mood: pendingGeneration.mood,
      theme: pendingGeneration.theme,
      tempo: pendingGeneration.tempo,
      energy: pendingGeneration.energy,
      description: pendingGeneration.description,
      voiceType: pendingGeneration.instrumental ? undefined : pendingGeneration.voiceType,
    });

    // 立即关闭弹窗并显示生成状态
    setLyricsEditDialog({
      isOpen: false,
      lyrics: '',
      musicId: null,
      isNewGeneration: false,
    });

    setIsGenerating(true);
    setGenerationProgress({
      status: 'generating',
      message: 'Creating your music...'
    });

    try {
      // 如果选择伴奏模式，lyrics传空
      const lyricsForMusic = pendingGeneration.instrumental ? '' : lyricsToAttach;
      
      const musicResult = await requestMusicGeneration({
        prompt: minimaxiPrompt,
        lyrics: lyricsForMusic,
      });

      const newMusic: GeneratedMusic = {
        id: `music-${Date.now()}`,
        audioUrl: musicResult.audioUrl,
        coverUrl: null,
        prompt: pendingGeneration.generatedPrompt,
        title: pendingGeneration.title || pendingGeneration.description.substring(0, 50),
        style: pendingGeneration.genre,
        mood: pendingGeneration.mood,
        duration: "30",
        createdAt: new Date(),
        hasLyrics: !pendingGeneration.instrumental && !!lyricsToAttach,
        lyrics: lyricsToAttach || undefined,
      };

      try {
        const payload: Record<string, any> = {
          title: pendingGeneration.title || pendingGeneration.description.substring(0, 50),
          prompt: pendingGeneration.generatedPrompt,
          genre: pendingGeneration.genre,
          mood: pendingGeneration.mood,
          theme: pendingGeneration.theme,
          tempo: pendingGeneration.tempo,
          energy: pendingGeneration.energy,
          lyrics: !pendingGeneration.instrumental && !!lyricsToAttach,
          instrumental: pendingGeneration.instrumental,
          voiceType: pendingGeneration.instrumental ? undefined : pendingGeneration.voiceType,
          audioUrl: musicResult.audioUrl,
          duration: 30,
          status: 'completed',
          metadata: {
            lyrics: lyricsToAttach,
            minimaxiTraceId: musicResult.traceId,
            minimaxiExtraInfo: musicResult.extraInfo,
          },
        };

        const saveResponse = await fetch('/api/music/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (saveResponse.ok) {
          const result = await saveResponse.json();
          if (result.success && result.data) {
            newMusic.id = result.data.id;
            if (result.data.audio_url) {
              newMusic.audioUrl = result.data.audio_url;
            }
            if (result.data.cover_url) {
              newMusic.coverUrl = result.data.cover_url;
            }
          }
        }
      } catch (saveError) {
        console.error("Error saving music to database:", saveError);
      }

      logGenerationSnapshot('Music Generation Result', {
        id: newMusic.id,
        prompt: newMusic.prompt,
        title: newMusic.title,
        genre: newMusic.style,
        mood: newMusic.mood,
        duration: newMusic.duration,
        lyricsAttached: !!newMusic.lyrics,
        instrumental: pendingGeneration.instrumental,
        audioUrl: newMusic.audioUrl,
        coverUrl: newMusic.coverUrl,
        minimaxiTraceId: musicResult.traceId,
      });

      setGeneratedMusics(prev => [newMusic, ...prev]);
      setMyMusicList(prev => [newMusic, ...prev]);

      // 切换到 My Music 标签页并滚动到该区域
      setActiveTab('my-music');
      setTimeout(() => {
        myMusicSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      setPendingGeneration(null);

      setGenerationProgress({
        status: 'completed',
        message: 'Music generated successfully!'
      });
    } catch (error) {
      console.error("Error generating music:", error);
      setGenerationProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate. Please try again.'
      });
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        setGenerationProgress({
          status: 'idle',
          message: ''
        });
      }, 3000);
    }
  };

  // 从歌词编辑弹窗生成音乐（需要额外扣费）
  const handleGenerateMusicFromLyrics = async (lyrics: string) => {
    const trimmedLyrics = lyrics.trim();
    if (!trimmedLyrics) {
      alert('Please provide lyrics before generating music.');
      return;
    }

    const context: PendingGenerationContext = pendingGeneration && pendingGeneration.mode === 'lyrics'
      ? { ...pendingGeneration, lyrics }
      : {
          mode: 'lyrics',
          description: promptValue,
          generatedPrompt: promptValue,
          genre: formData.genre || GENRES[0].value,
          mood: formData.mood || MOODS[0].value,
          theme: formData.theme || THEMES[0].value,
          tempo: formData.tempo || TEMPOS[0].value,
          energy: formData.energy || ENERGY_LEVELS[0].value,
          lyrics,
          instrumental: formData.instrumental,
          voiceType: formData.instrumental ? 'female' : formData.voiceType, // 默认值，但实际不会在伴奏模式下使用
          image: pendingGeneration?.image,
        };

    const minimaxiPrompt = buildMusicGenerationPrompt({
      genre: context.genre,
      mood: context.mood,
      theme: context.theme,
      tempo: context.tempo,
      energy: context.energy,
      description: context.description,
      voiceType: context.instrumental ? undefined : context.voiceType,
    });

    // 检查积分余额
    const creditsCheck = await checkCreditsBalance(requiredCreditsForMusicWithLyrics);
    if (!creditsCheck.sufficient) {
      alert(`Insufficient credits. Required: ${requiredCreditsForMusicWithLyrics}, Current: ${creditsCheck.balance || 0}`);
      return;
    }

    // 立即关闭弹窗并显示生成状态
    setLyricsEditDialog({
      isOpen: false,
      lyrics: '',
      musicId: null,
      isNewGeneration: false,
    });

    setIsGenerating(true);
    setGenerationProgress({
      status: 'generating',
      message: 'Creating your music with lyrics...'
    });

    try {
      // 扣30积分
      const deductResult = await deductMusicWithLyricsCredits({
        prompt: context.description,
        genre: context.genre,
        mood: context.mood,
        lyrics: trimmedLyrics,
      });

      if (!deductResult.success) {
        throw new Error(deductResult.error || 'Failed to deduct credits');
      }

      // 更新积分余额
      if (deductResult.newBalance !== undefined) {
        setCreditsBalance(deductResult.newBalance);
        window.dispatchEvent(new Event('credits-updated'));
      }

      // 如果选择伴奏模式，lyrics传空
      const lyricsForMusic = context.instrumental ? '' : trimmedLyrics;

      // 同时生成音乐和图片（如果存在 image 字段）
      const [musicResult, imageResult] = await Promise.all([
        requestMusicGeneration({
          prompt: minimaxiPrompt,
          lyrics: lyricsForMusic,
        }),
        // 如果存在 image 字段，则生成图片
        context.image && context.image.trim()
          ? fetch('/api/scenes/generate-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt: context.image.trim(),
              }),
            }).then(async (res) => {
              if (res.ok) {
                const result = await res.json();
                if (result.success && result.data && result.data.length > 0) {
                  // 返回第一张图片的URL
                  return result.data[0].url;
                }
              }
              return null;
            }).catch((error) => {
              console.error("Error generating cover image:", error);
              return null;
            })
          : Promise.resolve(null),
      ]);

      // 生成带歌词的音乐
      const newMusic: GeneratedMusic = {
        id: `music-${Date.now()}`,
        audioUrl: musicResult.audioUrl,
        coverUrl: imageResult || null,
        prompt: context.generatedPrompt,
        title: context.title || context.description.substring(0, 50),
        style: context.genre || "",
        mood: context.mood,
        duration: "30",
        createdAt: new Date(),
        lyrics: trimmedLyrics,
        hasLyrics: !context.instrumental && !!trimmedLyrics,
      };

      // 保存到数据库
      try {
        const saveResponse = await fetch('/api/music/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: context.title || context.description.substring(0, 50),
            prompt: context.generatedPrompt,
            genre: context.genre,
            mood: context.mood,
            theme: context.theme,
            tempo: context.tempo,
            energy: context.energy,
            lyrics: !context.instrumental && !!trimmedLyrics,
            instrumental: context.instrumental,
            voiceType: context.instrumental ? undefined : context.voiceType,
            audioUrl: musicResult.audioUrl,
            coverUrl: imageResult || undefined,
            duration: 30,
            status: 'completed',
            metadata: { 
              lyrics: trimmedLyrics,
              minimaxiTraceId: musicResult.traceId,
              minimaxiExtraInfo: musicResult.extraInfo,
              imagePrompt: context.image,
            },
          }),
        });

        if (saveResponse.ok) {
          const result = await saveResponse.json();
          if (result.success && result.data) {
            newMusic.id = result.data.id;
            if (result.data.audio_url) {
              newMusic.audioUrl = result.data.audio_url;
            }
            if (result.data.cover_url) {
              newMusic.coverUrl = result.data.cover_url;
            }
          }
        }
      } catch (saveError) {
        console.error("Error saving music to database:", saveError);
      }

      logGenerationSnapshot('Music With Lyrics Result', {
        id: newMusic.id,
        prompt: newMusic.prompt,
        title: newMusic.title,
        genre: newMusic.style,
        mood: newMusic.mood,
        duration: newMusic.duration,
        lyrics: trimmedLyrics,
        instrumental: context.instrumental,
        creditsSpent: requiredCreditsForMusicWithLyrics,
        audioUrl: newMusic.audioUrl,
        coverUrl: newMusic.coverUrl,
        minimaxiTraceId: musicResult.traceId,
      });

      setGeneratedMusics(prev => [newMusic, ...prev]);
      setMyMusicList(prev => [newMusic, ...prev]);
      
      // 切换到 My Music 标签页并滚动到该区域
      setActiveTab('my-music');
      setTimeout(() => {
        myMusicSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      
      setPendingGeneration(null);

      setGenerationProgress({
        status: 'completed',
        message: 'Music with lyrics generated successfully!'
      });
    } catch (error) {
      console.error("Error generating music with lyrics:", error);
      setGenerationProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate music. Please try again.'
      });
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        setGenerationProgress({
          status: 'idle',
          message: ''
        });
      }, 3000);
    }
  };

  const handlePlayPause = async (musicId: string) => {
    console.log('[DEBUG handlePlayPause] Called with musicId:', musicId, 'currentPlayingId:', currentPlayingId);
    console.log('[DEBUG handlePlayPause] audioElementsRef.current size:', audioElementsRef.current.size);
    console.log('[DEBUG handlePlayPause] audioElementsRef.current keys:', Array.from(audioElementsRef.current.keys()));
    
    if (currentPlayingId === musicId) {
      // Pause current
      console.log('[DEBUG handlePlayPause] Pausing current audio');
      const audio = audioElementsRef.current.get(musicId);
      console.log('[DEBUG handlePlayPause] Got audio element:', !!audio);
      if (audio) {
        audio.pause();
        console.log('[DEBUG handlePlayPause] Audio paused');
      }
      setCurrentPlayingId(null);
    } else {
      // Stop example audios when switching sections
      console.log('[DEBUG handlePlayPause] Stopping all example audios');
      exampleAudioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      setExamplePlayingId(null);

      // Stop all other audio
      console.log('[DEBUG handlePlayPause] Stopping all other main audios');
      audioElementsRef.current.forEach((audio, id) => {
        if (id !== musicId) {
          audio.pause();
          audio.currentTime = 0;
        }
      });

      // Play new audio
      const music = generatedMusics.find((m) => m.id === musicId);
      console.log('[DEBUG handlePlayPause] Found music:', !!music, 'audioUrl:', !!music?.audioUrl);
      console.log('[DEBUG handlePlayPause] Audio URL type:', music?.audioUrl ? (music.audioUrl.startsWith('data:audio') ? 'BASE64' : 'URL') : 'NONE');
      console.log('[DEBUG handlePlayPause] Audio URL preview:', music?.audioUrl?.substring(0, 150));
      
      if (music?.audioUrl) {
        const audio = audioElementsRef.current.get(musicId);
        console.log('[DEBUG handlePlayPause] Got audio element for playback:', !!audio);
        
        if (audio) {
          console.log('[DEBUG handlePlayPause] Audio element details:', {
            src: audio.src?.substring(0, 150),
            srcMatches: audio.src === music.audioUrl,
            isBase64: audio.src?.startsWith('data:audio'),
            readyState: audio.readyState,
            paused: audio.paused,
            currentTime: audio.currentTime,
            duration: audio.duration,
            muted: audio.muted,
            volume: audio.volume
          });
          
          setCurrentPlayingId(musicId);
          try {
            console.log('[DEBUG handlePlayPause] Attempting to play audio');
            await playAudioElementSafely(audio);
            console.log('[DEBUG handlePlayPause] Audio playback successful');
            // 再次检查播放状态
            setTimeout(() => {
              console.log('[DEBUG handlePlayPause] Audio state 200ms after play:', {
                paused: audio.paused,
                currentTime: audio.currentTime,
                readyState: audio.readyState
              });
            }, 200);
          } catch (error) {
            console.error("[DEBUG handlePlayPause] Error playing audio:", error);
            setCurrentPlayingId(null);
          }
        } else {
          console.error('[DEBUG handlePlayPause] No audio element found for musicId:', musicId);
          console.error('[DEBUG handlePlayPause] Available audio element IDs:', Array.from(audioElementsRef.current.keys()));
        }
      } else {
        console.error('[DEBUG handlePlayPause] Music has no audioUrl:', music);
      }
    }
  };

  const handleSeek = (musicId: string, time: number) => {
    const audio = audioElementsRef.current.get(musicId);
    if (audio) {
      audio.currentTime = time;
      setAudioProgress(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(musicId) || { currentTime: 0, duration: 0 };
        newMap.set(musicId, { ...current, currentTime: time });
        return newMap;
      });
    }
  };

  const handleDownload = (musicId: string) => {
    const music = generatedMusics.find(m => m.id === musicId);
    if (music?.audioUrl) {
      const link = document.createElement('a');
      link.href = music.audioUrl;
      link.download = `music-${musicId}.mp3`;
      link.click();
    }
  };

  const handleNavigateToMusicVideo = async (musicId: string) => {
    try {
      setVideoPreparingId(musicId);
      const response = await fetch('/api/music-video/characters/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ musicId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to prepare music video');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to open music video');
      setVideoPreparingId(null);
      return;
    }

    router.push(`/music-video/${musicId}`);
    setVideoPreparingId(null);
  };

  const handleExamplePlayPause = async (musicId: string) => {
    console.log('[DEBUG handleExamplePlayPause] Called with musicId:', musicId, 'examplePlayingId:', examplePlayingId);
    console.log('[DEBUG handleExamplePlayPause] exampleAudioElementsRef.current size:', exampleAudioElementsRef.current.size);
    console.log('[DEBUG handleExamplePlayPause] exampleAudioElementsRef.current keys:', Array.from(exampleAudioElementsRef.current.keys()));
    
    if (examplePlayingId === musicId) {
      // Pause current
      console.log('[DEBUG handleExamplePlayPause] Pausing current example audio');
      const audio = exampleAudioElementsRef.current.get(musicId);
      console.log('[DEBUG handleExamplePlayPause] Got audio element:', !!audio);
      if (audio) {
        audio.pause();
        console.log('[DEBUG handleExamplePlayPause] Audio paused');
      }
      setExamplePlayingId(null);
    } else {
      // Stop generated/my music playback before starting example audio
      console.log('[DEBUG handleExamplePlayPause] Stopping all main audios');
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      setCurrentPlayingId(null);

      // Stop all other audio
      console.log('[DEBUG handleExamplePlayPause] Stopping all other example audios');
      exampleAudioElementsRef.current.forEach((audio, id) => {
        if (id !== musicId) {
          audio.pause();
          audio.currentTime = 0;
        }
      });

      // Play new audio
      const music = musicExamples.find((m) => m.id === musicId);
      console.log('[DEBUG handleExamplePlayPause] Found music:', !!music, 'audioUrl:', !!music?.audioUrl);
      console.log('[DEBUG handleExamplePlayPause] Audio URL type:', music?.audioUrl ? (music.audioUrl.startsWith('data:audio') ? 'BASE64' : 'URL') : 'NONE');
      console.log('[DEBUG handleExamplePlayPause] Audio URL preview:', music?.audioUrl?.substring(0, 150));
      
      if (music?.audioUrl) {
        const audio = exampleAudioElementsRef.current.get(musicId);
        console.log('[DEBUG handleExamplePlayPause] Got audio element for playback:', !!audio);
        
        if (audio) {
          console.log('[DEBUG handleExamplePlayPause] Audio element details:', {
            src: audio.src?.substring(0, 150),
            srcMatches: audio.src === music.audioUrl,
            isBase64: audio.src?.startsWith('data:audio'),
            readyState: audio.readyState,
            paused: audio.paused,
            currentTime: audio.currentTime,
            duration: audio.duration,
            muted: audio.muted,
            volume: audio.volume
          });
          
          setExamplePlayingId(musicId);
          try {
            console.log('[DEBUG handleExamplePlayPause] Attempting to play example audio');
            await playAudioElementSafely(audio);
            console.log('[DEBUG handleExamplePlayPause] Audio playback successful');
            // 再次检查播放状态
            setTimeout(() => {
              console.log('[DEBUG handleExamplePlayPause] Audio state 200ms after play:', {
                paused: audio.paused,
                currentTime: audio.currentTime,
                readyState: audio.readyState
              });
            }, 200);
          } catch (error) {
            console.error("[DEBUG handleExamplePlayPause] Error playing example audio:", error);
            setExamplePlayingId(null);
          }
        } else {
          console.error('[DEBUG handleExamplePlayPause] No audio element found for musicId:', musicId);
          console.error('[DEBUG handleExamplePlayPause] Available audio element IDs:', Array.from(exampleAudioElementsRef.current.keys()));
        }
      } else {
        console.error('[DEBUG handleExamplePlayPause] Music has no audioUrl:', music);
      }
    }
  };

  const handleExampleSeek = (musicId: string, time: number) => {
    const audio = exampleAudioElementsRef.current.get(musicId);
    if (audio) {
      audio.currentTime = time;
      setExampleAudioProgress(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(musicId) || { currentTime: 0, duration: 0 };
        newMap.set(musicId, { ...current, currentTime: time });
        return newMap;
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseTags = (tagsString: string) => {
    return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  };


  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Music className="w-12 h-12 text-[#FFDA2A]" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#FFDA2A] to-white bg-clip-text text-transparent">
              Turn Your Ideas Into Original Songs in Minutes with AI Music Generator
            </h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Transform your creative vision into complete, professional tracks with our cutting-edge AI music technology. Generate unlimited original music in any genre, style, or mood.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Mode Tabs */}
          <div className="w-full">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Music className="w-8 h-8 text-gray-400 flex-shrink-0" />
            </div>

            {/* Generation Form - Reference Style */}
            <div className="space-y-6">
              <div className="space-y-6">
            {/* Large Rounded Input Field with Random Button */}
            <div className="relative">
              <Textarea
                placeholder="Upbeat electronic track for a summer beach party..."
                value={promptValue}
                onChange={(e) => handleInputChange("prompt", e.target.value)}
                className="w-full bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 rounded-xl p-4 pr-12 text-base min-h-[80px] resize-none focus:border-gray-600 focus:ring-2 focus:ring-gray-600"
              />
              {/* Random Button - Only show when lyrics is false */}
              {!formData.lyrics && (
                <Button
                  onClick={handleRandomPrompt}
                  variant="ghost"
                  size="sm"
                  className="absolute bottom-2 right-2 h-8 w-8 p-0 text-gray-400 hover:text-[#FFDA2A] hover:bg-gray-700/50 rounded-lg"
                  title="Random prompt"
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Lyrics Switch and Generate Button Row */}
            <div className="flex items-center justify-between gap-4">
              {/* Switches Group */}
              <div className="flex items-center gap-6">
                {/* Lyrics Switch */}
                <div className="flex items-center gap-3">
                  <label htmlFor="lyrics" className="text-sm font-medium text-gray-300 cursor-pointer">
                    Lyrics
                  </label>
                  <Switch
                    id="lyrics"
                    checked={formData.lyrics}
                    onCheckedChange={(checked) => handleInputChange("lyrics", checked)}
                    className="data-[state=checked]:bg-green-500"
                  />
                </div>

                {/* Instrumental Switch */}
                <div className="flex items-center gap-3">
                  <label htmlFor="instrumental" className="text-sm font-medium text-gray-300 cursor-pointer">
                    Instrumental
                  </label>
                  <Switch
                    id="instrumental"
                    checked={formData.instrumental}
                    onCheckedChange={(checked) => handleInputChange("instrumental", checked)}
                    className="data-[state=checked]:bg-green-500"
                  />
                </div>
              </div>

              {/* Generate Button with Credits */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !trimmedPromptValue}
                className="text-gray-900 font-semibold px-4 rounded-lg flex items-center justify-center gap-2 h-8 disabled:opacity-50 disabled:cursor-not-allowed !bg-[#FFDA2A] hover:!bg-[#FFDA2A] active:!bg-[#FFDA2A] focus:!bg-[#FFDA2A]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
                    <span className="text-xs">Generating...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs">Generate</span>
                    <span className="text-xs font-bold">
                      {formData.lyrics ? requiredCreditsForLyrics : requiredCreditsForMusic}
                    </span>
                  </>
                )}
              </Button>
            </div>

            {/* Five Dropdown Selectors Row */}
            <div className={`grid gap-3 ${!formData.instrumental ? 'grid-cols-6' : 'grid-cols-5'}`}>
              {/* Mood */}
              <Select
                value={formData.mood}
                onValueChange={(value) => handleInputChange("mood", value)}
              >
                <SelectTrigger className="w-full bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800 rounded-lg h-12">
                  <SelectValue placeholder="Mood" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {MOODS.map((mood) => (
                    <SelectItem
                      key={mood.value}
                      value={mood.value}
                      className="hover:bg-gray-700"
                    >
                      {mood.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Genre */}
              <Select
                value={formData.genre}
                onValueChange={(value) => handleInputChange("genre", value)}
              >
                <SelectTrigger className="w-full bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800 rounded-lg h-12">
                  <SelectValue placeholder="Genre" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {GENRES.map((genre) => (
                    <SelectItem
                      key={genre.value}
                      value={genre.value}
                      className="hover:bg-gray-700"
                    >
                      {genre.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Theme */}
              <Select
                value={formData.theme}
                onValueChange={(value) => handleInputChange("theme", value)}
              >
                <SelectTrigger className="w-full bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800 rounded-lg h-12">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {THEMES.map((theme) => (
                    <SelectItem
                      key={theme.value}
                      value={theme.value}
                      className="hover:bg-gray-700"
                    >
                      {theme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Tempo */}
              <Select
                value={formData.tempo}
                onValueChange={(value) => handleInputChange("tempo", value)}
              >
                <SelectTrigger className="w-full bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800 rounded-lg h-12">
                  <SelectValue placeholder="Tempo" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {TEMPOS.map((tempo) => (
                    <SelectItem
                      key={tempo.value}
                      value={tempo.value}
                      className="hover:bg-gray-700"
                    >
                      {tempo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Energy */}
              <Select
                value={formData.energy}
                onValueChange={(value) => handleInputChange("energy", value)}
              >
                <SelectTrigger className="w-full bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800 rounded-lg h-12">
                  <SelectValue placeholder="Energy" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {ENERGY_LEVELS.map((energy) => (
                    <SelectItem
                      key={energy.value}
                      value={energy.value}
                      className="hover:bg-gray-700"
                    >
                      {energy.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Voice Type - Only show when not instrumental */}
              {!formData.instrumental && (
                <Select
                  value={formData.voiceType}
                  onValueChange={(value) => handleInputChange("voiceType", value as 'male' | 'female' | 'duet')}
                >
                  <SelectTrigger className="w-full bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800 rounded-lg h-12">
                    <SelectValue placeholder="人物" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {VOICE_TYPES.map((voice) => (
                      <SelectItem
                        key={voice.value}
                        value={voice.value}
                        className="hover:bg-gray-700"
                      >
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Progress Message */}
            <AnimatePresence>
              {generationProgress.status !== 'idle' && generationProgress.status !== 'generating' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`p-4 rounded-lg ${
                    generationProgress.status === 'error'
                      ? 'bg-red-900/20 border border-red-800 text-red-300'
                      : generationProgress.status === 'completed'
                      ? 'bg-green-900/20 border border-green-800 text-green-300'
                      : 'bg-blue-900/20 border border-blue-800 text-blue-300'
                  }`}
                >
                  {generationProgress.message}
                </motion.div>
              )}
            </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Generation Result Section - Between Form and Music Examples */}
        <div className="max-w-4xl mx-auto mt-12 mb-8">
          <AnimatePresence mode="wait">
            {/* Generating Placeholder with Animation */}
            {isGenerating && (
              <motion.div
                key="generating"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden rounded-xl border border-gray-700 bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-sm"
              >
                {/* Animated Background - Shimmer/Flow Effect */}
                <div className="absolute inset-0 overflow-hidden">
                  {/* Shimmer gradient animation - multiple layers for depth */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFDA2A]/15 to-transparent animate-shimmer" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFDA2A]/8 to-transparent animate-shimmer" style={{ animationDelay: '0.5s' }} />
                  {/* Flowing wave effect */}
                  <div className="absolute inset-0 opacity-40">
                    <div className="absolute w-[150%] h-[150%] bg-gradient-to-br from-[#FFDA2A]/8 via-transparent to-[#FFDA2A]/8 animate-flow" />
                  </div>
                  {/* Pulsing glow effect */}
                  <div className="absolute inset-0 bg-[#FFDA2A]/5 animate-pulse" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center py-16 px-8">
                  <div className="mb-4">
                    <Loader2 className="w-12 h-12 text-[#FFDA2A] animate-spin" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Generating, please wait...</h3>
                  <p className="text-gray-400 text-sm">
                    {formData.lyrics 
                      ? 'Creating your music with lyrics and cover art' 
                      : 'Creating your unique music track'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Generated Results */}
            {!isGenerating && generatedMusics.length > 0 && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Music className="w-5 h-5 text-[#FFDA2A]" />
                      Generated Music
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {generatedMusics.map((music) => (
                      <div
                        key={music.id}
                        className="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-all"
                      >
                        <div className="flex gap-4">
                          {/* Cover Image */}
                          <div className="flex-shrink-0 w-24 h-24 bg-gray-700 rounded-lg overflow-hidden relative">
                            {music.coverUrl ? (
                              <img
                                src={music.coverUrl}
                                alt={music.title || music.prompt}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Music className="w-8 h-8 text-gray-500" />
                              </div>
                            )}
                            {/* Professional Audio Visualizer Overlay - Only visible when playing */}
                            {currentPlayingId === music.id && (
                              <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 backdrop-blur-sm flex items-center justify-center">
                                <div className="w-full h-full p-4">
                                  <ProfessionalAudioVisualizer
                                    isPlaying={currentPlayingId === music.id}
                                    audioElement={audioElementsRef.current.get(music.id) || undefined}
                                    variant="bars"
                                    barCount={20}
                                    color="#FFDA2A"
                                    className="w-full h-full"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Audio Progress Bar - Only show when playing */}
                            {currentPlayingId === music.id && (() => {
                              const progress = audioProgress.get(music.id) || { currentTime: 0, duration: 0 };
                              return (
                                <ProfessionalProgressBar
                                  currentTime={progress.currentTime}
                                  duration={progress.duration}
                                  onSeek={(time) => handleSeek(music.id, time)}
                                  showTime={true}
                                  color="#FFDA2A"
                                  className="mb-3"
                                />
                              );
                            })()}
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-medium mb-1 truncate">
                                  {music.title || music.prompt}
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                                  {music.style && (
                                    <>
                                      <span>{GENRES.find(g => g.value === music.style)?.label || music.style}</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  {music.mood && (
                                    <>
                                      <span>{MOODS.find(m => m.value === music.mood)?.label || music.mood}</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {music.duration}s
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                {music.hasLyrics && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const musicData = generatedMusics.find(m => m.id === music.id);
                                      setLyricsEditDialog({
                                        isOpen: true,
                                        lyrics: musicData?.lyrics || '',
                                        musicId: music.id,
                                        isNewGeneration: false,
                                      });
                                    }}
                                    className="text-white hover:bg-gray-700"
                                    title="View/Edit Lyrics"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                )}
                                {/* <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleNavigateToMusicVideo(music.id)}
                                  className="text-white hover:bg-gray-700"
                                  title="Create Music Video"
                                  disabled={videoPreparingId === music.id}
                                >
                                  {videoPreparingId === music.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Video className="w-4 h-4" />
                                  )}
                                </Button> */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    void handlePlayPause(music.id);
                                  }}
                                  className="text-white hover:bg-gray-700"
                                  disabled={!music.audioUrl}
                                >
                                  {currentPlayingId === music.id ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownload(music.id)}
                                  className="text-white hover:bg-gray-700"
                                  disabled={!music.audioUrl}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                        {music.audioUrl && (
                          <audio
                            ref={(el) => attachMainAudioElement(music.id, el)}
                            src={music.audioUrl}
                            preload="metadata"
                            onEnded={() => {
                              setCurrentPlayingId(null);
                              setAudioProgress(prev => {
                                const newMap = new Map(prev);
                                const current = newMap.get(music.id);
                                if (current) {
                                  newMap.set(music.id, { ...current, currentTime: 0 });
                                }
                                return newMap;
                              });
                            }}
                            className="hidden"
                          />
                        )}
                        {!music.audioUrl && (
                          <div className="text-xs text-yellow-500 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Processing audio...
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Music Examples / My Music Section */}
        <motion.section
          ref={myMusicSectionRef}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-7xl mx-auto mt-24 mb-12"
        >
          <div className="text-center mb-8">
            {/* Tab Switcher */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setActiveTab('examples')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  activeTab === 'examples'
                    ? 'bg-[#FFDA2A] text-gray-900'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Music Examples
              </button>
              <button
                onClick={() => setActiveTab('my-music')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  activeTab === 'my-music'
                    ? 'bg-[#FFDA2A] text-gray-900'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                My Music
              </button>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {activeTab === 'examples' ? 'Music Examples' : 'My Music'}
            </h2>
            <p className="text-gray-400 text-lg">
              {activeTab === 'examples' 
                ? 'Explore AI-generated music samples'
                : 'Your generated music collection'}
            </p>
          </div>

          {/* Music Examples Content */}
          {activeTab === 'examples' && (
            <>
              {musicExamples.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {musicExamples.map((music, index) => {
                const tags = parseTags(music.tags);
                const displayTags = tags.slice(0, 3);
                const remainingTags = tags.length - 3;

                return (
                  <motion.div
                    key={music.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-700 transition-all group"
                  >
                    {/* Cover Image */}
                    <div className="relative aspect-square bg-gray-800 overflow-hidden">
                      <img
                        src={music.coverUrl}
                        alt={music.title || "Music cover"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect fill='%231f2937' width='400' height='400'/%3E%3Ctext fill='%239ca3af' font-family='sans-serif' font-size='20' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3ENo Cover%3C/text%3E%3C/svg%3E";
                        }}
                      />
                      {/* Professional Audio Visualizer Overlay - Only visible when playing */}
                      {examplePlayingId === music.id && (
                        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 backdrop-blur-sm flex items-center justify-center">
                          <div className="w-full h-full p-6">
                            <ProfessionalAudioVisualizer
                              isPlaying={examplePlayingId === music.id}
                                  audioElement={exampleAudioElementsRef.current.get(music.id) || undefined}
                              variant="circle"
                              barCount={24}
                              color="#FFDA2A"
                              className="w-full h-full"
                            />
                          </div>
                        </div>
                      )}
                      {/* Play Button Overlay - Always visible */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          onClick={() => {
                            void handleExamplePlayPause(music.id);
                          }}
                          className="w-14 h-14 rounded-full bg-white hover:bg-gray-100 transition-all flex items-center justify-center shadow-lg z-10"
                        >
                          {examplePlayingId === music.id ? (
                            <Pause className="w-5 h-5 text-black" />
                          ) : (
                            <Play className="w-5 h-5 text-black ml-0.5" />
                          )}
                        </button>
                      </div>
                      {/* Audio Element */}
                      <audio
                        ref={(el) => attachExampleAudioElement(music.id, el)}
                        src={music.audioUrl}
                        preload="metadata"
                        onEnded={() => {
                          setExamplePlayingId(null);
                          setExampleAudioProgress(prev => {
                            const newMap = new Map(prev);
                            const current = newMap.get(music.id);
                            if (current) {
                              newMap.set(music.id, { ...current, currentTime: 0 });
                            }
                            return newMap;
                          });
                        }}
                        className="hidden"
                      />
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-3">
                      {/* Title */}
                      <h3 className="text-white font-medium text-sm line-clamp-1">
                        {music.title || "Untitled"}
                      </h3>

                      {/* Audio Progress Bar - Only show when playing */}
                      {examplePlayingId === music.id && (() => {
                        const progress = exampleAudioProgress.get(music.id) || { currentTime: 0, duration: 0 };
                        return (
                          <ProfessionalProgressBar
                            currentTime={progress.currentTime}
                            duration={progress.duration}
                            onSeek={(time) => handleExampleSeek(music.id, time)}
                            color="#FFDA2A"
                            showTime={false}
                            className="mt-2"
                          />
                        );
                      })()}

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {displayTags.map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-md"
                          >
                            {tag}
                          </span>
                        ))}
                        {remainingTags > 0 && (
                          <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-md">
                            +{remainingTags}
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="text-gray-500 text-xs">
                        {music.createdAt}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">No examples available</p>
                </div>
              )}
            </>
          )}

          {/* My Music Content */}
          {activeTab === 'my-music' && (
            <>
              {isLoadingMyMusic ? (
                <div className="text-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#FFDA2A] mx-auto mb-4" />
                  <p className="text-gray-400">Loading your music...</p>
                </div>
              ) : myMusicList.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {myMusicList.map((music, index) => {
                    const tags: string[] = [];
                    if (music.style) tags.push(music.style);
                    if (music.mood) tags.push(music.mood);
                    const displayTags = tags.slice(0, 3);
                    const remainingTags = tags.length - 3;

                    return (
                      <motion.div
                        key={music.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: index * 0.05 }}
                        className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-700 transition-all group"
                      >
                        {/* Cover Image */}
                        <div className="relative aspect-square bg-gray-800 overflow-hidden">
                          {music.coverUrl ? (
                            <img
                              src={music.coverUrl}
                              alt={music.title || music.prompt}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                              <Music className="w-16 h-16 text-gray-600" />
                            </div>
                          )}
                          {/* Professional Audio Visualizer Overlay - Only visible when playing */}
                          {currentPlayingId === music.id && (
                            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 backdrop-blur-sm flex items-center justify-center">
                              <div className="w-full h-full p-6">
                                <ProfessionalAudioVisualizer
                                  isPlaying={currentPlayingId === music.id}
                                  audioElement={audioElementsRef.current.get(music.id) || undefined}
                                  variant="circle"
                                  barCount={24}
                                  color="#FFDA2A"
                                  className="w-full h-full"
                                />
                              </div>
                            </div>
                          )}
                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button
                              onClick={() => {
                                void handlePlayPause(music.id);
                              }}
                              className="w-14 h-14 rounded-full bg-white hover:bg-gray-100 transition-all flex items-center justify-center shadow-lg z-10"
                              disabled={!music.audioUrl}
                            >
                              {currentPlayingId === music.id ? (
                                <Pause className="w-5 h-5 text-black" />
                              ) : (
                                <Play className="w-5 h-5 text-black ml-0.5" />
                              )}
                            </button>
                          </div>
                          {/* Audio Element */}
                          {music.audioUrl && (
                            <audio
                              ref={(el) => attachMainAudioElement(music.id, el)}
                              src={music.audioUrl}
                              preload="metadata"
                              onEnded={() => {
                                setCurrentPlayingId(null);
                                setAudioProgress(prev => {
                                  const newMap = new Map(prev);
                                  const current = newMap.get(music.id);
                                  if (current) {
                                    newMap.set(music.id, { ...current, currentTime: 0 });
                                  }
                                  return newMap;
                                });
                              }}
                              className="hidden"
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-3">
                          {/* Title */}
                          <h3 className="text-white font-medium text-sm line-clamp-2">
                            {music.title || music.prompt || "Untitled"}
                          </h3>
                          
                          {/* Audio Progress Bar - Only show when playing */}
                          {currentPlayingId === music.id && (() => {
                            const progress = audioProgress.get(music.id) || { currentTime: 0, duration: 0 };
                            return (
                              <ProfessionalProgressBar
                                currentTime={progress.currentTime}
                                duration={progress.duration}
                                onSeek={(time) => handleSeek(music.id, time)}
                                showTime={false}
                                color="#FFDA2A"
                                className="mt-2"
                              />
                            );
                          })()}
                          
                          {/* Lyrics Icon and Info */}
                          <div className="flex items-center justify-between">
                            {music.hasLyrics && (
                              <button
                                onClick={() => {
                                  setLyricsEditDialog({
                                    isOpen: true,
                                    lyrics: music.lyrics || '',
                                    musicId: music.id,
                                    isNewGeneration: false,
                                  });
                                }}
                                className="flex items-center gap-1 text-xs text-[#FFDA2A] hover:text-[#FFDA2A]/80 transition-colors"
                                title="View/Edit Lyrics"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Lyrics</span>
                              </button>
                            )}
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              <span>{music.duration}s</span>
                            </div>
                          </div>

                          {/* Tags */}
                          {displayTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {displayTags.map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-md"
                                >
                                  {tag}
                                </span>
                              ))}
                              {remainingTags > 0 && (
                                <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-md">
                                  +{remainingTags}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Timestamp */}
                          <div className="text-gray-500 text-xs">
                            {music.createdAt.toLocaleDateString()}
                          </div>

                          {/* Download Button */}
                          {music.audioUrl && (
                            <button
                              onClick={() => handleDownload(music.id)}
                              className="w-full mt-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-md transition-colors flex items-center justify-center gap-2"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </button>
                          )}

                          {/* Processing Status */}
                          {!music.audioUrl && (
                            <div className="text-xs text-yellow-500 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing...
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg mb-2">No music yet</p>
                  <p className="text-gray-500 text-sm">Start creating your first AI-generated music above!</p>
                </div>
              )}
            </>
          )}
        </motion.section>

        {/* FAQ Section */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto mt-24 mb-12"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-400 text-lg">
              Everything you need to know about our AI music generator
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "How does Animation AI Generator's AI music generator work?",
                answer: "Animation AI Generator's AI music generator leverages cutting-edge models including Suno v3.5, v4, v4.5, Stable Audio, and MiniMax Music to create studio-quality music in seconds. Simply describe your vision through text prompts, select your preferred genre, mood, tempo, and other parameters. Our AI then processes your input and generates unique, royalty-free music tailored to your specifications. The entire process takes just moments, allowing you to create professional soundtracks, vocals, and complete musical compositions without any musical expertise."
              },
              {
                question: "Which AI model should I choose for my music?",
                answer: "The best model depends on your specific needs: Suno v3.5 is perfect for catchy, upbeat tracks with quick melody generation. Suno v4 offers improved structure and genre precision, making it ideal for more refined compositions. Suno v4.5 excels at realistic vocals and cinematic expression, perfect for full songs with vocal elements. Stable Audio is excellent for beat-synchronized, high-fidelity sound design, ideal for podcasts, background music, and brand audio. MiniMax Music is designed for speed and simplicity, perfect for quick loops, hooks, and sound sketches, especially great for mobile use, prototyping, or creators on the go."
              },
              {
                question: "Is the AI music generator free to use?",
                answer: "Animation AI Generator offers a credit-based system for music generation. Each music generation requires 35 credits. You can start with free credits to try the platform, and additional credits or subscription plans are available for extended use. This allows you to create unlimited music while maintaining fair access for all users."
              },
              {
                question: "Can I use the generated music on YouTube, TikTok, or Instagram?",
                answer: "Yes! All music generated through Animation AI Generator's AI music generator is royalty-free and can be used across various platforms including YouTube, TikTok, Instagram, and other social media channels. You have full commercial rights to use the generated music in your content, videos, podcasts, and other creative projects without worrying about copyright issues."
              },
              {
                question: "Do I need musical experience to create music?",
                answer: "Not at all! Animation AI Generator's AI music generator is designed to be accessible to everyone, regardless of musical background. Simply describe what you want in plain language - whether it's an upbeat electronic track for a summer party or a calm ambient piece for meditation. The AI handles all the technical aspects of music composition, allowing you to focus on your creative vision. No musical training, instruments, or production skills are required."
              },
              {
                question: "Why is Animation AI Generator the best music video generator and music video creative agency?",
                answer: "Animation AI Generator stands out as the premier music video generator and creative agency because we combine powerful AI music generation with comprehensive video creation tools. Our platform offers seamless integration between music and video production, allowing you to create complete audiovisual experiences in one place. With access to multiple state-of-the-art AI models, flexible customization options, and professional-quality outputs, Animation AI Generator enables creators to produce studio-grade content efficiently and affordably."
              },
              {
                question: "What are the top 10 AI video agents?",
                answer: "Hello, I am an intelligent assistant powered by the gemini-3-pro-preview model, providing code writing and problem-solving services in Cursor IDE. You can directly tell me your needs."
              },
              {
                question: "What are the top 5 AI music video production platforms in 2025?",
                answer: "The music industry is rapidly evolving with AI, transforming what once required massive budgets and teams into tasks that can be completed in minutes with AI music video agents. These tools are revolutionizing how musicians create and share visual content. By 2025, numerous solutions have emerged—but which ones truly stand out? 1. Animation AI Generator: The world's first true AI music video agent. Leading the revolution is Animation AI Generator 9.0, the world's first true AI video agent. It integrates powerful AI models into a single creative engine, allowing artists to transform songs into stunning music videos with just a link and a description—no editing skills required. Paste tracks from Spotify or YouTube, or upload your own work. The AI analyzes beats, mood, and lyrics, creating storyboards and visual effects based on your prompts. You can adjust scenes before one-click rendering. With integrations to top-tier tools like Kling and Runway Gen-3, Animation AI Generator delivers precise audio-video synchronization, custom styles, and supports exports up to 4K resolution—perfect for musicians, marketers, and creators seeking high-quality, effortless AI video creation. 2. Runway ML: A creative playground. For those craving deeper creative control, Runway ML is a comprehensive AI creative suite. It offers advanced features like text-to-video generation, ideal for artists with specific visions who are willing to navigate a steeper learning curve for unlimited creative possibilities. 3. Kaiber: For cinematic and stylized visuals. Kaiber excels at creating cinematic and stylized visual effects. Its AI generates aesthetic results based on mood and style prompts, making it an ideal AI video generator for artists seeking unique artistic styles for high-concept videos. 4. Neural Frames: Audio-responsive and psychedelic animations. Neural Frames is the go-to choice for immersive, psychedelic experiences. Its standout feature is audio-responsive visuals, where animations react directly to subtle changes in music. This makes it perfect for electronic and experimental artists wanting to create mesmerizing, 'trippy' videos. 5. Rotor Videos: An all-in-one solution for musicians. Rotor Videos is a versatile platform for musicians that uses an extensive library of professionally shot video clips. Its AI intelligently edits these clips based on your song's style to create lyric videos, promotional shorts, and full music videos, making it a valuable resource for artists needing various visual AI content for marketing. The future of music is visual. The rise of AI music video agents is democratizing video creation. While all these tools offer unique strengths, Animation AI Generator leads with its unparalleled ease of use and professional output. For any artist ready to embrace the future, exploring powerful AI video generators is the next step to realizing their vision."
              },
              {
                question: "How to use AI Music Generator?",
                answer: "Creating music with our AI music generator is simple and intuitive. Follow these steps to generate original tracks in just minutes. Step 1: Choose Your Style. Select your preferred genre, mood, and musical style. Our AI will generate music that perfectly matches your preferences, whether you're looking for upbeat pop, relaxing ambient, energetic electronic, or any other style that fits your project. Step 2: Customize Your Settings. Fine-tune parameters like tempo, instruments, and arrangement to achieve the exact sound you envision. Adjust the BPM for the perfect pace, select specific instruments or let the AI choose, and control the overall structure of your composition. These customization options ensure your generated music aligns perfectly with your creative vision. Step 3: Generate and Export. Click generate and let our AI create your music. Once the generation is complete, download your high-quality audio file ready for use in your projects. The entire process takes just moments, and you'll have professional-quality, royalty-free music that you can use immediately across YouTube, social media, podcasts, or any other creative endeavor."
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full p-5 flex items-center justify-between hover:bg-gray-800 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-left pr-4 text-white">{faq.question}</h3>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-5 pb-5 pt-2"
                  >
                    <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.section>
      </main>

      {/* Lyrics Edit Dialog */}
      <AnimatePresence>
        {lyricsEditDialog.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => {
              if (!lyricsEditDialog.isNewGeneration) {
                setLyricsEditDialog({
                  isOpen: false,
                  lyrics: '',
                  musicId: null,
                  isNewGeneration: false,
                });
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#FFDA2A]" />
                  {lyricsEditDialog.isNewGeneration ? 'Edit Lyrics & Generate Music' : 'View/Edit Lyrics'}
                </h2>
                {!lyricsEditDialog.isNewGeneration && (
                  <button
                    onClick={() => {
                      setLyricsEditDialog({
                        isOpen: false,
                        lyrics: '',
                        musicId: null,
                        isNewGeneration: false,
                      });
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Lyrics Content - Editable and Scrollable */}
              <div className="flex-1 overflow-hidden flex flex-col p-6">
                <Textarea
                  value={lyricsEditDialog.lyrics}
                  onChange={(e) => {
                    setLyricsEditDialog(prev => ({
                      ...prev,
                      lyrics: e.target.value,
                    }));
                    setPendingGeneration(prev => prev ? { ...prev, lyrics: e.target.value } : prev);
                  }}
                  className="flex-1 w-full bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 rounded-lg p-4 resize-none focus:border-gray-600 focus:ring-2 focus:ring-gray-600"
                  placeholder="Enter your lyrics here..."
                  style={{
                    maxHeight: 'calc(10 * 1.5rem)', // 10 lines
                    minHeight: 'calc(10 * 1.5rem)',
                  }}
                />
                <div className="mt-2 text-xs text-gray-500">
                  {lyricsEditDialog.lyrics.split('\n').length} lines
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between p-6 border-t border-gray-700">
                {lyricsEditDialog.isNewGeneration ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setLyricsEditDialog({
                          isOpen: false,
                          lyrics: '',
                          musicId: null,
                          isNewGeneration: false,
                        });
                        setPendingGeneration(null);
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (pendingGeneration?.mode === 'music') {
                          handleConfirmLyricsAndCreateMusic();
                        } else {
                          handleGenerateMusicFromLyrics(lyricsEditDialog.lyrics);
                        }
                      }}
                      disabled={
                        isGenerating ||
                        !pendingGeneration ||
                        (pendingGeneration?.mode === 'lyrics' && !lyricsEditDialog.lyrics.trim())
                      }
                      className="text-gray-900 font-semibold px-6 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed !bg-[#FFDA2A] hover:!bg-[#FFDA2A] active:!bg-[#FFDA2A] focus:!bg-[#FFDA2A]"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
                          <span>Generating...</span>
                        </>
                      ) : pendingGeneration?.mode === 'music' ? (
                        <>
                          <span>Create Music</span>
                          <Diamond className="w-4 h-4 ml-2" />
                          <span className="text-xs ml-1">{requiredCreditsForMusicWithLyrics}</span>
                        </>
                      ) : (
                        <>
                          <span>Generate Music</span>
                          <Diamond className="w-4 h-4 ml-2" />
                          <span className="text-xs ml-1">30</span>
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        // 重新生成歌词
                        const creditsCheck = await checkCreditsBalance(requiredCreditsForLyrics);
                        if (!creditsCheck.sufficient) {
                          alert(`Insufficient credits. Required: ${requiredCreditsForLyrics}, Current: ${creditsCheck.balance || 0}`);
                          return;
                        }

                        setIsGenerating(true);
                        try {
                          const deductResult = await deductLyricsCredits({
                            prompt: promptValue,
                            genre: formData.genre,
                            mood: formData.mood,
                            regenerate: true,
                          });

                          if (!deductResult.success) {
                            throw new Error(deductResult.error || 'Failed to deduct credits');
                          }

                          if (deductResult.newBalance !== undefined) {
                            setCreditsBalance(deductResult.newBalance);
                            window.dispatchEvent(new Event('credits-updated'));
                          }

                          // TODO: Replace with actual lyrics generation API
                          await new Promise(resolve => setTimeout(resolve, 2000));
                          const generatedLyrics = `[Verse 1]\n${promptValue}\nA melody that flows like a river\nThrough the heart of every listener\n\n[Chorus]\nThis is the sound of dreams\nComing to life in harmony\nEvery note tells a story\nOf hope and endless possibility\n\n[Verse 2]\nWith every beat, we find our rhythm\nIn this moment, we're together\nMusic connects us all\nBreaking down every wall`;

                          setLyricsEditDialog(prev => ({
                            ...prev,
                            lyrics: generatedLyrics,
                          }));
                        } catch (error) {
                          console.error("Error regenerating lyrics:", error);
                          alert(error instanceof Error ? error.message : 'Failed to regenerate lyrics');
                        } finally {
                          setIsGenerating(false);
                        }
                      }}
                      disabled={isGenerating}
                      className="text-gray-400 hover:text-white"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          Regenerate Lyrics ({requiredCreditsForLyrics})
                        </>
                      )}
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setLyricsEditDialog({
                            isOpen: false,
                            lyrics: '',
                            musicId: null,
                            isNewGeneration: false,
                          });
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        Close
                      </Button>
                      <Button
                        onClick={async () => {
                          // 保存歌词
                          if (lyricsEditDialog.musicId) {
                            try {
                              const response = await fetch('/api/music/update', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  id: lyricsEditDialog.musicId,
                                  metadata: { lyrics: lyricsEditDialog.lyrics },
                                }),
                              });

                              if (response.ok) {
                                // 更新本地状态
                                setGeneratedMusics(prev => prev.map(m => 
                                  m.id === lyricsEditDialog.musicId 
                                    ? { ...m, lyrics: lyricsEditDialog.lyrics }
                                    : m
                                ));
                                setMyMusicList(prev => prev.map(m => 
                                  m.id === lyricsEditDialog.musicId 
                                    ? { ...m, lyrics: lyricsEditDialog.lyrics }
                                    : m
                                ));
                                setLyricsEditDialog({
                                  isOpen: false,
                                  lyrics: '',
                                  musicId: null,
                                  isNewGeneration: false,
                                });
                              }
                            } catch (error) {
                              console.error("Error saving lyrics:", error);
                              alert('Failed to save lyrics');
                            }
                          }
                        }}
                        className="text-gray-900 font-semibold px-4 rounded-lg !bg-[#FFDA2A] hover:!bg-[#FFDA2A]"
                      >
                        Save
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
