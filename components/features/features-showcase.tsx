"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Type, Image as ImageIcon, Palette, Zap, Download, Globe, Film } from "lucide-react";

const features = [
  {
    icon: Type,
    title: "Intuitive Animation AI Generator | Animaker AI",
    description: "Quickly generate animations from text prompts or images. Describe a scene, and our AI-powered animation platform (Animaker AI) does the rest – no drawing skills needed."
  },
  {
    icon: Film,
    title: "AI Animation Storyboarding",
    description: "Generate story scenes from a single sentence. Create better animated short films with our intelligent scene generation tool that transforms your ideas into visual storyboards instantly."
  },
  {
    icon: ImageIcon,
    title: "2D & 3D Animation Tools",
    description: "Switch seamlessly between 2D and 3D modes. Create cartoon-style scenes or produce lifelike, realistic 3D animations for any project."
  },
  {
    icon: Palette,
    title: "AI Character Animator",
    description: "Design and animate unique characters in minutes. Use our intuitive character creator to build and animate custom characters for any story."
  },
  {
    icon: Zap,
    title: "All-in-One Video Animation Platform",
    description: "Combine scenes, music, and voiceovers in one easy interface. Access a large library of templates, music tracks, and assets to speed up creation."
  },
  {
    icon: Download,
    title: "Built for Short-Form Videos",
    description: "Optimized for TikTok, Instagram Reels, and YouTube Shorts. Create vertical, engaging clips that stand out in social feeds – our platform's short-form features make sharing effortless."
  },
  {
    icon: Globe,
    title: "Export Anywhere",
    description: "Download in HD or 4K. Share on social platforms or use in your projects. Works on any device – phone, tablet, or computer."
  }
];

export default function FeaturesShowcase() {
  return (
    <section id="features" className="py-24 bg-white dark:bg-gray-900">
      <div className="container px-4 md:px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Key Features
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Everything you need to create professional animations. Powerful tools designed for creators of all skill levels.
          </p>
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-gray-50/50 dark:bg-gray-800/50">
                <CardContent className="p-8">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 mb-6">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
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

