"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/toast-notification";
import { Diamond } from "lucide-react";

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
                  if (!projectId) {
                    showWarning("Please complete story creation first");
                    return;
                  }
                  if (!statusScript) {
                    showWarning("Please complete the story script step first");
                    return;
                  }
                  router.push(`/storyboard/project/${projectId}/create`);
                }}
                className={getButtonClass("settings")}
                disabled={!projectId || !statusScript}
              >
                Settings
              </button>
              <button
                onClick={() => {
                  if (!projectId) {
                    showWarning("Please complete story creation first");
                    return;
                  }
                  if (!statusScript) {
                    showWarning("Please complete the story script step first");
                    return;
                  }
                  if (!statusSettings) {
                    showWarning("Please complete project settings first");
                    return;
                  }
                  
                  router.push(`/storyboard/create`);
                }}
                className={getButtonClass("storyboard")}
                disabled={!projectId || !statusScript || !statusSettings}
              >
                Storyboard
              </button>
              <button
                onClick={async () => {
                  if (!projectId) {
                    showWarning("Please complete story creation first");
                    return;
                  }
                  
                  // Check if all previous steps are completed
                  if (!statusScript) {
                    showWarning("Please complete the story script step first");
                    return;
                  }
                  if (!statusSettings) {
                    showWarning("Please complete project settings first");
                    return;
                  }
                  if (!statusStoryboard) {
                    showWarning("Please complete the storyboard step first");
                    return;
                  }
                  
                  // Navigate to video page
                  router.push(`/storyboard/video?projectId=${projectId}`);
                }}
                className={getButtonClass("video")}
                disabled={!projectId || !statusScript || !statusSettings || !statusStoryboard}
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

