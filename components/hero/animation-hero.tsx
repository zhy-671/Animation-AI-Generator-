"use client";

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function AnimationHero() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // 确保视频播放
    if (videoRef.current) {
      videoRef.current.play().catch((error) => {
      });
    }
  }, []);

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-16">
      {/* Background Video */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
          onError={(e) => {
          }}
          onLoadedData={() => {
          }}
        >
          <source src="/videos/The-Jungle-Book.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {/* Darker overlay for better text readability */}
        <div className="absolute inset-0 bg-black/60 dark:bg-black/80" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-pink-50/30 dark:from-gray-900/70 dark:via-gray-800/70 dark:to-gray-900/70" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0001_1px,transparent_1px),linear-gradient(to_bottom,#0001_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#fff1_1px,transparent_1px),linear-gradient(to_bottom,#fff1_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_40%,transparent_100%)]" />
      </div>

      <div className="container relative z-10 px-4 md:px-6 max-w-6xl mx-auto">
        <div className="text-center space-y-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-100 dark:text-gray-200">Turn ideas into motion</span>
          </motion.div>

          {/* Main Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-4"
          >
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl drop-shadow-lg">
              Animation AI Generator
            </h1>
            
            <h2 className="text-lg font-normal text-gray-100 sm:text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed drop-shadow-md">
              Turn ideas into incredible animations. Our Animation AI Generator (Animaker AI) is the ultimate Animated Video Maker for short-form content. Whether you want cartoon fun or realistic 3D animations, simply describe your vision and watch it come to life.
            </h2>
            
            <p className="text-base font-normal text-gray-200 sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed drop-shadow-md">
              AI Animation Storyboarding: Generate story scenes from a single sentence. Create better animated short films with our intelligent scene generation tool.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4"
          >
            <Button
              onClick={() => router.push(`/animation-ai-generator/text-to-video`)}
              size="lg"
              className="h-14 px-8 text-lg font-medium bg-[#FFDA2A] text-gray-900 hover:bg-[#FFDA2A] transition-all duration-200 rounded-full shadow-lg hover:shadow-xl"
            >
              Start Creating Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-8 pt-12 text-sm text-gray-200 dark:text-gray-300"
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              <span>Text or image input</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
              <span>Ready in seconds</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
              <span>Multiple styles</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

