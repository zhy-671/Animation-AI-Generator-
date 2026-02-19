"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";

export default function CTA() {
  const router = useRouter();
  const { locale } = useTranslation();

  return (
    <section className="py-24 bg-gradient-to-br from-black via-gray-900 to-black relative overflow-hidden">
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:60px_60px]" />
      <div className="container px-4 md:px-6 max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-8"
        >
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            Ready to Create Your Music Video?
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Transform your lyrics into cinematic music videos with AI. Join thousands of artists using VerseMovie to bring their music to life visually.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              onClick={() => router.push(`/ai-music-video-generator`)}
              size="lg"
              className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-yellow-600 via-amber-600 to-yellow-500 text-black hover:from-yellow-500 hover:via-amber-500 hover:to-yellow-400 transition-all duration-300 rounded-full shadow-2xl hover:shadow-yellow-500/50"
            >
              Create Music Video Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <p className="text-sm text-gray-400 pt-4">
            Free to start • No credit card required • Professional quality in minutes
          </p>
        </motion.div>
      </div>
    </section>
  );
}

