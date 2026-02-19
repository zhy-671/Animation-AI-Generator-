"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Edit2, Trash2, X, Loader2, Video, Music, Sparkles, Image as ImageIcon, Film, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CharacterEditModal from "@/components/storyboard/character-edit-modal";
import { useToast } from "@/components/ui/toast-notification";
import { createClient } from "@/lib/supabase/client";

interface Character {
  id: string;
  name: string;
  imageUrl: string | null;
  description: string;
}

interface CharacterDetail {
  id: string;
  name: string;
  role: string;
  age: string;
  gender: string;
  appearance: {
    hair_color: string;
    eye_color: string;
    hair_style: string;
    height: string;
    build: string;
    skin_tone: string;
    facial_features: string;
    distinct_marks: string;
  };
  clothing: {
    style: string;
    accessories: string;
    footwear: string;
  };
  personality: string;
  background: string;
  skills_abilities?: string[];
  relationships?: string[];
  visual_reference_prompt?: string;
  pose_references?: string[];
  imageUrl?: string | null;
  imageGenerationPrompt?: string;
}

type VoiceType = 'male' | 'female' | 'duet';

interface MusicInfo {
  id: string;
  title: string;
  prompt: string;
  audioUrl: string | null;
  coverUrl: string | null;
  duration: string;
  lyrics?: string | null;
  metadata?: any;
  voiceType?: VoiceType | null;
  instrumental?: boolean;
}

interface StoryboardItem {
  id: string;
  scene_number: number;
  text: string;
  scene_detail?: string;
  image_url?: string | null;
  video_url?: string | null;
}

interface Storyboard {
  id: string;
  title: string;
  summary: string;
  items: StoryboardItem[];
}

// 视觉风格选项
const visualStyles = [
  { value: "2d", label: "2D Animation", image: "/images/2D-animation-style.png" },
  { value: "3d", label: "3D Animation", image: "/images/3D-animation-style.png" },
  { value: "anime", label: "Japanese Anime", image: "/images/Japanese-animation.png" },
  { value: "cyberpunk", label: "Cyberpunk", image: "/images/cyberpunk-style.png" },
  { value: "clay", label: "Clay Animation", image: "/images/clay-animation-style.png" },
  { value: "comic", label: "Comic Book", image: "/images/comic-book-style.png" },
  { value: "cartoon", label: "Cartoon Style", image: "/images/cartoon.png" },
  { value: "realistic", label: "3D Cartoon", image: "/images/3d-cartoon.png" },
];

// 场景描述选项
const sceneDescriptions: Record<string, string> = {
  "Nightclub": "An empty neon-lit nightclub with colorful lights and reflective floors, no people.",
  "City Street": "A quiet city street at night with neon signs and wet reflections, empty and calm.",
  "Forest": "A serene forest with tall trees, sunlight filtering through leaves, misty and empty.",
  "City Skyline": "A panoramic city skyline at sunset, tall buildings glowing, no people or traffic.",
  "Recording Studio": "An empty recording studio with microphones and mixing console, warm ambient lighting.",
  "Concert Stage": "A large concert stage with bright spotlights and smoke, no performers or audience.",
  "Beach Sunset": "A peaceful beach at sunset with golden sand and gentle waves, empty and tranquil.",
  "Desert Dunes": "Expansive desert dunes under a warm sunset, rolling sand hills, no people.",
  "Futuristic City": "A cyberpunk futuristic city at night with neon signs and high-tech buildings, empty streets.",
  "Bedroom": "A simple empty bedroom with bed and desk, soft natural lighting, no people.",
  "Subway Station": "An empty underground subway station with trains and tiled walls, dim lighting.",
  "Carnival": "A quiet carnival at dusk with colorful lights, ferris wheel, no visitors.",
  "Mountain Cliff": "A dramatic mountain cliff with wide view, rugged rocks, windy and empty.",
  "Bridge Overpass": "A city bridge overpass at night with illuminated structure and street lights, no cars or people.",
};

export default function MusicVideoPage() {
  const params = useParams();
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const musicId = params.musicId as string;

  const [musicInfo, setMusicInfo] = useState<MusicInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterDetails, setCharacterDetails] = useState<Map<string, CharacterDetail>>(new Map());
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingCharacterDetail, setEditingCharacterDetail] = useState<CharacterDetail | null>(null);
  const [visualStyle, setVisualStyle] = useState("2d");
  const [artSetting, setArtSetting] = useState("16:9");
  const [sceneDescription, setSceneDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState("");

  useEffect(() => {
    if (musicId) {
      loadMusicInfo();

    }
  }, [musicId]);

  const loadMusicInfo = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: music, error } = await supabase
        .from('anim_music')
        .select('*')
        .eq('id', musicId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load music: ${error.message}`);
      }

      if (!music) {
        showError("Music not found");
        router.push('/ai-music-video-generator');
        return;
      }

      const lyricsText = music.metadata?.lyrics || null;
      const voiceType = (music.voice_type || null) as VoiceType | null;
      const instrumental = !!music.instrumental;
      
      setMusicInfo({
        id: music.id,
        title: music.title || music.prompt,
        prompt: music.prompt,
        audioUrl: music.audio_url,
        coverUrl: music.cover_url,
        duration: music.duration,
        lyrics: lyricsText,
        metadata: music.metadata,
        voiceType,
        instrumental,
      });
      
      setEditedLyrics(lyricsText || "");
      
      // 加载角色数据
      await loadCharacters();
      
      // 加载分镜数据
      await loadStoryboard();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to load music");
      router.push('/ai-music-video-generator');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCharacters = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // 从 music_video_characters 表加载角色
      const { data: charactersData, error } = await supabase
        .from('music_video_characters')
        .select('*')
        .eq('music_id', musicId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Failed to load characters:", error);
        return;
      }

      if (charactersData && charactersData.length > 0) {
        const loadedCharacters: Character[] = charactersData.map((char: any) => ({
          id: char.id,
          name: char.name || "Unnamed Character",
          imageUrl: char.image_url,
          description: char.description || "",
        }));

        const loadedDetails = new Map<string, CharacterDetail>();
        charactersData.forEach((char: any) => {
          if (char.character_data) {
            const charData = typeof char.character_data === 'string' 
              ? JSON.parse(char.character_data) 
              : char.character_data;
            loadedDetails.set(char.id, {
              ...charData,
              imageUrl: char.image_url,
            });
          }
        });

        setCharacters(loadedCharacters);
        setCharacterDetails(loadedDetails);
      }
    } catch (error) {
      console.error("Error loading characters:", error);
    }
  };

  const handleAddCharacter = () => {
    const newId = `char-${Date.now()}`;
    const newCharacter: Character = {
      id: newId,
      name: "New Character",
      imageUrl: null,
      description: "",
    };

    const newCharacterDetail: CharacterDetail = {
      id: newId,
      name: "New Character",
      role: "",
      age: "",
      gender: "",
      appearance: {
        hair_color: "",
        eye_color: "",
        hair_style: "",
        height: "",
        build: "",
        skin_tone: "",
        facial_features: "",
        distinct_marks: "",
      },
      clothing: {
        style: "",
        accessories: "",
        footwear: "",
      },
      personality: "",
      background: "",
    };

    setCharacters([...characters, newCharacter]);
    setCharacterDetails(new Map(characterDetails).set(newId, newCharacterDetail));
    setEditingCharacterId(newId);
    setEditingCharacterDetail(newCharacterDetail);
  };

  const handleEditCharacter = (characterId: string) => {
    setEditingCharacterId(characterId);
    const detail = characterDetails.get(characterId);
    setEditingCharacterDetail(detail || null);
  };

  const handleDeleteCharacter = async (characterId: string) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // 从数据库删除
      const { error } = await supabase
        .from('music_video_characters')
        .delete()
        .eq('id', characterId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(`Failed to delete character: ${error.message}`);
      }

      // 从状态中删除
      setCharacters(characters.filter(c => c.id !== characterId));
      const newDetails = new Map(characterDetails);
      newDetails.delete(characterId);
      setCharacterDetails(newDetails);

      showSuccess("Character deleted successfully");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to delete character");
    }
  };

  const handleSaveCharacter = async (character: CharacterDetail) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const characterData: CharacterDetail = {
        ...character,
        imageUrl: character.imageUrl || null,
        imageGenerationPrompt: character.imageGenerationPrompt || undefined,
      };

      // 检查角色是否已存在
      const existingCharacter = characters.find(c => c.id === character.id);
      
      const characterRecord = {
        music_id: musicId,
        user_id: user.id,
        name: character.name,
        image_url: character.imageUrl || null,
        description: character.role || "",
        character_data: characterData,
      };

      if (existingCharacter) {
        // 更新现有角色
        const { error } = await supabase
          .from('music_video_characters')
          .update(characterRecord)
          .eq('id', character.id)
          .eq('user_id', user.id);

        if (error) {
          throw new Error(`Failed to update character: ${error.message}`);
        }

        // 更新状态
        setCharacters(characters.map(c => 
          c.id === character.id 
            ? { ...c, name: character.name, imageUrl: character.imageUrl || null }
            : c
        ));
      } else {
        // 创建新角色
        const { data, error } = await supabase
          .from('music_video_characters')
          .insert({
            ...characterRecord,
            id: character.id,
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create character: ${error.message}`);
        }

        // 添加到状态
        setCharacters([...characters, {
          id: character.id,
          name: character.name,
          imageUrl: character.imageUrl || null,
          description: character.role || "",
        }]);
      }

      // 更新角色详情
      const newDetails = new Map(characterDetails);
      newDetails.set(character.id, characterData);
      setCharacterDetails(newDetails);

      setEditingCharacterId(null);
      setEditingCharacterDetail(null);
      showSuccess("Character saved successfully");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to save character");
    }
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `music-video-characters/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('anim-assets')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('anim-assets')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error("Image upload error:", error);
      return null;
    }
  };

  const handleImageGenerate = async (prompt: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/scenes/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          sceneLocation: "",
          project_id: null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const result = await response.json();
      if (result.success && result.images && result.images.length > 0) {
        return result.images[0];
      }
      return null;
    } catch (error) {
      console.error("Image generation error:", error);
      return null;
    }
  };

  const handleImageUploadFromUrl = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/scenes/upload-image-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      });

      if (!response.ok) {
        throw new Error("Failed to upload image from URL");
      }

      const result = await response.json();
      return result.imageUrl || null;
    } catch (error) {
      console.error("Image upload from URL error:", error);
      return null;
    }
  };

  const loadStoryboard = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // 查找与音乐关联的分镜（通过 metadata 中的 music_id）
      const { data: scenes, error } = await supabase
        .from('anim_scenes')
        .select('*')
        .eq('user_id', user.id)
        .eq('metadata->>music_id', musicId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error("Failed to load storyboard:", error);
        return;
      }

      if (scenes && scenes.length > 0) {
        const scene = scenes[0];
        
        // 加载分镜项
        const { data: items, error: itemsError } = await supabase
          .from('anim_scene_items')
          .select('*')
          .eq('scene_id', scene.id)
          .order('scene_number', { ascending: true });

        if (itemsError) {
          console.error("Failed to load storyboard items:", itemsError);
          return;
        }

        setStoryboard({
          id: scene.id,
          title: scene.title,
          summary: scene.summary,
          items: items || [],
        });
      }
    } catch (error) {
      console.error("Error loading storyboard:", error);
    }
  };

  const handleSaveLyrics = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { error } = await supabase
        .from('anim_music')
        .update({
          metadata: {
            ...(musicInfo?.metadata || {}),
            lyrics: editedLyrics,
          },
        })
        .eq('id', musicId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(`Failed to save lyrics: ${error.message}`);
      }

      setMusicInfo(prev => prev ? {
        ...prev,
        lyrics: editedLyrics,
        metadata: {
          ...(prev.metadata || {}),
          lyrics: editedLyrics,
        },
      } : null);
      
      setIsEditingLyrics(false);
      showSuccess("Lyrics saved successfully");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to save lyrics");
    }
  };

  const handleGenerateStoryboard = async () => {
    if (!musicInfo) {
      showError("Music information not loaded");
      return;
    }

    if (characters.length === 0) {
      showError("Please add at least one character");
      return;
    }

    setIsGeneratingStoryboard(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        showError("User not authenticated");
        return;
      }

      // 构建生成分镜的 prompt
      let lyricsText = musicInfo.lyrics || musicInfo.prompt;
      
      // 如果有场景描述，追加到 prompt 中
      if (sceneDescription) {
        lyricsText = `${lyricsText}\n\n场景设置：${sceneDescription}`;
      }
      
      // 如果有角色信息，追加到 prompt 中
      if (characters.length > 0) {
        const charactersInfo = Array.from(characterDetails.values()).map(char => ({
          name: char.name,
          role: char.role,
          appearance: char.appearance,
          personality: char.personality,
        }));
        const charactersText = charactersInfo.map(char => 
          `角色：${char.name}（${char.role}），${JSON.stringify(char.appearance)}，性格：${char.personality}`
        ).join('\n');
        lyricsText = `${lyricsText}\n\n角色信息：\n${charactersText}`;
      }

      // 获取 artSetting 并传入
      const artSettingValue = artSetting;

      // 调用生成分镜 API
      console.log("=== Generating music storyboard ===", {
        musicId,
        visualStyle,
        artSetting: artSettingValue,
        sceneDescription,
        charactersCount: characters.length,
        promptPreview: lyricsText.slice(0, 500),
      });

      const formData = new FormData();
      formData.append('prompt', lyricsText);
      formData.append('style', visualStyle);
      
      if (artSettingValue) {
        formData.append('artSetting', artSettingValue);
      }

      const response = await fetch('/api/music-video/storyboard', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate storyboard');
      }

      const result = await response.json();
      console.log("=== Storyboard generation response ===", result);
      
      if (result.success && result.sceneId) {
        // 更新分镜的 metadata，添加 music_id
        const { data: sceneData } = await supabase
          .from('anim_scenes')
          .select('metadata')
          .eq('id', result.sceneId)
          .single();
        
        await supabase
          .from('anim_scenes')
          .update({
            metadata: {
              ...(sceneData?.metadata || {}),
              music_id: musicId,
            },
          })
          .eq('id', result.sceneId);

        // 重新加载分镜
        await loadStoryboard();
        showSuccess("分镜生成成功");
      } else {
        throw new Error(result.error || "Failed to generate storyboard");
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to generate storyboard");
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (characters.length === 0) {
      showError("Please add at least one character");
      return;
    }

    setIsGenerating(true);
    try {
      // TODO: 实现视频生成逻辑
      showSuccess("Video generation started");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to generate video");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDA2A]" />
      </div>
    );
  }

  if (!musicInfo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      <Header />
      <div className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/ai-music-video-generator')}
            className="text-gray-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gray-700 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
              {musicInfo.coverUrl ? (
                <img src={musicInfo.coverUrl} alt={musicInfo.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                  <Music className="w-7 h-7 text-gray-400" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{musicInfo.title}</h1>
              <p className="text-gray-400 text-sm">{musicInfo.prompt}</p>
            </div>
          </div>
        </div>

        {/* Main Content: Left and Right Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar: Configuration */}
          <div className="lg:col-span-1 space-y-6">
            {/* Characters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-[#FFDA2A]" />
                  角色设计
                </h3>
                <Button
                  onClick={handleAddCharacter}
                  size="sm"
                  className="bg-[#FFDA2A] text-gray-900 hover:bg-[#FFDA2A]/90 h-8 px-3"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  添加
                </Button>
              </div>

              {characters.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Video className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">暂无角色，点击添加按钮创建</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {characters.map((character) => (
                    <motion.div
                      key={character.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gray-900/50 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                          {character.imageUrl ? (
                            <img
                              src={character.imageUrl}
                              alt={character.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-6 h-6 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate">{character.name}</h4>
                          <p className="text-gray-400 text-xs truncate">{character.description || "无描述"}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCharacter(character.id)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCharacter(character.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Visual Style */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Film className="w-5 h-5 text-[#FFDA2A]" />
                视觉风格
              </h3>
              <Select value={visualStyle} onValueChange={setVisualStyle}>
                <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white h-12 hover:border-gray-600 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {visualStyles.map((style) => (
                    <SelectItem key={style.value} value={style.value} className="hover:bg-gray-700">
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>

            {/* Aspect Ratio */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Video className="w-5 h-5 text-[#FFDA2A]" />
                视频比例
              </h3>
              <Select value={artSetting} onValueChange={setArtSetting}>
                <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white h-12 hover:border-gray-600 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="16:9" className="hover:bg-gray-700">16:9 (横屏)</SelectItem>
                  <SelectItem value="9:16" className="hover:bg-gray-700">9:16 (竖屏)</SelectItem>
                  <SelectItem value="1:1" className="hover:bg-gray-700">1:1 (方形)</SelectItem>
                </SelectContent>
              </Select>
            </motion.div>

            {/* Scene Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#FFDA2A]" />
                场景描述
              </h3>
              <Textarea
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
                placeholder="输入场景描述，例如：海边、城市街道、森林等..."
                className="bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500 min-h-[120px] resize-none focus:border-[#FFDA2A]/50 focus:ring-1 focus:ring-[#FFDA2A]/50 mb-4"
              />
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSceneDescription(sceneDescriptions["Nightclub"])}
                  className="group relative bg-gray-900/50 border border-gray-700 rounded-xl p-4 hover:border-[#FFDA2A]/50 hover:bg-gray-900/70 transition-all overflow-hidden"
                >
                  <div className="aspect-video w-full bg-gray-800 rounded-lg overflow-hidden mb-3">
                    <img
                      src="/images/nightclub.png"
                      alt="Nightclub"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <p className="text-white text-sm font-medium text-center">Nightclub</p>
                </button>
                <button
                  onClick={() => setSceneDescription(sceneDescriptions["Recording Studio"])}
                  className="group relative bg-gray-900/50 border border-gray-700 rounded-xl p-4 hover:border-[#FFDA2A]/50 hover:bg-gray-900/70 transition-all overflow-hidden"
                >
                  <div className="aspect-video w-full bg-gray-800 rounded-lg overflow-hidden mb-3">
                    <img
                      src="/images/recording-studio.png"
                      alt="Recording Studio"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <p className="text-white text-sm font-medium text-center">Recording Studio</p>
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right Side: Storyboard or Lyrics */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl h-full"
            >
              {storyboard && storyboard.items.length > 0 ? (
                /* Storyboard List */
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Film className="w-5 h-5 text-[#FFDA2A]" />
                      分镜列表
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStoryboard(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4 mr-1" />
                      清除
                    </Button>
                  </div>
                  <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                    {storyboard.items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-gray-900/50 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-24 h-24 bg-gray-800 rounded-lg overflow-hidden">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={`Scene ${item.scene_number}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-[#FFDA2A] bg-[#FFDA2A]/10 px-2 py-1 rounded">
                                分镜 {item.scene_number}
                              </span>
                            </div>
                            <p className="text-white text-sm mb-2 line-clamp-2">{item.text}</p>
                            {item.scene_detail && (
                              <p className="text-gray-400 text-xs line-clamp-2">{item.scene_detail}</p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Lyrics Display */
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Music className="w-5 h-5 text-[#FFDA2A]" />
                      歌词
                    </h3>
                    {!isEditingLyrics && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditingLyrics(true);
                          setEditedLyrics(musicInfo?.lyrics || "");
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        编辑
                      </Button>
                    )}
                  </div>
                  
                  <AnimatePresence mode="wait">
                    {isEditingLyrics ? (
                      <motion.div
                        key="editing"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <Textarea
                          value={editedLyrics}
                          onChange={(e) => setEditedLyrics(e.target.value)}
                          placeholder="输入歌词..."
                          className="bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500 min-h-[400px] resize-none focus:border-[#FFDA2A]/50 focus:ring-1 focus:ring-[#FFDA2A]/50"
                        />
                        <div className="flex gap-3">
                          <Button
                            onClick={handleSaveLyrics}
                            className="bg-[#FFDA2A] text-gray-900 hover:bg-[#FFDA2A]/90"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            保存
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setIsEditingLyrics(false);
                              setEditedLyrics(musicInfo?.lyrics || "");
                            }}
                            className="text-gray-400 hover:text-white"
                          >
                            取消
                          </Button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="display"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-gray-900/50 rounded-xl p-6 border border-gray-700 min-h-[400px]"
                      >
                        {musicInfo?.lyrics ? (
                          <p className="text-white whitespace-pre-wrap leading-relaxed">{musicInfo.lyrics}</p>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Music className="w-12 h-12 mb-4 opacity-50" />
                            <p>暂无歌词</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Generate Storyboard Button */}
                  <div className="mt-6 pt-6 border-t border-gray-700">
                    <Button
                      onClick={handleGenerateStoryboard}
                      disabled={isGeneratingStoryboard || characters.length === 0 || !musicInfo?.lyrics}
                      className="w-full bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-semibold h-12 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingStoryboard ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          生成分镜
                        </>
                      )}
                    </Button>
                    {characters.length === 0 && (
                      <p className="text-xs text-gray-500 mt-2 text-center">请先添加至少一个角色</p>
                    )}
                    {!musicInfo?.lyrics && (
                      <p className="text-xs text-gray-500 mt-2 text-center">请先添加歌词</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Character Edit Modal */}
      {editingCharacterDetail && (
        <CharacterEditModal
          character={editingCharacterDetail}
          isOpen={editingCharacterId !== null}
          onClose={() => {
            setEditingCharacterId(null);
            setEditingCharacterDetail(null);
          }}
          onSave={handleSaveCharacter}
          onImageUpload={handleImageUpload}
          onImageGenerate={handleImageGenerate}
          onImageUploadFromUrl={handleImageUploadFromUrl}
          initialImageUrl={editingCharacterDetail.imageUrl || null}
          visualStyle={visualStyle}
          artSetting={artSetting}
        />
      )}

      <Footer />
    </div>
  );
}


