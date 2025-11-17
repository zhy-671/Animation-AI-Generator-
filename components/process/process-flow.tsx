"use client";

import { motion } from "framer-motion";
import { ArrowRight, Type, Sparkles } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Type,
    title: "Describe Your Idea",
    description: "Enter a text prompt or upload an image (e.g. \"A robot dancing on the moon\"). This kicks off the animation process."
  },
  {
    number: "02",
    icon: Sparkles,
    title: "Customize with AI",
    description: "Pick a style (2D cartoon, 3D realistic, etc.) and use our AI character animator to refine characters and settings. The tools are designed for creators of all skill levels."
  },
  {
    number: "03",
    icon: ArrowRight,
    title: "Generate & Share",
    description: "Click \"Generate\" and watch the animation come to life. Export your creation in formats optimized for TikTok, Reels, YouTube Shorts, or any platform."
  }
];

export default function ProcessFlow() {
  return (
    <section className="py-24 bg-white dark:bg-gray-900">
      <div className="container px-4 md:px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 mb-20"
        >
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Create an Animation in 3 Easy Steps
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            No tutorials needed. No complex settings. Just describe, customize, and create.
          </p>
        </motion.div>

        <div className="space-y-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="flex flex-col md:flex-row items-start gap-8"
            >
              <div className="flex-shrink-0">
                <div className="flex items-center gap-6">
                  <div className="text-6xl font-bold text-gray-200 dark:text-gray-800">
                    {step.number}
                  </div>
                  <div className="h-16 w-16 rounded-2xl bg-gray-900 dark:bg-white flex items-center justify-center">
                    <step.icon className="h-8 w-8 text-white dark:text-gray-900" />
                  </div>
                </div>
              </div>
              <div className="flex-1 pt-2">
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

