"use client";

import React, { useState, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ArrowRight, Edit2, Check, X, Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import StoryboardNav from "./storyboard-nav";
import { useToast } from "@/components/ui/toast-notification";
import { checkCreditsBalance, deductCredits } from "@/lib/credits/deduct";
import { InsufficientCreditsDialog } from "@/components/ui/insufficient-credits-dialog";

interface StoryScriptPageProps {
  projectId?: string;
}

export default function StoryScriptPage({ projectId }: StoryScriptPageProps) {
  const router = useRouter();
  const { showError, showSuccess, showInfo, showWarning } = useToast();
  const searchParams = useSearchParams();
  const [ideaText, setIdeaText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [storyContent, setStoryContent] = useState<{ title: string; content: string } | null>(null);
  const [hasProject, setHasProject] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [storyContentJson, setStoryContentJson] = useState<any>(null); // Store complete script content JSON
  const [editingField, setEditingField] = useState<"title" | "content" | null>(null); // Currently editing field
  const [editingTitle, setEditingTitle] = useState(""); // Title being edited
  const [editingContent, setEditingContent] = useState(""); // Content being edited
  const [isCreatingProject, setIsCreatingProject] = useState(false); // Whether creating project
  const [sessionProjectId, setSessionProjectId] = useState<string | null>(null); // Project ID read from sessionStorage
  const [statusScript, setStatusScript] = useState(false); // Story script step completion status
  const [statusSettings, setStatusSettings] = useState(false); // Settings step completion status
  const [statusStoryboard, setStatusStoryboard] = useState(false); // Storyboard step completion status
  const [statusVideo, setStatusVideo] = useState(false); // Video creation step completion status
  // 积分不足弹窗状态
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [insufficientCreditsData, setInsufficientCreditsData] = useState<{
    required: number;
    current: number;
    action: string;
  } | null>(null);

  // Helper functions for safe sessionStorage access
  const getSessionStorage = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const setSessionStorage = (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Ignore error
    }
  };

  const removeSessionStorage = (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore error
    }
  };

  // Load project ID from sessionStorage on client side
  useEffect(() => {
    const pid = getSessionStorage("storyboardProjectId");
    setSessionProjectId(pid);
  }, []);

  useEffect(() => {
    // 1. Priority: Get project ID from URL query params
    const urlProjectId = searchParams.get("projectId") || projectId;
    
    // 2. If project ID exists, load project from database
    if (urlProjectId) {
      loadProject(urlProjectId);
      return;
    }
    
    // 3. If no project ID in URL (creating new project), clear old project ID from sessionStorage
    // This ensures we create a new project instead of updating an old one
    if (!urlProjectId) {
      removeSessionStorage("storyboardProjectId");
      setSessionProjectId(null);
      setCurrentProjectId(null);
    }
    
    // 4. If no project ID, check script content JSON in sessionStorage
    const savedContentJson = getSessionStorage("storyboardContentJson");
    const savedContent = getSessionStorage("storyboardContent");
    
    if (savedContentJson) {
      try {
        const contentJson = JSON.parse(savedContentJson);
        setStoryContentJson(contentJson);
        
        // If saved title and content exist, set them
        if (contentJson.title && contentJson.content) {
          setStoryContent({
            title: contentJson.title,
            content: contentJson.content,
          });
          setHasProject(true);
        }
      } catch (e) {
      }
    } else if (savedContent) {
      // Compatible with old format
      try {
        const content = JSON.parse(savedContent);
        setStoryContent(content);
        setHasProject(true);
      } catch (e) {
      }
    }
  }, [projectId, searchParams]);

  // Listen for storyContent changes, set hasProject if content exists
  useEffect(() => {
    if (storyContent && storyContent.content) {
      setHasProject(true);
    }
  }, [storyContent]);
  
  // Initialize editing state (only when storyContent is first set)
  useEffect(() => {
    if (storyContent && storyContent.title && editingTitle === "") {
      setEditingTitle(storyContent.title);
    }
    if (storyContent && storyContent.content && editingContent === "") {
      setEditingContent(storyContent.content);
    }
  }, [storyContent?.title, storyContent?.content]);


  const loadProject = async (id: string) => {
    try {
      setCurrentProjectId(id);
      setSessionStorage("storyboardProjectId", id);
      setSessionProjectId(id);
      
      const response = await fetch(`/api/storyboard/projects/${id}`);
      
      // If project doesn't exist (404), clear project ID and show input box
      if (response.status === 404) {
        setCurrentProjectId(null);
        removeSessionStorage("storyboardProjectId");
        setSessionProjectId(null);
        setStatusScript(false);
        setStatusSettings(false);
        setStatusStoryboard(false);
        setStatusVideo(false);
        return;
      }
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setHasProject(true);
          if (result.data.content && result.data.content.trim()) {
            setStoryContent({
              title: result.data.title || "Untitled Script",
              content: result.data.content,
            });
            
            // Read status fields from database
            setStatusScript(result.data.status_script || false);
            setStatusSettings(result.data.status_settings || false);
            setStatusStoryboard(result.data.status_storyboard || false);
            setStatusVideo(result.data.status_video || false);
            
            // If story_outline exists, save to sessionStorage
            if (result.data.story_outline) {
              setSessionStorage("storyboardOutline", JSON.stringify(result.data.story_outline));
            }
          }
        }
      }
    } catch (error) {
    }
  };

  const handleGenerate = async () => {
    if (!ideaText.trim()) {
      showWarning("Please enter your idea or creative concept");
      return;
    }

    setIsGenerating(true);
    setStoryContent(null);

    try {
      // 打印客户端请求参数（浏览器控制台）
      const requestData = {
        prompt: ideaText.trim(),
        style: "2d", // Default style, can be obtained from project settings later
      };
      const response = await fetch("/api/storyboard/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        // Check if response is JSON
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to generate script");
        } else {
          // Response is HTML (error page)
          const errorText = await response.text();
          throw new Error(`Server error (${response.status}): Please try again later`);
        }
      }

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        throw new Error("Invalid response from server. Please try again.");
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Extract title and content
        const content = result.data.content || "";
        const title = result.data.title || "AI Generated Script";

        const contentData = {
          title,
          content,
        };

        setStoryContent(contentData);
        
        // Save complete script content JSON to sessionStorage (includes all API returned data)
        setSessionStorage("storyboardContentJson", JSON.stringify(result.data));
        setSessionStorage("storyboardContent", JSON.stringify(contentData));
        setStoryContentJson(result.data);

        // After successful generation, don't auto-save to database, wait for user to click "Next Step"
        // This avoids creating unnecessary projects when there's no project ID
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to generate script");
    } finally {
      setIsGenerating(false);
    }
  };

  // Common function to save project to database (update if exists, insert if not)
  const saveProjectToDatabase = async (title: string, content: string): Promise<string | null> => {
    const existingProjectId = currentProjectId || sessionProjectId;

    try {
      let finalProjectId: string;

      if (existingProjectId) {
        // Update existing project
        const response = await fetch(`/api/storyboard/projects/${existingProjectId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title,
            content: content,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to save project");
        }

        finalProjectId = existingProjectId;
      } else {
        // Create new project
        const response = await fetch("/api/storyboard/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title,
            content: content,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create project");
        }

        const result = await response.json();
        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to create project");
        }

        finalProjectId = result.data.id;
        setCurrentProjectId(finalProjectId);
        setSessionStorage("storyboardProjectId", finalProjectId);
        setSessionProjectId(finalProjectId);
      }

      return finalProjectId;
    } catch (error) {
      return null;
    }
  };

  const handleNextStep = async () => {
    if (!storyContent) return;

    try {
      // Check credits balance before proceeding
      const creditsCheck = await checkCreditsBalance(2);
      if (!creditsCheck.sufficient) {
        setInsufficientCreditsData({
          required: 2,
          current: creditsCheck.balance || 0,
          action: "proceed to next step"
        });
        setShowInsufficientCreditsDialog(true);
        return;
      }

      setIsCreatingProject(true);

      // Deduct credits before creating project
      const deductResult = await deductCredits(
        2,
        "Proceed to project settings",
        { type: "story_script_next_step", project_id: currentProjectId || sessionProjectId }
      );

      if (!deductResult.success) {
        showError("Failed to deduct credits. Please try again.");
        setIsCreatingProject(false);
        return;
      }

      // Trigger credits update event to refresh header balance
      window.dispatchEvent(new Event("credits-updated"));

      // Call create project API to generate story outline and character information
      // Only use existing project ID if it comes from URL (editing existing project)
      // If no URL projectId, we're creating a new project, so don't pass project_id
      const urlProjectId = searchParams.get("projectId") || projectId;
      const existingProjectId = urlProjectId ? (currentProjectId || sessionProjectId) : null;
      
      const response = await fetch("/api/storyboard/create-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          story_text: storyContent.content,
          project_id: existingProjectId || null,
        }),
      });

      if (!response.ok) {
        let error;
        try {
          const errorText = await response.text();
          try {
            error = JSON.parse(errorText);
          } catch (parseError) {
            // If JSON parsing fails, use the raw text as error message
            throw new Error(errorText.substring(0, 200) || `HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (textError) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        throw new Error(error.error || "Failed to create project");
      }

      // Parse response with better error handling
      let result;
      try {
        const responseText = await response.text();
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          // Try to find the problematic character position
          if (parseError instanceof SyntaxError && parseError.message.includes("position")) {
            const match = parseError.message.match(/position (\d+)/);
            if (match) {
              const pos = parseInt(match[1]);
              const start = Math.max(0, pos - 50);
              const end = Math.min(responseText.length, pos + 50);
            }
          }
          // Create a more detailed error message
          let errorMessage = `Failed to parse server response: ${parseError instanceof Error ? parseError.message : "Invalid JSON format"}`;
          
          // If the error includes position information, add it to the message
          if (parseError instanceof SyntaxError && parseError.message.includes("position")) {
            const match = parseError.message.match(/position (\d+)/);
            if (match) {
              const pos = parseInt(match[1]);
              errorMessage += ` (at position ${pos})`;
            }
          }
          
          // Log the problematic area for debugging
          throw new Error(errorMessage);
        }
      } catch (textError) {
        throw new Error(`Failed to read server response: ${textError instanceof Error ? textError.message : "Unknown error"}`);
      }

      if (result.success && result.data) {
        const projectId = result.data.project_id;
        
        // Save project ID to sessionStorage
        setSessionStorage("storyboardProjectId", projectId);
        setSessionProjectId(projectId);
        setCurrentProjectId(projectId);
        
        // If story_outline is returned, project setup is complete
        if (result.data.story_outline) {
          setStatusScript(true);
          setStatusSettings(false);
          setStatusStoryboard(false);
          setStatusVideo(false);
          setSessionStorage("storyboardOutline", JSON.stringify(result.data.story_outline));
        }
        
        // 更新故事剧本步骤完成状态
        try {
          const statusResponse = await fetch('/api/storyboard/project-step-status', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              project_id: projectId,
              step_script: true,
            }),
          });
          if (statusResponse.ok) {
          }
        } catch (error) {
          // 不阻止导航，即使状态更新失败也继续
        }
        
        // Wait a short time to ensure database write completes, then navigate to project settings page
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate to project settings page
        router.push(`/storyboard/project/${projectId}/create`);
      } else {
        throw new Error(result.error || "Failed to create project");
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to create project");
      setIsCreatingProject(false);
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <Header />

      {/* Fixed navigation bar */}
      <StoryboardNav
        currentProjectId={currentProjectId}
        sessionProjectId={sessionProjectId}
        statusScript={statusScript}
        statusSettings={statusSettings}
        statusStoryboard={statusStoryboard}
        statusVideo={statusVideo}
        currentPage="script"
      />

      {/* Main content area - scrollable */}
      <div className="flex-1 overflow-y-auto bg-black min-h-0">
        <div className="container mx-auto px-4 py-4 max-w-6xl min-h-full flex flex-col">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-gray-900 rounded-xl p-8 md:p-12 shadow-xl flex-1 flex flex-col overflow-hidden relative min-h-full"
          >
            <AnimatePresence mode="wait">
              {/* Input state - if no content and not generating, show input box */}
              {!storyContent && !isGenerating && (
                <motion.div
                  key="input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                    AI Storyboard Generator
                  </h1>
                  <h2 className="text-xl md:text-2xl font-semibold mb-6 text-center text-gray-300">
                    Hi! Video maker, share your ideas or creative concepts
                  </h2>

                  <div className="relative">
                    <label className="absolute top-2 left-4 text-sm text-gray-400 z-10">
                      Enter your idea
                    </label>
                    <Textarea
                      value={ideaText}
                      onChange={(e) => setIdeaText(e.target.value)}
                      placeholder="In the future, humans can backup consciousness and &quot;rebirth&quot; in different bodies. The female protagonist is a memory repair specialist who helps people recover fragmented memories. However, when she takes on a client, she discovers that their memories contain her own past..."
                      className="min-h-[200px] w-full resize-none bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-[#FFDA2A] pt-8 pb-4 px-4"
                      rows={8}
                    />
                  </div>

                  <div className="flex justify-center">
                    <motion.div
                      whileHover={ideaText.trim() ? { scale: 1.05 } : {}}
                      whileTap={ideaText.trim() ? { scale: 0.95 } : {}}
                      transition={{ duration: 0.2 }}
                    >
                      <Button
                        onClick={handleGenerate}
                        disabled={!ideaText.trim()}
                        className="px-12 py-6 text-lg font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed !bg-[#FFDA2A] hover:!bg-[#FFDA2A]/90 text-gray-900"
                      >
                        Generate
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* 生成中状态 */}
              {isGenerating && (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center justify-center py-20"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 mb-6"
                  >
                    <Sparkles className="w-16 h-16 text-[#FFDA2A]" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-2">Generating script...</h3>
                  <p className="text-gray-400">Please wait, AI is creating an amazing story for you</p>
                </motion.div>
              )}

            {/* 创建项目中状态 */}
            {isCreatingProject && (
              <motion.div
                key="creating"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 z-50"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 mb-6"
                >
                  <Sparkles className="w-16 h-16 text-[#FFDA2A]" />
                </motion.div>
                <h3 className="text-2xl font-bold mb-2">Creating project...</h3>
                <p className="text-gray-400">1-3 minutes, please wait...</p>
              </motion.div>
            )}

            {/* 生成成功状态 */}
            {storyContent && !isGenerating && !isCreatingProject && (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col h-full overflow-hidden"
                >
                  {/* 固定标题栏 - 包含标题和下一步按钮，移出内容区域 */}
                  <div className="flex-shrink-0 bg-gray-900 pb-4 border-b border-gray-800 mb-4">
                    {/* SEO H1 - 固定用于SEO */}
                    <h1 className="sr-only">AI Storyboard Generator</h1>
                    {editingField === "title" ? (
                      <div className="flex gap-2 items-start">
                        <Textarea
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="min-h-[60px] flex-1 resize-none bg-gray-800 border-gray-700 text-white focus:border-[#FFDA2A] text-3xl md:text-4xl font-bold"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex flex-col gap-2">
                          <motion.button
                            onClick={() => {
                              setStoryContent({ ...storyContent, title: editingTitle });
                              setEditingField(null);
                              // 更新 sessionStorage
                              setSessionStorage("storyboardContent", JSON.stringify({
                                title: editingTitle,
                                content: storyContent.content,
                              }));
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-2 text-green-400 hover:text-green-300"
                          >
                            <Check className="w-5 h-5" />
                          </motion.button>
                          <motion.button
                            onClick={() => {
                              setEditingTitle(storyContent.title);
                              setEditingField(null);
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-2 text-red-400 hover:text-red-300"
                          >
                            <X className="w-5 h-5" />
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <h2
                          className="text-3xl md:text-4xl font-bold cursor-pointer hover:text-[#FFDA2A] transition-colors flex items-center gap-2 group flex-1"
                          onClick={() => {
                            setEditingTitle(storyContent.title);
                            setEditingField("title");
                          }}
                        >
                          {storyContent.title}
                          <Edit2 className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h2>
                        {/* 下一步按钮在标题右侧 */}
                        <motion.div
                          whileHover={!isCreatingProject && editingField === null ? { scale: 1.05 } : {}}
                          whileTap={!isCreatingProject && editingField === null ? { scale: 0.95 } : {}}
                          transition={{ duration: 0.2 }}
                          className="flex-shrink-0"
                        >
                          <Button
                            onClick={handleNextStep}
                            disabled={editingField !== null || isCreatingProject}
                            className="px-8 py-3 text-lg font-semibold rounded-lg !bg-[#FFDA2A] hover:!bg-[#FFDA2A]/90 text-gray-900 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCreatingProject ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                  className="w-4 h-4"
                                >
                                  <Sparkles className="w-4 h-4" />
                                </motion.div>
                                Creating...
                              </> 
                            ) : (
                              <>
                                Next Step
                                <div className="flex items-center gap-1 ml-1">
                                  <Diamond className="w-4 h-4" />
                                  <span className="text-sm font-semibold">2</span>
                                </div>
                                <ArrowRight className="w-5 h-5" />
                              </>
                            )}
                          </Button>
                        </motion.div>
                      </div>
                    )}
                  </div>

                  {/* 可滚动内容区域 - 使用 flex-1 自动填充剩余空间 */}
                  <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                    {editingField === "content" ? (
                      <div className="flex flex-col h-full">
                        <Textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="flex-1 w-full resize-none bg-gray-800 border-gray-700 text-white focus:border-[#FFDA2A] text-base leading-relaxed min-h-0"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end pt-4 pb-4 flex-shrink-0">
                          <motion.button
                            onClick={() => {
                              setStoryContent({ ...storyContent, content: editingContent });
                              setEditingField(null);
                              // 更新 sessionStorage
                              setSessionStorage("storyboardContent", JSON.stringify({
                                title: storyContent.title,
                                content: editingContent,
                              }));
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            保存
                          </motion.button>
                          <motion.button
                            onClick={() => {
                              setEditingContent(storyContent.content);
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
                        className="bg-gray-800 rounded-lg p-6 border border-gray-700 whitespace-pre-wrap leading-relaxed text-base cursor-pointer hover:border-[#FFDA2A]/50 transition-colors relative group h-full"
                        onClick={() => {
                          setEditingContent(storyContent.content);
                          setEditingField("content");
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1">{storyContent.content}</div>
                          <Edit2 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex-shrink-0" />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
    </div>
  );
}

