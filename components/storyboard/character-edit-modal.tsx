"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Sparkles, Loader2, Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { checkCreditsBalance, deductCredits } from "@/lib/credits/deduct";
import { InsufficientCreditsDialog } from "@/components/ui/insufficient-credits-dialog";
import { useToast } from "@/components/ui/toast-notification";

interface CharacterAppearance {
  hair_color: string;
  eye_color: string;
  hair_style: string;
  height: string;
  build: string;
  skin_tone: string;
  facial_features: string;
  distinct_marks: string;
}

interface CharacterClothing {
  style: string;
  accessories: string;
  footwear: string;
}

interface CharacterDetail {
  id: string;
  name: string;
  role: string;
  age: string;
  gender: string;
  appearance: CharacterAppearance;
  clothing: CharacterClothing;
  personality: string;
  background: string;
  skills_abilities?: string[]; // 可选，因为已移除
  relationships?: string[]; // 可选，因为已移除
  visual_reference_prompt?: string; // 可选，因为已移除
  pose_references?: string[]; // 可选
}

interface CharacterEditModalProps {
  character: CharacterDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (character: CharacterDetail) => void;
  onImageUpload: (file: File) => Promise<string | null>;
  onImageGenerate: (prompt: string) => Promise<string | null>;
  onImageUploadFromUrl: (url: string) => Promise<string | null>; // 从URL上传图片
  initialImageUrl?: string | null; // 初始图片URL
  visualStyle?: string; // 画面风格
  artSetting?: string; // 美术设定（比例）
}

export default function CharacterEditModal({
  character,
  isOpen,
  onClose,
  onSave,
  onImageUpload,
  onImageGenerate,
  onImageUploadFromUrl,
  initialImageUrl = null,
  visualStyle = "2d",
  artSetting = "16:9",
}: CharacterEditModalProps) {
  const { showError } = useToast();
  const [formData, setFormData] = useState<CharacterDetail | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]); // 生成的4张图片
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  // 积分不足弹窗状态
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [insufficientCreditsData, setInsufficientCreditsData] = useState<{
    required: number;
    current: number;
    action: string;
  } | null>(null);

  useEffect(() => {
    if (character) {
      // 调试：打印接收到的角色数据
      // 确保所有字段都有默认值，特别是嵌套对象
      const formDataToSet = {
        id: character.id || "",
        name: character.name || "",
        role: character.role || "",
        age: character.age || "",
        gender: character.gender || "",
        appearance: {
          hair_color: character.appearance?.hair_color || "",
          eye_color: character.appearance?.eye_color || "",
          hair_style: character.appearance?.hair_style || "",
          height: character.appearance?.height || "",
          build: character.appearance?.build || "",
          skin_tone: character.appearance?.skin_tone || "",
          facial_features: character.appearance?.facial_features || "",
          distinct_marks: character.appearance?.distinct_marks || "",
        },
        clothing: {
          style: character.clothing?.style || "",
          accessories: character.clothing?.accessories || "",
          footwear: character.clothing?.footwear || "",
        },
        personality: character.personality || "",
        background: character.background || "",
        skills_abilities: character.skills_abilities || [],
        relationships: character.relationships || [],
        visual_reference_prompt: character.visual_reference_prompt || "",
        pose_references: character.pose_references || [],
      };
      
      // 调试：打印设置的表单数据
      setFormData(formDataToSet);
      // 使用传入的初始图片URL
      setImageUrl(initialImageUrl);
      // 重置其他状态，避免切换角色时显示之前角色的数据
      setGeneratedImages([]);
      setSelectedImageIndex(null);
      setIsPolling(false);
      setTaskId(null);
    } else {
      setFormData(null);
      setImageUrl(null);
      setGeneratedImages([]);
      setSelectedImageIndex(null);
      setIsPolling(false);
      setTaskId(null);
    }
  }, [character?.id, initialImageUrl]); // 使用 character?.id 作为依赖，确保角色切换时触发

  const handleSave = async () => {
    if (!formData) {
      return;
    }
    
    // 构建图片生成提示词并保存到角色数据中
    const imageGenerationPrompt = buildImagePrompt(formData);
    // 检查是否选择了图片（包括已上传的图片或选择了生成的图片）
    // imageUrl: 已上传的图片URL
    // selectedImageIndex: 用户选择了生成的图片（但可能还没上传完成）
    const hasSelectedImage = imageUrl || (selectedImageIndex !== null && generatedImages.length > 0);
    
    if (!hasSelectedImage) {
      showError("Please create a character image before saving. Generate or upload an image first.");
      return; // 阻止保存，要求用户先创建图片
    }

    // 如果用户选择了生成的图片但还没上传，先上传
    // 优先使用用户最新选择的图片（selectedImageIndex），而不是旧的 imageUrl
    let finalImageUrl = imageUrl;
    // 如果用户选择了生成的图片，优先使用选择的图片（即使 imageUrl 不为空，也要使用新选择的）
    if (selectedImageIndex !== null && generatedImages.length > 0) {
      try {
        const selectedImageUrl = generatedImages[selectedImageIndex];
        // 如果 imageUrl 为空或者是旧的图片，需要上传新选择的图片
        if (!imageUrl || imageUrl !== selectedImageUrl) {
          const uploadedUrl = await onImageUploadFromUrl(selectedImageUrl);
          if (uploadedUrl) {
            finalImageUrl = uploadedUrl;
            setImageUrl(uploadedUrl);
          } else {
            // 如果上传失败，使用生成的图片URL（可能是临时URL）
            finalImageUrl = selectedImageUrl;
            // 也更新 imageUrl 状态，以便后续显示
            setImageUrl(selectedImageUrl);
          }
        } else {
          // imageUrl 已经是选中的图片，直接使用
          finalImageUrl = imageUrl;
        }
      } catch (error) {
        // 如果上传失败，使用生成的图片URL（至少可以显示）
        if (selectedImageIndex !== null && generatedImages.length > 0) {
          finalImageUrl = generatedImages[selectedImageIndex];
          setImageUrl(finalImageUrl);
          // 不阻止保存，至少图片可以显示
        } else {
          // 如果没有选择的图片，才阻止保存
          alert('Image upload failed. Please try again');
          return;
        }
      }
    } else if (!imageUrl) {
      // 如果没有选择图片且 imageUrl 为空，阻止保存
      alert('Please select or generate an image before saving');
      return;
    }
    // 保存时，将当前选中的图片URL和图片生成提示词一起保存
    const dataToSave = {
      ...formData,
      imageUrl: finalImageUrl || null, // 将图片URL添加到保存的数据中
      imageGenerationPrompt: imageGenerationPrompt, // 保存图片生成提示词
    };
    // 调用父组件的保存回调
    onSave(dataToSave);
    onClose();
  };

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await onImageUpload(file);
      if (url) {
        setImageUrl(url);
      }
    } catch (error) {
      alert("Image upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  // 清理和过滤敏感内容
  const sanitizeText = (text: string): string => {
    if (!text) return "";
    // 保留引号（用于身高等），移除其他可能触发内容审核的敏感词汇和符号
    return text
      .replace(/[^\w\s\u4e00-\u9fa5.,!?;:()\-'"]/g, '') // 保留字母、数字、中文、基本标点和引号
      .trim()
      .substring(0, 200); // 限制长度
  };

  // 根据角色信息构建图片生成提示词
  // 注意：使用传入的 visualStyle 和 artSetting props（来自设置页面）
  const buildImagePrompt = (character: CharacterDetail): string => {
    const parts: string[] = [];
    
    // 角色基本信息：名称、年龄、性别
    if (character.name && character.name.trim) {
      const name = String(character.name).trim();
      if (name) {
        parts.push(name);
      } else {
      }
    } else {
    }
    
    // 添加年龄和性别信息（如果有）
    const basicInfo: string[] = [];
    if (character.age !== undefined && character.age !== null && character.age !== '') {
      const ageStr = String(character.age).trim();
      if (ageStr) {
        basicInfo.push(`${ageStr}-year-old`);
      }
    }
    if (character.gender && typeof character.gender === 'string' && character.gender.trim()) {
      const genderStr = character.gender.trim();
      basicInfo.push(genderStr);
    }
    if (basicInfo.length > 0) {
      parts.push(basicInfo.join(' '));
    }
    
    // 只使用外观和服装信息，避免包含敏感内容的背景故事和性格描述
    // 外观信息：直接使用 Appearance Description（facial_features 字段）
    const appearance = character.appearance;
    if (appearance.facial_features && appearance.facial_features.trim()) {
      const appearanceText = sanitizeText(appearance.facial_features.trim());
      if (appearanceText) {
        parts.push(appearanceText);
      }
    }
    
    // 服装信息：直接使用 Clothing Description（style 字段）
    const clothing = character.clothing;
    if (clothing.style && clothing.style.trim()) {
      const clothingText = sanitizeText(clothing.style.trim());
      if (clothingText) {
        parts.push(clothingText);
      }
    }
    
    // 组合成完整的英文提示词
    let prompt = parts.join(', ');
    // 如果没有任何外观信息，使用默认描述
    if (!prompt.trim()) {
      prompt = "character design";
    }
    
    // 添加画面风格（visualStyle）- 使用设置页面的画风风格
    // 注意：visualStyle 和 artSetting 是从设置页面传递过来的 props
    // 映射关系必须与 project-create-form.tsx 中的 visualStyles 数组的 value 值一致
    const styleMap: Record<string, string> = {
      "2d": "2D animation style, flat illustration, traditional animation, hand-drawn",                    // 对应：2D动画
      "3d": "3D animation style, 3D rendered, CGI, computer-generated, three-dimensional",       // 对应：3D动漫
      "anime": "anime style, Japanese animation, manga-inspired, cel-shaded, vibrant colors",    // 对应：日本二次元
      "cyberpunk": "cyberpunk style, futuristic, neon lights, dystopian, high-tech low-life",    // 对应：赛博朋克
      "clay": "clay animation style, stop motion, tactile texture, handcrafted, three-dimensional clay figures",   // 对应：粘土动画
      "comic": "comic book style, Western comic, bold lines, dynamic poses, graphic novel aesthetic",    // 对应：美式漫画
      "cartoon": "cartoon style, animated, exaggerated features, playful, vibrant, stylized",          // 对应：卡通风格
      "realistic": "realistic 3D cartoon style, stylized realism, 3D rendered character, smooth surfaces, expressive features", // 对应：3D卡通（已移除可能涉及知识产权的描述）
    };
    // 使用设置页面的 visualStyle（来自 props）
    // 如果找不到对应的映射，使用默认值 "2d"
    const stylePrompt = styleMap[visualStyle] || styleMap["2d"] || "2D animation style";
    
    // 打印映射信息用于调试
    prompt += `, ${stylePrompt}`;
    // 添加美术设定（artSetting - 比例）- 使用设置页面的比例
    // 注意：artSetting 是从设置页面传递过来的 props
    const aspectRatioMap: Record<string, string> = {
      "16:9": "16:9 aspect ratio, widescreen",
      "9:16": "9:16 aspect ratio, vertical",
      "1:1": "1:1 aspect ratio, square",
      "4:3": "4:3 aspect ratio, traditional",
      "21:9": "21:9 aspect ratio, ultrawide",
    };
    // 使用设置页面的 artSetting（来自 props）
    const aspectRatioPrompt = aspectRatioMap[artSetting] || aspectRatioMap["16:9"] || "16:9 aspect ratio";
    prompt += `, ${aspectRatioPrompt}`;
    // 添加通用质量提示
    const qualityPrompt = 'cinematic lighting, ultra detailed, 4k illustration, consistent tone, professional character design, safe for work';
    prompt += `, ${qualityPrompt}`;
    const finalPrompt = prompt.trim();
    return finalPrompt;
  };

  const handleImageGenerate = async () => {
    if (!formData) {
      alert("Character information is incomplete");
      return;
    }
    
    // 检查必要的字段
    if (!formData.name && !formData.appearance.hair_color && !formData.appearance.eye_color) {
      alert("Please fill in at least character name or appearance information");
      return;
    }
    
    // Check credits balance before generating images (20 credits for 4 images)
    const creditsCheck = await checkCreditsBalance(20);
    if (!creditsCheck.sufficient) {
      setInsufficientCreditsData({
        required: 20,
        current: creditsCheck.balance || 0,
        action: "generate character images"
      });
      setShowInsufficientCreditsDialog(true);
      return;
    }
    
    setIsGenerating(true);
    setGeneratedImages([]);
    setSelectedImageIndex(null);
    
    try {
      // Deduct credits before generating images
      const deductResult = await deductCredits(
        20,
        "Generate character images (4 images)",
        { type: "character_image_generation", character_id: formData.id, character_name: formData.name }
      );

      if (!deductResult.success) {
        alert("Failed to deduct credits. Please try again.");
        setIsGenerating(false);
        return;
      }

      // Trigger credits update event to refresh header balance
      window.dispatchEvent(new Event("credits-updated"));
      
      // 根据角色信息构建提示词
      const prompt = buildImagePrompt(formData);
      
      // 打印提交的参数
      // 提交生成任务
      const response = await fetch('/api/scenes/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error || 'Failed to submit image generation task';
        
        // 检查是否是内容审核错误
        if (errorMessage.includes('DataInspectionFailed') || 
            errorMessage.includes('inappropriate content') ||
            errorMessage.includes('Content moderation')) {
          throw new Error('Prompt contains inappropriate content. Please modify character information (especially appearance description) and avoid sensitive terms');
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.success && result.data) {
        // 如果API立即返回图片（豆包同步API），直接使用
        if (result.data.immediate && result.data.images && Array.isArray(result.data.images)) {
          setGeneratedImages(result.data.images);
          setIsGenerating(false);
          setIsPolling(false);
          return;
        }
        
        // 否则使用异步任务ID进行轮询（兼容旧逻辑）
        if (result.data.taskId) {
          setTaskId(result.data.taskId);
          setIsPolling(true);
          
          // 开始轮询任务状态
          await pollImageStatus(result.data.taskId);
        } else {
          throw new Error('Failed to submit image generation task');
        }
      } else {
        throw new Error('Failed to submit image generation task');
      }
    } catch (error) {
      let errorMessage = "Image generation failed";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // 如果是内容审核错误，提供更详细的提示
        if (error.message.includes('不合适的内容') || 
            error.message.includes('DataInspectionFailed') ||
            error.message.includes('inappropriate content')) {
          errorMessage = "Prompt contains inappropriate content. Suggestions:\n1. Only fill in appearance and clothing information\n2. Avoid sensitive terms\n3. Use concise descriptions";
        }
      }
      
      alert(errorMessage);
      setIsGenerating(false);
      setIsPolling(false);
      setTaskId(null);
    }
  };

  const pollImageStatus = async (taskId: string) => {
    const maxAttempts = 40; // 最多轮询40次（约2分钟）
    const interval = 3000; // 每3秒轮询一次
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`/api/scenes/character-image-status?taskId=${taskId}`);
        if (!response.ok) {
          throw new Error('Failed to query image status');
        }

        const result = await response.json();
        if (result.success && result.data) {
          const { status, images } = result.data;
          
          if (status === 'SUCCEEDED' && images && images.length > 0) {
            // 生成成功，显示4张图片供选择
            setGeneratedImages(images);
            setIsPolling(false);
            setIsGenerating(false);
            return;
          } else if (status === 'FAILED' || status === 'CANCELED') {
            throw new Error(`Image generation ${status.toLowerCase()}`);
          }
          // 如果还在处理中，继续轮询
        }
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          alert('Image generation timed out. Please try again later');
          setIsPolling(false);
          setIsGenerating(false);
          return;
        }
      }
      
      // 等待后继续轮询
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    // 超时
    setIsPolling(false);
    setIsGenerating(false);
    alert('Image generation timed out. Please try again later');
  };

  const handleSelectImage = async (imageUrl: string, index: number) => {
    setSelectedImageIndex(index);
    // 用户选择图片后，上传到火山存储并更新角色信息
    try {
      const uploadedUrl = await onImageUploadFromUrl(imageUrl);
      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
        // 图片已通过 onImageUploadFromUrl 更新到角色卡片
      } else {
        // 如果上传失败，至少设置 imageUrl 为原始URL，以便保存时使用
        setImageUrl(imageUrl);
      }
    } catch (error) {
      // 即使上传失败，也设置 imageUrl，以便保存时使用
      setImageUrl(imageUrl);
      alert('Image upload failed, but the image will be saved with the original URL');
    }
  };

  if (!isOpen || !formData) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-700/50 backdrop-blur-xl"
        >
          {/* 头部 - 渐变背景 */}
          <div className="relative flex items-center justify-between px-8 py-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FFDA2A]/20 to-[#FFDA2A]/10 flex items-center justify-center border border-[#FFDA2A]/20">
                <Sparkles className="w-5 h-5 text-[#FFDA2A]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Edit Character</h2>
                <p className="text-xs text-gray-400 mt-0.5">Complete character information and generate unique appearance</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={handleSave}
                  disabled={!formData}
                  className="bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-bold h-11 px-8 shadow-lg shadow-[#FFDA2A]/30 text-base"
                >
                  Save
                </Button>
              </motion.div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800/50 rounded-lg transition-all hover:scale-110"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
          </div>

          {/* 内容区域 - 可滚动 */}
          <div className="flex-1 overflow-y-auto p-8">
            {/* 左右两列布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
              {/* 左边：图片区域 */}
              <div className="lg:sticky lg:top-8 lg:self-start -mt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1 h-5 bg-gradient-to-b from-[#FFDA2A] to-[#FFDA2A]/50 rounded-full"></div>
                    <label className="text-sm font-semibold text-gray-300">Character Appearance</label>
                  </div>
                  <div className="relative group">
                    <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl overflow-hidden border-2 border-gray-700/50 shadow-xl" style={{ aspectRatio: '9/16', maxHeight: '400px' }}>
                      {imageUrl ? (
                        <>
                          <img
                            src={imageUrl}
                            alt={formData.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <button
                            onClick={() => setImageUrl(null)}
                            className="absolute top-3 right-3 p-2 bg-red-500/90 hover:bg-red-500 text-white rounded-full transition-all hover:scale-110 shadow-lg opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                          <div className="text-center p-6">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FFDA2A]/20 to-[#FFDA2A]/10 flex items-center justify-center border-2 border-[#FFDA2A]/20">
                              <Sparkles className="w-10 h-10 text-[#FFDA2A]/50" />
                            </div>
                            <p className="text-sm text-gray-400 font-medium">Waiting for AI appearance</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 右边：角色信息字段 */}
              <div className="space-y-6">
                {/* 基本信息卡片 */}
                <div className="bg-gradient-to-br from-gray-800/30 to-gray-900/30 rounded-xl p-6 border border-gray-700/30 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 bg-gradient-to-b from-[#FFDA2A] to-[#FFDA2A]/50 rounded-full"></div>
                    <h3 className="text-sm font-semibold text-gray-300">Basic Information</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-2 block">Character name</label>
                      <Input
                        value={formData?.name || ""}
                        onChange={(e) =>
                          formData && setFormData({ ...formData, name: e.target.value })
                        }
                        className="bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-[#FFDA2A]/50 focus:ring-1 focus:ring-[#FFDA2A]/20 h-10"
                        placeholder="Enter character name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-2 block">age</label>
                        <Input
                          value={formData?.age || ""}
                          onChange={(e) =>
                            formData && setFormData({ ...formData, age: e.target.value })
                          }
                          className="bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-[#FFDA2A]/50 focus:ring-1 focus:ring-[#FFDA2A]/20 h-10"
                          placeholder="e.g. 18"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-400 mb-2 block">gender</label>
                        <Select
                          value={formData?.gender || ""}
                          onValueChange={(value) =>
                            formData && setFormData({ ...formData, gender: value })
                          }
                        >
                          <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-white h-10 focus:border-[#FFDA2A]/50 focus:ring-1 focus:ring-[#FFDA2A]/20">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-white">
                            <SelectItem value="male">male</SelectItem>
                            <SelectItem value="female">female</SelectItem>
                            <SelectItem value="non-binary">non-binary</SelectItem>
                            {/* 如果当前值不在选项中，动态添加 */}
                            {formData?.gender && 
                             !["male", "female", "non-binary"].includes(formData.gender) && (
                              <SelectItem value={formData.gender}>{formData.gender}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {/* 调试：显示当前gender值 */}
                        {process.env.NODE_ENV === 'development' && (
                          <p className="text-xs text-gray-500 mt-1">Debug: gender = "{formData?.gender}"</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {/* 图片生成区域 */}
                {generatedImages.length > 0 && (
                  <div className="bg-gradient-to-br from-gray-800/30 to-gray-900/30 rounded-xl p-6 border border-gray-700/30 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-4 bg-gradient-to-b from-[#FFDA2A] to-[#FFDA2A]/50 rounded-full"></div>
                      <h3 className="text-sm font-semibold text-gray-300">Select generated image</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {generatedImages.map((imgUrl, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all group ${
                            selectedImageIndex === index
                              ? "border-[#FFDA2A] ring-2 ring-[#FFDA2A]/30 shadow-lg shadow-[#FFDA2A]/20"
                              : "border-gray-700/50 hover:border-gray-600"
                          }`}
                          onClick={() => handleSelectImage(imgUrl, index)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <img
                            src={imgUrl}
                            alt={`Generated image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {selectedImageIndex === index && (
                            <div className="absolute inset-0 bg-gradient-to-t from-[#FFDA2A]/30 via-transparent to-transparent flex items-center justify-center">
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-8 h-8 bg-[#FFDA2A] rounded-full flex items-center justify-center shadow-lg"
                              >
                                <svg
                                  className="w-5 h-5 text-gray-900"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="3"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </motion.div>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded-md text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            {index + 1}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 详细信息区域 */}
                <div className="space-y-6">
                  {/* 外观 */}
                  <div className="bg-gradient-to-br from-gray-800/30 to-gray-900/30 rounded-xl p-6 border border-gray-700/30 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-4 bg-gradient-to-b from-[#FFDA2A] to-[#FFDA2A]/50 rounded-full"></div>
                      <h3 className="text-sm font-semibold text-gray-300">Appearance Description</h3>
                    </div>
                    <Textarea
                      value={(() => {
                        if (!formData?.appearance) return "";
                        const app = formData.appearance;
                        
                        // 如果 facial_features 包含完整的外观描述（新格式），直接显示
                        if (app.facial_features && !app.hair_color && !app.eye_color && !app.hair_style) {
                          return app.facial_features;
                        }
                        
                        // 否则，从各个字段组合成文本（旧格式）
                        const parts = [];
                        if (app.hair_color) parts.push(`Hair color: ${app.hair_color}`);
                        if (app.hair_style) parts.push(`Hair style: ${app.hair_style}`);
                        if (app.eye_color) parts.push(`Eye color: ${app.eye_color}`);
                        if (app.height) parts.push(`Height: ${app.height}`);
                        if (app.build) parts.push(`Build: ${app.build}`);
                        if (app.skin_tone) parts.push(`Skin tone: ${app.skin_tone}`);
                        if (app.facial_features) parts.push(`Facial features: ${app.facial_features}`);
                        if (app.distinct_marks) parts.push(`Distinct marks: ${app.distinct_marks}`);
                        return parts.join("\n");
                      })()}
                      onChange={(e) => {
                        if (!formData) return;
                        const text = e.target.value;
                        
                        // 检查是否是结构化格式（包含"："分隔符）
                        const hasStructuredFormat = text.includes("：") || text.includes(":");
                        
                        if (!hasStructuredFormat && text.trim()) {
                          // 如果是纯文本格式（新格式），直接存储到 facial_features
                          setFormData({
                            ...formData,
                            appearance: {
                              hair_color: "",
                              eye_color: "",
                              hair_style: "",
                              height: "",
                              build: "",
                              skin_tone: "",
                              facial_features: text,
                              distinct_marks: "",
                            },
                          });
                          return;
                        }
                        
                        // 否则，解析文本，提取各个字段（旧格式）
                        const lines = text.split("\n").filter(line => line.trim());
                        const appearance: CharacterAppearance = {
                          hair_color: "",
                          eye_color: "",
                          hair_style: "",
                          height: "",
                          build: "",
                          skin_tone: "",
                          facial_features: "",
                          distinct_marks: "",
                        };
                        
                        lines.forEach(line => {
                          const match = line.match(/^([^：:]+)[：:]\s*(.+)$/);
                          if (match) {
                            const key = match[1].trim();
                            const value = match[2].trim();
                            if (key === "Hair color" || key === "发色") appearance.hair_color = value;
                            else if (key === "hairstyle" || key === "Hair style" || key === "发型") appearance.hair_style = value;
                            else if (key === "Eye color" || key === "眼色") appearance.eye_color = value;
                            else if (key === "Height" || key === "身高") appearance.height = value;
                            else if (key === "Build" || key === "体型") appearance.build = value;
                            else if (key === "Skin tone" || key === "肤色") appearance.skin_tone = value;
                            else if (key === "Facial features" || key === "面部特征") appearance.facial_features = value;
                            else if (key === "Distinct marks" || key === "特殊标记") appearance.distinct_marks = value;
                          }
                        });
                        
                        setFormData({
                          ...formData,
                          appearance,
                        });
                      }}
                      placeholder={`e.g.:\nHair color: Black\nHair style: Short\nEye color: Brown\nHeight: 175cm\nBuild: Medium\nSkin tone: Fair`}
                      className="bg-gray-800/50 border-gray-700/50 text-white text-sm placeholder:text-gray-500 focus:border-[#FFDA2A]/50 focus:ring-1 focus:ring-[#FFDA2A]/20 min-h-[140px] resize-none"
                      rows={6}
                    />
                  </div>

                  {/* 服装 */}
                  <div className="bg-gradient-to-br from-gray-800/30 to-gray-900/30 rounded-xl p-6 border border-gray-700/30 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-4 bg-gradient-to-b from-[#FFDA2A] to-[#FFDA2A]/50 rounded-full"></div>
                      <h3 className="text-sm font-semibold text-gray-300">Clothing Description</h3>
                    </div>
                    <Textarea
                      value={(() => {
                        if (!formData?.clothing) return "";
                        const cloth = formData.clothing;
                        
                        // 如果 style 包含完整的服装描述（新格式），且其他字段为空，直接显示
                        if (cloth.style && !cloth.accessories && !cloth.footwear && 
                            (!cloth.style.includes("：") && !cloth.style.includes(":"))) {
                          return cloth.style;
                        }
                        
                        // 否则，从各个字段组合成文本（旧格式）
                        const parts = [];
                        if (cloth.style) parts.push(`Style: ${cloth.style}`);
                        if (cloth.accessories) parts.push(`Accessories: ${cloth.accessories}`);
                        if (cloth.footwear) parts.push(`Footwear: ${cloth.footwear}`);
                        return parts.join("\n");
                      })()}
                      onChange={(e) => {
                        if (!formData) return;
                        const text = e.target.value;
                        
                        // 检查是否是结构化格式（包含"："分隔符）
                        const hasStructuredFormat = text.includes("：") || text.includes(":");
                        
                        if (!hasStructuredFormat && text.trim()) {
                          // 如果是纯文本格式（新格式），直接存储到 style
                          setFormData({
                            ...formData,
                            clothing: {
                              style: text,
                              accessories: "",
                              footwear: "",
                            },
                          });
                          return;
                        }
                        
                        // 否则，解析文本，提取各个字段（旧格式）
                        const lines = text.split("\n").filter(line => line.trim());
                        const clothing: CharacterClothing = {
                          style: "",
                          accessories: "",
                          footwear: "",
                        };
                        
                        lines.forEach(line => {
                          const match = line.match(/^([^：:]+)[：:]\s*(.+)$/);
                          if (match) {
                            const key = match[1].trim();
                            const value = match[2].trim();
                            if (key === "Style" || key === "风格") clothing.style = value;
                            else if (key === "Accessories" || key === "配饰") clothing.accessories = value;
                            else if (key === "Footwear" || key === "鞋履") clothing.footwear = value;
                          }
                        });
                        
                        setFormData({
                          ...formData,
                          clothing,
                        });
                      }}
                      placeholder={`e.g.:\nStyle: Casual wear\nAccessories: Watch\nFootwear: Sneakers`}
                      className="bg-gray-800/50 border-gray-700/50 text-white text-sm placeholder:text-gray-500 focus:border-[#FFDA2A]/50 focus:ring-1 focus:ring-[#FFDA2A]/20 min-h-[120px] resize-none"
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 底部按钮 - 渐变背景 */}
          <div className="relative flex items-center justify-between gap-4 px-8 py-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-t border-gray-700/50">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                onClick={handleImageGenerate}
                disabled={isGenerating || isUploading || isPolling || !formData}
                className="bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-semibold h-10 px-4 shadow-lg shadow-[#FFDA2A]/20"
              >
                {isGenerating || isPolling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isPolling ? "Generating..." : "Submitting..."}
                  </> 
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span>{imageUrl ? "Regenerate" : "Generate Image"}</span>
                    <Diamond className="w-4 h-4 ml-2" />
                    <span className="text-xs ml-1">20</span>
                  </>
                )}
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={onClose}
                className="bg-gray-800/80 hover:bg-gray-700/80 text-white border border-gray-700/50 h-10 px-6"
              >
                Cancel
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
      
      {/* Insufficient Credits Dialog */}
      {insufficientCreditsData && (
        <InsufficientCreditsDialog
          open={showInsufficientCreditsDialog}
          onOpenChange={setShowInsufficientCreditsDialog}
          requiredCredits={insufficientCreditsData.required}
          currentBalance={insufficientCreditsData.current}
          action={insufficientCreditsData.action}
        />
      )}
    </AnimatePresence>
  );
}

