"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Music, Mic, Video, TrendingUp } from "lucide-react";

const useCases = [
  {
    icon: Music,
    title: "My first music video got 100K views on TikTok!",
    description: "An independent artist used VerseMovie to turn their lyrics into a professional MV. The AI-generated visuals perfectly matched the song's mood, and the video went viral within days.",
    color: "from-yellow-500 to-amber-500"
  },
  {
    icon: Mic,
    title: "Created a cinematic MV in just 5 minutes",
    description: "A singer-songwriter pasted their lyrics, selected a style, and watched AI generate a stunning music video with characters and scenes that brought their song to life.",
    color: "from-amber-500 to-yellow-600"
  },
  {
    icon: Video,
    title: "Professional quality without the studio cost",
    description: "A music producer used VerseMovie to create multiple MV concepts for client pitches. The AI-generated videos saved thousands in production costs while maintaining professional quality.",
    color: "from-yellow-600 to-amber-600"
  },
  {
    icon: TrendingUp,
    title: "Boosted my YouTube channel engagement by 300%",
    description: "A content creator started using VerseMovie for all their music videos. The consistent, high-quality visuals helped their channel grow rapidly and increased subscriber engagement significantly.",
    color: "from-amber-600 to-yellow-500"
  }
];

export default function UseCases() {
  return (
    <section className="py-32 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 relative overflow-hidden">
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
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-semibold">Success Stories</span>
          </motion.div>
          <h2 className="text-5xl font-black tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            Success Stories from{" "}
            <span className="bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
              Artists
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            See how musicians and creators are using VerseMovie to transform their lyrics into stunning music videos and grow their audience.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 group hover:scale-105">
                <CardContent className="p-8">
                  <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${useCase.color} mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <useCase.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                    {useCase.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {useCase.description}
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

