"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Video, Briefcase, GraduationCap, Heart } from "lucide-react";

const useCases = [
  {
    icon: Video,
    title: "I turned my story into a cartoon music video in minutes!",
    description: "A TikTok creator wrote a short script and used our cartoon animation software to produce a vibrant animated clip that went viral.",
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: Briefcase,
    title: "Best AI animation tool of 2025!",
    description: "A marketing team transformed a product demo into realistic 3D animations with just a few prompts, calling it one of the most powerful AI animation generators they've used.",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: GraduationCap,
    title: "Now anyone on the team can make pro-level videos.",
    description: "An educator generated quick explainer videos by inputting lesson text. Our platform's ease helped her generate animations from text prompts for her online class.",
    color: "from-green-500 to-emerald-500"
  },
  {
    icon: Heart,
    title: "Our engagement skyrocketed.",
    description: "A small business used the video animation platform to craft eye-catching ads for Instagram. The animated video maker boosted their click-through rate dramatically.",
    color: "from-red-500 to-orange-500"
  }
];

export default function UseCases() {
  return (
    <section className="py-24 bg-gray-50 dark:bg-gray-950">
      <div className="container px-4 md:px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Success Stories
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            See how creators are using our AI animation generator to bring their ideas to life.
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
              <Card className="h-full border-0 shadow-sm hover:shadow-lg transition-all duration-200 bg-white dark:bg-gray-900">
                <CardContent className="p-8">
                  <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${useCase.color} mb-6`}>
                    <useCase.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
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

