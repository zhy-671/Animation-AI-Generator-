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
    <section className="py-24 bg-gray-900 dark:bg-gray-950">
      <div className="container px-4 md:px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-8"
        >
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            Ready to Animate?
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Bring your ideas to life. Sign up free and discover why Animation AI Generator (Animaker AI) is the leading AI animation generator and animated video maker for short-form content.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              onClick={() => router.push(`/animation-ai-generator/text-to-video`)}
              size="lg"
              className="h-14 px-8 text-lg font-medium bg-white text-gray-900 hover:bg-gray-100 transition-all duration-200 rounded-full shadow-lg hover:shadow-xl"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <p className="text-sm text-gray-400 pt-4">
            Free to start • No signup required • Ready in seconds
          </p>
        </motion.div>
      </div>
    </section>
  );
}

