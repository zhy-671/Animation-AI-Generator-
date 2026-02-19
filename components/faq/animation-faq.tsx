"use client";

import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

const defaultFaqs = [
  {
    id: 1,
    question: "What is Video AI Music?",
    answer:
      "Video AI Music is an online platform that helps you create music videos using artificial intelligence. You can easily input your song lyrics or upload your track to generate a complete music video in just a few minutes.",
  },
  {
    id: 2,
    question: "How does the AI create music videos?",
    answer:
      "The AI transforms your lyrics into stunning visuals by automatically generating characters and storyboards that match the mood of your music. You don’t need to know how to edit videos; the AI does all the hard work for you!",
  },
  {
    id: 3,
    question: "Can I use this tool if I have no video experience?",
    answer:
      "Absolutely! Video AI Music is designed to be user-friendly. Whether you are a beginner or an expert, you can easily create beautiful music videos without prior video editing skills.",
  },
  {
    id: 4,
    question: "What video styles can I choose from?",
    answer:
      "You can select from various styles for your music video, such as dramatic, upbeat, romantic, or energetic. Each style is tailored to create the right atmosphere that matches your song.",
  },
  {
    id: 5,
    question: "What quality can I expect from my music video?",
    answer:
      "You can generate music videos in high-definition quality at 720p, 1080p, or even 4K resolution. This makes them perfect for sharing on platforms like YouTube, TikTok, and Instagram.",
  },
  {
    id: 6,
    question: "How long does it take to create a music video?",
    answer:
      "With Video AI Music, you can have a finished music video ready in just about 5 minutes! This quick process allows you to share your creation almost instantly.",
  },
  {
    id: 7,
    question: "Can I share my music video on social media?",
    answer:
      "Yes! Once your music video is ready, you can download it and share it directly on social media platforms like TikTok, Instagram, and YouTube.",
  },
  {
    id: 8,
    question: "Do I need to pay to start using Video AI Music?",
    answer:
      "You can start using Video AI Music for free, and no credit card is required. It is a great opportunity to create professional-quality music videos without any initial cost.",
  },
  {
    id: 9,
    question: "What if I don’t have lyrics to start with?",
    answer:
      "If you don't have lyrics, you can still create a music video by uploading your song. The AI will generate visuals that correspond with the music, regardless of whether you have lyrics.",
  },
  {
    id: 10,
    question: "How does AI generate characters for my video?",
    answer:
      "The AI creates characters that fit the style and mood of your song. You can even specify what kind of characters you want, whether they are happy, serious, or quirky.",
  },
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
               Video AI Music– Frequently Asked Questions
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {(t as any).faq?.subtitle ?? 'Get answers about creating music videos with AI'}
            </p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq: { id: number; question: string; answer: string }, index: number) => (
              <motion.div
                key={faq.id}
                id={index === 0 ? "faq-what-is-music-video-ai" : 
                    index === 1 ? "faq-no-software-needed" :
                    index === 2 ? "faq-generation-time" :
                    index === 3 ? "faq-style-selection" :
                    index === 4 ? "faq-trim-segments" :
                    index === 5 ? "faq-audio-formats" :
                    index === 6 ? "faq-video-format" :
                    index === 7 ? "faq-privacy" :
                    index === 8 ? "faq-commercial-use" :
                    index === 9 ? "faq-mobile-support" :
                    index === 10 ? "faq-beat-sync" :
                    "faq-multiple-variations"}
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

