"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Diamond, Upload, Image as ImageIcon, Loader2, Type, Sparkles, Wand2, Palette, Film, CheckCircle2, Video, Download, ChevronDown, Plus, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AudioSegment {
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
}

interface StoryboardScene {
  sceneId: number;
  timeRange: [number, number];
  scenePurpose?: string;
  environment?: string;
  shots?: any[];
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

interface MVCustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audioUrl: string;
  startTime: number;
  endTime: number;
  musicTitle?: string;
  musicId?: string;
  sceneDescription?: string; // 场景描述
  musicFeatures?: {
    bpm?: number;
    key?: string;
    beats?: number[];
    loudnessCurve?: Array<{ time: number; value: number }>;
    energySegments?: Array<{ start: number; end: number; energy: number }>;
  };
  autoSegments?: AudioSegment[]; // 音频片段列表
  selectedSegmentIndex?: number | null; // 选中的片段索引
  storyboard?: Storyboard; // 分镜数据（可选）
  onBack?: () => void;
  onGenerate?: (params: {
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
    characterImageUrl?: string; // 角色图片URL
    musicFeatures?: {
      bpm?: number;
      key?: string;
      beats?: number[];
      loudnessCurve?: Array<{ time: number; value: number }>;
      energySegments?: Array<{ start: number; end: number; energy: number }>;
    };
    autoSegments?: AudioSegment[]; // 音频段数据，包含shotPlan
  }) => void;
}

export default function MVCustomizeDialog({
  open,
  onOpenChange,
  audioUrl,
  startTime,
  endTime,
  musicTitle,
  musicId,
  sceneDescription,
  musicFeatures,
  autoSegments = [],
  selectedSegmentIndex = null,
  storyboard,
  onBack,
  onGenerate,
}: MVCustomizeDialogProps) {
  const [mvType, setMvType] = useState<'narrative' | 'dance'>('narrative');
  const [visualStyle, setVisualStyle] = useState<string>('realistic-photography');
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [orientation, setOrientation] = useState<'16:9' | '9:16'>('16:9');
  const [inspiration, setInspiration] = useState('');
  
  // 角色设置相关状态
  const [characterMode, setCharacterMode] = useState<'text' | 'image'>('text'); // 文生图或图生图
  const [characterPrompt, setCharacterPrompt] = useState(''); // 角色描述文本
  const [uploadedImage, setUploadedImage] = useState<string | null>(null); // 上传的图片URL
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null); // 上传的图片文件
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([]); // 生成的图片URL数组
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null); // 选中的图片URL
  const [isGenerating, setIsGenerating] = useState(false); // 是否正在生成
  const [isUploading, setIsUploading] = useState(false); // 是否正在上传
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false); // 是否正在生成视频
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null); // 生成的视频URL
  const [generatingVideoShotIndex, setGeneratingVideoShotIndex] = useState<number | null>(null); // 正在生成视频的分镜索引
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inspirationRef = useRef<HTMLDivElement>(null); // 引用"添加我的灵感"区域
  
  // 音频片段选择状态
  const [selectAllSegments, setSelectAllSegments] = useState(true); // 默认选择全部
  const [selectedSegmentForStoryboard, setSelectedSegmentForStoryboard] = useState<number | null>(selectedSegmentIndex); // 选中的片段索引（用于分镜展示）
  
  // 场景图片状态 - 场景可以有自己的图片
  const [sceneImages, setSceneImages] = useState<Record<number, string | null>>({}); // 场景索引 -> 图片URL
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null); // 正在编辑的场景索引
  
  // 分镜图片状态 - 每个分镜可以有自己的图片
  const [shotImages, setShotImages] = useState<Record<number, string | null>>({}); // 分镜索引 -> 图片URL
  const [shotVideos, setShotVideos] = useState<Record<number, string | null>>({}); // 分镜索引 -> 无口型视频URL（Sora生成）
  const [shotLipSyncVideos, setShotLipSyncVideos] = useState<Record<number, string | null>>({}); // 分镜索引 -> 对口型视频URL（可灵生成）
  const [videoDialogShotIndex, setVideoDialogShotIndex] = useState<number | null>(null); // 当前预览视频的分镜索引
  const [editingShotIndex, setEditingShotIndex] = useState<number | null>(null); // 正在编辑的分镜索引
  const [showImageSelectDialog, setShowImageSelectDialog] = useState(false); // 显示图片选择对话框
  
  // 场景编辑状态
  const [editingSceneTextIndex, setEditingSceneTextIndex] = useState<number | null>(null); // 正在编辑文本的场景索引
  const [sceneDescriptions, setSceneDescriptions] = useState<Record<number, {
    scenePurpose: string;
    environment: string;
    sceneDescription: string;
  }>>({}); // 场景索引 -> 描述内容
  
  // 分镜编辑状态
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null); // 正在编辑文本的分镜索引
  const [shotDescriptions, setShotDescriptions] = useState<Record<number, {
    camera?: string;
    performance?: string;
    emotion?: string;
    prompt?: string;
    shotPlan?: {
      shotSize?: string;
      cameraAngle?: string;
      framingRule?: string;
      cameraMotion?: string;
      shotPurpose?: string;
      cutContinuity?: string;
    };
    sceneDescription?: string;
    characters?: string;
    narration?: string;
  }>>({}); // 分镜索引 -> 描述内容
  
  // 数据加载状态
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSavingData, setIsSavingData] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 格式化时间函数
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 保存数据到数据库
  const saveVideoData = useCallback(async () => {
    if (!musicId || isSavingData) return;
    
    setIsSavingData(true);
    
    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 延迟保存，避免频繁请求
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/music/save-video-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            musicId,
            audioSegments: autoSegments,
            storyboard: storyboard || null,
            sceneData: {
              images: sceneImages,
              descriptions: sceneDescriptions,
            },
            shotData: {
              images: shotImages,
              descriptions: shotDescriptions,
              videos: shotVideos, // 保存无口型视频
              lipSyncVideos: shotLipSyncVideos, // 保存对口型视频
            },
            visualStyle,
            orientation,
            characterImageUrl: selectedImageUrl,
          }),
        });
        
        if (!response.ok) {
          throw new Error('保存失败');
        }
        
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || '保存失败');
        }
      } catch (error) {
        console.error('Error saving video data:', error);
        // 不显示错误提示，避免打扰用户
      } finally {
        setIsSavingData(false);
      }
    }, 1000); // 1秒后保存
  }, [
    musicId,
    autoSegments,
    storyboard,
    sceneImages,
    sceneDescriptions,
    shotImages,
    shotDescriptions,
    visualStyle,
    orientation,
    selectedImageUrl,
    isSavingData,
  ]);
  
  // 加载已保存的数据
  useEffect(() => {
    if (!open || !musicId) return;
    
    const loadVideoData = async () => {
      setIsLoadingData(true);
      try {
        const response = await fetch(`/api/music/save-video-data?musicId=${musicId}`);
        
        if (!response.ok) {
          throw new Error('加载失败');
        }
        
        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          
          // 加载场景数据
          if (data.scene_data?.images) {
            setSceneImages(data.scene_data.images);
          }
          if (data.scene_data?.descriptions) {
            setSceneDescriptions(data.scene_data.descriptions);
          }
          
          // 加载分镜数据
          if (data.shot_data?.images) {
            setShotImages(data.shot_data.images);
          }
          if (data.shot_data?.descriptions) {
            setShotDescriptions(data.shot_data.descriptions);
          }
          if (data.shot_data?.videos) {
            setShotVideos(data.shot_data.videos);
          }
          if (data.shot_data?.lipSyncVideos) {
            setShotLipSyncVideos(data.shot_data.lipSyncVideos);
          }
          
          // 加载其他配置
          if (data.visual_style) {
            setVisualStyle(data.visual_style);
          }
          if (data.orientation) {
            setOrientation(data.orientation as '16:9' | '9:16');
          }
          if (data.character_image_url) {
            setSelectedImageUrl(data.character_image_url);
          }
        }
      } catch (error) {
        console.error('Error loading video data:', error);
        // 加载失败不影响使用，继续使用默认值
      } finally {
        setIsLoadingData(false);
      }
    };
    
    loadVideoData();
  }, [open, musicId]);
  
  // 当数据变化时自动保存
  useEffect(() => {
    if (!open || !musicId || isLoadingData) return;
    saveVideoData();
  }, [
    sceneImages,
    sceneDescriptions,
    shotImages,
    shotDescriptions,
    visualStyle,
    orientation,
    selectedImageUrl,
    open,
    musicId,
    isLoadingData,
    saveVideoData,
  ]);
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  
  // 获取场景列表（只返回一个场景）
  const getScenes = (): StoryboardScene[] => {
    if (storyboard && storyboard.scenes && storyboard.scenes.length > 0) {
      // 如果有 storyboard 数据，只返回第一个场景
      return [storyboard.scenes[0]];
    }
    // 如果没有 storyboard，基于 autoSegments 创建第一个场景
    if (autoSegments.length > 0) {
      const firstSegment = autoSegments[0];
      return [{
        sceneId: 1,
        timeRange: [firstSegment.start, firstSegment.end] as [number, number],
        scenePurpose: sceneDescription || `场景 1`,
        environment: '待设置',
        shots: []
      }];
    }
    return [];
  };

  // 获取要展示的分镜列表 - 使用 useCallback 避免每次渲染都重新创建函数
  const getStoryboardSegments = useCallback((): AudioSegment[] => {
    if (selectAllSegments) {
      // 选择全部，按顺序展示所有片段
      return autoSegments;
    } else if (selectedSegmentForStoryboard !== null && autoSegments[selectedSegmentForStoryboard]) {
      // 选择单个片段，当前片段第一位，其余按顺序排列
      const selected = autoSegments[selectedSegmentForStoryboard];
      const others = autoSegments.filter((_, index) => index !== selectedSegmentForStoryboard);
      return [selected, ...others];
    }
    // 如果没有片段，返回空数组
    return [];
  }, [autoSegments, selectAllSegments, selectedSegmentForStoryboard]);
  
  const scenes = getScenes();
  
  // 使用 useMemo 缓存 storyboardSegments，避免每次渲染都重新计算
  const storyboardSegments = useMemo(() => {
    return getStoryboardSegments();
  }, [getStoryboardSegments]);
  
  // 移除会导致无限循环的 useEffect，只在开发环境需要时打印
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
      console.log('[mv-customize] 分镜列表状态', {
        autoSegmentsLength: autoSegments.length,
        storyboardSegmentsLength: storyboardSegments.length,
        selectAllSegments,
        selectedSegmentForStoryboard,
      });
    }, [autoSegments.length, storyboardSegments.length, selectAllSegments, selectedSegmentForStoryboard]);
  }
  
  // 处理图片选择
  const handleShotImageClick = (shotIndex: number) => {
    setEditingShotIndex(shotIndex);
    
    // 获取当前分镜对应的segment
    const storyboardSegments = getStoryboardSegments();
    const segment = storyboardSegments[shotIndex];
    
    // 检查是否有场景图片（场景索引为0）
    const sceneImage = sceneImages[0];
    
    // 构建提示词：将景别、视角、构图规则合并成一句话
    let promptText = '';
    if (segment?.videoPrompt?.shotPlan) {
      const shotPlan = segment.videoPrompt.shotPlan;
      const parts = [];
      if (shotPlan.shotSize) parts.push(shotPlan.shotSize);
      if (shotPlan.cameraAngle) parts.push(shotPlan.cameraAngle);
      if (shotPlan.framingRule) parts.push(shotPlan.framingRule);
      if (parts.length > 0) {
        // 合并成一句话，用逗号分隔
        promptText = parts.join(', ');
      }
    }
    
    // 如果有场景图片，切换到图生图模式
    if (sceneImage) {
      setCharacterMode('image');
      // 不自动设置uploadedImage，让用户可以上传人物图
      setUploadedImage(null);
      setUploadedImageFile(null);
      // 如果有场景图，在提示词中添加 @场景 和 @人物
      if (promptText) {
        setCharacterPrompt(`@场景 ${promptText} @人物`);
      } else {
        setCharacterPrompt('@场景 @人物');
      }
    } else {
      setCharacterMode('text');
      setUploadedImage(null);
      setUploadedImageFile(null);
      // 设置提示词
      setCharacterPrompt(promptText);
    }
    
    // 清空之前生成的图片
    setGeneratedImageUrls([]);
    setSelectedImageUrl(null);
    
    setShowImageSelectDialog(true);
  };
  
  // 处理场景图片选择
  const handleSceneImageClick = (sceneIndex: number) => {
    setEditingSceneIndex(sceneIndex);
    setShowImageSelectDialog(true);
  };

  // 处理图片选择完成
  const handleImageSelected = (imageUrl: string) => {
    if (editingSceneIndex !== null) {
      // 场景图片
      setSceneImages(prev => ({
        ...prev,
        [editingSceneIndex]: imageUrl
      }));
      setSelectedImageUrl(imageUrl);
      setEditingSceneIndex(null);
      setShowImageSelectDialog(false);
    } else if (editingShotIndex !== null) {
      // 分镜图片
      setShotImages(prev => ({
        ...prev,
        [editingShotIndex]: imageUrl
      }));
      setSelectedImageUrl(imageUrl);
      setEditingShotIndex(null);
      setShowImageSelectDialog(false);
    }
  };

  const visualStyles = [
    { id: 'realistic-photography', label: 'Realistic Photography', image: '/images/styles/realistic-photography.jpg', gradient: 'from-gray-800 via-gray-700 to-gray-800' },
    { id: 'cyberpunk', label: 'Cyberpunk', image: '/images/styles/cyberpunk.jpg', gradient: 'from-purple-600 via-pink-600 to-blue-600' },
    { id: 'trendy-illustration', label: 'Trendy Illustration', image: '/images/styles/trendy-illustration.jpg', gradient: 'from-pink-400 via-rose-400 to-orange-400' },
    { id: 'chibi-character', label: 'Chibi Character', image: '/images/styles/chibi-character.jpg', gradient: 'from-yellow-300 via-pink-300 to-purple-300' },
    { id: '3d-character', label: '3D Character', image: '/images/styles/3d-character.jpg', gradient: 'from-blue-500 via-cyan-500 to-teal-500' },
  ];

  // 处理图片上传
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }

    setIsUploading(true);
    try {
      // 先显示预览
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setUploadedImageFile(file);

      // 上传到服务器
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/scenes/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('上传失败');
      }

      const result = await response.json();
      if (result.success && result.data?.url) {
        setUploadedImage(result.data.url);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('图片上传失败，请重试');
      setUploadedImage(null);
      setUploadedImageFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  // 生成角色图片
  const handleGenerateCharacter = async () => {
    if (characterMode === 'text' && !characterPrompt.trim()) {
      alert('请输入角色描述');
      return;
    }

    // 在Image to Image模式下，如果有场景图或上传图，则可以使用
    // 如果没有场景图也没有上传图，则提示用户
    if (characterMode === 'image' && !uploadedImage && !(editingShotIndex !== null && sceneImages[0])) {
      alert('请先上传参考图片或设置场景图片');
      return;
    }

    setIsGenerating(true);
    try {
      let imageUrls: string[] = [];

      // 根据当前选择的比例，确定生成图片的尺寸
      const imageSize = orientation === '16:9' ? '1920*1080' : '1080*1920';

      if (characterMode === 'text') {
        // 文生图 - 生成4张图片
        const response = await fetch('/api/scenes/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: characterPrompt,
            count: 4, // 生成4张图片
            size: imageSize, // 按当前比例生成
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `生成失败: ${response.status}`);
        }

        const result = await response.json();
        console.log('[GenerateCharacter] API response:', result);
        
        // 处理不同的返回格式
        if (result.success && result.data) {
          // 格式1: data.images 数组（豆包API返回格式）
          if (result.data.images && Array.isArray(result.data.images) && result.data.images.length > 0) {
            imageUrls = result.data.images;
            setGeneratedImageUrls(imageUrls);
            // 默认选中第一张
            if (imageUrls.length > 0) {
              setSelectedImageUrl(imageUrls[0]);
            }
          }
          // 格式2: data.imageUrl 单个URL
          else if (result.data.imageUrl) {
            imageUrls = [result.data.imageUrl];
            setGeneratedImageUrls(imageUrls);
            setSelectedImageUrl(result.data.imageUrl);
          }
          // 格式3: data.imageUrls 数组
          else if (result.data.imageUrls && Array.isArray(result.data.imageUrls) && result.data.imageUrls.length > 0) {
            imageUrls = result.data.imageUrls;
            setGeneratedImageUrls(imageUrls);
            if (imageUrls.length > 0) {
              setSelectedImageUrl(imageUrls[0]);
            }
          }
          else {
            console.error('[GenerateCharacter] Unexpected response format:', result);
            throw new Error('生成失败：未返回图片（返回格式不正确）');
          }
        } else {
          throw new Error(result.error || '生成失败：未返回图片');
        }
        } else {
        // 图生图 - 使用文生图API的refImg参数
        const hasSceneImage = editingShotIndex !== null && sceneImages[0];
        const hasCharacterImage = uploadedImage;
        
        if (!hasSceneImage && !hasCharacterImage) {
          throw new Error('请先上传参考图片或设置场景图片');
        }

        // 处理提示词：如果有@场景和@人物，需要分别处理
        let finalPrompt = characterPrompt || 'Generate character image based on reference';
        let sceneRefImg = null;
        let characterRefImg = null;
        
        // 如果有场景图和人物图，解析@场景和@人物
        if (hasSceneImage && hasCharacterImage && finalPrompt.includes('@场景') && finalPrompt.includes('@人物')) {
          // 分离场景和人物部分（使用[\s\S]匹配包括换行符在内的所有字符）
          const sceneMatch = finalPrompt.match(/@场景\s*([\s\S]*?)(?=@人物|$)/);
          const characterMatch = finalPrompt.match(/@人物\s*([\s\S]*?)$/);
          
          if (sceneMatch && characterMatch) {
            const scenePrompt = sceneMatch[1].trim();
            const characterOnlyPrompt = characterMatch[1].trim();
            
            // 场景部分使用场景图，人物部分使用人物图
            sceneRefImg = sceneImages[0];
            characterRefImg = uploadedImage;
            
            // 合并提示词：场景描述 + 人物描述
            finalPrompt = `${scenePrompt}, ${characterOnlyPrompt || 'a character portrait'}`;
          }
        } else if (hasSceneImage && !hasCharacterImage) {
          // 只有场景图
          sceneRefImg = sceneImages[0];
          // 如果提示词包含@场景，提取场景部分
          if (finalPrompt.includes('@场景')) {
            const sceneMatch = finalPrompt.match(/@场景\s*([\s\S]*?)(?=@人物|$)/);
            if (sceneMatch) {
              finalPrompt = sceneMatch[1].trim();
            }
          }
        } else if (!hasSceneImage && hasCharacterImage) {
          // 只有人物图
          characterRefImg = uploadedImage;
          // 如果提示词包含@人物，提取人物部分
          if (finalPrompt.includes('@人物')) {
            const characterMatch = finalPrompt.match(/@人物\s*([\s\S]*?)$/);
            if (characterMatch) {
              finalPrompt = characterMatch[1].trim() || 'a character portrait';
            }
          }
        }

        // 如果有场景图，则在提示词末尾显式说明「角色位于场景中，场景参考图1」
        if (hasSceneImage) {
          finalPrompt = `${finalPrompt}，角色位于场景参考图1的环境中`;
        }
        
        // 确定使用哪个参考图
        // 如果有场景图和人物图，使用图生图API（支持多参考图）
        // 如果只有一个参考图，使用文生图API
        let refImg: string | null = null;
        let refImages: string[] = []; // 用于图生图的多参考图数组
        
        if (hasSceneImage && hasCharacterImage && sceneImages[0] && uploadedImage) {
          // 有场景图和人物图，使用图生图API，传递两个参考图
          refImages = [sceneImages[0], uploadedImage]; // 参考图1（场景），参考图2（人物）
        } else {
          // 只有一个参考图，使用文生图API
          refImg = characterRefImg || sceneRefImg || uploadedImage;
        }

        const response = await fetch('/api/music/generate-character-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: finalPrompt,
            refImg: refImg, // 单个参考图（文生图）
            refImages: refImages.length > 0 ? refImages : undefined, // 多个参考图（图生图）
            sceneRefImg: sceneRefImg, // 场景图（参考图1）
            characterRefImg: characterRefImg, // 人物图（参考图2）
            size: imageSize, // 按当前比例生成
            count: 4, // 生成4张图片
          }),
        });

        if (!response.ok) {
          // 如果新API不存在，尝试使用文生图API
          const fallbackRefImage = (editingShotIndex !== null && sceneImages[0]) ? sceneImages[0] : uploadedImage;
          const fallbackResponse = await fetch('/api/scenes/generate-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: characterPrompt || 'Generate character image based on reference',
              refImg: fallbackRefImage,
              count: 4, // 生成4张图片
            }),
          });

          if (!fallbackResponse.ok) {
            throw new Error('生成失败');
          }

          const fallbackResult = await fallbackResponse.json();
          console.log('[GenerateCharacter] Fallback API response:', fallbackResult);
          
          if (fallbackResult.success && fallbackResult.data) {
            // 格式1: data.images 数组（豆包API返回格式）
            if (fallbackResult.data.images && Array.isArray(fallbackResult.data.images) && fallbackResult.data.images.length > 0) {
              imageUrls = fallbackResult.data.images;
              setGeneratedImageUrls(imageUrls);
              if (imageUrls.length > 0) {
                setSelectedImageUrl(imageUrls[0]);
              }
            }
            // 格式2: data.imageUrl 单个URL
            else if (fallbackResult.data.imageUrl) {
              imageUrls = [fallbackResult.data.imageUrl];
              setGeneratedImageUrls(imageUrls);
              setSelectedImageUrl(fallbackResult.data.imageUrl);
            }
            // 格式3: data.imageUrls 数组
            else if (fallbackResult.data.imageUrls && Array.isArray(fallbackResult.data.imageUrls) && fallbackResult.data.imageUrls.length > 0) {
              imageUrls = fallbackResult.data.imageUrls;
              setGeneratedImageUrls(imageUrls);
              if (imageUrls.length > 0) {
                setSelectedImageUrl(imageUrls[0]);
              }
            }
            else {
              console.error('[GenerateCharacter] Unexpected fallback response format:', fallbackResult);
              throw new Error('生成失败：未返回图片（返回格式不正确）');
            }
          } else {
            throw new Error(fallbackResult.error || '生成失败：未返回图片');
          }
        } else {
          const result = await response.json();
          console.log('[GenerateCharacter] API response:', result);
          
          if (result.success && result.data) {
            // 格式1: data.imageUrl 单个URL（generate-character-image API返回格式）
            if (result.data.imageUrl) {
              imageUrls = [result.data.imageUrl];
              setGeneratedImageUrls(imageUrls);
              setSelectedImageUrl(result.data.imageUrl);
            }
            // 格式2: data.images 数组
            else if (result.data.images && Array.isArray(result.data.images) && result.data.images.length > 0) {
              imageUrls = result.data.images;
              setGeneratedImageUrls(imageUrls);
              if (imageUrls.length > 0) {
                setSelectedImageUrl(imageUrls[0]);
              }
            }
            // 格式3: data.imageUrls 数组
            else if (result.data.imageUrls && Array.isArray(result.data.imageUrls) && result.data.imageUrls.length > 0) {
              imageUrls = result.data.imageUrls;
              setGeneratedImageUrls(imageUrls);
              if (imageUrls.length > 0) {
                setSelectedImageUrl(imageUrls[0]);
              }
            }
            else {
              console.error('[GenerateCharacter] Unexpected response format:', result);
              throw new Error('生成失败：未返回图片（返回格式不正确）');
            }
          } else {
            throw new Error(result.error || '生成失败：未返回图片');
          }
        }
      }
    } catch (error) {
      console.error('Generate error:', error);
      alert(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // 为某个分镜生成视频（仅 Sora，无对口型）
  const handleGenerateShotVideo = async (shotIndex: number) => {
    const segment = storyboardSegments[shotIndex];
    const shotImage = shotImages[shotIndex];

    if (!segment || !shotImage) {
      alert('请先为该分镜生成图片');
      return;
    }

    try {
      // 开始生成视频
      setGeneratingVideoShotIndex(shotIndex);

      // 获取分镜的视频描述和人物描述
      const videoPrompt = segment.videoPrompt?.prompt || '';

      // 调用后端接口，仅用 Sora 生成“无口型视频”
      const response = await fetch('/api/music/generate-shot-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shotIndex,
          videoPrompt,
          imageUrl: shotImage,
          orientation,
          segmentStart: segment.start,
          segmentEnd: segment.end,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || '生成视频失败');
      }

      const result = await response.json();
      console.log('生成视频成功:', result);

      // 保存生成的视频URL（无对口型视频）
      if (result.success && result.data?.videoUrl) {
        setShotVideos(prev => ({
          ...prev,
          [shotIndex]: result.data.videoUrl as string,
        }));
      }
    } catch (error) {
      console.error('生成视频错误:', error);
      alert(error instanceof Error ? error.message : 'Video generation failed, please try again.');
    } finally {
      setGeneratingVideoShotIndex(null);
    }
  };

  const handleGenerate = async () => {
    // 滚动到"添加我的灵感"区域
    if (inspirationRef.current) {
      setTimeout(() => {
        inspirationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    // 设置视频生成状态
    setIsGeneratingVideo(true);
    setGeneratedVideoUrl(null);

    try {
      if (onGenerate) {
        // 这里应该调用实际的视频生成API
        // 暂时模拟，实际应该从onGenerate的回调中获取视频URL
        await onGenerate({
          audioUrl,
          startTime,
          endTime,
          musicTitle,
          musicId,
          mvType,
          visualStyle,
          showSubtitles,
        orientation,
        inspiration,
        characterImageUrl: selectedImageUrl || undefined,
        musicFeatures: musicFeatures || undefined,
        autoSegments: autoSegments, // 传递音频段数据，包含shotPlan
      });
        
        // 注意：实际的视频生成是异步的，视频URL应该从对话页面返回
        // 这里只是设置生成状态，实际的视频URL会在对话页面生成后通过props传递回来
      } else {
        // 如果没有提供回调，只打印日志
        console.log('Generate MV', {
          audioUrl,
          startTime,
          endTime,
          mvType,
          visualStyle,
          showSubtitles,
          orientation,
          inspiration,
          characterImageUrl: selectedImageUrl,
        });
        // 模拟生成完成
        setTimeout(() => {
          setIsGeneratingVideo(false);
          // setGeneratedVideoUrl('模拟视频URL');
        }, 3000);
      }
    } catch (error) {
      console.error('Generate MV error:', error);
      setIsGeneratingVideo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] max-w-[98vw] w-full bg-gray-900 p-0 overflow-hidden max-h-[95vh] flex flex-col border-0 shadow-2xl [&>button]:text-white [&>button]:hover:text-gray-300">
        <DialogTitle className="sr-only">步骤 2: 自定义您的MV</DialogTitle>
        <div className="flex flex-col h-full max-h-[95vh]">
          {/* 头部 - 简化 */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700 flex-shrink-0 pr-12 sm:pr-16">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              步骤 2: 自定义您的MV
            </h2>
            <Button
              variant="outline"
              onClick={() => {
                if (onBack) {
                  onBack();
                } else {
                  onOpenChange(false);
                }
              }}
              className="px-6 py-2 border-2 border-gray-600 hover:border-gray-500 hover:bg-gray-800 text-black bg-white transition-all duration-300 font-medium"
            >
              上一步
            </Button>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 min-h-0">
            <div className="max-w-6xl mx-auto">
              {/* 音频片段选择 - 简化版 */}
              {autoSegments.length > 0 ? (
                <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAllSegments}
                        onChange={(e) => {
                          setSelectAllSegments(e.target.checked);
                          if (e.target.checked) {
                            setSelectedSegmentForStoryboard(null);
                          }
                        }}
                        className="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-white font-medium">All segments</span>
                    </label>
                    {!selectAllSegments && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {autoSegments.map((segment, index) => {
                          const isSelected = selectedSegmentForStoryboard === index;
                          return (
                            <label
                              key={index}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors relative ${
                                isSelected
                                  ? 'bg-purple-600/30 border border-purple-500'
                                  : 'bg-gray-700 hover:bg-gray-600 border border-gray-600'
                              }`}
                            >
                              <input
                                type="radio"
                                name="segment"
                                checked={isSelected}
                                onChange={() => setSelectedSegmentForStoryboard(index)}
                                className="w-3 h-3 text-purple-600 bg-gray-600 border-gray-500 focus:ring-purple-500"
                              />
                              <span className="text-xs text-white">
                                Segment {index + 1}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-purple-500 ml-1" />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <p className="text-sm text-gray-400">No segments available. Run Smart Split first.</p>
                </div>
              )}

              {/* 场景列表 - 显示在分镜列表上方 */}
              {scenes.length > 0 && (
                <div className="mb-6">
                  <div className="space-y-4">
                    {scenes.map((scene, index) => {
                      const [sceneStart, sceneEnd] = scene.timeRange || [0, 0];
                      return (
                        <motion.div
                          key={scene.sceneId || index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="bg-gray-800 rounded-xl border border-blue-500/30 overflow-hidden"
                        >
                          <div className="flex">
                            {/* 左侧：场景图片 */}
                            <div className="w-48 p-2 flex items-center justify-center self-stretch">
                              <div
                                onClick={() => handleSceneImageClick(index)}
                                className="w-full h-full bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors relative group overflow-hidden"
                              >
                                {sceneImages[index] ? (
                                  <>
                                    <img
                                      src={sceneImages[index]}
                                      alt={`Scene ${scene.sceneId || index + 1}`}
                                      className="absolute inset-0 w-full h-full object-cover object-center rounded-lg"
                                    />
                                    {/* 对勾标记 */}
                                    <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-10">
                                      <CheckCircle2 className="w-4 h-4 text-white" />
                                    </div>
                                  </>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <ImageIcon className="w-12 h-12 text-gray-500 group-hover:text-gray-400" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <Plus className="w-6 h-6 text-gray-500 group-hover:text-gray-400" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* 右侧：场景详情 */}
                            <div className="flex-1 p-6">
                              <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-bold text-blue-400">Scene {scene.sceneId || index + 1}</h3>
                              </div>
                              
                              {/* 场景编辑模式 */}
                              {editingSceneTextIndex === index ? (
                                <div className="mb-4 space-y-4">
                                  <div>
                                    <label className="text-xs font-semibold text-gray-400 mb-2 block">Scene intent:</label>
                                    <Textarea
                                      value={sceneDescriptions[index]?.scenePurpose || scene.scenePurpose || ''}
                                      onChange={(e) => {
                                        setSceneDescriptions(prev => ({
                                          ...prev,
                                          [index]: {
                                            ...prev[index],
                                            scenePurpose: e.target.value,
                                            environment: prev[index]?.environment || scene.environment || '',
                                            sceneDescription: prev[index]?.sceneDescription || '',
                                          }
                                        }));
                                      }}
                                      className="min-h-[80px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                      placeholder="Describe the purpose of this scene..."
                                    />
                                  </div>
                                  
                                  <div className="border-t border-gray-700"></div>
                                  
                                  <div>
                                    <label className="text-xs font-semibold text-gray-400 mb-2 block">Environment:</label>
                                    <Textarea
                                      value={sceneDescriptions[index]?.environment || scene.environment || ''}
                                      onChange={(e) => {
                                        setSceneDescriptions(prev => ({
                                          ...prev,
                                          [index]: {
                                            ...prev[index],
                                            scenePurpose: prev[index]?.scenePurpose || scene.scenePurpose || '',
                                            environment: e.target.value,
                                            sceneDescription: prev[index]?.sceneDescription || '',
                                          }
                                        }));
                                      }}
                                      className="min-h-[60px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                      placeholder="Describe the environment..."
                                    />
                                  </div>
                                  
                                  <div className="border-t border-gray-700"></div>
                                  
                                  <div>
                                    <label className="text-xs font-semibold text-gray-400 mb-2 block">Scene notes:</label>
                                    <Textarea
                                      value={sceneDescriptions[index]?.sceneDescription || ''}
                                      onChange={(e) => {
                                        setSceneDescriptions(prev => ({
                                          ...prev,
                                          [index]: {
                                            ...prev[index],
                                            scenePurpose: prev[index]?.scenePurpose || scene.scenePurpose || '',
                                            environment: prev[index]?.environment || scene.environment || '',
                                            sceneDescription: e.target.value,
                                          }
                                        }));
                                      }}
                                      className="min-h-[80px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                      placeholder="Add extra notes for this scene"
                                    />
                                  </div>
                                  
                                  {/* 保存/取消按钮 */}
                                  <div className="flex items-center gap-2 mt-4">
                                    <Button
                                      onClick={() => setEditingSceneTextIndex(null)}
                                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      Save
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        setEditingSceneTextIndex(null);
                                      }}
                                      variant="outline"
                                      className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 px-4 py-2 rounded-lg"
                                    >
                                      <X className="w-4 h-4" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* Scene intent */}
                                  <div className="mb-4">
                                    <span className="text-xs font-semibold text-gray-400">Scene intent:</span>
                                    <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                                      {sceneDescriptions[index]?.scenePurpose || scene.scenePurpose || sceneDescription || 'No scene intent set yet'}
                                    </p>
                                  </div>
                                  
                                  <div className="border-t border-gray-700 my-3"></div>
                                  
                                  {/* Environment */}
                                  <div className="mb-4">
                                    <span className="text-xs font-semibold text-gray-400">Environment:</span>
                                    <p className="text-sm text-gray-300 mt-1">
                                      {sceneDescriptions[index]?.environment || scene.environment || 'No environment set yet'}
                                    </p>
                                  </div>
                                  
                                  {/* Scene notes */}
                                  <div className="border-t border-gray-700 my-3"></div>
                                  <div className="mb-4">
                                    <span className="text-xs font-semibold text-gray-400">Scene notes:</span>
                                    <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                                      {sceneDescriptions[index]?.sceneDescription || 'Add extra notes for this scene'}
                                    </p>
                                  </div>
                                  
                                  {/* 底部按钮 */}
                                  <div className="flex items-center gap-2 mt-4">
                                    <Button
                                      onClick={() => handleSceneImageClick(index)}
                                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                      <Sparkles className="w-4 h-4" />
                                      设置场景
                                      <Diamond className="w-4 h-4" />
                                      <span className="text-sm">5</span>
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        // 初始化编辑内容（如果还没有）
                                        if (!sceneDescriptions[index]) {
                                          setSceneDescriptions(prev => ({
                                            ...prev,
                                            [index]: {
                                              scenePurpose: scene.scenePurpose || '待设置场景目的',
                                              environment: scene.environment || '待设置环境',
                                              sceneDescription: '设置场景信息',
                                            }
                                          }));
                                        }
                                        setEditingSceneTextIndex(index);
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                                    >
                                      <Type className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Storyboard label (header above the shot list) */}
              {storyboardSegments.length > 0 && (
                <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-yellow-500/30">
                  <h3 className="text-lg font-bold text-yellow-400">分镜</h3>
                </div>
              )}

              {/* 分镜列表 - 主要布局 */}
              {storyboardSegments.length > 0 ? (
                <div className="space-y-4">
                  {storyboardSegments.map((segment: AudioSegment, index: number) => {
                    const shotImage = shotImages[index] || null;
                    // 移除每次渲染都打印的调试信息，只在开发环境且需要时打印
                    if (process.env.NODE_ENV === 'development' && index === 0) {
                      console.log(`[mv-customize] 渲染分镜列表，共 ${storyboardSegments.length} 个分镜`);
                    }
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="bg-gray-800 rounded-xl border border-yellow-500/30 overflow-hidden relative"
                      >
                        {/* 视频生成覆盖层 */}
                        {generatingVideoShotIndex === index && (
                          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
                            <div className="text-center">
                              {/* 流水波浪动画 */}
                              <div className="relative w-64 h-32 mb-4 overflow-hidden rounded-lg">
                                <svg
                                  className="absolute inset-0 w-full h-full"
                                  viewBox="0 0 400 200"
                                  preserveAspectRatio="none"
                                >
                                  <defs>
                                    <linearGradient id={`wave-gradient-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
                                      <stop offset="50%" stopColor="rgba(99, 102, 241, 0.6)" />
                                      <stop offset="100%" stopColor="rgba(139, 92, 246, 0.4)" />
                                    </linearGradient>
                                  </defs>
                                  {/* 第一层波浪 */}
                                  <path
                                    d="M0,100 Q100,50 200,100 T400,100 L400,200 L0,200 Z"
                                    fill={`url(#wave-gradient-${index})`}
                                    className="wave-path-1"
                                  />
                                  {/* 第二层波浪 */}
                                  <path
                                    d="M0,120 Q100,70 200,120 T400,120 L400,200 L0,200 Z"
                                    fill={`url(#wave-gradient-${index})`}
                                    opacity="0.7"
                                    className="wave-path-2"
                                  />
                                  {/* 第三层波浪 */}
                                  <path
                                    d="M0,140 Q100,90 200,140 T400,140 L400,200 L0,200 Z"
                                    fill={`url(#wave-gradient-${index})`}
                                    opacity="0.5"
                                    className="wave-path-3"
                                  />
                                </svg>
                              </div>
                              <p className="text-white text-lg font-semibold">视频生成中,请稍后</p>
                            </div>
                          </div>
                        )}
                        <div className="flex">
                          {/* 左侧：图片占位符（有视频时显示视频图标，可点击预览） */}
                          <div className="w-48 h-[248px] p-2 flex items-center justify-center flex-shrink-0">
                            <div
                              onClick={() => {
                                const hasAnyVideo = shotLipSyncVideos[index] || shotVideos[index];
                                if (hasAnyVideo) {
                                  setVideoDialogShotIndex(index);
                                } else {
                                  handleShotImageClick(index);
                                }
                              }}
                              className="w-full h-full bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors relative group overflow-hidden"
                            >
                              {shotImage ? (
                                <>
                                  <img
                                    src={shotImage}
                                    alt={`Shot ${index + 1}`}
                                    className="absolute inset-0 w-full h-full object-cover object-center rounded-lg"
                                  />
                                  {/* 对勾标记 */}
                                  <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-10">
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                  </div>
                                  {/* 有视频时显示视频图标（优先对口型视频） */}
                                  {(shotLipSyncVideos[index] || shotVideos[index]) && (
                                    <div className="absolute bottom-2 left-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center shadow-lg z-10">
                                      <Video className="w-4 h-4 text-yellow-400" />
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <ImageIcon className="w-12 h-12 text-gray-500 group-hover:text-gray-400" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Plus className="w-6 h-6 text-gray-500 group-hover:text-gray-400" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* 右侧：分镜详情 */}
                          <div className="flex-1 p-6">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-bold text-yellow-400">Shot {index + 1}</h3>
                              <span className="text-xs text-gray-400">
                                {formatTime(segment.start)} - {formatTime(segment.end)}
                              </span>
                            </div>
                            
                            {/* 编辑模式 */}
                            {editingTextIndex === index ? (
                              <div className="mb-4 space-y-4">
                                {/* Camera */}
                                <div>
                                  <label className="text-xs font-semibold text-gray-400 mb-2 block">摄像：</label>
                                  <Textarea
                                    value={shotDescriptions[index]?.camera || segment.videoPrompt?.camera || ''}
                                    onChange={(e) => {
                                      setShotDescriptions(prev => ({
                                        ...prev,
                                        [index]: {
                                          ...prev[index],
                                          camera: e.target.value,
                                          performance: prev[index]?.performance || segment.videoPrompt?.performance || '',
                                          emotion: prev[index]?.emotion || segment.videoPrompt?.emotion || '',
                                          prompt: prev[index]?.prompt || segment.videoPrompt?.prompt || '',
                                          shotPlan: prev[index]?.shotPlan || segment.videoPrompt?.shotPlan || undefined,
                                          sceneDescription: prev[index]?.sceneDescription || '',
                                          characters: prev[index]?.characters || '',
                                          narration: prev[index]?.narration || '',
                                        }
                                      }));
                                    }}
                                    className="min-h-[80px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                    placeholder="摄像描述..."
                                  />
                                </div>
                                
                                <div className="border-t border-gray-700"></div>
                                
                                {/* 人物表演 */}
                                <div>
                                  <label className="text-xs font-semibold text-gray-400 mb-2 block">人物表演：</label>
                                  <Textarea
                                    value={shotDescriptions[index]?.performance || segment.videoPrompt?.performance || ''}
                                    onChange={(e) => {
                                      setShotDescriptions(prev => ({
                                        ...prev,
                                        [index]: {
                                          ...prev[index],
                                          camera: prev[index]?.camera || segment.videoPrompt?.camera || '',
                                          performance: e.target.value,
                                          emotion: prev[index]?.emotion || segment.videoPrompt?.emotion || '',
                                          prompt: prev[index]?.prompt || segment.videoPrompt?.prompt || '',
                                          shotPlan: prev[index]?.shotPlan || segment.videoPrompt?.shotPlan || undefined,
                                          sceneDescription: prev[index]?.sceneDescription || '',
                                          characters: prev[index]?.characters || '',
                                          narration: prev[index]?.narration || '',
                                        }
                                      }));
                                    }}
                                    className="min-h-[80px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                    placeholder="人物表演描述..."
                                  />
                                </div>
                                
                                <div className="border-t border-gray-700"></div>
                                
                                {/* 情绪 */}
                                <div>
                                  <label className="text-xs font-semibold text-gray-400 mb-2 block">情绪：</label>
                                  <Textarea
                                    value={shotDescriptions[index]?.emotion || segment.videoPrompt?.emotion || ''}
                                    onChange={(e) => {
                                      setShotDescriptions(prev => ({
                                        ...prev,
                                        [index]: {
                                          ...prev[index],
                                          camera: prev[index]?.camera || segment.videoPrompt?.camera || '',
                                          performance: prev[index]?.performance || segment.videoPrompt?.performance || '',
                                          emotion: e.target.value,
                                          prompt: prev[index]?.prompt || segment.videoPrompt?.prompt || '',
                                          shotPlan: prev[index]?.shotPlan || segment.videoPrompt?.shotPlan || undefined,
                                          sceneDescription: prev[index]?.sceneDescription || '',
                                          characters: prev[index]?.characters || '',
                                          narration: prev[index]?.narration || '',
                                        }
                                      }));
                                    }}
                                    className="min-h-[60px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                    placeholder="情绪描述..."
                                  />
                                </div>
                                
                                <div className="border-t border-gray-700"></div>
                                
                                {/* 视频描述词 */}
                                <div>
                                  <label className="text-xs font-semibold text-gray-400 mb-2 block">视频描述词：</label>
                                  <Textarea
                                    value={shotDescriptions[index]?.prompt || segment.videoPrompt?.prompt || ''}
                                    onChange={(e) => {
                                      setShotDescriptions(prev => ({
                                        ...prev,
                                        [index]: {
                                          ...prev[index],
                                          camera: prev[index]?.camera || segment.videoPrompt?.camera || '',
                                          performance: prev[index]?.performance || segment.videoPrompt?.performance || '',
                                          emotion: prev[index]?.emotion || segment.videoPrompt?.emotion || '',
                                          prompt: e.target.value,
                                          shotPlan: prev[index]?.shotPlan || segment.videoPrompt?.shotPlan || undefined,
                                          sceneDescription: prev[index]?.sceneDescription || '',
                                          characters: prev[index]?.characters || '',
                                          narration: prev[index]?.narration || '',
                                        }
                                      }));
                                    }}
                                    className="min-h-[100px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                    placeholder="完整的视频描述词..."
                                  />
                                </div>
                                
                                {/* 镜头规划 */}
                                {segment.videoPrompt?.shotPlan && (
                                  <>
                                    <div className="border-t border-gray-700"></div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-400 mb-2 block">镜头规划：</label>
                                      <div className="space-y-3">
                                        <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Shot size:</label>
                                          <Textarea
                                            value={shotDescriptions[index]?.shotPlan?.shotSize || segment.videoPrompt?.shotPlan?.shotSize || ''}
                                            onChange={(e) => {
                                              setShotDescriptions(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  camera: prev[index]?.camera || segment.videoPrompt?.camera || '',
                                                  performance: prev[index]?.performance || segment.videoPrompt?.performance || '',
                                                  emotion: prev[index]?.emotion || segment.videoPrompt?.emotion || '',
                                                  prompt: prev[index]?.prompt || segment.videoPrompt?.prompt || '',
                                                  shotPlan: {
                                                    ...prev[index]?.shotPlan,
                                                    ...segment.videoPrompt?.shotPlan,
                                                    shotSize: e.target.value,
                                                    cameraAngle: prev[index]?.shotPlan?.cameraAngle || segment.videoPrompt?.shotPlan?.cameraAngle || '',
                                                    framingRule: prev[index]?.shotPlan?.framingRule || segment.videoPrompt?.shotPlan?.framingRule || '',
                                                    cameraMotion: prev[index]?.shotPlan?.cameraMotion || segment.videoPrompt?.shotPlan?.cameraMotion || '',
                                                    shotPurpose: prev[index]?.shotPlan?.shotPurpose || segment.videoPrompt?.shotPlan?.shotPurpose || '',
                                                    cutContinuity: prev[index]?.shotPlan?.cutContinuity || segment.videoPrompt?.shotPlan?.cutContinuity || '',
                                                  },
                                                  sceneDescription: prev[index]?.sceneDescription || '',
                                                  characters: prev[index]?.characters || '',
                                                  narration: prev[index]?.narration || '',
                                                }
                                              }));
                                            }}
                                            className="min-h-[50px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                            placeholder="e.g. close-up, medium shot..."
                                          />
                                        </div>
                                        
                                        <div>
                                          <label className="text-xs text-gray-400 mb-1 block">Camera angle:</label>
                                          <Textarea
                                            value={shotDescriptions[index]?.shotPlan?.cameraAngle || segment.videoPrompt?.shotPlan?.cameraAngle || ''}
                                            onChange={(e) => {
                                              setShotDescriptions(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  camera: prev[index]?.camera || segment.videoPrompt?.camera || '',
                                                  performance: prev[index]?.performance || segment.videoPrompt?.performance || '',
                                                  emotion: prev[index]?.emotion || segment.videoPrompt?.emotion || '',
                                                  prompt: prev[index]?.prompt || segment.videoPrompt?.prompt || '',
                                                  shotPlan: {
                                                    ...prev[index]?.shotPlan,
                                                    ...segment.videoPrompt?.shotPlan,
                                                    shotSize: prev[index]?.shotPlan?.shotSize || segment.videoPrompt?.shotPlan?.shotSize || '',
                                                    cameraAngle: e.target.value,
                                                    framingRule: prev[index]?.shotPlan?.framingRule || segment.videoPrompt?.shotPlan?.framingRule || '',
                                                    cameraMotion: prev[index]?.shotPlan?.cameraMotion || segment.videoPrompt?.shotPlan?.cameraMotion || '',
                                                    shotPurpose: prev[index]?.shotPlan?.shotPurpose || segment.videoPrompt?.shotPlan?.shotPurpose || '',
                                                    cutContinuity: prev[index]?.shotPlan?.cutContinuity || segment.videoPrompt?.shotPlan?.cutContinuity || '',
                                                  },
                                                  sceneDescription: prev[index]?.sceneDescription || '',
                                                  characters: prev[index]?.characters || '',
                                                  narration: prev[index]?.narration || '',
                                                }
                                              }));
                                            }}
                                            className="min-h-[50px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                            placeholder="e.g. eye-level, low angle..."
                                          />
                                        </div>
                                        
                                        <div>
                                          <label className="text-xs text-gray-400 mb-1 block">Framing:</label>
                                          <Textarea
                                            value={shotDescriptions[index]?.shotPlan?.framingRule || segment.videoPrompt?.shotPlan?.framingRule || ''}
                                            onChange={(e) => {
                                              setShotDescriptions(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  camera: prev[index]?.camera || segment.videoPrompt?.camera || '',
                                                  performance: prev[index]?.performance || segment.videoPrompt?.performance || '',
                                                  emotion: prev[index]?.emotion || segment.videoPrompt?.emotion || '',
                                                  prompt: prev[index]?.prompt || segment.videoPrompt?.prompt || '',
                                                  shotPlan: {
                                                    ...prev[index]?.shotPlan,
                                                    ...segment.videoPrompt?.shotPlan,
                                                    shotSize: prev[index]?.shotPlan?.shotSize || segment.videoPrompt?.shotPlan?.shotSize || '',
                                                    cameraAngle: prev[index]?.shotPlan?.cameraAngle || segment.videoPrompt?.shotPlan?.cameraAngle || '',
                                                    framingRule: e.target.value,
                                                    cameraMotion: prev[index]?.shotPlan?.cameraMotion || segment.videoPrompt?.shotPlan?.cameraMotion || '',
                                                    shotPurpose: prev[index]?.shotPlan?.shotPurpose || segment.videoPrompt?.shotPlan?.shotPurpose || '',
                                                    cutContinuity: prev[index]?.shotPlan?.cutContinuity || segment.videoPrompt?.shotPlan?.cutContinuity || '',
                                                  },
                                                  sceneDescription: prev[index]?.sceneDescription || '',
                                                  characters: prev[index]?.characters || '',
                                                  narration: prev[index]?.narration || '',
                                                }
                                              }));
                                            }}
                                            className="min-h-[50px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                            placeholder="e.g. centered, rule of thirds..."
                                          />
                                        </div>
                                        
                                        <div>
                                          <label className="text-xs text-gray-400 mb-1 block">Camera movement:</label>
                                          <Textarea
                                            value={shotDescriptions[index]?.shotPlan?.cameraMotion || segment.videoPrompt?.shotPlan?.cameraMotion || ''}
                                            onChange={(e) => {
                                              setShotDescriptions(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  camera: prev[index]?.camera || segment.videoPrompt?.camera || '',
                                                  performance: prev[index]?.performance || segment.videoPrompt?.performance || '',
                                                  emotion: prev[index]?.emotion || segment.videoPrompt?.emotion || '',
                                                  prompt: prev[index]?.prompt || segment.videoPrompt?.prompt || '',
                                                  shotPlan: {
                                                    ...prev[index]?.shotPlan,
                                                    ...segment.videoPrompt?.shotPlan,
                                                    shotSize: prev[index]?.shotPlan?.shotSize || segment.videoPrompt?.shotPlan?.shotSize || '',
                                                    cameraAngle: prev[index]?.shotPlan?.cameraAngle || segment.videoPrompt?.shotPlan?.cameraAngle || '',
                                                    framingRule: prev[index]?.shotPlan?.framingRule || segment.videoPrompt?.shotPlan?.framingRule || '',
                                                    cameraMotion: e.target.value,
                                                    shotPurpose: prev[index]?.shotPlan?.shotPurpose || segment.videoPrompt?.shotPlan?.shotPurpose || '',
                                                    cutContinuity: prev[index]?.shotPlan?.cutContinuity || segment.videoPrompt?.shotPlan?.cutContinuity || '',
                                                  },
                                                  sceneDescription: prev[index]?.sceneDescription || '',
                                                  characters: prev[index]?.characters || '',
                                                  narration: prev[index]?.narration || '',
                                                }
                                              }));
                                            }}
                                            className="min-h-[50px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                            placeholder="e.g. dolly in, handheld..."
                                          />
                                        </div>
                                        
                                        <div>
                                          <label className="text-xs text-gray-400 mb-1 block">Shot purpose:</label>
                                          <Textarea
                                            value={shotDescriptions[index]?.shotPlan?.shotPurpose || segment.videoPrompt?.shotPlan?.shotPurpose || ''}
                                            onChange={(e) => {
                                              setShotDescriptions(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  camera: prev[index]?.camera || segment.videoPrompt?.camera || '',
                                                  performance: prev[index]?.performance || segment.videoPrompt?.performance || '',
                                                  emotion: prev[index]?.emotion || segment.videoPrompt?.emotion || '',
                                                  prompt: prev[index]?.prompt || segment.videoPrompt?.prompt || '',
                                                  shotPlan: {
                                                    ...prev[index]?.shotPlan,
                                                    ...segment.videoPrompt?.shotPlan,
                                                    shotSize: prev[index]?.shotPlan?.shotSize || segment.videoPrompt?.shotPlan?.shotSize || '',
                                                    cameraAngle: prev[index]?.shotPlan?.cameraAngle || segment.videoPrompt?.shotPlan?.cameraAngle || '',
                                                    framingRule: prev[index]?.shotPlan?.framingRule || segment.videoPrompt?.shotPlan?.framingRule || '',
                                                    cameraMotion: prev[index]?.shotPlan?.cameraMotion || segment.videoPrompt?.shotPlan?.cameraMotion || '',
                                                    shotPurpose: e.target.value,
                                                    cutContinuity: prev[index]?.shotPlan?.cutContinuity || segment.videoPrompt?.shotPlan?.cutContinuity || '',
                                                  },
                                                  sceneDescription: prev[index]?.sceneDescription || '',
                                                  characters: prev[index]?.characters || '',
                                                  narration: prev[index]?.narration || '',
                                                }
                                              }));
                                            }}
                                            className="min-h-[50px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                            placeholder="What story beat or emotion this shot delivers..."
                                          />
                                        </div>
                                        
                                        <div>
                                          <label className="text-xs text-gray-400 mb-1 block">Edit continuity:</label>
                                          <Textarea
                                            value={shotDescriptions[index]?.shotPlan?.cutContinuity || segment.videoPrompt?.shotPlan?.cutContinuity || ''}
                                            onChange={(e) => {
                                              setShotDescriptions(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  camera: prev[index]?.camera || segment.videoPrompt?.camera || '',
                                                  performance: prev[index]?.performance || segment.videoPrompt?.performance || '',
                                                  emotion: prev[index]?.emotion || segment.videoPrompt?.emotion || '',
                                                  prompt: prev[index]?.prompt || segment.videoPrompt?.prompt || '',
                                                  shotPlan: {
                                                    ...prev[index]?.shotPlan,
                                                    ...segment.videoPrompt?.shotPlan,
                                                    shotSize: prev[index]?.shotPlan?.shotSize || segment.videoPrompt?.shotPlan?.shotSize || '',
                                                    cameraAngle: prev[index]?.shotPlan?.cameraAngle || segment.videoPrompt?.shotPlan?.cameraAngle || '',
                                                    framingRule: prev[index]?.shotPlan?.framingRule || segment.videoPrompt?.shotPlan?.framingRule || '',
                                                    cameraMotion: prev[index]?.shotPlan?.cameraMotion || segment.videoPrompt?.shotPlan?.cameraMotion || '',
                                                    shotPurpose: prev[index]?.shotPlan?.shotPurpose || segment.videoPrompt?.shotPlan?.shotPurpose || '',
                                                    cutContinuity: e.target.value,
                                                  },
                                                  sceneDescription: prev[index]?.sceneDescription || '',
                                                  characters: prev[index]?.characters || '',
                                                  narration: prev[index]?.narration || '',
                                                }
                                              }));
                                            }}
                                            className="min-h-[50px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                                            placeholder="How this cut connects to previous/next shots..."
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                                
                                {/* 保存/取消按钮 */}
                                <div className="flex items-center gap-2 mt-4">
                                  <Button
                                    onClick={() => setEditingTextIndex(null)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    保存
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setEditingTextIndex(null);
                                    }}
                                    variant="outline"
                                    className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 px-4 py-2 rounded-lg"
                                  >
                                    <X className="w-4 h-4" />
                                    取消
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* 摄像 */}
                                {segment.videoPrompt?.camera && (
                                  <div className="mb-4">
                                      <span className="text-xs font-semibold text-gray-400">Camera:</span>
                                    <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                                      {segment.videoPrompt.camera}
                                    </p>
                                  </div>
                                )}
                                
                                {/* Performance */}
                                {segment.videoPrompt?.performance && (
                                  <>
                                    <div className="border-t border-gray-700 my-3"></div>
                                    <div className="mb-4">
                                      <span className="text-xs font-semibold text-gray-400">Performance:</span>
                                      <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                                        {segment.videoPrompt.performance}
                                      </p>
                                    </div>
                                  </>
                                )}
                                
                                {/* Emotion */}
                                {segment.videoPrompt?.emotion && (
                                  <>
                                    <div className="border-t border-gray-700 my-3"></div>
                                    <div className="mb-4">
                                      <span className="text-xs font-semibold text-gray-400">Emotion:</span>
                                      <p className="text-sm text-gray-300 mt-1">
                                        {segment.videoPrompt.emotion}
                                      </p>
                                    </div>
                                  </>
                                )}
                                
                                {/* Shot prompt */}
                                {segment.videoPrompt?.prompt && (
                                  <>
                                    <div className="border-t border-gray-700 my-3"></div>
                                    <div className="mb-4">
                                      <span className="text-xs font-semibold text-gray-400">Shot prompt:</span>
                                      <p className="text-sm text-gray-300 mt-1 leading-relaxed italic">
                                        {segment.videoPrompt.prompt}
                                      </p>
                                    </div>
                                  </>
                                )}
                                
                                {/* Shot plan */}
                                {segment.videoPrompt?.shotPlan && (
                                  <>
                                    <div className="border-t border-gray-700 my-3"></div>
                                    <div className="mb-4">
                                      <span className="text-xs font-semibold text-gray-400 mb-2 block">Shot plan:</span>
                                      <div className="space-y-2 text-xs">
                                        <div>
                                          <span className="text-gray-400">Shot size:</span>
                                          <span className="text-gray-300 ml-2">{segment.videoPrompt.shotPlan.shotSize}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Camera angle:</span>
                                          <span className="text-gray-300 ml-2">{segment.videoPrompt.shotPlan.cameraAngle}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Framing:</span>
                                          <span className="text-gray-300 ml-2">{segment.videoPrompt.shotPlan.framingRule}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Camera movement:</span>
                                          <span className="text-gray-300 ml-2">{segment.videoPrompt.shotPlan.cameraMotion}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Shot purpose:</span>
                                          <span className="text-gray-300 ml-2">{segment.videoPrompt.shotPlan.shotPurpose}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Edit continuity:</span>
                                          <span className="text-gray-300 ml-2">{segment.videoPrompt.shotPlan.cutContinuity}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                                
                                {/* Storyboard notes (if user edited any) */}
                                {shotDescriptions[index]?.sceneDescription && (
                                  <>
                                    <div className="border-t border-gray-700 my-3"></div>
                                    <div className="mb-4">
                                      <span className="text-xs font-semibold text-gray-400">分镜提示：</span>
                                      <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                                        {shotDescriptions[index]?.sceneDescription}
                                      </p>
                                    </div>
                                  </>
                                )}
                                
                                {/* 如果没有videoPrompt也没有用户编辑的内容，显示默认提示 */}
                                {!segment.videoPrompt && !shotDescriptions[index]?.sceneDescription && (
                                  <div className="mb-4">
                                    <span className="text-xs font-semibold text-gray-400">Storyboard notes:</span>
                                    <span className="text-xs font-semibold text-gray-400">Storyboard notes:</span>
                                    <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                                      Choose a character image first, then apply lip sync for a richer result.
                                    </p>
                                  </div>
                                )}
                                
                                {/* 底部按钮 */}
                                <div className="flex items-center gap-2 mt-4">
                                  {shotImage && !shotVideos[index] ? (
                                    <Button
                                      onClick={() => handleGenerateShotVideo(index)}
                                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                      <Mic className="w-4 h-4" />
                                      Generate Video
                                      <Diamond className="w-4 h-4" />
                                      <span className="text-sm">5</span>
                                    </Button>
                                  ) : (
                                    <Button
                                      onClick={() => handleShotImageClick(index)}
                                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                      <Sparkles className="w-4 h-4" />
                                      Generate Image
                                      <Diamond className="w-4 h-4" />
                                      <span className="text-sm">5</span>
                                    </Button>
                                  )}
                                  <Button
                                    onClick={() => {
                                      // 初始化编辑内容（如果还没有）
                                      if (!shotDescriptions[index]) {
                                        setShotDescriptions(prev => ({
                                          ...prev,
                                          [index]: {
                                            sceneDescription: '先选择人物图片，再配口型，更丰富',
                                            characters: 'Character Name',
                                            narration: 'Narration text for this shot describing the scene.',
                                          }
                                        }));
                                      }
                                      setEditingTextIndex(index);
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                                    title="编辑分镜描述"
                                  >
                                    <Type className="w-4 h-4" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400">
                    暂无分镜数据
                    {autoSegments.length === 0 && '（音频段为空，请先进行智能拆段）'}
                    {autoSegments.length > 0 && storyboardSegments.length === 0 && '（请选择音频段）'}
                  </p>
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mt-4 text-xs text-gray-500 space-y-1">
                      <p>调试信息：</p>
                      <p>autoSegments.length: {autoSegments.length}</p>
                      <p>storyboardSegments.length: {storyboardSegments.length}</p>
                      <p>selectAllSegments: {selectAllSegments ? 'true' : 'false'}</p>
                      <p>selectedSegmentForStoryboard: {selectedSegmentForStoryboard ?? 'null'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* 图片选择对话框 */}
      {showImageSelectDialog && (
        <Dialog open={showImageSelectDialog} onOpenChange={setShowImageSelectDialog}>
          <DialogContent className="sm:max-w-[90vw] max-w-[95vw] w-full h-[90vh] max-h-[90vh] bg-gray-900 p-0 overflow-hidden flex flex-col border-0 shadow-2xl">
            <DialogTitle className="sr-only">创建图片</DialogTitle>
            <div className="flex flex-col h-full max-h-[90vh]">
              {/* 头部 */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700 flex-shrink-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  创建图片
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowImageSelectDialog(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* 内容区域 */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 min-h-0">
                <div className="max-w-4xl mx-auto">
                  {/* 标签页切换 */}
                  <div className="flex items-center gap-6 mb-6 border-b border-gray-700 pb-4">
                    <div className="flex items-center gap-3">
                      <button
                        className={`p-2 rounded-lg transition-colors ${
                          characterMode === 'text' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setCharacterMode('text');
                          setGeneratedImageUrls([]);
                        }}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                          characterMode === 'text'
                            ? 'text-white border-white'
                            : 'text-gray-400 border-transparent hover:text-gray-300'
                        }`}
                      >
                        Text to Image
                      </button>
                      <button
                        onClick={() => {
                          setCharacterMode('image');
                          setGeneratedImageUrls([]);
                        }}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                          characterMode === 'image'
                            ? 'text-white border-white'
                            : 'text-gray-400 border-transparent hover:text-gray-300'
                        }`}
                      >
                        Image to Image
                      </button>
                    </div>
                  </div>

                  {/* 文本输入区域 */}
                  <div className="bg-gray-800 rounded-xl p-6 mb-6">
                    <AnimatePresence mode="wait">
                      {characterMode === 'text' && (
                        <motion.div
                          key="text"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div>
                            <Textarea
                              value={characterPrompt}
                              onChange={(e) => setCharacterPrompt(e.target.value)}
                              placeholder="Describe the image you want to create, in any language"
                              className="min-h-[200px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                            />
                            {/* 提示文字 */}
                            {editingShotIndex !== null && (
                              <p className="text-xs text-gray-500 mt-2">
                                {sceneImages[0] ? "在@人物后面描述人物形象" : "只需要在默认文本后描述人物形象即可"}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {characterMode === 'image' && (
                        <motion.div
                          key="image"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-4"
                        >
                          <div className="space-y-3">
                            {/* 参考图列表 */}
                            <div className="flex flex-wrap gap-3">
                              {/* 场景图（如果有） */}
                              {editingShotIndex !== null && sceneImages[0] && (
                                <div className="relative bg-gray-700 rounded-lg border border-gray-600 p-2">
                                  <div className="flex flex-col items-center gap-2">
                                    <img
                                      src={sceneImages[0]}
                                      alt="参考图1"
                                      className="w-32 h-[100px] rounded-lg object-cover"
                                    />
                                    <p className="text-xs text-gray-400">参考图1</p>
                                  </div>
                                </div>
                              )}
                              
                              {/* 默认图位置 - 改为上传区域 */}
                              <div className="relative bg-gray-700 rounded-lg border border-gray-600 p-2">
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleImageUpload(file);
                                      // 如果有场景图，确保提示词包含@人物
                                      if (editingShotIndex !== null && sceneImages[0]) {
                                        const currentPrompt = characterPrompt;
                                        if (!currentPrompt.includes('@人物')) {
                                          setCharacterPrompt(currentPrompt + ' @人物');
                                        }
                                      }
                                    }
                                  }}
                                  className="hidden"
                                />
                                {uploadedImage ? (
                                  <div className="flex flex-col items-center gap-2 relative">
                                    <img
                                      src={uploadedImage}
                                      alt={editingShotIndex !== null && sceneImages[0] ? "参考图2" : "参考图"}
                                      className="w-32 h-[100px] rounded-lg object-cover"
                                    />
                                    <p className="text-xs text-gray-400">
                                      {editingShotIndex !== null && sceneImages[0] ? "参考图2" : "参考图"}
                                    </p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setUploadedImage(null);
                                        setUploadedImageFile(null);
                                        if (fileInputRef.current) {
                                          fileInputRef.current.value = '';
                                        }
                                        // 如果有场景图，更新提示词，移除@人物后的内容
                                        if (editingShotIndex !== null && sceneImages[0]) {
                                          const currentPrompt = characterPrompt;
                                          const scenePart = currentPrompt.split('@人物')[0];
                                          setCharacterPrompt(scenePart + '@人物');
                                        }
                                      }}
                                      className="absolute top-1 right-1 w-6 h-6 p-0 text-gray-400 hover:text-white bg-gray-800/80"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="cursor-pointer flex flex-col items-center gap-2"
                                  >
                                    <div className="w-32 h-[100px] rounded-lg bg-gray-600 border-2 border-dashed border-gray-500 flex items-center justify-center hover:border-gray-400 transition-colors">
                                      <ImageIcon className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-xs text-gray-400">
                                      {editingShotIndex !== null && sceneImages[0] ? "上传人物参考图" : "上传参考图"}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div>
                            <Textarea
                              value={characterPrompt}
                              onChange={(e) => setCharacterPrompt(e.target.value)}
                              placeholder="Describe the image you want to create, in any language"
                              className="min-h-[200px] bg-gray-700 border border-gray-600 text-white placeholder:text-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 rounded-lg text-sm resize-y"
                            />
                            {/* 提示文字 */}
                            {editingShotIndex !== null && (
                              <p className="text-xs text-gray-500 mt-2">
                                {sceneImages[0] ? "在@人物后面描述人物形象" : "只需要在默认文本后描述人物形象即可"}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 底部控制栏 */}
                  <div className="flex items-center gap-3 flex-wrap mb-6">
                    <div className="relative group">
                      <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm hover:bg-gray-750 transition-colors">
                        <Palette className="w-4 h-4" />
                        <span>{visualStyles.find(s => s.id === visualStyle)?.label || '选择风格'}</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 hidden group-hover:block">
                        <div className="p-2">
                          {visualStyles.map((style) => (
                            <button
                              key={style.id}
                              onClick={() => setVisualStyle(style.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                visualStyle === style.id
                                  ? 'bg-gray-700 text-white'
                                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                              }`}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setOrientation(orientation === '16:9' ? '9:16' : '16:9')}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm hover:bg-gray-750 transition-colors"
                    >
                      {orientation === '16:9' ? (
                        <div className="w-4 h-3 rounded border bg-white" />
                      ) : (
                        <div className="w-3 h-4 rounded border bg-white" />
                      )}
                      <span>{orientation}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    <Button
                      onClick={handleGenerateCharacter}
                      disabled={isGenerating || (characterMode === 'text' && !characterPrompt.trim()) || (characterMode === 'image' && !uploadedImage)}
                      className="ml-auto bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          生成图片
                        </>
                      )}
                    </Button>
                  </div>

                  {/* 生成的图片选择 */}
                  {generatedImageUrls.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white">选择图片</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {generatedImageUrls.map((url, imgIndex) => (
                          <div
                            key={imgIndex}
                            onClick={() => handleImageSelected(url)}
                            className="relative cursor-pointer rounded-lg overflow-hidden border-2 border-gray-600 hover:border-yellow-500 transition-all"
                          >
                            <img
                              src={url}
                              alt={`生成的图片 ${imgIndex + 1}`}
                              className="w-full aspect-square object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 视频预览弹窗 */}
      {videoDialogShotIndex !== null && (shotLipSyncVideos[videoDialogShotIndex] || shotVideos[videoDialogShotIndex]) && (
        <Dialog open={true} onOpenChange={(open) => !open && setVideoDialogShotIndex(null)}>
          <DialogContent className="sm:max-w-[960px] w-full bg-gray-900 text-white border border-gray-800 shadow-2xl">
            <DialogTitle className="text-lg font-semibold mb-4">Preview Video</DialogTitle>

            {(() => {
              const idx = videoDialogShotIndex as number;
              const baseVideoUrl = shotVideos[idx] || shotLipSyncVideos[idx];
              const lipSyncUrl = shotLipSyncVideos[idx] || null;
              const isGeneratingLipSync = generatingVideoShotIndex === idx && !lipSyncUrl;

              return (
                <div className="space-y-4">
                  {/* 上方：左右分屏预览 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                    {/* Left: original video */}
                    <div className="space-y-2 flex flex-col">
                      <div className="text-sm text-gray-300 font-medium">Source Video</div>
                      <div className="w-full rounded-lg overflow-hidden bg-black flex-1 flex items-center justify-center">
                        {baseVideoUrl ? (
                          <video
                            src={baseVideoUrl as string}
                            controls
                            className="w-full h-full max-h-[50vh] bg-black object-contain"
                          />
                        ) : (
                          <div className="w-full h-[240px] flex items-center justify-center text-gray-500 text-sm">
                            暂无原视频
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: lip-sync video / loading state */}
                    <div className="space-y-2 flex flex-col">
                      <div className="text-sm text-gray-300 font-medium">Lip-sync Video</div>
                      <div className="w-full rounded-lg overflow-hidden bg-black flex-1 flex items-center justify-center relative">
                        {lipSyncUrl && !isGeneratingLipSync && (
                          <video
                            src={lipSyncUrl as string}
                            controls
                            className="w-full h-full max-h-[50vh] bg-black object-contain"
                          />
                        )}

                        {!lipSyncUrl && !isGeneratingLipSync && (
                          <div className="flex flex-col items-center justify-center text-center px-4 py-8 text-gray-400 text-sm">
                            <p>No lip-sync video yet.</p>
                            <p className="mt-1">Click "Lip Sync" below to generate and compare with the source video.</p>
                          </div>
                        )}

                        {isGeneratingLipSync && (
                          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                            <div className="text-center">
                              <div className="relative w-56 h-28 mb-4 overflow-hidden rounded-lg">
                                <svg
                                  className="absolute inset-0 w-full h-full"
                                  viewBox="0 0 400 200"
                                  preserveAspectRatio="none"
                                >
                                  <defs>
                                    <linearGradient id={`wave-gradient-preview-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
                                      <stop offset="50%" stopColor="rgba(99, 102, 241, 0.6)" />
                                      <stop offset="100%" stopColor="rgba(139, 92, 246, 0.4)" />
                                    </linearGradient>
                                  </defs>
                                  <path
                                    d="M0,100 Q100,50 200,100 T400,100 L400,200 L0,200 Z"
                                    fill={`url(#wave-gradient-preview-${idx})`}
                                    className="wave-path-1"
                                  />
                                  <path
                                    d="M0,120 Q100,70 200,120 T400,120 L400,200 L0,200 Z"
                                    fill={`url(#wave-gradient-preview-${idx})`}
                                    opacity="0.7"
                                    className="wave-path-2"
                                  />
                                  <path
                                    d="M0,140 Q100,90 200,140 T400,140 L400,200 L0,200 Z"
                                    fill={`url(#wave-gradient-preview-${idx})`}
                                    opacity="0.5"
                                    className="wave-path-3"
                                  />
                                </svg>
                              </div>
                              <p className="text-white text-sm font-semibold">Lip-sync video is being generated, please wait...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 下方：信息 + 对口型按钮 */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-gray-400">
                      Shot {idx + 1}
                    </div>
                    {/* Lip-sync button: only runs lip-sync on existing Sora video, no new Sora generation */}
                    <Button
                      disabled={!shotVideos[idx] || isGeneratingLipSync}
                      className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                      onClick={async () => {
                        const segment = storyboardSegments[idx];
                        const baseVideoUrl = shotVideos[idx] || null;

                        if (!segment || !baseVideoUrl) {
                          alert('Please generate a base video for this shot first.');
                          return;
                        }

                        try {
                          setGeneratingVideoShotIndex(idx);

                          const videoPrompt = segment.videoPrompt?.prompt || '';
                          const characterDescription = shotDescriptions[idx]?.characters || '';

                          const response = await fetch('/api/music/lip-sync', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              shotIndex: idx,
                              sourceVideoUrl: baseVideoUrl, // 使用已生成的视频进行对口型
                              videoPrompt: videoPrompt,
                              characterDescription: characterDescription,
                              orientation: orientation,
                              audioUrl: audioUrl,
                              audioStartTime: startTime,
                              audioEndTime: endTime,
                              segmentStart: segment.start,
                              segmentEnd: segment.end,
                            }),
                          });

                          if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.error || 'Lip sync failed');
                          }

                          const result = await response.json();
                          console.log('Lip sync success (preview dialog):', result);

                          if (result.success && result.data?.videoUrl) {
                            // 对口型视频单独存一份，优先显示
                            setShotLipSyncVideos(prev => ({
                              ...prev,
                              [idx]: result.data.videoUrl as string,
                            }));
                          }
                        } catch (error) {
                          console.error('Lip sync error (preview dialog):', error);
                          alert(error instanceof Error ? error.message : 'Lip sync failed, please try again.');
                        } finally {
                          setGeneratingVideoShotIndex(null);
                        }
                      }}
                    >
                      <Mic className="w-4 h-4" />
                      Lip Sync
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

