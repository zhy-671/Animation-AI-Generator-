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
  },
  {
    id: 16,
    question: "Can AI generate animations?",
    answer: "Yes! AI can generate animations from text descriptions or images. Our Animation AI Generator uses advanced AI technology to create professional animated videos in seconds. Simply describe your idea or upload an image, and our AI will transform it into a captivating animated video."
  },
  {
    id: 17,
    question: "Can ChatGPT animate?",
    answer: "ChatGPT is a text-based AI that can help with animation scripts and ideas, but it cannot directly create animated videos. Our Animation AI Generator specializes in creating actual animated videos from text or images, bringing your ideas to life visually."
  },
  {
    id: 18,
    question: "Is there a free AI cartoon generator?",
    answer: "Yes! Our Animation AI Generator offers free cartoon and animation generation. You can create animated videos and cartoons from text or images without any cost. Basic features are free, and you can upgrade for more advanced options."
  },
  {
    id: 19,
    question: "How to animate a picture using AI free?",
    answer: "Simply upload your image to our Image-to-Video Animation Generator, and our AI will automatically transform it into an animated video. The process is free and takes just seconds. You can customize styles, add effects, and create professional animations without any expertise needed."
  },
  {
    id: 20,
    question: "Can CapCut animate photos?",
    answer: "CapCut is primarily a video editing tool, not an AI animation generator. Our Animation AI Generator specializes in creating animated videos from static images using AI technology, transforming photos into dynamic animated sequences automatically."
  },
  {
    id: 21,
    question: "How to convert picture to animation?",
    answer: "Upload your picture to our Image-to-Video Animation Generator. Our AI analyzes your image and creates an animated video version. You can choose from various animation styles (2D, 3D, Anime, Cartoon, etc.) and customize the animation to match your vision."
  },
  {
    id: 22,
    question: "Can ChatGPT cartoonize a photo?",
    answer: "ChatGPT cannot directly cartoonize photos or create images. Our Animation AI Generator can transform photos into animated videos with various cartoon styles. Upload your photo and select a cartoon animation style to create animated content."
  },
  {
    id: 23,
    question: "Is AI animation free?",
    answer: "Yes! Our basic AI animation features are completely free. You can create animated videos from text or images without any cost. We offer free credits to get started, and you can purchase additional credits or subscribe to plans for more advanced features."
  },
  {
    id: 24,
    question: "Is Animaker actually free?",
    answer: "Our Animation AI Generator offers free basic features for creating animations. You can generate animated videos from text or images at no cost. We provide free credits to help you get started, with optional paid plans for extended usage and premium features."
  },
  {
    id: 25,
    question: "Which AI animation tool is best?",
    answer: "Our Animation AI Generator stands out with its ease of use, fast generation times, and high-quality results. We support multiple animation styles (2D, 3D, Anime, Cartoon), offer both text-to-video and image-to-video options, and provide a complete storyboard workflow. Try it free and see why creators choose us!"
  },
  {
    id: 26,
    question: "How to animate a picture using ChatGPT free?",
    answer: "ChatGPT cannot animate pictures directly. However, you can use our free Image-to-Video Animation Generator to animate your pictures. Simply upload your image, and our AI will create an animated video version in seconds - completely free to get started."
  },
  {
    id: 27,
    question: "Is Disney using AI to animate?",
    answer: "Major animation studios are exploring AI tools for various production tasks. Our Animation AI Generator brings professional-grade AI animation capabilities to everyone, allowing creators to produce Disney-quality animated content quickly and affordably."
  },
  {
    id: 28,
    question: "Can I make 3D animation for free?",
    answer: "Yes! Our Animation AI Generator includes free 3D animation capabilities. You can create 3D animated videos from text descriptions or images without any cost. Select the 3D animation style and watch your ideas come to life in three dimensions."
  },
  {
    id: 29,
    question: "Is AI replacing animators?",
    answer: "AI is a powerful tool that enhances animators' capabilities rather than replacing them. Our Animation AI Generator helps creators bring ideas to life faster, allowing animators to focus on creative direction and refinement. It's a collaborative tool that empowers creators."
  },
  {
    id: 30,
    question: "What are the 4 types of animation?",
    answer: "The four main types of animation are: 1) Traditional/2D Animation - hand-drawn frame-by-frame animation, 2) 3D Animation - computer-generated three-dimensional animation, 3) Stop Motion - physical objects photographed frame-by-frame, and 4) Motion Graphics - animated graphic design elements. Our tool supports 2D, 3D, and various modern animation styles."
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
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              Frequently Asked Questions
            </h1>
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

