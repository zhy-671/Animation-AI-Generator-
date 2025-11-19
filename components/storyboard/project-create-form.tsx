"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Edit2, Trash2, X, Loader2, Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CharacterEditModal from "./character-edit-modal";
import StoryboardNav from "./storyboard-nav";
import { useToast } from "@/components/ui/toast-notification";
import { checkCreditsBalance, deductCredits } from "@/lib/credits/deduct";
import { InsufficientCreditsDialog } from "@/components/ui/insufficient-credits-dialog";

interface ProjectCreateFormProps {
  projectId: string;
}

interface ProjectData {
  title: string;
  storyOutline: string;
  artSetting: string; // 美术设定（比例）
  visualStyle: string; // 画面风格
  characterDesign: string; // 角色设计（JSON字符串，存储多个角色）
}

interface Character {
  id: string;
  name: string;
  imageUrl: string | null;
  description: string; // 构建信息
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
  skills_abilities: string[];
  relationships: string[];
  visual_reference_prompt: string;
  pose_references: string[];
}

// 视觉风格选项（8个，两行4列）
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

export default function ProjectCreateForm({ projectId }: ProjectCreateFormProps) {
  const router = useRouter();
  const { showError, showSuccess, showInfo, showWarning } = useToast();
  const [formData, setFormData] = useState<ProjectData>({
    title: "",
    storyOutline: "",
    artSetting: "16:9",
    visualStyle: "2d",
    characterDesign: "",
  });
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterDetails, setCharacterDetails] = useState<Map<string, CharacterDetail>>(new Map());
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingCharacterDetail, setEditingCharacterDetail] = useState<CharacterDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // 导航栏相关状态
  const [sessionProjectId, setSessionProjectId] = useState<string | null>(null);
  const [statusScript, setStatusScript] = useState(false);
  const [statusSettings, setStatusSettings] = useState(false);
  const [statusStoryboard, setStatusStoryboard] = useState(false);
  const [statusVideo, setStatusVideo] = useState(false);
  // 积分不足弹窗状态
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [insufficientCreditsData, setInsufficientCreditsData] = useState<{
    required: number;
    current: number;
    action: string;
  } | null>(null);
  // 是否需要显示积分（只有在会调用创建项目接口时才显示）
  const [willCallCreateProject, setWillCallCreateProject] = useState(false);
  // 跟踪原始数据，用于检测是否有修改
  const [originalFormData, setOriginalFormData] = useState<ProjectData | null>(null);
  const [originalCharacters, setOriginalCharacters] = useState<Character[]>([]);
  // 是否有数据（已加载项目数据）
  const [hasData, setHasData] = useState(false);
  
  // 故事大纲文本框的 ref，用于自动调整高度
  const storyOutlineTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (projectId) {
      console.log("=== ProjectCreateForm: 加载项目数据 ===");
      console.log("projectId:", projectId);
      loadProject();
    }
  }, [projectId]);

  // 自动调整故事大纲文本框高度
  useEffect(() => {
    const textarea = storyOutlineTextareaRef.current;
    if (textarea) {
      // 重置高度以获取正确的 scrollHeight
      textarea.style.height = 'auto';
      // 设置高度为内容高度
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [formData.storyOutline]);

  useEffect(() => {
    // 从sessionStorage获取projectId
    if (typeof window !== 'undefined') {
      const pid = sessionStorage.getItem("storyboardProjectId");
      setSessionProjectId(pid);
    }
  }, []);

  useEffect(() => {
    // 检查是否有故事大纲和分镜数据
    if (projectId) {
      // 检查故事大纲
      const checkStoryOutline = async () => {
        try {
          const response = await fetch(`/api/storyboard/projects/${projectId}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.story_outline) {
              setStatusScript(result.data.status_script || false);
              setStatusSettings(result.data.status_settings || false);
              setStatusStoryboard(result.data.status_storyboard || false);
              setStatusVideo(result.data.status_video || false);
            }
          }
        } catch (e) {
          console.error("Error checking story outline:", e);
        }
      };
      checkStoryOutline();

      // 检查分镜数据
      const checkScenes = async () => {
        try {
          const response = await fetch(`/api/scenes?sceneId=${projectId}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              // 状态从数据库读取，不需要单独设置
            }
          }
        } catch (e) {
          console.error("Error checking scenes:", e);
        }
      };
      checkScenes();
    }
  }, [projectId]);

  // 从JSON字符串解析角色列表
  useEffect(() => {
    if (formData.characterDesign) {
      try {
        const parsed = JSON.parse(formData.characterDesign);
        if (Array.isArray(parsed)) {
          setCharacters(parsed);
        } else {
          setCharacters([]);
        }
      } catch (e) {
        // 如果不是JSON，尝试解析为空数组
        setCharacters([]);
      }
    } else {
      setCharacters([]);
    }
  }, [formData.characterDesign]);

  // 当 characterDetails 更新时，如果编辑弹窗打开，同步更新 editingCharacterDetail
  // 这确保了在 loadProject() 完成后，编辑弹窗显示最新的图像
  useEffect(() => {
    if (editingCharacterDetail && characterDetails.size > 0) {
      const updatedDetail = characterDetails.get(editingCharacterDetail.id);
      if (updatedDetail && updatedDetail !== editingCharacterDetail) {
        // 只有当角色详情确实更新了才更新 editingCharacterDetail
        // 避免不必要的重新渲染
        setEditingCharacterDetail(updatedDetail);
      }
    }
  }, [characterDetails, editingCharacterDetail?.id]);

  // 当角色数据更新时，同步更新 willCallCreateProject 状态
  useEffect(() => {
    // 检查是否有角色图像：如果没有人物图像，说明项目未创建，需要显示积分
    const hasCharacterImages = characters.some(char => char.imageUrl && char.imageUrl.trim() !== '');
    setWillCallCreateProject(!hasCharacterImages);
  }, [characters]);

  // 计算编辑弹窗的初始图像URL
  // 使用 useMemo 确保当 characters 或 editingCharacterDetail 变化时自动更新
  const initialImageUrl = useMemo(() => {
    if (!editingCharacterDetail) return null;
    const character = characters.find((c) => c.id === editingCharacterDetail.id);
    return character?.imageUrl || null;
  }, [editingCharacterDetail?.id, characters]);

  const loadProject = async (retryCount = 0) => {
    setIsLoading(true);
    try {
      // 确保项目ID被设置到 sessionStorage
      sessionStorage.setItem("storyboardProjectId", projectId);
      
      const response = await fetch(`/api/storyboard/projects/${projectId}`);
      
      // 如果项目不存在（404），尝试重试（最多3次）
      if (response.status === 404) {
        if (retryCount < 3) {
          console.warn(`Project not found, retrying... (${retryCount + 1}/3)`);
          // 等待1秒后重试
          await new Promise(resolve => setTimeout(resolve, 1000));
          return loadProject(retryCount + 1);
        } else {
          console.error("Project not found after retries, redirecting to project list");
          showError("Failed to load project. Please try again later");
          router.push("/storyboard");
          return;
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load project");
      }

      const result = await response.json();
      if (result.success && result.data) {
        const projectData = result.data;
        
        // 填充表单数据
        // 注意：storyOutline 字段应该显示故事大纲（summary），而不是完整的故事剧本
        // 完整的故事剧本存储在 anim_story_scripts 表中，故事大纲存储在 anim_story_outlines.story_outline.summary 中
        const storySummary = projectData.story_outline?.summary || projectData.content || "";
        
        const loadedFormData = {
          title: projectData.title || "",
          storyOutline: storySummary, // 显示故事大纲（summary）
          artSetting: projectData.art_setting || "16:9",
          visualStyle: projectData.visual_style || "2d",
          characterDesign: projectData.character_design || "",
        };
        
        setFormData(loadedFormData);
        // 保存原始数据，用于检测是否有修改
        setOriginalFormData(loadedFormData);
        setHasData(true); // 标记已加载数据

        // 检查是否需要显示积分（基于角色是否有图像来判断）
        // 如果没有人物图像，说明项目未创建，需要显示积分并调用创建项目接口
        // 如果已经有人物图像，说明项目已创建，不需要扣除积分，直接进入下一级页面
        // 注意：这里先设置为 false，等角色数据加载完成后再更新
        setWillCallCreateProject(false);

        console.log("=== 项目设置页面 - 加载数据 ===");
        console.log("完整的 projectData:", projectData);
        console.log("projectData.content 长度（完整故事剧本）:", projectData.content?.length || 0);
        console.log("projectData.content 预览:", projectData.content?.substring(0, 200) || "");
        console.log("projectData.story_outline:", projectData.story_outline ? "存在" : "不存在");
        console.log("projectData.story_outline type:", typeof projectData.story_outline);
        if (projectData.story_outline) {
          console.log("projectData.story_outline keys:", Object.keys(projectData.story_outline));
          console.log("projectData.story_outline.theme:", projectData.story_outline.theme);
          console.log("projectData.story_outline.summary 长度（故事大纲）:", projectData.story_outline.summary?.length || 0);
          console.log("projectData.story_outline.summary 预览:", projectData.story_outline.summary?.substring(0, 200) || "");
          console.log("projectData.story_outline.chapters:", projectData.story_outline.chapters ? `exists (${projectData.story_outline.chapters.length} items)` : "null");
          console.log("projectData.story_outline.characters:", projectData.story_outline.characters ? `exists (${projectData.story_outline.characters.length} items)` : "null");
          // 检查 characters 数组中的角色是否有完整信息
          if (projectData.story_outline.characters && Array.isArray(projectData.story_outline.characters) && projectData.story_outline.characters.length > 0) {
            const sampleChar = projectData.story_outline.characters[0];
            console.log("角色示例字段:", Object.keys(sampleChar));
            console.log("角色示例是否有 appearance:", !!sampleChar.appearance, typeof sampleChar.appearance);
            console.log("角色示例是否有 clothing_style:", !!sampleChar.clothing_style, typeof sampleChar.clothing_style);
            console.log("角色示例完整数据:", sampleChar);
          }
        }
        console.log("使用的 storySummary（故事大纲）:", storySummary?.substring(0, 200) || "");
        console.log("projectData.character_design:", projectData.character_design ? "存在" : "不存在");

        // 如果有故事大纲，解析并填充角色信息
        // 注意：story_outline 现在包含合并后的数据（story_outline + characters）
        // 重要：story_outline 字段中可能包含完整的角色信息（原始AI生成的数据）
        // characters 字段中只有简化的角色信息（name, image_url等）
        // 需要合并两者：优先使用 story_outline 中的完整信息，然后用 characters 中的图片URL等信息补充
        if (projectData.story_outline) {
          try {
            const outline = typeof projectData.story_outline === 'string' 
              ? JSON.parse(projectData.story_outline) 
              : projectData.story_outline;
            
            console.log("解析后的 outline:", {
              hasCharacters: !!outline?.characters,
              charactersLength: outline?.characters?.length || 0,
              charactersPreview: outline?.characters?.slice(0, 2) || [],
              outlineKeys: outline ? Object.keys(outline) : [],
              fullOutline: outline, // 输出完整的 outline 对象
            });
            
            // 从 outline.characters 获取角色数据（来自 anim_story_outlines.characters 字段）
            // 注意：这个数组可能只包含简化的角色信息（name, image_url）
            const charactersArray = outline?.characters || [];
            console.log(`从 outline.characters 获取到 ${charactersArray.length} 个角色`);
            
            // 检查 story_outline 中是否还包含完整的角色信息（可能在原始数据中）
            // 如果 characters 数组中的角色只有 name 和 image_url，说明完整信息可能在别处
            const firstChar = charactersArray.length > 0 ? charactersArray[0] : null;
            console.log("第一个角色的字段:", firstChar ? Object.keys(firstChar) : "无");
            console.log("第一个角色是否有 appearance:", firstChar ? !!firstChar.appearance : false);
            console.log("第一个角色是否有 clothing_style:", firstChar ? !!firstChar.clothing_style : false);
            
            if (charactersArray && Array.isArray(charactersArray) && charactersArray.length > 0) {
              console.log(`找到 ${charactersArray.length} 个角色，开始解析...`);
              // 存储完整的角色详细信息
              const detailsMap = new Map<string, CharacterDetail>();
              charactersArray.forEach((char: any, index: number) => {
                const charId = char.id || `char_${index}`;
                
                // 调试：打印完整的原始数据
                console.log(`Character ${charId} raw data (完整):`, char);
                console.log(`Character ${charId} 所有字段:`, Object.keys(char));
                console.log(`Character ${charId} appearance:`, char.appearance);
                console.log(`Character ${charId} clothing_style:`, char.clothing_style);
                console.log(`Character ${charId} clothing:`, char.clothing);
                console.log(`Character ${charId} age:`, char.age);
                console.log(`Character ${charId} gender:`, char.gender);
                
                // 处理 appearance：可能是字符串或对象
                let appearanceText = "";
                
                if (typeof char.appearance === 'string') {
                  // 字符串格式：直接使用（已经组合好的文本）
                  appearanceText = char.appearance;
                } else if (typeof char.appearance === 'object' && char.appearance !== null) {
                  // 对象格式：组合成适合图片生成的文本描述
                  const app = char.appearance;
                  const parts: string[] = [];
                  
                  // 组合成流畅的描述文本，适合AI图片生成
                  // 基本信息
                  const basicInfo: string[] = [];
                  if (app.ethnicity) basicInfo.push(app.ethnicity);
                  if (app.height) basicInfo.push(`${app.height} tall`);
                  if (app.weight) basicInfo.push(`${app.weight}`);
                  if (app.body_type) basicInfo.push(app.body_type);
                  if (app.skin_tone) basicInfo.push(`${app.skin_tone} skin`);
                  if (basicInfo.length > 0) {
                    parts.push(basicInfo.join(', '));
                  }
                  
                  // 面部特征组合
                  const faceFeatures: string[] = [];
                  if (app.face_shape) faceFeatures.push(`${app.face_shape} face`);
                  
                  // 眼睛信息（可能是对象）
                  if (app.eyes) {
                    if (typeof app.eyes === 'object') {
                      const eyeDesc: string[] = [];
                      if (app.eyes.color) eyeDesc.push(app.eyes.color);
                      if (app.eyes.shape) eyeDesc.push(app.eyes.shape);
                      if (app.eyes.size) eyeDesc.push(`${app.eyes.size} sized`);
                      if (eyeDesc.length > 0) {
                        faceFeatures.push(`${eyeDesc.join(' ')} eyes`);
                      }
                    } else {
                      faceFeatures.push(`${app.eyes} eyes`);
                    }
                  }
                  
                  // 眉毛信息（可能是对象）
                  if (app.eyebrows) {
                    if (typeof app.eyebrows === 'object') {
                      const browDesc: string[] = [];
                      if (app.eyebrows.color) browDesc.push(app.eyebrows.color);
                      if (app.eyebrows.shape) browDesc.push(app.eyebrows.shape);
                      if (browDesc.length > 0) {
                        faceFeatures.push(`${browDesc.join(' ')} eyebrows`);
                      }
                    }
                  }
                  
                  if (app.nose) faceFeatures.push(`${app.nose} nose`);
                  if (app.lips) faceFeatures.push(`${app.lips} lips`);
                  if (app.ears) faceFeatures.push(`${app.ears} ears`);
                  if (app.teeth) faceFeatures.push(`${app.teeth} teeth`);
                  
                  if (faceFeatures.length > 0) {
                    parts.push(faceFeatures.join(', '));
                  }
                  
                  // 头发信息组合
                  const hairInfo: string[] = [];
                  if (app.hair_color) hairInfo.push(app.hair_color);
                  if (app.hair_style) hairInfo.push(app.hair_style);
                  if (app.hair_length) hairInfo.push(`${app.hair_length} length`);
                  if (app.hair_texture) hairInfo.push(`${app.hair_texture} texture`);
                  if (hairInfo.length > 0) {
                    parts.push(`${hairInfo.join(' ')} hair`);
                  }
                  
                  // 其他特征
                  const otherFeatures: string[] = [];
                  if (app.scars) otherFeatures.push(`scars: ${app.scars}`);
                  if (app.freckles) otherFeatures.push(`freckles: ${app.freckles}`);
                  if (app.tattoos) otherFeatures.push(`tattoos: ${app.tattoos}`);
                  if (app.birthmarks) otherFeatures.push(`birthmark: ${app.birthmarks}`);
                  if (app.distinguishing_facial_features) otherFeatures.push(app.distinguishing_facial_features);
                  
                  // 姿态和表情
                  if (app.posture) otherFeatures.push(`posture: ${app.posture}`);
                  if (app.typical_gestures) otherFeatures.push(`gestures: ${app.typical_gestures}`);
                  if (app.expressions) otherFeatures.push(`expressions: ${app.expressions}`);
                  
                  if (otherFeatures.length > 0) {
                    parts.push(otherFeatures.join(', '));
                  }
                  
                  // 组合成完整的描述文本（适合图片生成）
                  appearanceText = parts.join('. ');
                }
                
                // 处理 clothing_style：可能是字符串或对象
                let clothingText = "";
                
                if (typeof char.clothing_style === 'string') {
                  // 字符串格式：直接使用（已经组合好的文本）
                  clothingText = char.clothing_style;
                } else if (typeof char.clothing_style === 'object' && char.clothing_style !== null) {
                  // 对象格式：组合成适合图片生成的文本描述
                  const cloth = char.clothing_style;
                  const parts: string[] = [];
                  
                  // 组合成流畅的描述文本，适合AI图片生成
                  if (cloth.typical_outfits) parts.push(cloth.typical_outfits);
                  if (cloth.colors) parts.push(`colors: ${cloth.colors}`);
                  if (cloth.accessories) parts.push(`accessories: ${cloth.accessories}`);
                  if (cloth.shoes) parts.push(`shoes: ${cloth.shoes}`);
                  if (cloth.functional_details) parts.push(`details: ${cloth.functional_details}`);
                  
                  clothingText = parts.join(', ');
                } else if (typeof char.clothing === 'string') {
                  // 如果 clothing 是字符串，直接使用
                  clothingText = char.clothing;
                } else if (typeof char.clothing === 'object' && char.clothing !== null) {
                  // 处理 clothing 对象
                  const cloth = char.clothing;
                  const parts: string[] = [];
                  
                  if (cloth.style) parts.push(cloth.style);
                  if (cloth.accessories) parts.push(`accessories: ${cloth.accessories}`);
                  if (cloth.footwear) parts.push(`footwear: ${cloth.footwear}`);
                  
                  clothingText = parts.join(', ');
                }
                
                // 构建角色详情对象
                // 注意：需要保留原始字段值，同时支持组合后的文本格式
                let appearanceObj: any = {};
                let clothingObj: any = {};
                
                // 处理 appearance：优先使用组合后的文本，如果没有则从对象中提取字段
                if (typeof char.appearance === 'string') {
                  // 字符串格式：直接使用
                  appearanceObj = {
                    hair_color: "",
                    eye_color: "",
                    hair_style: "",
                    height: "",
                    build: "",
                    skin_tone: "",
                    facial_features: char.appearance, // 存储完整的外观描述文本
                    distinct_marks: "",
                  };
                } else if (typeof char.appearance === 'object' && char.appearance !== null) {
                  // 对象格式：提取各个字段
                  const app = char.appearance;
                  appearanceObj = {
                    hair_color: app.hair_color || "",
                    eye_color: typeof app.eyes === 'object' ? (app.eyes?.color || "") : (app.eye_color || ""),
                    hair_style: app.hair_style || "",
                    height: app.height || "",
                    build: app.body_type || app.build || "",
                    skin_tone: app.skin_tone || "",
                    facial_features: appearanceText || app.facial_features || app.distinguishing_facial_features || "", // 优先使用组合后的文本
                    distinct_marks: app.distinct_marks || app.scars || app.freckles || app.tattoos || app.birthmarks || "",
                  };
                } else {
                  appearanceObj = {
                    hair_color: "",
                    eye_color: "",
                    hair_style: "",
                    height: "",
                    build: "",
                    skin_tone: "",
                    facial_features: appearanceText,
                    distinct_marks: "",
                  };
                }
                
                // 处理 clothing：优先使用组合后的文本，如果没有则从对象中提取字段
                if (typeof char.clothing_style === 'string') {
                  // 字符串格式：直接使用
                  clothingObj = {
                    style: char.clothing_style,
                    accessories: "",
                    footwear: "",
                  };
                } else if (typeof char.clothing_style === 'object' && char.clothing_style !== null) {
                  // 对象格式：提取各个字段
                  const cloth = char.clothing_style;
                  clothingObj = {
                    style: clothingText || cloth.typical_outfits || "",
                    accessories: cloth.accessories || "",
                    footwear: cloth.shoes || cloth.footwear || "",
                  };
                } else if (typeof char.clothing === 'string') {
                  clothingObj = {
                    style: char.clothing,
                    accessories: "",
                    footwear: "",
                  };
                } else if (typeof char.clothing === 'object' && char.clothing !== null) {
                  const cloth = char.clothing;
                  clothingObj = {
                    style: clothingText || cloth.style || "",
                    accessories: cloth.accessories || "",
                    footwear: cloth.footwear || "",
                  };
                } else {
                  clothingObj = {
                    style: clothingText,
                    accessories: "",
                    footwear: "",
                  };
                }
                
                const characterDetail: CharacterDetail = {
                  id: charId,
                  name: char.name || "",
                  role: char.role || "",
                  age: char.age || "",
                  gender: char.gender || "", // 直接使用原JSON中的值，不进行转换
                  appearance: appearanceObj,
                  clothing: clothingObj,
                  personality: char.personality_traits || char.personality || "",
                  background: char.background || "",
                  skills_abilities: char.skills_abilities || [],
                  relationships: typeof char.relationships === 'string' ? [char.relationships] : (char.relationships || []),
                  visual_reference_prompt: char.visual_reference_prompt || "",
                  pose_references: char.pose_references || [],
                };
                
                // 调试：打印解析后的数据
                console.log(`Character ${charId} parsed data (完整):`, characterDetail);
                console.log(`Character ${charId} parsed data (摘要):`, {
                  name: characterDetail.name,
                  age: characterDetail.age,
                  gender: characterDetail.gender,
                  appearance_facial_features: characterDetail.appearance.facial_features,
                  appearance_hair_color: characterDetail.appearance.hair_color,
                  appearance_eye_color: characterDetail.appearance.eye_color,
                  clothing_style: characterDetail.clothing.style,
                  clothing_accessories: characterDetail.clothing.accessories,
                });
                
                detailsMap.set(charId, characterDetail);
              });
              setCharacterDetails(detailsMap);

              // 将角色信息转换为角色卡片格式（用于显示）
              // 简化显示：只保留图片、名字、设计按钮、删除按钮
              // 注意：保留所有字段，确保角色信息不丢失
              const characterCards: Character[] = outline.characters.map((char: any, index: number) => {
                const card = {
                  id: char.id || `char_${index}`,
                  name: char.name || "", // 从数据库读取名称，如果为空则使用空字符串
                  imageUrl: char.image_url || null, // 从数据库读取图片URL（注意：数据库字段是 image_url）
                  description: char.description || "", // 保留描述信息（如果有）
                };
                // 调试：打印加载的角色卡片信息
                console.log('从数据库加载角色卡片:', {
                  id: card.id,
                  name: card.name,
                  imageUrl: card.imageUrl,
                  db_image_url: char.image_url,
                });
                return card;
              });
              
              setCharacters(characterCards);
              // 保存原始角色数据，用于检测是否有修改
              setOriginalCharacters(characterCards);
              
              // 检查是否有角色图像：如果没有人物图像，说明项目未创建，需要显示积分
              const hasCharacterImages = characterCards.some(char => char.imageUrl && char.imageUrl.trim() !== '');
              setWillCallCreateProject(!hasCharacterImages);
              
              // 更新 characterDesign 字段（存储为JSON字符串）
              setFormData(prev => ({
                ...prev,
                characterDesign: JSON.stringify(characterCards),
              }));
            }
          } catch (e) {
            console.error("Failed to parse story outline:", e);
          }
        } else if (projectData.character_design) {
          // 如果没有 story_outline，尝试从 character_design 解析
          try {
            const parsed = JSON.parse(projectData.character_design);
            if (Array.isArray(parsed)) {
              setCharacters(parsed);
              // 检查是否有角色图像：如果没有人物图像，说明项目未创建，需要显示积分
              const hasCharacterImages = parsed.some((char: Character) => char.imageUrl && char.imageUrl.trim() !== '');
              setWillCallCreateProject(!hasCharacterImages);
            }
          } catch (e) {
            // 如果不是JSON，忽略
          }
        } else {
          // 如果没有角色数据，说明项目未创建，需要显示积分
          setWillCallCreateProject(true);
        }
      }
    } catch (error) {
      console.error("Error loading project:", error);
      showError("Failed to load project");
    } finally {
      setIsLoading(false);
    }
  };

  // 实时保存画风风格和比例到数据库
  const saveArtSettingAndVisualStyle = async (updates: { artSetting?: string; visualStyle?: string }) => {
    try {
      const updateData: any = {
        art_setting: updates.artSetting || formData.artSetting,
        visual_style: updates.visualStyle || formData.visualStyle,
      };

      const response = await fetch(`/api/storyboard/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        console.error("Failed to save art setting and visual style");
      }
    } catch (error) {
      console.error("Error saving art setting and visual style:", error);
    }
  };

  // 检测是否有修改
  const hasChanges = (): boolean => {
    if (!originalFormData || !hasData) {
      return false; // 如果没有原始数据或没有加载数据，认为没有修改
    }

    // 比较表单数据
    const formDataChanged = 
      formData.title !== originalFormData.title ||
      formData.storyOutline !== originalFormData.storyOutline ||
      formData.artSetting !== originalFormData.artSetting ||
      formData.visualStyle !== originalFormData.visualStyle;

    // 比较角色数据（通过JSON字符串比较）
    const charactersChanged = JSON.stringify(characters) !== JSON.stringify(originalCharacters);

    return formDataChanged || charactersChanged;
  };

  // 处理下一步按钮点击
  const handleNextStep = async () => {
    if (!projectId) {
      showError("Project ID does not exist");
      return;
    }

    // 1. 检查所有角色是否有图片
    const charactersWithoutImage = characters.filter(char => !char.imageUrl || char.imageUrl.trim() === '');
    if (charactersWithoutImage.length > 0) {
      showError("Please create a character image before saving. Generate or upload an image first.");
      return;
    }

    setIsSaving(true);
    try {
      // 2. 保存项目设置（比例、图像风格、角色信息）
      const getProjectResponse = await fetch(`/api/storyboard/projects/${projectId}`);
      if (!getProjectResponse.ok) {
        throw new Error("Failed to fetch project data");
      }
      const getProjectResult = await getProjectResponse.json();
      if (!getProjectResult.success || !getProjectResult.data) {
        throw new Error("Failed to fetch project data");
      }

      const projectData = getProjectResult.data;
      let storyOutline: any = null;
      
      // 从数据库中的 story_outline 字段获取故事大纲
      if (projectData.story_outline) {
        try {
          storyOutline = typeof projectData.story_outline === 'string' 
            ? JSON.parse(projectData.story_outline) 
            : projectData.story_outline;
        } catch (e) {
          console.error("Failed to parse story outline from database:", e);
        }
      }

      // 将角色列表转换为JSON字符串保存
      const characterDesignJson = JSON.stringify(characters);

      // 准备更新数据
      const updateData: any = {
        title: formData.title,
        art_setting: formData.artSetting,
        visual_style: formData.visualStyle,
        character_design: characterDesignJson,
        status_settings: true, // 设置步骤完成
      };

      // 更新 story_outline
      if (storyOutline) {
        updateData.story_outline = {
          ...storyOutline,
          summary: formData.storyOutline,
        };
      } else {
        updateData.story_outline = {
          summary: formData.storyOutline,
          chapters: [],
        };
      }

      // 更新项目信息
      const projectResponse = await fetch(`/api/storyboard/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!projectResponse.ok) {
        const error = await projectResponse.json();
        throw new Error(error.error || "Failed to save project");
      }

      const projectResult = await projectResponse.json();
      if (!projectResult.success) {
        throw new Error("Failed to save project");
      }

      // 3. 检查是否有角色图像：如果没有人物图像，说明项目未创建，需要调用创建项目接口
      const hasCharacterImages = characters.some(char => char.imageUrl && char.imageUrl.trim() !== '');
      
      // 4. 如果没有角色图像，需要生成场次列表（调用创建项目接口）
      if (!hasCharacterImages && storyOutline && storyOutline.chapters && Array.isArray(storyOutline.chapters) && storyOutline.chapters.length > 0) {
        // 检查积分余额（需要3积分）
        const creditsCheck = await checkCreditsBalance(3);
        if (!creditsCheck.sufficient) {
          setInsufficientCreditsData({
            required: 3,
            current: creditsCheck.balance || 0,
            action: "generate scene list"
          });
          setShowInsufficientCreditsDialog(true);
          setIsSaving(false);
          return;
        }

        // 扣除积分
        const deductResult = await deductCredits(
          3,
          "Generate scene list",
          { type: "scene_generation", project_id: projectId }
        );

        if (!deductResult.success) {
          console.error("Failed to deduct credits:", deductResult.error);
          showError("Failed to deduct credits. Please try again.");
          setIsSaving(false);
          return;
        }

        // Trigger credits update event to refresh header balance
        window.dispatchEvent(new Event("credits-updated"));

        // 调用生成场次接口
        const requestBody = {
          project_id: projectId,
          story_chapters: storyOutline.chapters,
        };
        
        console.log("=== 下一步按钮 - 生成场次 ===");
        console.log("project_id:", projectId);
        console.log("story_chapters数量:", storyOutline.chapters.length);
        
        const generateScenesResponse = await fetch("/api/storyboard/generate-scenes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!generateScenesResponse.ok) {
          const error = await generateScenesResponse.json();
          throw new Error(`Failed to generate scenes: ${error.error || "Unknown error"}`);
        }

        const generateScenesResult = await generateScenesResponse.json();
        if (!generateScenesResult.success) {
          throw new Error(`Failed to generate scenes: ${generateScenesResult.error || "Unknown error"}`);
        }

        console.log("场次生成成功，跳转到分镜页面");
        
        // 更新状态（生成场次接口已经更新了 status_storyboard）
        setStatusStoryboard(true);
        
        // 跳转到分镜页面
        router.push(`/storyboard/create?projectId=${projectId}`);
      } else {
        // 已有角色图像，说明项目已创建，直接跳转到分镜页面（不需要扣除积分）
        if (hasCharacterImages) {
          console.log("已有角色图像，项目已创建，直接跳转到分镜页面");
        } else {
          showWarning("Story chapters not found. Cannot generate scene list. Please complete story script creation first.");
        }
        router.push(`/storyboard/create?projectId=${projectId}`);
      }
    } catch (error) {
      console.error("Error in handleNextStep:", error);
      showError(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      showWarning("Please enter project title");
      return;
    }

    setIsSaving(true);
    try {
      // 1. 先从数据库获取项目的最新数据（包括 story_outline）
      const getProjectResponse = await fetch(`/api/storyboard/projects/${projectId}`);
      if (!getProjectResponse.ok) {
        throw new Error("Failed to fetch project data");
      }
      const getProjectResult = await getProjectResponse.json();
      if (!getProjectResult.success || !getProjectResult.data) {
        throw new Error("Failed to fetch project data");
      }

      const projectData = getProjectResult.data;
      let storyOutline: any = null;
      
      // 从数据库中的 story_outline 字段获取故事大纲
      if (projectData.story_outline) {
        try {
          storyOutline = typeof projectData.story_outline === 'string' 
            ? JSON.parse(projectData.story_outline) 
            : projectData.story_outline;
        } catch (e) {
          console.error("Failed to parse story outline from database:", e);
        }
      }

      // 将角色列表转换为JSON字符串保存
      const characterDesignJson = JSON.stringify(characters);

      // 准备更新数据
      // 注意：formData.storyOutline 现在包含故事大纲（summary），不是完整的故事剧本
      // 需要更新 story_outline.summary 字段，而不是 content 字段
      const updateData: any = {
        title: formData.title,
        art_setting: formData.artSetting,
        visual_style: formData.visualStyle,
        character_design: characterDesignJson,
        status_settings: true, // 设置步骤完成
      };

      // 更新 story_outline，将 storyOutline 字段中的 summary 更新为用户编辑的内容
      if (storyOutline) {
        updateData.story_outline = {
          ...storyOutline,
          summary: formData.storyOutline, // 更新故事大纲（summary）
        };
      } else {
        // 如果没有 story_outline，创建一个新的
        updateData.story_outline = {
          summary: formData.storyOutline,
          chapters: [],
        };
      }

      // 2. 更新项目信息
      const projectResponse = await fetch(`/api/storyboard/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!projectResponse.ok) {
        const error = await projectResponse.json();
        throw new Error(error.error || "Failed to save project");
      }

      const projectResult = await projectResponse.json();
      if (!projectResult.success) {
        throw new Error("Failed to save project");
      }

      // 3. 如果有故事大纲和章节信息，生成场次列表
      if (storyOutline && storyOutline.chapters && Array.isArray(storyOutline.chapters) && storyOutline.chapters.length > 0) {
        try {
          const requestBody = {
            project_id: projectId,
            story_chapters: storyOutline.chapters,
          };
          
          // 打印提交的参数
          console.log("=== 设置页面保存 - 提交参数 ===");
          console.log("project_id:", projectId);
          console.log("story_chapters数量:", storyOutline.chapters.length);
          console.log("story_chapters:", JSON.stringify(storyOutline.chapters, null, 2));
          console.log("项目内容长度:", projectData.content?.length || 0);
          console.log("项目内容预览:", projectData.content?.substring(0, 200) || "");
          console.log("================================");
          
          const scenesResponse = await fetch("/api/storyboard/generate-scenes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (!scenesResponse.ok) {
            const error = await scenesResponse.json();
            console.error("Failed to generate scenes:", error);
            throw new Error(`Failed to generate scenes: ${error.error || "Unknown error"}`);
          }

          const scenesResult = await scenesResponse.json();
          if (!scenesResult.success) {
            throw new Error(`场次生成失败：${scenesResult.error || "Unknown error"}`);
          }

          // 场次生成成功，更新状态（生成场次接口已经更新了 status_storyboard）
          setStatusStoryboard(true);
          console.log("Scenes generated successfully:", scenesResult.data);

          // 4. 将项目ID存储到 sessionStorage，供分镜页面使用
          sessionStorage.setItem("storyboardProjectId", projectId);
          
          // 5. 更新原始数据，以便下次检测修改
          setOriginalFormData({
            ...formData,
            storyOutline: formData.storyOutline, // 保存更新后的故事大纲
          });
          setOriginalCharacters([...characters]);
          
          // 6. 跳转到分镜场次页面
          router.push(`/storyboard/create`);
        } catch (scenesError) {
          console.error("Error generating scenes:", scenesError);
          throw new Error(scenesError instanceof Error ? scenesError.message : "Failed to generate scenes");
        }
      } else {
        // 没有章节信息，提示用户
        showWarning("Project saved, but story chapters not found. Cannot generate scene list. Please complete story script creation first.");
        setIsSaving(false);
      }
    } catch (error) {
      console.error("Error saving project:", error);
      showError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  // 添加新角色
  const handleAddCharacter = () => {
    const newCharacter: Character = {
      id: `char_${Date.now()}`,
      name: "",
      imageUrl: null,
      description: "",
    };
    setCharacters([...characters, newCharacter]);
    setEditingCharacterId(newCharacter.id);
  };

  // 更新角色
  const handleUpdateCharacter = (id: string, updates: Partial<Character>) => {
    setCharacters(
      characters.map((char) => (char.id === id ? { ...char, ...updates } : char))
    );
  };

  // 删除角色
  const handleDeleteCharacter = (id: string) => {
    setCharacters(characters.filter((char) => char.id !== id));
    if (editingCharacterId === id) {
      setEditingCharacterId(null);
    }
  };

  // 注意：已移除上传图片功能，只能通过"设计"按钮生成图片

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-7xl flex-1">
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8"
            >
              <Save className="w-8 h-8 text-[#FFDA2A]" />
            </motion.div>
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Header />
      
      {/* 导航栏 */}
      <StoryboardNav
        currentProjectId={projectId}
        sessionProjectId={sessionProjectId}
        statusScript={statusScript}
        statusSettings={statusSettings}
        statusStoryboard={statusStoryboard}
        statusVideo={statusVideo}
        currentPage="settings"
      />

      {/* 顶部操作栏 - 固定保存按钮 */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm border-b border-gray-800">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FFDA2A]/20 to-[#FFDA2A]/10 flex items-center justify-center border border-[#FFDA2A]/20">
                <Save className="w-4 h-4 text-[#FFDA2A]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Project Settings</h2>
                <p className="text-xs text-gray-400">Configure visual style, aspect ratio, and character information</p>
              </div>
            </div>
            {/* 只显示下一步按钮，点击时统一保存 */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onClick={handleNextStep}
                disabled={isSaving || !formData.title.trim()}
                className="h-11 px-8 bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 font-bold text-base shadow-lg shadow-[#FFDA2A]/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 mr-2"
                    >
                      <Loader2 className="w-4 h-4" />
                    </motion.div>
                    Processing...
                  </> 
                ) : (
                  <>
                    <span>Next Step</span>
                    {willCallCreateProject && (
                      <>
                        <Diamond className="w-4 h-4 ml-2" />
                        <span className="text-xs ml-1">3</span>
                      </>
                    )}
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl flex-1">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1],
          }}
          className="bg-gray-900 rounded-xl p-8 md:p-12 shadow-xl mb-8"
        >
          {/* PC端两列布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
            {/* 左边列 */}
            <div className="space-y-6">
              {/* 标题（可编辑） */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Title <span className="text-red-400">*</span>
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter project title"
                  className="w-full bg-gray-800 border-gray-700 text-white focus:border-[#FFDA2A]"
                />
              </div>

              {/* 故事大纲 */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Story Outline</label>
                <Textarea
                  ref={storyOutlineTextareaRef}
                  value={formData.storyOutline}
                  onChange={(e) => {
                    setFormData({ ...formData, storyOutline: e.target.value });
                    // 自动调整高度
                    const textarea = e.target;
                    textarea.style.height = 'auto';
                    textarea.style.height = `${textarea.scrollHeight}px`;
                  }}
                  placeholder="Story outline content..."
                  className="min-h-[120px] w-full resize-none bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-[#FFDA2A] overflow-hidden"
                  style={{ height: 'auto' }}
                />
              </div>

              {/* 美术设定（比例） */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Aspect Ratio</label>
                <Select
                  value={formData.artSetting}
                  onValueChange={async (value) => {
                    setFormData({ ...formData, artSetting: value });
                    // 实时保存到数据库
                    await saveArtSettingAndVisualStyle({ artSetting: value, visualStyle: formData.visualStyle });
                  }}
                >
                  <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white focus:border-[#FFDA2A]">
                    <SelectValue placeholder="Select aspect ratio" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                    <SelectItem value="4:3">4:3 (Traditional)</SelectItem>
                    <SelectItem value="21:9">21:9 (Ultrawide)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 画面风格（图片+名称，两行4列） */}
              <div>
                <label className="text-sm text-gray-400 mb-3 block">Visual Style</label>
                <div className="grid grid-cols-4 gap-3">
                  {visualStyles.map((style) => (
                    <motion.button
                      key={style.value}
                      onClick={async () => {
                        setFormData({ ...formData, visualStyle: style.value });
                        // 实时保存到数据库
                        await saveArtSettingAndVisualStyle({ artSetting: formData.artSetting, visualStyle: style.value });
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        formData.visualStyle === style.value
                          ? "border-[#FFDA2A] ring-2 ring-[#FFDA2A]/20"
                          : "border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      {/* 图片显示 */}
                      <div className="relative w-full h-full">
                        {style.image ? (
                          <>
                            <img
                              src={style.image}
                              alt={style.label}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // 如果图片加载失败，隐藏图片显示占位符
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const placeholder = target.nextElementSibling as HTMLElement;
                                if (placeholder) {
                                  placeholder.style.display = 'flex';
                                }
                              }}
                            />
                            {/* 图片加载失败时的占位符 */}
                            <div 
                              className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center hidden"
                            >
                              <span className="text-xs text-gray-400">{style.label}</span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                            <span className="text-xs text-gray-400">{style.label}</span>
                          </div>
                        )}
                      </div>
                      {/* 选中标记 */}
                      {formData.visualStyle === style.value && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-[#FFDA2A] rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-gray-900 rounded-full" />
                        </div>
                      )}
                      {/* 名称 */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                        <p className="text-xs text-white text-center truncate">{style.label}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* 右边列 - 角色设计 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm text-gray-400">Character Design</label>
                <motion.button
                  onClick={handleAddCharacter}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#FFDA2A] text-gray-900 rounded-lg text-sm font-medium hover:bg-[#FFDA2A]/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Character
                </motion.button>
              </div>

              {/* 角色卡片列表 - 一行两列 */}
              <div className="grid grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                <AnimatePresence>
                  {characters.map((character) => (
                    <motion.div
                      key={character.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl overflow-hidden border border-gray-700/50 hover:border-[#FFDA2A]/30 transition-all shadow-lg hover:shadow-xl"
                    >
                      {/* 角色图片区域 */}
                      <div className="relative h-40 bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
                        {character.imageUrl ? (
                          <>
                            <img
                              src={character.imageUrl}
                              alt={character.name || "Character image"}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#FFDA2A]/20 to-[#FFDA2A]/10 flex items-center justify-center border-2 border-[#FFDA2A]/20">
                                <svg className="w-8 h-8 text-[#FFDA2A]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                              </div>
                              <p className="text-xs text-gray-400 font-medium">Click Design to generate image</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 角色信息区域 */}
                      <div className="p-4 space-y-3">
                        {/* 角色名称 */}
                        <div>
                          <div className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm font-medium text-center">
                            {character.name || "Unnamed Character"}
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center justify-center gap-2">
                          <motion.button
                            onClick={() => {
                              console.log("=== 点击设计按钮 ===");
                              console.log("character.id:", character.id);
                              console.log("characterDetails size:", characterDetails.size);
                              console.log("characterDetails keys:", Array.from(characterDetails.keys()));
                              console.log("character:", character);
                              
                              const detail = characterDetails.get(character.id);
                              console.log("找到的 detail:", detail);
                              
                              if (detail) {
                                console.log("使用找到的 detail 设置编辑角色");
                                setEditingCharacterDetail(detail);
                              } else {
                                console.warn("未找到角色详情，尝试从数据库重新加载...");
                                // 如果没有详细信息，尝试重新加载项目数据
                                loadProject().then(() => {
                                  // 重新加载后再次尝试获取
                                  const reloadedDetail = characterDetails.get(character.id);
                                  if (reloadedDetail) {
                                    console.log("重新加载后找到角色详情");
                                    setEditingCharacterDetail(reloadedDetail);
                                  } else {
                                    console.error("重新加载后仍未找到角色详情");
                                    showError("Unable to load character information. Please refresh the page and try again");
                                  }
                                });
                                
                                // 如果没有详细信息，尝试从角色描述中解析基本信息
                                const description = character.description || "";
                                let age = "";
                                let gender = "";
                                
                                const ageMatch = description.match(/年龄[：:]\s*([^\n]+)/);
                                if (ageMatch) age = ageMatch[1].trim();
                                
                                const genderMatch = description.match(/性别[：:]\s*([^\n]+)/);
                                if (genderMatch) gender = genderMatch[1].trim();
                                
                                const defaultDetail: CharacterDetail = {
                                  id: character.id,
                                  name: character.name,
                                  role: "",
                                  age: age,
                                  gender: gender,
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
                                  skills_abilities: [],
                                  relationships: [],
                                  visual_reference_prompt: "",
                                  pose_references: [],
                                };
                                setEditingCharacterDetail(defaultDetail);
                              }
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center justify-center w-9 h-9 bg-gradient-to-r from-[#FFDA2A] to-[#FFDA2A]/90 hover:from-[#FFDA2A]/90 hover:to-[#FFDA2A] text-gray-900 rounded-lg transition-all shadow-md shadow-[#FFDA2A]/20"
                            title="Design"
                          >
                            <Edit2 className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            onClick={() => handleDeleteCharacter(character.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center justify-center w-9 h-9 bg-gray-800/80 hover:bg-red-500/80 text-gray-300 hover:text-white rounded-lg transition-all border border-gray-700/50 hover:border-red-500/50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {characters.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-gray-500">
                    <p className="text-sm">No characters yet. Click "Add Character" to start designing</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <Footer />

      {/* 保存中加载覆盖层 */}
      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl p-12 shadow-2xl border border-gray-700/60 max-w-md w-full mx-4"
            >
              <div className="flex flex-col items-center justify-center space-y-6">
                {/* 旋转的加载图标 */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFDA2A]/20 to-[#FFDA2A]/10 border-4 border-[#FFDA2A]/30 flex items-center justify-center"
                >
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-10 h-10 text-[#FFDA2A]" />
                  </motion.div>
                </motion.div>

                {/* 文字提示 */}
                <div className="text-center space-y-2">
                  <motion.h3
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-bold text-white"
                  >
                    Saving project...
                  </motion.h3>
                  <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-gray-400 text-base"
                  >
                    Estimated 1-3 minutes, please wait...
                  </motion.p>
                </div>

                {/* 进度点动画 */}
                <div className="flex items-center gap-2 mt-4">
                  {[0, 1, 2].map((index) => (
                    <motion.div
                      key={index}
                      className="w-2 h-2 rounded-full bg-[#FFDA2A]"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: index * 0.2,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 角色编辑弹窗 */}
      <CharacterEditModal
        character={editingCharacterDetail}
        isOpen={editingCharacterDetail !== null}
        onClose={() => {
          setEditingCharacterDetail(null);
        }}
        initialImageUrl={initialImageUrl}
        visualStyle={formData.visualStyle}
        artSetting={formData.artSetting}
        onSave={async (updatedDetail) => {
          try {
            // 检查是否有图片
            const imageUrl = (updatedDetail as any).imageUrl || null;
            if (!imageUrl) {
              // 如果没有图片，已经在弹窗中提示过了，这里继续保存
            }

            // 构建要保存到数据库的角色数据
            // 注意：需要保存所有在编辑页面中显示的字段，包括完整的 appearance 和 clothing_style 对象
            console.log("=== 保存角色信息 - 完整数据 ===");
            console.log("updatedDetail:", JSON.stringify(updatedDetail, null, 2));
            console.log("imageUrl:", imageUrl);

            // 获取图片生成提示词（如果存在）
            const imageGenerationPrompt = (updatedDetail as any).imageGenerationPrompt || null;
            
            const characterData: any = {
              id: updatedDetail.id,
              name: updatedDetail.name || "",
              role: updatedDetail.role || "",
              age: updatedDetail.age || "",
              gender: updatedDetail.gender || "",
              // appearance 字段：保存所有外观相关的子字段（完整对象结构）
              appearance: {
                hair_color: updatedDetail.appearance?.hair_color || "",
                eye_color: updatedDetail.appearance?.eye_color || "",
                hair_style: updatedDetail.appearance?.hair_style || "",
                height: updatedDetail.appearance?.height || "",
                build: updatedDetail.appearance?.build || "",
                skin_tone: updatedDetail.appearance?.skin_tone || "",
                facial_features: updatedDetail.appearance?.facial_features || "",
                distinct_marks: updatedDetail.appearance?.distinct_marks || "",
              },
              // clothing_style 字段：保存所有服装相关的子字段（完整对象结构）
              clothing_style: {
                style: updatedDetail.clothing?.style || "",
                accessories: updatedDetail.clothing?.accessories || "",
                footwear: updatedDetail.clothing?.footwear || "",
              },
              // 其他字段：如果存在则保存
              personality_traits: updatedDetail.personality || "",
              background: updatedDetail.background || "",
              skills_abilities: updatedDetail.skills_abilities || [],
              relationships: updatedDetail.relationships || [],
              visual_reference_prompt: updatedDetail.visual_reference_prompt || "",
              pose_references: updatedDetail.pose_references || [],
              image_url: imageUrl, // 保存图片URL
              image_generation_prompt: imageGenerationPrompt, // 保存图片生成提示词（用于生成分镜图时拼接）
            };
            
            console.log("保存的图片生成提示词:", imageGenerationPrompt ? imageGenerationPrompt.substring(0, 100) + '...' : 'null');

            console.log("构建的 characterData:", JSON.stringify(characterData, null, 2));

            // 调用API更新数据库中的角色信息
            const response = await fetch('/api/storyboard/update-character', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                project_id: projectId,
                character_id: updatedDetail.id,
                character_data: characterData,
              }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to update character in database');
            }

            const result = await response.json();
            if (!result.success) {
              throw new Error('Failed to update character in database');
            }

            // 更新本地状态
            setCharacterDetails(prev => {
              const newMap = new Map(prev);
              // 确保所有必需的数组字段和字符串字段都存在
              const normalizedDetail: CharacterDetail = {
                ...updatedDetail,
                skills_abilities: updatedDetail.skills_abilities || [],
                relationships: updatedDetail.relationships || [],
                pose_references: updatedDetail.pose_references || [],
                visual_reference_prompt: updatedDetail.visual_reference_prompt || "",
              };
              newMap.set(normalizedDetail.id, normalizedDetail);
              return newMap;
            });

            // 更新角色卡片显示（包括图片URL和名称）
            // 使用函数式更新确保立即更新，保留所有原有字段
            // 注意：这里立即更新，确保保存后立即显示图片，不等待 loadProject() 完成
            setCharacters(prev => {
              const updated = prev.map(char => {
                if (char.id === updatedDetail.id) {
                  const updatedChar = {
                    ...char, // 保留所有原有字段（id, description等）
                    name: updatedDetail.name || char.name, // 更新名称，如果为空则保留原值
                    imageUrl: imageUrl, // 更新图片URL
                  };
                  console.log('更新角色卡片:', {
                    id: updatedChar.id,
                    name: updatedChar.name,
                    imageUrl: updatedChar.imageUrl,
                  });
                  return updatedChar;
                }
                return char;
              });
              return updated;
            });

            // 更新原始角色数据，以便检测修改
            // 保留所有原有字段，只更新名称和图片URL
            setOriginalCharacters(prev => {
              const updated = [...prev];
              const index = updated.findIndex(c => c.id === updatedDetail.id);
              if (index !== -1) {
                updated[index] = {
                  ...updated[index], // 保留所有原有字段
                  name: updatedDetail.name || updated[index].name, // 更新名称，如果为空则保留原值
                  imageUrl: imageUrl, // 更新图片URL
                };
              }
              return updated;
            });

            // 更新 characterDesign 字段（存储为JSON字符串），确保刷新后能正确显示
            // 注意：这里需要从 formData.characterDesign 解析，因为 characters 状态可能还没更新
            // 保留所有原有字段，只更新名称和图片URL
            setFormData(prev => {
              try {
                const currentCharacters = prev.characterDesign 
                  ? JSON.parse(prev.characterDesign)
                  : [];
                const updatedCharacters = Array.isArray(currentCharacters)
                  ? currentCharacters.map((char: Character) => {
                      if (char.id === updatedDetail.id) {
                        return {
                          ...char, // 保留所有原有字段
                          name: updatedDetail.name || char.name, // 更新名称，如果为空则保留原值
                          imageUrl: imageUrl, // 更新图片URL
                        };
                      }
                      return char;
                    })
                  : [];
                return {
                  ...prev,
                  characterDesign: JSON.stringify(updatedCharacters),
                };
              } catch (e) {
                // 如果解析失败，使用当前 characters 状态
                const updatedCharacters = characters.map(char => {
                  if (char.id === updatedDetail.id) {
                    return {
                      ...char, // 保留所有原有字段
                      name: updatedDetail.name || char.name, // 更新名称，如果为空则保留原值
                      imageUrl: imageUrl, // 更新图片URL
                    };
                  }
                  return char;
                });
                return {
                  ...prev,
                  characterDesign: JSON.stringify(updatedCharacters),
                };
              }
            });

            console.log('Character updated successfully in database');
            console.log('保存的图片URL:', imageUrl);
            console.log('保存的 characterData:', JSON.stringify(characterData, null, 2));
            
            // 注意：我们已经在上面的代码中立即更新了 characters 数组，所以图片应该已经显示了
            // 重新加载项目数据，确保从数据库获取最新的角色图像URL
            // 这样可以确保即使刷新页面也能正确显示图像
            // 注意：useEffect 会自动同步更新 editingCharacterDetail（如果编辑弹窗打开）
            // 使用更长的延迟，确保数据库更新完成后再重新加载
            setTimeout(async () => {
              console.log('开始重新加载项目数据...');
              await loadProject();
              console.log('项目数据重新加载完成');
            }, 500);
          } catch (error) {
            console.error('Error saving character to database:', error);
            showError(`保存角色信息失败：${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }}
        onImageUpload={async (file) => {
          // 实现图片上传逻辑
          const formData = new FormData();
          formData.append('file', file);
          const response = await fetch('/api/scenes/upload-image', {
            method: 'POST',
            body: formData,
          });
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.url) {
              // 更新角色图片
              if (editingCharacterDetail) {
                handleUpdateCharacter(editingCharacterDetail.id, {
                  imageUrl: result.data.url,
                });
              }
              return result.data.url;
            }
          }
          return null;
        }}
        onImageGenerate={async (prompt) => {
          // 提交图片生成任务（异步，生成4张图片）
          // 实际返回的是 taskId，图片URL会在轮询后返回
          // prompt 已经包含了 visualStyle 和 artSetting 信息
          try {
            const response = await fetch('/api/scenes/generate-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ prompt }),
            });
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data?.taskId) {
                // 返回 taskId，弹窗会自己轮询状态
                return result.data.taskId;
              }
            }
          } catch (error) {
            console.error('Error generating image:', error);
          }
          return null;
        }}
        onImageUploadFromUrl={async (url) => {
          // 从URL上传图片到火山存储
          console.log('=== 客户端: 开始从URL上传图片 ===');
          console.log('图片URL:', url);
          console.log('URL类型:', typeof url);
          console.log('URL长度:', url?.length);
          
          try {
            // 方法1: 直接通过服务器端API上传（避免CORS问题）
            console.log('方法1: 尝试通过服务器端API上传...');
            const proxyResponse = await fetch('/api/scenes/upload-image-from-url', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ imageUrl: url }),
            });
            
            console.log('服务器端API响应状态:', proxyResponse.status, proxyResponse.statusText);
            
            if (proxyResponse.ok) {
              const proxyResult = await proxyResponse.json();
              console.log('服务器端API响应数据:', proxyResult);
              
              if (proxyResult.success && proxyResult.data?.url) {
                console.log('✅ 通过服务器端代理上传成功:', proxyResult.data.url);
                // 更新角色图片
                if (editingCharacterDetail) {
                  handleUpdateCharacter(editingCharacterDetail.id, {
                    imageUrl: proxyResult.data.url,
                  });
                }
                return proxyResult.data.url;
              } else {
                console.warn('服务器端API返回失败:', proxyResult);
                if (proxyResult.error) {
                  console.error('错误信息:', proxyResult.error);
                  console.error('错误详情:', proxyResult.details);
                }
              }
            } else {
              const errorText = await proxyResponse.text().catch(() => '无法读取错误响应');
              console.error('服务器端API请求失败:', {
                status: proxyResponse.status,
                statusText: proxyResponse.statusText,
                errorText: errorText.substring(0, 500),
              });
            }
            
            // 方法2: 如果服务器端API失败，尝试客户端直接fetch（可能遇到CORS问题）
            console.log('方法2: 尝试客户端直接fetch图片...');
            try {
              const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit',
              });
              
              console.log('客户端fetch响应状态:', response.status, response.statusText);
              
              if (response.ok) {
                const blob = await response.blob();
                console.log('Blob大小:', blob.size, 'bytes');
                console.log('Blob类型:', blob.type);
                
                const file = new File([blob], 'character-image.jpg', { type: blob.type || 'image/jpeg' });
                
                const formData = new FormData();
                formData.append('file', file);
                const uploadResponse = await fetch('/api/scenes/upload-image', {
                  method: 'POST',
                  body: formData,
                });
                
                console.log('客户端上传API响应状态:', uploadResponse.status, uploadResponse.statusText);
                
                if (uploadResponse.ok) {
                  const uploadResult = await uploadResponse.json();
                  console.log('客户端上传API响应数据:', uploadResult);
                  
                  if (uploadResult.success && uploadResult.data?.url) {
                    console.log('✅ 客户端上传成功:', uploadResult.data.url);
                    // 更新角色图片
                    if (editingCharacterDetail) {
                      handleUpdateCharacter(editingCharacterDetail.id, {
                        imageUrl: uploadResult.data.url,
                      });
                    }
                    return uploadResult.data.url;
                  }
                } else {
                  const errorText = await uploadResponse.text().catch(() => '无法读取错误响应');
                  console.error('客户端上传API失败:', {
                    status: uploadResponse.status,
                    statusText: uploadResponse.statusText,
                    errorText: errorText.substring(0, 500),
                  });
                }
              } else {
                const errorText = await response.text().catch(() => '无法读取错误响应');
                console.error('客户端fetch失败:', {
                  status: response.status,
                  statusText: response.statusText,
                  errorText: errorText.substring(0, 500),
                });
              }
            } catch (fetchError) {
              console.error('客户端fetch异常:', fetchError);
              if (fetchError instanceof Error) {
                console.error('fetch错误消息:', fetchError.message);
                console.error('fetch错误堆栈:', fetchError.stack);
              }
            }
          } catch (error) {
            console.error('=== 上传图片时发生异常 ===');
            console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
            console.error('错误消息:', error instanceof Error ? error.message : String(error));
            console.error('错误堆栈:', error instanceof Error ? error.stack : 'N/A');
            console.error('原始URL:', url);
            
            // 如果上传失败，返回原始URL（可能是临时URL，但至少可以显示）
            console.warn('⚠️ 上传失败，返回原始URL（临时）:', url);
            return url;
          }
          
          console.warn('⚠️ 所有上传方法都失败，返回null');
          return null;
        }}
      />
      
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
