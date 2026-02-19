"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Info, Plus } from "lucide-react";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { Button } from "@/components/ui/button";

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
  imageStatus?: 'pending' | 'generating' | 'completed' | 'failed';
}

interface ProjectViewProps {
  projectId: string;
}

export default function StoryboardProjectView({ projectId }: ProjectViewProps) {
  const router = useRouter();
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectTitle, setProjectTitle] = useState("");

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/scenes?sceneId=${projectId}`);
      if (!response.ok) {
        throw new Error("Failed to load project");
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        const sceneData = result.data;
        setProjectTitle(sceneData.title || "");
        
        // 加载项目数据
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
                sceneItemId: item.id,
                imageStatus: displayImageUrl ? 'completed' : 'failed',
              };
            })
          );
          
          setGeneratedImages(restoredImages);
        }
      }
    } catch (error) {
      alert("加载项目失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToProjects = () => {
    router.push("/storyboard");
  };

  const handleNewProject = () => {
    router.push("/storyboard/new-anime-story");
  };

  const handleEditProject = () => {
    router.push(`/storyboard/project/${projectId}/edit`);
  };

  if (loading) {
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
            ease: [0.25, 0.1, 0.25, 1]
          }}
        >
          {/* 导航栏 */}
          <div className="mb-6 flex items-center gap-4 flex-wrap">
            <motion.button
              onClick={handleBackToProjects}
              whileHover={{ x: -4 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Projects</span>
            </motion.button>
            <span className="text-gray-500">|</span>
            <motion.button
              onClick={handleNewProject}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </motion.button>
            <span className="text-gray-500">|</span>
            <motion.button
              onClick={handleEditProject}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              编辑项目
            </motion.button>
          </div>

          {/* 项目标题 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{projectTitle || "Story Script Project"}</h1>
          </div>

          {/* 故事剧本预览 */}
          {generatedImages.length > 0 && (
            <div id="scene-preview-section" className="mt-8 bg-gray-900 rounded-xl p-6 md:p-8 shadow-xl">
              <div className="space-y-8">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">故事剧本预览</h3>
                  <p className="text-sm text-gray-400">将文本描述生成对应的故事剧本，每个场景对应一段文本描述</p>
                </div>
                <AnimatePresence mode="popLayout">
                  {generatedImages.map((item, index) => (
                    <motion.div
                      key={item.id}
                      layoutId={`scene-item-${item.id}`}
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -30, scale: 0.95 }}
                      transition={{ 
                        duration: 0.4, 
                        delay: index * 0.08,
                        ease: [0.25, 0.1, 0.25, 1]
                      }}
                      whileHover={{
                        y: -2,
                        transition: { duration: 0.2 }
                      }}
                      className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all relative"
                    >
                      <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="flex-shrink-0 flex flex-col items-center gap-3">
                          <div className="flex items-center justify-center gap-2">
                            <Info className="w-5 h-5 text-gray-400" />
                            <span className="text-sm text-gray-300 font-medium">场景{item.sceneNumber}</span>
                          </div>
                          <div className="relative w-56 h-40">
                            {item.imageStatus === 'failed' || !item.imageUrl ? (
                              <div className="w-full h-full bg-gray-700 rounded-lg flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-600">
                                <Info className="w-8 h-8 text-gray-500" />
                                <span className="text-xs text-gray-400">图片未生成</span>
                              </div>
                            ) : item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={`场景${item.sceneNumber}: ${item.text}`}
                                className="w-full h-full object-cover rounded-lg border-2 border-gray-700"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-700 rounded-lg flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-600">
                                <div className="w-8 h-8 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-gray-400">生成中...</span>
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
                              <span className="text-xs text-gray-500">镜头：</span>
                              <span className="text-sm text-gray-400">{item.camera}</span>
                            </div>
                          )}
                          
                          {item.dialogue && item.dialogue.length > 0 && (
                            <div>
                              <span className="text-xs text-gray-500">对白：</span>
                              <div className="mt-1 space-y-1">
                                {item.dialogue.map((line, idx) => (
                                  <p key={idx} className="text-sm text-gray-300">"{line}"</p>
                                ))}
                              </div>
                            </div>
                          )}
                          
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
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}

