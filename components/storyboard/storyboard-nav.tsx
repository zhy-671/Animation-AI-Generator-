"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/toast-notification";

interface StoryboardNavProps {
  currentProjectId?: string | null;
  sessionProjectId?: string | null;
  statusScript?: boolean; // Story script step completion status
  statusSettings?: boolean; // Settings step completion status
  statusStoryboard?: boolean; // Storyboard step completion status
  statusVideo?: boolean; // Video creation step completion status
  currentPage?: "script" | "settings" | "storyboard" | "video";
}

export default function StoryboardNav({
  currentProjectId,
  sessionProjectId,
  statusScript = false,
  statusSettings = false,
  statusStoryboard = false,
  statusVideo = false,
  currentPage = "script",
}: StoryboardNavProps) {
  const router = useRouter();
  const { showWarning } = useToast();
  const projectId = currentProjectId || sessionProjectId;

  const getButtonClass = (page: string) => {
    const baseClass = "px-6 py-2 rounded-lg font-semibold transition-colors";
    if (currentPage === page) {
      return `${baseClass} bg-[#FFDA2A] text-gray-900 hover:bg-[#FFDA2A]/90`;
    }
    return `${baseClass} bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0 bg-black border-b border-gray-800 z-10"
    >
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <div className="bg-gray-900 rounded-2xl p-4 max-w-6xl mx-auto">
          <div className="flex items-center justify-center">
            {/* Center: Navigation buttons centered */}
            <nav className="flex items-center gap-6">
              <button
                onClick={() => router.push("/storyboard/anime-story")}
                className={getButtonClass("script")}
              >
                Story Script
              </button>
              <button
                onClick={() => {
                  if (projectId && statusScript) {
                    router.push(`/storyboard/project/${projectId}/create`);
                  } else if (!projectId) {
                    showWarning("Please complete story creation first");
                  } else {
                    showWarning("Please complete the story script step first");
                  }
                }}
                className={getButtonClass("settings")}
                disabled={!projectId || !statusScript}
              >
                Settings
              </button>
              <button
                onClick={async () => {
                  if (!projectId) {
                    showWarning("Please complete story creation first");
                    return;
                  }
                  
                  // 检查分镜数据是否存在
                  try {
                    const response = await fetch(`/api/scenes?projectId=${projectId}`);
                    if (response.ok) {
                      const result = await response.json();
                      if (result.success && result.data?.items) {
                        // 检查是否有分镜数据
                        let hasStoryboard = false;
                        for (const item of result.data.items) {
                          if (item.metadata?.storyboard?.shots && item.metadata.storyboard.shots.length > 0) {
                            hasStoryboard = true;
                            break;
                          }
                        }
                        
                        // 如果有分镜数据，或者状态允许，则允许访问
                        if (hasStoryboard || (statusScript && statusSettings)) {
                          router.push(`/storyboard/create`);
                          return;
                        }
                      }
                    }
                    
                    // 如果没有分镜数据，检查状态
                    if (!statusScript) {
                      showWarning("Please complete the story script step first");
                    } else if (!statusSettings) {
                      showWarning("Please complete project settings first");
                    } else {
                      router.push(`/storyboard/create`);
                    }
                  } catch (error) {
                    console.error("Error checking storyboard data:", error);
                    // 如果检查失败，根据状态决定是否允许访问
                    if (statusScript && statusSettings) {
                      router.push(`/storyboard/create`);
                    } else if (!statusScript) {
                      showWarning("Please complete the story script step first");
                    } else {
                      showWarning("Please complete project settings first");
                    }
                  }
                }}
                className={getButtonClass("storyboard")}
                disabled={!projectId}
              >
                Storyboard
              </button>
              <button
                onClick={async () => {
                  if (!projectId) {
                    showWarning("Please complete story creation first");
                    return;
                  }
                  
                  // Check if project has videos
                  try {
                    const response = await fetch(`/api/scenes?projectId=${projectId}`);
                    if (response.ok) {
                      const result = await response.json();
                      if (result.success && result.data?.items) {
                        // Check if there are videos
                        let hasVideo = false;
                        for (const item of result.data.items) {
                          // Check videos in storyboard shots
                          if (item.metadata?.storyboard?.shots) {
                            const hasShotVideo = item.metadata.storyboard.shots.some((shot: any) => shot.video_url);
                            if (hasShotVideo) {
                              hasVideo = true;
                              break;
                            }
                          }
                          // Check scene videos
                          if (item.video_url) {
                            hasVideo = true;
                            break;
                          }
                        }
                        
                        if (hasVideo) {
                          router.push(`/storyboard/video?projectId=${projectId}`);
                        } else {
                          showWarning("Please generate storyboard videos first");
                        }
                      } else {
                        showWarning("Please generate storyboard videos first");
                      }
                    } else {
                      showWarning("Please generate storyboard videos first");
                    }
                  } catch (error) {
                    console.error("Error checking videos:", error);
                    showWarning("Failed to check videos. Please try again later");
                  }
                }}
                className={getButtonClass("video")}
                disabled={!projectId}
              >
                Create Video
              </button>
            </nav>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

