"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Music, Mic, Video, Sparkles, ArrowRight, Play, TrendingUp, Zap, Star } from "lucide-react";

export default function MusicVideoHero() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const audioWaveformRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 确保视频播放
  useEffect(() => {
    if (videoRef.current && mounted) {
      videoRef.current.play().catch((error) => {
        console.error("Error playing background video:", error);
      });
    }
  }, [mounted]);

  // Animated audio waveform effect
  useEffect(() => {
    if (!audioWaveformRef.current || !mounted) return;

    const bars = audioWaveformRef.current.querySelectorAll('.wave-bar');
    const animateBars = () => {
      bars.forEach((bar) => {
        const height = Math.random() * 100;
        (bar as HTMLElement).style.height = `${15 + height}%`;
      });
    };

    const interval = setInterval(animateBars, 120);
    return () => clearInterval(interval);
  }, [mounted]);

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
      {/* Premium Background with Multiple Layers */}
      <div className="absolute inset-0 overflow-hidden z-0">
        {/* Background Video */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        >
          <source src="/videos/home_bg.mp4" type="video/mp4" />
        </video>
        
        {/* Video Overlay - Dark gradient to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70" />
        
        {/* Base Gradient - Black/Gold Theme (as fallback and additional overlay) */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-gray-900/30 to-black/40" />
        
        {/* Animated Gradient Overlay - Gold Accents */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-yellow-600/10 via-amber-600/15 to-yellow-600/10"
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />

        {/* Dynamic Grid Pattern - More Subtle */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_100%_60%_at_50%_0%,#000_30%,transparent_100%)]" />
        
        {/* Animated Orbs/Blobs */}
        {mounted && (
          <>
            <motion.div
              className="absolute top-20 left-10 w-96 h-96 bg-yellow-600/15 rounded-full blur-3xl"
              animate={{
                x: [0, 100, 0],
                y: [0, 50, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute bottom-20 right-10 w-96 h-96 bg-amber-600/15 rounded-full blur-3xl"
              animate={{
                x: [0, -100, 0],
                y: [0, -50, 0],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
            />
            <motion.div
              className="absolute top-1/2 left-1/2 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}

        {/* Floating Music Notes */}
        {mounted && (
          <div className="absolute inset-0">
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-white/10"
                initial={{
                  x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
                  y: typeof window !== 'undefined' ? window.innerHeight + 50 : 1080,
                  rotate: Math.random() * 360,
                }}
                animate={{
                  y: -100,
                  rotate: 360,
                  opacity: [0, 0.3, 0],
                }}
                transition={{
                  duration: Math.random() * 10 + 15,
                  repeat: Infinity,
                  delay: Math.random() * 5,
                  ease: "linear",
                }}
              >
                <Music className="w-6 h-6" />
              </motion.div>
            ))}
          </div>
        )}

        {/* Enhanced Audio Waveform Visualizer */}
        <div className="absolute bottom-0 left-0 right-0 h-40 flex items-end justify-center gap-0.5 px-4 opacity-40">
          <div ref={audioWaveformRef} className="flex items-end justify-center gap-0.5 h-full">
            {[...Array(60)].map((_, i) => (
              <motion.div
                key={i}
                className="wave-bar w-0.5 bg-gradient-to-t from-yellow-500 via-amber-400 to-white rounded-full"
                initial={{ height: '15%' }}
                animate={{
                  height: [
                    '15%',
                    `${15 + Math.random() * 85}%`,
                    '15%',
                  ],
                }}
                transition={{
                  duration: 0.4 + Math.random() * 0.4,
                  repeat: Infinity,
                  delay: Math.random() * 0.3,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>

        {/* Sophisticated Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-transparent via-black/10 to-transparent" />
      </div>

      {/* Main Content */}
      <div className="container relative z-10 px-4 md:px-6 max-w-7xl mx-auto pt-20 pb-16">
        <div className="text-center space-y-8">
          {/* Premium Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </motion.div>
            <span className="text-sm font-semibold text-white/90 tracking-wide">An all-in-one platform for video AI music creation</span>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <TrendingUp className="w-4 h-4 text-yellow-400" />
            </motion.div>
          </motion.div>

          {/* Main Heading - More Impactful */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="space-y-6"
          >
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl leading-tight">
              <motion.span
                className="block bg-gradient-to-r from-yellow-200 via-amber-200 to-yellow-300 bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%"],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                style={{
                  backgroundSize: "200% 200%",
                }}
              >
                Create Music Videos
              </motion.span>
              <motion.span
                className="block bg-gradient-to-r from-amber-200 via-yellow-200 to-yellow-300 bg-clip-text text-transparent mt-2"
                animate={{
                  backgroundPosition: ["100% 50%", "0% 50%"],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                style={{
                  backgroundSize: "200% 200%",
                }}
              >
                with AI
              </motion.span>
            </h1>
            
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="text-lg font-light text-gray-200 sm:text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed"
            >
              Generate original music and turn it into{" "}
              <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400">
                visually synced videos
              </span>
              . Make characters sing with realistic lip sync, or create music videos that match your track's rhythm and mood.
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="text-base font-normal text-gray-300 sm:text-lg max-w-2xl mx-auto leading-relaxed"
            >
              For content creators, musicians, and video makers. Start with lyrics or upload your track—get a complete music video in minutes, not weeks.
            </motion.p>
          </motion.div>

          {/* Premium CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-5 justify-center items-center pt-8"
          >
            <Button
              onClick={() => router.push(`/ai-music-video-generator`)}
              size="lg"
              className="group h-16 px-12 text-lg font-bold bg-gradient-to-r from-yellow-600 via-amber-600 to-yellow-500 text-black hover:from-yellow-500 hover:via-amber-500 hover:to-yellow-400 transition-all duration-300 rounded-2xl shadow-2xl hover:shadow-yellow-500/50 hover:scale-105 border-2 border-yellow-400/30"
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="mr-2"
              >
                <Music className="w-5 h-5" />
              </motion.div>
              Create Music Video Free
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={() => router.push(`/animation-ai-generator/text-to-video`)}
              size="lg"
              variant="outline"
              className="h-16 px-12 text-lg font-semibold bg-white/5 backdrop-blur-xl border-2 border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300 rounded-2xl shadow-xl"
            >
              <Video className="w-5 h-5 mr-2" />
              Try Animation Generator
            </Button>
          </motion.div>

          {/* Enhanced Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-3 pt-10"
          >
            {[
              { icon: Music, text: "Generate Music", color: "from-yellow-400 to-amber-400" },
              { icon: Mic, text: "Lip Sync Videos", color: "from-amber-400 to-yellow-500" },
              { icon: Video, text: "Music to Video", color: "from-yellow-500 to-amber-500" },
              { icon: Sparkles, text: "Auto Storyboard", color: "from-amber-500 to-yellow-400" },
              { icon: Play, text: "Ready in Minutes", color: "from-yellow-400 to-amber-400" },
            ].map((feature, index) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.7 + index * 0.1 }}
                className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer"
              >
                <feature.icon className={`w-4 h-4 text-transparent bg-clip-text bg-gradient-to-r ${feature.color}`} />
                <span className="text-sm text-white/90 font-medium">{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Premium Stats with Icons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="grid grid-cols-3 gap-8 pt-12 max-w-3xl mx-auto"
          >
            {[
              { value: "10K+", label: "Music Videos", gradient: "from-yellow-400 to-amber-400", icon: Video },
              { value: "5min", label: "Creation Time", gradient: "from-amber-400 to-yellow-500", icon: Zap },
              { value: "4K", label: "HD Quality", gradient: "from-yellow-500 to-amber-500", icon: Star },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
                className="text-center"
              >
                  <div className="flex items-center justify-center gap-2 mb-2">
                  <stat.icon className={`w-5 h-5 text-transparent bg-clip-text bg-gradient-to-r ${stat.gradient}`} />
                  <div className={`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r ${stat.gradient}`}>
                    {stat.value}
                  </div>
                </div>
                <div className="text-xs text-gray-300 font-medium tracking-wide">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Enhanced Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2 cursor-pointer"
        >
          <span className="text-xs text-white/60 font-medium tracking-wider">SCROLL</span>
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center p-1.5">
            <motion.div
              animate={{ y: [0, 16, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-1.5 h-3 bg-gradient-to-b from-white/80 to-white/40 rounded-full"
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

