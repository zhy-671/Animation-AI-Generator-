"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { deductImageCredits, deductVideoCredits, checkCreditsBalance, deductStoryboardCredits } from "@/lib/credits/deduct";
import { getImageCredits, getVideoCredits } from "@/lib/credits/rules";
import { getUserSubscriptionPlan } from "@/lib/subscription/client";
import { 
  getSubscriptionPlanConfig, 
  isResolutionAllowed, 
  isAnimationStyleAllowed,
  calculateVideoCredits,
  type SubscriptionPlan 
} from "@/lib/subscription/rules";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Sparkles, Type, Image as ImageIcon, Video, ChevronDown, ChevronUp, Diamond, Info, Coins, Clock } from "lucide-react";
import { InsufficientCreditsDialog } from "@/components/ui/insufficient-credits-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FormData {
  inputType: "text" | "image" | "storyboard";
  textPrompt: string;
  image: File | null;
  startFrame: File | null;
  endFrame: File | null;
  referenceImage: File | null; // 参考图（用于故事剧本生成）
  readerGroup: "Children" | "Teen" | "Adult" | "All Ages";
  model: string;
  duration: string;
  quality: string;
}

interface GeneratedImage {
  id: string;
  imageUrl: string | null;
  text: string;
  sceneDetail?: string; // 画面描述
  sceneTitle?: string; // 场景标题
  camera?: string; // 镜头语言
  dialogue?: string[]; // 对白
  sceneDuration?: string; // 场景持续时间（秒）
  sceneNumber: number;
  videoUrl?: string;
  isGeneratingVideo?: boolean;
  sceneItemId?: string; // 数据库中的分镜项ID
  imageTaskId?: string | null; // 图像生成任务ID（用于轮询状态）
  isGeneratingImage?: boolean; // 是否正在生成图像
  imageGenerationFailed?: boolean; // 图片生成是否失败
  imageStatus?: 'pending' | 'generating' | 'completed' | 'failed'; // 图片生成状态
}

interface AnimationGeneratorFormProps {
  isStoryboardMode?: boolean; // 是否为故事剧本模式
}

export default function AnimationGeneratorForm({ isStoryboardMode = false }: AnimationGeneratorFormProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  
  // 使用默认值，如果是故事剧本模式则设置为 "storyboard"
  const [formData, setFormData] = useState<FormData>({
    inputType: isStoryboardMode ? "storyboard" : "text",
    textPrompt: "",
    image: null,
    startFrame: null,
    endFrame: null,
    referenceImage: null,
    readerGroup: "All Ages",
    model: "2d", // 默认值改为 2d
    duration: "5",
    quality: "480p"
  });

  const [preview, setPreview] = useState<string | null>(null);
  const [startFramePreview, setStartFramePreview] = useState<string | null>(null);
  const [endFramePreview, setEndFramePreview] = useState<string | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null); // 当前分镜的ID
  const [isSceneMode, setIsSceneMode] = useState(isStoryboardMode); // 故事剧本模式，如果从故事剧本页面进入则默认选中
  const [activeTab, setActiveTab] = useState<"explore" | "my-creations">("explore");
  const [videos, setVideos] = useState<Array<{ url: string; filename: string; title: string }>>([]); // Explore 示例视频
  const [myVideos, setMyVideos] = useState<Array<{ url: string; filename: string; title: string }>>([]); // My Creations 用户视频
  const [isMounted, setIsMounted] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  
  // 当前正在生成图片的索引（用于显示状态）
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState<number | null>(null);
  
  // 视频加载失败状态跟踪
  const [failedVideoUrls, setFailedVideoUrls] = useState<Set<string>>(new Set());
  
  // 积分余额状态
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  
  // 订阅计划状态
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(null);
  
  // 积分不足弹窗状态
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [insufficientCreditsData, setInsufficientCreditsData] = useState<{
    required: number;
    current: number;
    action: string;
  } | null>(null);
  
  // 文生视频进度状态
  const [textToVideoProgress, setTextToVideoProgress] = useState<{
    status: 'idle' | 'generating' | 'polling' | 'completed' | 'error';
    message: string;
    videoUrl?: string;
    taskId?: string;
  }>({
    status: 'idle',
    message: ''
  });

  // 设置按钮背景色
  useEffect(() => {
    if (buttonRef.current) {
      buttonRef.current.style.setProperty('background-color', '#FFDA2A', 'important');
      buttonRef.current.style.setProperty('background', '#FFDA2A', 'important');
    }
  }, []);

  // 加载订阅计划和积分余额
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // 加载订阅计划
        const planData = await getUserSubscriptionPlan();
        if (planData.plan !== undefined) {
          setSubscriptionPlan(planData.plan);
        }
        
        // 加载积分余额
        const balanceCheck = await checkCreditsBalance(0);
        if (balanceCheck.balance !== undefined) {
          setCreditsBalance(balanceCheck.balance);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };
    
    if (isMounted) {
      loadUserData();
    }
  }, [isMounted]);

  // 客户端挂载后设置标志
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 页面加载时恢复分镜预览（如果之前有未完成的任务）
  useEffect(() => {
    const restoreScenePreview = async () => {
      if (!isMounted) return;
      
      try {
        // 1. 检查localStorage中是否有保存的sceneId
        const savedSceneId = localStorage.getItem('currentSceneId');
        if (!savedSceneId) return;
        
        // 2. 从数据库加载分镜数据
        const response = await fetch(`/api/scenes?sceneId=${savedSceneId}`);
        if (!response.ok) {
          console.warn('Failed to load scene:', savedSceneId);
          localStorage.removeItem('currentSceneId');
          return;
        }
        
        const result = await response.json();
        if (!result.success || !result.data) {
          console.warn('Scene not found:', savedSceneId);
          localStorage.removeItem('currentSceneId');
          return;
        }
        
        const sceneData = result.data;
        
        // 3. 检查是否有分镜项
        if (!sceneData.items || sceneData.items.length === 0) {
          console.warn('Scene has no items:', savedSceneId);
          return;
        }
        
        // 4. 检查是否有图片还在生成中（image_url为null）
        const hasGeneratingImages = sceneData.items.some((item: any) => !item.image_url);
        
        // 5. 映射数据到前端状态
        const restoredImages: GeneratedImage[] = await Promise.all(
          sceneData.items.map(async (item: any) => {
            const metadata = item.metadata || {};
            let imageUrl = item.image_url || null;
            
            // 确保 imageUrl 不是空字符串
            const finalImageUrl = imageUrl && imageUrl.trim() !== '' ? imageUrl : null;
            
            // 如果是 TOS URL，重新生成预签名 URL 以确保可以显示
            let displayImageUrl = finalImageUrl;
            if (finalImageUrl) {
              // 检查是否是 TOS URL（不依赖环境变量，直接检查 URL 特征）
              const isTosUrl = finalImageUrl.includes('tos-') || finalImageUrl.includes('.volces.com');
              
              if (isTosUrl) {
                try {
                  // 调用 API 获取新的预签名 URL
                  const presignedResponse = await fetch(`/api/scenes/presigned-image-url?imageUrl=${encodeURIComponent(finalImageUrl)}`);
                  if (presignedResponse.ok) {
                    const presignedResult = await presignedResponse.json();
                    if (presignedResult.success && presignedResult.data?.imageUrl) {
                      displayImageUrl = presignedResult.data.imageUrl;
                      console.log('Generated new presigned URL for display:', displayImageUrl);
                    }
                  }
                } catch (error) {
                  console.error('Error generating presigned URL for display:', error);
                  // 如果失败，使用原始 URL
                }
              }
            }
            
            // 调试日志：检查图片URL
            console.log('Restoring scene item:', {
              id: item.id,
              scene_number: item.scene_number,
              image_url: item.image_url,
              imageUrl: displayImageUrl,
              hasImageUrl: !!displayImageUrl,
            });
            
            return {
              id: item.id,
              imageUrl: displayImageUrl, // 使用新的预签名 URL 或原始 URL
              text: item.text || '',
              sceneDetail: item.scene_detail || item.text || '',
              sceneTitle: metadata.scene_title || '',
              camera: metadata.camera || '',
              dialogue: metadata.dialogue || [],
              sceneDuration: metadata.scene_duration || '',
              sceneNumber: item.scene_number,
              videoUrl: item.video_url || undefined,
              isGeneratingVideo: false,
              isGeneratingImage: !displayImageUrl && hasGeneratingImages, // 如果图片还在生成中
              imageGenerationFailed: false,
              sceneItemId: item.id,
              imageStatus: displayImageUrl ? ('completed' as const) : (hasGeneratingImages ? ('pending' as const) : ('failed' as const)),
            };
          })
        );
        
        // 6. 恢复状态
        setCurrentSceneId(savedSceneId);
        setGeneratedImages(restoredImages);
        setIsSceneMode(true); // 确保分镜模式是开启的
        
        // 7. 如果有图片还在生成中，显示提示
        if (hasGeneratingImages) {
          console.log('Some images are still generating, scene restored from database');
          // 注意：图片生成是在后端异步进行的，前端不需要轮询
          // 如果图片还在生成中，用户刷新页面后可以看到分镜脚本，但图片可能还未生成完成
        }
        
        // 8. 滚动到分镜预览区域
        setTimeout(() => {
          const previewSection = document.getElementById('scene-preview-section');
          if (previewSection) {
            previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
        
        console.log('Scene preview restored:', savedSceneId, restoredImages.length, 'items');
      } catch (error) {
        console.error('Error restoring scene preview:', error);
        localStorage.removeItem('currentSceneId');
      }
    };
    
    restoreScenePreview();
  }, [isMounted]);

  // 客户端挂载后，根据路径设置输入类型（避免 hydration 错误）
  useEffect(() => {
    if (isMounted && pathname) {
      const newType = pathname.includes('image-to-video') ? 'image' : 'text';
      setFormData(prev => {
        if (prev.inputType !== newType) {
          return { ...prev, inputType: newType as "text" | "image" };
        }
        return prev;
      });
    }
  }, [pathname, isMounted]);

  // 加载示例视频列表（Explore tab）
  useEffect(() => {
    let mounted = true;
    fetch('/api/videos')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP error! status: ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (!mounted) return;
        console.log('Fetched videos data:', data);
        if (data.error) {
          console.error('API returned error:', data.error);
        }
        setVideos(Array.isArray(data?.videos) ? data.videos.slice(0, 20) : []);
      })
      .catch((error) => {
        console.error('Error fetching videos:', error);
        setVideos([]);
      });
    return () => { mounted = false; };
  }, []);

  // 加载用户自己的视频列表（My Creations tab）
  useEffect(() => {
    let mounted = true;
    fetch('/api/videos/my-creations')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP error! status: ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (!mounted) return;
        console.log('Fetched my videos data:', data);
        if (data.error) {
          console.error('API returned error:', data.error);
        }
        setMyVideos(Array.isArray(data?.videos) ? data.videos : []);
      })
      .catch((error) => {
        console.error('Error fetching my videos:', error);
        setMyVideos([]);
      });
    return () => { mounted = false; };
  }, []);

  const handleImageUpload = (file: File) => {
    if (file) {
      setFormData(prev => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartFrameUpload = (file: File) => {
    if (file) {
      setFormData(prev => ({ ...prev, startFrame: file }));
      const reader = new FileReader();
      reader.onload = (e) => {
        setStartFramePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEndFrameUpload = (file: File) => {
    if (file) {
      setFormData(prev => ({ ...prev, endFrame: file }));
      const reader = new FileReader();
      reader.onload = (e) => {
        setEndFramePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReferenceImageUpload = (file: File) => {
    if (file) {
      setFormData(prev => ({ ...prev, referenceImage: file }));
      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    setFormData(prev => ({ ...prev, referenceImage: null }));
    setReferenceImagePreview(null);
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image: null }));
    setPreview(null);
  };

  const removeStartFrame = () => {
    setFormData(prev => ({ ...prev, startFrame: null }));
    setStartFramePreview(null);
  };

  const removeEndFrame = () => {
    setFormData(prev => ({ ...prev, endFrame: null }));
    setEndFramePreview(null);
  };

  const handleTabChange = (value: string) => {
    if (value === 'storyboard') {
      router.push('/storyboard');
      return;
    }
    const newType = value as "text" | "image";
    setFormData(prev => ({ ...prev, inputType: newType }));
    // 更新URL路径
    if (newType === 'text') {
      router.push('/animation-ai-generator/text-to-video');
    } else {
      router.push('/animation-ai-generator/image-to-video');
    }
  };

  // 依次轮询图片生成状态（一个完成后才开始下一个）
  const pollImageStatusSequentially = async (images: GeneratedImage[], sceneId: string | null, sceneCount: number) => {
    // 获取当前需要处理的图片列表（使用传入的images参数，而不是state）
    const imagesToProcess = images.filter(
      img => img.imageTaskId && img.imageStatus !== 'completed' && img.imageStatus !== 'failed'
    );
    
    console.log(`Starting to poll ${imagesToProcess.length} images sequentially`);
    
    if (imagesToProcess.length === 0) {
      console.warn("No images to process, skipping polling");
      return;
    }
    
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < imagesToProcess.length; i++) {
      const item = imagesToProcess[i];
      
      // 找到当前item在generatedImages中的索引
      const itemIndex = images.findIndex(img => img.id === item.id);
      if (itemIndex === -1) continue;
      
      console.log(`Processing image ${i + 1}/${imagesToProcess.length}, taskId: ${item.imageTaskId}`);
      
      // 设置当前正在生成的索引
      setCurrentGeneratingIndex(itemIndex);
      
      // 更新状态为"生成中"
      setGeneratedImages(prev => prev.map(img => 
        img.id === item.id 
          ? { ...img, imageStatus: 'generating' as const, isGeneratingImage: true }
          : img
      ));
      
      // 轮询当前图片的状态
      const poll = async (): Promise<boolean> => {
        try {
          const statusResponse = await fetch(`/api/scenes/image-status?taskId=${item.imageTaskId}`);
          if (!statusResponse.ok) {
            throw new Error("Failed to get image status");
          }

          const statusResult = await statusResponse.json();
          
          if (statusResult.success && statusResult.data) {
            const { status, imageUrl } = statusResult.data;
            
            if (status === "SUCCEEDED" && imageUrl) {
              // 图像生成成功，上传到TOS并更新状态
              try {
                // 上传到TOS（如果需要）
                const formData = new FormData();
                formData.append('imageUrl', imageUrl);
                const uploadResponse = await fetch('/api/scenes/upload-image', {
                  method: 'POST',
                  body: formData,
                });
                
                let finalImageUrl = imageUrl;
                if (uploadResponse.ok) {
                  const uploadResult = await uploadResponse.json();
                  if (uploadResult.success && uploadResult.data?.url) {
                    finalImageUrl = uploadResult.data.url;
                  }
                }
                
                // 更新状态
                setGeneratedImages(prev => {
                  const updated = prev.map(img => 
                    img.id === item.id 
                      ? { 
                          ...img, 
                          imageUrl: finalImageUrl,
                          isGeneratingImage: false,
                          imageStatus: 'completed' as const,
                          imageTaskId: undefined
                        }
                      : img
                  );
                  
                  // 更新数据库中的图像URL
                  if (item.sceneItemId) {
                    fetch(`/api/scenes/items/${item.sceneItemId}`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        imageUrl: finalImageUrl,
                      }),
                    }).catch(updateError => {
                      console.error("Error updating image URL in database:", updateError);
                    });
                  }
                  
                  return updated;
                });
                
                // 清除当前生成索引
                setCurrentGeneratingIndex(null);
                successCount++;
                return true; // 成功，继续下一个
              } catch (uploadError) {
                console.error("Error uploading image:", uploadError);
                // 即使上传失败，也使用原始URL
                setGeneratedImages(prev => prev.map(img => 
                  img.id === item.id 
                    ? { 
                        ...img, 
                        imageUrl: imageUrl,
                        isGeneratingImage: false,
                        imageStatus: 'completed' as const,
                        imageTaskId: undefined
                      }
                    : img
                ));
                setCurrentGeneratingIndex(null);
                return true;
              }
            } else if (status === "FAILED" || status === "CANCELED") {
              // 图像生成失败
              setGeneratedImages(prev => prev.map(img => 
                img.id === item.id 
                  ? { 
                      ...img, 
                      isGeneratingImage: false,
                      imageStatus: 'failed' as const,
                      imageGenerationFailed: true,
                      imageTaskId: undefined
                    }
                  : img
              ));
              setCurrentGeneratingIndex(null);
              failedCount++;
              return true; // 继续下一个
            } else if (status === "PENDING" || status === "RUNNING") {
              // 继续轮询
              return new Promise<boolean>((resolve) => {
                setTimeout(async () => {
                  const result = await poll();
                  resolve(result);
                }, 3000); // 每3秒查询一次
              });
            } else {
              // 未知状态，继续轮询
              return new Promise<boolean>((resolve) => {
                setTimeout(async () => {
                  const result = await poll();
                  resolve(result);
                }, 5000);
              });
            }
          } else {
            // 查询失败，继续轮询
            return new Promise<boolean>((resolve) => {
              setTimeout(async () => {
                const result = await poll();
                resolve(result);
              }, 5000);
            });
          }
        } catch (error) {
          console.error("Error polling image status:", error);
          // 出错后继续轮询，但间隔更长
          return new Promise<boolean>((resolve) => {
            setTimeout(async () => {
              const result = await poll();
              resolve(result);
            }, 10000);
          });
        }
      };
      
      // 等待当前图片生成完成
      await poll();
      
      // 等待一小段时间再处理下一个（避免API限流）
      if (i < imagesToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 所有图片处理完成后，扣除积分
    // 只要有至少一张图片成功生成，就扣除积分
    if (successCount > 0 && sceneId) {
      console.log(`All images processed. Success: ${successCount}, Failed: ${failedCount}. Deducting credits...`);
      
      // 扣除分镜积分（一次性扣除20积分）
      const deductResult = await deductStoryboardCredits({
        sceneId: sceneId,
        sceneCount: sceneCount,
      });
      
      if (!deductResult.success) {
        console.error("Failed to deduct storyboard credits:", deductResult.error);
        console.error("Deduct result:", deductResult);
        // 使用 setTimeout 延迟显示 alert，确保 UI 已经更新
        setTimeout(() => {
          alert(`Story script generated successfully, but credit deduction failed: ${deductResult.error}. Please contact support.`);
        }, 500);
      } else {
        console.log("Storyboard credits deducted successfully:", deductResult);
        // 更新积分余额
        const updatedBalance = await checkCreditsBalance(0);
        if (updatedBalance.balance !== undefined) {
          setCreditsBalance(updatedBalance.balance);
        }
      }
    } else if (successCount === 0) {
      console.warn("No images were successfully generated, skipping credit deduction");
    }
  };

  const handleGenerate = async () => {
    if (formData.inputType === "text" && !formData.textPrompt.trim()) {
      alert("Please enter a description");
      return;
    }
    if (formData.inputType === "image" && (!formData.startFrame || !formData.endFrame)) {
      alert("Please upload start and end frames");
      return;
    }

    setIsGenerating(true);
    
    // 重置文生视频进度状态
    if (!isSceneMode && formData.inputType === "text") {
      setTextToVideoProgress({
        status: 'idle',
        message: ''
      });
    }
    
    if (isSceneMode && formData.inputType === "text") {
      // 分镜模式：调用火山引擎 API 生成故事分镜
      try {
        // 清除旧的分镜状态（如果存在）
        if (currentSceneId) {
          // 注意：不清除localStorage，因为新分镜生成成功后会更新
          setCurrentSceneId(null);
          setGeneratedImages([]);
        }
        
        // 故事剧本生成不再需要积分限制
        
        // 风格提示词映射
        const stylePrompts: Record<string, string> = {
          "2d": "2D动画风格，平面动画效果",
          "3d": "3D动画风格，立体三维效果",
          "anime": "日本二次元风格，日式动漫风格",
          "clay": "粘土动画风格，粘土材质效果",
          "comic": "美式漫画风格，美漫风格",
          "cartoon": "动漫风格，卡通动画效果",
          "cyberpunk": "赛博朋克风格，未来科技感",
        };
        const stylePrompt = stylePrompts[formData.model] || "2D动画风格";
        
        const formDataToSend = new FormData();
        formDataToSend.append("prompt", `${formData.textPrompt}，${stylePrompt}`); // 添加风格提示词
        formDataToSend.append("readerGroup", formData.readerGroup);
        formDataToSend.append("style", formData.model); // 传递风格参数
        
        if (formData.referenceImage) {
          formDataToSend.append("referenceImage", formData.referenceImage);
        }

        const response = await fetch("/api/scenes/generate", {
          method: "POST",
          body: formDataToSend,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to generate scenes");
        }

        const result = await response.json();
        
        if (result.success && result.data) {
          console.log("Received scene generation result:", result.data);
          
          // 初始化所有分镜条目，第一个标记为生成中，其他为等待中
          const newImages: GeneratedImage[] = result.data.scenes.map((scene: any, index: number) => ({
            id: `img-${Date.now()}-${index}`,
            imageUrl: scene.imageUrl || null, // 图像URL（初始为null）
            text: scene.text,
            sceneDetail: scene.sceneDetail || "",
            sceneTitle: scene.sceneTitle || "",
            camera: scene.camera || "",
            dialogue: scene.dialogue || [],
            sceneDuration: scene.duration || "",
            sceneNumber: scene.sceneNumber,
            videoUrl: undefined,
            isGeneratingVideo: false,
            isGeneratingImage: index === 0 && scene.imageTaskId, // 第一个图片如果还有任务，标记为生成中
            imageGenerationFailed: scene.imageGenerationFailed || false,
            sceneItemId: scene.sceneItemId,
            imageTaskId: scene.imageTaskId || null, // 图片生成任务ID
            imageStatus: scene.imageUrl ? ('completed' as const) : (index === 0 && scene.imageTaskId ? ('generating' as const) : ('pending' as const)), // 第一个为生成中，其他为等待中
          }));
          
          console.log("Setting generatedImages:", newImages.length, "scenes");
          console.log("Current isGenerating:", isGenerating);
          
          // 先设置图片数据，确保分镜预览区域能显示
          setGeneratedImages(newImages);
          
          // 设置当前正在生成的索引（第一个）
          if (newImages.length > 0 && newImages[0].imageTaskId && !newImages[0].imageUrl) {
            setCurrentGeneratingIndex(0);
          }
          
          // 设置sceneId（后端已保存到数据库）
          if (result.data.sceneId) {
            setCurrentSceneId(result.data.sceneId);
            // 保存到localStorage，以便页面刷新后恢复
            localStorage.setItem('currentSceneId', result.data.sceneId);
          }
          
          // 立即更新 isGenerating 状态，让分镜预览区域显示内容
          console.log("Setting isGenerating to false");
          setIsGenerating(false);
          
          // 强制触发一次重新渲染，确保 UI 更新
          await new Promise(resolve => setTimeout(resolve, 0));
          
          console.log("After state update, checking if preview should show");
          
          // 依次轮询每个图片的生成状态（一个完成后才开始下一个）
          // 使用 setTimeout 确保 state 已更新
          // 积分扣除将在所有图片生成完成后进行
          setTimeout(() => {
            pollImageStatusSequentially(newImages, result.data.sceneId || null, newImages.length);
          }, 100);
          
          // 滚动到分镜预览区域（延迟执行，确保 DOM 已更新）
          setTimeout(() => {
            const previewSection = document.getElementById('scene-preview-section');
            if (previewSection) {
              console.log("Scrolling to preview section");
              previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              console.warn("Preview section not found");
            }
          }, 300);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        console.error("Error generating scenes:", error);
        alert(error instanceof Error ? error.message : "Failed to generate scenes. Please try again.");
      } finally {
        setIsGenerating(false);
      }
    } else if (isSceneMode && formData.inputType === "image") {
      // Image to Video 模式下的分镜生成（暂时使用原有逻辑）
      const textSegments = formData.textPrompt.split('.').filter(s => s.trim().length > 0);
      const segmentsToGenerate = textSegments.length > 0 ? textSegments : [formData.textPrompt];
      
      setTimeout(() => {
        const newImages: GeneratedImage[] = segmentsToGenerate.map((segment, index) => ({
          id: `img-${Date.now()}-${index}`,
          imageUrl: `https://picsum.photos/400/300?random=${Date.now()}-${index}`,
          text: segment.trim(),
          sceneNumber: index + 1,
          videoUrl: undefined,
          isGeneratingVideo: false
        }));
        
        setGeneratedImages(newImages);
        
        // 滚动到分镜预览区域
        setTimeout(() => {
          const previewSection = document.getElementById('scene-preview-section');
          if (previewSection) {
            previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
        
        setIsGenerating(false);
      }, 2000);
    } else {
      // 非分镜模式：直接文生视频
      try {
        // 检查积分余额
        const currentQuality = formData.quality || "480p";
        const currentDuration = parseInt(formData.duration || "5");
        const resolution = currentQuality as '480p' | '720p' | '1080p';
        // 使用订阅计划相关的积分计算
        const requiredCredits = calculateVideoCredits(subscriptionPlan, resolution, currentDuration);
        
        const balanceCheck = await checkCreditsBalance(requiredCredits);
        
        if (!balanceCheck.sufficient) {
          setInsufficientCreditsData({
            required: requiredCredits,
            current: balanceCheck.balance || 0,
            action: `generate ${currentDuration}s ${currentQuality} video`
          });
          setShowInsufficientCreditsDialog(true);
          setIsGenerating(false);
          return;
        }
        
        setTextToVideoProgress({
          status: 'generating',
          message: '正在提交视频生成任务...'
        });
        
        // 自动切换到 My Creations tab
        setActiveTab('my-creations');

        // 使用表单中选择框的默认参数
        const currentModel = formData.model || "2d"; // 默认值：2d
        
        // 风格提示词映射
        const stylePrompts: Record<string, string> = {
          "2d": "2D动画风格，平面动画效果",
          "3d": "3D动画风格，立体三维效果",
          "anime": "日本二次元风格，日式动漫风格",
          "clay": "粘土动画风格，粘土材质效果",
          "comic": "美式漫画风格，美漫风格",
          "cartoon": "动漫风格，卡通动画效果",
          "cyberpunk": "赛博朋克风格，未来科技感",
        };
        const stylePrompt = stylePrompts[currentModel] || "2D动画风格";
        
        // 文生视频使用 wan2.5-t2v-preview 模型
        const dashScopeModel = "wan2.5-t2v-preview";
        
        // 映射分辨率到 size（文生视频使用 size 参数，格式：宽*高）
        const sizeMap: Record<string, string> = {
          "480p": "832*480",   // 16:9
          "720p": "1280*720",  // 16:9
          "1080p": "1920*1080", // 16:9
        };
        const dashScopeSize = sizeMap[currentQuality] || "832*480"; // 默认 480p
        
        // 映射时长（已在前面定义，直接使用）
        const duration = currentDuration; // currentDuration 已经是数字类型
        
        console.log("Generating text-to-video with parameters:", {
          model: currentModel,
          dashScopeModel,
          quality: currentQuality,
          size: dashScopeSize,
          duration,
        });
        
        // 步骤1: 提交视频生成任务
        const response = await fetch("/api/video/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: `${formData.textPrompt}，${stylePrompt}`, // 添加风格提示词
            model: dashScopeModel,
            size: dashScopeSize,
            duration: duration,
            promptExtend: true,
            audio: true, // wan2.5-t2v-preview 默认开启自动配音
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to generate video");
        }

        const result = await response.json();
        const taskId = result.data.taskId;

        setTextToVideoProgress({
          status: 'polling',
          message: '视频生成中，请稍候...',
          taskId: taskId
        });

        // 步骤2: 轮询视频生成状态（根据 DashScope 建议，间隔 15 秒）
        const maxAttempts = 40; // 最多轮询 40 次（10分钟）
        const interval = 15000; // 15 秒间隔
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 0 : interval));
            
            const statusResponse = await fetch(`/api/video/status?taskId=${taskId}`);
            
            // 检查 Content-Type 是否为 JSON
            const contentType = statusResponse.headers.get("content-type");
            const isJson = contentType && contentType.includes("application/json");
            
            if (!statusResponse.ok) {
              let errorMessage = `HTTP ${statusResponse.status}: ${statusResponse.statusText}`;
              if (isJson) {
                try {
                  const errorData = await statusResponse.json();
                  errorMessage = errorData.error || errorMessage;
                } catch (e) {
                  // 忽略 JSON 解析错误
                }
              } else {
                try {
                  const errorText = await statusResponse.text();
                  if (errorText) errorMessage = errorText;
                } catch (e) {
                  // 忽略文本读取错误
                }
              }
              throw new Error(errorMessage);
            }

            const statusResult = isJson ? await statusResponse.json() : {};
            
            if (!statusResult.success) {
              throw new Error(statusResult.error || "Failed to get video status");
            }

            const status = statusResult.data?.status;
            const videoUrl = statusResult.data?.output?.video_url;

            if (status === "SUCCEEDED" && videoUrl) {
              // 视频生成成功，先上传到存储，然后保存到数据库
              try {
                // 扣除积分
                const resolution = currentQuality as '480p' | '720p' | '1080p';
                const deductResult = await deductVideoCredits(resolution, duration, {
                  taskId,
                  isTextToVideo: true,
                  prompt: formData.textPrompt,
                }, subscriptionPlan);
                
                if (!deductResult.success) {
                  console.error("Failed to deduct credits:", deductResult.error);
                  // 即使扣除失败，也继续处理视频，但记录错误
                } else {
                  // 更新积分余额
                  if (deductResult.newBalance !== undefined) {
                    setCreditsBalance(deductResult.newBalance);
                  } else {
                    const updatedBalance = await checkCreditsBalance(0);
                    if (updatedBalance.balance !== undefined) {
                      setCreditsBalance(updatedBalance.balance);
                    }
                  }
                }
                
                setTextToVideoProgress({
                  status: 'polling',
                  message: '正在上传视频到存储...',
                  taskId: taskId
                });

                // 步骤1: 上传视频到 Supabase Storage
                const uploadResponse = await fetch("/api/video/upload", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    videoUrl: videoUrl,
                  }),
                });

                if (!uploadResponse.ok) {
                  const uploadError = await uploadResponse.json();
                  throw new Error(uploadError.error || "Failed to upload video");
                }

                const uploadResult = await uploadResponse.json();
                const storedVideoUrl = uploadResult.data.url;

                // 步骤2: 保存视频信息到数据库
                const statusData = statusResult.data;
                const saveResponse = await fetch("/api/video/save", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    videoUrl: storedVideoUrl, // 使用上传后的 URL
                    prompt: formData.textPrompt,
                    resolution: dashScopeSize, // 文生视频使用 size 格式
                    size: dashScopeSize, // 保存 size 格式
                    taskId: taskId,
                    requestId: statusData.requestId || statusResult.request_id,
                    status: 'completed',
                    submitTime: statusData.output?.submit_time,
                    scheduledTime: statusData.output?.scheduled_time,
                    endTime: statusData.output?.end_time,
                    origPrompt: statusData.output?.orig_prompt,
                    actualPrompt: statusData.output?.actual_prompt,
                    duration: duration,
                    videoCount: statusData.usage?.video_count || 1,
                  }),
                });

                if (!saveResponse.ok) {
                  const saveError = await saveResponse.json();
                  console.error("Failed to save video:", saveError);
                  // 即使保存失败，也显示视频（使用原始 URL）
                }

                setTextToVideoProgress({
                  status: 'completed',
                  message: '视频生成完成！',
                  videoUrl: storedVideoUrl, // 使用上传后的 URL
                  taskId: taskId
                });
                
                // 将生成的视频添加到 My Creations 列表的最前面
                setMyVideos(prev => {
                  const newVideo = {
                    url: storedVideoUrl,
                    filename: `generated-${taskId}.mp4`,
                    title: formData.textPrompt.length > 50 ? formData.textPrompt.substring(0, 50) + '...' : formData.textPrompt
                  };
                  // 检查是否已存在，避免重复添加
                  const exists = prev.some(v => v.url === storedVideoUrl);
                  if (exists) {
                    return prev;
                  }
                  return [newVideo, ...prev].slice(0, 50); // 最多保留50个
                });
                
                // 刷新 My Creations 列表（从数据库获取最新数据）
                fetch('/api/videos/my-creations')
                  .then((r) => r.json())
                  .then((data) => {
                    if (Array.isArray(data?.videos)) {
                      setMyVideos(data.videos);
                    }
                  })
                  .catch((error) => {
                    console.error('Error refreshing my videos:', error);
                  });
                
                // 如果当前不在 My Creations tab，切换到该 tab
                if (activeTab !== 'my-creations') {
                  setActiveTab('my-creations');
                }
                
                setIsGenerating(false);
                return;
              } catch (error) {
                console.error("Error uploading/saving video:", error);
                // 如果上传失败，仍然显示原始视频 URL
                setTextToVideoProgress({
                  status: 'completed',
                  message: '视频生成完成！（存储失败，使用临时链接）',
                  videoUrl: videoUrl,
                  taskId: taskId
                });
                
                // 将生成的视频添加到 My Creations 列表的最前面（即使上传失败）
                setMyVideos(prev => {
                  const newVideo = {
                    url: videoUrl,
                    filename: `generated-${taskId}.mp4`,
                    title: formData.textPrompt.length > 50 ? formData.textPrompt.substring(0, 50) + '...' : formData.textPrompt
                  };
                  // 检查是否已存在，避免重复添加
                  const exists = prev.some(v => v.url === videoUrl);
                  if (exists) {
                    return prev;
                  }
                  return [newVideo, ...prev].slice(0, 50); // 最多保留50个
                });
                
                // 刷新 My Creations 列表（从数据库获取最新数据）
                fetch('/api/videos/my-creations')
                  .then((r) => r.json())
                  .then((data) => {
                    if (Array.isArray(data?.videos)) {
                      setMyVideos(data.videos);
                    }
                  })
                  .catch((error) => {
                    console.error('Error refreshing my videos:', error);
                  });
                
                // 如果当前不在 My Creations tab，切换到该 tab
                if (activeTab !== 'my-creations') {
                  setActiveTab('my-creations');
                }
                
                setIsGenerating(false);
                return;
              }
            }

            if (status === "FAILED" || status === "CANCELED") {
              const errorMsg = statusResult.data?.message || `Video generation ${status.toLowerCase()}`;
              throw new Error(errorMsg);
            }

            if (status === "UNKNOWN") {
              throw new Error("Video generation task not found or status unknown");
            }

            // 更新进度消息
            const statusMessages: Record<string, string> = {
              "PENDING": "任务排队中...",
              "RUNNING": "视频生成中，请稍候...",
            };
            setTextToVideoProgress({
              status: 'polling',
              message: statusMessages[status] || "处理中...",
              taskId: taskId
            });

          } catch (error) {
            console.error("Error polling video status:", error);
            setTextToVideoProgress({
              status: 'error',
              message: error instanceof Error ? error.message : "视频生成失败",
              taskId: taskId
            });
            setIsGenerating(false);
            return;
          }
        }

        // 超时
        setTextToVideoProgress({
          status: 'error',
          message: "视频生成超时，请重试",
          taskId: taskId
        });
        setIsGenerating(false);

      } catch (error) {
        console.error("Error generating video:", error);
        setTextToVideoProgress({
          status: 'error',
          message: error instanceof Error ? error.message : "视频生成失败，请重试"
        });
        setIsGenerating(false);
        alert(error instanceof Error ? error.message : "Video generation failed, please try again");
      }
    }
  };

  const handleGenerateVideo = async (imageId: string) => {
    const imageItem = generatedImages.find(img => img.id === imageId);
    if (!imageItem || !imageItem.imageUrl) {
      alert("Please upload or generate an image first");
      return;
    }

    // 检查积分余额
    const currentQuality = formData.quality || "480p";
    const currentDuration = parseInt(formData.duration || "5");
    const resolution = currentQuality as '480p' | '720p' | '1080p';
    // 使用订阅计划相关的积分计算
    const requiredCredits = calculateVideoCredits(subscriptionPlan, resolution, currentDuration);
    
    const balanceCheck = await checkCreditsBalance(requiredCredits);
    
    if (!balanceCheck.sufficient) {
      setInsufficientCreditsData({
        required: requiredCredits,
        current: balanceCheck.balance || 0,
        action: `generate ${currentDuration}s ${currentQuality} video`
      });
      setShowInsufficientCreditsDialog(true);
      return;
    }

    setGeneratedImages(prev => 
      prev.map(img => 
        img.id === imageId 
          ? { ...img, isGeneratingVideo: true }
          : img
      )
    );

    try {
      // 步骤1: 提交视频生成任务
      // 使用表单中选择框的默认参数
      const currentModel = formData.model || "2d"; // 默认值：2d
      
      // 风格提示词映射
      const stylePrompts: Record<string, string> = {
        "2d": "2D动画风格，平面动画效果",
        "3d": "3D动画风格，立体三维效果",
        "anime": "日本二次元风格，日式动漫风格",
        "clay": "粘土动画风格，粘土材质效果",
        "comic": "美式漫画风格，美漫风格",
        "cartoon": "动漫风格，卡通动画效果",
        "cyberpunk": "赛博朋克风格，未来科技感",
      };
      const stylePrompt = stylePrompts[currentModel] || "2D动画风格";
      
      // DashScope API 统一使用 wan2.5-i2v-preview 模型
      const dashScopeModel = "wan2.5-i2v-preview";
      
      // 映射分辨率（前端使用小写，API 需要大写）
      const resolutionMap: Record<string, string> = {
        "480p": "480P",
        "720p": "720P",
        "1080p": "1080P",
      };
      const dashScopeResolution = resolutionMap[currentQuality] || "480P"; // 使用默认值 480P
      
      // 映射时长（已在前面定义，直接使用）
      const duration = currentDuration; // currentDuration 已经是数字类型
      
      console.log("Generating video with parameters:", {
        model: currentModel,
        dashScopeModel,
        quality: currentQuality,
        resolution: dashScopeResolution,
        duration,
      });
      
      const response = await fetch("/api/video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `${imageItem.text || "动画视频"}，${stylePrompt}`, // 添加风格提示词
          sceneDetail: imageItem.sceneDetail || "", // 传递画面描述
          imageUrl: imageItem.imageUrl,
          model: dashScopeModel,
          resolution: dashScopeResolution,
          duration: duration,
          promptExtend: true,
          audio: true, // wan2.5-i2v-preview 默认开启自动配音
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate video");
      }

      const result = await response.json();
      const taskId = result.data.taskId;

      // 步骤2: 轮询视频生成状态（根据 DashScope 建议，间隔 15 秒）
      const pollStatus = async () => {
        const maxAttempts = 40; // 最多轮询 40 次（10分钟）
        const interval = 15000; // 15 秒间隔
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 0 : interval));
            
            const statusResponse = await fetch(`/api/video/status?taskId=${taskId}`);
            if (!statusResponse.ok) {
              let errorData: any = {};
              const contentType = statusResponse.headers.get("content-type");
              
              try {
                if (contentType && contentType.includes("application/json")) {
                  errorData = await statusResponse.json();
                } else {
                  const text = await statusResponse.text();
                  errorData = { raw: text };
                }
              } catch (parseError) {
                errorData = { parseError: String(parseError) };
              }
              
              const errorMessage = errorData.error || errorData.message || `HTTP ${statusResponse.status}: ${statusResponse.statusText}`;
              console.error("Video status API error:", {
                status: statusResponse.status,
                statusText: statusResponse.statusText,
                error: errorMessage,
                errorData: errorData,
                url: `/api/video/status?taskId=${taskId}`,
              });
              throw new Error(`Failed to get video status: ${errorMessage}`);
            }

            const statusResult = await statusResponse.json();
            const status = statusResult.data;
            const requestId = status.requestId || statusResult.request_id; // 从响应中获取 request_id

            if (status.status === "SUCCEEDED" && status.output?.video_url) {
              // 视频生成成功
              const videoUrl = status.output.video_url;
              
              // 扣除积分
              const resolution = currentQuality as '480p' | '720p' | '1080p';
              const deductResult = await deductVideoCredits(resolution, currentDuration, {
                taskId,
                sceneItemId: imageItem.sceneItemId,
                imageId,
              }, subscriptionPlan);
              
              if (!deductResult.success) {
                console.error("Failed to deduct credits:", deductResult.error);
                // 即使扣除失败，也继续保存视频，但记录错误
              } else {
                // 更新积分余额
                if (deductResult.newBalance !== undefined) {
                  setCreditsBalance(deductResult.newBalance);
                } else {
                  const updatedBalance = await checkCreditsBalance(0);
                  if (updatedBalance.balance !== undefined) {
                    setCreditsBalance(updatedBalance.balance);
                  }
                }
              }
            
              // 使用函数式更新确保获取最新状态
              setGeneratedImages(prev => {
                const updated = prev.map(img => 
                  img.id === imageId 
                    ? { 
                        ...img, 
                        isGeneratingVideo: false,
                        videoUrl
                      }
                    : img
                );

                // 保存视频到数据库（在更新后的状态中查找）
                const currentImageItem = updated.find(img => img.id === imageId);
                if (currentImageItem?.sceneItemId) {
                  fetch("/api/scenes/videos", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      sceneItemId: currentImageItem.sceneItemId,
                      videoUrl: videoUrl,
                      prompt: currentImageItem.text,
                      sceneDetail: currentImageItem.sceneDetail || "", // 传递画面描述
                      imageUrl: currentImageItem.imageUrl,
                      resolution: "1080P",
                      taskId: taskId,
                      requestId: requestId, // DashScope API 请求ID
                      status: "completed",
                      submitTime: status.output?.submit_time, // DashScope API 任务提交时间
                      scheduledTime: status.output?.scheduled_time, // DashScope API 任务计划执行时间
                      endTime: status.output?.end_time, // DashScope API 任务结束时间
                      origPrompt: status.output?.orig_prompt, // DashScope API 原始提示词
                      actualPrompt: status.output?.actual_prompt, // DashScope API 实际使用的提示词
                      duration: status.usage?.duration, // 视频时长（秒）
                      videoCount: status.usage?.video_count, // 视频数量
                      sr: status.usage?.SR, // 采样率/分辨率
                    }),
                  }).catch(error => {
                    console.error("Error saving video to database:", error);
                  });
                }

                return updated;
              });
              return; // 成功，退出轮询
            } else if (status.status === "FAILED" || status.status === "CANCELED") {
              // 视频生成失败或已取消
              throw new Error(status.message || `Video generation ${status.status.toLowerCase()}`);
            } else if (status.status === "UNKNOWN") {
              // 任务不存在或状态未知
              throw new Error("Video generation task not found or status unknown");
            }
            // 如果还在处理中（PENDING 或 RUNNING），继续轮询
          } catch (error) {
            console.error("Error polling video status:", error);
            // 如果是最后一次尝试，抛出错误
            if (attempt === maxAttempts - 1) {
              setGeneratedImages(prev => 
                prev.map(img => 
                  img.id === imageId 
                    ? { ...img, isGeneratingVideo: false }
                    : img
                )
              );
              alert(error instanceof Error ? error.message : "Video generation timeout, please try again");
              return;
            }
            // 否则继续轮询
          }
        }
        
        // 如果循环结束仍未成功，抛出超时错误
        setGeneratedImages(prev => 
          prev.map(img => 
            img.id === imageId 
              ? { ...img, isGeneratingVideo: false }
              : img
          )
        );
        alert("Video generation timeout, please try again");
      };

      // 开始轮询（立即开始第一次查询）
      pollStatus();
    } catch (error) {
      console.error("Error generating video:", error);
      setGeneratedImages(prev => 
        prev.map(img => 
          img.id === imageId 
            ? { ...img, isGeneratingVideo: false }
            : img
        )
      );
      alert(error instanceof Error ? error.message : "视频生成失败，请重试");
    }
  };

  const handleUpdateText = async (imageId: string, newText: string) => {
    // 先找到对应的 imageItem
    const imageItem = generatedImages.find(img => img.id === imageId);
    
    setGeneratedImages(prev =>
      prev.map(img =>
        img.id === imageId
          ? { ...img, text: newText }
          : img
      )
    );

    // 如果有关联的数据库记录，更新数据库
    if (imageItem?.sceneItemId) {
      try {
        await fetch(`/api/scenes/items/${imageItem.sceneItemId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: newText,
          }),
        });
      } catch (error) {
        console.error("Error updating text in database:", error);
      }
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    const imageItem = generatedImages.find(img => img.id === imageId);
    
    setGeneratedImages(prev =>
      prev.map(img =>
        img.id === imageId
          ? { ...img, imageUrl: '' }
          : img
      )
    );

    // 如果有关联的数据库记录，更新数据库
    if (imageItem?.sceneItemId) {
      try {
        await fetch(`/api/scenes/items/${imageItem.sceneItemId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: null,
          }),
        });
      } catch (error) {
        console.error("Error deleting image from database:", error);
      }
    }
  };

  const handleSceneImageUpload = async (imageId: string, file: File) => {
    if (file) {
      // 先找到对应的 imageItem
      const imageItem = generatedImages.find(img => img.id === imageId);
      
      try {
        // 上传图片到云存储
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sceneItemId', imageItem?.sceneItemId || '');

        const uploadResponse = await fetch('/api/scenes/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadResult = await uploadResponse.json();
        const imageUrl = uploadResult.data?.url || uploadResult.data?.imageUrl;

        if (!imageUrl) {
          throw new Error('No image URL returned');
        }

        // 更新本地状态
        setGeneratedImages(prev =>
          prev.map(img =>
            img.id === imageId
              ? { ...img, imageUrl }
              : img
          )
        );

        // 如果有关联的数据库记录，更新数据库
        if (imageItem?.sceneItemId) {
          await fetch(`/api/scenes/items/${imageItem.sceneItemId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              imageUrl: imageUrl,
            }),
          });
        }
      } catch (error) {
        console.error("Error uploading image:", error);
        alert("Image upload failed, please try again");
      }
    }
  };

  const handleDeleteVideo = async (imageId: string) => {
    const imageItem = generatedImages.find(img => img.id === imageId);
    
    setGeneratedImages(prev =>
      prev.map(img =>
        img.id === imageId
          ? { ...img, videoUrl: undefined }
          : img
      )
    );

    // 如果有关联的数据库记录，删除数据库中的视频
    if (imageItem?.sceneItemId) {
      try {
        await fetch(`/api/scenes/videos?sceneItemId=${imageItem.sceneItemId}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Error deleting video from database:", error);
      }
    }
  };

  const allModels = [
    { value: "2d", label: "2D Animation", description: "2D animated video style" },
    { value: "3d", label: "3D Animation", description: "3D animated video style" },
    { value: "anime", label: "Anime", description: "Japanese anime style" },
    { value: "clay", label: "Clay", description: "Clay animation style" },
    { value: "comic", label: "Comic", description: "American comic style" },
    { value: "cartoon", label: "Cartoon", description: "Cartoon animation style" },
    { value: "cyberpunk", label: "Cyberpunk", description: "Cyberpunk style" },
  ];

  // 根据订阅计划过滤动画风格
  const models = allModels.filter(model => 
    isAnimationStyleAllowed(subscriptionPlan, model.value)
  );

  const durations = [
    { value: "5", label: "5s" },
    { value: "10", label: "10s", requiresSubscription: true }
  ];

  const allQualities = [
    { value: "480p", label: "480p" },
    { value: "720p", label: "720p", requiresSubscription: true },
    { value: "1080p", label: "1080p", requiresSubscription: true }
  ];

  // 根据订阅计划过滤分辨率
  const qualities = allQualities.filter(quality => 
    isResolutionAllowed(subscriptionPlan, quality.value as '480p' | '720p' | '1080p')
  );
  
  // 检查当前选择是否被订阅计划支持
  const isCurrentQualityAllowed = isResolutionAllowed(subscriptionPlan, formData.quality as '480p' | '720p' | '1080p');
  const isCurrentModelAllowed = isAnimationStyleAllowed(subscriptionPlan, formData.model);
  
  // 获取需要升级的分辨率和动画风格
  const getUpgradeMessage = () => {
    if (!isCurrentQualityAllowed) {
      if (subscriptionPlan === null) {
        return `You need a subscription to use ${formData.quality} resolution. Please go to the subscription page to choose a plan.`;
      }
      const planConfig = getSubscriptionPlanConfig(subscriptionPlan);
      const allowedResolutions = planConfig.videoResolutions.join(' / ');
      return `Your current subscription plan (${planConfig.name}) only supports ${allowedResolutions} resolution. Please upgrade your plan to use ${formData.quality} resolution.`;
    }
    if (!isCurrentModelAllowed) {
      if (subscriptionPlan === null) {
        const selectedModel = allModels.find(m => m.value === formData.model);
        return `"${selectedModel?.label || formData.model}" animation style requires a subscription. Please go to the subscription page to choose a plan.`;
      }
      const planConfig = getSubscriptionPlanConfig(subscriptionPlan);
      const selectedModel = allModels.find(m => m.value === formData.model);
      return `Your current subscription plan (${planConfig.name}) does not support "${selectedModel?.label || formData.model}" animation style. Please upgrade to Pro or Studio plan to use all animation styles.`;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      {/* Header Title */}
      <div className="container mx-auto px-4 pt-12 pb-8">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-2xl md:text-3xl font-bold text-white leading-tight"
          >
            {pathname?.includes('image-to-video') 
              ? 'Image-to-Video Animation Generator'
              : isSceneMode 
                ? 'AI Storyboard Generator'
                : 'Text-to-Animation AI Generator'}
          </motion.h1>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-sm md:text-base text-gray-400 leading-relaxed"
          >
            Type your scene description and watch our video animation tool (Animaker AI) bring it to life. Simply input your video idea and generate a stunning animated video in seconds. No editing skills needed.
          </motion.h2>
        </div>
      </div>

      {/* Main Input Area */}
      <div className="container mx-auto px-4 pb-8 max-w-6xl">
        <div className="bg-gray-900 rounded-xl p-6 md:p-8 shadow-xl" suppressHydrationWarning>
          <Tabs 
            value={formData.inputType} 
            onValueChange={handleTabChange}
            className="w-full"
          >
            <div className="flex items-center gap-4 mb-6">
              <Video className="w-8 h-8 text-gray-400 flex-shrink-0" />
              <TabsList className="flex-1 grid grid-cols-2 bg-transparent rounded-lg p-1 gap-0 max-w-[220px]" suppressHydrationWarning>
                <TabsTrigger 
                  value="text" 
                  suppressHydrationWarning
                  className="relative flex items-center justify-center py-3 px-4 rounded-md text-sm font-medium transition-all bg-transparent text-gray-500 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:w-1/2 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-white"
                >
                  Text to Video
                </TabsTrigger>
                <TabsTrigger 
                  value="image"
                  suppressHydrationWarning
                  className="relative flex items-center justify-center py-3 px-4 rounded-md text-sm font-medium transition-all bg-transparent text-gray-500 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:w-1/2 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-white"
                >
                  Image to Video
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="space-y-6">
              {/* Input Area */}
              <div className="space-y-6">
                {/* Text to Video Mode or Storyboard Mode */}
                {(formData.inputType === "text" || formData.inputType === "storyboard") && (
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Enter your scene or concept here… e.g. 'A cat skateboarding in Times Square'"
                      value={formData.textPrompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, textPrompt: e.target.value }))}
                      className="min-h-[180px] w-full resize-none bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500"
                      rows={7}
                    />
                    
                    {/* 故事剧本模式下的额外选项 */}
                    {isSceneMode && (
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* 参考图上传 */}
                        <div className="flex flex-col items-center gap-2">
                          <label className="text-sm font-medium text-gray-300">
                            参考图（可选）
                          </label>
                          {referenceImagePreview ? (
                            <div className="relative group h-12 w-12">
                              <img
                                src={referenceImagePreview}
                                alt="Reference image preview"
                                className="w-full h-full object-cover rounded-lg border-2 border-gray-700"
                              />
                              <button
                                onClick={removeReferenceImage}
                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="inline-block cursor-pointer">
                              <div className="relative w-12 h-12">
                                <div className="absolute inset-0 border-2 border-gray-400 rounded-md"></div>
                                <div className="absolute inset-2 flex flex-col justify-end">
                                  <div className="flex items-end gap-0.5">
                                    <div className="w-2 h-2 bg-gray-400 rounded-tl-sm"></div>
                                    <div className="w-2.5 h-3 bg-gray-400 rounded-t-sm"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-tr-sm"></div>
                                  </div>
                                  <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                </div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-400 rounded-sm flex items-center justify-center">
                                  <span className="text-white text-[10px] font-bold leading-none">+</span>
                                </div>
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleReferenceImageUpload(file);
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {/* 读者群选择 */}
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-medium text-gray-300">
                            读者群
                          </label>
                          <Select
                            value={formData.readerGroup}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, readerGroup: value as typeof formData.readerGroup }))}
                          >
                            <SelectTrigger className="w-[120px] bg-gray-800 border-gray-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="Children" className="text-white">Children</SelectItem>
                              <SelectItem value="Teen" className="text-white">Teen</SelectItem>
                              <SelectItem value="Adult" className="text-white">Adult</SelectItem>
                              <SelectItem value="All Ages" className="text-white">All Ages</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Image to Video Mode */}
                {formData.inputType === "image" && (
                  <div className="space-y-4">
                    {/* Start Frame and End Frame */}
                    <div className="flex items-center gap-4">
                      {/* Start Frame */}
                      <div className="flex flex-col items-center gap-2">
                        <label className="text-sm font-medium text-gray-300">
                          Start Frame
                        </label>
                        {startFramePreview ? (
                          <div className="relative group h-12 w-12">
                            <img
                              src={startFramePreview}
                              alt="Start frame preview for animated video generation"
                              className="w-full h-full object-cover rounded-lg border-2 border-gray-700"
                            />
                            <button
                              onClick={removeStartFrame}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="inline-block cursor-pointer">
                            <div className="relative w-12 h-12">
                              {/* Image frame icon */}
                              <div className="absolute inset-0 border-2 border-gray-400 rounded-md"></div>
                              {/* Image symbol inside - mountains and sun */}
                              <div className="absolute inset-2 flex flex-col justify-end">
                                <div className="flex items-end gap-0.5">
                                  <div className="w-2 h-2 bg-gray-400 rounded-tl-sm"></div>
                                  <div className="w-2.5 h-3 bg-gray-400 rounded-t-sm"></div>
                                  <div className="w-2 h-2 bg-gray-400 rounded-tr-sm"></div>
                                </div>
                                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                              </div>
                              {/* Plus icon in top-right corner */}
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-400 rounded-sm flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold leading-none">+</span>
                              </div>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleStartFrameUpload(file);
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {/* End Frame */}
                      <div className="flex flex-col items-center gap-2">
                        <label className="text-sm font-medium text-gray-300">
                          End Frame
                        </label>
                        {endFramePreview ? (
                          <div className="relative group h-12 w-12">
                            <img
                              src={endFramePreview}
                              alt="End frame preview for animated video generation"
                              className="w-full h-full object-cover rounded-lg border-2 border-gray-700"
                            />
                            <button
                              onClick={removeEndFrame}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="inline-block cursor-pointer">
                            <div className="relative w-12 h-12">
                              {/* Image frame icon */}
                              <div className="absolute inset-0 border-2 border-gray-400 rounded-md"></div>
                              {/* Image symbol inside - mountains and sun */}
                              <div className="absolute inset-2 flex flex-col justify-end">
                                <div className="flex items-end gap-0.5">
                                  <div className="w-2 h-2 bg-gray-400 rounded-tl-sm"></div>
                                  <div className="w-2.5 h-3 bg-gray-400 rounded-t-sm"></div>
                                  <div className="w-2 h-2 bg-gray-400 rounded-tr-sm"></div>
                                </div>
                                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                              </div>
                              {/* Plus icon in top-right corner */}
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-400 rounded-sm flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold leading-none">+</span>
                              </div>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleEndFrameUpload(file);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Text Input */}
                    <Textarea
                      placeholder="Describe your scene or characters. What video would you like to create?"
                      value={formData.textPrompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, textPrompt: e.target.value }))}
                      className="min-h-[180px] w-full resize-none bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500"
                      rows={7}
                    />
                  </div>
                )}

                {/* Text-to-Video Progress Display (Non-Storyboard Mode) */}
                {formData.inputType === "text" && !isSceneMode && textToVideoProgress.status !== 'idle' && (
                      <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        {textToVideoProgress.status === 'generating' && (
                          <div className="flex items-center gap-3">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-5 h-5"
                            >
                              <Sparkles className="w-5 h-5 text-[#FFDA2A]" />
                            </motion.div>
                            <span className="text-gray-300">{textToVideoProgress.message}</span>
                          </div>
                        )}
                        {textToVideoProgress.status === 'polling' && (
                          <div className="flex items-center gap-3">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-5 h-5"
                            >
                              <Sparkles className="w-5 h-5 text-[#FFDA2A]" />
                            </motion.div>
                            <span className="text-gray-300">{textToVideoProgress.message}</span>
                          </div>
                        )}
                        {textToVideoProgress.status === 'completed' && textToVideoProgress.videoUrl && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <span className="text-green-400 font-medium">{textToVideoProgress.message}</span>
                            </div>
                            <div className="mt-3">
                              <video
                                controls
                                className="w-full max-w-md rounded-lg border border-gray-700"
                                onError={(e) => {
                                  const target = e.target as HTMLVideoElement;
                                  const videoUrl = textToVideoProgress.videoUrl || '';
                                  
                                  // 记录失败的视频URL
                                  if (videoUrl) {
                                    setFailedVideoUrls(prev => new Set(prev).add(videoUrl));
                                  }
                                  
                                  // 静默处理视频错误 - 只标记为失败
                                  // 仅在存在特定错误代码时记录
                                  const error = target.error;
                                  if (error && error.code !== null && error.code !== undefined) {
                                    const errorMessages: Record<number, string> = {
                                      1: 'MEDIA_ERR_ABORTED',
                                      2: 'MEDIA_ERR_NETWORK',
                                      3: 'MEDIA_ERR_DECODE',
                                      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                                    };
                                    
                                    const errorType = errorMessages[error.code] || `Error code ${error.code}`;
                                    // 仅记录网络和解码错误，忽略中止错误
                                    if (error.code === 2 || error.code === 3) {
                                      console.warn(`Video load ${errorType}:`, videoUrl?.substring(0, 50) || 'unknown');
                                    }
                                  }
                                }}
                              >
                                <source src={textToVideoProgress.videoUrl} type="video/mp4" />
                                您的浏览器不支持视频播放。
                              </video>
                            </div>
                          </div>
                        )}
                        {textToVideoProgress.status === 'error' && (
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                              <X className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-red-400">{textToVideoProgress.message}</span>
                          </div>
                        )}
                      </div>
                    )}

                {/* Settings and Button */}
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                  <div className="flex-1 flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-300 whitespace-nowrap">
                        Choose an Animation Style
                      </label>
                      <Select
                        value={formData.model}
                        onValueChange={(value) => {
                          // 检查是否被订阅计划支持
                          if (!isAnimationStyleAllowed(subscriptionPlan, value)) {
                            if (subscriptionPlan === null) {
                              // 用户没有订阅
                              const selectedModel = allModels.find(m => m.value === value);
                              alert(`"${selectedModel?.label || value}" animation style requires a subscription.\n\nClick OK to go to the subscription page.`);
                              router.push('/pricing');
                            } else {
                              // 用户有订阅但计划不支持
                              const planConfig = getSubscriptionPlanConfig(subscriptionPlan);
                              const selectedModel = allModels.find(m => m.value === value);
                              alert(`Your current subscription plan (${planConfig.name}) does not support "${selectedModel?.label || value}" animation style.\n\nPlease upgrade to Pro or Studio plan to use all animation styles.\n\nClick OK to go to the pricing page.`);
                              router.push('/pricing');
                            }
                            return;
                          }
                          setFormData(prev => ({ ...prev, model: value }));
                        }}
                      >
                        <SelectTrigger className={`w-auto min-w-fit bg-transparent border-gray-700 text-white h-10 px-3 ${!isCurrentModelAllowed ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Pick a style or mood for your animation">
                            {(() => {
                              const selectedModel = allModels.find(m => m.value === formData.model);
                              if (!selectedModel) return formData.model;
                              return (
                                <span className="flex items-center gap-2">
                                  {selectedModel.label}
                                  {!isCurrentModelAllowed && subscriptionPlan === null && (
                                    <span className="text-xs text-red-400 font-medium">(Requires Subscription)</span>
                                  )}
                                  {!isCurrentModelAllowed && subscriptionPlan !== null && (
                                    <span className="text-xs text-red-400 font-medium">(Requires Upgrade)</span>
                                  )}
                                </span>
                              );
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          {allModels.map((model) => {
                            const isAllowed = isAnimationStyleAllowed(subscriptionPlan, model.value);
                            const isDisabled = !isAllowed;
                            return (
                              <SelectItem 
                                key={model.value} 
                                value={model.value}
                                disabled={isDisabled}
                                className={`${isDisabled ? 'text-gray-600 opacity-50 cursor-not-allowed' : 'text-gray-500 data-[highlighted]:bg-transparent data-[state=checked]:text-[#FFDA2A]'} data-[state=checked]:bg-transparent data-[state=checked]:[&>span>svg]:text-[#FFDA2A]`}
                                onSelect={(e) => {
                                  if (isDisabled) {
                                    e.preventDefault();
                                    if (subscriptionPlan === null) {
                                      alert(`"${model.label}" animation style requires a subscription.\n\nClick OK to go to the subscription page.`);
                                      router.push('/pricing');
                                    } else {
                                      const planConfig = getSubscriptionPlanConfig(subscriptionPlan);
                                      alert(`Your current subscription plan (${planConfig.name}) does not support "${model.label}" animation style.\n\nPlease upgrade to Pro or Studio plan to use all animation styles.\n\nClick OK to go to the pricing page.`);
                                      router.push('/pricing');
                                    }
                                  }
                                }}
                              >
                                <span className="flex items-center gap-2">
                                  {model.label}
                                  {!isAllowed && subscriptionPlan === null && (
                                    <span className="text-xs text-[#FFDA2A] font-medium">(Requires Subscription)</span>
                                  )}
                                  {!isAllowed && subscriptionPlan !== null && (
                                    <span className="text-xs text-[#FFDA2A] font-medium">(Requires Upgrade)</span>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-300 whitespace-nowrap">
                        Duration
                      </label>
                      <Select
                        value={formData.duration}
                        onValueChange={(value) => {
                          const selectedDuration = durations.find(d => d.value === value);
                          // 如果选择需要订阅的选项且用户没有订阅，跳转到订阅页
                          if (selectedDuration?.requiresSubscription && subscriptionPlan === null) {
                            alert('This feature requires a subscription.\n\nClick OK to go to the subscription page.');
                            router.push('/pricing');
                            return;
                          }
                          setFormData(prev => ({ ...prev, duration: value }));
                        }}
                      >
                        <SelectTrigger className="w-auto min-w-fit bg-transparent border-gray-700 text-white h-10 px-3">
                          <SelectValue placeholder="Select duration">
                            {(() => {
                              const selectedDuration = durations.find(d => d.value === formData.duration);
                              if (!selectedDuration) return formData.duration;
                              return (
                                <span className="flex items-center gap-2">
                                  {selectedDuration.label}
                                  {selectedDuration.requiresSubscription && subscriptionPlan === null && (
                                    <span className="text-xs text-red-400 font-medium">(Requires Subscription)</span>
                                  )}
                                  {selectedDuration.requiresSubscription && subscriptionPlan !== null && (
                                    <span className="text-xs text-[#FFDA2A] font-medium">(Subscribe)</span>
                                  )}
                                </span>
                              );
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          {durations.map((duration) => {
                            const isDisabled = duration.requiresSubscription && subscriptionPlan === null;
                            const durationValue = parseInt(duration.value);
                            const resolution = formData.quality as '480p' | '720p' | '1080p';
                            const creditsForDuration = calculateVideoCredits(subscriptionPlan, resolution, durationValue);
                            return (
                              <SelectItem 
                                key={duration.value} 
                                value={duration.value}
                                disabled={isDisabled}
                                className={`${isDisabled ? 'text-gray-600 opacity-50 cursor-not-allowed' : 'text-gray-500 data-[highlighted]:bg-transparent data-[state=checked]:text-[#FFDA2A]'} data-[state=checked]:bg-transparent data-[state=checked]:[&>span>svg]:text-[#FFDA2A]`}
                                onSelect={(e) => {
                                  if (isDisabled) {
                                    e.preventDefault();
                                    alert('This feature requires a subscription.\n\nClick OK to go to the subscription page.');
                                    router.push('/pricing');
                                  }
                                }}
                              >
                                <span className="flex items-center gap-2">
                                  {duration.label}
                                  {duration.requiresSubscription && subscriptionPlan === null && (
                                    <span className="text-xs text-[#FFDA2A] font-medium">(Requires Subscription)</span>
                                  )}
                                  {duration.requiresSubscription && subscriptionPlan !== null && (
                                    <span className="text-xs text-[#FFDA2A] font-medium">(Subscribe)</span>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-300 whitespace-nowrap">
                        Quality
                      </label>
                      <Select
                        value={formData.quality}
                        onValueChange={(value) => {
                          const selectedQuality = allQualities.find(q => q.value === value);
                          // 如果选择需要订阅的选项且用户没有订阅，跳转到订阅页
                          if (selectedQuality?.requiresSubscription && subscriptionPlan === null) {
                            alert('This feature requires a subscription.\n\nClick OK to go to the subscription page.');
                            router.push('/pricing');
                            return;
                          }
                          // 检查是否被订阅计划支持
                          if (!isResolutionAllowed(subscriptionPlan, value as '480p' | '720p' | '1080p')) {
                            const planConfig = getSubscriptionPlanConfig(subscriptionPlan);
                            const allowedResolutions = planConfig.videoResolutions.join(' / ');
                            alert(`Your current subscription plan (${planConfig.name}) only supports ${allowedResolutions} resolution.\n\nPlease upgrade your plan to use ${value} resolution.\n\nClick OK to go to the pricing page.`);
                            // 跳转到定价页面
                            router.push('/pricing');
                            return;
                          }
                          setFormData(prev => ({ ...prev, quality: value }));
                        }}
                      >
                        <SelectTrigger className={`w-auto min-w-fit bg-transparent border-gray-700 text-white h-10 px-3 ${!isCurrentQualityAllowed ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Choose quality">
                            {(() => {
                              const selectedQuality = allQualities.find(q => q.value === formData.quality);
                              if (!selectedQuality) return formData.quality;
                              return (
                                <span className="flex items-center gap-2">
                                  {selectedQuality.label}
                                  {selectedQuality.requiresSubscription && subscriptionPlan === null && (
                                    <span className="text-xs text-red-400 font-medium">(Requires Subscription)</span>
                                  )}
                                  {selectedQuality.requiresSubscription && subscriptionPlan !== null && (
                                    <span className="text-xs text-[#FFDA2A] font-medium">(Subscribe)</span>
                                  )}
                                  {!isCurrentQualityAllowed && subscriptionPlan !== null && (
                                    <span className="text-xs text-red-400 font-medium">(Requires Upgrade)</span>
                                  )}
                                </span>
                              );
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                          {allQualities.map((quality) => {
                            const requiresSub = quality.requiresSubscription && subscriptionPlan === null;
                            const isAllowed = isResolutionAllowed(subscriptionPlan, quality.value as '480p' | '720p' | '1080p');
                            const isDisabled = requiresSub || !isAllowed;
                            
                            return (
                              <SelectItem 
                                key={quality.value} 
                                value={quality.value}
                                disabled={isDisabled}
                                className={`${isDisabled ? 'text-gray-600 opacity-50 cursor-not-allowed' : 'text-gray-500 data-[highlighted]:bg-transparent data-[state=checked]:text-[#FFDA2A]'} data-[state=checked]:bg-transparent data-[state=checked]:[&>span>svg]:text-[#FFDA2A]`}
                                onSelect={(e) => {
                                  if (requiresSub) {
                                    e.preventDefault();
                                    alert('This feature requires a subscription.\n\nClick OK to go to the subscription page.');
                                    router.push('/pricing');
                                  } else if (!isAllowed) {
                                    e.preventDefault();
                                    const planConfig = getSubscriptionPlanConfig(subscriptionPlan);
                                    const allowedResolutions = planConfig.videoResolutions.join(' / ');
                                    alert(`Your current subscription plan (${planConfig.name}) only supports ${allowedResolutions} resolution.\n\nPlease upgrade your plan to use ${quality.value} resolution.\n\nClick OK to go to the pricing page.`);
                                    router.push('/pricing');
                                  }
                                }}
                              >
                                <span className="flex items-center gap-2">
                                  {quality.label}
                                  {requiresSub && (
                                    <span className="text-xs text-[#FFDA2A] font-medium">(Requires Subscription)</span>
                                  )}
                                  {quality.requiresSubscription && subscriptionPlan !== null && isAllowed && (
                                    <span className="text-xs text-[#FFDA2A] font-medium">(Subscribe)</span>
                                  )}
                                  {!isAllowed && subscriptionPlan !== null && (
                                    <span className="text-xs text-[#FFDA2A] font-medium">(Requires Upgrade)</span>
                                  )}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex-shrink-0 lg:w-48">
                    {/* 升级提示 */}
                    {getUpgradeMessage() && (
                      <div className="mb-3 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-yellow-300 mb-2">{getUpgradeMessage()}</p>
                            <Link href="/pricing">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full bg-[#FFDA2A] text-gray-900 hover:bg-[#FFDA2A]/90 border-[#FFDA2A]"
                              >
                                前往升级套餐
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                    <Button
                      ref={buttonRef}
                      onClick={handleGenerate}
                      variant={undefined}
                      disabled={
                        (formData.inputType === "text" && !formData.textPrompt.trim()) ||
                        (formData.inputType === "image" && (!formData.startFrame || !formData.endFrame)) ||
                        isGenerating ||
                        !isCurrentQualityAllowed ||
                        !isCurrentModelAllowed
                      }
                      onMouseEnter={(e) => {
                        e.currentTarget.style.setProperty('background-color', '#FFDA2A', 'important');
                        e.currentTarget.style.setProperty('background', '#FFDA2A', 'important');
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.setProperty('background-color', '#FFDA2A', 'important');
                        e.currentTarget.style.setProperty('background', '#FFDA2A', 'important');
                      }}
                      className="w-full px-6 text-gray-900 font-semibold rounded-lg flex flex-row items-center justify-center gap-2 h-10 disabled:opacity-50 disabled:cursor-not-allowed !bg-[#FFDA2A] hover:!bg-[#FFDA2A] active:!bg-[#FFDA2A] focus:!bg-[#FFDA2A]"
                    >
                      {isGenerating ? (
                        <>
                          <motion.div
                            key="loading-spinner"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-6 h-6"
                          >
                            <Sparkles className="w-6 h-6 text-gray-900" />
                          </motion.div>
                          <span>{formData.inputType === "text" && isSceneMode ? 'Generating story script...' : 'Generating video...'}</span>
                        </>
                      ) : (
                        <>
                          <Diamond className="w-7 h-7 text-gray-900" />
                          <span className="text-sm">
                            {formData.inputType === "text" && isSceneMode ? 'Generate Story Script' : 'Generate Video'}
                            {formData.inputType === "text" && !isSceneMode && (
                              <span className="ml-2 text-xs opacity-90">
                                {calculateVideoCredits(subscriptionPlan, formData.quality as '480p' | '720p' | '1080p', parseInt(formData.duration || "5"))}
                              </span>
                            )}
                            {formData.inputType === "image" && (
                              <span className="ml-2 text-xs opacity-90">
                                {calculateVideoCredits(subscriptionPlan, formData.quality as '480p' | '720p' | '1080p', parseInt(formData.duration || "5"))}
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Generated Images Section - Only show for Storyboard Mode */}
      {isSceneMode && (
        <div id="scene-preview-section" className="container mx-auto px-4 pb-8 max-w-6xl">
          <div className="bg-gray-900 rounded-xl p-6 md:p-8 shadow-xl">
            {isGenerating && generatedImages.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <motion.div
                    key="generating-spinner"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12"
                  >
                    <Sparkles className="w-12 h-12 text-[#FFDA2A]" />
                  </motion.div>
                  <p className="text-gray-400 text-lg">Generating...</p>
                </div>
              </div>
            ) : generatedImages.length > 0 ? (
              // 只要有分镜数据就显示，即使图片还在生成中或生成失败
              <div className="space-y-8">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">Story Script Preview</h3>
                  <p className="text-sm text-gray-400">Generate story scripts from text descriptions. Each scene corresponds to a text description. Click the "Generate Video" button to create animated videos for each scene.</p>
                </div>
                <AnimatePresence mode="popLayout">
                  {generatedImages.map((item, index) => {
                    const isCurrentlyGenerating = currentGeneratingIndex === index;
                    const isPending = currentGeneratingIndex !== null && index > currentGeneratingIndex && !item.imageUrl;
                    
                    // 检查所有图片是否都已生成完成
                    const allImagesGenerated = generatedImages.every(img => img.imageUrl && (img.imageStatus === 'completed' || !img.imageStatus));
                    const hasGeneratingImages = generatedImages.some(img => 
                      img.imageStatus === 'generating' || 
                      img.imageStatus === 'pending' || 
                      (img.isGeneratingImage && !img.imageUrl)
                    );
                    
                    return (
                      <motion.div
                        key={item.id}
                        layoutId={`scene-item-${item.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all relative"
                      >
                        {/* 透明覆盖层 - 覆盖整个条目区域（生成中） */}
                        {isCurrentlyGenerating && (
                          <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-3 z-50 pointer-events-none">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              className="w-12 h-12"
                            >
                              <Sparkles className="w-12 h-12 text-[#FFDA2A]" />
                            </motion.div>
                            <span className="text-sm text-[#FFDA2A] font-medium">Generating...</span>
                          </div>
                        )}
                        
                        {/* 等待中覆盖层 - 覆盖整个条目区域 */}
                        {isPending && (
                          <div className="absolute inset-0 bg-black/40 rounded-xl flex flex-col items-center justify-center gap-2 z-40 pointer-events-none">
                            <div className="w-8 h-8 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-gray-400">Waiting...</span>
                          </div>
                        )}
                        
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                          {/* Left: Scene Number & Image */}
                          <div className="flex-shrink-0 flex flex-col items-center gap-3">
                            <div className="flex items-center justify-center gap-2">
                              <Info className="w-5 h-5 text-gray-400" />
                              <span className="text-sm text-gray-300 font-medium">Scene {item.sceneNumber}</span>
                            </div>
                            {/* 图片显示区域 */}
                            <div className="relative w-56 h-40">
                              {item.imageStatus === 'failed' || (item.imageGenerationFailed && !item.imageUrl) ? (
                                // 生成失败状态
                                <div className="relative w-full h-full border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center gap-2 bg-gray-800/50">
                                  <ImageIcon className="w-16 h-16 text-gray-600" />
                                  <span className="text-xs text-gray-500 text-center px-2">Image generation failed</span>
                                  <span className="text-xs text-gray-400 text-center px-2">You can upload manually</span>
                                </div>
                              ) : item.imageUrl ? (
                                // 已完成状态 - 显示图片
                                <div className="relative group">
                                  <img
                                    src={item.imageUrl}
                                    alt={`场景${item.sceneNumber}: ${item.text}`}
                                    className="w-full h-full object-cover rounded-lg border-2 border-gray-700 group-hover:border-[#FFDA2A]/50 transition-all"
                                    onError={async (e) => {
                                      console.error('Image load error for scene item:', {
                                        id: item.id,
                                        sceneNumber: item.sceneNumber,
                                        imageUrl: item.imageUrl,
                                        error: e,
                                      });
                                      
                                      // 如果图片加载失败，可能是预签名 URL 过期，尝试重新生成
                                      // 检查是否是 TOS URL（不依赖环境变量）
                                      const isTosUrl = item.imageUrl && (
                                        item.imageUrl.includes('tos-') || 
                                        item.imageUrl.includes('.volces.com')
                                      );
                                      
                                      if (isTosUrl && item.imageUrl) {
                                        try {
                                          // 从原始 URL 中提取基础 URL（移除查询参数）
                                          let baseUrl = item.imageUrl;
                                          try {
                                            const originalUrl = new URL(item.imageUrl);
                                            // 如果有查询参数，说明可能是预签名 URL，需要提取基础 URL
                                            if (originalUrl.search) {
                                              // 构建原始 TOS URL（不含查询参数）
                                              baseUrl = `${originalUrl.protocol}//${originalUrl.host}${originalUrl.pathname}`;
                                            }
                                          } catch (urlError) {
                                            // URL 解析失败，使用原始 URL
                                            console.warn('Failed to parse URL:', urlError);
                                          }
                                          
                                          // 调用 API 获取新的预签名 URL
                                          const presignedResponse = await fetch(
                                            `/api/scenes/presigned-image-url?imageUrl=${encodeURIComponent(baseUrl)}`
                                          );
                                          
                                          if (presignedResponse.ok) {
                                            const presignedResult = await presignedResponse.json();
                                            if (presignedResult.success && presignedResult.data?.imageUrl) {
                                              // 更新图片 URL
                                              setGeneratedImages(prev => prev.map(img => 
                                                img.id === item.id 
                                                  ? { ...img, imageUrl: presignedResult.data.imageUrl }
                                                  : img
                                              ));
                                              console.log('Updated image URL with new presigned URL');
                                            }
                                          }
                                        } catch (error) {
                                          console.error('Error refreshing presigned URL:', error);
                                        }
                                      }
                                    }}
                                    onLoad={() => {
                                      console.log('Image loaded successfully:', {
                                        id: item.id,
                                        sceneNumber: item.sceneNumber,
                                        imageUrl: item.imageUrl,
                                      });
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                                    <span className="text-white text-xs font-medium">Preview Image</span>
                                    <button
                                      onClick={() => handleDeleteImage(item.id)}
                                      className="bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded transition-colors"
                                      title="Delete Image"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // 默认状态 - 上传图片占位符
                                <div className="relative w-full h-full">
                                  <label className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-[#FFDA2A]/50 transition-colors bg-gray-800/30">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleSceneImageUpload(item.id, file);
                                      }}
                                    />
                                    <ImageIcon className="w-8 h-8 text-gray-500 mb-2" />
                                    <span className="text-xs text-gray-400">Upload Image</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                      
                      {/* Middle: Text Description & Scene Detail */}
                      <div className="flex-1 flex flex-col justify-center min-w-0 gap-4">
                        {/* 场景标题 */}
                        {item.sceneTitle && (
                          <div>
                            <div className="mb-2">
                              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Scene Title</span>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-700 rounded-md p-2 text-gray-200 text-sm font-medium">
                              {item.sceneTitle}
                            </div>
                          </div>
                        )}
                        
                        {/* 文案描述 */}
                        <div>
                          <div className="mb-3">
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Description</span>
                          </div>
                          <Textarea
                            value={item.text}
                            onChange={(e) => handleUpdateText(item.id, e.target.value)}
                            className="bg-gray-900/50 border-gray-700 text-gray-200 text-base leading-relaxed resize-none h-40 focus:border-[#FFDA2A]/50 focus:ring-[#FFDA2A]/20"
                            placeholder="Enter scene description..."
                          />
                        </div>
                        
                        {/* 画面描述 */}
                        {item.sceneDetail && (
                          <div>
                            <div className="mb-3">
                              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Visual Description</span>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-700 rounded-md p-3 text-gray-300 text-sm leading-relaxed max-h-40 overflow-y-auto">
                              {item.sceneDetail}
                            </div>
                          </div>
                        )}
                        
                        {/* 镜头语言 */}
                        {item.camera && (
                          <div>
                            <div className="mb-2">
                              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Camera Language</span>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-700 rounded-md p-2 text-gray-300 text-sm">
                              {item.camera}
                            </div>
                          </div>
                        )}
                        
                        {/* 对白 */}
                        {item.dialogue && item.dialogue.length > 0 && (
                          <div>
                            <div className="mb-2">
                              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Dialogue</span>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-700 rounded-md p-3 text-gray-300 text-sm leading-relaxed">
                              {item.dialogue.map((line, idx) => (
                                <div key={idx} className="mb-1">
                                  "{line}"
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 场景持续时间 */}
                        {item.sceneDuration && (
                          <div>
                            <div className="mb-2">
                              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Duration</span>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-700 rounded-md p-2 text-gray-300 text-sm">
                              {item.sceneDuration} seconds
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Right: Video Button & Result */}
                      <div className="flex-shrink-0 flex flex-col items-center justify-center gap-2">
                        {!item.videoUrl ? (
                          <div className="flex flex-col items-center gap-2">
                            <Button
                              onClick={() => handleGenerateVideo(item.id)}
                              disabled={item.isGeneratingVideo || !item.imageUrl || hasGeneratingImages || !allImagesGenerated}
                              className="px-6 py-3 bg-[#FFDA2A] text-gray-900 font-semibold rounded-lg hover:bg-[#FFDA2A]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#FFDA2A]/20 hover:shadow-[#FFDA2A]/30 flex items-center gap-2"
                              title={
                                !item.imageUrl 
                                  ? "Please upload or generate an image first" 
                                  : hasGeneratingImages || !allImagesGenerated
                                  ? "Please wait for all images to finish generating"
                                  : ""
                              }
                            >
                              {item.isGeneratingVideo ? (
                                <>
                                  <motion.div
                                    key={`video-loading-${item.id}`}
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="w-4 h-4"
                                  >
                                    <Sparkles className="w-4 h-4 text-gray-900" />
                                  </motion.div>
                                  <span>Generating...</span>
                                </>
                              ) : (
                                <>
                                  <Video className="w-4 h-4" />
                                  <span>Generate Video</span>
                                </>
                              )}
                            </Button>
                            <span className="text-xs text-gray-500 text-center">Click to generate animated video</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Result Video</div>
                            <div className="relative group">
                              <video
                                controls
                                className="w-64 h-48 rounded-lg border-2 border-gray-700 group-hover:border-[#FFDA2A]/50 transition-all shadow-lg"
                                onError={(e) => {
                                  const target = e.target as HTMLVideoElement;
                                  const videoUrl = item.videoUrl || '';
                                  
                                  // 记录失败的视频URL
                                  if (videoUrl) {
                                    setFailedVideoUrls(prev => new Set(prev).add(videoUrl));
                                  }
                                  
                                  // 静默处理视频错误 - 只标记为失败
                                  // 仅在存在特定错误代码时记录
                                  const error = target.error;
                                  if (error && error.code !== null && error.code !== undefined) {
                                    const errorMessages: Record<number, string> = {
                                      1: 'MEDIA_ERR_ABORTED',
                                      2: 'MEDIA_ERR_NETWORK',
                                      3: 'MEDIA_ERR_DECODE',
                                      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                                    };
                                    
                                    const errorType = errorMessages[error.code] || `Error code ${error.code}`;
                                    // 仅记录网络和解码错误，忽略中止错误
                                    if (error.code === 2 || error.code === 3) {
                                      console.warn(`Video load ${errorType}:`, videoUrl?.substring(0, 50) || 'unknown');
                                    }
                                  }
                                }}
                              >
                                <source src={item.videoUrl} type="video/mp4" />
                                Your browser does not support the video tag.
                              </video>
                              <button
                                onClick={() => handleDeleteVideo(item.id)}
                                className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded transition-colors z-10"
                                title="Delete Video"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <div className="absolute top-2 left-2 bg-[#FFDA2A] text-gray-900 text-xs font-bold px-2 py-1 rounded">
                                Complete
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                  );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <Info className="w-12 h-12 text-gray-500 mx-auto" />
                  <h3 className="text-lg font-semibold text-white">Story Script Preview</h3>
                  <p className="text-sm text-gray-400 max-w-md">
                    Click the "Generate Story Script" button, and the system will generate a corresponding story script based on your text description, automatically creating multiple scene images.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Explore / My Creations */}
      <div className="container mx-auto px-4 pb-6 max-w-6xl" suppressHydrationWarning>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "explore" | "my-creations")}>
          <div className="flex justify-start">
            <TabsList className="flex w-auto bg-transparent rounded-none p-0 gap-0" suppressHydrationWarning>
            <TabsTrigger
              value="explore"
              suppressHydrationWarning
              className="relative py-3 px-4 text-lg font-semibold text-gray-500 bg-transparent data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:w-full data-[state=active]:after:h-0.5 data-[state=active]:after:bg-[#FFDA2A] rounded-none transition-colors"
            >
              Explore
            </TabsTrigger>
            <TabsTrigger
              value="my-creations"
              suppressHydrationWarning
              className="relative py-3 px-4 text-lg font-semibold text-gray-500 bg-transparent data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:w-full data-[state=active]:after:h-0.5 data-[state=active]:after:bg-[#FFDA2A] rounded-none transition-colors"
            >
              My Creations
            </TabsTrigger>
          </TabsList>
          </div>
          <TabsContent value="explore" className="mt-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {videos.map((video, index) => {
                return (
                  <motion.div
                    key={`${video.url}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <div 
                      className="relative bg-gray-800 rounded-lg overflow-hidden group cursor-pointer aspect-[9/16]"
                      onClick={(e) => {
                        const videoElement = e.currentTarget.querySelector('video') as HTMLVideoElement;
                        if (videoElement) {
                          if (videoElement.paused) {
                            videoElement.play();
                          } else {
                            videoElement.pause();
                          }
                        }
                      }}
                    >
                      <video
                        className="w-full h-full object-cover rounded-lg"
                        preload="metadata"
                        loop
                        muted
                        playsInline
                        onMouseOver={e => e.currentTarget.play()}
                        onMouseOut={e => e.currentTarget.pause()}
                        onError={(e) => {
                          const target = e.target as HTMLVideoElement;
                          const videoUrl = video.url;
                          
                          // 记录失败的视频URL
                          setFailedVideoUrls(prev => new Set(prev).add(videoUrl));
                          
                          // 静默处理视频错误 - 只标记为失败
                          // 仅在存在特定错误代码时记录
                          const error = target.error;
                          if (error && error.code !== null && error.code !== undefined) {
                            const errorMessages: Record<number, string> = {
                              1: 'MEDIA_ERR_ABORTED',
                              2: 'MEDIA_ERR_NETWORK',
                              3: 'MEDIA_ERR_DECODE',
                              4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                            };
                            
                            const errorType = errorMessages[error.code] || `Error code ${error.code}`;
                            // 仅记录网络和解码错误，忽略中止错误
                            if (error.code === 2 || error.code === 3) {
                              console.warn(`Video load ${errorType}:`, videoUrl?.substring(0, 50) || 'unknown');
                            }
                          }
                        }}
                      >
                        <source src={video.url} type="video/mp4" />
                      </video>
                      {failedVideoUrls.has(video.url) && (
                        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center rounded-lg">
                          <div className="text-center text-gray-400">
                            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm">Video unavailable</p>
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-gray-900/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                        VIDEO
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>
          <TabsContent value="my-creations" className="mt-8">
            {/* 非分镜模式下的生成状态显示 */}
            {formData.inputType === "text" && !isSceneMode && textToVideoProgress.status !== 'idle' && (
              <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                {textToVideoProgress.status === 'generating' && (
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5"
                    >
                      <Sparkles className="w-5 h-5 text-[#FFDA2A]" />
                    </motion.div>
                    <span className="text-gray-300">{textToVideoProgress.message}</span>
                  </div>
                )}
                {textToVideoProgress.status === 'polling' && (
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5"
                    >
                      <Sparkles className="w-5 h-5 text-[#FFDA2A]" />
                    </motion.div>
                    <span className="text-gray-300">{textToVideoProgress.message}</span>
                  </div>
                )}
                {textToVideoProgress.status === 'completed' && textToVideoProgress.videoUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-green-400 font-medium">{textToVideoProgress.message}</span>
                    </div>
                  </div>
                )}
                {textToVideoProgress.status === 'error' && (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-red-400">{textToVideoProgress.message}</span>
                  </div>
                )}
              </div>
            )}
            
            {myVideos.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {myVideos.map((video, index) => {
                  return (
                    <motion.div
                      key={`${video.url}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    >
                      <div 
                        className="relative bg-gray-800 rounded-lg overflow-hidden group cursor-pointer aspect-[9/16]"
                        onClick={(e) => {
                          const videoElement = e.currentTarget.querySelector('video') as HTMLVideoElement;
                          if (videoElement) {
                            if (videoElement.paused) {
                              videoElement.play();
                            } else {
                              videoElement.pause();
                            }
                          }
                        }}
                      >
                        <video
                          className="w-full h-full object-cover rounded-lg"
                          preload="metadata"
                          loop
                          muted
                          playsInline
                          onMouseOver={e => e.currentTarget.play()}
                          onMouseOut={e => e.currentTarget.pause()}
                          onError={(e) => {
                            const target = e.target as HTMLVideoElement;
                            const videoUrl = video.url;
                            
                            // 记录失败的视频URL
                            setFailedVideoUrls(prev => new Set(prev).add(videoUrl));
                            
                            // 静默处理视频错误 - 只标记为失败
                            // 仅在存在特定错误代码时记录
                            const error = target.error;
                            if (error && error.code !== null && error.code !== undefined) {
                              const errorMessages: Record<number, string> = {
                                1: 'MEDIA_ERR_ABORTED',
                                2: 'MEDIA_ERR_NETWORK',
                                3: 'MEDIA_ERR_DECODE',
                                4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                              };
                              
                              const errorType = errorMessages[error.code] || `Error code ${error.code}`;
                              // 仅记录网络和解码错误，忽略中止错误
                              if (error.code === 2 || error.code === 3) {
                                console.warn(`Video load ${errorType}:`, videoUrl?.substring(0, 50) || 'unknown');
                              }
                            }
                          }}
                        >
                          <source src={video.url} type="video/mp4" />
                        </video>
                        {failedVideoUrls.has(video.url) && (
                          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center rounded-lg">
                            <div className="text-center text-gray-400">
                              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <p className="text-sm">Video unavailable</p>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-gray-900/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                          VIDEO
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <h2 className="text-2xl font-semibold mb-3">No creations yet</h2>
                <p>Start animating to see your creations here!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* FAQ Section */}
      <div className="container mx-auto px-4 pb-16 max-w-3xl mt-12">
        <h2 className="text-3xl font-bold text-center mb-12">Frequently asked questions</h2>
        <div className="space-y-4">
          {[
            {
              question: "What is Animation AI Generator (Animaker AI)?",
              answer: "It's a tool that turns your ideas into animated videos. Just describe what you want to see, or upload some images, and we'll create a video for you. Think of it as having a video editor that understands what you're imagining. Our Animaker AI technology makes it all happen seamlessly."
            },
            {
              question: "How do I generate a video from an image?",
              answer: "Super simple! Click on the 'Image to Video' tab, upload your starting and ending images, tell us what should happen in between, pick your style and how long you want it, then hit 'Animate for Free'. We'll do the rest."
            },
            {
              question: "Can I use the AI-generated videos in commercial projects?",
              answer: "Absolutely! Once you create a video, it's yours to use however you want - personal projects, client work, social media, whatever. Just make sure you're following our terms of service, which are pretty standard stuff."
            },
            {
              question: "Which plans provide access to the video generator?",
              answer: "Everyone gets access with the free plan. If you want higher quality, longer videos, or faster processing, that's where our premium plans come in. But honestly, the free version is pretty solid for most people."
            },
            {
              question: "What rights do I have over AI-generated assets, and can I use them commercially?",
              answer: "You own what you create. Use it commercially, edit it, share it - it's all yours. Just be smart about it and make sure whatever you're doing is legal where you are."
            },
            {
              question: "Will my inputs and outputs be private, or could they be used to train the AI?",
              answer: "Your stuff stays private. We don't use your images or videos to train anything. What you upload and what you create is between you and us - we're not sharing it or learning from it. Your privacy matters to us."
            },
            {
              question: "How to generate animated video using AI?",
              answer: "It's actually pretty straightforward. First, choose whether you want to work with text or images. If you're going with text, just type out what you want to see - like 'a cat skateboarding in Times Square' or whatever scene you're imagining. Then pick your style (watercolor, cyber, pixel, or normal), set the duration (5s or 10s), choose your quality (480p, 720p, or 1080p), and hit 'Animate for Free'. If you're using images, upload your start and end frames, add a text prompt describing what should happen between them, and you're good to go. The AI does all the heavy lifting - no video editing skills required."
            },
            {
              question: "How to generate anime AI art?",
              answer: "Creating anime-style art is easy with our tool. Start by describing your anime character or scene in the text input box. Be specific about what you want - mention things like 'anime style', 'manga character', or describe typical anime features like big eyes, colorful hair, or dramatic expressions. You can also use our scene generation feature to create multiple anime-style frames. Once you generate your images, you can then turn them into animated videos. The key is being descriptive in your prompts - the more details you give about the anime aesthetic you're going for, the better the results will be."
            },
            {
              question: "如何制作 text to video 分镜？",
              answer: "制作 text to video 分镜非常简单。首先，在 Text to Video 模式下输入您的场景描述，然后勾选'分镜'选项。点击'生成分镜'按钮后，系统会自动将您的文本按句子分段，为每个分镜生成对应的预览图片。您可以为每个分镜编辑文案、上传自定义图片，然后分别为每个分镜生成动画视频。这样可以让您更好地控制视频的每个场景，创作出更精细的动画作品。"
            },
            {
              question: "分镜选项是干什么的？",
              answer: "分镜选项是 Text to Video 模式下的一个功能开关。当您勾选'分镜'选项时，系统会将您的文本描述自动拆分成多个分镜，每个分镜对应一段文本和一张预览图片。这样您可以：1) 预览每个分镜的效果；2) 单独编辑每个分镜的文案和图片；3) 为每个分镜独立生成动画视频。如果不勾选分镜选项，系统会直接将整个文本描述生成一个完整的视频。分镜功能特别适合需要精细控制视频内容的创作者。"
            }
          ].map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="bg-gray-900 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-800 transition-colors"
              >
                <h3 className="text-lg font-semibold text-left pr-4">{faq.question}</h3>
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
        <div className="text-center mt-12">
          <a href="/faq" className="text-blue-400 hover:underline">
            Need more help? Visit our full FAQ page
          </a>
        </div>
      </div>
      <Footer />
      
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
    </div>
  );
}
