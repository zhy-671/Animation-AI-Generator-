"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { deductVideoCredits } from "@/lib/credits/deduct";
import { checkCreditsBalance } from "@/lib/credits/deduct";
import { getUserSubscriptionPlan } from "@/lib/subscription/client";
import { 
  getSubscriptionPlanConfig, 
  isResolutionAllowed, 
  isAnimationStyleAllowed,
  calculateVideoCredits,
  type SubscriptionPlan 
} from "@/lib/subscription/rules";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Sparkles, Diamond, Info, Plus, Trash2, ArrowLeft, Coins, Clock } from "lucide-react";
import { InsufficientCreditsDialog } from "@/components/ui/insufficient-credits-dialog";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
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
  textPrompt: string;
  referenceImage: File | null;
  readerGroup: "Children" | "Teen" | "Adult" | "All Ages";
  model: string;
  duration: string;
  quality: string;
}

interface GeneratedImage {
  id: string;
  imageUrl: string | null;
  text: string;
  sceneDetail?: string;
  sceneTitle?: string;
  camera?: string;
  dialogue?: string[];
  sceneDuration?: string;
  sceneNumber: number;
  videoUrl?: string;
  isGeneratingVideo?: boolean;
  sceneItemId?: string;
  imageTaskId?: string | null;
  isGeneratingImage?: boolean;
  imageGenerationFailed?: boolean;
  imageStatus?: 'pending' | 'generating' | 'completed' | 'failed';
}

export default function StoryboardForm() {
  const router = useRouter();
  
  const [formData, setFormData] = useState<FormData>({
    textPrompt: "",
    referenceImage: null,
    readerGroup: "All Ages",
    model: "2d",
    duration: "10",
    quality: "480p"
  });

  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState<number | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // 积分不足弹窗状态
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [insufficientCreditsData, setInsufficientCreditsData] = useState<{
    required: number;
    current: number;
    action: string;
  } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false); // 是否显示创作区域
  const [showIdeaInput, setShowIdeaInput] = useState(false); // 是否显示初始想法输入界面
  const [ideaText, setIdeaText] = useState(""); // 初始想法文本
  const [myProjects, setMyProjects] = useState<Array<{
    id: string;
    title: string;
    summary: string;
    cover_image_url: string | null;
    created_at: string;
    updated_at: string;
  }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const planData = await getUserSubscriptionPlan();
        if (planData.plan !== undefined) {
          setSubscriptionPlan(planData.plan);
        }
        
        const balanceCheck = await checkCreditsBalance(0);
        if (balanceCheck.balance !== undefined) {
          setCreditsBalance(balanceCheck.balance);
        }
      } catch (error) {
      }
    };
    
    if (isMounted) {
      loadUserData();
      loadMyProjects();
    }
  }, [isMounted]);

  const loadMyProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch("/api/scenes");
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // 为每个项目获取第一个场景项的图片作为封面图（如果没有封面图）
          const projectsWithCover = await Promise.all(
            result.data.map(async (project: any) => {
              let coverImageUrl = project.cover_image_url;
              
              // 如果没有封面图，尝试获取第一个场景项的图片
              if (!coverImageUrl) {
                try {
                  const sceneResponse = await fetch(`/api/scenes?sceneId=${project.id}`);
                  if (sceneResponse.ok) {
                    const sceneResult = await sceneResponse.json();
                    if (sceneResult.success && sceneResult.data?.items?.length > 0) {
                      const firstItem = sceneResult.data.items[0];
                      if (firstItem.image_url) {
                        coverImageUrl = firstItem.image_url;
                        
                        // 如果是TOS URL，生成预签名URL
                        const isTosUrl = coverImageUrl.includes('tos-') || coverImageUrl.includes('.volces.com');
                        if (isTosUrl) {
                          try {
                            const presignedResponse = await fetch(`/api/scenes/presigned-image-url?imageUrl=${encodeURIComponent(coverImageUrl)}`);
                            if (presignedResponse.ok) {
                              const presignedResult = await presignedResponse.json();
                              if (presignedResult.success && presignedResult.data?.imageUrl) {
                                coverImageUrl = presignedResult.data.imageUrl;
                              }
                            }
                          } catch (error) {
                          }
                        }
                      }
                    }
                  }
                } catch (error) {
                }
              } else {
                // 如果已有封面图，检查是否是TOS URL并生成预签名URL
                const isTosUrl = coverImageUrl.includes('tos-') || coverImageUrl.includes('.volces.com');
                if (isTosUrl) {
                  try {
                    const presignedResponse = await fetch(`/api/scenes/presigned-image-url?imageUrl=${encodeURIComponent(coverImageUrl)}`);
                    if (presignedResponse.ok) {
                      const presignedResult = await presignedResponse.json();
                      if (presignedResult.success && presignedResult.data?.imageUrl) {
                        coverImageUrl = presignedResult.data.imageUrl;
                      }
                    }
                  } catch (error) {
                  }
                }
              }
              
              return {
                ...project,
                cover_image_url: coverImageUrl,
              };
            })
          );
          
          setMyProjects(projectsWithCover);
        }
      }
    } catch (error) {
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleNewProject = () => {
    setShowIdeaInput(true);
    setShowCreateForm(false);
    setIdeaText("");
    setCurrentSceneId(null);
    setGeneratedImages([]);
    setFormData({
      textPrompt: "",
      referenceImage: null,
      readerGroup: "All Ages",
      model: "2d",
      duration: "10",
      quality: "480p"
    });
    setReferenceImagePreview(null);
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToProjects = () => {
    setShowIdeaInput(false);
    setShowCreateForm(false);
    setIdeaText("");
    setCurrentSceneId(null);
    setGeneratedImages([]);
    setFormData({
      textPrompt: "",
      referenceImage: null,
      readerGroup: "All Ages",
      model: "2d",
      duration: "10",
      quality: "480p"
    });
    setReferenceImagePreview(null);
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextStep = () => {
    if (!ideaText.trim()) {
      alert("Please enter your idea or creative concept");
      return;
    }
    setShowIdeaInput(false);
    setShowCreateForm(true);
    setFormData(prev => ({ ...prev, textPrompt: ideaText }));
  };

  const handleIdeaSuggestionClick = (suggestion: string) => {
    setIdeaText(suggestion);
  };

  const handleLoadProject = async (sceneId: string) => {
    try {
      const response = await fetch(`/api/scenes?sceneId=${sceneId}`);
      if (!response.ok) {
        throw new Error("Failed to load project");
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        const sceneData = result.data;
        setCurrentSceneId(sceneId);
        setShowIdeaInput(false); // 加载项目时不显示初始想法输入界面
        setShowCreateForm(true);
        
        // 加载项目数据到表单
        if (sceneData.items && sceneData.items.length > 0) {
          const restoredImages: GeneratedImage[] = await Promise.all(
            sceneData.items.map(async (item: any) => {
              const metadata = item.metadata || {};
              let imageUrl = item.image_url || null;
              
              const finalImageUrl = imageUrl && imageUrl.trim() !== '' ? imageUrl : null;
              
              let displayImageUrl = finalImageUrl;
              if (finalImageUrl) {
                const isTosUrl = finalImageUrl.includes('tos-') || finalImageUrl.includes('.volces.com');
                if (isTosUrl) {
                  try {
                    const presignedResponse = await fetch(`/api/scenes/presigned-image-url?imageUrl=${encodeURIComponent(finalImageUrl)}`);
                    if (presignedResponse.ok) {
                      const presignedResult = await presignedResponse.json();
                      if (presignedResult.success && presignedResult.data?.imageUrl) {
                        displayImageUrl = presignedResult.data.imageUrl;
                      }
                    }
                  } catch (error) {
                  }
                }
              }
              
              return {
                id: item.id,
                imageUrl: displayImageUrl,
                text: item.text || '',
                sceneDetail: item.scene_detail || item.text || '',
                sceneTitle: metadata.scene_title || '',
                camera: metadata.camera || '',
                dialogue: metadata.dialogue || [],
                sceneDuration: metadata.scene_duration || '',
                sceneNumber: item.scene_number,
                videoUrl: item.video_url || undefined,
                isGeneratingVideo: false,
                isGeneratingImage: false,
                imageGenerationFailed: false,
                sceneItemId: item.id,
                imageStatus: displayImageUrl ? ('completed' as const) : ('failed' as const),
              };
            })
          );
          
          setGeneratedImages(restoredImages);
          
          setTimeout(() => {
            const previewSection = document.getElementById('scene-preview-section');
            if (previewSection) {
              previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }
      }
    } catch (error) {
      alert("Failed to load project");
    }
  };

  const handleDeleteClick = (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(sceneId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/scenes?sceneId=${projectToDelete}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setMyProjects(prev => prev.filter(p => p.id !== projectToDelete));
        if (currentSceneId === projectToDelete) {
          setCurrentSceneId(null);
          setGeneratedImages([]);
          setShowCreateForm(false);
        }
      } else {
        throw new Error("Failed to delete project");
      }
    } catch (error) {
      alert("Failed to delete project");
    } finally {
      setIsDeleting(false);
      setProjectToDelete(null);
    }
  };

  const handleReferenceImageUpload = (file: File) => {
    setFormData(prev => ({ ...prev, referenceImage: file }));
    const reader = new FileReader();
    reader.onloadend = () => {
      setReferenceImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeReferenceImage = () => {
    setFormData(prev => ({ ...prev, referenceImage: null }));
    setReferenceImagePreview(null);
  };

  const handleGenerate = async () => {
    if (!formData.textPrompt.trim()) {
      alert("Please enter story description");
      return;
    }

    setIsGenerating(true);
    
    try {
      if (currentSceneId) {
        setCurrentSceneId(null);
        setGeneratedImages([]);
      }
      
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
      formDataToSend.append("prompt", `${formData.textPrompt}，${stylePrompt}`);
      formDataToSend.append("readerGroup", formData.readerGroup);
      formDataToSend.append("style", formData.model);
      
      if (formData.referenceImage) {
        formDataToSend.append("referenceImage", formData.referenceImage);
      }

      const response = await fetch("/api/scenes/generate", {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate storyboard");
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const newImages: GeneratedImage[] = result.data.scenes.map((scene: any, index: number) => ({
          id: `img-${Date.now()}-${index}`,
          imageUrl: scene.imageUrl || null,
          text: scene.text,
          sceneDetail: scene.sceneDetail || "",
          sceneTitle: scene.sceneTitle || "",
          camera: scene.camera || "",
          dialogue: scene.dialogue || [],
          sceneDuration: scene.duration || "",
          sceneNumber: scene.sceneNumber,
          videoUrl: undefined,
          isGeneratingVideo: false,
          isGeneratingImage: index === 0 && scene.imageTaskId,
          imageGenerationFailed: scene.imageGenerationFailed || false,
          sceneItemId: scene.sceneItemId,
          imageTaskId: scene.imageTaskId || null,
          imageStatus: scene.imageUrl ? ('completed' as const) : (index === 0 && scene.imageTaskId ? ('generating' as const) : ('pending' as const)),
        }));
        
        setGeneratedImages(newImages);
        
        if (newImages.length > 0 && newImages[0].imageTaskId && !newImages[0].imageUrl) {
          setCurrentGeneratingIndex(0);
        }
        
        if (result.data.sceneId) {
          setCurrentSceneId(result.data.sceneId);
          localStorage.setItem('currentSceneId', result.data.sceneId);
        }
        
        setIsGenerating(false);
        setShowCreateForm(true); // 显示创作区域
        setShowIdeaInput(false); // 隐藏初始想法输入界面
        
        await new Promise(resolve => setTimeout(resolve, 0));
        
        pollImageStatusSequentially(newImages, result.data.sceneId || null, newImages.length);
        
        // 重新加载项目列表
        loadMyProjects();
        
        setTimeout(() => {
          const previewSection = document.getElementById('scene-preview-section');
          if (previewSection) {
            previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to generate story script");
      setIsGenerating(false);
    }
  };

  const pollImageStatusSequentially = async (images: GeneratedImage[], sceneId: string | null, sceneCount: number) => {
    const imagesToProcess = images.filter(
      img => img.imageTaskId && img.imageStatus !== 'completed' && img.imageStatus !== 'failed'
    );
    
    if (imagesToProcess.length === 0) {
      return;
    }
    
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < imagesToProcess.length; i++) {
      const item = imagesToProcess[i];
      const itemIndex = images.findIndex(img => img.id === item.id);
      if (itemIndex === -1) continue;
      
      setCurrentGeneratingIndex(itemIndex);
      
      setGeneratedImages(prev => prev.map(img => 
        img.id === item.id 
          ? { ...img, imageStatus: 'generating' as const, isGeneratingImage: true }
          : img
      ));
      
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
              try {
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
                    });
                  }
                  
                  return updated;
                });
                
                setCurrentGeneratingIndex(null);
                successCount++;
                return true;
              } catch (uploadError) {
                setGeneratedImages(prev => prev.map(img => 
                  img.id === item.id 
                    ? { 
                        ...img, 
                        imageUrl: imageUrl,
                        isGeneratingImage: false,
                        imageStatus: 'completed',
                        imageTaskId: undefined
                      }
                    : img
                ));
                setCurrentGeneratingIndex(null);
                return true;
              }
            } else if (status === "FAILED" || status === "CANCELED") {
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
              return true;
            } else if (status === "PENDING" || status === "RUNNING") {
              return new Promise<boolean>((resolve) => {
                setTimeout(async () => {
                  const result = await poll();
                  resolve(result);
                }, 3000);
              });
            }
          }
          
          return false;
        } catch (error) {
          setGeneratedImages(prev => prev.map(img => 
            img.id === item.id 
              ? { 
                  ...img, 
                  isGeneratingImage: false,
                  imageStatus: 'failed',
                  imageGenerationFailed: true,
                  imageTaskId: undefined
                }
              : img
          ));
          setCurrentGeneratingIndex(null);
          failedCount++;
          return true;
        }
      };
      
      await poll();
      
      if (i < imagesToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  const handleGenerateVideo = async (imageId: string) => {
    const imageItem = generatedImages.find(img => img.id === imageId);
    if (!imageItem || !imageItem.imageUrl) {
      alert("Please upload or generate an image first");
      return;
    }

    const currentQuality = formData.quality || "480p";
    const currentDuration = parseInt(formData.duration || "10");
    const resolution = currentQuality as '480p' | '720p' | '1080p';
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
      const currentModel = formData.model || "2d";
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
      
      // 使用Sora API生成视频
      // 根据分辨率选择模型
      const selectedModel = duration === 15 ? "sora_video2-landscape-15s" : "sora_video2-landscape";
      
      // 根据分辨率设置size
      const resolutionMap: Record<string, string> = {
        "480p": "1280x704",
        "720p": "1280x704",
        "1080p": "1920x1080",
      };
      const size = resolutionMap[currentQuality] || "1280x704";
      
      const response = await fetch("/api/video/generate-sora-video2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: imageItem.text || "动画视频",
          imageUrl: imageItem.imageUrl,
          size: size,
          seconds: duration,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate video");
      }

      const result = await response.json();
      const taskId = result.data.taskId;

      const pollStatus = async () => {
        const maxAttempts = 40;
        const interval = 15000;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 0 : interval));
            
            const statusResponse = await fetch(`/api/video/status-sora-video2?taskId=${taskId}`);
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
              throw new Error(`Failed to get video status: ${errorMessage}`);
            }

            const statusResult = await statusResponse.json();
            const status = statusResult.data;

            // Sora API返回的状态格式：status为"completed"或"SUCCEEDED"，url字段包含视频URL
            if ((status.status === "completed" || status.status === "SUCCEEDED") && status.url) {
              // 使用Sora API的下载接口上传到TOS
              const downloadResponse = await fetch("/api/video/download-sora-video2", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  taskId: taskId,
                  sceneItemId: imageItem.sceneItemId,
                  shotNumber: imageItem.shotNumber,
                }),
              });
              
              if (!downloadResponse.ok) {
                const downloadError = await downloadResponse.json();
                throw new Error(downloadError.error || "Failed to download and upload video");
              }
              
              const downloadResult = await downloadResponse.json();
              const storedVideoUrl = downloadResult.data.videoUrl;
              
              const resolution = currentQuality as '480p' | '720p' | '1080p';
              const deductResult = await deductVideoCredits(resolution, currentDuration, {
                taskId,
                sceneItemId: imageItem.sceneItemId,
                imageId,
              }, subscriptionPlan);
              
              if (!deductResult.success) {
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
            
              // 视频已经通过download-sora-video2上传到TOS，直接保存
              const resolutionMap: Record<string, string> = {
                "480p": "480P",
                "720p": "720P",
                "1080p": "1080P",
              };
              const dashScopeResolution = resolutionMap[currentQuality] || "480P";

              await fetch("/api/video/save", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  videoUrl: storedVideoUrl,
                  prompt: imageItem.text,
                  sceneDetail: imageItem.sceneDetail,
                  imageUrl: imageItem.imageUrl,
                  resolution: dashScopeResolution,
                  taskId: taskId,
                  requestId: taskId,
                  sceneItemId: imageItem.sceneItemId,
                }),
              });

              setGeneratedImages(prev => 
                prev.map(img => 
                  img.id === imageId 
                    ? { ...img, videoUrl: storedVideoUrl, isGeneratingVideo: false }
                    : img
                )
              );
              
              const balanceCheck = await checkCreditsBalance(0);
              if (balanceCheck.balance !== undefined) {
                setCreditsBalance(balanceCheck.balance);
              }
              
              return;
            } else if (status.status === "FAILED" || status.status === "failed") {
              throw new Error(status.message || "Video generation failed");
            }
          } catch (error) {
            setGeneratedImages(prev => 
              prev.map(img => 
                img.id === imageId 
                  ? { ...img, isGeneratingVideo: false }
                  : img
              )
            );
            alert(error instanceof Error ? error.message : "Video generation failed");
            return;
          }
        }
        
        throw new Error("Video generation timeout");
      };

      await pollStatus();
    } catch (error) {
      setGeneratedImages(prev => 
        prev.map(img => 
          img.id === imageId 
            ? { ...img, isGeneratingVideo: false }
            : img
        )
      );
      alert(error instanceof Error ? error.message : "Video generation failed");
    }
  };

  const qualities = [
    { value: "480p", label: "480P" },
    { value: "720p", label: "720P", requiresSubscription: true },
    { value: "1080p", label: "1080P", requiresSubscription: true },
  ];

  const models = [
    { value: "2d", label: "2D Animation" },
    { value: "3d", label: "3D Animation", requiresSubscription: true },
    { value: "anime", label: "Japanese Anime", requiresSubscription: true },
    { value: "cyberpunk", label: "Cyberpunk", requiresSubscription: true },
    { value: "clay", label: "Clay Animation", requiresSubscription: true },
    { value: "comic", label: "American Comic", requiresSubscription: true },
    { value: "cartoon", label: "Cartoon", requiresSubscription: true },
  ];

  const planConfig = getSubscriptionPlanConfig(subscriptionPlan);
  const isCurrentQualityAllowed = isResolutionAllowed(subscriptionPlan, formData.quality as "480p" | "720p" | "1080p");
  const isCurrentModelAllowed = isAnimationStyleAllowed(subscriptionPlan, formData.model);

  return (
    <>
      <div className="min-h-screen bg-black text-white">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <AnimatePresence mode="wait">
          {!showIdeaInput && !showCreateForm && (
            <motion.div
              key="projects-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Story Script Creator</h1>
                <p className="text-gray-400">Create detailed story scripts with AI-powered scene generation</p>
              </div>

              {/* 新建项目按钮 */}
              <div className="mb-6">
                <button
                  onClick={handleNewProject}
                  className="flex items-center gap-3 px-6 py-4 bg-gray-900 hover:bg-gray-800 border-2 border-dashed border-gray-700 hover:border-[#FFDA2A] rounded-xl transition-all group"
                >
                  <div className="w-12 h-12 bg-gray-800 group-hover:bg-[#FFDA2A]/20 rounded-lg flex items-center justify-center transition-colors">
                    <Plus className="w-6 h-6 text-gray-400 group-hover:text-[#FFDA2A] transition-colors" />
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-semibold text-white">New Project</div>
                    <div className="text-sm text-gray-400">Start a new story project</div>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 初始想法输入界面 */}
        <AnimatePresence mode="wait">
          {showIdeaInput && (
            <motion.div
              key="idea-input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-900 rounded-xl p-8 md:p-12 shadow-xl mb-8 max-w-4xl mx-auto"
            >
              {/* 返回按钮 */}
              <button
                onClick={handleBackToProjects}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Projects</span>
              </button>

              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                Hi! Video maker, share your ideas or creative concepts
              </h2>
            
            <div className="space-y-6">
              {/* 输入框 */}
              <div className="relative">
                <label className="absolute top-2 left-4 text-sm text-gray-400 z-10">
                  Enter your idea
                </label>
                <Textarea
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  placeholder="e.g., A cat skateboarding in Times Square..."
                  className="min-h-[200px] w-full resize-none bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-[#FFDA2A] pt-8 pb-4 px-4"
                  rows={8}
                />
              </div>

              {/* 下一步按钮 */}
              <div className="flex justify-center">
                <Button
                  onClick={handleNextStep}
                  disabled={!ideaText.trim()}
                  className="px-12 py-6 text-lg font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed !bg-[#FFDA2A] hover:!bg-[#FFDA2A]/90 text-gray-900"
                >
                  Next Step
                </Button>
              </div>

              {/* 提示想法（两行4列，共8个） */}
              <div className="mt-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    "A cat skateboarding in Times Square",
                    "Flying cars in a futuristic city",
                    "Little spirits in a magical forest",
                    "Daily life on a space station",
                    "An adventure story in the underwater world",
                    "Friendship with a robot companion",
                    "A princess in a fairy tale castle",
                    "Cyberpunk-style street scene"
                  ].map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleIdeaSuggestionClick(suggestion)}
                      className="px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-[#FFDA2A]/50 rounded-lg text-sm text-gray-300 hover:text-white transition-all text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 创作区域 */}
        <AnimatePresence mode="wait">
          {showCreateForm && !showIdeaInput && (
            <motion.div
              key="create-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-900 rounded-xl p-6 md:p-8 shadow-xl mb-8"
            >
          <div className="space-y-6">
            <div className="space-y-4">
              <Textarea
                placeholder="Enter your story description here… e.g. 'A cat skateboarding in Times Square'"
                value={formData.textPrompt}
                onChange={(e) => setFormData(prev => ({ ...prev, textPrompt: e.target.value }))}
                className="min-h-[180px] w-full resize-none bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500"
                rows={7}
              />
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col items-center gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    Reference Image (Optional)
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

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    Reader Group
                  </label>
                  <Select
                    value={formData.readerGroup}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, readerGroup: value as any }))}
                  >
                    <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Ages">All Ages</SelectItem>
                      <SelectItem value="Children">Children</SelectItem>
                      <SelectItem value="Teen">Teen</SelectItem>
                      <SelectItem value="Adult">Adult</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    Animation Style
                  </label>
                  <Select
                    value={formData.model}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, model: value }))}
                  >
                    <SelectTrigger className={`w-[180px] bg-gray-800 border-gray-700 text-white ${!isCurrentModelAllowed ? 'border-red-500' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => {
                        const requiresSub = model.requiresSubscription && subscriptionPlan === null;
                        const isAllowed = isAnimationStyleAllowed(subscriptionPlan, model.value);
                        return (
                          <SelectItem
                            key={model.value}
                            value={model.value}
                            disabled={!isAllowed}
                            onSelect={(e) => {
                              if (!isAllowed) {
                                e.preventDefault();
                                const planConfig = getSubscriptionPlanConfig(subscriptionPlan);
                                alert(`Your current subscription plan (${planConfig.name}) does not support ${model.label} style.\n\nPlease upgrade your plan to use this style.\n\nClick OK to go to the pricing page.`);
                                router.push('/pricing');
                              }
                            }}
                          >
                            <span className="flex items-center gap-2">
                              {model.label}
                              {requiresSub && (
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

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    Resolution
                  </label>
                  <Select
                    value={formData.quality}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, quality: value }))}
                  >
                    <SelectTrigger className={`w-[140px] bg-gray-800 border-gray-700 text-white ${!isCurrentQualityAllowed ? 'border-red-500' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {qualities.map((quality) => {
                        const requiresSub = quality.requiresSubscription && subscriptionPlan === null;
                        const isAllowed = isResolutionAllowed(subscriptionPlan, quality.value as "480p" | "720p" | "1080p");
                        return (
                          <SelectItem
                            key={quality.value}
                            value={quality.value}
                            disabled={!isAllowed}
                            onSelect={(e) => {
                              if (!isAllowed) {
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

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    Duration
                  </label>
                  <Select
                    value={formData.duration}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, duration: value }))}
                  >
                    <SelectTrigger className="w-[120px] bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="15">15 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={
                !formData.textPrompt.trim() ||
                isGenerating ||
                !isCurrentQualityAllowed ||
                !isCurrentModelAllowed
              }
              className="w-full px-6 py-3 text-gray-900 font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed !bg-[#FFDA2A] hover:!bg-[#FFDA2A]"
            >
              {isGenerating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-6 h-6"
                  >
                    <Sparkles className="w-6 h-6 text-gray-900" />
                  </motion.div>
                  <span>Generating story script...</span>
                </>
              ) : (
                <>
                  <Diamond className="w-7 h-7 text-gray-900" />
                  <span className="text-sm">
                    Generate Story Script
                    <span className="ml-2 text-xs opacity-90">
                      {calculateVideoCredits(subscriptionPlan, formData.quality as '480p' | '720p' | '1080p', parseInt(formData.duration || "10"))}
                    </span>
                  </span>
                </>
              )}
            </Button>
          </div>
        </motion.div>
          )}
        </AnimatePresence>

        {/* 我的项目列表 */}
        <AnimatePresence mode="wait">
          {!showIdeaInput && !showCreateForm && (
            <motion.div
              key="projects-list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mt-8"
            >
              <h2 className="text-2xl font-bold mb-6">My Projects</h2>
          {loadingProjects ? (
            <div className="flex items-center justify-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8"
              >
                <Sparkles className="w-8 h-8 text-[#FFDA2A]" />
              </motion.div>
            </div>
          ) : myProjects.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No projects yet. Click "New Project" to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myProjects.map((project) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-[#FFDA2A]/50 transition-all cursor-pointer group relative"
                  onClick={() => handleLoadProject(project.id)}
                >
                  {/* 封面图 */}
                  <div className="aspect-video bg-gray-800 relative overflow-hidden">
                    {project.cover_image_url ? (
                      <img
                        src={project.cover_image_url}
                        alt={project.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // 如果图片加载失败，显示占位符
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.parentElement?.querySelector('.placeholder');
                          if (placeholder) {
                            (placeholder as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div className={`placeholder w-full h-full flex items-center justify-center ${project.cover_image_url ? 'hidden' : ''}`}>
                      <Info className="w-12 h-12 text-gray-600" />
                    </div>
                  </div>
                  
                  {/* 项目信息 */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                      {project.title}
                    </h3>
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                      {project.summary}
                    </p>
                    <div className="text-xs text-gray-500">
                      {new Date(project.created_at).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 故事剧本预览区域 */}
        {showCreateForm && generatedImages.length > 0 && (
          <div id="scene-preview-section" className="mt-8 bg-gray-900 rounded-xl p-6 md:p-8 shadow-xl">
            <div className="space-y-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Story Script Preview</h3>
                <p className="text-sm text-gray-400">Generate story scripts from text descriptions. Each scene corresponds to a text description. Click the "Generate Video" button to create animated videos for each scene.</p>
              </div>
              <AnimatePresence mode="popLayout">
                {generatedImages.map((item, index) => {
                  const isCurrentlyGenerating = currentGeneratingIndex === index;
                  const isPending = currentGeneratingIndex !== null && index > currentGeneratingIndex && !item.imageUrl;
                  
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
                      
                      {isPending && (
                        <div className="absolute inset-0 bg-black/40 rounded-xl flex flex-col items-center justify-center gap-2 z-40 pointer-events-none">
                          <div className="w-8 h-8 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-gray-400">Waiting...</span>
                        </div>
                      )}
                      
                      <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="flex-shrink-0 flex flex-col items-center gap-3">
                          <div className="flex items-center justify-center gap-2">
                            <Info className="w-5 h-5 text-gray-400" />
                            <span className="text-sm text-gray-300 font-medium">Scene {item.sceneNumber}</span>
                          </div>
                          <div className="relative w-56 h-40">
                            {item.imageStatus === 'failed' || (item.imageGenerationFailed && !item.imageUrl) ? (
                              <div className="w-full h-full bg-gray-700 rounded-lg flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-600">
                                <Upload className="w-8 h-8 text-gray-500" />
                                <span className="text-xs text-gray-400">Image generation failed</span>
                              </div>
                            ) : item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={`Scene ${item.sceneNumber}: ${item.text}`}
                                className="w-full h-full object-cover rounded-lg border-2 border-gray-700"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-700 rounded-lg flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-600">
                                <div className="w-8 h-8 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-gray-400">Generating...</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex-1 space-y-4">
                          {item.sceneTitle && (
                            <div>
                              <h4 className="text-lg font-semibold text-white mb-1">{item.sceneTitle}</h4>
                            </div>
                          )}
                          
                          {item.sceneDetail && (
                            <div>
                              <p className="text-sm text-gray-300">{item.sceneDetail}</p>
                            </div>
                          )}
                          
                          {item.camera && (
                            <div>
                              <span className="text-xs text-gray-500">Camera: </span>
                              <span className="text-sm text-gray-400">{item.camera}</span>
                            </div>
                          )}
                          
                          {item.dialogue && item.dialogue.length > 0 && (
                            <div>
                              <span className="text-xs text-gray-500">Dialogue: </span>
                              <div className="mt-1 space-y-1">
                                {item.dialogue.map((line, idx) => (
                                  <p key={idx} className="text-sm text-gray-300">"{line}"</p>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <Button
                            onClick={() => handleGenerateVideo(item.id)}
                            disabled={item.isGeneratingVideo || !item.imageUrl || hasGeneratingImages || !allImagesGenerated}
                            className="px-6 py-3 bg-[#FFDA2A] text-gray-900 font-semibold rounded-lg hover:bg-[#FFDA2A]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {item.isGeneratingVideo ? 'Generating...' : item.videoUrl ? 'Regenerate Video' : 'Generate Video'}
                          </Button>
                          
                          {item.videoUrl && (
                            <div className="mt-4">
                              <video
                                src={item.videoUrl}
                                controls
                                className="w-full rounded-lg"
                              >
                                <source src={item.videoUrl} type="video/mp4" />
                              </video>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone and all associated data (scenes, storyboards, characters, etc.) will be permanently removed."
        itemName="project"
        isLoading={isDeleting}
      />
      </div>
    </>
  );
}

