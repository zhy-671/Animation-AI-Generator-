"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Image as ImageIcon, Film, Video, Camera, MessageSquare, FileText, Clock, X, Edit2, Save, CheckCircle, Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import StoryboardNav from "./storyboard-nav";
import { useToast } from "@/components/ui/toast-notification";
import { checkCreditsBalance, deductCredits, deductVideoCredits } from "@/lib/credits/deduct";
import { calculateVideoCredits, type SubscriptionPlan } from "@/lib/subscription/rules";
import { getUserSubscriptionPlan } from "@/lib/subscription/client";
import { InsufficientCreditsDialog } from "@/components/ui/insufficient-credits-dialog";
import SceneImageGenerateModal from "./scene-image-generate-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Shot {
  shot_number: number;
  description: string;
  image_prompt: string; // 图片生成提示词
  video_prompt?: string; // 视频生成提示词
  framing: string;
  camera_angle: string;
  camera_movement?: string;
  composition?: string;
  lighting?: string;
  mood?: string;
  narration: string;
  dialogue: string;
  characters?: string; // 角色字段（字符串，逗号分隔）
  appearCharacters?: string[]; // 角色数组（从AI生成的分镜中提取）
  image_url?: string; // 分镜图片URL
  video_url?: string; // 视频URL
}

interface Storyboard {
  scene_title: string;
  scene_summary: string;
  shots: Shot[];
  characters: Array<{
    name: string;
    traits: string;
    appearance: string;
    style_prompt: string;
  }>;
}

interface SceneItem {
  id: string; // sceneItemId from API
  sceneNumber: number;
  text: string;
  sceneDetail: string | null;
  imageUrl: string | null;
  sceneImageUrl: string | null; // 场景图URL，用于在生成分镜图片时作为参考图
  sceneTitle: string | null;
  camera: string | null;
  dialogue: string[] | null;
  duration: string | null;
  imageTaskId: string | null;
  imageGenerationFailed: boolean;
  // 新增字段
  场次时间?: string | null;
  场次地点?: string | null;
  主要角色?: Array<{ 姓名: string; "心理/情绪状态"?: string; 心理情绪状态?: string }> | null;
  场次故事?: string | null;
  关键画面提示?: { 镜头1?: string; 镜头2?: string; 镜头3?: string } | null;
  // 分镜数据
  storyboard?: Storyboard | null;
}

interface SceneData {
  sceneId: string;
  title: string;
  summary: string;
  scenes: SceneItem[];
}

export default function StoryboardCreateForm() {
  const router = useRouter();
  const { showError, showSuccess, showInfo, showWarning } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  const [selectedSceneNumber, setSelectedSceneNumber] = useState<number | null>(null);
  const [imageStatuses, setImageStatuses] = useState<Map<string, { status: 'pending' | 'generating' | 'completed' | 'failed', imageUrl: string | null }>>(new Map());
  const [projectId, setProjectId] = useState<string | null>(null);
  const [statusScript, setStatusScript] = useState(false);
  const [statusSettings, setStatusSettings] = useState(false);
  const [statusStoryboard, setStatusStoryboard] = useState(false);
  const [statusVideo, setStatusVideo] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingSceneData, setEditingSceneData] = useState<SceneItem | null>(null);
  const [isSavingScene, setIsSavingScene] = useState(false);
  // 积分不足弹窗状态
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [insufficientCreditsData, setInsufficientCreditsData] = useState<{
    required: number;
    current: number;
    action: string;
  } | null>(null);
  
  // 场景图生成弹窗状态
  const [showSceneImageModal, setShowSceneImageModal] = useState(false);
  
  // Scene Location 编辑状态
  const [editingSceneLocation, setEditingSceneLocation] = useState<string | null>(null); // 正在编辑的 scene id
  const [editingLocationValue, setEditingLocationValue] = useState<string>(""); // 编辑中的值
  const [isSavingLocation, setIsSavingLocation] = useState(false); // 是否正在保存
  
  // 订阅计划状态（用于计算积分显示）
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(null);
  
  // 加载订阅计划（页面加载时查询一次）
  useEffect(() => {
    const loadSubscriptionPlan = async () => {
      try {
        const planData = await getUserSubscriptionPlan();
        if (planData.plan !== undefined) {
          setSubscriptionPlan(planData.plan);
        }
      } catch (error) {
      }
    };
    
    loadSubscriptionPlan();
  }, []);
  
  // 角色列表（从anim_characters表查询，页面加载时查询一次）
  const [charactersList, setCharactersList] = useState<Array<{
    id: string;
    name: string;
    image_url: string | null;
    image_generation_prompt: string | null;
    resolution?: string | null;
    visual_style?: string | null;
    art_setting?: string | null;
  }>>([]);

  // Load characters from anim_characters table when projectId is available
  const loadCharacters = async (projectId: string) => {
    try {
      const response = await fetch(`/api/storyboard/characters?projectId=${projectId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.characters) {
          setCharactersList(result.data.characters);
        }
      } else {
        setCharactersList([]);
      }
    } catch (error) {
      setCharactersList([]);
    }
  };

  // 检查是否有视频（只要有一个视频就视为完成）
  const checkIfHasVideo = (): boolean => {
    if (!sceneData || !sceneData.scenes) {
      return false;
    }
    
    // 遍历所有场景，检查分镜中是否有视频
    for (const scene of sceneData.scenes) {
      if (scene.storyboard && scene.storyboard.shots) {
        for (const shot of scene.storyboard.shots) {
          if (shot.video_url && shot.video_url.trim() !== '') {
            return true; // 只要找到一个视频就返回 true
          }
        }
      }
    }
    
    return false;
  };

  // 更新项目步骤状态
  const updateProjectStepStatus = async (step: 'step_script' | 'step_settings' | 'step_storyboard' | 'step_video', completed: boolean) => {
    if (!projectId) return;
    
    try {
      const response = await fetch('/api/storyboard/project-step-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          [step]: completed,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // 更新本地状态
          if (step === 'step_video') {
            setStatusVideo(result.data.step_video || false);
          } else if (step === 'step_storyboard') {
            setStatusStoryboard(result.data.step_storyboard || false);
          }
        }
      } else {
      }
    } catch (error) {
    }
  };

  useEffect(() => {
    // Get projectId from sessionStorage
    if (typeof window !== 'undefined') {
      const pid = sessionStorage.getItem("storyboardProjectId");
      setProjectId(pid);
      
      if (pid) {
        // Load characters from anim_characters table (once on page load)
        loadCharacters(pid);
        
        // Load saved scene data
        loadScenesFromDatabase(pid);
        
        // Load project step status from anim_project_step_status table
        const loadProjectStepStatus = async () => {
          try {
            const response = await fetch(`/api/storyboard/project-step-status?projectId=${pid}`);
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                setStatusScript(result.data.step_script || false);
                setStatusSettings(result.data.step_settings || false);
                setStatusStoryboard(result.data.step_storyboard || false);
                setStatusVideo(result.data.step_video || false);
              } else {
                // 如果查询失败，默认所有步骤未完成
                setStatusScript(false);
                setStatusSettings(false);
                setStatusStoryboard(false);
                setStatusVideo(false);
              }
            } else {
              // 查询失败，默认所有步骤未完成
              setStatusScript(false);
              setStatusSettings(false);
              setStatusStoryboard(false);
              setStatusVideo(false);
            }
          } catch (error) {
            // 查询失败，默认所有步骤未完成
            setStatusScript(false);
            setStatusSettings(false);
            setStatusStoryboard(false);
            setStatusVideo(false);
          }
        };
        loadProjectStepStatus();
      }
    }
  }, []);

  // 跟踪当前正在生成图片的分镜索引（在selectedSceneItems中的索引）
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState<number | null>(null);

  // 从数据库加载已保存的场次数据
  const loadScenesFromDatabase = async (projectId: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/scenes?projectId=${projectId}`);
      
      if (response.status === 404) {
        showWarning("Scene data not found. Please complete project settings and save first");
        router.push("/storyboard");
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch scene data");
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error("Scene data not found");
      }
      
      const sceneData = result.data;
      
      // 转换数据格式（新格式：支持场次时间、地点、故事等字段）
      const scenes: SceneItem[] = (sceneData.items || []).map((item: any) => {
        const metadata = item.metadata || {};
        // 解析关键画面提示（如果存储为JSON字符串）
        let visualPrompts = null;
        if (item.scene_detail) {
          try {
            visualPrompts = typeof item.scene_detail === 'string' ? JSON.parse(item.scene_detail) : item.scene_detail;
          } catch (e) {
            visualPrompts = null;
          }
        }
        
        return {
          id: item.id,
          sceneNumber: item.scene_number || 0,
          text: item.text || "",
          sceneDetail: item.scene_detail || null,
          imageUrl: item.image_url || null,
          sceneImageUrl: item.scene_image_url || null, // 场景图URL
          sceneTitle: metadata.scene_title || metadata.场次标题 || null,
          camera: metadata.camera || null,
          dialogue: Array.isArray(metadata.dialogue) ? metadata.dialogue : (metadata.dialogue ? [metadata.dialogue] : null),
          duration: metadata.scene_duration || null,
          imageTaskId: null,
          imageGenerationFailed: false,
          // 新增字段 - 同时支持英文和中文字段名
          场次时间: metadata.scene_time || metadata.场次时间 || null,
          场次地点: metadata.scene_location || metadata.场次地点 || null,
          主要角色: metadata.main_characters || metadata.主要角色 || [],
          场次故事: metadata.scene_story || metadata.场次故事 || null,
          关键画面提示: visualPrompts || metadata.关键画面提示 || null,
          // 分镜数据
          storyboard: (() => {
            const storyboardData = metadata.storyboard;
            if (storyboardData) {
              return {
                ...storyboardData,
                shots: (storyboardData.shots || []).map((shot: any) => ({
                  ...shot,
                  image_url: shot.image_url || null, // Ensure image_url field exists
                  video_url: shot.video_url || null, // Ensure video_url field exists
                  // Parse appearCharacters: if it's a string (comma-separated), convert to array; if it's already an array, use it
                  appearCharacters: shot.appearCharacters 
                    ? (Array.isArray(shot.appearCharacters) 
                        ? shot.appearCharacters 
                        : (typeof shot.appearCharacters === 'string' 
                            ? shot.appearCharacters.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
                            : []))
                    : (shot.characters && typeof shot.characters === 'string'
                        ? shot.characters.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
                        : []),
                })),
              };
            }
            return null;
          })(),
        };
      });
      
      setSceneData({
        sceneId: sceneData.id,
        title: sceneData.title || "Untitled Project",
        summary: sceneData.summary || "",
        scenes,
      });
      
      // 如果已经有选中的场次，保持选中状态；否则默认选中第一个场次
      if (selectedSceneNumber === null && scenes.length > 0) {
        const firstSceneNumber = scenes[0].sceneNumber;
        setSelectedSceneNumber(firstSceneNumber);
      } else if (selectedSceneNumber !== null) {
        // 检查选中的场次是否仍然存在
        const selectedSceneExists = scenes.some(s => s.sceneNumber === selectedSceneNumber);
        if (!selectedSceneExists && scenes.length > 0) {
          setSelectedSceneNumber(scenes[0].sceneNumber);
        } else {
        }
      }
      
      // 打印加载后的分镜数据统计
      const scenesWithStoryboard = scenes.filter(s => s.storyboard && s.storyboard.shots && s.storyboard.shots.length > 0);
      // 初始化所有图片状态
      const initialStatuses = new Map<string, { status: 'pending' | 'generating' | 'completed' | 'failed', imageUrl: string | null }>();
      scenes.forEach((scene) => {
        const status = scene.imageUrl ? 'completed' : 'pending';
        initialStatuses.set(scene.id, { status, imageUrl: scene.imageUrl });
      });
      setImageStatuses(initialStatuses);
      
      // 注意：step_storyboard 状态只在视频生成成功后才更新，这里不更新
      
      // 检查是否有视频，如果有则更新 step_video 状态
      const hasVideo = scenes.some(s => 
        s.storyboard && s.storyboard.shots && 
        s.storyboard.shots.some((shot: any) => shot.video_url && shot.video_url.trim() !== '')
      );
      if (hasVideo && !statusVideo) {
        if (projectId) {
          updateProjectStepStatus('step_video', true);
          setStatusVideo(true);
        }
      }
      
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to load scene data");
    } finally {
      setIsGenerating(false);
    }
  };

  const autoGenerateScenes = async () => {
    setIsGenerating(true);

    try {
      // 从 sessionStorage 读取项目信息
      const projectId = sessionStorage.getItem("storyboardProjectId");
      const storyContentStr = sessionStorage.getItem("storyboardContent");
      const storyOutlineStr = sessionStorage.getItem("storyboardOutline");

      if (!projectId) {
        showWarning("Project information not found. Please return to project list");
        router.push("/storyboard");
        return;
      }

      // 获取项目信息
      const projectResponse = await fetch(`/api/storyboard/projects/${projectId}`);
      
      // 如果项目不存在（404），跳转到项目列表
      if (projectResponse.status === 404) {
        showWarning("Project does not exist. Please return to project list");
        router.push("/storyboard");
        return;
      }
      
      if (!projectResponse.ok) {
        const errorData = await projectResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch project information");
      }
      const projectData = await projectResponse.json();

      // 准备生成数据
      const formDataToSend = new FormData();
      
      if (storyContentStr) {
        try {
          const storyContent = JSON.parse(storyContentStr);
          formDataToSend.append("storyContent", JSON.stringify(storyContent));
        } catch (e) {
          // 如果解析失败，使用项目内容
          formDataToSend.append("prompt", projectData.data.content || "");
        }
      } else {
        formDataToSend.append("prompt", projectData.data.content || "");
      }

      // 传递项目ID，以便API可以获取storyOutline和characters
      formDataToSend.append("projectId", projectId);

      // 使用项目的视觉风格
      formDataToSend.append("style", projectData.data.visual_style || "2d");
      formDataToSend.append("readerGroup", "All Ages");

      // 使用SSE流式响应获取实时进度
      const response = await fetch("/api/scenes/generate", {
        method: "POST",
        headers: {
          'Accept': 'text/event-stream',
        },
        body: formDataToSend,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate scenes");
      }

      if (!response.body) {
        throw new Error("Response body is empty");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
            continue;
          }
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            try {
              const data = JSON.parse(dataStr);
              
              // 处理分镜数据事件
              if (currentEvent === 'scenes' && data.sceneId) {
                const scenes: SceneItem[] = data.scenes.map((scene: any, idx: number) => ({
                  id: scene.sceneItemId || `scene_${scene.sceneNumber}_${Date.now()}_${idx}`,
                  sceneNumber: scene.sceneNumber,
                  text: scene.text || scene.sceneDetail || "",
                  sceneDetail: scene.sceneDetail || scene.text || "",
                  imageUrl: null,
                  sceneTitle: scene.sceneTitle || null,
                  camera: scene.camera || null,
                  dialogue: Array.isArray(scene.dialogue) ? scene.dialogue : (scene.dialogue ? [scene.dialogue] : null),
                  duration: scene.duration || null,
                  imageTaskId: null,
                  imageGenerationFailed: false,
                }));

                setSceneData({
                  sceneId: data.sceneId,
                  title: data.title,
                  summary: data.summary,
                  scenes,
                });

                // 默认选中第一个场次
                if (scenes.length > 0) {
                  setSelectedSceneNumber(scenes[0].sceneNumber);
                }

                // 初始化所有图片状态为pending
                const initialStatuses = new Map<string, { status: 'pending' | 'generating' | 'completed' | 'failed', imageUrl: string | null }>();
                scenes.forEach((scene) => {
                  initialStatuses.set(scene.id, { status: 'pending', imageUrl: null });
                });
                setImageStatuses(initialStatuses);
              }
              
              // 处理图片开始生成事件
              if (currentEvent === 'image-start' && data.index !== undefined && data.sceneItemId) {
                setSceneData((prev) => {
                  if (!prev) return null;
                  const updatedScenes = prev.scenes.map((s, idx) => {
                    if (idx === data.index) {
                      return { ...s, imageTaskId: 'generating' };
                    }
                    return s;
                  });
                  return { ...prev, scenes: updatedScenes };
                });
                
                // 更新图片状态为generating
                setImageStatuses((prev) => {
                  const newMap = new Map(prev);
                  const sceneId = data.sceneItemId;
                  if (sceneId) {
                    newMap.set(sceneId, { status: 'generating', imageUrl: null });
                  }
                  return newMap;
                });
                
                // 设置当前生成索引（在selectedSceneItems中的索引）
                setSceneData((prev) => {
                  if (!prev) return null;
                  const sceneItem = prev.scenes[data.index];
                  if (sceneItem) {
                    const selectedScenes = prev.scenes.filter(s => s.sceneNumber === selectedSceneNumber);
                    const indexInSelected = selectedScenes.findIndex(s => s.id === sceneItem.id);
                    if (indexInSelected >= 0) {
                      setCurrentGeneratingIndex(indexInSelected);
                    }
                  }
                  return prev;
                });
              }
              
              // 处理图片完成事件
              if (currentEvent === 'image-complete' && data.index !== undefined && data.sceneItemId !== undefined) {
                setSceneData((prev) => {
                  if (!prev) return null;
                  const updatedScenes = prev.scenes.map((s, idx) => {
                    if (idx === data.index) {
                      return { ...s, imageUrl: data.imageUrl || null, imageGenerationFailed: !data.success };
                    }
                    return s;
                  });
                  return { ...prev, scenes: updatedScenes };
                });
                
                // 更新图片状态
                setImageStatuses((prev) => {
                  const newMap = new Map(prev);
                  const sceneId = data.sceneItemId;
                  if (sceneId) {
                    newMap.set(sceneId, {
                      status: data.success ? 'completed' : 'failed',
                      imageUrl: data.imageUrl || null,
                    });
                  }
                  return newMap;
                });
                
                // 更新当前生成索引为下一个
                if (data.success) {
                  setSceneData((prev) => {
                    if (!prev) return null;
                    const nextIndex = data.index + 1;
                    if (nextIndex < prev.scenes.length) {
                      const nextScene = prev.scenes[nextIndex];
                      const selectedScenes = prev.scenes.filter(s => s.sceneNumber === selectedSceneNumber);
                      const indexInSelected = selectedScenes.findIndex(s => s.id === nextScene.id);
                      if (indexInSelected >= 0) {
                        setCurrentGeneratingIndex(indexInSelected);
                      } else {
                        setCurrentGeneratingIndex(null);
                      }
                    } else {
                      setCurrentGeneratingIndex(null);
                    }
                    return prev;
                  });
                }
              }
              
              // 处理完成事件
              if (currentEvent === 'done') {
                setCurrentGeneratingIndex(null);
                setIsGenerating(false);
              }
              
              // 处理错误事件
              if (currentEvent === 'error' && data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
            }
            currentEvent = '';
          }
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to generate scenes");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackToProjects = () => {
    router.push("/storyboard");
  };

  // 获取当前选中的场次（每个场次对应一个章节，所以应该只有一个）
  const selectedScene = sceneData?.scenes.find(
    (scene) => scene.sceneNumber === selectedSceneNumber
  ) || null;
  
  const selectedSceneItems = selectedScene ? [selectedScene] : [];
  
  // 调试：打印当前选中场次的分镜信息
  useEffect(() => {
    if (selectedScene) {
    } else {
    }
  }, [selectedScene, selectedSceneNumber, sceneData]);

  // 开始编辑场次
  const handleStartEdit = (scene: SceneItem) => {
    setEditingSceneId(scene.id);
    setEditingSceneData({ ...scene });
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingSceneId(null);
    setEditingSceneData(null);
  };

  // 保存场次修改
  const handleSaveScene = async () => {
    if (!editingSceneData || !sceneData) return;

    setIsSavingScene(true);
    try {
      // 调用API更新场次数据
      const response = await fetch(`/api/scenes/items/${editingSceneData.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: editingSceneData.text,
          scene_detail: editingSceneData.关键画面提示 ? JSON.stringify(editingSceneData.关键画面提示) : null,
          metadata: {
            scene_title: editingSceneData.sceneTitle,
            场次时间: editingSceneData.场次时间,
            场次地点: editingSceneData.场次地点,
            主要角色: editingSceneData.主要角色,
            场次故事: editingSceneData.场次故事,
            关键画面提示: editingSceneData.关键画面提示,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Save failed");
      }

      // 更新本地状态
      setSceneData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === editingSceneData.id ? editingSceneData : s
          ),
        };
      });

      setEditingSceneId(null);
      setEditingSceneData(null);
      showSuccess("Saved successfully");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSavingScene(false);
    }
  };

  // 开始编辑 Scene Location
  const handleStartEditLocation = (scene: SceneItem) => {
    setEditingSceneLocation(scene.id);
    setEditingLocationValue(scene.场次地点 || "");
  };

  // 取消编辑 Scene Location
  const handleCancelEditLocation = () => {
    setEditingSceneLocation(null);
    setEditingLocationValue("");
  };

  // 保存 Scene Location
  const handleSaveLocation = async () => {
    if (!editingSceneLocation || !sceneData) return;

    setIsSavingLocation(true);
    try {
      // 找到对应的场景
      const scene = sceneData.scenes.find((s) => s.id === editingSceneLocation);
      if (!scene) {
        throw new Error("Scene not found");
      }

      // 调用API更新场次数据
      const response = await fetch(`/api/scenes/items/${editingSceneLocation}`, {
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
      setSceneData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === editingSceneLocation
              ? { ...s, 场次地点: editingLocationValue }
              : s
          ),
        };
      });

      setEditingSceneLocation(null);
      setEditingLocationValue("");
      showSuccess("Scene Location saved successfully");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSavingLocation(false);
    }
  };

  // 生成分镜的状态
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [generatingStoryboardSceneId, setGeneratingStoryboardSceneId] = useState<string | null>(null);
  
  // 分镜图片生成和编辑状态
  const [generatingShotImageId, setGeneratingShotImageId] = useState<string | null>(null);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [editingShotData, setEditingShotData] = useState<Shot | null>(null);
  // 生成的图片数组和选中状态（用于编辑模态框）
  const [generatedShotImages, setGeneratedShotImages] = useState<string[]>([]);
  const [selectedShotImageIndex, setSelectedShotImageIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!editingShotId) return;
    if (generatedShotImages.length === 0) return;

    setEditingShotData((prev) => {
      if (!prev) return prev;
      const index = selectedShotImageIndex ?? 0;
      const nextImageUrl = generatedShotImages[index] || null;
      if (!nextImageUrl || prev.image_url === nextImageUrl) {
        return prev;
      }
      return { ...prev, image_url: nextImageUrl };
    });
  }, [editingShotId, generatedShotImages, selectedShotImageIndex]);
  // 保存成功提示状态
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  // 视频生成状态
  const [generatingVideoShotId, setGeneratingVideoShotId] = useState<string | null>(null);
  // 视频生成设置模态框状态
  const [videoGenerationModal, setVideoGenerationModal] = useState<{
    isOpen: boolean;
    shot: Shot | null;
    sceneItemId: string | null;
  }>({
    isOpen: false,
    shot: null,
    sceneItemId: null,
  });
  // 视频生成参数
  const [videoDescription, setVideoDescription] = useState<string>("");
  const [videoResolution, setVideoResolution] = useState<"480P" | "720P" | "1080P">("480P");
  const [videoDuration, setVideoDuration] = useState<10 | 15>(10);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  // Video detail modal state
  const [videoDetailModal, setVideoDetailModal] = useState<{
    isOpen: boolean;
    shot: Shot | null;
    sceneTitle: string;
  }>({
    isOpen: false,
    shot: null,
    sceneTitle: "",
  });

  // 相机角度选项
  const cameraAngleOptions = [
    "low-angle", // 低角度
    "high-angle", // 高角度
    "eye-level", // 平视
    "Dutch", // 倾斜角度
    "overhead", // 俯视
    "tilt", // 倾斜
    "POV", // 主观视角
  ];

  // 相机运动选项
  const cameraMovementOptions = [
    "pan", // 摇摄
    "dolly", // 推拉
    "tracking", // 跟拍
    "tilt", // 上下摇
    "zoom", // 变焦
    "static", // 固定
    "crane", // 升降
  ];

  // 生成分镜
  const handleGenerateStoryboard = async (scene: SceneItem) => {
    if (!projectId) {
      showError("Project ID does not exist");
      return;
    }

    // 检查积分余额（需要3积分）
    const creditsCheck = await checkCreditsBalance(3);
    if (!creditsCheck.sufficient) {
      setInsufficientCreditsData({
        required: 3,
        current: creditsCheck.balance || 0,
        action: "generate storyboard"
      });
      setShowInsufficientCreditsDialog(true);
      return;
    }

    // 扣除积分
    const deductResult = await deductCredits(
      3,
      "Generate storyboard",
      { type: "storyboard_generation", project_id: projectId, scene_id: scene.id }
    );

    if (!deductResult.success) {
      showError("Failed to deduct credits. Please try again.");
      return;
    }

    // 触发积分更新事件，刷新头部余额显示
    window.dispatchEvent(new Event("credits-updated"));

    setIsGeneratingStoryboard(true);
    setGeneratingStoryboardSceneId(scene.id);

    try {
      const response = await fetch("/api/storyboard/generate-storyboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scene_item_id: scene.id,
          project_id: projectId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate storyboard");
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to generate storyboard");
      }

      // 重新加载场次数据以显示生成的分镜
      if (projectId) {
        await loadScenesFromDatabase(projectId);
        // 确保选中生成分镜的场次，以便立即显示分镜
        // 延迟一下，确保 sceneData 状态已更新
        setTimeout(() => {
          // 直接选中生成分镜的场次
          setSelectedSceneNumber(scene.sceneNumber);
        }, 300);
        
        // 注意：分镜和视频状态检查在 loadScenesFromDatabase 中完成
        // 因为 loadScenesFromDatabase 会检查所有场景的分镜和视频数据
      }

      showSuccess("Storyboard generated successfully!");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to generate storyboard");
    } finally {
      setIsGeneratingStoryboard(false);
      setGeneratingStoryboardSceneId(null);
    }
  };

  // 生成分镜图片
  const handleGenerateShotImage = async (shot: Shot, sceneId: string, updateEditingData: boolean = false) => {
    if (!projectId) {
      showError("Project ID does not exist");
      return;
    }

    const shotId = `${sceneId}-${shot.shot_number}`;
    setGeneratingShotImageId(shotId);
    
    try {
      // 调用图片生成API
      const response = await fetch("/api/storyboard/generate-shot-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scene_item_id: sceneId,
          project_id: projectId,
          shot_number: shot.shot_number,
          image_prompt: shot.image_prompt || "",
          characters: shot.characters || "",
          appearCharacters: shot.appearCharacters || (shot.characters ? shot.characters.split(',').map((c: string) => c.trim()) : []),
          charactersList: charactersList, // Pass cached characters list to avoid database query
          watermark: false, // Default false: no watermark, direct return from Volcano API
          editMode: updateEditingData, // Pass edit mode flag to API
        }),
      });

      if (!response.ok) {
        let error;
        try {
          error = await response.json();
        } catch (parseError) {
          const errorText = await response.text();
          throw new Error(`Server error (${response.status}): ${errorText.substring(0, 200)}`);
        }
        throw new Error(error.error || error.message || "Failed to generate storyboard image");
      }

      const result = await response.json();
      if (!result.success) {
        console.error("[handleGenerateShotImage] API returned error:", result);
        throw new Error(result.error || result.message || "Failed to generate storyboard image");
      }

      // 检查返回数据是否存在
      if (!result.data || typeof result.data !== 'object') {
        throw new Error("API returned invalid data format");
      }

      // 检查返回数据是否为空对象
      if (Object.keys(result.data).length === 0) {
        throw new Error("API returned empty data object. This may indicate an error occurred during image generation. Please check the server logs.");
      }

      const { taskId, imageUrl, imageUrls, isVolcanoAPI, watermark } = result.data;
      
      // 类型转换：确保布尔值正确
      const isVolcanoAPIBool = isVolcanoAPI === true || isVolcanoAPI === "true";
      const watermarkBool = watermark === false || watermark === "false" || watermark === null || watermark === undefined;
      // 如果直接返回了图片URL（火山引擎API且watermark为false），不需要轮询
      // 检查条件：有imageUrl或imageUrls且没有taskId，或者明确标记为火山API且watermark为false
      // 注意：isVolcanoAPI可能为true，或者没有taskId但有imageUrl/imageUrls，都表示是火山API直接返回
      const hasImageData = !!(imageUrl || (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0));
      // 如果明确标记为火山API且watermark为false，或者有图片数据但没有taskId，都认为是火山API直接返回
      const isVolcanoDirectReturn = (isVolcanoAPIBool && watermarkBool) || (hasImageData && !taskId);
      // 如果有图片数据且满足火山API直接返回的条件，直接处理，不进行轮询
      if (hasImageData && isVolcanoDirectReturn) {
        // 编辑模式优先使用imageUrls，非编辑模式优先使用imageUrl，如果都没有则使用另一个
        let finalImageUrlsArray: string[] = [];
        
        if (updateEditingData) {
          // 编辑模式：优先使用imageUrls数组
          if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
            finalImageUrlsArray = imageUrls;
          } else if (imageUrl) {
            finalImageUrlsArray = [imageUrl];
          }
        } else {
          // 非编辑模式：优先使用imageUrl，如果没有则使用imageUrls的第一张
          if (imageUrl) {
            finalImageUrlsArray = [imageUrl];
          } else if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
            finalImageUrlsArray = [imageUrls[0]];
          }
        }
        
        if (finalImageUrlsArray.length === 0) {
          throw new Error("No image URLs available in API response");
        }
        // 扣除积分
        const creditsToDeduct = 5;
        const creditsCheck = await checkCreditsBalance(creditsToDeduct);
        if (!creditsCheck.sufficient) {
          throw new Error("Insufficient credits. Image generated but credits cannot be deducted.");
        }

        const deductResult = await deductCredits(
          creditsToDeduct,
          updateEditingData ? "Generate shot images (edit mode)" : "Generate shot image",
          { type: "shot_image_generation", project_id: projectId, scene_id: sceneId, shot_number: shot.shot_number, edit_mode: updateEditingData }
        );

        if (!deductResult.success) {
          throw new Error("Image generated but failed to deduct credits. Please contact support.");
        }

        // 触发积分更新事件，刷新头部余额显示
        window.dispatchEvent(new Event("credits-updated"));

        // 如果是在编辑模式下，显示生成的图片供选择（4张）
        if (updateEditingData) {
          console.log("[handleGenerateShotImage] Setting generated images in edit mode:", finalImageUrlsArray.length);
          setGeneratedShotImages(finalImageUrlsArray);
          setSelectedShotImageIndex(0); // 默认选中第一张
          setGeneratingShotImageId(null);
          return; // 不自动保存，等待用户选择后点击保存
        }
        
        // 非编辑模式：自动使用图片（优先使用imageUrl，如果没有则使用finalImageUrlsArray的第一张）
        const imageUrlToUse = imageUrl || (finalImageUrlsArray.length > 0 ? finalImageUrlsArray[0] : null);
        if (!imageUrlToUse) {
          throw new Error("No image URL available to use");
        }
        // 更新分镜的图片URL到数据库
        try {
          // 先获取当前的metadata
          const currentSceneResponse = await fetch(`/api/scenes?projectId=${projectId}`);
          if (!currentSceneResponse.ok) {
            throw new Error("Failed to fetch scene data");
          }
          
          const currentSceneResult = await currentSceneResponse.json();
          if (!currentSceneResult.success || !currentSceneResult.data) {
            throw new Error("Scene data does not exist");
          }
          
          const sceneItems = currentSceneResult.data.items || [];
          const currentSceneItem = sceneItems.find((item: any) => item.id === sceneId);
          
          if (!currentSceneItem) {
            throw new Error("Corresponding scene item not found");
          }
          
          const currentMetadata = currentSceneItem.metadata || {};
          const currentStoryboard = currentMetadata.storyboard || {};
          const currentShots = currentStoryboard.shots || [];
          
          // 更新对应shot的image_url
          const updatedShots = currentShots.map((s: Shot) => {
            if (s.shot_number === shot.shot_number) {
              return { ...s, image_url: imageUrlToUse };
            }
            return s;
          });
          
          const updatedStoryboard = {
            ...currentStoryboard,
            shots: updatedShots,
          };
          
          const updatedMetadata = {
            ...currentMetadata,
            storyboard: updatedStoryboard,
          };
          
          // 调用API更新metadata
          const updateResponse = await fetch(`/api/scenes/items/${sceneId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              metadata: updatedMetadata,
            }),
          });
          
          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(errorData.error || "Failed to update storyboard image");
          }
          // 更新本地状态，避免重新加载整个页面
          if (selectedScene && selectedScene.storyboard && sceneData) {
            const updatedShots = selectedScene.storyboard.shots.map((s: Shot) => {
              if (s.shot_number === shot.shot_number) {
                return { ...s, image_url: imageUrlToUse };
              }
              return s;
            });
            
            // 更新当前选中的场次
            const updatedSelectedScene = {
              ...selectedScene,
              storyboard: {
                ...selectedScene.storyboard,
                shots: updatedShots,
              },
            };
            
            // 更新场景数据
            const updatedScenes = sceneData.scenes.map((s: SceneItem) => {
              if (s.id === selectedScene.id) {
                return updatedSelectedScene;
              }
              return s;
            });
            
            setSceneData({
              ...sceneData,
              scenes: updatedScenes,
            });
            
            // 如果是在编辑模式下生成的图片，更新编辑数据
            if (updateEditingData && editingShotData && editingShotData.shot_number === shot.shot_number) {
              setEditingShotData({
                ...editingShotData,
                image_url: imageUrlToUse,
              });
            } else {
              // 确保编辑状态已清除，避免显示保存按钮
              setEditingShotId(null);
              setEditingShotData(null);
            }
          }
          
          // 不显示alert，避免页面重新加载
          setGeneratingShotImageId(null);
          return;
        } catch (updateError) {
          showWarning(`Image generated successfully but update failed: ${updateError instanceof Error ? updateError.message : "Unknown error"}`);
          setGeneratingShotImageId(null);
          return;
        }
      }
      
      // 需要轮询的情况（DashScope API）
      // 只有在没有imageUrl和imageUrls的情况下才需要taskId进行轮询
      const hasAnyImageData = imageUrl || (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0);
      if (!hasAnyImageData && !taskId) {
        throw new Error("No taskId or imageUrl/imageUrls returned from API");
      }
      
      // 如果有imageUrl或imageUrls但没有taskId，说明是直接返回的图片（可能是火山API），不应该到这里
      // 但为了安全，如果确实有图片URL，直接处理，不进行轮询
      if (hasAnyImageData && !taskId) {
        // Fallback处理：直接使用图片数据
        try {
          const fallbackImageUrls = imageUrl ? [imageUrl] : (imageUrls && Array.isArray(imageUrls) ? imageUrls : []);
          if (fallbackImageUrls.length > 0) {
            // 扣除积分
            const creditsToDeduct = 5;
            const creditsCheck = await checkCreditsBalance(creditsToDeduct);
            if (creditsCheck.sufficient) {
              const deductResult = await deductCredits(
                creditsToDeduct,
                updateEditingData ? "Generate shot images (edit mode)" : "Generate shot image",
                { type: "shot_image_generation", project_id: projectId, scene_id: sceneId, shot_number: shot.shot_number, edit_mode: updateEditingData }
              );
              if (deductResult.success) {
                window.dispatchEvent(new Event("credits-updated"));
              }
            }
            
            if (updateEditingData) {
              setGeneratedShotImages(fallbackImageUrls);
              setSelectedShotImageIndex(0);
            } else {
              // 非编辑模式：更新metadata中的shot图片
              const imageUrlToUse = fallbackImageUrls[0];
              // 这里需要更新metadata，但为了简化，先清除loading状态
              // 实际更新应该在正常流程中完成
            }
          }
        } catch (e) {
        }
        setGeneratingShotImageId(null);
        return;
      }
      
      // 轮询图片生成状态
      const pollImageStatus = async (): Promise<string[] | null> => {
        const maxAttempts = 60; // 最多轮询60次（约5分钟）
        let attempts = 0;

        const poll = async (): Promise<string[] | null> => {
          if (attempts >= maxAttempts) {
            throw new Error("Image generation timed out");
          }

          try {
            const statusResponse = await fetch(`/api/scenes/image-status?taskId=${taskId}`);
            if (!statusResponse.ok) {
              throw new Error("Failed to query image status");
            }

            const statusResult = await statusResponse.json();
            if (!statusResult.success) {
              throw new Error(statusResult.error || "Failed to query image status");
            }

            const { status, imageUrl, imageUrls, message } = statusResult.data;

            if (status === "SUCCEEDED") {
              // 图片生成成功，扣除积分
              // 编辑模式下扣除积分（统一为5积分）
              const creditsToDeduct = 5;
              const creditsCheck = await checkCreditsBalance(creditsToDeduct);
              if (!creditsCheck.sufficient) {
                throw new Error("Insufficient credits. Image generated but credits cannot be deducted.");
              }

              const deductResult = await deductCredits(
                creditsToDeduct,
                updateEditingData ? "Generate shot images (edit mode)" : "Generate shot image",
                { type: "shot_image_generation", project_id: projectId, scene_id: sceneId, shot_number: shot.shot_number, edit_mode: updateEditingData }
              );

              if (!deductResult.success) {
                throw new Error("Image generated but failed to deduct credits. Please contact support.");
              }

              // 触发积分更新事件，刷新头部余额显示
              window.dispatchEvent(new Event("credits-updated"));

              // 返回所有图片URLs（最多4张）
              if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
                return imageUrls;
              } else if (imageUrl) {
                // 向后兼容：如果只有单张图片
                return [imageUrl];
              } else {
                throw new Error("Image generation succeeded but no image URL returned");
              }
            } else if (status === "FAILED") {
              // 使用 API 返回的详细错误信息（如果有）
              const errorMessage = message 
                ? `Image generation failed: ${message}` 
                : "Image generation failed. Please try again later";
              throw new Error(errorMessage);
            } else {
              // 继续轮询
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
              return poll();
            }
          } catch (error) {
            throw error;
          }
        };

        return poll();
      };

      // 开始轮询
      const polledImageUrls = await pollImageStatus();
      
      if (polledImageUrls && polledImageUrls.length > 0) {
        // 如果是在编辑模式下，显示生成的图片供选择
        if (updateEditingData) {
          setGeneratedShotImages(polledImageUrls);
          setSelectedShotImageIndex(0); // 默认选中第一张
          setGeneratingShotImageId(null);
          return; // 不自动保存，等待用户选择后点击保存
        }
        
        // 非编辑模式：自动使用第一张图片
        const imageUrl = polledImageUrls[0];
        // 更新分镜的图片URL到数据库
        // 需要更新 metadata.storyboard.shots[shot_number-1].image_url
        try {
          // 先获取当前的metadata
          const currentSceneResponse = await fetch(`/api/scenes?projectId=${projectId}`);
          if (!currentSceneResponse.ok) {
            throw new Error("Failed to fetch scene data");
          }
          
          const currentSceneResult = await currentSceneResponse.json();
          if (!currentSceneResult.success || !currentSceneResult.data) {
            throw new Error("Scene data does not exist");
          }
          
          const sceneItems = currentSceneResult.data.items || [];
          const currentSceneItem = sceneItems.find((item: any) => item.id === sceneId);
          
          if (!currentSceneItem) {
            throw new Error("Corresponding scene item not found");
          }
          
          const currentMetadata = currentSceneItem.metadata || {};
          const currentStoryboard = currentMetadata.storyboard || {};
          const currentShots = currentStoryboard.shots || [];
          
          // 更新对应shot的image_url
          const updatedShots = currentShots.map((s: Shot) => {
            if (s.shot_number === shot.shot_number) {
              return { ...s, image_url: imageUrl };
            }
            return s;
          });
          
          const updatedStoryboard = {
            ...currentStoryboard,
            shots: updatedShots,
          };
          
          const updatedMetadata = {
            ...currentMetadata,
            storyboard: updatedStoryboard,
          };
          
          // 调用API更新metadata
          const updateResponse = await fetch(`/api/scenes/items/${sceneId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              metadata: updatedMetadata,
            }),
          });
          
          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(errorData.error || "Failed to update storyboard image");
          }
          // 更新本地状态，避免重新加载整个页面
          if (selectedScene && selectedScene.storyboard && sceneData) {
            const updatedShots = selectedScene.storyboard.shots.map((s: Shot) => {
              if (s.shot_number === shot.shot_number) {
                return { ...s, image_url: imageUrl };
              }
              return s;
            });
            
            // 更新当前选中的场次
            const updatedSelectedScene = {
              ...selectedScene,
              storyboard: {
                ...selectedScene.storyboard,
                shots: updatedShots,
              },
            };
            
            // 更新场景数据
            const updatedScenes = sceneData.scenes.map((s: SceneItem) => {
              if (s.id === selectedScene.id) {
                return updatedSelectedScene;
              }
              return s;
            });
            
            setSceneData({
              ...sceneData,
              scenes: updatedScenes,
            });
            
            // 如果是在编辑模式下生成的图片，更新编辑数据
            if (updateEditingData && editingShotData && editingShotData.shot_number === shot.shot_number) {
              setEditingShotData({
                ...editingShotData,
                image_url: imageUrl,
              });
            } else {
              // 确保编辑状态已清除，避免显示保存按钮
              setEditingShotId(null);
              setEditingShotData(null);
            }
          }
          
          // 不显示alert，避免页面重新加载
        } catch (updateError) {
          showWarning(`Image generated successfully but update failed: ${updateError instanceof Error ? updateError.message : "Unknown error"}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Image generation failed. Please try again later";
      showError(errorMessage);
      // 图片生成失败，不扣除积分（积分只在成功时扣除）
    } finally {
      setGeneratingShotImageId(null);
    }
  };

  // 开始编辑分镜
  const handleEditShot = (shot: Shot) => {
    setEditingShotId(`${selectedScene?.id}-${shot.shot_number}`);
    setEditingShotData({ ...shot });
    // 清除之前生成的图片
    setGeneratedShotImages([]);
    setSelectedShotImageIndex(null);
  };

  // 取消编辑分镜
  const handleCancelEditShot = () => {
    // If image is generating, keep the generating state but close the modal
    // The generating state will be maintained so the list button shows "Generating..."
    setEditingShotId(null);
    setEditingShotData(null);
    // Clear generated images only if not generating
    if (!generatingShotImageId) {
      setGeneratedShotImages([]);
      setSelectedShotImageIndex(null);
    }
  };

  // 打开视频生成设置模态框
  const handleOpenVideoGenerationModal = (shot: Shot, sceneItemId: string) => {
    if (!shot.image_url) {
      showWarning("Please generate storyboard image first");
      return;
    }
    
    // Prefer video_prompt from storyboard as video description
    const description = shot.video_prompt || shot.image_prompt || "";
    
    setVideoDescription(description);
    setVideoGenerationModal({
      isOpen: true,
      shot: shot,
      sceneItemId: sceneItemId,
    });
  };

  // 关闭视频生成设置模态框
  const handleCloseVideoGenerationModal = () => {
    setVideoGenerationModal({
      isOpen: false,
      shot: null,
      sceneItemId: null,
    });
  };

  // 实际执行视频生成
  const handleConfirmGenerateVideo = async () => {
    if (!videoGenerationModal.shot || !videoGenerationModal.sceneItemId) {
      return;
    }

    const shot = videoGenerationModal.shot;
    const sceneItemId = videoGenerationModal.sceneItemId;
    const shotId = `${sceneItemId}-${shot.shot_number}`;

    try {
      // 获取订阅计划
      const planData = await getUserSubscriptionPlan();
      const subscriptionPlan: SubscriptionPlan = planData.plan || null;

      // 转换分辨率为小写格式（480P -> 480p）
      const resolutionLower = videoResolution.toLowerCase() as '480p' | '720p' | '1080p';
      const duration = videoDuration;

      // 计算视频积分（根据订阅计划和积分规则）
      // 注意：1080p 单独计费，没有订阅计划则按照 1080p 的双倍来计算
      // 480p 和 720p 没有订阅计划时统一按 720p 费率扣除
      const requiredCredits = calculateVideoCredits(subscriptionPlan, resolutionLower, duration);

      // 检查积分余额（仅检查，不扣费）
      const creditsCheck = await checkCreditsBalance(requiredCredits);
      if (!creditsCheck.sufficient) {
        setInsufficientCreditsData({
          required: requiredCredits,
          current: creditsCheck.balance || 0,
          action: `generate ${duration}s ${videoResolution} video`
        });
        setShowInsufficientCreditsDialog(true);
        setGeneratingVideoShotId(null);
        return;
      }

      // 不关闭模态框，保持打开状态以显示生成进度
      setGeneratingVideoShotId(shotId);

      // 获取项目设置中的视觉风格和宽高比
      const projectResponse = await fetch(`/api/storyboard/projects/${projectId}`);
      if (!projectResponse.ok) {
        throw new Error("Failed to fetch project information");
      }
      const projectData = await projectResponse.json();
      const visualStyle = projectData.data?.visual_style || "2D动画";
      const artSetting = projectData.data?.art_setting || "16:9"; // 默认16:9横屏

      // 风格提示词映射
      const stylePrompts: Record<string, string> = {
        "2D动画": "2D动画风格，平面动画效果",
        "3D动漫": "3D动画风格，立体三维效果",
        "日本二次元": "日本二次元风格，日式动漫风格",
        "粘土动画": "粘土动画风格，粘土材质效果",
        "美式漫画": "美式漫画风格，美漫风格",
        "卡通风格": "动漫风格，卡通动画效果",
        "赛博朋克": "赛博朋克风格，未来科技感",
        "3D卡通": "3D卡通风格，立体卡通效果",
      };
      const stylePrompt = stylePrompts[visualStyle] || "2D动画风格";

      const dashScopeModel = "wan2.5-i2v-preview";
      const dashScopeResolution = videoResolution;

      // 优先使用分镜中的 video_prompt，如果用户在弹窗中修改了描述则使用修改后的描述
      let finalDescription = videoDescription.trim();
      if (!finalDescription) {
        // 如果没有输入，优先使用分镜中的 video_prompt
        finalDescription = shot.video_prompt || shot.image_prompt || shot.description || "动画视频";
      }

      let apiEndpoint: string;
      let requestBody: any;
      let statusEndpoint: string;
      let downloadEndpoint: string;
      let selectedModel: string;

      // 根据宽高比和时长选择模型
      // 9:16 竖屏使用 sora_video2，其他使用 sora_video2-landscape
      const isPortrait = artSetting === "9:16";
      if (duration === 15) {
        selectedModel = isPortrait ? "sora_video2-15s" : "sora_video2-landscape-15s";
      } else {
        selectedModel = isPortrait ? "sora_video2" : "sora_video2-landscape";
      }
      
      // 根据宽高比和分辨率设置size
      let size: string;
      if (artSetting === "9:16") {
        // 竖屏尺寸
        const portraitSizeMap: Record<string, string> = {
          "480P": "576x1024",
          "720P": "720x1280",
          "1080P": "1080x1920",
        };
        size = portraitSizeMap[videoResolution] || "720x1280";
      } else {
        // 横屏尺寸
        const landscapeSizeMap: Record<string, string> = {
          "480P": "1280x704",
          "720P": "1280x704",
          "1080P": "1920x1080",
        };
        size = landscapeSizeMap[videoResolution] || "1280x704";
      }
      
      const soraPrompt = finalDescription; // 严格使用视频描述，不添加风格提示词
      
      requestBody = {
        prompt: soraPrompt,
        imageUrl: shot.image_url, // 可以是 URL 或本地文件路径
        size: size,
        seconds: duration, // 使用用户选择的时长
        model: selectedModel, // 传递模型名称（API 会根据 aspectRatio 自动选择，但这里也传递以确保一致性）
        aspectRatio: artSetting, // 传递宽高比，让 API 可以自动选择模型
      };

      apiEndpoint = "/api/video/generate-sora-video2";
      statusEndpoint = "/api/video/status-sora-video2";
      downloadEndpoint = "/api/video/download-sora-video2";


      // 调用视频生成API
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // 检查响应类型，避免解析 HTML 错误页面
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to generate video");
        } else {
          // 响应是 HTML（错误页面）
          const errorText = await response.text();
          throw new Error(`Server error (${response.status}): Please try again later`);
        }
      }

      // 检查响应类型，确保是 JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        throw new Error("Invalid response from server. Please try again.");
      }

      const result = await response.json();
      const taskId = result.data.taskId;


      // 轮询视频生成状态
      const pollStatus = async () => {
        const maxAttempts = 40;
        const interval = 15000; // 15秒间隔

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 0 : interval));

            const statusResponse = await fetch(`${statusEndpoint}?taskId=${taskId}`);
            if (!statusResponse.ok) {
              // 检查响应类型
              const contentType = statusResponse.headers.get("content-type");
              if (contentType && contentType.includes("application/json")) {
                const errorData = await statusResponse.json();
                throw new Error(errorData.error || "获取视频状态失败");
              } else {
                const errorText = await statusResponse.text();
                throw new Error(`Server error (${statusResponse.status}): Please try again later`);
              }
            }

            // 检查响应类型
            const statusContentType = statusResponse.headers.get("content-type");
            if (!statusContentType || !statusContentType.includes("application/json")) {
              const errorText = await statusResponse.text();
              throw new Error("Invalid response from server. Please try again.");
            }

            const statusResult = await statusResponse.json();
            const status = statusResult.data;

            if (status.status === "completed" && status.url) {
              // 视频生成成功，先扣除积分
              const deductResult = await deductVideoCredits(
                resolutionLower,
                duration,
                { 
                  type: "shot_video_generation", 
                  project_id: projectId, 
                  scene_id: sceneItemId, 
                  shot_number: shot.shot_number 
                },
                subscriptionPlan
              );

              if (!deductResult.success) {
                // 扣费失败，但视频已生成，记录错误但继续处理
                console.error("Failed to deduct credits after video generation:", deductResult.error);
              } else {
                // 触发积分更新事件，刷新头部余额显示
                window.dispatchEvent(new Event("credits-updated"));
              }

              // 下载视频并上传到云存储
              const downloadResponse = await fetch(downloadEndpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  taskId: taskId,
                }),
              });

              if (!downloadResponse.ok) {
                // 检查响应类型
                const contentType = downloadResponse.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                  const downloadError = await downloadResponse.json();
                  throw new Error(downloadError.error || "Failed to download and upload video");
                } else {
                  const errorText = await downloadResponse.text();
                  throw new Error(`Server error (${downloadResponse.status}): Please try again later`);
                }
              }

              // 检查响应类型
              const downloadContentType = downloadResponse.headers.get("content-type");
              if (!downloadContentType || !downloadContentType.includes("application/json")) {
                const errorText = await downloadResponse.text();
                throw new Error("Invalid response from server. Please try again.");
              }

              const downloadResult = await downloadResponse.json();
              const storedVideoUrl = downloadResult.data.videoUrl;

              // Save video information to database
              const saveVideoResponse = await fetch("/api/scenes/videos", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  sceneItemId: sceneItemId,
                  videoUrl: storedVideoUrl,
                  prompt: shot.description,
                  sceneDetail: shot.image_prompt,
                  imageUrl: shot.image_url,
                  resolution: dashScopeResolution,
                  taskId: taskId,
                  requestId: taskId, // laozhang 使用 taskId 作为 requestId
                  shotNumber: shot.shot_number, // 传递shot_number用于更新metadata
                }),
              });

              if (!saveVideoResponse.ok) {
                const errorData = await saveVideoResponse.json();
                throw new Error(errorData.error || "Failed to save video to database");
              }

              // 更新本地状态
              if (!selectedScene || !selectedScene.storyboard || !sceneData) {
                return;
              }

              const updatedShots = selectedScene.storyboard.shots.map((s: Shot) =>
                s.shot_number === shot.shot_number
                  ? { ...s, video_url: storedVideoUrl }
                  : s
              );

              const updatedSceneData = {
                ...sceneData,
                scenes: sceneData.scenes.map((s) =>
                  s.id === selectedScene.id
                    ? {
                        ...s,
                        storyboard: {
                          ...s.storyboard!,
                          shots: updatedShots,
                        },
                      }
                    : s
                ),
              };
              
              setSceneData(updatedSceneData);

              // 检查是否有视频，如果有则更新 step_video 和 step_storyboard 状态
              // 使用更新后的数据直接检查，不需要等待状态更新
              const hasVideo = updatedSceneData.scenes.some(s => 
                s.storyboard && s.storyboard.shots && 
                s.storyboard.shots.some((shot: any) => shot.video_url && shot.video_url.trim() !== '')
              );
              if (hasVideo) {
                if (projectId) {
                  // 同时更新 step_video 和 step_storyboard
                  const response = await fetch('/api/storyboard/project-step-status', {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      project_id: projectId,
                      step_video: true,
                      step_storyboard: true,
                    }),
                  });

                  if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data) {
                      setStatusVideo(result.data.step_video || false);
                      setStatusStoryboard(result.data.step_storyboard || false);
                    }
                  }
                }
              }

              // 关闭视频生成模态框
              setVideoGenerationModal({
                isOpen: false,
                shot: null,
                sceneItemId: null,
              });
              setGeneratingVideoShotId(null);
              return;
            } else if (status.status === "failed" || status.status === "error") {
              throw new Error("Video generation failed");
            }
          } catch (error) {
            setGeneratingVideoShotId(null);
            showError(error instanceof Error ? error.message : "Video generation failed");
            return;
          }
        }

        throw new Error("视频生成超时");
      };

      await pollStatus();
    } catch (error) {
      setGeneratingVideoShotId(null);
      showError(error instanceof Error ? error.message : "Failed to generate video");
    }
  };

  // 保存分镜编辑
  const handleSaveShot = async () => {
    if (!editingShotData || !selectedScene || !selectedScene.storyboard) {
      return;
    }

    // 如果用户选择了生成的图片，使用选中的图片
    let imageUrlToSave = editingShotData.image_url;
    if (generatedShotImages.length > 0 && selectedShotImageIndex !== null) {
      imageUrlToSave = generatedShotImages[selectedShotImageIndex];
    }

    const shotDataToSave = {
      ...editingShotData,
      image_url: imageUrlToSave,
    };
    try {
      // 更新数据库
      const updateResponse = await fetch(`/api/scenes/items/${selectedScene.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata: {
            storyboard: {
              ...selectedScene.storyboard,
              shots: selectedScene.storyboard.shots.map((shot) =>
                shot.shot_number === shotDataToSave.shot_number ? shotDataToSave : shot
              ),
            },
          },
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || "Failed to save storyboard");
      }

      // 更新本地状态
      if (selectedScene.storyboard && sceneData) {
        const updatedShots = selectedScene.storyboard.shots.map((shot) =>
          shot.shot_number === shotDataToSave.shot_number ? shotDataToSave : shot
        );
        
        const updatedSelectedScene = {
          ...selectedScene,
          storyboard: {
            ...selectedScene.storyboard,
            shots: updatedShots,
          },
        };
        
        const updatedScenes = sceneData.scenes.map((s: SceneItem) => {
          if (s.id === selectedScene.id) {
            return updatedSelectedScene;
          }
          return s;
        });
        
        setSceneData({
          ...sceneData,
          scenes: updatedScenes,
        });
      }
      
      // 清除生成的图片和选中状态
      setGeneratedShotImages([]);
      setSelectedShotImageIndex(null);
      
      // 不再显示保存成功弹窗
      // setShowSaveSuccess(true);
      // setTimeout(() => {
      //   setShowSaveSuccess(false);
      // }, 2000); // 2秒后自动关闭
      
      setEditingShotId(null);
      setEditingShotData(null);
    } catch (error) {
      showError(`Failed to save storyboard: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <Header />
      
      {/* 保存成功弹窗提示 */}
      <AnimatePresence>
        {showSaveSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: -20 }}
              className="bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-xl p-6 shadow-2xl border border-[#FFDA2A]/30 pointer-events-auto"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FFDA2A] flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-gray-900" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">Storyboard saved successfully!</p>
                  <p className="text-sm text-gray-400">Successfully saved to database</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 视频生成设置模态框 */}
      <AnimatePresence>
        {videoGenerationModal.isOpen && videoGenerationModal.shot && selectedScene && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={handleCloseVideoGenerationModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700/50 backdrop-blur-xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header - Title Bar */}
              <div className="relative flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-800/50 via-gray-900/50 to-gray-800/50 border-b border-gray-700/50 flex-shrink-0">
                <h3 className="text-lg font-bold text-white">
                  Scene {selectedScene.sceneNumber} {selectedScene.sceneTitle || ""} Shot {videoGenerationModal.shot.shot_number} Video Settings
                </h3>
                <Button
                  onClick={handleCloseVideoGenerationModal}
                  className="bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white p-2 rounded-lg transition-all border border-gray-700/50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content Area - Left and Right Columns */}
              <div className="flex-1 flex overflow-hidden">
                {/* Left: Settings Area */}
                <div className="w-96 border-r border-gray-700/50 overflow-y-auto p-6 space-y-6">
                  {/* 视频描述 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-200 mb-3 block">
                      视频描述
                    </label>
                    <Textarea
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      className="bg-gray-800/50 text-white border-gray-700/50 min-h-[120px] text-sm resize-none"
                      placeholder="Enter video description..."
                    />
                  </div>

                  {/* Video Quality */}
                  <div>
                    <label className="text-sm font-semibold text-gray-200 mb-3 block">
                      Video Quality
                    </label>
                    <div className="space-y-2">
                      {(["480P", "720P", "1080P"] as const).map((res) => (
                        <label
                          key={res}
                          className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 cursor-pointer transition-colors border border-gray-700/30"
                        >
                          <input
                            type="radio"
                            name="videoResolution"
                            value={res}
                            checked={videoResolution === res}
                            onChange={() => setVideoResolution(res as "480P" | "720P" | "1080P")}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-2"
                          />
                          <span className="text-sm text-gray-200">
                            {res === "480P" ? "Basic (480P)" : res === "720P" ? "Standard (720P)" : "High Quality (1080P)"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Video Duration */}
                  <div>
                    <label className="text-sm font-semibold text-gray-200 mb-3 block">
                      Video Duration
                    </label>
                    <div className="space-y-2">
                      {([10, 15] as const).map((dur) => (
                        <label
                          key={dur}
                          className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 cursor-pointer transition-colors border border-gray-700/30"
                        >
                          <input
                            type="radio"
                            name="videoDuration"
                            value={dur}
                            checked={videoDuration === dur}
                            onChange={() => setVideoDuration(dur as 10 | 15)}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-2"
                          />
                          <span className="text-sm text-gray-200">{dur} seconds</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Generate Button */}
                  {(() => {
                    // 转换分辨率为小写格式（480P -> 480p）
                    const resolutionLower = videoResolution.toLowerCase() as '480p' | '720p' | '1080p';
                    // 计算视频积分（根据订阅计划和积分规则）
                    // 注意：1080p 单独计费，没有订阅计划则按照 1080p 的双倍来计算
                    // 480p 和 720p 没有订阅计划时统一按 720p 费率扣除
                    const requiredCredits = calculateVideoCredits(subscriptionPlan, resolutionLower, videoDuration);
                    
                    return (
                      <Button
                        onClick={handleConfirmGenerateVideo}
                        disabled={isGeneratingVideo}
                        className="w-full bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-semibold h-11 shadow-lg shadow-[#FFDA2A]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGeneratingVideo ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-4 h-4 mr-2"
                            >
                              <Sparkles className="w-4 h-4" />
                            </motion.div>
                            Generating...
                          </>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <Film className="w-4 h-4" />
                            Generate Video
                            <span className="flex items-center gap-1">
                              <Diamond className="w-4 h-4" />
                              <span className="text-sm font-semibold">{requiredCredits}</span>
                            </span>
                          </span>
                        )}
                      </Button>
                    );
                  })()}
                </div>

                {/* Right: Video Preview Area */}
                <div className="flex-1 bg-gray-900/30 flex items-center justify-center p-8 relative overflow-hidden">
                  {generatingVideoShotId === `${videoGenerationModal.sceneItemId}-${videoGenerationModal.shot.shot_number}` ? (
                    <div className="text-center relative z-10">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 mx-auto mb-4"
                      >
                        <Sparkles className="w-16 h-16 text-[#FFDA2A]" />
                      </motion.div>
                      <p className="text-lg font-semibold text-white mb-2">Generating</p>
                      <p className="text-sm text-gray-400">Estimated 1-3 minutes</p>
                    </div>
                  ) : videoGenerationModal.shot.video_url ? (
                    <div className="w-full h-full flex items-center justify-center relative z-10">
                      {/* 模糊背景视频层 */}
                      <video
                        src={videoGenerationModal.shot.video_url}
                        className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-110 -z-10"
                        muted
                        loop
                        playsInline
                        autoPlay
                      />
                      {/* 渐变遮罩 */}
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/70 via-gray-800/50 to-gray-900/70 -z-[5]" />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                        className="relative z-10"
                      >
                        <video
                          src={videoGenerationModal.shot.video_url}
                          controls
                          className="max-w-full max-h-full rounded-lg shadow-2xl border border-gray-700/50"
                        >
                          Your browser does not support video playback
                        </video>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 relative z-10">
                      <Film className="w-20 h-20 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Video Preview Area</p>
                      <p className="text-xs mt-2">Video will be displayed here after generation</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Details Modal */}
      <AnimatePresence>
        {videoDetailModal.isOpen && videoDetailModal.shot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setVideoDetailModal({ isOpen: false, shot: null, sceneTitle: "" })}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700/50 backdrop-blur-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="relative flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-800/50 via-gray-900/50 to-gray-800/50 border-b border-gray-700/50 flex-shrink-0">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Video Details - Shot {videoDetailModal.shot.shot_number}
                  </h3>
                  {videoDetailModal.sceneTitle && (
                    <p className="text-xs text-gray-400 mt-0.5">{videoDetailModal.sceneTitle}</p>
                  )}
                </div>
                <Button
                  onClick={() => setVideoDetailModal({ isOpen: false, shot: null, sceneTitle: "" })}
                  className="bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white p-1.5 rounded-lg transition-all border border-gray-700/50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Video Player */}
                {videoDetailModal.shot.video_url && (
                  <div className="mb-4">
                    <video
                      src={videoDetailModal.shot.video_url}
                      controls
                      autoPlay
                      className="w-full rounded-lg"
                    >
                      Your browser does not support video playback
                    </video>
                  </div>
                )}

                {/* Video Information */}
                <div className="space-y-3">
                  {videoDetailModal.shot.description && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-300 mb-1.5">Shot Description</h4>
                      <p className="text-xs text-gray-400 leading-relaxed">{videoDetailModal.shot.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {videoDetailModal.shot.framing && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-300 mb-0.5">Composition</h4>
                        <p className="text-xs text-gray-400">{videoDetailModal.shot.framing}</p>
                      </div>
                    )}
                    {videoDetailModal.shot.camera_angle && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-300 mb-0.5">Camera Angle</h4>
                        <p className="text-xs text-gray-400">{videoDetailModal.shot.camera_angle}</p>
                      </div>
                    )}
                    {videoDetailModal.shot.camera_movement && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-300 mb-0.5">Camera Movement</h4>
                        <p className="text-xs text-gray-400">{videoDetailModal.shot.camera_movement}</p>
                      </div>
                    )}
                    {videoDetailModal.shot.composition && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-300 mb-0.5">Composition Details</h4>
                        <p className="text-xs text-gray-400">{videoDetailModal.shot.composition}</p>
                      </div>
                    )}
                    {videoDetailModal.shot.lighting && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-300 mb-0.5">Lighting</h4>
                        <p className="text-xs text-gray-400">{videoDetailModal.shot.lighting}</p>
                      </div>
                    )}
                    {videoDetailModal.shot.mood && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-300 mb-0.5">Mood</h4>
                        <p className="text-xs text-gray-400">{videoDetailModal.shot.mood}</p>
                      </div>
                    )}
                  </div>

                  {videoDetailModal.shot.characters && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-300 mb-0.5">Characters</h4>
                      <p className="text-xs text-gray-400">{videoDetailModal.shot.characters}</p>
                    </div>
                  )}

                  {videoDetailModal.shot.dialogue && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-300 mb-0.5">Dialogue</h4>
                      <p className="text-xs text-gray-400 italic">"{videoDetailModal.shot.dialogue}"</p>
                    </div>
                  )}

                  {videoDetailModal.shot.narration && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-300 mb-0.5">Narration</h4>
                      <p className="text-xs text-gray-400">{videoDetailModal.shot.narration}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 编辑分镜的模态卡片 */}
      <AnimatePresence>
        {editingShotId && editingShotData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-[#FFDA2A]">
                    Edit Shot {editingShotData.shot_number}
                  </h3>
                  <Button
                    onClick={handleCancelEditShot}
                    className="bg-gray-800 hover:bg-gray-700 text-white p-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* 编辑表单 */}
                <div className="space-y-4">
                  {/* 镜头描述 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-300 mb-2 block">
                      Shot Description *
                    </label>
                    <Textarea
                      value={editingShotData.description || ""}
                      onChange={(e) => setEditingShotData({ ...editingShotData, description: e.target.value })}
                      className="bg-gray-900 text-white text-sm min-h-[120px] border-gray-700"
                      placeholder="Enter shot description"
                    />
                  </div>
                  {/* 图片描述 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-300 mb-2 block">
                      Image Description
                    </label>
                    <Textarea
                      value={editingShotData.image_prompt || ""}
                      onChange={(e) => setEditingShotData({ ...editingShotData, image_prompt: e.target.value })}
                      className="bg-gray-900 text-white text-sm min-h-[140px] border-gray-700"
                      placeholder="Describe characters, poses, lighting, props, environment, and continuity details"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Updating this prompt directly changes the storyboard image; describe character poses, wardrobe, lighting, props, and continuity tweaks.
                    </p>
                  </div>

                  {/* 相机信息 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-300 mb-2 block">
                        Shot Composition
                      </label>
                      <Input
                        value={editingShotData.framing || ""}
                        onChange={(e) => setEditingShotData({ ...editingShotData, framing: e.target.value })}
                        className="bg-gray-900 text-white text-sm border-gray-700"
                        placeholder="e.g. Wide / Medium / Close-up"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-300 mb-2 block">
                        Camera Angle
                      </label>
                      <Select
                        value={editingShotData.camera_angle || ""}
                        onValueChange={(value) => setEditingShotData({ ...editingShotData, camera_angle: value })}
                      >
                        <SelectTrigger className="bg-gray-900 text-white text-sm border-gray-700">
                          <SelectValue placeholder="Select camera angle" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-700">
                          {cameraAngleOptions.map((angle) => (
                            <SelectItem key={angle} value={angle} className="text-white hover:bg-gray-800">
                              {angle}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-300 mb-2 block">
                        Camera Movement
                      </label>
                      <Select
                        value={editingShotData.camera_movement || ""}
                        onValueChange={(value) => setEditingShotData({ ...editingShotData, camera_movement: value })}
                      >
                        <SelectTrigger className="bg-gray-900 text-white text-sm border-gray-700">
                          <SelectValue placeholder="Select camera movement" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-700">
                          {/* 如果当前值不在选项中，也显示它 */}
                          {editingShotData.camera_movement && 
                           !cameraMovementOptions.includes(editingShotData.camera_movement) && (
                            <SelectItem 
                              value={editingShotData.camera_movement} 
                              className="text-white hover:bg-gray-800"
                            >
                              {editingShotData.camera_movement}
                            </SelectItem>
                          )}
                          {cameraMovementOptions.map((movement) => (
                            <SelectItem key={movement} value={movement} className="text-white hover:bg-gray-800">
                              {movement}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {editingShotData.composition !== undefined && (
                      <div>
                        <label className="text-sm font-semibold text-gray-300 mb-2 block">
                          Composition
                        </label>
                        <Input
                          value={editingShotData.composition || ""}
                          onChange={(e) => setEditingShotData({ ...editingShotData, composition: e.target.value })}
                          className="bg-gray-900 text-white text-sm border-gray-700"
                          placeholder="Composition description"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {editingShotData.lighting !== undefined && (
                      <div>
                        <label className="text-sm font-semibold text-gray-300 mb-2 block">
                          Lighting
                        </label>
                        <Input
                          value={editingShotData.lighting || ""}
                          onChange={(e) => setEditingShotData({ ...editingShotData, lighting: e.target.value })}
                          className="bg-gray-900 text-white text-sm border-gray-700"
                          placeholder="Lighting description"
                        />
                      </div>
                    )}
                    {editingShotData.mood !== undefined && (
                      <div>
                        <label className="text-sm font-semibold text-gray-300 mb-2 block">
                          Mood
                        </label>
                        <Input
                          value={editingShotData.mood || ""}
                          onChange={(e) => setEditingShotData({ ...editingShotData, mood: e.target.value })}
                          className="bg-gray-900 text-white text-sm border-gray-700"
                          placeholder="Mood description"
                        />
                      </div>
                    )}
                  </div>

                  {/* 对话 */}
                  {editingShotData.dialogue !== undefined && (
                    <div>
                      <label className="text-sm font-semibold text-gray-300 mb-2 block">
                        Dialogue
                      </label>
                      <Textarea
                        value={editingShotData.dialogue || ""}
                        onChange={(e) => setEditingShotData({ ...editingShotData, dialogue: e.target.value })}
                        className="bg-gray-900 text-white text-sm min-h-[80px] border-gray-700"
                        placeholder="Character dialogue content"
                      />
                    </div>
                  )}

                  {/* 旁白 */}
                  {editingShotData.narration !== undefined && (
                    <div>
                      <label className="text-sm font-semibold text-gray-300 mb-2 block">
                        Narration
                      </label>
                      <Textarea
                        value={editingShotData.narration || ""}
                        onChange={(e) => setEditingShotData({ ...editingShotData, narration: e.target.value })}
                        className="bg-gray-900 text-white text-sm min-h-[80px] border-gray-700"
                        placeholder="Narration content"
                      />
                    </div>
                  )}

                  {/* 角色 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-300 mb-2 block">
                      Characters
                    </label>
                    <Input
                      value={editingShotData.characters || ""}
                      onChange={(e) => setEditingShotData({ ...editingShotData, characters: e.target.value })}
                      className="bg-gray-900 text-white text-sm border-gray-700"
                      placeholder="Enter character names, separated by commas"
                    />
                  </div>

                  {/* 分镜图片显示 - 单张展示 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-300 mb-2 block">
                      Storyboard Image
                    </label>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-700 bg-gray-900"
                    >
                      {(() => {
                        const displayImage =
                          generatedShotImages.length > 0
                            ? generatedShotImages[selectedShotImageIndex ?? 0]
                            : editingShotData.image_url || null;

                        if (displayImage) {
                          return (
                            <img
                              src={displayImage}
                              alt="Storyboard image"
                              className="w-full h-full object-contain"
                            />
                          );
                        }

                        return (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center text-gray-500">
                              <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-xs">Placeholder</p>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  </div>

                  {/* Image Generation Button - Shown in Edit Mode */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        if (selectedScene) {
                          handleGenerateShotImage(editingShotData, selectedScene.id, true);
                        }
                      }}
                      disabled={generatingShotImageId === `${selectedScene?.id}-${editingShotData.shot_number}`}
                      className="bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-semibold px-4 py-2 disabled:opacity-50"
                    >
                      {generatingShotImageId === `${selectedScene?.id}-${editingShotData.shot_number}` ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 mr-2"
                          >
                            <Sparkles className="w-4 h-4" />
                          </motion.div>
                          <span>Generating...</span>
                        </> 
                      ) : (
                        <>
                          <ImageIcon className="w-4 h-4 mr-2" />
                          <span>{editingShotData.image_url ? "Regenerate" : "Generate Image"}</span>
                          <Diamond className="w-4 h-4 ml-2" />
                          <span className="text-xs ml-1">5</span>
                        </>
                      )}
                    </Button>
                  </div>

                </div>

                {/* 底部按钮 */}
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
                  <Button
                    onClick={async () => {
                      if (selectedScene && projectId) {
                        try {
                          // 先检查积分余额（需要5积分）
                          const requiredCredits = 5;
                          const creditsCheck = await checkCreditsBalance(requiredCredits);
                          if (!creditsCheck.sufficient) {
                            setInsufficientCreditsData({
                              required: requiredCredits,
                              current: creditsCheck.balance || 0,
                              action: "regenerate storyboard",
                            });
                            setShowInsufficientCreditsDialog(true);
                            return;
                          }

                          // 扣除积分
                          const deductResult = await deductCredits(
                            requiredCredits,
                            "Regenerate storyboard",
                            {
                              type: "storyboard_regeneration",
                              project_id: projectId,
                              scene_id: selectedScene.id,
                            }
                          );

                          if (!deductResult.success) {
                            showError("Failed to deduct credits. Please try again.");
                            return;
                          }

                          // 更新头部积分显示
                          window.dispatchEvent(new Event("credits-updated"));

                          setIsGeneratingStoryboard(true);
                          setGeneratingStoryboardSceneId(selectedScene.id);
                          
                          const response = await fetch("/api/storyboard/generate-storyboard", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              scene_item_id: selectedScene.id,
                              project_id: projectId,
                            }),
                          });

                          if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.error || "Failed to regenerate storyboard");
                          }

                          const result = await response.json();
                          if (!result.success) {
                            throw new Error(result.error || "Failed to regenerate storyboard");
                          }

                          // 重新加载场次数据
                          await loadScenesFromDatabase(projectId);
                          
                          // 等待状态更新后，更新编辑框中的数据
                          setTimeout(async () => {
                            if (selectedScene && editingShotData) {
                              // 重新获取最新的场景数据
                              const response = await fetch(`/api/scenes?projectId=${projectId}`);
                              if (response.ok) {
                                const result = await response.json();
                                if (result.success && result.data) {
                                  const updatedScene = result.data.items.find((item: any) => item.id === selectedScene.id);
                                  if (updatedScene?.metadata?.storyboard?.shots) {
                                    const updatedShot = updatedScene.metadata.storyboard.shots.find(
                                      (s: Shot) => s.shot_number === editingShotData.shot_number
                                    );
                                    if (updatedShot) {
                                      setEditingShotData({ ...updatedShot });
                                    }
                                  }
                                }
                              }
                            }
                          }, 500); // 等待500ms确保状态已更新

                          showSuccess("Storyboard regenerated successfully!");
                        } catch (error) {
                          showError(error instanceof Error ? error.message : "Failed to regenerate storyboard");
                        } finally {
                          setIsGeneratingStoryboard(false);
                          setGeneratingStoryboardSceneId(null);
                        }
                      }
                    }}
                    disabled={isGeneratingStoryboard && generatingStoryboardSceneId === selectedScene?.id}
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold px-4 py-2 disabled:opacity-50 flex items-center"
                  >
                    {isGeneratingStoryboard && generatingStoryboardSceneId === selectedScene?.id ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 mr-2"
                        >
                          <Sparkles className="w-4 h-4" />
                        </motion.div>
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Regenerate Storyboard
                        <Diamond className="w-4 h-4 ml-2" />
                        <span className="text-xs ml-1">5</span>
                      </>
                    )}
                  </Button>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleCancelEditShot}
                      className="bg-gray-800 hover:bg-gray-700 text-white px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveShot}
                      className="bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-semibold px-6"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* 固定导航栏 */}
      <div className="flex-shrink-0">
        <StoryboardNav
          currentProjectId={projectId}
          sessionProjectId={projectId}
          statusScript={statusScript}
          statusSettings={statusSettings}
          statusStoryboard={statusStoryboard}
          statusVideo={statusVideo}
          currentPage="storyboard"
        />
      </div>
      
      {/* Scrollable Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="container mx-auto px-4 py-8 max-w-7xl flex-1 flex gap-6 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1]
          }}
          className="flex-1 flex gap-6 overflow-hidden"
        >
          {/* 生成中状态 */}
          {isGenerating && (
            <div className="flex-1 bg-gray-900 rounded-xl p-12 shadow-xl text-center flex items-center justify-center">
              <div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 mx-auto mb-4"
                >
                  <Sparkles className="w-16 h-16 text-[#FFDA2A]" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Generating scenes...</h2>
                <p className="text-gray-400">Please wait, generating storyboard scenes for you</p>
              </div>
            </div>
          )}

          {/* 场次列表和分镜列表 */}
          {!isGenerating && sceneData && (
            <>
              {/* Left: Scene List - Fixed, independently scrollable */}
              <div className="flex-shrink-0 w-80">
                <div className="bg-gray-900 rounded-xl p-6 shadow-xl h-full flex flex-col">
                  <h3 className="text-xl font-bold mb-4 flex-shrink-0">Scene List</h3>
                  <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
                    {Array.from(new Set(sceneData.scenes.map(s => s.sceneNumber))).map((sceneNumber) => {
                      const scene = sceneData.scenes.find(s => s.sceneNumber === sceneNumber);
                      const hasImages = scene?.imageUrl ? true : false;
                      const isGenerating = scene ? (imageStatuses.get(scene.id)?.status === 'generating') : false;

                      return (
                        <motion.button
                          key={sceneNumber}
                          onClick={() => setSelectedSceneNumber(sceneNumber)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            selectedSceneNumber === sceneNumber
                              ? "border-[#FFDA2A] bg-[#FFDA2A]/10"
                              : "border-gray-700 hover:border-gray-600 bg-gray-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {/* 场次标题 */}
                              <div className="font-semibold text-white text-sm">
                                Scene {sceneNumber}
                                {scene?.sceneTitle && `: ${scene.sceneTitle}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isGenerating && (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                  className="w-4 h-4"
                                >
                                  <Sparkles className="w-4 h-4 text-[#FFDA2A]" />
                                </motion.div>
                              )}
                              {hasImages && !isGenerating && (
                                <ImageIcon className="w-4 h-4 text-green-400" />
                              )}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Scene Details and Edit - Scrollable */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {selectedScene ? (
                  <div className="bg-gray-900 rounded-xl p-6 shadow-xl">
                    {/* 标题栏 */}
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-base font-bold">
                        Scene {selectedScene.sceneNumber}
                        {selectedScene.sceneTitle && `: ${selectedScene.sceneTitle}`}
                      </h3>
                      {editingSceneId !== selectedScene.id && (
                        <Button
                          onClick={() => handleStartEdit(selectedScene)}
                          className="bg-gray-800 hover:bg-gray-700 text-white"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                    </div>

                    {editingSceneId === selectedScene.id && editingSceneData ? (
                      /* 编辑模式 */
                      <div className="space-y-6 relative">
                        {/* 生成分镜时的覆盖层 */}
                        {isGeneratingStoryboard && generatingStoryboardSceneId === selectedScene.id && (
                          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
                            <div className="text-center">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-16 h-16 mx-auto mb-4"
                              >
                                <Sparkles className="w-16 h-16 text-[#FFDA2A]" />
                              </motion.div>
                              <p className="text-lg font-semibold text-white">Generating storyboard...</p>
                              <p className="text-sm text-gray-400 mt-2">Estimated 1-3 minutes, please wait</p>
                            </div>
                          </div>
                        )}
                        {/* 场次标题 */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Scene Title *
                          </label>
                          <Input
                            value={editingSceneData.sceneTitle || ""}
                            onChange={(e) =>
                              setEditingSceneData({
                                ...editingSceneData,
                                sceneTitle: e.target.value,
                              })
                            }
                            className="bg-gray-800 border-gray-700 text-white"
                            placeholder="Enter scene title"
                          />
                        </div>

                        {/* 场次时间和地点 */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">
                              Scene Time
                            </label>
                            <Input
                              value={editingSceneData.场次时间 || ""}
                              onChange={(e) =>
                                setEditingSceneData({
                                  ...editingSceneData,
                                  场次时间: e.target.value,
                                })
                              }
                              className="bg-gray-800 border-gray-700 text-white"
                              placeholder="e.g. Night, Day, Evening"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">
                              Scene Location
                            </label>
                            <Input
                              value={editingSceneData.场次地点 || ""}
                              onChange={(e) =>
                                setEditingSceneData({
                                  ...editingSceneData,
                                  场次地点: e.target.value,
                                })
                              }
                              className="bg-gray-800 border-gray-700 text-white"
                              placeholder="e.g. EXT · Ghost Reef Sea"
                            />
                          </div>
                        </div>

                        {/* 场次描述 */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Scene Description *
                          </label>
                          <Textarea
                            value={editingSceneData.text || ""}
                            onChange={(e) =>
                              setEditingSceneData({
                                ...editingSceneData,
                                text: e.target.value,
                              })
                            }
                            className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
                            placeholder="Enter scene description"
                          />
                        </div>

                        {/* 场次故事 */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Scene Story *
                          </label>
                          <Textarea
                            value={editingSceneData.场次故事 || ""}
                            onChange={(e) =>
                              setEditingSceneData({
                                ...editingSceneData,
                                场次故事: e.target.value,
                              })
                            }
                            className="bg-gray-800 border-gray-700 text-white min-h-[200px]"
                            placeholder="Enter scene story content"
                          />
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-4 pt-4 border-t border-gray-700">
                          <Button
                            onClick={handleSaveScene}
                            disabled={isSavingScene}
                            className="bg-[#FFDA2A] hover:bg-[#FFDA2A]/90 text-gray-900 font-semibold"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {isSavingScene ? "Saving..." : "Save Changes"}
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            className="bg-gray-800 hover:bg-gray-700 text-white"
                          >
                            Cancel
                          </Button>
                          {/* In edit mode, only show generate button if no storyboard exists */}
                          {!editingSceneData.storyboard && (
                            <Button
                              onClick={() => handleGenerateStoryboard(editingSceneData)}
                              className="bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-semibold ml-auto"
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Generate Storyboard
                              <Diamond className="w-4 h-4 ml-2" />
                              <span className="text-xs ml-1">3</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* 查看模式 */
                      <div className="space-y-6">
                        {/* 如果有分镜，只显示分镜列表，隐藏所有场次信息 */}
                        {selectedScene && (() => {
                          const hasStoryboard = !!selectedScene.storyboard;
                          const hasShots = !!selectedScene.storyboard?.shots;
                          const shotsCount = selectedScene.storyboard?.shots?.length || 0;
                          
                          if (hasStoryboard) {
                          } else {
                          }
                          
                          return hasStoryboard && hasShots && shotsCount > 0;
                        })() && selectedScene.storyboard ? (
                          <div className="space-y-6 pt-6">
                            {/* 场景标题和摘要 */}
                            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                              {selectedScene.storyboard.scene_title && (
                                <h4 className="text-base font-bold mb-2 text-[#FFDA2A]">
                                  {selectedScene.storyboard.scene_title}
                                </h4>
                              )}
                              {selectedScene.storyboard.scene_summary && (
                                <p className="text-xs text-gray-300 leading-relaxed">
                                  {selectedScene.storyboard.scene_summary}
                                </p>
                              )}
                            </div>

                            {/* 分镜列表标题 */}
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold">Storyboard List</h4>
                              <span className="text-xs text-gray-400">
                                {selectedScene.storyboard.shots.length} shots
                              </span>
                            </div>

                            {/* 分镜列表 - 单列垂直布局 */}
                            <div className="space-y-4">
                              {selectedScene.storyboard.shots.map((shot) => {
                                const shotId = `${selectedScene.id}-${shot.shot_number}`;
                                const isEditing = editingShotId === shotId;
                                const isGeneratingImage = generatingShotImageId === shotId;
                                const currentShot = isEditing && editingShotData ? editingShotData : shot;
                                
                                const isGeneratingVideoForThisShot = generatingVideoShotId === shotId;
                                const hasAnyVideoGenerating = generatingVideoShotId !== null;
                                // If any shot is generating image, disable other shots
                                const hasAnyImageGenerating = generatingShotImageId !== null;
                                const isDisabled = (hasAnyImageGenerating && !isGeneratingImage) || (hasAnyVideoGenerating && !isGeneratingVideoForThisShot);
                                
                                return (
                                  <div 
                                    key={shot.shot_number} 
                                    className={`bg-gray-800 rounded-lg p-4 border border-gray-700 transition-colors ${
                                      isDisabled && !isGeneratingImage && !isGeneratingVideoForThisShot
                                        ? "opacity-50 pointer-events-none" 
                                        : "hover:border-[#FFDA2A]/50"
                                    }`}
                                  >
                                    <div className="flex items-start gap-4">
                                      {/* 分镜图片/视频或占位符 */}
                                      <div className="flex-shrink-0 w-32 h-[200px] rounded-lg overflow-hidden border border-gray-600 bg-gradient-to-br from-gray-700 to-gray-800 relative">
                                        {/* 图片生成中状态 */}
                                        {isGeneratingImage && (
                                          <motion.div 
                                            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.2 }}
                                            style={{ pointerEvents: 'auto' }}
                                          >
                                            <motion.div
                                              animate={{ rotate: 360 }}
                                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                              className="w-6 h-6 mb-1.5 flex items-center justify-center"
                                              style={{ transformOrigin: 'center' }}
                                            >
                                              <Sparkles className="w-6 h-6 text-[#FFDA2A]" />
                                            </motion.div>
                                            <p className="text-xs font-semibold text-white mb-0.5 whitespace-nowrap">Generating...</p>
                                            <p className="text-[10px] text-gray-300 leading-tight whitespace-nowrap">2-3 min</p>
                                          </motion.div>
                                        )}
                                        {/* 视频生成中状态 */}
                                        {isGeneratingVideoForThisShot && (
                                          <motion.div 
                                            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.2 }}
                                            style={{ pointerEvents: 'auto' }}
                                          >
                                            <motion.div
                                              animate={{ rotate: 360 }}
                                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                              className="w-6 h-6 mb-1.5 flex items-center justify-center"
                                              style={{ transformOrigin: 'center' }}
                                            >
                                              <Sparkles className="w-6 h-6 text-[#FFDA2A]" />
                                            </motion.div>
                                            <p className="text-xs font-semibold text-white mb-0.5 whitespace-nowrap">Generating...</p>
                                            <p className="text-[10px] text-gray-300 leading-tight whitespace-nowrap">2-3 min</p>
                                          </motion.div>
                                        )}
                                        
                                        {/* 图片显示（如果有视频则在图片上叠加视频图标） */}
                                        {currentShot.image_url && !isGeneratingVideoForThisShot ? (
                                          <div className="w-full h-full relative group cursor-pointer overflow-hidden rounded-lg"
                                            onClick={() => {
                                              if (currentShot.video_url) {
                                                setVideoDetailModal({
                                                  isOpen: true,
                                                  shot: currentShot,
                                                  sceneTitle: selectedScene.storyboard?.scene_title || "",
                                                });
                                              }
                                            }}
                                          >
                                            <img
                                              src={currentShot.image_url}
                                              alt={`Shot ${currentShot.shot_number}`}
                                              className="w-full h-full object-cover"
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                              }}
                                            />
                                            {/* 如果有视频，在图片上显示视频图标 */}
                                            {currentShot.video_url && (
                                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                                <motion.div
                                                  initial={{ scale: 0.9, opacity: 0.8 }}
                                                  animate={{ scale: 1, opacity: 1 }}
                                                  whileHover={{ scale: 1.1 }}
                                                  transition={{ duration: 0.2 }}
                                                  className="bg-black/60 rounded-full p-3 backdrop-blur-sm"
                                                >
                                                  <Video className="w-6 h-6 text-white" />
                                                </motion.div>
                                              </div>
                                            )}
                                          </div>
                                        ) : !isGeneratingVideoForThisShot ? (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 text-gray-500" />
                                          </div>
                                        ) : null}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        {/* 镜头编号和相机信息 */}
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                          <span className="text-xs font-semibold text-[#FFDA2A]">Shot {currentShot.shot_number}</span>
                                          {currentShot.framing && (
                                            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                                              {currentShot.framing}
                                            </span>
                                          )}
                                          {currentShot.camera_angle && (
                                            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                                              {currentShot.camera_angle}
                                            </span>
                                          )}
                                          {currentShot.camera_movement && (
                                            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                                              {currentShot.camera_movement}
                                            </span>
                                          )}
                                        </div>
                                        
                                        {/* 镜头描述 */}
                                        {currentShot.description && (
                                          <p className="text-xs text-gray-300 mb-3 leading-relaxed">{currentShot.description}</p>
                                        )}
                                        
                                        {/* 技术细节 */}
                                        <div className="space-y-1 mb-2">
                                          {currentShot.composition && (
                                            <p className="text-xs text-gray-500">
                                              <span className="text-gray-400">Composition:</span> {currentShot.composition}
                                            </p>
                                          )}
                                          {currentShot.lighting && (
                                            <p className="text-xs text-gray-500">
                                              <span className="text-gray-400">Lighting:</span> {currentShot.lighting}
                                            </p>
                                          )}
                                          {currentShot.mood && (
                                            <p className="text-xs text-gray-500">
                                              <span className="text-gray-400">Mood:</span> {currentShot.mood}
                                            </p>
                                          )}
                                        </div>
                                        
                                        {/* 角色 */}
                                        {currentShot.characters && (
                                          <div className="mt-3 pt-3 border-t border-gray-700">
                                            <p className="text-xs text-gray-400 mb-1 font-semibold">Characters:</p>
                                            <p className="text-xs text-gray-300">{currentShot.characters}</p>
                                          </div>
                                        )}
                                        
                                        {/* 对话和旁白 */}
                                        {currentShot.dialogue && (
                                          <div className="mt-3 pt-3 border-t border-gray-700">
                                            <p className="text-xs text-gray-400 mb-1 font-semibold">Dialogue:</p>
                                            <p className="text-xs text-gray-300 italic">"{currentShot.dialogue}"</p>
                                          </div>
                                        )}
                                        {currentShot.narration && (
                                          <div className="mt-2">
                                            <p className="text-xs text-gray-400 mb-1 font-semibold">Narration:</p>
                                            <p className="text-xs text-gray-300">{currentShot.narration}</p>
                                          </div>
                                        )}
                                        
                                        {/* Action Buttons - In list mode, only show edit button, hide generate button if image exists */}
                                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-700">
                                          {/* Only show generate button if no image exists */}
                                          {!currentShot.image_url && (
                                            <Button
                                              onClick={() => handleGenerateShotImage(shot, selectedScene.id)}
                                              disabled={isGeneratingImage || (hasAnyImageGenerating && !isGeneratingImage)}
                                              className="bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-semibold text-sm px-4 py-2 disabled:opacity-50 flex items-center"
                                            >
                                              {isGeneratingImage ? (
                                                <>
                                                  <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    className="w-3 h-3 mr-1 flex-shrink-0"
                                                  >
                                                    <Sparkles className="w-3 h-3" />
                                                  </motion.div>
                                                  <span>Generating...</span>
                                                </> 
                                              ) : (
                                                <>
                                                  <ImageIcon className="w-3 h-3 mr-1" />
                                                  <span>Generate Image</span>
                                                  <Diamond className="w-3 h-3 ml-2" />
                                                  <span className="text-xs ml-1">5</span>
                                                </>
                                              )}
                                            </Button>
                                          )}
                                          {/* 如果有图片，显示生成视频按钮 */}
                                          {currentShot.image_url && (
                                            <Button
                                              onClick={() => handleOpenVideoGenerationModal(shot, selectedScene.id)}
                                              disabled={isDisabled}
                                              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white p-2 disabled:opacity-50"
                                              title={currentShot.video_url ? "Regenerate Video" : "Generate Video"}
                                            >
                                              {generatingVideoShotId === `${selectedScene.id}-${shot.shot_number}` ? (
                                                <motion.div
                                                  animate={{ rotate: 360 }}
                                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                  className="w-4 h-4"
                                                >
                                                  <Sparkles className="w-4 h-4" />
                                                </motion.div>
                                              ) : (
                                                <Video className="w-4 h-4" />
                                              )}
                                            </Button>
                                          )}
                                          <Button
                                            onClick={() => handleEditShot(shot)}
                                            disabled={isDisabled}
                                            className="bg-gray-700 hover:bg-gray-600 text-white p-2 disabled:opacity-50"
                                            title="Edit"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          /* If no storyboard exists, display scene information and generate button */
                          <>
                            {/* 场次信息 */}
                            <div className="grid grid-cols-2 gap-4">
                              {selectedScene.场次时间 && (
                                <div>
                                  <div className="text-xs text-gray-400 mb-1">Scene Time</div>
                                  <div className="text-white font-semibold text-sm">{selectedScene.场次时间}</div>
                                </div>
                              )}
                              {selectedScene.场次地点 && (
                                <div>
                                  <div className="text-xs text-gray-400 mb-1">Scene Location</div>
                                  <div className="flex items-center gap-2">
                                    {editingSceneLocation === selectedScene.id ? (
                                      <>
                                        <input
                                          type="text"
                                          value={editingLocationValue}
                                          onChange={(e) => setEditingLocationValue(e.target.value)}
                                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#FFDA2A]/50"
                                          autoFocus
                                        />
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
                                      </>
                                    ) : (
                                      <>
                                        <div 
                                          className="text-white font-semibold text-sm cursor-pointer hover:text-[#FFDA2A] transition-colors flex-1"
                                          onClick={() => handleStartEditLocation(selectedScene)}
                                          title="Click to edit"
                                        >
                                          {selectedScene.场次地点}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 场次描述 */}
                            {selectedScene.text && (
                              <div>
                                <div className="text-xs text-gray-400 mb-2">Scene Description</div>
                                <div className="text-white text-sm bg-gray-800 rounded-lg p-4">{selectedScene.text}</div>
                              </div>
                            )}

                            {/* 场次故事 */}
                            {selectedScene.场次故事 && (
                              <div>
                                <div className="text-xs text-gray-400 mb-2">Scene Story</div>
                                <div className="text-white text-sm bg-gray-800 rounded-lg p-4 whitespace-pre-wrap">
                                  {selectedScene.场次故事}
                                </div>
                              </div>
                            )}

                            {/* 主要角色 */}
                            {selectedScene.主要角色 && selectedScene.主要角色.length > 0 && (
                              <div>
                                <div className="text-xs text-gray-400 mb-2">Main Characters</div>
                                <div className="space-y-2">
                                  {selectedScene.主要角色.map((char, idx) => (
                                    <div key={idx} className="bg-gray-800 rounded-lg p-3">
                                      <div className="font-semibold text-white text-sm">{char.姓名}</div>
                                      <div className="text-xs text-gray-300 mt-1">
                                        {char["心理/情绪状态"] || char.心理情绪状态 || ""}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 关键画面提示 */}
                            {selectedScene.关键画面提示 && (
                              <div>
                                <div className="text-xs text-gray-400 mb-2">Key Visual Prompts</div>
                                <div className="space-y-2">
                                  {selectedScene.关键画面提示.镜头1 && (
                                    <div className="bg-gray-800 rounded-lg p-3">
                                      <div className="text-xs text-gray-400 mb-1">Shot 1</div>
                                      <div className="text-white text-sm">{selectedScene.关键画面提示.镜头1}</div>
                                    </div>
                                  )}
                                  {selectedScene.关键画面提示.镜头2 && (
                                    <div className="bg-gray-800 rounded-lg p-3">
                                      <div className="text-xs text-gray-400 mb-1">Shot 2</div>
                                      <div className="text-white text-sm">{selectedScene.关键画面提示.镜头2}</div>
                                    </div>
                                  )}
                                  {selectedScene.关键画面提示.镜头3 && (
                                    <div className="bg-gray-800 rounded-lg p-3">
                                      <div className="text-xs text-gray-400 mb-1">Shot 3</div>
                                      <div className="text-white text-sm">{selectedScene.关键画面提示.镜头3}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 生成分镜按钮 */}
                            <div className="flex justify-center pt-6">
                              <Button
                                onClick={() => handleGenerateStoryboard(selectedScene)}
                                disabled={isGeneratingStoryboard && generatingStoryboardSceneId === selectedScene.id}
                                className="bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-semibold px-8 py-3 disabled:opacity-50"
                              >
                                {isGeneratingStoryboard && generatingStoryboardSceneId === selectedScene.id ? (
                                  <>
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                      className="w-4 h-4 mr-2"
                                    >
                                      <Sparkles className="w-4 h-4" />
                                    </motion.div>
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate Storyboard
                                    <Diamond className="w-4 h-4 ml-2" />
                                    <span className="text-xs ml-1">3</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </>
                        )}

                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-900 rounded-xl p-6 shadow-xl text-center py-12 text-gray-400">
                    Please select a scene
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
        </div>
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
      
      {/* Scene Image Generate Modal */}
      {selectedScene && (
        <SceneImageGenerateModal
          isOpen={showSceneImageModal}
          onClose={() => setShowSceneImageModal(false)}
          sceneLocation={selectedScene.场次地点 || ""}
          sceneDescription={selectedScene.text || ""}
          projectId={projectId}
          sceneId={selectedScene.id || null}
          onLocationUpdate={async (location: string) => {
            // 更新本地状态
            if (selectedScene.id) {
              setSceneData((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  scenes: prev.scenes.map((s) =>
                    s.id === selectedScene.id
                      ? { ...s, 场次地点: location }
                      : s
                  ),
                };
              });
            }
          }}
          onImageSelect={async (imageUrl: string) => {
            // 更新场景的图片URL（保存到 scene_image_url 字段）
            if (selectedScene.id && projectId) {
              try {
                const response = await fetch(`/api/scenes/items/${selectedScene.id}`, {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    sceneImageUrl: imageUrl,
                  }),
                });

                if (!response.ok) {
                  throw new Error("Failed to update scene image");
                }

                // 更新本地状态
                setSceneData(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    scenes: prev.scenes.map(scene =>
                      scene.id === selectedScene.id
                        ? { ...scene, sceneImageUrl: imageUrl }
                        : scene
                    ),
                  };
                });

                showSuccess("Scene image updated successfully");
              } catch (error) {
                showError("Failed to update scene image");
              }
            }
          }}
        />
      )}

    </div>
  );
}
