"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Music, Mic, Video, Palette, Zap, Download, Film, Sparkles } from "lucide-react";

const features = [
  {
    icon: Music,
    title: "Lyrics to Video in Minutes",
    description: "Simply paste your song lyrics and watch AI transform them into a professional music video. No video editing skills required – our AI handles everything from storyboard to final video."
  },
  {
    icon: Mic,
    title: "AI Character Generation",
    description: "Automatically generate characters based on your lyrics and vocal type. AI creates unique characters that match your song's mood and style, bringing your music to life visually."
  },
  {
    icon: Film,
    title: "Cinematic Storyboards",
    description: "AI generates professional storyboards that match your lyrics. Each scene is carefully crafted to enhance your song's narrative and emotional impact."
  },
  {
    icon: Video,
    title: "Multiple Video Styles",
    description: "Choose from various cinematic styles – from dramatic to upbeat, romantic to energetic. Each style is optimized to create the perfect visual atmosphere for your music."
  },
  {
    icon: Palette,
    title: "Professional MV Quality",
    description: "Generate high-quality music videos in 720p, 1080p, or 4K resolution. Perfect for YouTube, TikTok, Instagram, and other social platforms."
  },
  {
    icon: Zap,
    title: "Portrait & Landscape Formats",
    description: "Create vertical videos (9:16) for TikTok and Instagram Reels, or horizontal (16:9) for YouTube. Our AI adapts to your preferred format automatically."
  },
  {
    icon: Download,
    title: "Export & Share Instantly",
    description: "Download your music video in seconds. Share directly to social media or use in your professional projects. Works seamlessly across all devices."
  }
];

const iconGradients = [
  "from-yellow-500 to-amber-500",
  "from-amber-500 to-yellow-600",
  "from-yellow-600 to-amber-600",
  "from-amber-600 to-yellow-500",
  "from-yellow-500 to-amber-500",
  "from-amber-500 to-yellow-600",
  "from-yellow-600 to-amber-600",
];

export default function FeaturesShowcase() {
  return (
    <section id="features" className="py-32 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-100/20 via-transparent to-transparent dark:from-yellow-900/10" />
      
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
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-semibold">Powerful Features</span>
          </motion.div>
          <h2 className="text-5xl font-black tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
              Create Amazing MVs
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Professional tools designed for artists and creators. Transform your lyrics into stunning music videos with AI-powered features.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <Card className="h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 group">
                <CardContent className="p-8">
                  <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${iconGradients[index % iconGradients.length]} mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

