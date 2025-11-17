"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Info } from "lucide-react";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";

export default function StoryboardProjectsList() {
  const router = useRouter();
  const [myProjects, setMyProjects] = useState<Array<{
    id: string;
    title: string;
    summary: string;
    cover_image_url: string | null;
    created_at: string;
    updated_at: string;
  }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    loadMyProjects();
  }, []);

  const loadMyProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch("/api/storyboard/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        // 将项目数据转换为组件需要的格式
        setMyProjects(result.data.map((project: any) => ({
          id: project.id,
          title: project.title,
          summary: project.content ? (project.content.substring(0, 100) + (project.content.length > 100 ? "..." : "")) : "", // 使用内容的前100个字符作为摘要
          cover_image_url: project.thumbnail_url || null, // 使用第一个分镜的视频缩略图
          created_at: project.created_at,
          updated_at: project.updated_at,
        })));
      }
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleNewProject = () => {
    router.push("/storyboard/new-anime-story");
  };

  const handleLoadProject = (projectId: string) => {
    // 设置项目ID到 sessionStorage，确保后续保存时使用同一个项目
    sessionStorage.setItem("storyboardProjectId", projectId);
    router.push(`/storyboard/project/${projectId}/create`);
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这个项目吗？")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/storyboard/projects/${projectId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setMyProjects(prev => prev.filter(p => p.id !== projectId));
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete project");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      alert(error instanceof Error ? error.message : "删除项目失败");
    }
  };

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
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Story Script Creator</h1>
            <p className="text-gray-400">Create detailed story scripts with AI-powered scene generation</p>
          </div>

          {/* 新建项目按钮 */}
          <div className="mb-6">
            <motion.button
              onClick={handleNewProject}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 px-6 py-4 bg-gray-900 hover:bg-gray-800 border-2 border-dashed border-gray-700 hover:border-[#FFDA2A] rounded-xl transition-all group w-full"
            >
              <div className="w-12 h-12 bg-gray-800 group-hover:bg-[#FFDA2A]/20 rounded-lg flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6 text-gray-400 group-hover:text-[#FFDA2A] transition-colors" />
              </div>
              <div className="text-left">
                <div className="text-lg font-semibold text-white">New Project</div>
                  <div className="text-sm text-gray-400">Start a new story project</div>
                </div>
              </motion.button>
            </div>
        </motion.div>

        {/* 我的项目列表 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
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
                <Info className="w-8 h-8 text-[#FFDA2A]" />
              </motion.div>
            </div>
          ) : myProjects.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No projects yet. Click "New Project" to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: index * 0.06,
                    ease: [0.25, 0.1, 0.25, 1]
                  }}
                  whileHover={{ 
                    y: -4, 
                    scale: 1.02,
                    transition: { duration: 0.2 }
                  }}
                  className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-[#FFDA2A]/50 transition-all cursor-pointer group relative"
                  onClick={() => handleLoadProject(project.id)}
                >
                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  {/* 封面图 */}
                  <div className="aspect-video bg-gray-800 relative overflow-hidden">
                    {project.cover_image_url ? (
                      <img
                        src={project.cover_image_url}
                        alt={project.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
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
      </div>

      <Footer />
    </div>
  );
}

