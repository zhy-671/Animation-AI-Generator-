"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2, Diamond, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkCreditsBalance, deductCredits } from "@/lib/credits/deduct";
import { InsufficientCreditsDialog } from "@/components/ui/insufficient-credits-dialog";
import { useToast } from "@/components/ui/toast-notification";

interface SceneImageGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneLocation: string;
  sceneDescription?: string;
  projectId?: string | null;
  sceneId?: string | null;
  onImageSelect: (imageUrl: string) => Promise<void>;
  onLocationUpdate?: (location: string) => Promise<void>;
}

export default function SceneImageGenerateModal({
  isOpen,
  onClose,
  sceneLocation,
  sceneDescription = "",
  projectId,
  sceneId,
  onImageSelect,
  onLocationUpdate,
}: SceneImageGenerateModalProps) {
  const { showError, showSuccess } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  // 积分不足弹窗状态
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [insufficientCreditsData, setInsufficientCreditsData] = useState<{
    required: number;
    current: number;
    action: string;
  } | null>(null);
  
  // Scene Location 编辑状态
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editingLocationValue, setEditingLocationValue] = useState("");
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(sceneLocation);
  
  // 当sceneLocation prop变化时更新currentLocation
  useEffect(() => {
    setCurrentLocation(sceneLocation);
  }, [sceneLocation]);

  // 开始编辑Scene Location
  const handleStartEditLocation = () => {
    setEditingLocationValue(currentLocation);
    setIsEditingLocation(true);
  };

  // 取消编辑Scene Location
  const handleCancelEditLocation = () => {
    setIsEditingLocation(false);
    setEditingLocationValue("");
  };

  // 保存Scene Location
  const handleSaveLocation = async () => {
    if (!sceneId) {
      showError("Scene ID is required");
      return;
    }

    setIsSavingLocation(true);
    try {
      // 调用API更新场次数据
      const response = await fetch(`/api/scenes/items/${sceneId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata: {
            场次地点: editingLocationValue,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Save failed");
      }

      // 更新本地状态
      setCurrentLocation(editingLocationValue);
      setIsEditingLocation(false);
      setEditingLocationValue("");
      
      // 调用父组件的回调函数
      if (onLocationUpdate) {
        await onLocationUpdate(editingLocationValue);
      }
      
      showSuccess("Scene Location saved successfully");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSavingLocation(false);
    }
  };

  // 构建场景图生成提示词
  const buildScenePrompt = (): string => {
    const parts: string[] = [];
    
    // 场景地点作为主要参数（优先级最高）
    const location = isEditingLocation ? editingLocationValue : currentLocation;
    if (location && location.trim()) {
      // Scene Location 是核心，放在最前面并强调
      parts.push(`Scene Location: ${location.trim()}`);
    }
    
    // 场景描述作为补充信息
    if (sceneDescription && sceneDescription.trim()) {
      parts.push(sceneDescription.trim());
    }
    
    // 组合提示词
    let prompt = parts.join(", ");
    if (!prompt.trim()) {
      prompt = "scene, environment, location";
    }
    
    // 添加通用质量提示
    const qualityPrompt = 'cinematic lighting, ultra detailed, 4k illustration, consistent tone, professional scene design, safe for work';
    prompt += `, ${qualityPrompt}`;
    
    return prompt.trim();
  };

  const handleImageGenerate = async () => {
    // 验证 Scene Location 是否已填写
    const location = isEditingLocation ? editingLocationValue : currentLocation;
    if (!location || !location.trim()) {
      showError("Please fill in Scene Location before generating scene images");
      return;
    }
    
    // 如果正在编辑，先保存
    if (isEditingLocation) {
      await handleSaveLocation();
    }

    // Check credits balance before generating images (20 credits for 4 images)
    const creditsCheck = await checkCreditsBalance(20);
    if (!creditsCheck.sufficient) {
      setInsufficientCreditsData({
        required: 20,
        current: creditsCheck.balance || 0,
        action: "generate scene images"
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
        "Generate scene images (4 images)",
        { type: "scene_image_generation", scene_location: sceneLocation }
      );

      if (!deductResult.success) {
        alert("Failed to deduct credits. Please try again.");
        setIsGenerating(false);
        return;
      }

      // Trigger credits update event to refresh header balance
      window.dispatchEvent(new Event("credits-updated"));
      
      // 构建提示词
      const prompt = buildScenePrompt();
      
      // 提交生成任务（传递 prompt、sceneLocation 和 project_id）
      const response = await fetch('/api/scenes/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt,
          sceneLocation: (isEditingLocation ? editingLocationValue : currentLocation) || undefined, // 单独传递 Scene Location 以便 API 处理
          project_id: projectId || undefined, // 传递项目ID以获取项目设置
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error || 'Failed to submit image generation task';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.success && result.data) {
        // 如果API立即返回图片（豆包同步API），直接使用
        if (result.data.immediate && result.data.images && Array.isArray(result.data.images)) {
          setGeneratedImages(result.data.images);
          setIsGenerating(false);
          return;
        }
        
        // 否则使用异步任务ID进行轮询（兼容旧逻辑）
        if (result.data.taskId) {
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
      }
      
      showError(errorMessage);
      setIsGenerating(false);
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
            setIsGenerating(false);
            return;
          } else if (status === 'FAILED' || status === 'CANCELED') {
            throw new Error(`Image generation ${status.toLowerCase()}`);
          }
          // 如果还在处理中，继续轮询
        }
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          showError('Image generation timed out. Please try again later');
          setIsGenerating(false);
          return;
        }
      }
      
      // 等待后继续轮询
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    // 超时
    setIsGenerating(false);
    showError('Image generation timed out. Please try again later');
  };

  const handleSelectImage = async (imageUrl: string, index: number) => {
    setSelectedImageIndex(index);
    try {
      // 上传图片到火山存储
      const response = await fetch('/api/scenes/upload-image-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const result = await response.json();
      if (result.success && result.data && result.data.url) {
        // 调用回调函数，将图片URL传递给父组件
        await onImageSelect(result.data.url);
        onClose();
      } else {
        throw new Error('Failed to upload image');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image';
      showError(errorMessage);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-700/50 backdrop-blur-xl"
        >
          {/* 头部 */}
          <div className="relative flex items-center justify-between px-8 py-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FFDA2A]/20 to-[#FFDA2A]/10 flex items-center justify-center border border-[#FFDA2A]/20">
                <Sparkles className="w-5 h-5 text-[#FFDA2A]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Generate Scene Image</h2>
                <p className="text-xs text-gray-400 mt-0.5">Select one of the generated images</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800/50 rounded-lg transition-all hover:scale-110"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto p-8">
            {generatedImages.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-gradient-to-b from-[#FFDA2A] to-[#FFDA2A]/50 rounded-full"></div>
                    <h3 className="text-sm font-semibold text-gray-300">Select one of 4 generated images</h3>
                  </div>
                  
                  {/* Scene Location 编辑区域 */}
                  <div className="flex items-start gap-2">
                    <div className="text-xs text-gray-400 pt-2">Scene Location:</div>
                    {isEditingLocation ? (
                      <div className="flex items-start gap-2 flex-1">
                        <textarea
                          value={editingLocationValue}
                          onChange={(e) => setEditingLocationValue(e.target.value)}
                          className="flex-1 min-w-[300px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFDA2A]/50 resize-none"
                          rows={4}
                          autoFocus
                          placeholder="Enter scene location"
                        />
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={handleSaveLocation}
                            disabled={isSavingLocation}
                            className="bg-green-600 hover:bg-green-700 text-white h-7 w-7 p-0 flex items-center justify-center disabled:opacity-50"
                            title="Save"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={handleCancelEditLocation}
                            disabled={isSavingLocation}
                            className="bg-gray-600 hover:bg-gray-700 text-white h-7 w-7 p-0 flex items-center justify-center disabled:opacity-50"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="text-sm text-gray-300 cursor-pointer hover:text-[#FFDA2A] transition-colors flex-1"
                        onClick={handleStartEditLocation}
                        title="Click to edit"
                      >
                        {currentLocation && currentLocation.trim() ? currentLocation : "Not set"}
                      </div>
                    )}
                  </div>
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
                        alt={`Generated scene image ${index + 1}`}
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
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FFDA2A]/20 to-[#FFDA2A]/10 flex items-center justify-center border-2 border-[#FFDA2A]/20">
                  <Sparkles className="w-10 h-10 text-[#FFDA2A]/50" />
                </div>
                <p className="text-sm text-gray-400 font-medium mb-2">Click Generate to create 4 scene images</p>
                
                {/* Scene Location 编辑区域 */}
                <div className="mt-4 w-full max-w-md">
                  <div className="text-xs text-gray-400 mb-2 text-center">Scene Location</div>
                  {isEditingLocation ? (
                    <div className="flex items-start gap-2">
                      <textarea
                        value={editingLocationValue}
                        onChange={(e) => setEditingLocationValue(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFDA2A]/50 resize-none"
                        rows={4}
                        autoFocus
                        placeholder="Enter scene location"
                      />
                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={handleSaveLocation}
                          disabled={isSavingLocation}
                          className="bg-green-600 hover:bg-green-700 text-white h-9 w-9 p-0 flex items-center justify-center disabled:opacity-50"
                          title="Save"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={handleCancelEditLocation}
                          disabled={isSavingLocation}
                          className="bg-gray-600 hover:bg-gray-700 text-white h-9 w-9 p-0 flex items-center justify-center disabled:opacity-50"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="text-center cursor-pointer hover:text-[#FFDA2A] transition-colors"
                      onClick={handleStartEditLocation}
                      title="Click to edit"
                    >
                      {currentLocation && currentLocation.trim() ? (
                        <p className="text-xs text-gray-300">{currentLocation}</p>
                      ) : (
                        <p className="text-xs text-amber-500">Please fill in Scene Location first</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="relative flex items-center justify-between gap-4 px-8 py-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-t border-gray-700/50">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                onClick={handleImageGenerate}
                disabled={isGenerating || isSavingLocation}
                className="bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-semibold h-10 px-4 shadow-lg shadow-[#FFDA2A]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span>Generate 4 Images</span>
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

