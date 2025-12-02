"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Send, 
  Plus, 
  Zap, 
  Globe, 
  Music, 
  Sparkles,
  ChevronDown,
  Loader2,
  Image as ImageIcon,
  Video,
  FileAudio,
  Copy,
  Check,
  FileText,
  Play,
  Star,
  Pause,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Maximize2,
  Share2,
  MoreHorizontal,
  Download,
  Edit,
  Video as VideoIcon,
  Sparkles as SparklesIcon,
  X,
  AlertCircle,
  RefreshCw,
  Mic
} from "lucide-react";
import dynamic from "next/dynamic";

const Lottie = dynamic(
  () => import("lottie-react").then((mod) => mod.default || mod),
  { 
    ssr: false,
    loading: () => <div className="w-48 h-48 flex items-center justify-center"><Music className="w-24 h-24 text-yellow-400/50 animate-pulse" /></div>
  }
);

interface StoryboardShot {
  shotId: number;
  timeRange: [number, number];
  shotType?: string;
  cameraMovement?: {
    type?: string;
    direction?: string;
    speed?: string;
  } | string;
  subject?: {
    description?: string;
    action?: string;
    emotionalState?: string;
  } | string;
  environmentInteraction?: string;
  lighting?: string;
  colorPalette?: string;
  transitionOut?: string;
  keyElements?: string;
  [key: string]: any;
}

interface StoryboardScene {
  sceneId: number;
  timeRange: [number, number];
  scenePurpose?: string;
  environment?: string;
  shots: StoryboardShot[];
  soraPrompt?: string;
  [key: string]: any;
}

interface Storyboard {
  title?: string;
  visualStyle?: string;
  transitionPrinciples?: string;
  aspectRatio: "16:9" | "9:16";
  scenes: StoryboardScene[];
  [key: string]: any;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  timestamp: Date;
  prompt?: string; // 音乐总结
  lyrics?: string; // 歌词
  title?: string; // 标题
  creditsUsed?: {
    music?: number; // 音乐生成消耗的积分
    lyrics?: number; // 歌词生成消耗的积分
    planning?: number; // 创作规划消耗的积分
    analysis?: number; // 任务分析消耗的积分
  };
  isStyleDescription?: boolean; // 是否是风格描述消息
  storyboard?: Storyboard; // 分镜脚本
  generatedVideoUrl?: string; // 生成的视频URL
  isGeneratingVideo?: boolean; // 是否正在生成视频
  videoGenerationError?: {
    type: 'video_generation' | 'video_merge'; // 视频生成错误或合成错误
    failedScenes?: Array<{ sceneId: number; error: string }>; // 失败的场景
    error: string; // 错误信息
  }; // 视频生成错误信息
}

interface MusicConversationProps {
  initialPrompt: string;
  onGenerate: (finalPrompt: string) => void;
  onClose: () => void;
  isLyricsMode?: boolean; // 是否为歌词模式
  mvParams?: {
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
  }; // MV生成参数
}

export default function MusicConversation({ initialPrompt, onGenerate, onClose, isLyricsMode = false, mvParams }: MusicConversationProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasInitializedRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const [musicTips, setMusicTips] = useState<{ id: number; tips: string }[]>([]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [logoAnimation, setLogoAnimation] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null); // 跟踪已复制的卡片ID
  const [generatedMusics, setGeneratedMusics] = useState<Array<{
    id: string;
    title: string;
    description: string;
    coverUrl?: string;
    audioUrl?: string;
  }>>([]); // 生成的音乐列表
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false); // 是否正在生成音乐
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false); // 显示重新生成对话框
  const [currentLyrics, setCurrentLyrics] = useState<string>(''); // 当前歌词
  const [currentPrompt, setCurrentPrompt] = useState<string>(''); // 当前提示词
  const [currentTitle, setCurrentTitle] = useState<string>(''); // 当前标题
  const [musicGenerationPrompt, setMusicGenerationPrompt] = useState<string>(''); // 用于生成音乐时拼接的提示词
  const [showEditLyricsDialog, setShowEditLyricsDialog] = useState(false); // 显示编辑歌词对话框
  const [editingLyrics, setEditingLyrics] = useState<string>(''); // 正在编辑的歌词
  const [editingMusicId, setEditingMusicId] = useState<string | null>(null); // 正在编辑的音乐ID
  const [editingStyleMessageId, setEditingStyleMessageId] = useState<string | null>(null); // 正在编辑的风格描述消息ID
  const [editingStyleContent, setEditingStyleContent] = useState<string>(''); // 正在编辑的风格描述内容
  const [showVideoOptions, setShowVideoOptions] = useState(false); // 显示对口型选项
  const [showAudioSegmentDialog, setShowAudioSegmentDialog] = useState(false); // 显示选择音频片段对话框
  const [selectedStartTime, setSelectedStartTime] = useState(0); // 选中的开始时间（秒）
  const [selectedEndTime, setSelectedEndTime] = useState(30); // 选中的结束时间（秒），固定30秒
  const [audioDuration, setAudioDuration] = useState(86); // 音频总时长（秒），默认86秒
  const [isDragging, setIsDragging] = useState(false); // 是否正在拖动
  const [dragType, setDragType] = useState<'start' | 'end' | 'segment' | null>(null); // 拖动类型
  const waveformContainerRef = useRef<HTMLDivElement | null>(null); // 波形容器引用
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false); // 播放器是否最小化（固定大小）
  const segmentAudioRef = useRef<HTMLAudioElement | null>(null); // 片段播放音频元素引用
  const [isPlayingSegment, setIsPlayingSegment] = useState(false); // 是否正在播放选中片段
  const [segmentCurrentTime, setSegmentCurrentTime] = useState(0); // 片段播放的当前时间
  const [showMVCustomizeDialog, setShowMVCustomizeDialog] = useState(false); // 显示MV自定义对话框
  const [trimmedAudioData, setTrimmedAudioData] = useState<{
    audioUrl: string;
    startTime: number;
    endTime: number;
    musicId?: string;
    musicTitle?: string;
  } | null>(null); // 截取后的音频数据
  const [currentPlayingMusic, setCurrentPlayingMusic] = useState<{
    id: string;
    title: string;
    description: string;
    coverUrl?: string;
    audioUrl?: string;
  } | null>(null); // 当前播放的音乐
  const [isPlaying, setIsPlaying] = useState(false); // 是否正在播放
  const [currentTime, setCurrentTime] = useState(0); // 当前播放时间
  const [duration, setDuration] = useState(0); // 总时长
  const audioRef = useRef<HTMLAudioElement | null>(null); // 音频元素引用

  // 调试：监听 currentPlayingMusic 变化
  useEffect(() => {
    console.log('[MusicConversation] currentPlayingMusic changed:', currentPlayingMusic);
    if (currentPlayingMusic) {
      console.log('[MusicConversation] Playing music:', {
        id: currentPlayingMusic.id,
        title: currentPlayingMusic.title,
        hasAudioUrl: !!currentPlayingMusic.audioUrl,
        audioUrl: currentPlayingMusic.audioUrl,
        hasCoverUrl: !!currentPlayingMusic.coverUrl,
        coverUrl: currentPlayingMusic.coverUrl,
      });
    }
  }, [currentPlayingMusic]);

  // 监听打开选择音频片段对话框的事件
  useEffect(() => {
    const handleOpenAudioSegmentDialog = (event: CustomEvent) => {
      const music = event.detail?.music;
      if (music) {
        setCurrentPlayingMusic(music);
        // 设置音频时长为当前播放音乐的时长（如果已加载）
        if (duration > 0) {
          setAudioDuration(duration);
        }
        // 重置选中时间为前30秒
        setSelectedStartTime(0);
        setSelectedEndTime(Math.min(30, duration || 30));
        setShowAudioSegmentDialog(true);
      }
    };

    window.addEventListener('openAudioSegmentDialog', handleOpenAudioSegmentDialog as EventListener);
    return () => {
      window.removeEventListener('openAudioSegmentDialog', handleOpenAudioSegmentDialog as EventListener);
    };
  }, [duration]);

  // 复制功能
  const handleCopy = async (text: string, cardId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(cardId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 同步更新 messagesRef
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 加载 music_tips.json 和 versemovie-logo.json
  useEffect(() => {
    const loadTips = async () => {
      try {
        const response = await fetch('/music/music_tips.json');
        if (response.ok) {
          const data = await response.json();
          if (data.tips && Array.isArray(data.tips)) {
            setMusicTips(data.tips);
          }
        }
      } catch (error) {
        console.error('Failed to load music tips:', error);
      }
    };

    const loadLogoAnimation = async () => {
      try {
        const response = await fetch('/music/versemovie-logo.json');
        if (response.ok) {
          const data = await response.json();
          console.log('[MusicConversation] Logo animation loaded:', data);
          console.log('[MusicConversation] Animation data keys:', Object.keys(data));
          console.log('[MusicConversation] Animation layers count:', data.layers?.length);
          // 确保数据格式正确
          if (data && data.v && data.layers && Array.isArray(data.layers)) {
            setLogoAnimation(data);
            console.log('[MusicConversation] Logo animation state set successfully, version:', data.v);
          } else {
            console.error('[MusicConversation] Invalid animation data format:', {
              hasV: !!data?.v,
              hasLayers: !!data?.layers,
              isArray: Array.isArray(data?.layers)
            });
          }
        } else {
          console.error('[MusicConversation] Failed to load logo animation, status:', response.status);
        }
      } catch (error) {
        console.error('[MusicConversation] Failed to load logo animation:', error);
      }
    };

    loadTips();
    loadLogoAnimation();
  }, []);

  // 循环显示 tips
  useEffect(() => {
    if (musicTips.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % musicTips.length);
    }, 3000); // 每3秒切换一次

    return () => clearInterval(interval);
  }, [musicTips.length]);

  useEffect(() => {
    // 自动滚动到底部
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async (message: string, isInitial = false) => {
    if (!message.trim() && !isInitial) return;
    
    // 如果正在加载，不允许再次发送
    if (isLoading && !isInitial) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    // 先添加用户消息到状态（立即显示）
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      // 同步更新 ref
      messagesRef.current = newMessages;
      return newMessages;
    });
      setIsLoading(true);
    setInputValue("");

    // 如果是MV生成模式且是初始消息，生成特定的AI回复
    if (mvParams && isInitial) {
      // 获取视觉风格描述
      const visualStyleDescriptions: Record<string, string> = {
        'realistic-photography': 'Realistic photography style with natural lighting, authentic textures, and lifelike details',
        'cyberpunk': 'Cyberpunk aesthetic with neon lights, futuristic urban landscapes, and high-tech visual elements',
        'trendy-illustration': 'Modern illustration style with vibrant colors, contemporary design trends, and artistic flair',
        'chibi-character': 'Chibi character style with cute, simplified proportions and expressive features',
        '3d-character': '3D character rendering with depth, volume, and three-dimensional visual presence',
      };
      
      const visualStyleDesc = visualStyleDescriptions[mvParams.visualStyle] || '独特的视觉风格';
      
      // 生成AI回复
      const assistantMessage1: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '收到啦！画面感已经浮现，我开始行动了。',
        timestamp: new Date(),
      };
      
      setMessages(prev => {
        const newMessages = [...prev, assistantMessage1];
        messagesRef.current = newMessages;
        return newMessages;
      });
      
      // 延迟显示第二条消息（风格描述）
      setTimeout(() => {
        const styleDescriptionId = (Date.now() + 2).toString();
        const styleContent = visualStyleDesc; // 只保存风格描述内容，不包含"正在捕捉那份"
        const assistantMessage2: Message = {
          id: styleDescriptionId,
          role: 'assistant',
          content: `正在捕捉那份${styleContent}...`,
          timestamp: new Date(),
          isStyleDescription: true, // 标记为风格描述消息
        };
        
        setMessages(prev => {
          const newMessages = [...prev, assistantMessage2];
          messagesRef.current = newMessages;
          return newMessages;
        });
        
        setIsLoading(false);
      }, 1000);
      
      return;
    }

    // 计算更新后的消息列表用于API调用
    const updatedMessages = [...messagesRef.current];

    try {
      
      // 调用对话API
      const response = await fetch('/api/music/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          initialPrompt: initialPrompt,
        }),
      });

          if (!response.ok) {
        let errorMessage = `Failed to get AI response (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // 如果无法解析错误响应，使用默认消息
        }
        console.error('[MusicConversation] API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage
        });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.response || data.message || 'I understand your music style. Let me help you refine it.',
            suggestions: data.suggestions || [],
            timestamp: new Date(),
          };
          
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
          console.error('Error getting AI response:', error);
      const errorText = error instanceof Error ? error.message : 'Unknown error';
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
        content: `Sorry, I encountered an error: ${errorText}. Please try again or check if you're logged in.`,
            timestamp: new Date(),
          };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
          setIsLoading(false);
    }
  }, [initialPrompt, isLoading, mvParams]);

  // 生成分镜脚本
  const generateStoryboard = useCallback(async (styleDescriptionMessage?: string) => {
    if (!mvParams) {
      console.error('[generateStoryboard] mvParams is required');
      return;
    }

    try {
      // 获取歌词（如果有musicId）
      let lyrics = '';
      if (mvParams.musicId) {
        try {
          const response = await fetch(`/api/music/list`);
          if (response.ok) {
            const data = await response.json();
            const music = data.data?.find((m: any) => m.id === mvParams.musicId);
            if (music?.metadata?.lyricsText) {
              lyrics = music.metadata.lyricsText;
            }
          }
        } catch (error) {
          console.error('[generateStoryboard] Failed to fetch lyrics:', error);
        }
      }

      // 从消息中获取风格描述
      let styleDescription = '';
      if (styleDescriptionMessage) {
        styleDescription = styleDescriptionMessage.replace(/^正在捕捉那份/, '').replace(/\.\.\.$/, '');
      } else {
        // 从消息列表中查找风格描述消息
        const styleMsg = messagesRef.current.find(m => m.isStyleDescription);
        if (styleMsg) {
          styleDescription = styleMsg.content.replace(/^正在捕捉那份/, '').replace(/\.\.\.$/, '');
        }
      }

      // 计算音频时长（秒）
      const audioDuration = mvParams.endTime - mvParams.startTime;

      // 调用分镜生成API
      const response = await fetch('/api/music/generate-storyboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioDuration,
          aspectRatio: mvParams.orientation,
          videoStyle: styleDescription || mvParams.visualStyle || undefined,
          lyrics: lyrics || undefined,
          musicFeatures: mvParams.musicFeatures || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate storyboard: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.storyboard) {
        // 更新消息，添加分镜脚本
        setMessages(prev => prev.map(m => {
          if (m.content.includes('正在根据你的音乐定制专属分镜脚本')) {
            return {
              ...m,
              storyboard: data.storyboard,
            };
          }
          return m;
        }));
        // 同步更新 ref
        messagesRef.current = messagesRef.current.map(m => {
          if (m.content.includes('正在根据你的音乐定制专属分镜脚本')) {
            return {
              ...m,
              storyboard: data.storyboard,
            };
          }
          return m;
        });

        // 分镜脚本生成完成后，自动开始视频生成
        if (data.storyboard && data.storyboard.scenes && data.storyboard.scenes.length > 0) {
          // 添加AI消息
          const videoGenMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '正在用心制作你的音乐视频,预计10分钟,值得等待!',
            timestamp: new Date(),
            isGeneratingVideo: true,
          };
          setMessages(prev => [...prev, videoGenMessage]);
          messagesRef.current = [...messagesRef.current, videoGenMessage];

          // 开始生成视频
          generateMV(data.storyboard);
        }
      } else {
        throw new Error(data.error || 'Failed to generate storyboard');
      }
    } catch (error) {
      console.error('[generateStoryboard] Error:', error);
      // 显示错误消息
      setMessages(prev => prev.map(m => {
        if (m.content.includes('正在根据你的音乐定制专属分镜脚本')) {
          return {
            ...m,
            content: `生成分镜脚本时出错: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
        return m;
      }));
      // 同步更新 ref
      messagesRef.current = messagesRef.current.map(m => {
        if (m.content.includes('正在根据你的音乐定制专属分镜脚本')) {
          return {
            ...m,
            content: `生成分镜脚本时出错: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
        return m;
      });
    }
  }, [mvParams]);

  // 生成MV视频
  const generateMV = useCallback(async (storyboard?: Storyboard, retryFailedScenes = false) => {
    // 如果没有传入storyboard，尝试从消息中获取
    let targetStoryboard = storyboard;
    if (!targetStoryboard) {
      const storyboardMessage = messagesRef.current.find(m => m.storyboard);
      if (storyboardMessage?.storyboard) {
        targetStoryboard = storyboardMessage.storyboard;
      }
    }

    if (!mvParams || !targetStoryboard || !targetStoryboard.scenes || targetStoryboard.scenes.length === 0) {
      console.error('[generateMV] Invalid parameters', { mvParams: !!mvParams, storyboard: !!targetStoryboard });
      return;
    }

    try {
      // 准备场景数据，注入shotPlan到soraPrompt
      let scenes = targetStoryboard.scenes.map(scene => {
        let enhancedPrompt = scene.soraPrompt || '';
        
        // 如果有autoSegments，尝试匹配对应的segment并注入shotPlan
        if (mvParams?.autoSegments && scene.timeRange) {
          const [sceneStart, sceneEnd] = scene.timeRange;
          // 找到时间范围重叠的segment
          const matchingSegment = mvParams.autoSegments.find(seg => {
            const segStart = seg.start;
            const segEnd = seg.end;
            // 检查是否有重叠（允许部分重叠）
            return (segStart < sceneEnd && segEnd > sceneStart);
          });
          
          // 如果找到匹配的segment且有shotPlan，注入到prompt中
          if (matchingSegment?.videoPrompt?.shotPlan) {
            const shotPlan = matchingSegment.videoPrompt.shotPlan;
            // 将shotPlan信息追加到prompt中
            enhancedPrompt = `${enhancedPrompt} Shot size: ${shotPlan.shotSize}, camera angle: ${shotPlan.cameraAngle}, framing: ${shotPlan.framingRule}, camera motion: ${shotPlan.cameraMotion}, purpose: ${shotPlan.shotPurpose}.`;
          }
        }
        
        return {
          sceneId: scene.sceneId,
          soraPrompt: enhancedPrompt,
          duration: scene.timeRange ? scene.timeRange[1] - scene.timeRange[0] : 5,
          timeRange: scene.timeRange || [0, 5],
        };
      });

      // 如果是重试失败的场景，只处理失败的场景
      if (retryFailedScenes) {
        const videoMessage = messagesRef.current.find(m => m.isGeneratingVideo || m.videoGenerationError);
        if (videoMessage?.videoGenerationError?.failedScenes) {
          const failedSceneIds = videoMessage.videoGenerationError.failedScenes.map(s => s.sceneId);
          scenes = scenes.filter(s => failedSceneIds.includes(s.sceneId));
          console.log('[generateMV] 重试失败的场景', { failedSceneIds, scenes: scenes.length });
        }
      }

      // 获取歌词（如果有musicId）
      let lyrics = '';
      if (mvParams?.musicId) {
        try {
          const response = await fetch(`/api/music/list`);
          if (response.ok) {
            const data = await response.json();
            const music = data.data?.find((m: any) => m.id === mvParams.musicId);
            if (music?.metadata?.lyricsText) {
              lyrics = music.metadata.lyricsText;
            }
          }
        } catch (error) {
          console.error('[generateMV] Failed to fetch lyrics:', error);
        }
      }

      // 调用MV生成API
      const response = await fetch('/api/music/generate-mv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenes,
          aspectRatio: targetStoryboard.aspectRatio || mvParams.orientation,
          audioUrl: mvParams.audioUrl,
          audioStartTime: mvParams.startTime,
          audioEndTime: mvParams.endTime,
          lyrics: lyrics || undefined, // 添加歌词内容
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate MV: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data.videoUrl) {
        // 更新消息，添加生成的视频URL
        setMessages(prev => prev.map(m => {
          if (m.content.includes('正在用心制作你的音乐视频') || m.isGeneratingVideo) {
            return {
              ...m,
              generatedVideoUrl: data.data.videoUrl,
              isGeneratingVideo: false,
              videoGenerationError: undefined, // 清除错误信息
            };
          }
          return m;
        }));
        // 同步更新 ref
        messagesRef.current = messagesRef.current.map(m => {
          if (m.content.includes('正在用心制作你的音乐视频') || m.isGeneratingVideo) {
            return {
              ...m,
              generatedVideoUrl: data.data.videoUrl,
              isGeneratingVideo: false,
              videoGenerationError: undefined,
            };
          }
          return m;
        });
      } else if (data.failedScenes && data.failedScenes.length > 0) {
        // 部分场景生成失败
        const errorMessage: Message['videoGenerationError'] = {
          type: 'video_generation',
          failedScenes: data.failedScenes,
          error: `部分场景生成失败 (${data.failedScenes.length}/${scenes.length})`,
        };
        
        setMessages(prev => prev.map(m => {
          if (m.content.includes('正在用心制作你的音乐视频') || m.isGeneratingVideo) {
            return {
              ...m,
              isGeneratingVideo: false,
              videoGenerationError: errorMessage,
            };
          }
          return m;
        }));
        messagesRef.current = messagesRef.current.map(m => {
          if (m.content.includes('正在用心制作你的音乐视频') || m.isGeneratingVideo) {
            return {
              ...m,
              isGeneratingVideo: false,
              videoGenerationError: errorMessage,
            };
          }
          return m;
        });
      } else {
        throw new Error(data.error || 'Failed to generate MV');
      }
    } catch (error) {
      console.error('[generateMV] Error:', error);
      
      // 判断是网络错误还是其他错误
      const isNetworkError = error instanceof TypeError && error.message.includes('fetch');
      const errorType = isNetworkError ? 'video_generation' : 'video_merge';
      
      // 显示错误消息
      const errorMessage: Message['videoGenerationError'] = {
        type: errorType,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      setMessages(prev => prev.map(m => {
        if (m.content.includes('正在用心制作你的音乐视频') || m.isGeneratingVideo) {
          return {
            ...m,
            isGeneratingVideo: false,
            videoGenerationError: errorMessage,
          };
        }
        return m;
      }));
      // 同步更新 ref
      messagesRef.current = messagesRef.current.map(m => {
        if (m.content.includes('正在用心制作你的音乐视频') || m.isGeneratingVideo) {
          return {
            ...m,
            isGeneratingVideo: false,
            videoGenerationError: errorMessage,
          };
        }
        return m;
      });
    }
  }, [mvParams]);

  // 只自动发送一次初始消息并获取AI回复
  useEffect(() => {
    if (!hasInitializedRef.current && initialPrompt && handleSendMessage) {
      // 检查消息列表是否为空
      const checkAndSend = () => {
        if (messagesRef.current.length === 0) {
          hasInitializedRef.current = true;
          console.log('[MusicConversation] Sending initial message:', initialPrompt);
          handleSendMessage(initialPrompt, true);
        }
      };
      
      // 使用 setTimeout 确保在组件完全挂载后再执行
      const timer = setTimeout(checkAndSend, 100);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, handleSendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      handleSendMessage(inputValue);
    }
  };

  const handleSuggestionClick = async (suggestion: string, suggestionIndex: number, totalSuggestions: number) => {
    // 如果正在加载，不允许再次点击
    if (isLoading) return;

    // 先添加用户选择的消息到对话中
    const userChoiceMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: suggestion,
      timestamp: new Date(),
    };
    
    // 添加用户消息到状态
    setMessages(prev => [...prev, userChoiceMessage]);
    setIsLoading(true);

    try {
      // 非歌词模式：根据建议的索引决定拼接位置
      if (!isLyricsMode) {
        // 判断是前两个建议（用于生成音乐时拼接）还是最后一个建议（用于生成歌词时拼接）
        const isLastSuggestion = suggestionIndex === totalSuggestions - 1;
        const isFirstTwoSuggestions = suggestionIndex < 2;
        
        let finalDescription = initialPrompt || '';
        
        if (isLastSuggestion) {
          // 最后一个建议：用于生成歌词时拼接
          finalDescription = initialPrompt 
            ? `${initialPrompt} ${suggestion}` 
            : suggestion;
        } else if (isFirstTwoSuggestions) {
          // 前两个建议：保存用于生成音乐时拼接，生成歌词时不拼接
          setMusicGenerationPrompt(suggestion);
          finalDescription = initialPrompt || suggestion;
        } else {
          // 其他情况：直接拼接
          finalDescription = initialPrompt 
            ? `${initialPrompt} ${suggestion}` 
            : suggestion;
        }
        
        // 调用生成提示词API（包含歌词和总结），直接将建议作为描述
        const generateResponse = await fetch('/api/music/generate-prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: finalDescription,
            genre: '',
            mood: '',
            theme: '',
            tempo: '',
            energy: '',
          }),
        });

        if (!generateResponse.ok) {
          let errorMessage = `Failed to generate prompt (${generateResponse.status})`;
          try {
            const errorData = await generateResponse.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // 如果无法解析错误响应，使用默认消息
          }
          throw new Error(errorMessage);
        }

        const generateData = await generateResponse.json();
        
        // 保存当前歌词、提示词和标题，用于"再来一首"功能
        setCurrentLyrics(generateData.lyrics || '');
        setCurrentPrompt(generateData.prompt || '');
        setCurrentTitle(generateData.title || '');
        
        // 添加生成的总结和歌词到聊天框，分别存储
        const generatedMessage: Message = {
          id: (Date.now() + 2).toString(),
        role: 'assistant',
          content: generateData.title ? `**${generateData.title}**` : '已生成音乐总结和歌词',
          prompt: generateData.prompt || '',
          lyrics: generateData.lyrics || '',
          title: generateData.title || '',
          creditsUsed: {
            planning: 2, // 创作规划消耗2积分
            lyrics: 2, // 歌词生成消耗2积分
            analysis: 2, // 任务分析消耗2积分
            music: 15, // 音乐生成消耗15积分（如果后续生成音乐）
          },
        timestamp: new Date(),
      };

        setMessages(prev => [...prev, generatedMessage]);
        
        // 歌词生成成功后，自动开始生成音乐
        if (generateData.lyrics && generateData.prompt) {
          // 添加"开始生成音乐"消息
          const generatingMessage: Message = {
            id: (Date.now() + 2.5).toString(),
            role: 'assistant',
            content: '开始生成音乐,请稍等...',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, generatingMessage]);
          
          setIsGeneratingMusic(true);
          
          try {
            // 1. 生成封面图
            let coverUrl = '';
            if (generateData.image) {
              const imageResponse = await fetch('/api/scenes/generate-image', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  prompt: generateData.image,
                  sceneLocation: '',
                  count: 1, // 只生成1张封面图
                }),
              });
              
              if (imageResponse.ok) {
                const imageData = await imageResponse.json();
                console.log('[MusicConversation] Image generation response:', imageData);
                // API返回格式: { success: true, data: { images: [...] } }
                if (imageData.data?.images && imageData.data.images.length > 0) {
                  coverUrl = imageData.data.images[0];
                } else if (imageData.images && imageData.images.length > 0) {
                  // 兼容其他格式
                  coverUrl = imageData.images[0].url || imageData.images[0];
                } else if (imageData.data?.imageUrls && imageData.data.imageUrls.length > 0) {
                  // 另一种可能的格式
                  coverUrl = imageData.data.imageUrls[0];
                }
                console.log('[MusicConversation] Extracted coverUrl:', coverUrl);
              } else {
                console.error('[MusicConversation] Image generation failed:', imageResponse.status);
                const errorText = await imageResponse.text().catch(() => '');
                console.error('[MusicConversation] Image generation error:', errorText);
              }
            }
            
            // 2. 生成音乐（如果有音乐生成提示词，则拼接）
            const musicPrompt = musicGenerationPrompt 
              ? `${generateData.prompt} ${musicGenerationPrompt}` 
              : generateData.prompt;
            
            const musicResponse = await fetch('/api/music/generate-from-lyrics', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt: musicPrompt,
                lyrics: generateData.lyrics,
              }),
            });
            
            // 生成音乐后清空音乐生成提示词
            setMusicGenerationPrompt('');
            
            if (!musicResponse.ok) {
              throw new Error('Failed to generate music');
            }
            
            const musicData = await musicResponse.json();
            
            // API返回的是 audioBase64，先上传到火山云存储
            let audioUrl = '';
            if (musicData.audioBase64) {
              const format = musicData.format || 'mp3';
              
              // 上传 base64 音频到火山云存储
              try {
                const uploadResponse = await fetch('/api/music/upload-audio', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    audioBase64: musicData.audioBase64,
                    format: format,
                  }),
                });
                
                if (uploadResponse.ok) {
                  const uploadData = await uploadResponse.json();
                  audioUrl = uploadData.data?.url || '';
                  console.log('[MusicConversation] Audio uploaded to cloud storage:', audioUrl);
                } else {
                  console.error('[MusicConversation] Failed to upload audio to cloud storage:', uploadResponse.status);
                  // 如果上传失败，使用 base64 data URL 作为后备
                  audioUrl = `data:audio/${format};base64,${musicData.audioBase64}`;
                }
              } catch (uploadError) {
                console.error('[MusicConversation] Error uploading audio:', uploadError);
                // 如果上传失败，使用 base64 data URL 作为后备
                const format = musicData.format || 'mp3';
                audioUrl = `data:audio/${format};base64,${musicData.audioBase64}`;
              }
            } else if (musicData.audioUrl) {
              // 兼容直接返回 audioUrl 的情况
              audioUrl = musicData.audioUrl;
            }
            
            console.log('[MusicConversation] Music generation response:', {
              hasAudioBase64: !!musicData.audioBase64,
              hasAudioUrl: !!audioUrl,
              audioUrl: audioUrl ? (audioUrl.startsWith('http') ? audioUrl : audioUrl.substring(0, 100) + '...') : '',
              format: musicData.format,
              fullResponse: { ...musicData, audioBase64: musicData.audioBase64 ? '[BASE64_DATA]' : undefined },
            });
            
            // 3. 保存音乐到数据库（包含封面图片和音频URL）
            let savedMusicId = null;
            try {
              const savePayload = {
                title: generateData.title || '未命名音乐',
                prompt: generateData.prompt || generateData.description || '', // 确保 prompt 不为 undefined
                lyrics: generateData.lyrics || '', // 歌词文本，API会将其保存到metadata中
                audioUrl: audioUrl, // 使用上传后的URL
                coverUrl: coverUrl || null, // 保存封面图片URL
                status: 'completed',
                metadata: {
                  lyricsText: generateData.lyrics || '', // 将歌词文本保存到metadata中
                },
              };
              
              console.log('[MusicConversation] Saving music:', {
                hasPrompt: !!savePayload.prompt,
                promptLength: savePayload.prompt.length,
                hasAudioUrl: !!savePayload.audioUrl,
                hasCoverUrl: !!savePayload.coverUrl,
              });
              
              const saveResponse = await fetch('/api/music/save', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(savePayload),
              });
              
              if (!saveResponse.ok) {
                const errorData = await saveResponse.json().catch(() => ({ error: `HTTP ${saveResponse.status}` }));
                console.error('[MusicConversation] Save music failed:', {
                  status: saveResponse.status,
                  error: errorData.error || errorData.message || 'Unknown error',
                });
                throw new Error(errorData.error || errorData.message || `Failed to save music (${saveResponse.status})`);
              }
              
              const saveData = await saveResponse.json();
              savedMusicId = saveData.data?.id || null;
              console.log('[MusicConversation] Music saved successfully:', savedMusicId);
            } catch (saveError) {
              console.error('[MusicConversation] Failed to save music:', saveError);
              // 不阻止流程继续，即使保存失败也显示音乐
            }
            
            // 4. 添加到生成的音乐列表
            const newMusic = {
              id: savedMusicId || Date.now().toString(),
              title: generateData.title || '未命名音乐',
              description: generateData.prompt || '',
              coverUrl: coverUrl || undefined,
              audioUrl: audioUrl || undefined,
            };
            
            console.log('[MusicConversation] Adding new music to list:', {
              id: newMusic.id,
              title: newMusic.title,
              hasCoverUrl: !!newMusic.coverUrl,
              coverUrl: newMusic.coverUrl,
              hasAudioUrl: !!newMusic.audioUrl,
              audioUrl: newMusic.audioUrl,
            });
            
            setGeneratedMusics(prev => [...prev, newMusic]);
            
            // 4. 添加生成成功的消息
            const successMessage: Message = {
              id: (Date.now() + 3).toString(),
        role: 'assistant',
              content: '音乐生成成功！',
        timestamp: new Date(),
      };
            setMessages(prev => [...prev, successMessage]);
          } catch (error) {
            console.error('Error generating music:', error);
            const errorMessage: Message = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: `音乐生成失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
          } finally {
            setIsGeneratingMusic(false);
          }
        }
        
        // 不关闭窗体，不回退
        setIsLoading(false);
        return;
      }

      // 歌词模式：使用用户选择的内容开始生成并关闭窗口
      setIsLoading(false);
      onGenerate(suggestion);
      onClose(); // 关闭对话窗口
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorText = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorText}. Please try again or check if you're logged in.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 根据当前歌词重新生成音乐（不重新生成歌词）
  const handleRegenerateMusicOnly = async () => {
    if (!currentLyrics || !currentPrompt) {
      console.error('[MusicConversation] No lyrics or prompt available for regeneration');
      return;
    }

    setShowRegenerateDialog(false);
    setIsGeneratingMusic(true);

    try {
      // 添加"开始生成音乐"消息
      const generatingMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '根据当前创意再创作一曲...',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, generatingMessage]);

      // 1. 生成封面图（使用当前提示词）
      let coverUrl = '';
      try {
        const imageResponse = await fetch('/api/scenes/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: currentPrompt,
            sceneLocation: '',
            count: 1,
          }),
        });
        
        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          if (imageData.data?.images && imageData.data.images.length > 0) {
            coverUrl = imageData.data.images[0];
          }
        }
      } catch (error) {
        console.error('[MusicConversation] Failed to generate cover image:', error);
      }

      // 2. 生成音乐（使用当前歌词和提示词，如果有音乐生成提示词则拼接）
      const musicPrompt = musicGenerationPrompt 
        ? `${currentPrompt} ${musicGenerationPrompt}` 
        : currentPrompt;
      
      const musicResponse = await fetch('/api/music/generate-from-lyrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: musicPrompt,
          lyrics: currentLyrics,
        }),
      });
      
      // 生成音乐后清空音乐生成提示词
      setMusicGenerationPrompt('');
      
      if (!musicResponse.ok) {
        throw new Error('Failed to generate music');
      }
      
      const musicData = await musicResponse.json();
      
      // 上传音频到火山云存储
      let audioUrl = '';
      if (musicData.audioBase64) {
        const format = musicData.format || 'mp3';
        try {
          const uploadResponse = await fetch('/api/music/upload-audio', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audioBase64: musicData.audioBase64,
              format: format,
            }),
          });
          
          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            audioUrl = uploadData.data?.url || '';
          } else {
            audioUrl = `data:audio/${format};base64,${musicData.audioBase64}`;
          }
        } catch (uploadError) {
          const format = musicData.format || 'mp3';
          audioUrl = `data:audio/${format};base64,${musicData.audioBase64}`;
        }
      }

      // 3. 保存音乐到数据库
      let savedMusicId = null;
      try {
        const saveResponse = await fetch('/api/music/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: currentTitle || '未命名音乐',
            prompt: currentPrompt,
            lyrics: currentLyrics,
            audioUrl: audioUrl,
            coverUrl: coverUrl || null,
            status: 'completed',
            metadata: {
              lyricsText: currentLyrics,
            },
          }),
        });
        
        if (saveResponse.ok) {
          const saveData = await saveResponse.json();
          savedMusicId = saveData.data?.id || null;
        }
      } catch (saveError) {
        console.error('[MusicConversation] Failed to save music:', saveError);
      }

      // 4. 添加到生成的音乐列表
      const newMusic = {
        id: savedMusicId || Date.now().toString(),
        title: currentTitle || '未命名音乐',
        description: currentPrompt,
        coverUrl: coverUrl || undefined,
        audioUrl: audioUrl || undefined,
      };
      
      setGeneratedMusics(prev => [...prev, newMusic]);

      // 5. 添加生成成功的消息
      const successMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: '音乐生成成功！',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMessage]);
    } catch (error) {
      console.error('Error regenerating music:', error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `音乐生成失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  // 重新生成歌词和歌曲（新创意）
  const handleRegenerateEverything = async () => {
    setShowRegenerateDialog(false);
    
    // 使用当前提示词重新生成歌词和歌曲
    if (currentPrompt) {
      // 调用生成提示词API
      const generateResponse = await fetch('/api/music/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: currentPrompt,
          genre: '',
          mood: '',
          theme: '',
          tempo: '',
          energy: '',
        }),
      });

      if (!generateResponse.ok) {
        throw new Error('Failed to generate prompt');
      }

      const generateData = await generateResponse.json();
      
      // 保存新的歌词和提示词
      setCurrentLyrics(generateData.lyrics || '');
      setCurrentPrompt(generateData.prompt || '');
      setCurrentTitle(generateData.title || '');
      
      // 添加生成的总结和歌词到聊天框
      const generatedMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateData.title ? `**${generateData.title}**` : '已生成音乐总结和歌词',
        prompt: generateData.prompt || '',
        lyrics: generateData.lyrics || '',
        title: generateData.title || '',
        creditsUsed: {
          planning: 2,
          lyrics: 2,
          analysis: 2,
          music: 15,
        },
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, generatedMessage]);
      
      // 自动开始生成音乐（复用现有逻辑）
      if (generateData.lyrics && generateData.prompt) {
        const generatingMessage: Message = {
          id: (Date.now() + 1.5).toString(),
          role: 'assistant',
          content: '开始生成音乐,请稍等...',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, generatingMessage]);
        
        setIsGeneratingMusic(true);
        
        try {
          // 生成封面图
          let coverUrl = '';
          if (generateData.image) {
            const imageResponse = await fetch('/api/scenes/generate-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prompt: generateData.image,
                sceneLocation: '',
                count: 1,
              }),
            });
            
            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              if (imageData.data?.images && imageData.data.images.length > 0) {
                coverUrl = imageData.data.images[0];
              }
            }
          }
          
          // 生成音乐（如果有音乐生成提示词，则拼接）
          const musicPrompt = musicGenerationPrompt 
            ? `${generateData.prompt} ${musicGenerationPrompt}` 
            : generateData.prompt;
          
          const musicResponse = await fetch('/api/music/generate-from-lyrics', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: musicPrompt,
              lyrics: generateData.lyrics,
            }),
          });
          
          // 生成音乐后清空音乐生成提示词
          setMusicGenerationPrompt('');
          
          if (!musicResponse.ok) {
            throw new Error('Failed to generate music');
          }
          
          const musicData = await musicResponse.json();
          
          // 上传音频
          let audioUrl = '';
          if (musicData.audioBase64) {
            const format = musicData.format || 'mp3';
            try {
              const uploadResponse = await fetch('/api/music/upload-audio', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  audioBase64: musicData.audioBase64,
                  format: format,
                }),
              });
              
              if (uploadResponse.ok) {
                const uploadData = await uploadResponse.json();
                audioUrl = uploadData.data?.url || '';
              } else {
                audioUrl = `data:audio/${format};base64,${musicData.audioBase64}`;
              }
            } catch (uploadError) {
              const format = musicData.format || 'mp3';
              audioUrl = `data:audio/${format};base64,${musicData.audioBase64}`;
            }
          }

          // 保存音乐
          let savedMusicId = null;
          try {
            const saveResponse = await fetch('/api/music/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                title: generateData.title || '未命名音乐',
                prompt: generateData.prompt || '',
                lyrics: generateData.lyrics || '',
                audioUrl: audioUrl,
                coverUrl: coverUrl || null,
                status: 'completed',
                metadata: {
                  lyricsText: generateData.lyrics || '',
                },
              }),
            });
            
            if (saveResponse.ok) {
              const saveData = await saveResponse.json();
              savedMusicId = saveData.data?.id || null;
            }
          } catch (saveError) {
            console.error('[MusicConversation] Failed to save music:', saveError);
          }

          // 添加到列表
          const newMusic = {
            id: savedMusicId || Date.now().toString(),
            title: generateData.title || '未命名音乐',
            description: generateData.prompt || '',
            coverUrl: coverUrl || undefined,
            audioUrl: audioUrl || undefined,
          };
          
          setGeneratedMusics(prev => [...prev, newMusic]);

          const successMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: '音乐生成成功！',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, successMessage]);
        } catch (error) {
          console.error('Error generating music:', error);
          const errorMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: `音乐生成失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          setIsGeneratingMusic(false);
        }
      }
    }
  };

  const handleGenerateFromConversation = () => {
    // 使用最后一条用户消息或初始提示作为最终提示
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const finalPrompt = lastUserMessage?.content || initialPrompt;
    onGenerate(finalPrompt);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-7xl h-[90vh] bg-gradient-to-br from-black via-gray-900 to-black rounded-2xl border border-yellow-500/20 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-yellow-500/20 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-yellow-600 to-amber-600 flex items-center justify-center">
              <Music className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Music Creation Assistant</h2>
              <p className="text-xs sm:text-sm text-gray-400">Let's brainstorm together</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white hover:bg-yellow-500/10"
          >
            <span className="hidden sm:inline">Close</span>
            <span className="sm:hidden">×</span>
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          {/* Left: Conversation Panel */}
          <div className="flex-1 sm:flex-none sm:w-96 lg:w-[500px] flex flex-col overflow-hidden border-r border-yellow-500/10">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* 对口型选项 - 按照示例图显示 */}
              {showVideoOptions && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="text-white text-base font-medium mb-4">
                    太好了！我可以帮你用两种方式制作MV，选择你喜欢的一种：
                  </div>
                  
                  {/* Sora2 MV 选项 */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-gray-100 rounded-lg p-4 cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => {
                      setShowVideoOptions(false);
                      // 设置音频时长为当前播放音乐的时长
                      if (duration > 0) {
                        setAudioDuration(duration);
                      }
                      // 重置选中时间为前30秒
                      setSelectedStartTime(0);
                      setSelectedEndTime(Math.min(30, duration || 30));
                      setShowAudioSegmentDialog(true);
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base font-medium text-gray-900">🔥 Sora2 MV · 30s [NEW]</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      仅需46积分 - 惊艳的电影感画面,完美适配TikTok/Reels
                    </p>
                  </motion.div>

                  {/* Vibe MV 选项 */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-purple-100 rounded-lg p-4 border-2 border-purple-300 cursor-pointer hover:bg-purple-200 transition-colors"
                    onClick={() => {
                      setShowVideoOptions(false);
                      // 设置音频时长为当前播放音乐的时长
                      if (duration > 0) {
                        setAudioDuration(duration);
                      }
                      // 重置选中时间为前30秒
                      setSelectedStartTime(0);
                      setSelectedEndTime(Math.min(30, duration || 30));
                      setShowAudioSegmentDialog(true);
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base font-medium text-gray-900">Vibe MV · 60s</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      快速时尚 - 选个视觉模板就能开始
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {messages.length === 0 && !isLoading && !showVideoOptions && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400 text-sm">Starting conversation...</p>
                </div>
              )}
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] sm:max-w-[70%] rounded-2xl p-4 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-yellow-600 to-amber-600 text-black'
                          : 'bg-white/5 backdrop-blur-sm border border-yellow-500/20 text-white'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-yellow-400" />
                          <span className="text-xs font-semibold text-yellow-400">Tunee</span>
                        </div>
                      )}
                      {/* 如果有 prompt 或 lyrics，显示为卡片 */}
                      {(message.prompt || message.lyrics) ? (
                        <div className="space-y-4">
                          {/* 标题 */}
                          {message.title && (
                            <div className="text-lg font-bold text-yellow-300 mb-2">
                              {message.title}
                            </div>
                          )}
                          
                          {/* 音乐总结卡片 */}
                          {message.prompt && (
                            <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-lg p-4 relative">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-yellow-300">音乐总结</h4>
                                  {message.creditsUsed?.planning !== undefined && (
                                    <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded">
                                      -{message.creditsUsed.planning}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopy(message.prompt!, `prompt-${message.id}`)}
                                  className="h-7 w-7 p-0 text-gray-400 hover:text-yellow-300 hover:bg-yellow-500/20"
                                >
                                  {copiedId === `prompt-${message.id}` ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                                {message.prompt}
                              </p>
                            </div>
                          )}
                          
                          {/* 歌词卡片 */}
                          {message.lyrics && (
                            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4 relative">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-blue-300">歌词</h4>
                                  {message.creditsUsed?.lyrics !== undefined && (
                                    <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded">
                                      -{message.creditsUsed.lyrics}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopy(message.lyrics!, `lyrics-${message.id}`)}
                                  className="h-7 w-7 p-0 text-gray-400 hover:text-blue-300 hover:bg-blue-500/20"
                                >
                                  {copiedId === `lyrics-${message.id}` ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                                {message.lyrics}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* 普通消息内容 */
                        <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                          {/* 如果是风格描述消息且正在编辑 */}
                          {message.isStyleDescription && editingStyleMessageId === message.id ? (
                            <div className="space-y-3">
                              <Textarea
                                value={editingStyleContent}
                                onChange={(e) => setEditingStyleContent(e.target.value)}
                                className="w-full bg-white/5 backdrop-blur-sm border-yellow-500/20 text-white placeholder:text-gray-400 rounded-xl p-4 min-h-[100px] resize-none focus:border-yellow-500/40 focus:ring-2 focus:ring-yellow-500/20"
                                placeholder="编辑风格描述..."
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    // 保存编辑
                                    const updatedContent = `正在捕捉那份${editingStyleContent}...`;
                                    setMessages(prev => prev.map(m => 
                                      m.id === message.id 
                                        ? { ...m, content: updatedContent }
                                        : m
                                    ));
                                    setEditingStyleMessageId(null);
                                    setEditingStyleContent('');
                                  }}
                                  className="bg-yellow-600 hover:bg-yellow-500 text-black"
                                >
                                  保存
                                </Button>
                                <Button
                                  onClick={() => {
                                    setEditingStyleMessageId(null);
                                    setEditingStyleContent('');
                                  }}
                                  variant="outline"
                                  className="border-yellow-500/20 text-yellow-300 hover:bg-yellow-500/10"
                                >
                                  取消
                                </Button>
                                <Button
                                  onClick={() => {
                                    // 保存编辑并开始制作
                                    const updatedContent = `正在捕捉那份${editingStyleContent}...`;
                                    setMessages(prev => prev.map(m => 
                                      m.id === message.id 
                                        ? { ...m, content: updatedContent }
                                        : m
                                    ));
                                    setEditingStyleMessageId(null);
                                    setEditingStyleContent('');
                                    
                                    // 显示分镜脚本生成消息
                                    const scriptMessageId = (Date.now() + 1).toString();
                                      const scriptMessage: Message = {
                                        id: scriptMessageId,
                                        role: 'assistant',
                                        content: '正在根据你的音乐定制专属分镜脚本——从故事情节到镜头运镜，全方位设计中...',
                                        timestamp: new Date(),
                                      };
                                    setMessages(prev => [...prev, scriptMessage]);
                                    
                                    // 调用分镜生成API
                                    generateStoryboard(updatedContent);
                                  }}
                                  className="bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-black"
                                >
                                  开始制作
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {message.content.split('\n').map((line, idx) => {
                                // 简单的 Markdown 渲染：支持 **粗体**
                                const parts: (string | React.ReactElement)[] = [];
                                let lastIndex = 0;
                                const boldRegex = /\*\*(.+?)\*\*/g;
                                let match;
                                let key = 0;
                                
                                while ((match = boldRegex.exec(line)) !== null) {
                                  // 添加粗体前的文本
                                  if (match.index > lastIndex) {
                                    parts.push(line.substring(lastIndex, match.index));
                                  }
                                  // 添加粗体文本
                                  parts.push(
                                    <strong key={key++} className="text-yellow-300 font-semibold">
                                      {match[1]}
                                    </strong>
                                  );
                                  lastIndex = match.index + match[0].length;
                                }
                                // 添加剩余文本
                                if (lastIndex < line.length) {
                                  parts.push(line.substring(lastIndex));
                                }
                                
                                return (
                                  <p key={idx} className={idx > 0 ? 'mt-2' : ''}>
                                    {parts.length > 0 ? parts : line}
                                  </p>
                                );
                              })}
                              
                              {/* 风格描述消息的编辑和开始按钮 */}
                              {message.isStyleDescription && (
                                <div className="flex gap-2 mt-4">
                                  <Button
                                    onClick={() => {
                                      // 提取风格描述内容（去掉"正在捕捉那份"和"..."）
                                      const content = message.content.replace(/^正在捕捉那份/, '').replace(/\.\.\.$/, '');
                                      setEditingStyleMessageId(message.id);
                                      setEditingStyleContent(content);
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="border-yellow-500/20 text-yellow-300 hover:bg-yellow-500/10"
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    编辑
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      // 显示分镜脚本生成消息
                                      const scriptMessageId = (Date.now() + 1).toString();
                                      const scriptMessage: Message = {
                                        id: scriptMessageId,
                                        role: 'assistant',
                                        content: '正在根据你的音乐定制专属分镜脚本——从故事情节到镜头运镜，全方位设计中...',
                                        timestamp: new Date(),
                                      };
                                      setMessages(prev => [...prev, scriptMessage]);
                                      
                                      // 调用分镜生成API（传递完整的风格描述消息）
                                      generateStoryboard(message.content);
                                    }}
                                    size="sm"
                                    className="bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-black"
                                  >
                                    开始
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* 分镜脚本卡片 */}
                      {message.storyboard && message.storyboard.scenes && message.storyboard.scenes.length > 0 && (
                        <div className="mt-4">
                          {/* 分镜脚本标题栏 */}
                          <div className="bg-blue-500/20 border border-blue-500/30 rounded-t-lg px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-400" />
                              <h3 className="text-sm font-semibold text-blue-300">分镜脚本</h3>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const storyboardText = JSON.stringify(message.storyboard, null, 2);
                                handleCopy(storyboardText, `storyboard-${message.id}`);
                              }}
                              className="h-6 w-6 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                            >
                              {copiedId === `storyboard-${message.id}` ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          
                          {/* 分镜脚本内容 */}
                          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-x border-b border-blue-500/30 rounded-b-lg p-4 space-y-4">
                            {/* MV标题 */}
                            {(message.storyboard.title || mvParams?.musicTitle) && (
                              <div className="text-base font-bold text-white mb-4">
                                {message.storyboard.title || mvParams?.musicTitle}
                              </div>
                            )}
                            
                            {/* 风格 */}
                            {message.storyboard.visualStyle && (
                              <div>
                                <div className="text-xs font-medium text-gray-400 mb-2">风格</div>
                                <div className="flex flex-wrap gap-2">
                                  {message.storyboard.visualStyle.split(',').map((style: string, idx: number) => (
                                    <span key={idx} className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300">
                                      {style.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* 转场原则 */}
                            {message.storyboard.transitionPrinciples && (
                              <div>
                                <div className="text-xs font-medium text-gray-400 mb-2">转场原则</div>
                                <div className="flex flex-wrap gap-2">
                                  {message.storyboard.transitionPrinciples.split('·').map((principle: string, idx: number) => (
                                    <span key={idx} className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-xs text-purple-300">
                                      {principle.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* 场景列表 */}
                            <div className="space-y-3">
                              {message.storyboard.scenes.map((scene, index) => {
                                const timeRange = Array.isArray(scene.timeRange) ? scene.timeRange : [0, 0];
                                return (
                                  <div
                                    key={scene.sceneId || index}
                                    className="bg-white/5 border border-white/10 rounded-lg p-4"
                                  >
                                    <div className="mb-3">
                                      <h4 className="text-sm font-semibold text-white">
                                        场景{scene.sceneId || index + 1} ({timeRange[0]?.toFixed(1) || 0}-{timeRange[1]?.toFixed(1) || 0}秒)
                                      </h4>
                                      {scene.scenePurpose && (
                                        <p className="text-xs text-gray-400 mt-1">{scene.scenePurpose}</p>
                                      )}
                                    </div>
                                    
                                    {scene.environment && (
                                      <div className="mb-3">
                                        <div className="text-xs font-medium text-gray-400 mb-1">环境</div>
                                        <div className="text-gray-200 text-sm">{scene.environment}</div>
                                      </div>
                                    )}
                                    
                                    {/* 镜头列表 */}
                                    {scene.shots && scene.shots.length > 0 && (
                                      <div className="space-y-3">
                                        {scene.shots.map((shot: StoryboardShot, shotIndex: number) => {
                                          const shotTimeRange = Array.isArray(shot.timeRange) ? shot.timeRange : [0, 0];
                                          return (
                                            <div key={shot.shotId || shotIndex} className="pl-3 border-l-2 border-blue-500/30">
                                              <div className="text-xs font-medium text-blue-300 mb-2">
                                                镜头{shot.shotId || shotIndex + 1} ({shotTimeRange[0]?.toFixed(1) || 0}-{shotTimeRange[1]?.toFixed(1) || 0}秒)
                                              </div>
                                              
                                              <div className="space-y-2 text-sm">
                                                {/* 镜头类型 */}
                                                {shot.shotType && (
                                                  <div>
                                                    <div className="text-xs font-medium text-gray-400 mb-1">镜头</div>
                                                    <div className="text-gray-200">{shot.shotType}</div>
                                                  </div>
                                                )}
                                                
                                                {/* 运镜 */}
                                                {shot.cameraMovement && (
                                                  <div>
                                                    <div className="text-xs font-medium text-gray-400 mb-1">运镜</div>
                                                    <div className="text-gray-200">
                                                      {typeof shot.cameraMovement === 'object' ? (
                                                        <div>
                                                          {shot.cameraMovement.type && <div>类型: {shot.cameraMovement.type}</div>}
                                                          {shot.cameraMovement.direction && <div>方向: {shot.cameraMovement.direction}</div>}
                                                          {shot.cameraMovement.speed && <div>速度: {shot.cameraMovement.speed}</div>}
                                                        </div>
                                                      ) : (
                                                        <div>{shot.cameraMovement}</div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )}
                                                
                                                {/* 主体 */}
                                                {shot.subject && (
                                                  <div>
                                                    <div className="text-xs font-medium text-gray-400 mb-1">主体</div>
                                                    <div className="text-gray-200">
                                                      {typeof shot.subject === 'object' ? (
                                                        <div>
                                                          {shot.subject.description && <div>{shot.subject.description}</div>}
                                                          {shot.subject.action && <div>动作: {shot.subject.action}</div>}
                                                          {shot.subject.emotionalState && <div>情绪: {shot.subject.emotionalState}</div>}
                                                        </div>
                                                      ) : (
                                                        <div>{shot.subject}</div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )}
                                                
                                                {/* 画面 */}
                                                {shot.environmentInteraction && (
                                                  <div>
                                                    <div className="text-xs font-medium text-gray-400 mb-1">画面</div>
                                                    <div className="text-gray-200">{shot.environmentInteraction}</div>
                                                  </div>
                                                )}
                                                
                                                {/* 转场设计 */}
                                                {shot.transitionOut && (
                                                  <div>
                                                    <div className="text-xs font-medium text-gray-400 mb-1">转场设计</div>
                                                    <div className="text-gray-200">{shot.transitionOut}</div>
                                                  </div>
                                                )}
                                                
                                                {/* 屏幕关键元素 */}
                                                {shot.keyElements && (
                                                  <div>
                                                    <div className="text-xs font-medium text-gray-400 mb-1">屏幕关键元素</div>
                                                    <div className="text-gray-200">{shot.keyElements}</div>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Suggestions */}
                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {message.suggestions.map((suggestion, index) => (
                            <motion.button
                              key={index}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              onClick={() => handleSuggestionClick(suggestion, index, message.suggestions?.length || 0)}
                              className="w-full text-left p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 hover:border-yellow-500/40 transition-all text-sm text-yellow-300"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronDown className="w-4 h-4" />
                                <span>{suggestion}</span>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      )}

                      {/* 视频生成错误提示卡片 */}
                      {message.videoGenerationError && (
                        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-red-300 mb-2">
                                {message.videoGenerationError.type === 'video_generation' ? '视频生成失败' : '视频合成失败'}
                              </div>
                              <div className="text-xs text-red-200/80 mb-3">
                                {message.videoGenerationError.error}
                              </div>
                              {message.videoGenerationError.failedScenes && message.videoGenerationError.failedScenes.length > 0 && (
                                <div className="mb-3">
                                  <div className="text-xs font-medium text-red-300 mb-1">失败的场景：</div>
                                  <div className="space-y-1">
                                    {message.videoGenerationError.failedScenes.map((scene, idx) => (
                                      <div key={idx} className="text-xs text-red-200/70">
                                        场景 {scene.sceneId}: {scene.error}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-2 mt-3">
                                {message.videoGenerationError.type === 'video_generation' && message.videoGenerationError.failedScenes && message.videoGenerationError.failedScenes.length > 0 && (
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      const storyboardMessage = messagesRef.current.find(m => m.storyboard);
                                      if (storyboardMessage?.storyboard) {
                                        // 更新消息状态为正在生成
                                        setMessages(prev => prev.map(m => {
                                          if (m.id === message.id) {
                                            return {
                                              ...m,
                                              isGeneratingVideo: true,
                                              videoGenerationError: undefined,
                                              content: '正在重新生成失败的场景...',
                                            };
                                          }
                                          return m;
                                        }));
                                        messagesRef.current = messagesRef.current.map(m => {
                                          if (m.id === message.id) {
                                            return {
                                              ...m,
                                              isGeneratingVideo: true,
                                              videoGenerationError: undefined,
                                              content: '正在重新生成失败的场景...',
                                            };
                                          }
                                          return m;
                                        });
                                        // 重新生成失败的场景
                                        await generateMV(storyboardMessage.storyboard, true);
                                      }
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white text-xs"
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    重新生成
                                  </Button>
                                )}
                                {message.videoGenerationError.type === 'video_merge' && (
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      const storyboardMessage = messagesRef.current.find(m => m.storyboard);
                                      if (storyboardMessage?.storyboard) {
                                        // 更新消息状态为正在生成
                                        setMessages(prev => prev.map(m => {
                                          if (m.id === message.id) {
                                            return {
                                              ...m,
                                              isGeneratingVideo: true,
                                              videoGenerationError: undefined,
                                              content: '正在重新合成视频...',
                                            };
                                          }
                                          return m;
                                        }));
                                        messagesRef.current = messagesRef.current.map(m => {
                                          if (m.id === message.id) {
                                            return {
                                              ...m,
                                              isGeneratingVideo: true,
                                              videoGenerationError: undefined,
                                              content: '正在重新合成视频...',
                                            };
                                          }
                                          return m;
                                        });
                                        // 重新合成视频
                                        await generateMV(storyboardMessage.storyboard, false);
                                      }
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white text-xs"
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    重新合成
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Loading Indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white/5 backdrop-blur-sm border border-yellow-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                      <span className="text-sm text-gray-400">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Mobile: 生成提示 (移动端显示在输入框上方) */}
            {isGeneratingMusic && (
              <div className="sm:hidden p-4 border-t border-yellow-500/20 bg-black/40">
                <div className="flex items-center justify-center gap-2 text-yellow-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">正在生成音乐...</span>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 sm:p-6 border-t border-yellow-500/20 bg-black/40">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Tell me what music you want, or upload images, videos, audio to assist in generating music..."
                    className="w-full bg-white/5 backdrop-blur-sm border-yellow-500/20 text-white placeholder:text-gray-400 rounded-xl p-4 pr-12 min-h-[80px] resize-none focus:border-yellow-500/40 focus:ring-2 focus:ring-yellow-500/20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10"
                      title="Upload"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      type="submit"
                      disabled={!inputValue.trim() || isLoading}
                      className="h-8 w-8 p-0 bg-gradient-to-r from-yellow-600 to-amber-600 text-black hover:from-yellow-500 hover:to-amber-500 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Music Cards Panel or Animation and Tips Panel (PC端) */}
          <div className="hidden sm:flex flex-1 flex-col p-6 bg-gradient-to-br from-yellow-900/10 via-amber-900/5 to-yellow-900/10 relative overflow-hidden overflow-y-auto">
            {/* 检查是否有生成的视频 */}
            {(() => {
              const videoMessage = messages.find(m => m.generatedVideoUrl || m.isGeneratingVideo);
              if (videoMessage) {
                if (videoMessage.isGeneratingVideo) {
                  return (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-4 text-yellow-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-lg font-medium">正在生成视频...</span>
                        <span className="text-sm text-yellow-300">预计10分钟,值得等待!</span>
                      </div>
                    </div>
                  );
                } else if (videoMessage.generatedVideoUrl) {
                  return (
                    <div className="flex flex-col h-full items-center justify-center p-4">
                      <div className="rounded-lg bg-white/10 backdrop-blur-sm p-6 w-full max-w-2xl">
                        <h3 className="text-white font-bold text-lg mb-4">生成的音乐视频</h3>
                        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                          <video
                            src={videoMessage.generatedVideoUrl}
                            controls
                            className="w-full h-full"
                            preload="metadata"
                          >
                            您的浏览器不支持视频播放
                          </video>
                        </div>
                        <div className="mt-4 flex gap-2">
                    <Button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = videoMessage.generatedVideoUrl!;
                              link.download = `music-video-${Date.now()}.mp4`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="flex-1 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-black"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            下载视频
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }
              }
              
              // 如果没有视频，显示音乐或动画
              if (isGeneratingMusic) {
                return (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-4 text-yellow-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-lg font-medium">正在生成音乐...</span>
                    </div>
                  </div>
                );
              } else if (generatedMusics.length > 0) {
                return (
              /* 显示生成的音乐卡片 */
              <div className="flex flex-col h-full">
                <div className="rounded-lg bg-white/10 backdrop-blur-sm p-6 m-4 flex flex-col gap-4">
                  {/* 标题和描述 */}
                  {generatedMusics[0]?.title && (
                    <div>
                      <h3 className="text-white font-bold text-lg mb-1">{generatedMusics[0].title}</h3>
                      {generatedMusics[0]?.description && (
                        <p className="text-gray-300 text-sm line-clamp-2">{generatedMusics[0].description}</p>
                      )}
                    </div>
                  )}
                  
                  {/* 音乐卡片列表 */}
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {generatedMusics.map((music, index) => (
                      <motion.div
                        key={music.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex-1 max-w-[180px] min-w-[150px] relative group"
                      >
                        <div className="relative aspect-square bg-gray-900 rounded-lg overflow-hidden">
                          {music.coverUrl ? (
                            <img
                              src={music.coverUrl}
                              alt={music.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                              <Music className="w-12 h-12 text-gray-600" />
                            </div>
                          )}
                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                            <button
                              onClick={() => {
                                if (music.audioUrl) {
                                  setCurrentPlayingMusic(music);
                                  setIsPlayerMinimized(false);
                                  setCurrentTime(0);
                                }
                              }}
                              className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 transition-all flex items-center justify-center shadow-lg shadow-yellow-500/50 z-10"
                              disabled={!music.audioUrl}
                            >
                              <Play className="w-5 h-5 text-black ml-0.5" />
                            </button>
                          </div>
                          {/* Star Icon */}
                          <div className="absolute top-2 right-2">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          </div>
                          {/* Yellow Dot */}
                          <div className="absolute bottom-2 right-2 w-2 h-2 bg-yellow-400 rounded-full" />
                          {/* Title at bottom inside card */}
                          {music.title && (
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/60 to-transparent">
                              <p className="text-white text-xs font-medium truncate">{music.title}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    
                    {/* 再来一首按钮 */}
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: generatedMusics.length * 0.1 }}
                      onClick={() => setShowRegenerateDialog(true)}
                      className="flex-1 max-w-[180px] min-w-[150px] aspect-square bg-white/5 hover:bg-white/10 border-2 border-dashed border-yellow-500/30 hover:border-yellow-500/50 rounded-lg flex flex-col items-center justify-center gap-2 transition-all group"
                    >
                      <Plus className="w-8 h-8 text-yellow-400 group-hover:text-yellow-300" />
                      <span className="text-yellow-300 text-sm font-medium">再来一首</span>
                    </motion.button>
                  </div>
                </div>
                </div>
                );
              } else {
                return (
                  /* 默认显示动画和提示 */
                  <div className="flex flex-col items-center justify-center h-full">
                {/* Logo Animation */}
                <div className="w-48 h-48 lg:w-64 lg:h-64 flex items-center justify-center mb-6 relative z-10">
                  {logoAnimation && logoAnimation.v && logoAnimation.layers ? (
                    <Lottie 
                      animationData={logoAnimation} 
                      loop={true} 
                      autoplay={true} 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-24 h-24 lg:w-32 lg:h-32 text-yellow-400/50 animate-pulse" />
                    </div>
                  )}
                </div>
                
                {/* Tips Text */}
                {musicTips.length > 0 ? (
                  <motion.div
                    key={currentTipIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5 }}
                    className="text-center px-4 relative z-10"
                  >
                    <p className="text-yellow-300 text-sm sm:text-base leading-relaxed">
                      {musicTips[currentTipIndex]?.tips}
                    </p>
                  </motion.div>
                ) : (
                  <div className="text-center px-4 relative z-10">
                    <p className="text-yellow-300 text-sm sm:text-base leading-relaxed">
                      我们聊聊你的音乐想法，直到每个音符都让你心动
                    </p>
                  </div>
                )}
              </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </motion.div>

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
                    <div className="flex-1 h-1 bg-gray-300 rounded-full relative cursor-pointer">
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
                      {/* 音量图标 */}
                    <Button
                      variant="ghost"
                      size="sm"
                        className="h-6 w-6 p-0 text-gray-600 hover:text-black"
                    >
                        <Volume2 className="w-4 h-4" />
                    </Button>
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
                      >
                        <ChevronLeft className="w-5 h-5" />
                  </Button>
                    </>
                  )}
                  {/* 播放/暂停 */}
                  <Button
                    size={isPlayerMinimized ? "default" : "lg"}
                    className={`${isPlayerMinimized ? 'h-10 w-10' : 'h-12 w-12'} rounded-full bg-black text-white hover:bg-gray-800 p-0`}
                    onClick={() => {
                      if (audioRef.current) {
                        if (isPlaying) {
                          audioRef.current.pause();
                        } else {
                          audioRef.current.play();
                        }
                        setIsPlaying(!isPlaying);
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
                          // 从消息中找到对应的歌词
                          const lyricsMessage = messages.find(m => m.lyrics);
                          const lyricsToEdit = lyricsMessage?.lyrics || currentLyrics || '';
                          setEditingLyrics(lyricsToEdit);
                          setEditingMusicId(currentPlayingMusic.id);
                          setShowEditLyricsDialog(true);
                        }}
                        className="cursor-pointer"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        编辑歌词
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          // 显示对口型选项
                          setShowVideoOptions(true);
                          // 滚动到顶部以显示选项
                          setTimeout(() => {
                            const messagesContainer = document.querySelector('.flex-1.overflow-y-auto');
                            if (messagesContainer) {
                              messagesContainer.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                          }, 100);
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
                ref={audioRef}
                src={currentPlayingMusic.audioUrl}
                onTimeUpdate={(e) => {
                  const audio = e.currentTarget;
                  setCurrentTime(audio.currentTime);
                }}
                onLoadedMetadata={(e) => {
                  const audio = e.currentTarget;
                  const newDuration = audio.duration;
                  setDuration(newDuration);
                  // 如果对话框已打开，更新audioDuration
                  if (showAudioSegmentDialog && newDuration > 0) {
                    setAudioDuration(newDuration);
                    // 确保选中时间不超过音频时长
                    if (selectedEndTime > newDuration) {
                      setSelectedEndTime(Math.min(30, newDuration));
                    }
                  }
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                autoPlay
              />
            )}
                </motion.div>
        )}
      </AnimatePresence>

      {/* 重新生成对话框 */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="sm:max-w-[520px] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-yellow-500/30 shadow-2xl p-0 overflow-hidden">
          {/* 装饰性渐变背景 */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-amber-500/10 pointer-events-none" />
          
          <div className="relative p-6 space-y-6">
            <DialogHeader className="space-y-4">
              {/* 图标和动画效果 */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center"
            >
              <div className="relative">
                  <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full animate-pulse" />
                  <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border-2 border-yellow-500/30">
                    <Music className="w-10 h-10 text-yellow-400" />
                </div>
                </div>
                </motion.div>

              <DialogTitle className="text-2xl font-bold text-white text-center tracking-tight">
                再来一首
              </DialogTitle>
              <DialogDescription asChild>
                <div className="text-gray-300 text-center text-base leading-relaxed">
                  根据当前创意再创作一曲
            </div>
              </DialogDescription>
            </DialogHeader>

            {/* 选项说明卡片 */}
            <div className="space-y-3">
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/15 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
                  <span className="text-yellow-400 font-bold text-sm">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-400 mb-1">确定</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    根据当前歌词重新生成音乐，保留原有歌词内容
                  </p>
              </div>
            </motion.div>

                  <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/15 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-400 mb-1">新创意</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    重新生成歌词和歌曲，全新创作一首音乐
                  </p>
        </div>
      </motion.div>
            </div>
          </div>

          {/* 底部按钮 */}
          <DialogFooter className="px-6 pb-6 pt-0 gap-3">
            <Button
              variant="outline"
              onClick={() => setShowRegenerateDialog(false)}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-600 transition-all"
            >
              取消
            </Button>
            <Button
              onClick={handleRegenerateMusicOnly}
              className="flex-1 bg-gradient-to-r from-yellow-600 to-amber-600 text-black hover:from-yellow-500 hover:to-amber-500 font-semibold shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all"
            >
              确定
            </Button>
            <Button
              onClick={handleRegenerateEverything}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
            >
              新创意
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑歌词对话框 */}
      <Dialog open={showEditLyricsDialog} onOpenChange={setShowEditLyricsDialog}>
        <DialogContent className="sm:max-w-[600px] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-yellow-500/30 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">编辑歌词</DialogTitle>
            <DialogDescription className="text-gray-300">
              编辑歌词后点击"生成歌曲"将重新生成音乐
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editingLyrics}
              onChange={(e) => setEditingLyrics(e.target.value)}
              className="min-h-[300px] bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
              placeholder="请输入歌词..."
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditLyricsDialog(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              取消
            </Button>
            <Button
              onClick={async () => {
                if (!editingLyrics.trim() || !editingMusicId) {
                  return;
                }

                setShowEditLyricsDialog(false);
                setIsGeneratingMusic(true);

                try {
                  // 添加"开始生成音乐"消息
                  const generatingMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: '根据编辑后的歌词重新生成音乐...',
                    timestamp: new Date(),
                  };
                  setMessages(prev => [...prev, generatingMessage]);

                  // 1. 生成封面图
                  let coverUrl = '';
                  try {
                    const imageResponse = await fetch('/api/scenes/generate-image', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        prompt: currentPrompt,
                        sceneLocation: '',
                        count: 1,
                      }),
                    });
                    
                    if (imageResponse.ok) {
                      const imageData = await imageResponse.json();
                      if (imageData.data?.images && imageData.data.images.length > 0) {
                        coverUrl = imageData.data.images[0];
                      }
                    }
                  } catch (error) {
                    console.error('[MusicConversation] Failed to generate cover image:', error);
                  }

                  // 2. 生成音乐（使用编辑后的歌词）
                  const musicResponse = await fetch('/api/music/generate-from-lyrics', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      prompt: currentPrompt,
                      lyrics: editingLyrics,
                    }),
                  });
                  
                  if (!musicResponse.ok) {
                    throw new Error('Failed to generate music');
                  }
                  
                  const musicData = await musicResponse.json();
                  
                  // 上传音频到火山云存储
                  let audioUrl = '';
                  if (musicData.audioBase64) {
                    const format = musicData.format || 'mp3';
                    try {
                      const uploadResponse = await fetch('/api/music/upload-audio', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          audioBase64: musicData.audioBase64,
                          format: format,
                        }),
                      });
                      
                      if (uploadResponse.ok) {
                        const uploadData = await uploadResponse.json();
                        audioUrl = uploadData.data?.url || '';
                      } else {
                        audioUrl = `data:audio/${format};base64,${musicData.audioBase64}`;
                      }
                    } catch (uploadError) {
                      const format = musicData.format || 'mp3';
                      audioUrl = `data:audio/${format};base64,${musicData.audioBase64}`;
                    }
                  }

                  // 3. 更新音乐到数据库
                  try {
                    const updateResponse = await fetch('/api/music/update', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        id: editingMusicId,
                        lyrics: editingLyrics,
                        audioUrl: audioUrl,
                        coverUrl: coverUrl || null,
                        metadata: {
                          lyricsText: editingLyrics,
                        },
                      }),
                    });
                    
                    if (updateResponse.ok) {
                      // 更新本地音乐列表
                      setGeneratedMusics(prev => prev.map(music => 
                        music.id === editingMusicId 
                          ? { ...music, audioUrl: audioUrl, coverUrl: coverUrl || music.coverUrl }
                          : music
                      ));
                      
                      // 更新当前播放的音乐
                      if (currentPlayingMusic && currentPlayingMusic.id === editingMusicId) {
                        setCurrentPlayingMusic({
                          ...currentPlayingMusic,
                          audioUrl: audioUrl,
                          coverUrl: coverUrl || currentPlayingMusic.coverUrl,
                        });
                      }
                      
                      // 更新当前歌词
                      setCurrentLyrics(editingLyrics);
                    }
                  } catch (updateError) {
                    console.error('[MusicConversation] Failed to update music:', updateError);
                  }

                  // 4. 添加生成成功的消息
                  const successMessage: Message = {
                    id: (Date.now() + 2).toString(),
                    role: 'assistant',
                    content: '音乐重新生成成功！',
                    timestamp: new Date(),
                  };
                  setMessages(prev => [...prev, successMessage]);
                } catch (error) {
                  console.error('Error regenerating music:', error);
                  const errorMessage: Message = {
                    id: (Date.now() + 2).toString(),
                    role: 'assistant',
                    content: `音乐生成失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    timestamp: new Date(),
                  };
                  setMessages(prev => [...prev, errorMessage]);
                } finally {
                  setIsGeneratingMusic(false);
                  setEditingLyrics('');
                  setEditingMusicId(null);
                }
              }}
              className="bg-gradient-to-r from-yellow-600 to-amber-600 text-black hover:from-yellow-500 hover:to-amber-500 font-semibold"
            >
              生成歌曲
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 选择音频片段对话框 */}
      <Dialog open={showAudioSegmentDialog} onOpenChange={(open) => {
        setShowAudioSegmentDialog(open);
        if (!open) {
          // 关闭对话框时停止播放
          if (segmentAudioRef.current) {
            segmentAudioRef.current.pause();
            setIsPlayingSegment(false);
          }
        } else {
          // 打开对话框时，如果duration已加载，更新audioDuration
          if (duration > 0) {
            setAudioDuration(duration);
            setSelectedStartTime(0);
            setSelectedEndTime(Math.min(30, duration));
          }
        }
      }}>
        <DialogContent className="sm:max-w-[90vw] max-w-[95vw] w-full bg-white p-0 overflow-hidden max-h-[90vh]">
          <DialogTitle className="sr-only">步骤1: 选择音频片段</DialogTitle>
          <div className="flex flex-col h-full max-h-[800px]">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">步骤1: 选择音频片段</h2>
                <p className="text-xs sm:text-sm text-gray-600">拖动时间轴或点击建议片段 (30秒)</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={() => setShowAudioSegmentDialog(false)}
              >
                <X className="w-5 h-5 text-black" />
              </Button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* 音频波形和时间轴 */}
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

                {/* 播放按钮和信息 */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <Button
                      size="lg"
                      className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black text-white hover:bg-gray-800 p-0 flex-shrink-0"
                      onClick={() => {
                        if (!currentPlayingMusic?.audioUrl) return;
                        
                        if (isPlayingSegment && segmentAudioRef.current) {
                          // 暂停播放
                          segmentAudioRef.current.pause();
                          setIsPlayingSegment(false);
                        } else {
                          // 播放选中片段
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
                      <div className="text-sm text-gray-600">选择时长: {formatTime(selectedEndTime - selectedStartTime)}</div>
                      <div className="text-xs text-gray-500">{formatTime(selectedStartTime)} - {formatTime(selectedEndTime)}</div>
          </div>
        </div>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end p-4 sm:p-6 border-t border-gray-200 flex-shrink-0">
              <Button
                className="bg-black text-white hover:bg-gray-800 px-6 sm:px-8 w-full sm:w-auto"
                onClick={async () => {
                  if (!currentPlayingMusic?.audioUrl) return;
                  
                  try {
                    // 截取音频片段
                    const trimResponse = await fetch('/api/music/trim-audio', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        audioUrl: currentPlayingMusic.audioUrl,
                        startTime: selectedStartTime,
                        endTime: selectedEndTime,
                      }),
                    });

                    if (!trimResponse.ok) {
                      throw new Error('Failed to trim audio');
                    }

                    const trimData = await trimResponse.json();
                    
                    // 保存截取后的音频数据并打开MV自定义对话框
                    setTrimmedAudioData({
                      audioUrl: trimData.data.audioUrl || currentPlayingMusic.audioUrl,
                      startTime: selectedStartTime,
                      endTime: selectedEndTime,
                      musicId: currentPlayingMusic.id,
                      musicTitle: currentPlayingMusic.title,
                    });
                    
                    setShowAudioSegmentDialog(false);
                    setShowMVCustomizeDialog(true);
                  } catch (error) {
                    console.error('Error trimming audio:', error);
                    // 即使截取失败，也使用原始音频URL
                    setTrimmedAudioData({
                      audioUrl: currentPlayingMusic.audioUrl,
                      startTime: selectedStartTime,
                      endTime: selectedEndTime,
                      musicId: currentPlayingMusic.id,
                      musicTitle: currentPlayingMusic.title,
                    });
                    setShowAudioSegmentDialog(false);
                    setShowMVCustomizeDialog(true);
                  }
                }}
              >
                下一步
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 隐藏的片段播放音频元素 */}
      {showAudioSegmentDialog && currentPlayingMusic?.audioUrl && (
        <audio
          ref={segmentAudioRef}
          src={currentPlayingMusic.audioUrl}
          onEnded={() => {
            setIsPlayingSegment(false);
            setSegmentCurrentTime(selectedStartTime);
          }}
          onPause={() => {
            setIsPlayingSegment(false);
          }}
          onTimeUpdate={(e) => {
            if (isPlayingSegment) {
              setSegmentCurrentTime(e.currentTarget.currentTime);
            }
          }}
        />
      )}
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

