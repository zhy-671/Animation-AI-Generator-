"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Play } from "lucide-react";

type VideoItem = { url: string; filename: string; title: string };

export default function Examples() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedVideos, setFailedVideos] = useState<Set<string>>(new Set());

  const handleVideoError = (url: string) => {
    setFailedVideos((prev) => new Set(prev).add(url));
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/videos')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP error! status: ${r.status}`);
        }
        const contentType = r.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        return r.json();
      })
      .then((data) => {
        if (!mounted) return;
        setVideos(Array.isArray(data?.videos) ? data.videos.slice(0, 8) : []);
        setLoading(false);
      })
      .catch((error) => {
        setVideos([]);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <section id="examples" className="py-32 bg-gradient-to-b from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-yellow-100/20 via-transparent to-transparent dark:from-yellow-900/10" />
      
      <div className="container px-4 md:px-6 max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-5 mb-20"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 mb-4"
          >
            <Play className="w-4 h-4" />
            <span className="text-sm font-semibold">Real Examples</span>
          </motion.div>
          <h2 className="text-5xl font-black tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            See Music Videos{" "}
            <span className="bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
              in Action
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Real music videos created with VerseMovie. Get inspired by these AI-generated MVs, then create your own professional videos.
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400">Loading examples...</p>
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {videos.map((video, index) => (
              <motion.div
                key={`${video.url}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="group hover:shadow-2xl transition-all duration-300 border-0 overflow-hidden bg-white dark:bg-gray-900 hover:scale-105">
                  <CardContent className="p-0">
                    <div className="relative aspect-[9/16] overflow-hidden bg-gray-100 dark:bg-gray-800 group-hover:brightness-110 transition-all duration-300">
                      {failedVideos.has(video.url) ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
                          <div className="text-center p-4">
                            <Play className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                            <p className="text-xs text-gray-500 dark:text-gray-400">Video unavailable</p>
                          </div>
                        </div>
                      ) : (
                        <video 
                          className="w-full h-full object-cover" 
                          preload="metadata" 
                          controls
                          playsInline
                          aria-label={`AI-generated animated video example: ${video.title}`}
                          onError={(e) => {
                            const target = e.target as HTMLVideoElement;
                            const error = target.error;
                            
                            // Silently handle video errors - just mark as failed
                            // Only log if there's a specific error code
                            if (error && error.code !== null && error.code !== undefined) {
                              const errorMessages: Record<number, string> = {
                                1: 'MEDIA_ERR_ABORTED',
                                2: 'MEDIA_ERR_NETWORK',
                                3: 'MEDIA_ERR_DECODE',
                                4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                              };
                              
                              const errorType = errorMessages[error.code] || `Error code ${error.code}`;
                              // Only log network and decode errors, ignore aborted errors
                              if (error.code === 2 || error.code === 3) {
                              }
                            }
                            
                            // Mark video as failed to show placeholder
                            handleVideoError(video.url);
                          }}
                          onLoadedData={() => {
                          }}
                        >
                          <source src={video.url} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                        {video.title}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400">Examples coming soon</p>
          </div>
        )}
      </div>
    </section>
  );
}

