"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
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
  ChevronLeft,
  ChevronRight,
  Shuffle,
  FileText,
  X,
  Diamond,
  Video,
  Maximize2,
  Volume2,
  Volume1,
  VolumeX,
  Share2,
  MoreHorizontal,
  Edit,
  Mic
} from "lucide-react";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";

// 动态导入 Select 组件以避免 hydration 错误
const Select = dynamic(
  () => import("@/components/ui/select").then((mod) => mod.Select),
  { ssr: false }
);
const SelectContent = dynamic(
  () => import("@/components/ui/select").then((mod) => mod.SelectContent),
  { ssr: false }
);
const SelectItem = dynamic(
  () => import("@/components/ui/select").then((mod) => mod.SelectItem),
  { ssr: false }
);
const SelectTrigger = dynamic(
  () => import("@/components/ui/select").then((mod) => mod.SelectTrigger),
  { ssr: false }
);
const SelectValue = dynamic(
  () => import("@/components/ui/select").then((mod) => mod.SelectValue),
  { ssr: false }
);
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { checkCreditsBalance, deductMusicCredits, deductLyricsCredits, deductMusicWithLyricsCredits } from "@/lib/credits/deduct";
import { createClient } from "@/lib/supabase/client";
import ProfessionalAudioVisualizer from "@/components/music/professional-audio-visualizer";
import ProfessionalProgressBar from "@/components/music/professional-progress-bar";
import MusicConversation from "@/components/music/music-conversation";
import MVCustomizeDialog from "@/components/music/mv-customize";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [showConversation, setShowConversation] = useState(false);
  const [conversationPrompt, setConversationPrompt] = useState("");
  const [conversationMvParams, setConversationMvParams] = useState<{
    audioUrl: string;
    startTime: number;
    endTime: number;
    musicTitle?: string;
    musicId?: string;
    mvType: 'narrative' | 'dance';
    visualStyle: string;
    showSubtitles: boolean;
    orientation: '16:9' | '9:16';
    inspiration: string;
    musicFeatures?: {
      bpm?: number;
      key?: string;
      beats?: number[];
      loudnessCurve?: Array<{ time: number; value: number }>;
      energySegments?: Array<{ start: number; end: number; energy: number }>;
    };
    autoSegments?: Array<{
      start: number;
      end: number;
      energy: number;
      videoPrompt?: {
        camera: string;
        performance: string;
        emotion: string;
        prompt: string;
        shotPlan?: {
          shotSize: string;
          cameraAngle: string;
          framingRule: string;
          cameraMotion: string;
          shotPurpose: string;
          cutContinuity: string;
        };
      };
    }>;
  } | undefined>(undefined);
  const [showAudioSegmentDialog, setShowAudioSegmentDialog] = useState(false); // 显示选择音频片段对话框
  // 全局播放器状态
  const [currentPlayingMusic, setCurrentPlayingMusic] = useState<{
    id: string;
    title: string;
    description: string;
    coverUrl?: string;
    audioUrl?: string;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const globalAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicDurations, setMusicDurations] = useState<Map<string, number>>(new Map()); // 存储每首音乐的时长
  const [volume, setVolume] = useState(1); // 音量 0-1
  const [isMuted, setIsMuted] = useState(false); // 是否静音
  const [showVolumeSlider, setShowVolumeSlider] = useState(false); // 显示音量滑块
  const [currentPlaylist, setCurrentPlaylist] = useState<Array<{ id: string; title: string; description: string; coverUrl?: string; audioUrl?: string }>>([]); // 当前播放列表
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState<number>(-1); // 当前播放索引
  const [selectedMusicForVideo, setSelectedMusicForVideo] = useState<GeneratedMusic | null>(null); // 选择用于制作视频的音乐
  const [selectedStartTime, setSelectedStartTime] = useState(0); // 选中的开始时间（秒）
  const [selectedEndTime, setSelectedEndTime] = useState(30); // 选中的结束时间（秒），固定30秒
  const [audioDuration, setAudioDuration] = useState(0); // 音频总时长（秒）
  const [isDragging, setIsDragging] = useState(false); // 是否正在拖动
  const [dragType, setDragType] = useState<'start' | 'end' | 'segment' | null>(null); // 拖动类型
  const [segmentCurrentTime, setSegmentCurrentTime] = useState(0); // 片段播放的当前时间
  const waveformContainerRef = useRef<HTMLDivElement | null>(null); // 波形容器引用
  const segmentAudioRef = useRef<HTMLAudioElement | null>(null); // 片段播放音频元素引用
  const [isPlayingSegment, setIsPlayingSegment] = useState(false); // 是否正在播放选中片段
  const [showMVCustomizeDialog, setShowMVCustomizeDialog] = useState(false); // 显示MV自定义对话框
  const [isAnalyzing, setIsAnalyzing] = useState(false); // 是否正在分析音频
  const [autoSegments, setAutoSegments] = useState<Array<{ 
    start: number; 
    end: number; 
    energy: number;
    videoPrompt?: {
      camera: string;
      performance: string;
      emotion: string;
      prompt: string;
      shotPlan?: {
        shotSize: string;
        cameraAngle: string;
        framingRule: string;
        cameraMotion: string;
        shotPurpose: string;
        cutContinuity: string;
      };
    };
  }>>([]); // 自动拆段结果
  const [sceneDescription, setSceneDescription] = useState(''); // 场景描述
  const [playingSegmentIndex, setPlayingSegmentIndex] = useState<number | null>(null); // 正在播放的段落索引
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null); // 选中的段落索引
  const segmentProgressListenerRef = useRef<(() => void) | null>(null); // 保存当前段落播放进度监听器
  const [musicFeatures, setMusicFeatures] = useState<{
    bpm?: number;
    key?: string;
    beats?: number[];
    loudnessCurve?: Array<{ time: number; value: number }>;
    energySegments?: Array<{ start: number; end: number; energy: number }>;
  } | null>(null); // 音频特征数据

  // 智能拆段函数
  const handleAutoSegment = useCallback(async () => {
    if (!selectedMusicForVideo?.audioUrl || isAnalyzing) return;
    
    // 确保 audioDuration 有值
    const duration = audioDuration || (segmentAudioRef.current?.duration || 0);
    if (duration <= 0) {
      console.warn('音频时长无效，无法进行智能拆段');
      return;
    }
    
    setIsAnalyzing(true);
    try {
      // 调用音频分析API，使用完整的音频时长
      const response = await fetch('/api/music/analyze-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: selectedMusicForVideo.audioUrl,
          startTime: 0,
          endTime: duration, // 使用完整的音频时长
        }),
      });

      if (!response.ok) {
        throw new Error('音频分析失败');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setMusicFeatures(result.data);
        
        // 自动拆段逻辑：每段 ≤ 15 秒，保证节奏和高能量不被切
        // 注意：API已经返回了带videoPrompt的energySegments，我们需要保留这些信息
        const segments: Array<{ 
          start: number; 
          end: number; 
          energy: number;
          videoPrompt?: {
            camera: string;
            performance: string;
            emotion: string;
            prompt: string;
          };
        }> = [];
        const beats = result.data.beats || [];
        const energySegments = result.data.energySegments || []; // 现在每个segment可能包含videoPrompt
        const maxSegmentDuration = 15;
        
        let currentStart = 0;
        let currentEnd = 0;
        let currentSegments: typeof energySegments = []; // 当前段的原始segments
        
        // 根据拍点和能量分段进行智能拆段
        for (let i = 0; i < energySegments.length; i++) {
          const seg = energySegments[i];
          
          // 如果当前段加上新段超过15秒，结束当前段
          if (currentEnd > 0 && (seg.end - currentStart) > maxSegmentDuration) {
            // 找到最接近15秒的拍点作为结束点
            const targetEnd = currentStart + maxSegmentDuration;
            const closestBeat = beats.find(b => Math.abs(b - targetEnd) < 0.5) || targetEnd;
            
            // 计算平均能量
            const filteredSegs = currentSegments.filter(es => es.start >= currentStart && es.end <= Math.min(closestBeat, seg.end));
            const avgEnergy = filteredSegs.length > 0
              ? filteredSegs.reduce((sum, es) => sum + es.energy, 0) / filteredSegs.length
              : 0.5;
            
            // 尝试从原始segments中获取videoPrompt（优先使用第一个segment的）
            const videoPrompt = filteredSegs.find(s => s.videoPrompt)?.videoPrompt;
            
            segments.push({
              start: currentStart,
              end: Math.min(closestBeat, seg.end),
              energy: avgEnergy,
              videoPrompt: videoPrompt,
            });
            
            currentStart = Math.min(closestBeat, seg.end);
            currentSegments = [];
          }
          
          // 如果是第一段或当前段为空，开始新段
          if (currentEnd === 0) {
            currentStart = seg.start;
          }
          
          currentEnd = seg.end;
          currentSegments.push(seg);
          
          // 如果当前段达到15秒，结束当前段
          if ((currentEnd - currentStart) >= maxSegmentDuration) {
            // 找到最接近15秒的拍点作为结束点
            const targetEnd = currentStart + maxSegmentDuration;
            const closestBeat = beats.find(b => b >= currentStart && b <= currentEnd && Math.abs(b - targetEnd) < 0.5) || currentEnd;
            
            // 计算平均能量
            const filteredSegs = currentSegments.filter(es => es.start >= currentStart && es.end <= closestBeat);
            const avgEnergy = filteredSegs.length > 0
              ? filteredSegs.reduce((sum, es) => sum + es.energy, 0) / filteredSegs.length
              : 0.5;
            
            // 尝试从原始segments中获取videoPrompt（优先使用第一个segment的）
            const videoPrompt = filteredSegs.find(s => s.videoPrompt)?.videoPrompt;
            
            segments.push({
              start: currentStart,
              end: closestBeat,
              energy: avgEnergy,
              videoPrompt: videoPrompt,
            });
            
            currentStart = closestBeat;
            currentEnd = 0;
            currentSegments = [];
          }
        }
        
        // 添加最后一段
        if (currentEnd > currentStart) {
          const filteredSegs = currentSegments.filter(es => es.start >= currentStart && es.end <= currentEnd);
          const avgEnergy = filteredSegs.length > 0
            ? filteredSegs.reduce((sum, es) => sum + es.energy, 0) / filteredSegs.length
            : 0.5;
          
          // 尝试从原始segments中获取videoPrompt（优先使用第一个segment的）
          const videoPrompt = filteredSegs.find(s => s.videoPrompt)?.videoPrompt;
          
          segments.push({
            start: currentStart,
            end: currentEnd,
            energy: avgEnergy,
            videoPrompt: videoPrompt,
          });
        }
        
        setAutoSegments(segments);
        
        // 默认选择第一段
        if (segments.length > 0) {
          setSelectedStartTime(segments[0].start);
          setSelectedEndTime(segments[0].end);
        }
      }
    } catch (error) {
      console.error('智能拆段失败:', error);
      alert('智能拆段失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedMusicForVideo, audioDuration, isAnalyzing]);

  // 播放指定段落的函数
  const playSegment = useCallback(async (segment: { start: number; end: number }, index: number) => {
    if (!segmentAudioRef.current || !selectedMusicForVideo?.audioUrl) return;
    
    // 先暂停全局播放器
    if (globalAudioRef.current && !globalAudioRef.current.paused) {
      try {
        globalAudioRef.current.pause();
      } catch (err) {
        console.error('Error pausing global audio:', err);
      }
    }
    
    // 停止其他段落播放（如果有）
    if (playingSegmentIndex !== null && playingSegmentIndex !== index) {
      try {
        segmentAudioRef.current.pause();
        // 移除之前的事件监听器
        if (segmentProgressListenerRef.current) {
          segmentAudioRef.current.removeEventListener('timeupdate', segmentProgressListenerRef.current);
          segmentProgressListenerRef.current = null;
        }
      } catch (err) {
        console.error('Error pausing previous segment:', err);
      }
    }
    
    // 设置选中时间
    setSelectedStartTime(segment.start);
    setSelectedEndTime(segment.end);
    
    try {
      // 设置播放位置
      segmentAudioRef.current.currentTime = segment.start;
      
      // 先更新状态为播放中
      setIsPlayingSegment(true);
      setPlayingSegmentIndex(index);
      
      // 监听播放进度
      const updateProgress = () => {
        if (segmentAudioRef.current) {
          const currentTime = segmentAudioRef.current.currentTime;
          setSegmentCurrentTime(currentTime);
          
          // 如果播放到段落结束，停止播放
          if (currentTime >= segment.end) {
            try {
              segmentAudioRef.current.pause();
            } catch (err) {
              console.error('Error pausing at segment end:', err);
            }
            setIsPlayingSegment(false);
            setPlayingSegmentIndex(null);
            setSegmentCurrentTime(segment.start);
            if (segmentProgressListenerRef.current) {
              segmentAudioRef.current.removeEventListener('timeupdate', segmentProgressListenerRef.current);
              segmentProgressListenerRef.current = null;
            }
          }
        }
      };
      
      // 移除旧的事件监听器（如果有）
      if (segmentProgressListenerRef.current) {
        segmentAudioRef.current.removeEventListener('timeupdate', segmentProgressListenerRef.current);
      }
      
      // 保存新的监听器引用
      segmentProgressListenerRef.current = updateProgress;
      
      // 添加新的事件监听器
      segmentAudioRef.current.addEventListener('timeupdate', updateProgress);
      
      // 播放该段落
      const playPromise = segmentAudioRef.current.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (err) {
      console.error('Error playing segment audio:', err);
      setIsPlayingSegment(false);
      setPlayingSegmentIndex(null);
    }
  }, [selectedMusicForVideo, playingSegmentIndex]);

  const [trimmedAudioData, setTrimmedAudioData] = useState<{
    audioUrl: string;
    startTime: number;
    endTime: number;
    musicId?: string;
    musicTitle?: string;
    sceneDescription?: string; // 场景描述
    musicFeatures?: {
      bpm?: number;
      key?: string;
      beats?: number[];
      loudnessCurve?: Array<{ time: number; value: number }>;
      energySegments?: Array<{ start: number; end: number; energy: number }>;
    };
  } | null>(null); // 截取后的音频数据

  
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

  // 监听 currentPlayingMusic 变化，自动播放新音频
  useEffect(() => {
    if (currentPlayingMusic?.audioUrl && globalAudioRef.current) {
      const audio = globalAudioRef.current;
      
      // 如果音频源已改变，需要重新加载
      if (audio.src !== currentPlayingMusic.audioUrl) {
        audio.load();
      }
      
      // 如果 isPlaying 为 true 且音频已准备好，则播放
      if (isPlaying) {
        const tryPlay = () => {
          if (audio.readyState >= 2 && audio.paused) {
            audio.play().catch((error) => {
              console.error('Error auto-playing audio in useEffect:', error);
              setIsPlaying(false);
            });
          } else if (audio.readyState < 2) {
            // 如果还没准备好，等待加载
            audio.addEventListener('canplay', tryPlay, { once: true });
          }
        };
        
        tryPlay();
      }
    }
  }, [currentPlayingMusic?.audioUrl, isPlaying]);

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

  const handleGenerate = async (finalPrompt?: string) => {
    const promptToUse = finalPrompt || trimmedPromptValue;
    
    if (!promptToUse) {
      alert("Please enter a description for your music");
      return;
    }

    const selectedGenre = formData.genre || GENRES[0].value;
    const selectedMood = formData.mood || MOODS[0].value;
    const selectedTheme = formData.theme || THEMES[0].value;
    const selectedTempo = formData.tempo || TEMPOS[0].value;
    const selectedEnergy = formData.energy || ENERGY_LEVELS[0].value;

    // 非歌词模式：如果没有finalPrompt，说明是第一次点击，只打开对话界面，不检查积分
    if (!formData.lyrics && !finalPrompt) {
      setConversationPrompt(promptToUse);
      setShowConversation(true);
      return;
    }

    // 检查积分余额（只在真正生成时检查）
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
          prompt: promptToUse,
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
            description: promptToUse,
          }),
        });

        if (!promptResponse.ok) {
          const errorData = await promptResponse.json();
          throw new Error(errorData.error || 'Failed to generate lyrics');
        }

        const promptResult = await promptResponse.json();
        const generatedPrompt = promptResult.prompt || promptToUse;
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
          description: promptToUse,
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
          prompt: promptToUse,
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
            description: promptToUse,
          }),
        });

        if (!promptResponse.ok) {
          const errorData = await promptResponse.json();
          throw new Error(errorData.error || 'Failed to generate music prompt');
        }

        const promptResult = await promptResponse.json();
        const generatedPrompt = promptResult.prompt || promptToUse;
        const generatedLyrics = promptResult.lyrics || '';
        const generatedImage = promptResult.image || '';
        const generatedTitle = promptResult.title || '';

        setPendingGeneration({
          mode: 'music',
          description: promptToUse,
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
          description: promptToUse,
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
          description: trimmedPromptValue,
          generatedPrompt: trimmedPromptValue,
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
    // 检查是否是 my music 列表中的音乐
    const music = myMusicList.find((m) => m.id === musicId) || generatedMusics.find((m) => m.id === musicId);
    
    if (!music || !music.audioUrl) {
      console.error('[handlePlayPause] Music not found or no audioUrl');
      return;
    }

    // 如果是 my music 列表中的音乐，使用全局播放器
    if (myMusicList.find((m) => m.id === musicId)) {
      if (currentPlayingMusic?.id === musicId && isPlaying) {
        // 暂停当前播放
        if (globalAudioRef.current) {
          globalAudioRef.current.pause();
        }
        setIsPlaying(false);
      } else {
        // 停止所有其他音频
        // 先暂停拆段音频
        if (segmentAudioRef.current && !segmentAudioRef.current.paused) {
          try {
            segmentAudioRef.current.pause();
          } catch (err) {
            console.error('Error pausing segment audio:', err);
          }
          setIsPlayingSegment(false);
          setPlayingSegmentIndex(null);
        }
        
        if (globalAudioRef.current) {
          try {
            globalAudioRef.current.pause();
            globalAudioRef.current.currentTime = 0;
          } catch (err) {
            console.error('Error pausing global audio:', err);
          }
        }
        exampleAudioElementsRef.current.forEach((audio) => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch (err) {
            console.error('Error pausing example audio:', err);
          }
        });
        setExamplePlayingId(null);
        audioElementsRef.current.forEach((audio) => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch (err) {
            console.error('Error pausing audio:', err);
          }
        });
        setCurrentPlayingId(null);

        // 构建播放列表（my music）
        const playlist = myMusicList.map(m => ({
          id: m.id,
          title: m.title || m.prompt || 'Untitled',
          description: m.prompt || '',
          coverUrl: m.coverUrl || undefined,
          audioUrl: m.audioUrl || undefined,
        })).filter(m => m.audioUrl); // 只包含有音频的
        const currentIndex = playlist.findIndex(m => m.id === musicId);

        // 设置全局播放器
        setCurrentPlaylist(playlist);
        setCurrentPlaylistIndex(currentIndex);
        setCurrentPlayingMusic({
          id: music.id,
          title: music.title || music.prompt || 'Untitled',
          description: music.prompt || '',
          coverUrl: music.coverUrl || undefined,
          audioUrl: music.audioUrl,
        });
        setIsPlayerMinimized(false);
        setCurrentTime(0);
        // 设置需要自动播放的标志
        setIsPlaying(true);
      }
      return;
    }

    // 原有的 generatedMusics 播放逻辑（用于示例音乐）
    console.log('[DEBUG handlePlayPause] Called with musicId:', musicId, 'currentPlayingId:', currentPlayingId);
    
    if (currentPlayingId === musicId) {
      // Pause current
      const audio = audioElementsRef.current.get(musicId);
      if (audio) {
        audio.pause();
      }
      setCurrentPlayingId(null);
    } else {
      // Stop example audios when switching sections
      exampleAudioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      setExamplePlayingId(null);

      // Stop all other audio
      // 先暂停拆段音频
      if (segmentAudioRef.current && !segmentAudioRef.current.paused) {
        try {
          segmentAudioRef.current.pause();
          setIsPlayingSegment(false);
          setPlayingSegmentIndex(null);
        } catch (err) {
          console.error('Error pausing segment audio:', err);
        }
      }
      
      audioElementsRef.current.forEach((audio, id) => {
        if (id !== musicId) {
          audio.pause();
          audio.currentTime = 0;
        }
      });

      if (music?.audioUrl) {
        const audio = audioElementsRef.current.get(musicId);
        if (audio) {
          setCurrentPlayingId(musicId);
          try {
            await playAudioElementSafely(audio);
          } catch (error) {
            console.error("[DEBUG handlePlayPause] Error playing audio:", error);
            setCurrentPlayingId(null);
          }
        }
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
    const music = musicExamples.find((m) => m.id === musicId);
    
    if (!music || !music.audioUrl) {
      console.error('[handleExamplePlayPause] Music not found or no audioUrl');
      return;
    }

    // 使用全局播放器
    if (currentPlayingMusic?.id === musicId && isPlaying) {
      // 暂停当前播放
      if (globalAudioRef.current) {
        globalAudioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      // 停止所有其他音频
      if (globalAudioRef.current) {
        globalAudioRef.current.pause();
        globalAudioRef.current.currentTime = 0;
      }
      exampleAudioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      setExamplePlayingId(null);
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      setCurrentPlayingId(null);

      // 构建播放列表（示例音乐）
      const playlist = musicExamples.map(m => ({
        id: m.id,
        title: m.title || 'Untitled',
        description: m.tags || '',
        coverUrl: m.coverUrl,
        audioUrl: m.audioUrl,
      }));
      const currentIndex = playlist.findIndex(m => m.id === musicId);

      // 设置全局播放器
      setCurrentPlaylist(playlist);
      setCurrentPlaylistIndex(currentIndex);
      setCurrentPlayingMusic({
        id: music.id,
        title: music.title || 'Untitled',
        description: music.tags || '',
        coverUrl: music.coverUrl,
        audioUrl: music.audioUrl,
      });
      setIsPlayerMinimized(false);
      setCurrentTime(0);
    }
  };

  // 下一首功能
  const handleNext = () => {
    if (currentPlaylist.length === 0 || currentPlaylistIndex < 0) return;
    
    const nextIndex = (currentPlaylistIndex + 1) % currentPlaylist.length;
    const nextMusic = currentPlaylist[nextIndex];
    
    if (nextMusic && nextMusic.audioUrl) {
      setCurrentPlaylistIndex(nextIndex);
      setCurrentPlayingMusic({
        id: nextMusic.id,
        title: nextMusic.title,
        description: nextMusic.description,
        coverUrl: nextMusic.coverUrl,
        audioUrl: nextMusic.audioUrl,
      });
      setCurrentTime(0);
      if (globalAudioRef.current) {
        globalAudioRef.current.currentTime = 0;
        globalAudioRef.current.play().catch(console.error);
      }
    }
  };

  // 上一首功能
  const handlePrevious = () => {
    if (currentPlaylist.length === 0 || currentPlaylistIndex < 0) return;
    
    const prevIndex = currentPlaylistIndex === 0 ? currentPlaylist.length - 1 : currentPlaylistIndex - 1;
    const prevMusic = currentPlaylist[prevIndex];
    
    if (prevMusic && prevMusic.audioUrl) {
      setCurrentPlaylistIndex(prevIndex);
      setCurrentPlayingMusic({
        id: prevMusic.id,
        title: prevMusic.title,
        description: prevMusic.description,
        coverUrl: prevMusic.coverUrl,
        audioUrl: prevMusic.audioUrl,
      });
      setCurrentTime(0);
      if (globalAudioRef.current) {
        globalAudioRef.current.currentTime = 0;
        globalAudioRef.current.play().catch(console.error);
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
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/5 via-amber-600/8 to-yellow-600/5" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_40%,transparent_100%)]" />
      
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 max-w-7xl relative z-10">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-12 lg:mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/20 mb-4"
          >
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-300">AI Music Generator</span>
          </motion.div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Music className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-400 flex-shrink-0" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-yellow-200 via-amber-200 to-yellow-300 bg-clip-text text-transparent leading-tight">
              Turn Your Ideas Into Original Songs
            </h1>
          </div>
          <p className="text-gray-300 text-base sm:text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed px-4">
            Transform your creative vision into complete, professional tracks with our cutting-edge AI music technology. Generate unlimited original music in any genre, style, or mood.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
          {/* Generation Form - Premium Style */}
          <Card className="bg-black/40 backdrop-blur-xl border-yellow-500/20 shadow-2xl">
            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Large Rounded Input Field with Random Button */}
              <div className="relative">
                <Textarea
                  placeholder="Upbeat electronic track for a summer beach party..."
                  value={promptValue}
                  onChange={(e) => handleInputChange("prompt", e.target.value)}
                  className="w-full bg-white/5 backdrop-blur-sm border-yellow-500/20 text-white placeholder:text-gray-400 rounded-2xl p-4 sm:p-6 pr-12 sm:pr-14 text-base sm:text-lg min-h-[100px] sm:min-h-[120px] resize-none focus:border-yellow-500/40 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                />
                {/* Random Button - Only show when lyrics is false */}
                {!formData.lyrics && (
                  <Button
                    onClick={handleRandomPrompt}
                    variant="ghost"
                    size="sm"
                    className="absolute bottom-3 right-3 h-9 w-9 p-0 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-all"
                    title="Random prompt"
                  >
                    <Shuffle className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Lyrics Switch and Generate Button Row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                {/* Switches Group */}
                <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                  {/* Lyrics Switch */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <label htmlFor="lyrics" className="text-sm sm:text-base font-medium text-gray-300 cursor-pointer whitespace-nowrap">
                      Lyrics
                    </label>
                    <Switch
                      id="lyrics"
                      checked={formData.lyrics}
                      onCheckedChange={(checked) => handleInputChange("lyrics", checked)}
                      className="data-[state=checked]:bg-yellow-500"
                    />
                  </div>

                  {/* Instrumental Switch */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <label htmlFor="instrumental" className="text-sm sm:text-base font-medium text-gray-300 cursor-pointer whitespace-nowrap">
                      Instrumental
                    </label>
                    <Switch
                      id="instrumental"
                      checked={formData.instrumental}
                      onCheckedChange={(checked) => handleInputChange("instrumental", checked)}
                      className="data-[state=checked]:bg-yellow-500"
                    />
                  </div>
                </div>

                {/* Generate Button with Credits */}
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating || !trimmedPromptValue}
                  className="w-full sm:w-auto bg-gradient-to-r from-yellow-600 to-amber-600 text-black font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-xl flex items-center justify-center gap-2 h-auto disabled:opacity-50 disabled:cursor-not-allowed hover:from-yellow-500 hover:to-amber-500 transition-all shadow-lg hover:shadow-yellow-500/50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm sm:text-base">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      <span className="text-sm sm:text-base">Create Music</span>
                      {formData.lyrics && (
                        <>
                          <Diamond className="w-4 h-4" />
                          <span className="text-sm sm:text-base font-bold">
                            {requiredCreditsForLyrics}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </Button>
              </div>

              {/* Dropdown Selectors - Responsive Grid */}
              <div className={`grid gap-3 sm:gap-4 ${!formData.instrumental ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
                {/* Mood */}
                <Select
                  value={formData.mood}
                  onValueChange={(value) => handleInputChange("mood", value)}
                >
                  <SelectTrigger className="w-full bg-white/5 backdrop-blur-sm border-yellow-500/20 text-white hover:bg-white/10 hover:border-yellow-500/40 rounded-xl h-12 sm:h-14 transition-all">
                    <SelectValue placeholder="Mood" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-yellow-500/20 text-white">
                    {MOODS.map((mood) => (
                      <SelectItem
                        key={mood.value}
                        value={mood.value}
                        className="hover:bg-yellow-500/10 focus:bg-yellow-500/10"
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
                <SelectTrigger className="w-full bg-white/5 backdrop-blur-sm border-yellow-500/20 text-white hover:bg-white/10 hover:border-yellow-500/40 rounded-xl h-12 sm:h-14 transition-all">
                  <SelectValue placeholder="Genre" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-yellow-500/20 text-white">
                  {GENRES.map((genre) => (
                    <SelectItem
                      key={genre.value}
                      value={genre.value}
                      className="hover:bg-yellow-500/10 focus:bg-yellow-500/10"
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
                <SelectTrigger className="w-full bg-white/5 backdrop-blur-sm border-yellow-500/20 text-white hover:bg-white/10 hover:border-yellow-500/40 rounded-xl h-12 sm:h-14 transition-all">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-yellow-500/20 text-white">
                  {THEMES.map((theme) => (
                    <SelectItem
                      key={theme.value}
                      value={theme.value}
                      className="hover:bg-yellow-500/10 focus:bg-yellow-500/10"
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
                <SelectTrigger className="w-full bg-white/5 backdrop-blur-sm border-yellow-500/20 text-white hover:bg-white/10 hover:border-yellow-500/40 rounded-xl h-12 sm:h-14 transition-all">
                  <SelectValue placeholder="Tempo" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-yellow-500/20 text-white">
                  {TEMPOS.map((tempo) => (
                    <SelectItem
                      key={tempo.value}
                      value={tempo.value}
                      className="hover:bg-yellow-500/10 focus:bg-yellow-500/10"
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
                <SelectTrigger className="w-full bg-white/5 backdrop-blur-sm border-yellow-500/20 text-white hover:bg-white/10 hover:border-yellow-500/40 rounded-xl h-12 sm:h-14 transition-all">
                  <SelectValue placeholder="Energy" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-yellow-500/20 text-white">
                  {ENERGY_LEVELS.map((energy) => (
                    <SelectItem
                      key={energy.value}
                      value={energy.value}
                      className="hover:bg-yellow-500/10 focus:bg-yellow-500/10"
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
                  <SelectTrigger className="w-full bg-white/5 backdrop-blur-sm border-yellow-500/20 text-white hover:bg-white/10 hover:border-yellow-500/40 rounded-xl h-12 sm:h-14 transition-all">
                    <SelectValue placeholder="Voice Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-yellow-500/20 text-white">
                    {VOICE_TYPES.map((voice) => (
                      <SelectItem
                        key={voice.value}
                        value={voice.value}
                        className="hover:bg-yellow-500/10 focus:bg-yellow-500/10"
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
                    className={`p-4 rounded-xl backdrop-blur-sm ${
                      generationProgress.status === 'error'
                        ? 'bg-red-900/30 border border-red-500/30 text-red-300'
                        : generationProgress.status === 'completed'
                        ? 'bg-yellow-900/20 border border-yellow-500/30 text-yellow-300'
                        : 'bg-yellow-900/20 border border-yellow-500/30 text-yellow-300'
                    }`}
                  >
                    {generationProgress.message}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
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
                className="relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-black/80 via-gray-900/80 to-black/80 backdrop-blur-xl"
              >
                {/* Animated Background - Shimmer/Flow Effect */}
                <div className="absolute inset-0 overflow-hidden">
                  {/* Shimmer gradient animation - multiple layers for depth */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/15 to-transparent animate-shimmer" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/8 to-transparent animate-shimmer" style={{ animationDelay: '0.5s' }} />
                  {/* Flowing wave effect */}
                  <div className="absolute inset-0 opacity-40">
                    <div className="absolute w-[150%] h-[150%] bg-gradient-to-br from-yellow-500/8 via-transparent to-yellow-500/8 animate-flow" />
                  </div>
                  {/* Pulsing glow effect */}
                  <div className="absolute inset-0 bg-yellow-500/5 animate-pulse" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center py-12 sm:py-16 px-6 sm:px-8">
                  <div className="flex flex-col items-center justify-center">
                    <div className="mb-4">
                      <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-400 animate-spin" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Generating, please wait...</h3>
                    <p className="text-gray-300 text-sm sm:text-base text-center">
                      {formData.lyrics 
                        ? 'Creating your music with lyrics and cover art' 
                        : 'Creating your unique music track'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Generated Results - 已移除，不再显示生成的音乐 */}
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
          <div className="text-center mb-8 sm:mb-12">
            {/* Tab Switcher */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button
                onClick={() => setActiveTab('examples')}
                className={`px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all ${
                  activeTab === 'examples'
                    ? 'bg-gradient-to-r from-yellow-600 to-amber-600 text-black shadow-lg shadow-yellow-500/50'
                    : 'bg-white/5 backdrop-blur-sm border border-yellow-500/20 text-gray-300 hover:bg-white/10 hover:border-yellow-500/40 hover:text-yellow-400'
                }`}
              >
                Music Examples
              </button>
              <button
                onClick={() => setActiveTab('my-music')}
                className={`px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all ${
                  activeTab === 'my-music'
                    ? 'bg-gradient-to-r from-yellow-600 to-amber-600 text-black shadow-lg shadow-yellow-500/50'
                    : 'bg-white/5 backdrop-blur-sm border border-yellow-500/20 text-gray-300 hover:bg-white/10 hover:border-yellow-500/40 hover:text-yellow-400'
                }`}
              >
                My Music
              </button>
            </div>
            
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-yellow-200 via-amber-200 to-yellow-300 bg-clip-text text-transparent mb-3 sm:mb-4">
              {activeTab === 'examples' ? 'Music Examples' : 'My Music'}
            </h2>
            <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto px-4">
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
                    className="bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden border border-yellow-500/20 hover:border-yellow-500/40 hover:bg-white/5 transition-all group shadow-lg hover:shadow-yellow-500/20"
                  >
                    {/* Cover Image */}
                    <div className="relative aspect-square bg-gray-900 overflow-hidden">
                      <img
                        src={music.coverUrl}
                        alt={music.title || "Music cover"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect fill='%231f2937' width='400' height='400'/%3E%3Ctext fill='%239ca3af' font-family='sans-serif' font-size='20' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3ENo Cover%3C/text%3E%3C/svg%3E";
                        }}
                      />
                      {/* Play Button Overlay - Hover visible */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            void handleExamplePlayPause(music.id);
                          }}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 transition-all flex items-center justify-center shadow-lg shadow-yellow-500/50 z-10"
                        >
                          <Play className="w-5 h-5 sm:w-6 sm:h-6 text-black ml-0.5" />
                        </button>
                      </div>
                      {/* Hidden Audio Element for duration detection */}
                      {music.audioUrl && (
                        <audio
                          src={music.audioUrl}
                          preload="metadata"
                          onLoadedMetadata={(e) => {
                            const audio = e.currentTarget;
                            if (audio.duration && isFinite(audio.duration)) {
                              setMusicDurations(prev => {
                                const newMap = new Map(prev);
                                newMap.set(music.id, audio.duration);
                                return newMap;
                              });
                            }
                          }}
                          className="hidden"
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4 sm:p-5 space-y-3">
                      {/* Title */}
                      <h3 className="text-white font-semibold text-sm sm:text-base line-clamp-1">
                        {music.title || "Untitled"}
                      </h3>


                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {displayTags.map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs rounded-lg"
                          >
                            {tag}
                          </span>
                        ))}
                        {remainingTags > 0 && (
                          <span className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs rounded-lg">
                            +{remainingTags}
                          </span>
                        )}
                      </div>

                      {/* Duration and Timestamp */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>
                            {(() => {
                              const actualDuration = musicDurations.get(music.id);
                              if (actualDuration && isFinite(actualDuration)) {
                                return formatTime(actualDuration);
                              }
                              // 如果还没有加载，尝试从 duration 字段解析
                              if (music.duration && typeof music.duration === 'number') {
                                return formatTime(music.duration);
                              }
                              return '--:--';
                            })()}
                          </span>
                        </div>
                        <div className="text-gray-400 text-xs">
                          {music.createdAt}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Music className="w-16 h-16 text-yellow-500/30 mx-auto mb-4" />
                  <p className="text-gray-300 text-lg">No examples available</p>
                </div>
              )}
            </>
          )}

          {/* My Music Content */}
          {activeTab === 'my-music' && (
            <>
              {isLoadingMyMusic ? (
                <div className="text-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-yellow-400 mx-auto mb-4" />
                  <p className="text-gray-300">Loading your music...</p>
                </div>
              ) : myMusicList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
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
                        className="bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden border border-yellow-500/20 hover:border-yellow-500/40 hover:bg-white/5 transition-all group shadow-lg hover:shadow-yellow-500/20"
                      >
                        {/* Cover Image */}
                        <div className="relative aspect-square bg-gray-900 overflow-hidden">
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
                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                void handlePlayPause(music.id);
                              }}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 transition-all flex items-center justify-center shadow-lg shadow-yellow-500/50 z-10"
                              disabled={!music.audioUrl}
                            >
                              <Play className="w-5 h-5 sm:w-6 sm:h-6 text-black ml-0.5" />
                            </button>
                          </div>
                          {/* Hidden Audio Element for duration detection */}
                          {music.audioUrl && (
                            <audio
                              src={music.audioUrl}
                              preload="metadata"
                              onLoadedMetadata={(e) => {
                                const audio = e.currentTarget;
                                if (audio.duration && isFinite(audio.duration)) {
                                  setMusicDurations(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(music.id, audio.duration);
                                    return newMap;
                                  });
                                }
                              }}
                              className="hidden"
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-5 space-y-3">
                          {/* Title */}
                          <h3 className="text-white font-semibold text-sm sm:text-base line-clamp-2">
                            {music.title || music.prompt || "Untitled"}
                          </h3>
                          
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
                                className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                                title="View/Edit Lyrics"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Lyrics</span>
                              </button>
                            )}
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              <span>
                                {(() => {
                                  const actualDuration = musicDurations.get(music.id);
                                  if (actualDuration && isFinite(actualDuration)) {
                                    return formatTime(actualDuration);
                                  }
                                  // 如果还没有加载，尝试从 duration 字符串解析
                                  const parsedDuration = parseFloat(music.duration);
                                  if (!isNaN(parsedDuration) && parsedDuration > 0) {
                                    return formatTime(parsedDuration);
                                  }
                                  return '--:--';
                                })()}
                              </span>
                            </div>
                          </div>

                          {/* Tags */}
                          {displayTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {displayTags.map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs rounded-lg"
                                >
                                  {tag}
                                </span>
                              ))}
                              {remainingTags > 0 && (
                                <span className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs rounded-lg">
                                  +{remainingTags}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Timestamp */}
                          <div className="text-gray-400 text-xs">
                            {music.createdAt.toLocaleDateString()}
                          </div>

                          {/* Action Buttons */}
                          {music.audioUrl && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleDownload(music.id)}
                                className="flex-1 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-300 hover:text-yellow-200 text-xs rounded-lg transition-all flex items-center justify-center gap-2"
                              >
                                <Download className="w-3 h-3" />
                                Download
                              </button>
                              <button
                                onClick={() => {
                                  // 直接打开选择音频片段对话框
                                  setSelectedMusicForVideo(music);
                                  // 清空之前的拆段结果，准备重新拆段
                                  setAutoSegments([]);
                                  setMusicFeatures(null);
                                  setShowAudioSegmentDialog(true);
                                }}
                                className="flex-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-300 hover:text-blue-200 text-xs rounded-lg transition-all flex items-center justify-center gap-2"
                              >
                                <Mic className="w-3 h-3" />
                                对口型
                              </button>
                            </div>
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
                <div className="text-center py-16 sm:py-20">
                  <Music className="w-16 h-16 sm:w-20 sm:h-20 text-yellow-500/30 mx-auto mb-4" />
                  <p className="text-gray-300 text-lg sm:text-xl mb-2">No music yet</p>
                  <p className="text-gray-400 text-sm sm:text-base">Start creating your first AI-generated music above!</p>
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

      {/* 全局音乐播放器 - 固定在屏幕底部 */}
      <AnimatePresence>
        {currentPlayingMusic && (
          <motion.div
            key={currentPlayingMusic.id}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`fixed z-[100] bg-[#f5f5f0] border border-gray-300 shadow-lg ${
              isPlayerMinimized 
                ? 'bottom-4 right-4 w-80 rounded-lg' 
                : 'bottom-0 left-0 right-0 border-t'
            }`}
            style={{ backgroundImage: 'radial-gradient(circle, #e0e0d8 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          >
            <div className={`${isPlayerMinimized ? 'p-3' : 'max-w-7xl mx-auto px-4 py-3'}`}>
              <div className={`flex items-center ${isPlayerMinimized ? 'flex-col gap-3' : 'gap-4'}`}>
                {/* 左侧：专辑封面 */}
                <div className={`${isPlayerMinimized ? 'w-20 h-20' : 'w-16 h-16'} rounded-lg overflow-hidden flex-shrink-0 bg-gray-200`}>
                  {currentPlayingMusic.coverUrl ? (
                    <img
                      src={currentPlayingMusic.coverUrl}
                      alt={currentPlayingMusic.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-300">
                      <Music className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>

                {/* 中间：歌曲信息和进度条 */}
                <div className={`${isPlayerMinimized ? 'w-full' : 'flex-1 min-w-0'}`}>
                  {/* 标题和类型 */}
                  <div className={`flex items-center justify-between ${isPlayerMinimized ? 'mb-3' : 'mb-2'}`}>
                    <div className="flex-1 min-w-0">
                      <h4 className={`${isPlayerMinimized ? 'text-sm' : 'text-base'} font-bold text-black truncate`}>
                        {currentPlayingMusic.title}
                      </h4>
                      {!isPlayerMinimized && (
                        <p className="text-xs text-gray-600 truncate">
                          {currentPlayingMusic.description.substring(0, 30)}...
                        </p>
                      )}
                    </div>
                    {/* 全屏/最小化切换图标 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-600 hover:text-black hover:bg-gray-200"
                      onClick={() => setIsPlayerMinimized(!isPlayerMinimized)}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* 进度条 */}
                  <div className={`flex items-center ${isPlayerMinimized ? 'flex-col gap-2' : 'gap-2'}`}>
                    {!isPlayerMinimized && (
                      <span className="text-xs text-gray-600 min-w-[40px]">
                        {formatTime(currentTime)}
                      </span>
                    )}
                    <div 
                      className="flex-1 h-1 bg-gray-300 rounded-full relative cursor-pointer"
                      onClick={(e) => {
                        if (globalAudioRef.current && duration > 0) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const percent = (e.clientX - rect.left) / rect.width;
                          const newTime = percent * duration;
                          globalAudioRef.current.currentTime = newTime;
                          setCurrentTime(newTime);
                        }
                      }}
                    >
                      <div
                        className="h-full bg-gray-600 rounded-full transition-all"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                    <div className={`flex items-center ${isPlayerMinimized ? 'w-full justify-between' : 'gap-2'}`}>
                      {isPlayerMinimized && (
                        <span className="text-xs text-gray-600">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      )}
                      {!isPlayerMinimized && (
                        <span className="text-xs text-gray-600 min-w-[40px]">
                          {formatTime(duration)}
                        </span>
                      )}
                      {/* 音量控制 */}
                      <div 
                        className="relative flex items-center"
                        onMouseEnter={() => setShowVolumeSlider(true)}
                        onMouseLeave={() => setShowVolumeSlider(false)}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-600 hover:text-black"
                          onClick={() => {
                            if (globalAudioRef.current) {
                              if (isMuted) {
                                globalAudioRef.current.muted = false;
                                setIsMuted(false);
                              } else {
                                globalAudioRef.current.muted = true;
                                setIsMuted(true);
                              }
                            }
                          }}
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-4 h-4" />
                          ) : volume < 0.5 ? (
                            <Volume1 className="w-4 h-4" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </Button>
                        {/* 音量滑块 */}
                        {showVolumeSlider && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={isMuted ? 0 : volume}
                                onChange={(e) => {
                                  const newVolume = parseFloat(e.target.value);
                                  setVolume(newVolume);
                                  setIsMuted(newVolume === 0);
                                  if (globalAudioRef.current) {
                                    globalAudioRef.current.volume = newVolume;
                                    globalAudioRef.current.muted = newVolume === 0;
                                  }
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-24 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-gray-600"
                                style={{
                                  background: `linear-gradient(to right, #4b5563 0%, #4b5563 ${(isMuted ? 0 : volume) * 100}%, #d1d5db ${(isMuted ? 0 : volume) * 100}%, #d1d5db 100%)`
                                }}
                              />
                              <span className="text-xs text-gray-600 min-w-[30px] text-right">
                                {Math.round((isMuted ? 0 : volume) * 100)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 右侧：播放控制 */}
                <div className={`flex items-center ${isPlayerMinimized ? 'w-full justify-center' : 'gap-2 flex-shrink-0'}`}>
                  {!isPlayerMinimized && (
                    <>
                      {/* 分享图标 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-600 hover:text-black hover:bg-gray-200"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      {/* 上一首 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-600 hover:text-black hover:bg-gray-200"
                        onClick={handlePrevious}
                        disabled={currentPlaylist.length === 0}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </Button>
                    </>
                  )}
                  {/* 播放/暂停 */}
                  <Button
                    size={isPlayerMinimized ? "default" : "lg"}
                    className={`${isPlayerMinimized ? 'h-10 w-10' : 'h-12 w-12'} rounded-full bg-black text-white hover:bg-gray-800 p-0`}
                    onClick={async () => {
                      if (globalAudioRef.current) {
                        if (isPlaying) {
                          try {
                            globalAudioRef.current.pause();
                            setIsPlaying(false);
                          } catch (error) {
                            console.error('Error pausing global audio:', error);
                          }
                        } else {
                          // 先暂停拆段音频
                          if (segmentAudioRef.current && !segmentAudioRef.current.paused) {
                            try {
                              segmentAudioRef.current.pause();
                              setIsPlayingSegment(false);
                              setPlayingSegmentIndex(null);
                            } catch (err) {
                              console.error('Error pausing segment audio:', err);
                            }
                          }
                          
                          try {
                            await globalAudioRef.current.play();
                            setIsPlaying(true);
                          } catch (error) {
                            console.error('Error playing audio:', error);
                            setIsPlaying(false);
                          }
                        }
                      }
                    }}
                  >
                    {isPlaying ? (
                      <Pause className={isPlayerMinimized ? "w-5 h-5" : "w-6 h-6"} />
                    ) : (
                      <Play className={`${isPlayerMinimized ? "w-5 h-5" : "w-6 h-6"} ${!isPlayerMinimized ? "ml-0.5" : ""}`} />
                    )}
                  </Button>
                  {!isPlayerMinimized && (
                    <>
                      {/* 下一首 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-600 hover:text-black hover:bg-gray-200"
                        onClick={handleNext}
                        disabled={currentPlaylist.length === 0}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Button>
                    </>
                  )}
                  {/* 更多选项 - 下拉菜单 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-600 hover:text-black hover:bg-gray-200"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg">
                      <DropdownMenuItem
                        onClick={() => {
                          if (currentPlayingMusic.audioUrl) {
                            // 下载歌曲
                            const link = document.createElement('a');
                            link.href = currentPlayingMusic.audioUrl;
                            link.download = `${currentPlayingMusic.title || 'music'}.mp3`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        下载
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          // 找到对应的音乐
                          const music = myMusicList.find(m => m.id === currentPlayingMusic.id);
                          if (music) {
                            setLyricsEditDialog({
                              isOpen: true,
                              lyrics: music.lyrics || '',
                              musicId: music.id,
                              isNewGeneration: false,
                            });
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        编辑歌词
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          // 找到对应的音乐并打开选择音频片段对话框
                          const music = myMusicList.find(m => m.id === currentPlayingMusic.id);
                          if (music) {
                            setSelectedMusicForVideo(music);
                            // 清空之前的拆段结果，准备重新拆段
                            setAutoSegments([]);
                            setMusicFeatures(null);
                            setShowAudioSegmentDialog(true);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        对口型
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* 隐藏的音频元素 */}
            {currentPlayingMusic.audioUrl && (
              <audio
                ref={globalAudioRef}
                src={currentPlayingMusic.audioUrl}
                volume={volume}
                muted={isMuted}
                onTimeUpdate={(e) => {
                  const audio = e.currentTarget;
                  setCurrentTime(audio.currentTime);
                }}
                onLoadedMetadata={(e) => {
                  const audio = e.currentTarget;
                  const newDuration = audio.duration;
                  setDuration(newDuration);
                  // 设置初始音量
                  if (audio.volume !== volume) {
                    audio.volume = volume;
                  }
                  if (audio.muted !== isMuted) {
                    audio.muted = isMuted;
                  }
                }}
                onCanPlay={(e) => {
                  // 当音频可以播放时，如果 isPlaying 为 true 且音频处于暂停状态，则自动播放
                  const audio = e.currentTarget;
                  if (isPlaying && audio.paused) {
                    // 使用 requestAnimationFrame 确保在下一帧播放
                    requestAnimationFrame(() => {
                      audio.play().catch((error) => {
                        console.error('Error auto-playing audio on canPlay:', error);
                        setIsPlaying(false);
                      });
                    });
                  }
                }}
                onLoadedData={(e) => {
                  // 当音频数据加载完成时，如果 isPlaying 为 true，也尝试播放
                  const audio = e.currentTarget;
                  if (isPlaying && audio.paused && audio.readyState >= 2) {
                    requestAnimationFrame(() => {
                      audio.play().catch((error) => {
                        console.error('Error auto-playing audio on loadedData:', error);
                        setIsPlaying(false);
                      });
                    });
                  }
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                  // 自动播放下一首
                  if (currentPlaylist.length > 0) {
                    handleNext();
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                autoPlay
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation Modal */}
      {showConversation && (
        <MusicConversation
          initialPrompt={conversationPrompt}
          isLyricsMode={formData.lyrics}
          mvParams={conversationMvParams}
          onGenerate={(finalPrompt) => {
            setShowConversation(false);
            // Update form data with final prompt
            setFormData(prev => ({ ...prev, prompt: finalPrompt }));
            // Trigger generation with final prompt
            handleGenerate(finalPrompt);
          }}
          onClose={() => {
            setShowConversation(false);
            setIsGenerating(false);
            setGenerationProgress({ status: 'idle', message: '' });
            setConversationMvParams(undefined);
          }}
        />
      )}

      {/* 选择音频片段对话框 */}
      <Dialog open={showAudioSegmentDialog} onOpenChange={(open) => {
        setShowAudioSegmentDialog(open);
        if (!open) {
          if (segmentAudioRef.current) {
            segmentAudioRef.current.pause();
            setIsPlayingSegment(false);
            setPlayingSegmentIndex(null);
          }
          // 不清空 autoSegments，保留拆段结果
          // setSelectedMusicForVideo(null);
        } else {
          // 打开对话框时，如果有音频URL，自动触发智能拆段
          // 等待音频元数据加载完成后再触发
          if (selectedMusicForVideo?.audioUrl && autoSegments.length === 0 && !isAnalyzing) {
            // 延迟执行，确保对话框完全打开和音频元数据加载
            const checkAndSegment = () => {
              if (audioDuration > 0) {
                handleAutoSegment();
              } else {
                // 如果音频时长还未加载，再等待一下
                setTimeout(checkAndSegment, 200);
              }
            };
            setTimeout(checkAndSegment, 500);
          }
        }
      }}>
        <DialogContent className="sm:max-w-[90vw] max-w-[95vw] w-full bg-white p-0 overflow-y-auto max-h-[90vh] flex flex-col">
          <DialogTitle className="sr-only">Step 1: Select Audio Segment</DialogTitle>
          <div className="flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0 pr-12 sm:pr-16">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Step 1: Select Audio Segment</h2>
              </div>
              <Button
                className="bg-black text-white hover:bg-gray-800 px-6 sm:px-8"
                onClick={async () => {
                  if (!selectedMusicForVideo?.audioUrl) return;
                  
                  // 先关闭当前对话框，避免卡顿
                  setShowAudioSegmentDialog(false);
                  
                  // 直接使用原始音频URL，不调用截取API（避免卡顿）
                  // 实际截取可以在生成MV时进行
                  setTrimmedAudioData({
                    audioUrl: selectedMusicForVideo.audioUrl,
                    startTime: selectedStartTime,
                    endTime: selectedEndTime,
                    musicId: selectedMusicForVideo.id,
                    musicTitle: selectedMusicForVideo.title || selectedMusicForVideo.prompt || '',
                    musicFeatures: musicFeatures || undefined,
                  });
                  
                  // 延迟一点打开新对话框，确保前一个对话框完全关闭
                  setTimeout(() => {
                    setShowMVCustomizeDialog(true);
                  }, 100);
                }}
              >
                Next
              </Button>
            </div>

            {/* 内容区域 */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* 音频特征信息和拆段结果优先显示 */}
              {isAnalyzing && (
                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                  <span className="text-sm text-purple-700">Analyzing audio features and segmenting...</span>
                </div>
              )}
              
              {musicFeatures && !isAnalyzing && (
                <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-gray-700">Audio Features:</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">BPM: {musicFeatures.bpm}</span>
                    {musicFeatures.key && <span className="ml-3">Key: {musicFeatures.key}</span>}
                  </div>
                </div>
              )}

              {/* 自动拆段结果 - 优先显示 */}
              {autoSegments.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Segmentation Results ({autoSegments.length} segments):</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoSegment}
                      disabled={isAnalyzing}
                      className="text-xs"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Re-analyzing
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 mr-1" />
                          Re-segment
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {autoSegments.map((segment, index) => {
                      const isSelected = Math.abs(segment.start - selectedStartTime) < 0.1 && 
                                        Math.abs(segment.end - selectedEndTime) < 0.1;
                      const isPlaying = playingSegmentIndex === index && isPlayingSegment;
                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setSelectedStartTime(segment.start);
                            setSelectedEndTime(segment.end);
                            setSelectedSegmentIndex(index);
                          }}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-purple-600 bg-purple-50 shadow-md'
                              : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-900">Segment {index + 1}</span>
                                {isSelected && (
                                  <span className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded-full">Selected</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 mb-1">
                                {formatTime(segment.start)} - {formatTime(segment.end)}
                              </div>
                              <div className="text-xs font-medium text-gray-500">
                                Duration: {formatTime(segment.end - segment.start)}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 flex-shrink-0"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (isPlaying && segmentAudioRef.current) {
                                  // 暂停当前播放
                                  try {
                                    segmentAudioRef.current.pause();
                                    // 移除事件监听器
                                    if (segmentProgressListenerRef.current) {
                                      segmentAudioRef.current.removeEventListener('timeupdate', segmentProgressListenerRef.current);
                                      segmentProgressListenerRef.current = null;
                                    }
                                  } catch (err) {
                                    console.error('Error pausing segment audio:', err);
                                  }
                                  setIsPlayingSegment(false);
                                  setPlayingSegmentIndex(null);
                                } else {
                                  // 使用公共函数播放段落
                                  await playSegment(segment, index);
                                }
                              }}
                            >
                              {isPlaying ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4 ml-0.5" />
                              )}
                            </Button>
                          </div>
                          <button
                            onClick={async () => {
                              // 使用公共函数播放段落
                              await playSegment(segment, index);
                            }}
                            className="w-full mt-2"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                                  style={{ width: `${segment.energy * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 min-w-[60px] text-right">
                                Energy: {(segment.energy * 100).toFixed(0)}%
                              </span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 音频波形和时间轴 - 仅在未拆段时显示 */}
              {autoSegments.length === 0 && !isAnalyzing && (
                <div className="space-y-3 sm:space-y-4">
                {/* 时间轴标签 */}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatTime(0)}</span>
                  <span>{formatTime(audioDuration)}</span>
                </div>

                {/* 波形容器 */}
                <div className="relative waveform-container" ref={waveformContainerRef}>
                  {/* 背景波形（灰色） */}
                  <div className="h-16 sm:h-20 bg-gray-100 rounded-lg relative overflow-hidden">
                    {/* 模拟波形 */}
                    <div className="absolute inset-0 flex items-center justify-around px-2">
                      {Array.from({ length: 50 }).map((_, i) => {
                        const height = Math.random() * 60 + 20;
                        return (
                          <div
                            key={i}
                            className="w-0.5 sm:w-1 bg-gray-300 rounded-full"
                            style={{ height: `${height}%` }}
                          />
                        );
                      })}
                    </div>

                    {/* 选中片段（紫色）- 固定30秒，可整体拖动 */}
                    <div
                      className="absolute top-0 bottom-0 bg-purple-500/30 border-l-2 border-r-2 border-purple-600 cursor-move z-10"
                      style={{
                        left: `${(selectedStartTime / audioDuration) * 100}%`,
                        width: `${(30 / audioDuration) * 100}%`,
                      }}
                      onMouseDown={(e) => {
                        setIsDragging(true);
                        setDragType('segment');
                        e.preventDefault();
                      }}
                    >
                      {/* 进度线 - 显示当前播放位置 */}
                      {isPlayingSegment && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-20"
                          style={{
                            left: `${((segmentCurrentTime - selectedStartTime) / 30) * 100}%`,
                          }}
                        >
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-yellow-400" />
                        </div>
                      )}
                    </div>

                    {/* 时间标签 - 显示选中片段的开始和结束时间 */}
                    <div
                      className="absolute -top-6 left-0 text-xs font-medium text-black whitespace-nowrap"
                      style={{
                        left: `${(selectedStartTime / audioDuration) * 100}%`,
                      }}
                    >
                      {formatTime(selectedStartTime)}
                    </div>
                    <div
                      className="absolute -top-6 text-xs font-medium text-black whitespace-nowrap"
                      style={{
                        left: `${(selectedEndTime / audioDuration) * 100}%`,
                      }}
                    >
                      {formatTime(selectedEndTime)}
                    </div>
                  </div>

                  {/* 拖动处理 */}
                  {isDragging && (
                    <div
                      className="fixed inset-0 z-50 cursor-move"
                      onMouseMove={(e) => {
                        if (!isDragging || !dragType || !waveformContainerRef.current || audioDuration === 0) return;
                        const containerRect = waveformContainerRef.current.getBoundingClientRect();
                        const x = e.clientX - containerRect.left;
                        const percentage = Math.max(0, Math.min(1, x / containerRect.width));
                        const time = percentage * audioDuration;

                        if (dragType === 'segment') {
                          // 拖动整个选择框，保持30秒宽度
                          const newStartTime = Math.max(0, Math.min(audioDuration - 30, time - 15));
                          const newEndTime = newStartTime + 30;
                          setSelectedStartTime(newStartTime);
                          setSelectedEndTime(newEndTime);
                        }
                      }}
                      onMouseUp={() => {
                        setIsDragging(false);
                        setDragType(null);
                      }}
                    />
                  )}
                </div>

                {/* 播放按钮和信息 - 仅在未拆段时显示 */}
                {autoSegments.length === 0 && (
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <Button
                        size="lg"
                        className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black text-white hover:bg-gray-800 p-0 flex-shrink-0"
                        onClick={() => {
                          if (!selectedMusicForVideo?.audioUrl) return;
                          
                          if (isPlayingSegment && segmentAudioRef.current) {
                            segmentAudioRef.current.pause();
                            setIsPlayingSegment(false);
                            setPlayingSegmentIndex(null);
                          } else {
                            if (segmentAudioRef.current) {
                              segmentAudioRef.current.currentTime = selectedStartTime;
                              segmentAudioRef.current.play();
                              setIsPlayingSegment(true);
                              
                              // 监听播放进度，更新进度线和检查是否到达结束时间
                              const updateProgress = () => {
                                if (segmentAudioRef.current) {
                                  const currentTime = segmentAudioRef.current.currentTime;
                                  setSegmentCurrentTime(currentTime);
                                  
                                  if (currentTime >= selectedEndTime) {
                                    segmentAudioRef.current.pause();
                                    setIsPlayingSegment(false);
                                    setPlayingSegmentIndex(null);
                                    setSegmentCurrentTime(selectedStartTime);
                                    segmentAudioRef.current.removeEventListener('timeupdate', updateProgress);
                                  }
                                }
                              };
                              segmentAudioRef.current.addEventListener('timeupdate', updateProgress);
                            }
                          }
                        }}
                      >
                        {isPlayingSegment ? (
                          <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
                        ) : (
                          <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5" />
                        )}
                      </Button>
                      <div>
                        <div className="text-sm text-gray-600">Selected Duration: {formatTime(selectedEndTime - selectedStartTime)}</div>
                        <div className="text-xs text-gray-500">{formatTime(selectedStartTime)} - {formatTime(selectedEndTime)}</div>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 隐藏的片段播放音频元素 */}
      {showAudioSegmentDialog && selectedMusicForVideo?.audioUrl && (
        <audio
          ref={segmentAudioRef}
          src={selectedMusicForVideo.audioUrl}
          onEnded={() => {
            setIsPlayingSegment(false);
            setPlayingSegmentIndex(null);
          }}
          onPause={() => {
            setIsPlayingSegment(false);
            setPlayingSegmentIndex(null);
          }}
          onLoadedMetadata={(e) => {
            const audio = e.currentTarget;
            const duration = audio.duration;
            setAudioDuration(duration);
            // 固定30秒，从0开始
            setSelectedStartTime(0);
            setSelectedEndTime(30);
            
            // 如果还没有拆段结果，且不在分析中，自动触发智能拆段
            if (autoSegments.length === 0 && !isAnalyzing && duration > 0 && selectedMusicForVideo?.audioUrl) {
              setTimeout(() => {
                handleAutoSegment();
              }, 300);
            }
          }}
          onTimeUpdate={(e) => {
            if (isPlayingSegment) {
              setSegmentCurrentTime(e.currentTarget.currentTime);
            }
          }}
        />
      )}

      {/* MV自定义对话框 */}
      {trimmedAudioData && (
        <MVCustomizeDialog
          open={showMVCustomizeDialog}
          onOpenChange={setShowMVCustomizeDialog}
          audioUrl={trimmedAudioData.audioUrl}
          startTime={trimmedAudioData.startTime}
          endTime={trimmedAudioData.endTime}
          musicTitle={trimmedAudioData.musicTitle}
          musicId={trimmedAudioData.musicId}
          sceneDescription={trimmedAudioData.sceneDescription}
          musicFeatures={trimmedAudioData.musicFeatures}
          autoSegments={autoSegments}
          selectedSegmentIndex={selectedSegmentIndex}
          onBack={() => {
            setShowMVCustomizeDialog(false);
            setShowAudioSegmentDialog(true);
          }}
          onGenerate={async (mvParams) => {
            // 关闭MV自定义对话框
            setShowMVCustomizeDialog(false);
            
            // 获取音乐的歌词
            let lyrics = '';
            if (mvParams.musicId) {
              const music = myMusicList.find(m => m.id === mvParams.musicId);
              if (music?.lyrics) {
                lyrics = music.lyrics;
              }
            }
            
            // 构建初始提示词，包含MV参数
            const visualStyleLabel = [
              { id: 'black-white', label: '黑白光影' },
              { id: 'tokyo-neon', label: '东京霓虹夜' },
              { id: 'macaron-love', label: '马卡龙恋爱' },
              { id: '3d-animation', label: '3D动画' },
              { id: 'dreamy-sky', label: '梦幻天空' },
              { id: 'soft-focus', label: '柔焦电影' },
            ].find(s => s.id === mvParams.visualStyle)?.label || mvParams.visualStyle;
            
            const mvTypeLabel = mvParams.mvType === 'narrative' ? '叙事' : '舞蹈';
            const orientationLabel = mvParams.orientation === '16:9' ? '横屏' : '竖屏';
            
            // 构建提示词
            let prompt = `生成MV：\n`;
            prompt += `音乐标题：${mvParams.musicTitle || '未命名'}\n`;
            if (lyrics) {
              prompt += `歌词：${lyrics}\n`;
            }
            prompt += `MV类型：${mvTypeLabel}\n`;
            prompt += `视觉风格：${visualStyleLabel}\n`;
            prompt += `画面比例：${orientationLabel}\n`;
            if (mvParams.inspiration) {
              prompt += `创意灵感：${mvParams.inspiration}\n`;
            }
            
            // 打开对话页面，传递autoSegments
            setConversationPrompt(prompt);
            setConversationMvParams({
              ...mvParams,
              autoSegments: autoSegments, // 传递音频段数据，包含shotPlan
            });
            setShowConversation(true);
          }}
        />
      )}

      <Footer />
    </div>
  );
}

// 格式化时间函数
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
