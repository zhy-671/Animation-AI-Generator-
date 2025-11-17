"use client";

import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

const defaultFaqs = [
  {
    id: 1,
    question: "How does the Animation AI Generator work?",
    answer: "Our platform uses AI to transform your story ideas into complete animated videos. Start by entering your story concept, and our AI will generate a complete script with chapters. Then customize your project settings including visual style, aspect ratio, and character designs. The AI generates storyboards with detailed shots, and finally creates animated video clips. You can edit, add subtitles, voiceovers, and compose your final video."
  },
  {
    id: 2,
    question: "What is the complete workflow?",
    answer: "The workflow consists of four main steps: 1) Story Script - Enter your idea and AI generates a complete story with chapters. 2) Settings - Configure visual style (2D Animation, 3D Animation, Japanese Anime, etc.), aspect ratio (16:9, 9:16, 1:1, etc.), and design characters with AI-generated images. 3) Storyboard - AI generates detailed shots with camera angles, movements, and compositions. 4) Create Video - Generate video clips for each shot, then edit and compose your final video with subtitles and voiceovers."
  },
  {
    id: 3,
    question: "What visual styles are available?",
    answer: "We support multiple visual styles including: 2D Animation (hand-drawn style), 3D Animation (CGI rendered), Japanese Anime (cel-shaded), Cyberpunk, Clay Animation, Comic Book, Cartoon Style, and 3D Cartoon. Each style affects the overall look of your characters and scenes."
  },
  {
    id: 4,
    question: "How do I design characters?",
    answer: "In the Settings step, you can add characters and click 'Design' to generate AI character images. Enter character details including name, age, gender, appearance description (hair, eyes, height, build, etc.), and clothing description. The AI will generate character images based on your selected visual style and aspect ratio. You can regenerate images until you're satisfied."
  },
  {
    id: 5,
    question: "What aspect ratios can I choose?",
    answer: "We support multiple aspect ratios: 16:9 (Landscape) for widescreen videos, 9:16 (Portrait) for mobile/social media, 1:1 (Square) for Instagram posts, 4:3 (Traditional) for classic format, and 21:9 (Ultrawide) for cinematic content. Your choice affects both character images and final video output."
  },
  {
    id: 6,
    question: "How long does storyboard generation take?",
    answer: "Storyboard generation typically takes 1-3 minutes. The AI analyzes your scene story and generates 5-10 detailed shots per scene, including camera angles, movements, compositions, lighting, and mood. Each shot includes detailed image and video prompts optimized for AI generation."
  },
  {
    id: 7,
    question: "How long does video generation take?",
    answer: "Video generation for each shot typically takes 2-3 minutes. You can generate videos for individual shots or multiple shots. The system supports resolutions from 480P to 1080P and durations of 5 or 10 seconds per clip. You'll see a progress indicator during generation."
  },
  {
    id: 8,
    question: "Can I edit shots after generation?",
    answer: "Yes! You can edit shot details including description, composition, camera angle, camera movement, lighting, mood, characters, dialogue, and narration. You can also regenerate images for shots, choosing from up to 4 generated options. All edits are saved to your project."
  },
  {
    id: 9,
    question: "What video editing features are available?",
    answer: "The video editor includes: Timeline editing with playhead control, subtitle tracks for adding text overlays, voiceover tracks for narration, shot track showing all video clips, video preview with playback controls, and export functionality. You can arrange clips, add timing, and compose your final video."
  },
  {
    id: 10,
    question: "How are credits used?",
    answer: "Credits are consumed for AI operations: story script generation, character image generation, storyboard generation, shot image generation, and video generation. Different operations consume different amounts of credits. You can purchase credits or subscribe to a plan that includes credits."
  },
  {
    id: 11,
    question: "Can I save my projects?",
    answer: "Yes! All projects are automatically saved. You can access your projects from 'My Projects' to continue working on them later. Projects save your story script, settings, characters, storyboards, and generated videos. You can edit any step at any time."
  },
  {
    id: 12,
    question: "What happens if generation fails?",
    answer: "If generation fails, you'll see an error message. Common issues include content moderation (inappropriate content), API timeouts, or network errors. You can retry the generation. For image generation, you can regenerate up to 4 times. For videos, you can regenerate individual shots."
  },
  {
    id: 13,
    question: "Can I use generated content commercially?",
    answer: "Yes, all content you generate is yours to use commercially. You can use it for social media, marketing, presentations, or any commercial projects. However, please review our Terms of Service for complete usage rights and restrictions."
  },
  {
    id: 14,
    question: "Do I need to complete all steps in order?",
    answer: "Yes, steps must be completed in order: Story Script → Settings → Storyboard → Create Video. Each step unlocks the next. However, you can return to previous steps to edit. The navigation bar shows your progress and which steps are available."
  },
  {
    id: 15,
    question: "What video formats and resolutions are supported?",
    answer: "Videos are generated in MP4 format. Supported resolutions include 480P, 720P, and 1080P. Duration options are 5 seconds or 10 seconds per clip. The final composed video maintains your selected aspect ratio and can be exported for download."
  }
];

export default function AnimationFAQ() {
  const { t } = useTranslation();
  const [openItems, setOpenItems] = useState<number[]>([]);

  const faqs = useMemo(() => {
    if ((t as any).faq?.items) {
      return (t as any).faq.items.map((item: any, idx: number) => ({ id: idx + 1, question: item.q, answer: item.a }));
    }
    return defaultFaqs;
  }, [t]);

  const toggleItem = (id: number) => {
    setOpenItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  return (
    <section id="faq" className="py-24 bg-white dark:bg-gray-900">
      <div className="container px-4 md:px-6">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              {(t as any).faq?.title ?? 'Frequently asked questions'}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {(t as any).faq?.subtitle ?? 'Everything you need to know'}
            </p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq: { id: number; question: string; answer: string }, index: number) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900"
              >
                <button
                  onClick={() => toggleItem(faq.id)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white pr-4">
                    {faq.question}
                  </span>
                  {openItems.includes(faq.id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                
                {openItems.includes(faq.id) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-6 pb-5"
                  >
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

