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
    <section id="examples" className="py-24 bg-gray-50 dark:bg-gray-950">
      <div className="container px-4 md:px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            See It in Action
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Real animations made by creators like you. Get inspired, then make your own.
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
                <Card className="group hover:shadow-lg transition-all duration-200 border-0 overflow-hidden bg-white dark:bg-gray-900">
                  <CardContent className="p-0">
                    <div className="relative aspect-[9/16] overflow-hidden bg-gray-100 dark:bg-gray-800">
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

