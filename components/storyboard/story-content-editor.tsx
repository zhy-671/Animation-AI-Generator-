"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Edit2, Check, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";

interface StoryContent {
  title: string;
  content: string; // 完整的故事文本内容
}

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

interface Character {
  id: string;
  name: string;
  role: string;
  age: string;
  gender: string;
  appearance: CharacterAppearance;
  clothing: CharacterClothing;
  personality: string;
  background: string;
  skills_abilities: string[];
  relationships: string[];
  visual_reference_prompt: string;
  pose_references: string[];
}

interface StoryData {
  title: string;
  theme: string;
  genre: string;
  summary: string;
  setting: string;
  plot_outline: Array<{
    scene: number;
    summary: string;
  }>;
  tone_style: string;
  message: string;
}

interface StoryOutline {
  story: StoryData;
  characters: Character[];
}

// 将故事大纲转换为纯文本内容
function formatStoryOutline(outline: StoryOutline): string {
  const story = outline.story;
  let content = `# ${story.title}\n\n`;
  content += `**主题**: ${story.theme}\n`;
  content += `**类型**: ${story.genre}\n`;
  content += `**风格**: ${story.tone_style}\n\n`;
  content += `## 故事简介\n\n${story.summary}\n\n`;
  content += `## 故事背景\n\n${story.setting}\n\n`;
  
  if (outline.characters && outline.characters.length > 0) {
    content += `## 主要角色\n\n`;
    outline.characters.forEach((char) => {
      content += `### ${char.name} (${char.role})\n\n`;
      content += `**基本信息**: ${char.age}岁，${char.gender}\n\n`;
      content += `**外观**:\n`;
      content += `- 头发：${char.appearance.hair_color}，${char.appearance.hair_style}\n`;
      content += `- 眼睛：${char.appearance.eye_color}\n`;
      content += `- 身高：${char.appearance.height}\n`;
      content += `- 体型：${char.appearance.build}\n`;
      content += `- 肤色：${char.appearance.skin_tone}\n`;
      if (char.appearance.facial_features) {
        content += `- 面部特征：${char.appearance.facial_features}\n`;
      }
      if (char.appearance.distinct_marks) {
        content += `- 特殊标记：${char.appearance.distinct_marks}\n`;
      }
      content += `\n**服装**:\n`;
      content += `- 风格：${char.clothing.style}\n`;
      if (char.clothing.accessories) {
        content += `- 配饰：${char.clothing.accessories}\n`;
      }
      if (char.clothing.footwear) {
        content += `- 鞋履：${char.clothing.footwear}\n`;
      }
      content += `\n**性格**: ${char.personality}\n\n`;
      if (char.background) {
        content += `**背景**: ${char.background}\n\n`;
      }
      if (char.skills_abilities && char.skills_abilities.length > 0) {
        content += `**技能能力**: ${char.skills_abilities.join(", ")}\n\n`;
      }
      if (char.relationships && char.relationships.length > 0) {
        content += `**人际关系**: ${char.relationships.join(", ")}\n\n`;
      }
      content += `\n`;
    });
  }
  
  if (story.plot_outline && story.plot_outline.length > 0) {
    content += `## 剧情大纲\n\n`;
    story.plot_outline.forEach((scene) => {
      content += `**场景 ${scene.scene}**: ${scene.summary}\n\n`;
    });
  }
  
  content += `## 核心主题\n\n${story.message}\n`;
  
  return content;
}

export default function StoryContentEditor() {
  const router = useRouter();
  const [storyContent, setStoryContent] = useState<StoryContent>({
    title: "",
    content: "",
  });
  const [storyOutline, setStoryOutline] = useState<StoryOutline | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 从 sessionStorage 读取故事大纲
    const outlineStr = sessionStorage.getItem("storyboardOutline");
    const idea = sessionStorage.getItem("storyboardIdea");
    
    if (outlineStr) {
      try {
        const outline: StoryOutline = JSON.parse(outlineStr);
        setStoryOutline(outline);
        setStoryContent({
          title: outline.story?.title || "",
          content: formatStoryOutline(outline),
        });
      } catch (e) {
        // 如果解析失败，使用默认内容
        setStoryContent({
          title: "新故事",
          content: idea || "",
        });
      }
    } else if (idea) {
      // 如果没有大纲，使用想法作为内容
      setStoryContent({
        title: "新故事",
        content: idea,
      });
    }
    
    setIsLoading(false);
  }, []);

  const handleBackToInput = () => {
    router.push("/storyboard/new-anime-story");
  };

  const handleNextStep = async () => {
    if (!storyContent.title.trim() || !storyContent.content.trim()) {
      alert("请填写完整的故事标题和内容");
      return;
    }

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      // 检查是否已有项目ID（从"我的项目"列表进入时会有）
      const existingProjectId = sessionStorage.getItem("storyboardProjectId");
      
      // 准备保存的数据，包含故事大纲
      const saveData: any = {
        title: storyContent.title,
        content: storyContent.content,
      };

      // 如果有故事大纲，一起保存
      if (storyOutline) {
        saveData.story_outline = storyOutline;
      }

      let projectId: string;
      let response: Response;

      if (existingProjectId) {
        // 如果已有项目ID，更新现有项目
        response = await fetch(`/api/storyboard/projects/${existingProjectId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(saveData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update project");
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to update project");
        }

        projectId = existingProjectId;
      } else {
        // 如果没有项目ID，创建新项目
        response = await fetch("/api/storyboard/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(saveData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to save project");
        }

        const result = await response.json();
        
        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to save project");
        }

        projectId = result.data.id;
      }
      
      setSaveStatus("success");
      
      // 将项目ID和内容存储到 sessionStorage
      sessionStorage.setItem("storyboardProjectId", projectId);
      sessionStorage.setItem("storyboardContent", JSON.stringify(storyContent));
      if (storyOutline) {
        sessionStorage.setItem("storyboardOutline", JSON.stringify(storyOutline));
      }
      
      // 延迟一下显示成功状态，然后跳转到项目编辑页面
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      router.push(`/storyboard/project/${projectId}/create`);
    } catch (error) {
      setSaveStatus("error");
      alert(error instanceof Error ? error.message : "保存项目失败");
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    
    try {
      const idea = sessionStorage.getItem("storyboardIdea");
      if (!idea) {
        alert("未找到原始想法，请返回重新输入");
        setIsRegenerating(false);
        return;
      }

      // 调用 API 重新生成故事大纲
      const response = await fetch("/api/storyboard/generate-outline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userText: idea,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to regenerate story outline");
      }

      const result = await response.json();

      if (result.success && result.data) {
        const outline: StoryOutline = result.data;
        setStoryOutline(outline);
        setStoryContent({
          title: outline.story?.title || "",
          content: formatStoryOutline(outline),
        });
        
        // 更新 sessionStorage
        sessionStorage.setItem("storyboardOutline", JSON.stringify(outline));
      } else {
        throw new Error(result.error || "Failed to regenerate story outline");
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "重新生成故事大纲失败，请稍后重试"
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleEditTitle = (value: string) => {
    setStoryContent({ ...storyContent, title: value });
    setEditingField(null);
  };

  const handleEditContent = (value: string) => {
    setStoryContent({ ...storyContent, content: value });
    setEditingField(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8"
            >
              <Sparkles className="w-8 h-8 text-[#FFDA2A]" />
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1],
          }}
          className="bg-gray-900 rounded-xl p-8 md:p-12 shadow-xl mb-8"
        >
          {/* 返回按钮 */}
          <motion.button
            onClick={handleBackToInput}
            whileHover={{ x: -4 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回上一步</span>
          </motion.button>

          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
            AI生成的故事内容
          </h2>

          <div className="space-y-6">
            {/* 故事标题 */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">故事标题</label>
              {editingField === "title" ? (
                <div className="flex gap-2 items-start">
                  <Textarea
                    value={storyContent.title}
                    onChange={(e) => handleEditTitle(e.target.value)}
                    className="min-h-[60px] flex-1 resize-none bg-gray-800 border-gray-700 text-white focus:border-[#FFDA2A]"
                    rows={2}
                    autoFocus
                  />
                  <motion.button
                    onClick={() => setEditingField(null)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 text-green-400 hover:text-green-300"
                  >
                    <Check className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setStoryContent({ ...storyContent });
                      setEditingField(null);
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 text-red-400 hover:text-red-300"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
              ) : (
                <div
                  className="text-2xl font-bold text-white cursor-pointer hover:text-[#FFDA2A] transition-colors flex items-center gap-2 group"
                  onClick={() => setEditingField("title")}
                >
                  {storyContent.title}
                  <Edit2 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>

            {/* 故事内容 */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">故事内容</label>
              {editingField === "content" ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={storyContent.content}
                    onChange={(e) => handleEditContent(e.target.value)}
                    className="min-h-[500px] w-full resize-none bg-gray-800 border-gray-700 text-white focus:border-[#FFDA2A] text-base leading-relaxed"
                    rows={20}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <motion.button
                      onClick={() => setEditingField(null)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      保存
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setStoryContent({ ...storyContent });
                        setEditingField(null);
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      取消
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-gray-300 cursor-pointer hover:text-white transition-colors bg-gray-800 rounded-lg p-6 border border-gray-700 min-h-[500px] whitespace-pre-wrap leading-relaxed text-base"
                  onClick={() => setEditingField("content")}
                >
                  <div className="flex items-start gap-2 group">
                    <div className="flex-1">{storyContent.content}</div>
                    <Edit2 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0" />
                  </div>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-4 justify-center pt-6 border-t border-gray-700">
              <motion.div
                whileHover={!isSaving ? { scale: 1.05 } : {}}
                whileTap={!isSaving ? { scale: 0.95 } : {}}
                transition={{ duration: 0.2 }}
              >
                <Button
                  onClick={handleRegenerate}
                  disabled={isRegenerating || isSaving}
                  className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`}
                  />
                  {isRegenerating ? "重新生成中..." : "重新生成"}
                </Button>
              </motion.div>
              <motion.div
                whileHover={!isSaving ? { scale: 1.05 } : {}}
                whileTap={!isSaving ? { scale: 0.95 } : {}}
                transition={{ duration: 0.2 }}
              >
                <Button
                  onClick={handleNextStep}
                  disabled={isSaving || !storyContent.title.trim() || !storyContent.content.trim()}
                  className="px-8 py-3 !bg-[#FFDA2A] hover:!bg-[#FFDA2A]/90 text-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 mr-2"
                      >
                        <Sparkles className="w-4 h-4" />
                      </motion.div>
                      {saveStatus === "saving" && "保存中..."}
                      {saveStatus === "success" && "保存成功！"}
                    </>
                  ) : (
                    "下一步"
                  )}
                </Button>
              </motion.div>
            </div>

            {/* 保存状态提示 */}
            <AnimatePresence>
              {isSaving && saveStatus === "saving" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex items-center justify-center gap-3 text-[#FFDA2A] pt-4"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-6 h-6"
                  >
                    <Sparkles className="w-6 h-6" />
                  </motion.div>
                  <span className="text-lg font-medium">正在保存项目...</span>
                </motion.div>
              )}
              {saveStatus === "success" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center justify-center gap-3 text-green-400 pt-4"
                >
                  <Check className="w-6 h-6" />
                  <span className="text-lg font-medium">项目保存成功！</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}

