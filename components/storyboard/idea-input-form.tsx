"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { useToast } from "@/components/ui/toast-notification";
import { checkCreditsBalance, deductCredits } from "@/lib/credits/deduct";
import { InsufficientCreditsDialog } from "@/components/ui/insufficient-credits-dialog";

export default function IdeaInputForm() {
  const router = useRouter();
  const { showError, showWarning } = useToast();
  const [ideaText, setIdeaText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 积分不足弹窗状态
  const [showInsufficientCreditsDialog, setShowInsufficientCreditsDialog] = useState(false);
  const [insufficientCreditsData, setInsufficientCreditsData] = useState<{
    required: number;
    current: number;
    action: string;
  } | null>(null);

  const handleBackToProjects = () => {
    router.push("/storyboard");
  };

  const handleNextStep = async () => {
    if (!ideaText.trim()) {
      showError("Please enter your idea or creative concept");
      return;
    }

    // Check credits balance before generating
    const creditsCheck = await checkCreditsBalance(2);
    if (!creditsCheck.sufficient) {
      setInsufficientCreditsData({
        required: 2,
        current: creditsCheck.balance || 0,
        action: "generate a story script"
      });
      setShowInsufficientCreditsDialog(true);
      return;
    }

    setIsGenerating(true);

    try {
      // 调用 API 生成故事内容（纯文本剧本）
      const response = await fetch("/api/storyboard/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: ideaText.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate story content");
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Deduct credits after successful generation
        const deductResult = await deductCredits(
          2,
          "Generated story script",
          { type: "story_script", prompt: ideaText.trim() }
        );

        if (!deductResult.success) {
          console.error("Failed to deduct credits:", deductResult.error);
          // Still proceed even if credit deduction fails, but log the error
        } else {
          // Trigger credits update event to refresh header balance
          window.dispatchEvent(new Event("credits-updated"));
        }

        // 将想法和生成的剧本内容存储到 sessionStorage
        sessionStorage.setItem("storyboardIdea", ideaText);
        sessionStorage.setItem("storyboardContent", JSON.stringify({
          title: result.data.title,
          content: result.data.content,
        }));
        sessionStorage.setItem("storyboardContentJson", JSON.stringify(result.data));
        
        // 跳转到故事内容显示页面
        router.push("/storyboard/anime-story");
      } else {
        throw new Error(result.error || "Failed to generate story content");
      }
    } catch (error) {
      console.error("Error generating story content:", error);
      showError(
        error instanceof Error
          ? error.message
          : "Failed to generate script. Please try again later"
      );
      setIsGenerating(false);
    }
  };


  const handleIdeaSuggestionClick = (suggestion: string) => {
    setIdeaText(suggestion);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1]
          }}
          className="bg-gray-900 rounded-xl p-8 md:p-12 shadow-xl mb-8 max-w-4xl mx-auto"
        >
          {/* 返回按钮 */}
          <motion.button
            onClick={handleBackToProjects}
            whileHover={{ x: -4 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Projects</span>
          </motion.button>

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
                placeholder="In the future, humans can backup consciousness and &quot;rebirth&quot; in different bodies. The female protagonist is a memory repair specialist who helps people recover fragmented memories. However, when she takes on a client, she discovers that their memories contain her own past..."
                className="min-h-[200px] w-full resize-none bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-[#FFDA2A] pt-8 pb-4 px-4"
                rows={8}
              />
            </div>

            {/* 下一步按钮 */}
            <div className="flex justify-center">
              <motion.div
                whileHover={ideaText.trim() && !isGenerating ? { scale: 1.05 } : {}}
                whileTap={ideaText.trim() && !isGenerating ? { scale: 0.95 } : {}}
                transition={{ duration: 0.2 }}
              >
                <Button
                  onClick={handleNextStep}
                  disabled={!ideaText.trim() || isGenerating}
                  className="px-12 py-6 text-lg font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed !bg-[#FFDA2A] hover:!bg-[#FFDA2A]/90 text-gray-900 flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </motion.div>
                      Generating script...
                    </> 
                  ) : (
                    <>
                      <span>Next Step</span>
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-sm font-medium">2</span>
                        <Diamond className="w-4 h-4" />
                      </div>
                    </>
                  )}
                </Button>
              </motion.div>
            </div>

            {/* 提示想法（一行两列） */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-300 mb-4">Example Ideas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  'In a world where ancient elemental powers shape nations, a young, determined hero discovers a hidden ability that could change the fate of the kingdom. Facing dangerous rivals, mysterious allies, and a looming threat from a dark empire, they must embark on a journey of growth, friendship, and courage, testing their skills, values, and bonds along the way',
                  'In a peaceful village nestled between magical forests and sparkling rivers, a gentle-hearted protagonist encounters small wonders and quiet mysteries of everyday life. Through meaningful friendships, personal struggles, and moments of warmth and reflection, they learn about hope, empathy, and the subtle magic that connects people and nature, gradually finding their own place in the world'
                ].map((suggestion, index) => (
                  <motion.button
                    key={index}
                    onClick={() => handleIdeaSuggestionClick(suggestion)}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-[#FFDA2A]/50 rounded-lg text-sm text-gray-300 hover:text-white transition-all text-left"
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
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

