"use client";

import React, { useState, useEffect } from "react";
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
  X
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

interface MusicFormData {
  prompt: string;
  genre: string;
  mood: string;
  theme: string;
  tempo: string;
  energy: string;
  lyrics: boolean;
  instrumental: boolean;
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
  genre: string;
  mood: string;
  theme: string;
  tempo: string;
  energy: string;
  lyrics: string;
  instrumental: boolean;
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
}

const buildMusicGenerationPrompt = (attributes: MusicPromptAttributes) => {
  return [
    attributes.genre,
    attributes.mood,
    attributes.theme,
    attributes.tempo,
    attributes.energy,
    attributes.description,
  ]
    .filter((value) => Boolean(value && value.trim()))
    .join(", ");
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
  });
  const promptValue = typeof formData.prompt === "string" ? formData.prompt : "";
  const trimmedPromptValue = promptValue.trim();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMusics, setGeneratedMusics] = useState<GeneratedMusic[]>([]);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
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
  const [exampleAudioElements, setExampleAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
  const [activeTab, setActiveTab] = useState<'examples' | 'my-music'>('examples');
  const [myMusicList, setMyMusicList] = useState<GeneratedMusic[]>([]);
  const [isLoadingMyMusic, setIsLoadingMyMusic] = useState(false);
  
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
  const requiredCreditsForLyrics = 5; // 歌词生成所需的积分
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

  const requestMusicGeneration = async ({
    prompt,
    lyrics,
    audioSetting = DEFAULT_AUDIO_SETTING,
  }: {
    prompt: string;
    lyrics: string;
    audioSetting?: typeof DEFAULT_AUDIO_SETTING;
  }) => {
    const response = await fetch('/api/music/generate-from-lyrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        lyrics,
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
        // 歌词模式：先扣5积分生成歌词
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

        // TODO: Replace with actual lyrics generation API
        // 模拟生成歌词
        await new Promise(resolve => setTimeout(resolve, 2000));
        const generatedLyrics = `[Verse 1]\n${promptValue}\nA melody that flows like a river\nThrough the heart of every listener\n\n[Chorus]\nThis is the sound of dreams\nComing to life in harmony\nEvery note tells a story\nOf hope and endless possibility\n\n[Verse 2]\nWith every beat, we find our rhythm\nIn this moment, we're together\nMusic connects us all\nBreaking down every wall`;

        setPendingGeneration({
          mode: 'lyrics',
          description: promptValue,
          generatedPrompt: promptValue,
          genre: selectedGenre,
          mood: selectedMood,
          theme: selectedTheme,
          tempo: selectedTempo,
          energy: selectedEnergy,
          lyrics: generatedLyrics,
          instrumental: formData.instrumental,
        });

        // 创建临时音乐记录（只有歌词，还没有音频）
        const tempMusicId = `temp-${Date.now()}`;
        
        // 打开歌词编辑弹窗
        setLyricsEditDialog({
          isOpen: true,
          lyrics: generatedLyrics,
          musicId: tempMusicId,
          isNewGeneration: true,
        });

        logGenerationSnapshot('Lyrics Draft Ready', {
          mode: 'lyrics-only',
          description: promptValue,
          genre: selectedGenre,
          mood: selectedMood,
          theme: selectedTheme,
          tempo: selectedTempo,
          energy: selectedEnergy,
          instrumental: formData.instrumental,
          requiredCredits: requiredCreditsForLyrics,
          lyrics: generatedLyrics,
        });

        setGenerationProgress({
          status: 'completed',
          message: 'Lyrics generated successfully!'
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

        setPendingGeneration({
          mode: 'music',
          description: promptValue,
          generatedPrompt,
          genre: selectedGenre,
          mood: selectedMood,
          theme: selectedTheme,
          tempo: selectedTempo,
          energy: selectedEnergy,
          lyrics: generatedLyrics,
          instrumental: formData.instrumental,
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

    if (!lyricsToAttach) {
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
    });

    setIsGenerating(true);
    setGenerationProgress({
      status: 'generating',
      message: 'Creating your music...'
    });

    try {
      const musicResult = await requestMusicGeneration({
        prompt: minimaxiPrompt,
        lyrics: lyricsToAttach,
      });

      const newMusic: GeneratedMusic = {
        id: `music-${Date.now()}`,
        audioUrl: musicResult.audioUrl,
        coverUrl: null,
        prompt: pendingGeneration.generatedPrompt,
        title: pendingGeneration.description.substring(0, 50),
        style: pendingGeneration.genre,
        mood: pendingGeneration.mood,
        duration: "30",
        createdAt: new Date(),
        hasLyrics: !!lyricsToAttach,
        lyrics: lyricsToAttach || undefined,
      };

      try {
        const payload: Record<string, any> = {
          prompt: pendingGeneration.generatedPrompt,
          genre: pendingGeneration.genre,
          mood: pendingGeneration.mood,
          theme: pendingGeneration.theme,
          tempo: pendingGeneration.tempo,
          energy: pendingGeneration.energy,
          lyrics: !!lyricsToAttach,
          instrumental: pendingGeneration.instrumental,
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

      setLyricsEditDialog({
        isOpen: false,
        lyrics: '',
        musicId: null,
        isNewGeneration: false,
      });
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
        };

    const minimaxiPrompt = buildMusicGenerationPrompt({
      genre: context.genre,
      mood: context.mood,
      theme: context.theme,
      tempo: context.tempo,
      energy: context.energy,
      description: context.description,
    });

    // 检查积分余额
    const creditsCheck = await checkCreditsBalance(requiredCreditsForMusicWithLyrics);
    if (!creditsCheck.sufficient) {
      alert(`Insufficient credits. Required: ${requiredCreditsForMusicWithLyrics}, Current: ${creditsCheck.balance || 0}`);
      return;
    }

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

      const musicResult = await requestMusicGeneration({
        prompt: minimaxiPrompt,
        lyrics: trimmedLyrics,
      });

      // 生成带歌词的音乐
      const newMusic: GeneratedMusic = {
        id: `music-${Date.now()}`,
        audioUrl: musicResult.audioUrl,
        coverUrl: null,
        prompt: context.generatedPrompt,
        title: context.description.substring(0, 50),
        style: context.genre || "",
        mood: context.mood,
        duration: "30",
        createdAt: new Date(),
        lyrics: trimmedLyrics,
        hasLyrics: true,
      };

      // 保存到数据库
      try {
        const saveResponse = await fetch('/api/music/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: context.generatedPrompt,
            genre: context.genre,
            mood: context.mood,
            theme: context.theme,
            tempo: context.tempo,
            energy: context.energy,
            lyrics: true,
            instrumental: context.instrumental,
            audioUrl: musicResult.audioUrl,
            duration: 30,
            status: 'completed',
            metadata: { 
              lyrics: trimmedLyrics,
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
      
      // 关闭歌词编辑弹窗
      setLyricsEditDialog({
        isOpen: false,
        lyrics: '',
        musicId: null,
        isNewGeneration: false,
      });
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

  const handlePlayPause = (musicId: string) => {
    if (currentPlayingId === musicId) {
      // Pause current
      const audio = audioElements.get(musicId);
      if (audio) {
        audio.pause();
      }
      setCurrentPlayingId(null);
    } else {
      // Stop all other audio
      audioElements.forEach((audio, id) => {
        if (id !== musicId) {
          audio.pause();
          audio.currentTime = 0;
        }
      });

      // Play new audio
      if (generatedMusics.find(m => m.id === musicId)?.audioUrl) {
        const audio = audioElements.get(musicId);
        if (audio) {
          audio.play();
          setCurrentPlayingId(musicId);
        }
      }
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

  const handleExamplePlayPause = (musicId: string) => {
    if (examplePlayingId === musicId) {
      // Pause current
      const audio = exampleAudioElements.get(musicId);
      if (audio) {
        audio.pause();
      }
      setExamplePlayingId(null);
    } else {
      // Stop all other audio
      exampleAudioElements.forEach((audio, id) => {
        if (id !== musicId) {
          audio.pause();
          audio.currentTime = 0;
        }
      });

      // Play new audio
      const music = musicExamples.find(m => m.id === musicId);
      if (music?.audioUrl) {
        const audio = exampleAudioElements.get(musicId);
        if (audio) {
          audio.play();
          setExamplePlayingId(musicId);
        }
      }
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
          {/* Generation Form - Reference Style */}
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
            <div className="grid grid-cols-5 gap-3">
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
                  <p className="text-gray-400 text-sm">Creating your unique music track</p>
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
                          <div className="flex-shrink-0 w-24 h-24 bg-gray-700 rounded-lg overflow-hidden">
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
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePlayPause(music.id)}
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
                            ref={(el) => {
                              if (el) {
                                audioElements.set(music.id, el);
                              }
                            }}
                            src={music.audioUrl}
                            onEnded={() => setCurrentPlayingId(null)}
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
                      {/* Play Button Overlay - Always visible */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          onClick={() => handleExamplePlayPause(music.id)}
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
                        ref={(el) => {
                          if (el) {
                            exampleAudioElements.set(music.id, el);
                          }
                        }}
                        src={music.audioUrl}
                        onEnded={() => setExamplePlayingId(null)}
                        className="hidden"
                      />
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-3">
                      {/* Title */}
                      <h3 className="text-white font-medium text-sm line-clamp-1">
                        {music.title || "Untitled"}
                      </h3>

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
                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button
                              onClick={() => handlePlayPause(music.id)}
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
                              ref={(el) => {
                                if (el) {
                                  audioElements.set(music.id, el);
                                }
                              }}
                              src={music.audioUrl}
                              onEnded={() => setCurrentPlayingId(null)}
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
                        </>
                      ) : (
                        <>
                          <span>Generate Music</span>
                          <span className="font-bold">{requiredCreditsForMusicWithLyrics}</span>
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

